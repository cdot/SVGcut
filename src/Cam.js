/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global App */
/* global assert */

import { CutPoint } from "./CutPoint.js";
import { CutPath } from "./CutPath.js";
import { CutPaths } from "./CutPaths.js";
import * as Partition from "./Partition.js";
import * as Flatten from 'flatten-js';

/**
 * Support for different CAM operations
 * @namespace Cam
 */

/**
 * Compute pocket tool paths. The pockets are cleared using annular passes,
 * starting from the outside and working towards the centre. Only works
 * on closed paths.
 * @param {CutPaths} geometry the geometry to compute for
 * @param {number} cutterDia in "integer" units
 * @param {number} overlap is in the range [0, 1)
 * @param {boolean} climb true for climb milling
 * @return {CutPaths}
 * @memberof Cam
 */
export function annularPocket(geometry, cutterDia, overlap, climb) {
  assert(geometry instanceof CutPaths);
  geometry = geometry.filter(p => p.isClosed);
  if (geometry.length === 0)
    return geometry;

  console.debug(`Cam.annularPocket ${geometry.length} paths`);

  // Shrink by half the cutter diameter
  let current = geometry.offset(-cutterDia / 2);

  // take a copy of the shrunk pocket to check against. Each time
  // the poly merges, there's a risk that an edge between the
  // outer poly and the inner poly might cross an edge of the
  // (non-convex) original poly, this is used to detect this.
  const outer = new CutPaths(current);

  const toolPaths = new CutPaths();
  // Iterate, shrinking the pocket for each pass
  let n = 1;
  const innerPaths = [];
  while (current.length != 0) {
    for (const p of current)
      toolPaths.push(p);
    if (climb)
      for (let i = 0; i < current.length; ++i)
        current[i].reverse();
    current = current.offset(-cutterDia * (1 - overlap));
  }
  toolPaths.mergePaths(outer);
  console.debug(`Cam.annularPocket generated ${toolPaths.length} tool paths`);
  return toolPaths;
}

/**
 * Compute tool pocket using rasters.
 * @param {CutPath} pocket the pocket being resterised
 * @param {number} step the gap between rasters
 * @param {boolean} climb true for climb milling
 * @return {CutPath} rasters
 * @private
 */
function rasteriseConvexPocket(pocket, step, climb) {
  // Get the min Y
  const bb = pocket.box;
  const rasters = bb.height / step;
  let y = bb.ymax - step; // conventional milling
  let stepway = -1;

  if (climb) {
    y = bb.ymin + step;
    stepway = 1;
  }

  let direction = 1;
  let path = new CutPath();
  let rc = 0;
  while (rc++ < rasters) {
    const ray = new Flatten.Segment(bb.xmin - step, y, bb.xmax + step, y);
    const intersections = ray.intersect(pocket);
    if (direction === 1)
      intersections.sort((a, b) => a.x - b.x);
    else
      intersections.sort((a, b) => b.x - a.x);
    let up = true;
    for (const intersection of intersections)
      path.push(new CutPoint(intersection.x, intersection.y));
    y += step * stepway;
    // boustrophedonically
    direction = -direction;
  }
  return path;
}

/**
 * Compute tool pockets using rasters. The geometry is decomposed into
 * convex areas and each is rasterised with horizontal tool sweeps. Only
 * works on closed paths.
 * @param {CutPaths} geometry
 * @param {number} cutterDia is in "integer" units
 * @param {number} overlap is in the range [0, 1)
 * @param {boolean} climb true for climb milling
 * @return {CutPaths} rasters
 * @memberof Cam
 */
export function rasterPocket(geometry, cutterDia, overlap, climb) {
  assert(geometry instanceof CutPaths);
  geometry = geometry.filter(p => p.isClosed);
  const toolPaths = new CutPaths();
  if (geometry.length === 0)
    return toolPaths;

  console.debug(`Cam.rasterPocket ${geometry.length} paths`);
  const step = cutterDia * (1 - overlap);
  // Shrink first path by half the cutter diameter
  let iPockets = geometry.offset(-cutterDia / 2);

  for (let poly of iPockets) {
    if (!poly.isClosed)
      continue; // ignore this poly for rasterisation
    // Rasterise interior
    const pocket = new Flatten.Polygon(
      poly.map(pt => new Flatten.Point(pt.X, pt.Y)));
    const convexPockets = Partition.convex(pocket);
    let firstPoint;
    for (const convexPocket of convexPockets) {
      const rasters = rasteriseConvexPocket(convexPocket, step, climb);
      if (rasters.length > 0) {
        if (!firstPoint)
          firstPoint = rasters[0];
        toolPaths.push(rasters);
      }
    }
    // Find the point on the outline closest to the first point of
    // the rasters, and reshape the outline
    if (firstPoint) {
      let cp = poly.closestVertex(firstPoint);
      if (cp)
        poly.makeLast(cp.point);
    }
    toolPaths.unshift(poly);
  }

  console.debug(`Cam.rasterPocket generated ${toolPaths.length} tool paths`);
  return toolPaths;
}

/**
 * Compute outline tool path.
 * @param {CutPaths} geometry
 * @param {number} cutterDia is in "integer" units
 * @param {boolean} isInside true to cut inside the path, false to cut outside
 * @param {number} width desired path width (may be wider than the cutter)
 * @param {number} overlap is in the range [0, 1)
 * @param {boolean} climb true for climb milling
 * @return {CutPaths}
 * @memberof Cam
 */
export function outline(geometry, cutterDia, isInside, width, overlap, climb) {
  assert(geometry instanceof CutPaths);
  geometry = geometry.filter(p => p.isClosed);
  let toolPaths = new CutPaths();
  if (geometry.length === 0)
    return toolPaths;

  console.debug(`Cam.${isInside ? "in" : "out"}line ${geometry.length} paths`);
  let currentWidth = cutterDia;
  const eachWidth = cutterDia * (1 - overlap);

  let current;
  let clipPoly;
  let eachOffset;
  let needReverse;

  if (isInside) {
    current = geometry.offset(-cutterDia / 2);
    clipPoly = current.diff(geometry.offset(-(width - cutterDia / 2)));
    eachOffset = -eachWidth;
    needReverse = climb;
  } else { // is outside
    current = geometry.offset(cutterDia / 2);
    clipPoly = geometry.offset(width - cutterDia / 2).diff(current);
    eachOffset = eachWidth;
    needReverse = !climb;
  }

  while (currentWidth <= width) {
    toolPaths.push(...current);
    let i;
    if (needReverse)
      for (i = 0; i < current.length; ++i)
        current[i].reverse();
    const nextWidth = currentWidth + eachWidth;
    if (nextWidth > width && width - currentWidth > 0) {
      current = current.offset(width - currentWidth);
      if (needReverse)
        for (i = 0; i < current.length; ++i)
          current[i].reverse();
      break;
    }
    currentWidth = nextWidth;
    current = current.offset(eachOffset);
  }
  toolPaths.mergePaths(clipPoly);
  console.debug(`Cam.${isInside ? "in" : "out"} generated ${toolPaths.length} tool paths`);
  return toolPaths;
};

/**
 * Generate path step to create a hole
 * @param {CutPoint} pt where to drill the hole
 * @param {number} safeZ is above the top of the hole
 * @param {number} botZ is the bottom of the hole
 * @return {CutPath}
 * @private
 */
function drillHole(pt, safeZ, botZ) {
  return new CutPath([
    { X: pt.X, Y: pt.Y, Z: safeZ },
    { X: pt.X, Y: pt.Y, Z: botZ },
    { X: pt.X, Y: pt.Y, Z: safeZ }
  ], false);
}

/**
 * Calculate perforations along a path.
 * @param {CutPath} path
 * @param {number} cutterDia in "integer" units
 * @param {number} spacing is the gap to leave between perforations
 * @param {number} safeZ is the Z to which the tool is withdrawn
 * @param {number} botZ is the depth of the perforations
 * @return {CutPath}
 * @private
 * @memberof Cam
 */
function perforatePath(path, cutterDia, spacing, safeZ, botZ) {
  assert(path instanceof CutPath);

  // Measure the path
  let totalPathLength = path.perimeter();

  if (path.isClosed)
    path.push(path[0]); // duplicate first vertex

  // Work out number of holes, and step between them, allowing spacing
  // between adjacent holes
  const numHoles = Math.floor(totalPathLength / (cutterDia + spacing));
  const step = totalPathLength / (numHoles - 1);

  // Walk round the path stopping at every hole, generating a new path
  let newPath = new CutPath();
  let gap = 0; // distance along the path from the last hole;
  let segi = 1; // index of end of current segment
  // Start of the current segment
  let segStart = path[0], segEnd = path[1];
  // dimensions of the current segment
  let dx = segEnd.X - segStart.X, dy = segEnd.Y - segStart.Y;
  // Length of the current segment
  let segLen = Math.sqrt(dx * dx + dy * dy);
  // Unit vector for the current segment
  let segVec = new CutPoint(dx / segLen, dy / segLen);
  while (segi < path.length) {
    // Place a hole here
    //console.debug(`Hole at ${segStart.X},${segStart.Y}`);
    newPath.push(...drillHole(segStart, safeZ, botZ));
    gap = 0;
    while (gap + segLen < step) {
      if (++segi === path.length)
        break; // no more segments, we're done
      // Remaining segment isn't long enough for another hole.
      // Walk the path until we get to the segment that it's in.
      segStart = segEnd;
      segEnd = path[segi];
      dx = segEnd.X - segStart.X, dy = segEnd.Y - segStart.Y;
      segLen = Math.sqrt(dx * dx + dy * dy);
      segVec = { X: dx / segLen, Y : dy / segLen };
      if (gap + segLen > step)
        // hole is on this segment.
        break;
      gap += segLen;
    }
    // Next hole is on this segment. Move segStart up to the hole.
    const where = step - gap;
    segStart = new CutPoint(segStart.X + segVec.X * where,
                                       segStart.Y + segVec.Y * where);
    segLen -= where;
    gap += where;
  }
  if (path.isClosed)
    path.pop(); // remove pseudo-vertex

  return newPath;
}

/**
 * Compute perforation tool path. This is an outline path, but it
 * has a vertex at every tool diameter step along the path. Gcode generation
 * will convert those vertices to drill holes. Works on both open and closed
 * paths; closed paths the tool will follow outside the path, open paths the
 * tool will follow the path.
 * @param {CutPaths} geometry
 * @param {number} cutterDia in "integer" units
 * @param {number} spacing is the gap to leave between perforations
 * @param {number} topZ is the Z to which the tool is withdrawn
 * @param {number} botZ is the depth of the perforations
 * @return {CutPaths}
 * @memberof Cam
 */
export function perforate(geometry, cutterDia, spacing, topZ, botZ) {
  assert(geometry instanceof CutPaths);
  console.debug(`Cam.perforate ${geometry.length} paths`);
  const toolPaths = new CutPaths();

  // Bloat the closed paths by half the cutter diameter
  const bloated = new CutPaths();
  for (const path of geometry) {
    if (path.isClosed) {
      const bloated = new CutPaths(path)
            .offset(cutterDia / 2, CutPaths.JoinType.jtRound)[0];
      const ring = perforatePath(bloated, cutterDia, spacing, topZ, botZ);
      toolPaths.push(ring);
    } else { // just follow open paths
      toolPaths.push(perforatePath(path, cutterDia, spacing, topZ, botZ));
    }
  }

  console.debug(`Cam.perforate generated ${toolPaths.length} tool paths`);
  return toolPaths;
}

/**
 * Compute a drill path. This is a path where each vertex is a site
 * for a drill hole. The holes are drilled in the order of the edges.
 * Works on both open and closed paths.
 * @param {CutPaths} geometry
 * @param {number} safeZ is the Z to which the tool is withdrawn
 * @param {number} botZ is the depth of the perforations
 * @return {CutPaths}
 * @memberof Cam
 */
export function drill(geometry, safeZ, botZ) {
  const drillPath = new CutPath();
  for (const path of geometry) {
    for (const hole of path) {
      drillPath.push(...drillHole(hole, safeZ, botZ));
    }
  }
  return new CutPaths(drillPath);
}

/**
 * Compute paths for engraving. This simply generates a tool path
 * that follows the outline of the geometry, regardless of the tool
 * diameter. Works on both open and closed paths.
 * @param {CutPaths} geometry the engraving
 * @param {boolean} climb true for climb milling; not that it should make
 * any difference!
 * @return {CutPaths}
 * @memberof Cam
 */
export function engrave(geometry, climb) {
  assert(geometry instanceof CutPaths);
  console.debug(`Cam.engrave ${geometry.length} paths`);
  const toolPaths = new CutPaths();
  for (const path of geometry) {
    const copy = new CutPath(path); // take a copy
    if (!climb)
      copy.reverse();
    toolPaths.push(copy);
  }
  toolPaths.mergePaths(geometry);
  console.debug(`Cam.engrave generated ${toolPaths.length} tool paths`);
  return toolPaths;
};

/**
 * Given a single tool path and an array of paths representing a set of
 * disjoint polygons, split the toolpath into a sequence of paths such
 * that where a path enters or leaves one of the polygons it gets
 * split into two paths. In this way it generates a new array of paths
 * where the odd-numbered paths are outside the polygons, while the
 * even numbered paths are inside the polygons.
 * @param {CutPath} toolPath path being followed by the cutter
 * @param {CutPaths} tabGeometry polygons representing tabs, must all
 * be closed paths.
 * @author Crawford Currie
 * @memberof Cam
 */
export function separateTabs(toolPath, tabGeometry) {
  assert(toolPath instanceof CutPath);
  assert(tabGeometry instanceof CutPaths);
  console.debug(`Cam.separateTabs over ${tabGeometry.length} tab paths`);
  const tabPolys = new CutPaths();
  for (const poly of tabGeometry) {
    const poly2d = new Flatten.Polygon(
      poly.map(pt => new Flatten.Point(pt.X, pt.Y)));
    tabPolys.push(poly2d);
  }
  let ip0 = toolPath[toolPath.length - 1];
  let p0 = new Flatten.Point(ip0.X, ip0.Y);

  // If the first point of the last path is outside a tab poly,
  // then we need to add a zero-length path so that all even-numbered
  // paths are tab paths
  for (const tab of tabPolys) {
    if (tab.contains(p0)) {
      // add a zero-length path
      paths.unshift([ ip0, ip0 ]);
      break;
    }
  }

  const paths = new CutPaths();
  let currPath = [ ip0 ];
  //console.debug("Path starts at ", ip0);
  for (const ip1 of toolPath) {
    if (ip1.X !== ip0.X || ip1.Y !== ip0.Y) {
      //console.debug("\tnew point at ", ip1);
      const p1 = new Flatten.Point(ip1.X, ip1.Y);
      const seg = new Flatten.Segment(p0, p1);
      for (const tabPoly of tabPolys) {
        const intersections = seg.intersect(tabPoly);
        if (intersections.length > 0) {
          // Sort the intersections by ascending distance from the start point
          // of the segment
          intersections.sort((a, b) => a.distanceTo(p0)[0] - b.distanceTo(p0)[0]);
          //console.debug("\tintersections at ", intersections);
          // Each intersection is the start of a new path
          for (const intersection of intersections) {
            const ins = new CutPoint(intersection.x, intersection.y);
            //console.debug("\tintersection at ", ins, intersection.distanceTo(p0)[0]);
            currPath.push(ins);
            paths.push(currPath);
            currPath = [ ins ];
          }
          currPath.push(ip1);
        } else {
          // add the segment to the current path intact
          currPath.push(ip1);
        }
      }
      p0 = p1;
      ip0 = ip1;
    }
  }
  if (currPath.length > 1)
    paths.push(currPath);

  console.debug(`Cam.separatePaths generated ${paths.length} tool paths`);
  return paths;
}

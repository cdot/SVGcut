/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global ClipperLib */

/* global App */
/* global assert */

import { Point as FPoint, Segment as FSegment, Polygon as FPolygon } from 'flatten-js';
import { CutPath } from "./CutPath.js";
import { CutPaths } from "./CutPaths.js";
import { convexPartition } from "./Partition.js";

/**
 * Support for different CAM operations
 * @namespace Cam
 */

/**
 * Compute pocket tool path. The pocket is cleared using concentric passes,
 * starting from the outside and working towards the centre.
 * @param {CutPaths} geometry the geometry to compute for
 * @param {number} cutterDia in "integer" units
 * @param {number} overlap is in the range [0, 1)
 * @param {boolean} climb true to reverse cutter direction
 * @return {CutPaths}
 * @memberof Cam
 */
export function concentricPocket(geometry, cutterDia, overlap, climb) {
  assert(geometry instanceof CutPaths);
  geometry = geometry.closedOnly();
  if (geometry.length === 0)
    return geometry;

  console.debug("Cam.concentricPocket");
  // Shrink by half the cutter diameter
  let current = geometry.offset(-cutterDia / 2);
  // take a copy of the shrunk pocket to clip against
  const clipPoly = current.slice(0);
  // Iterate, shrinking the pocket for each pass
  let allPaths = new CutPaths();
  while (current.length != 0) {
    if (climb)
      for (let i = 0; i < current.length; ++i)
        current[i].reverse();
    allPaths.mergePaths(current, clipPoly);
    current = current.offset(-cutterDia * (1 - overlap));
  }
  return allPaths;
}

/**
 * Compute tool pocket using rasters.
 * @param {CutPath} pocket the pocket being resterised
 * @param {number} step the gap between rasters
 * @return {CutPath} rasters
 * @private
 */
function rasteriseConvexPocket(pocket, step) {
  assert(pocket instanceof CutPath);
  // Get the min Y
  const bb = pocket.box;
  let y = bb.ymin + step;
  let direction = 1;
  let path = new CutPath();
  while (y < bb.ymax) {
    const ray = new FSegment(bb.xmin - step, y, bb.xmax + step, y);
    const intersections = ray.intersect(pocket);
    if (direction === 1)
      intersections.sort((a, b) => a.x - b.x);
    else
      intersections.sort((a, b) => b.x - a.x);
    let up = true;
    for (const intersection of intersections)
      path.push(new ClipperLib.IntPoint(intersection.x, intersection.y));
    y += step;
    // boustrophedonically
    direction = -direction;
  }
  return path;
}

/**
 * Compute tool pockets using rasters. The geometry is decomposed into
 * convex areas and each is rasterised with horizontal tool sweeps.
 * @param {CutPaths} geometry
 * @param {number} cutterDia is in "integer" units
 * @param {number} overlap is in the range [0, 1)
 * @param {boolean} climb true to reverse cutter direction
 * @return {CutPaths} rasters
 */
export function rasterPocket(geometry, cutterDia, overlap, climb) {
  assert(geometry instanceof CutPaths);
  geometry = geometry.closedOnly();
  if (geometry.length === 0)
    return geometry;

  console.debug("Cam.rasterPocket");
  const step = cutterDia * (1 - overlap);
  // Shrink first path by half the cutter diameter
  let iPockets = geometry.offset(-cutterDia / 2);

  const pockets = new CutPaths();
  for (let poly of iPockets) {
    if (!poly.isClosed)
      continue; // ignore this poly for rasterisation
    // Rasterise interior
    const pocket = new FPolygon(poly.map(pt => new FPoint(pt.X, pt.Y)));
    const convexPockets = convexPartition(pocket);
    let firstPoint;
    for (const convexPocket of convexPockets) {
      const rasters = rasteriseConvexPocket(convexPocket, step);
      if (!firstPoint)
        firstPoint = rasters[0];
      if (rasters.length > 0)
        pockets.push(rasters);
    }
    // Find the point on the outline closest to the first point of
    // the rasters, and reshape the bounding poly
    let cp = poly.closestVertex(firstPoint);
    if (cp)
      poly.makeLast(cp.point);
    pockets.unshift(poly);
  }

  return pockets;
}

/**
 * Compute outline tool path.
 * @param {CutPaths} geometry
 * @param {number} cutterDia is in "integer" units
 * @param {boolean} isInside true to cut inside the path, false to cut outside
 * @param {number} width desired path width (may be wider than the cutter)
 * @param {number} overlap is in the range [0, 1)
 * @param {boolean} climb true to reverse cutter direction
 * @return {CutPaths}
 * @memberof Cam
 */
export function outline(geometry, cutterDia, isInside, width, overlap, climb) {
  assert(geometry instanceof CutPaths);
  geometry = geometry.closedOnly();
  if (geometry.length === 0)
    return geometry;

  console.debug(`Cam.${isInside ? "in" : "out"}line`);
  let currentWidth = cutterDia;
  let allPaths = new CutPaths();
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
    let i;
    if (needReverse)
      for (i = 0; i < current.length; ++i)
        current[i].reverse();
    allPaths.mergePaths(current, clipPoly);
    const nextWidth = currentWidth + eachWidth;
    if (nextWidth > width && width - currentWidth > 0) {
      current = current.offset(width - currentWidth);
      if (needReverse)
        for (i = 0; i < current.length; ++i)
          current[i].reverse();
      allPaths.mergePaths(current, clipPoly);
      break;
    }
    currentWidth = nextWidth;
    current = current.offset(eachOffset);
  }
  return allPaths;
};

/**
 * Generate path step to create a hole
 * @param {ClipperLib.IntPoint} pt where to drill the hole
 * @param {number} topZ
 * @param {number} topZ is the top of the hole
 * @param {number} botZ is the bottom of the hole
 * @return {CutPath}
 * @private
 */
function drillHole(pt, topZ, botZ) {
  return new CutPath([
    { X: pt.X, Y: pt.Y, Z: topZ },
    { X: pt.X, Y: pt.Y, Z: botZ },
    { X: pt.X, Y: pt.Y, Z: topZ }
  ], false);
}

/**
 * Calculate perforations along a path.
 * @param {CutPath} path
 * @param {number} cutterDia in "integer" units
 * @param {number} spacing is the gap to leave between perforations
 * @param {number} topZ is the Z to which the tool is withdrawn
 * @param {number} botZ is the depth of the perforations
 * @return {CutPath}
 * @private
 * @memberof Cam
 */
function perforatePath(path, cutterDia, spacing, topZ, botZ) {
  assert(path instanceof CutPath);

  // Measure the path
  let totalPathLength = path.perimeter();

  // Work out number of holes, and step between them, allowing spacing
  // between adjacent holes
  const numHoles = Math.floor(totalPathLength / (cutterDia + spacing));
  const step = totalPathLength / numHoles;

  // Walk round the path stopping at every hole, generating a new path
  let newPath = new CutPath();
  let gap = 0; // distance along the path from the last hole;
  let segi = 0; // index of end of current segment
  // Start of the current segment
  let segStart = path[path.length - 1], segEnd = path[0];
  // dimensions of the current segment
  let dx = segEnd.X - segStart.X, dy = segEnd.Y - segStart.Y;
  // Length of the current segment
  let segLen = Math.sqrt(dx * dx + dy * dy);
  // Unit vector for the current segment
  let segVec = new ClipperLib.IntPoint(dx / segLen, dy / segLen);
  while (segi < path.length) {
    // Place a hole here
    //console.debug(`Hole at ${segStart.X},${segStart.Y}`);
    newPath.push(...drillHole(segStart, topZ, botZ));
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
    segStart = new ClipperLib.IntPoint(segStart.X + segVec.X * where,
                                       segStart.Y + segVec.Y * where);
    segLen -= where;
    gap += where;
  }
  return newPath;
}

/**
 * Compute perforation tool path. This is an outline path, but it
 * has a vertex at every tool diameter step along the path. Gcode generation
 * will convert those vertices to drill holes.
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
  console.debug("Cam.perforate");
  const allPaths = new CutPaths();

  // Bloat the closed paths by half the cutter diameter
  const bloated = new CutPaths();
  for (const path of geometry) {
    if (path.isClosed)
      bloated.push(path.offset(cutterDia / 2));
    else // just follow open paths
      bloated.push(path);
  }

  for (const path of bloated)
    allPaths.mergePath(perforatePath(path, cutterDia, spacing, topZ, botZ));

  return allPaths;
}

/**
 * Compute a drill path. This is a path where each vertex is a site
 * for a drill hole. The holes are drilled in the order of the edges.
 * @param {CutPaths} geometry
 * @param {number} topZ is the Z to which the tool is withdrawn
 * @param {number} botZ is the depth of the perforations
 * @return {CutPaths}
 * @private
 */
function drill(geometry, topZ, botZ) {
  const drillPath = new CutPath();
  for (const path of geometry) {
    for (const hole of path) {
      drillPath.push(...drillHole(hole, topZ, botZ));
    }
  }
  const paths = new CutPaths();
  paths.mergePath(new CutPath(drillPath, false));
  return paths;
}

/**
 * Compute paths for engraving. This simply generates a tool path
 * that follows the outline of the geometry, regardless of the tool
 * diameter.
 * @param {CutPaths} geometry the engraving
 * @param {boolean} climb reverse cutter direction
 * @return {CutPaths}
 * @memberof Cam
 */
export function engrave(geometry, climb) {
  assert(geometry instanceof CutPaths);
  console.debug("Cam.engrave");
  const allPaths = new CutPaths();
  for (const path of geometry) {
    const copy = new CutPaths(path); // take a copy
    if (!climb)
      copy.reverse();
    allPaths.mergePaths(copy, path.isClosed);
  }
  return allPaths;
};

/**
 * Given a tool path and an array of paths representing a set of
 * disjoint polygons, split the toolpath into a sequence of paths such
 * that where a path enters or leaves one of the polygons it gets
 * split into two paths. In this way it generates a new array of paths
 * where the odd-numbered paths are outside the polygons, while the
 * even numbered paths are inside the polygons.
 * @param {CutPath} toolPath path being followed by the cutter
 * @param {CutPaths} tabGeometry polygons representing tabs
 * @author Crawford Currie
 */
export function separateTabs(toolPath, tabGeometry) {
  assert(toolPath instanceof CutPath);
  assert(tabGeometry instanceof CutPaths);
  console.debug("Cam.separateTabs");
  const tabPolys = new CutPaths();
  for (const poly of tabGeometry) {
    const poly2d = new FPolygon(poly.map(pt => new FPoint(pt.X, pt.Y)));
    tabPolys.push(poly2d);
  }
  let ip0 = toolPath[toolPath.length - 1];
  let p0 = new FPoint(ip0.X, ip0.Y);

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
      const p1 = new FPoint(ip1.X, ip1.Y);
      const seg = new FSegment(p0, p1);
      for (const tabPoly of tabPolys) {
        const intersections = seg.intersect(tabPoly);
        if (intersections.length > 0) {
          // Sort the intersections by ascending distance from the start point
          // of the segment
          intersections.sort((a, b) => a.distanceTo(p0)[0] - b.distanceTo(p0)[0]);
          //console.debug("\tintersections at ", intersections);
          // Each intersection is the start of a new path
          for (const intersection of intersections) {
            const ins = new ClipperLib.IntPoint(intersection.x, intersection.y);
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
  //console.debug("Separated paths", paths);
  return paths;
}

/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

// import "ClipperLib"
/* global ClipperLib */

/* global App */

import { Point as FPoint, Segment as FSegment, Polygon as FPolygon } from 'flatten-js';
import * as Clipper from "./Clipper.js";
import { convexPartition } from "./Partition.js";

/**
 * Support for different CAM operations
 * @namespace Cam
 */

/**
 * A path in integer units that either represents an open path
 * (safeToClose=false) or a polygon (safeToClose=true)
 */
export class CamPath {
  // SMELL: extends ClipperLib.Path would be more sensible

  /**
   * @param {ClipperLib.Path} path path
   * @param {ClipperLib.Path?} clipPoly used for closable test. If not given,
   * path is assumed to be closable. Default is true.
   */
  constructor(path, clipPoly) {
    /**
     * The actual path, in "integer" units
     * @member {ClipperLib.Path} path path
     */
    this.path = path;

    /**
     * Is it safe to close the path without
     * retracting?
     * @member {boolean} safeToClose
     */
    this.safeToClose = clipPoly ? !Clipper.crosses(
      clipPoly, path[0], path[path.length - 1]) : true;
  }
}

/**
 * A set of polygons and/or open paths
 */
export class CamPaths extends Array {

  /**
   * Convert a set of internal paths to CamPath.
   * @param {ClipperLib.Paths} intPaths paths to convert
   * @param {ClipperLib.Path?} clipPoly used for closable test. if not given,
   * path is assumed to be closable.
   * @return {CamPaths} converted paths
   * @private
   */
  constructor(intPaths, clipPoly) {
    super();
    if (intPaths)
      for (const p of intPaths)
        this.push(new CamPath(p, clipPoly));
  }

  /**
   * Convert array of CamPath to integer paths
   * @return {ClipperLib.Paths} converted paths
   */
  integerPaths() {
    const intPaths = new ClipperLib.Paths();
    for (const p of this)
      intPaths.push(p.path);
    return intPaths;
  }
}

/**
 * Compute pocket tool path. The pocket is cleared using concentric passes,
 * starting from the outside and working towards the centre.
 * @param {number} cutterDia in "integer" units
 * @param {number} overlap is in the range [0, 1)
 * @param {boolean} climb true to reverse cutter direction
 * @return {CamPaths}
 * @memberof Cam
 */
export function concentricPocket(geometry, cutterDia, overlap, climb) {
  // Shrink by half the cutter diameter
  let current = Clipper.offset(geometry, -cutterDia / 2);
  // take a copy of the shrunk pocket to clip against
  const clipPoly = current.slice(0);
  // Iterate, shrinking the pocket for each pass
  let allPaths = new ClipperLib.Paths();
  while (current.length != 0) {
    if (climb)
      for (let i = 0; i < current.length; ++i)
        current[i].reverse();
    allPaths = current.concat(allPaths);
    current = Clipper.offset(current, -cutterDia * (1 - overlap));
  }
  return new CamPaths(
    Clipper.joinPaths(allPaths, clipPoly), clipPoly);
}

/**
 * Compute tool pocket using rasters.
 * @param {ClipperLib.Path} pocket the pocket being resterised
 * @param {number} step the gap between rasters
 * @return {ClipperLib.Path} rasters
 * @private
 */
function rasteriseConvexPocket(pocket, step) {
  // Get the min Y
  const bb = pocket.box;
  let y = bb.ymin + step;
  let direction = 1;
  let path = new ClipperLib.Path();
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
 * @param {ClipperLib.Paths} geometry
 * @param {number} cutterDia is in "integer" units
 * @param {number} overlap is in the range [0, 1)
 * @param {boolean} climb true to reverse cutter direction
 * @return {ClipperLib.Path} rasters
 */
export function rasterPocket(geometry, cutterDia, overlap, climb) {
  const step = cutterDia * (1 - overlap);
  // Shrink first path by half the cutter diameter
  let iPockets = Clipper.offset(geometry, -cutterDia / 2);

  const pockets = new ClipperLib.Paths();
  for (const poly of iPockets) {
    // outline first
    pockets.push(poly);
    // now rasterise interior
    const pocket = new FPolygon(poly.map(pt => new FPoint(pt.X, pt.Y)));
    const convexPockets = convexPartition(pocket);
    for (const convexPocket of convexPockets) {
      const rasters = rasteriseConvexPocket(convexPocket, step);
      if (rasters.length > 0)
        pockets.push(rasters);
    }
  }

  return new CamPaths(pockets);
}

/**
 * Compute outline tool path.
 * @param {ClipperLib.Paths} geometry
 * @param {number} cutterDia is in "integer" units
 * @param {boolean} isInside true to cut inside the path, false to cut outside
 * @param {number} width desired path width (may be wider than the cutter)
 * @param {number} overlap is in the range [0, 1)
 * @param {boolean} climb true to reverse cutter direction
 * @return {CamPaths}
 * @memberof Cam
 */
export function outline(geometry, cutterDia, isInside, width, overlap, climb) {
  let currentWidth = cutterDia;
  let allPaths = new ClipperLib.Paths();
  const eachWidth = cutterDia * (1 - overlap);

  let current;
  let clipPoly;
  let eachOffset;
  let needReverse;

  if (isInside) {
    current = Clipper.offset(geometry, -cutterDia / 2);
    clipPoly = Clipper.diff(
      current, Clipper.offset(geometry, -(width - cutterDia / 2)));
    eachOffset = -eachWidth;
    needReverse = climb;
  } else { // is outside
    current = Clipper.offset(geometry, cutterDia / 2);
    clipPoly = Clipper.diff(
      Clipper.offset(geometry, width - cutterDia / 2), current);
    eachOffset = eachWidth;
    needReverse = !climb;
  }

  while (currentWidth <= width) {
    let i;
    if (needReverse)
      for (i = 0; i < current.length; ++i)
        current[i].reverse();
    allPaths = current.concat(allPaths);
    const nextWidth = currentWidth + eachWidth;
    if (nextWidth > width && width - currentWidth > 0) {
      current = Clipper.offset(current, width - currentWidth);
      if (needReverse)
        for (i = 0; i < current.length; ++i)
          current[i].reverse();
      allPaths = current.concat(allPaths);
      break;
    }
    currentWidth = nextWidth;
    current = Clipper.offset(current, eachOffset);
  }
  return new CamPaths(
    Clipper.joinPaths(allPaths, clipPoly), clipPoly);
};

/**
 * Calculate perforations along a path.
 * @param {ClipperLib.Path} path
 * @param {number} cutterDia in "integer" units
 * @param {number} spacing is the gap to leave between perforations
 * @param {number} topZ is the Z to which the tool is withdrawn
 * @param {number} botZ is the depth of the perforations
 * @return {CamPath}
 * @private
 * @memberof Cam
 */
function perforatePath(path, cutterDia, spacing, topZ, botZ) {
  // Measure the path
  let totalPathLength = ClipperLib.JS.PerimeterOfPath(path, true, 1);

  // Work out number of holes, and step between them, allowing spacing
  // between adjacent holes
  const numHoles = Math.floor(totalPathLength / (cutterDia + spacing));
  const step = totalPathLength / numHoles;

  // Walk round the path stopping at every hole, generating a new path
  let newPath = new ClipperLib.Path();
  let gap = 0; // distance along the path from the last hole;
  let segi = 0; // index of end of current segment
  // Start of the current segment
  let segStart = path[path.length - 1], segEnd = path[0];
  // dimensions of the current segment
  let dx = segEnd.X - segStart.X, dy = segEnd.Y - segStart.Y;
  // Length of the current segment
  let segLen = Math.sqrt(dx * dx + dy * dy);
  // Unit vector for the current segment
  let segVec = { X: dx / segLen, Y : dy / segLen };
  while (segi < path.length) {
    // Place a hole here
    //console.debug(`Hole at ${segStart.X},${segStart.Y}`);
    newPath.push({ X: segStart.X, Y: segStart.Y, Z: topZ });
    newPath.push({ X: segStart.X, Y: segStart.Y, Z: botZ });
    newPath.push({ X: segStart.X, Y: segStart.Y, Z: topZ });
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
    segStart = {
      X: segStart.X + segVec.X * where,
      Y: segStart.Y + segVec.Y * where };
    segLen -= where;
    gap += where;
  }
  return { path: newPath, safeToClose: false };
}

/**
 * Compute perforation tool path. This is an outline path, but it
 * has a vertex at every tool diameter step along the path. Gcode generation
 * will convert those vertices to drill holes.
 * @param {ClipperLib.Paths} geometry
 * @param {number} cutterDia in "integer" units
 * @param {number} spacing is the gap to leave between perforations
 * @param {number} topZ is the Z to which the tool is withdrawn
 * @param {number} botZ is the depth of the perforations
 * @return {CamPaths}
 * @memberof Cam
 */
export function perforate(geometry, cutterDia, spacing, topZ, botZ) {
  const allPaths = new ClipperLib.Paths();

  // Bloat the paths by half the cutter diameter
  const bloated = Clipper.offset(geometry, cutterDia / 2);

  for (const path of bloated) {
    allPaths.push(perforatePath(path, cutterDia, spacing, topZ, botZ));
  }
  return allPaths;
}

/**
 * Compute paths for engraving. This simply generates a tool path
 * that follows the outline of the geometry, regardless of the tool
 * diameter.
 * @param {ClipperLib.Paths} geometry the engraving
 * @param {boolean} climb reverse cutter direction
 * @return {CamPaths}
 * @memberof Cam
 */
export function engrave(geometry, climb) {
  const allPaths = new ClipperLib.Paths();
  for (const path of geometry) {
    const copy = path.slice(0); // take a copy
    if (!climb)
      copy.reverse();
    copy.push(copy[0]); // close the path
    allPaths.push(copy);
  }
  const result = new CamPaths(Clipper.joinPaths(allPaths));
  return result;
};

/**
 * Geometry paths define the centre of a groove being cut by an angled
 * bit. The depth of the groove is limited by the `depth` parameter.
 * The tool will cut no deeper than that, but will always cut a groove
 * `width` wide.
 * @param {ClipperLib.Paths} geometry the engraving
 * @param {number} cutterAngle angle of the cutter head
 * @param {number} width desired path width
 * @param {number} depth desired depth not to be exceeded
 * @param {number} passDepth maximum cut depth for each pass. Should not exceed
 * the height of the cutting surface
 * @param {boolean} climb reverse cutter direction
 */
export function vCarve(geometry, cutterAngle, width, depth, passDepth, climb) {
  // Formerly known as "vPocket"
  throw new Error("V Carve not currently supported");
}

/**
 * Given a tool path and an array of paths representing a set of
 * disjoint polygons, split the toolpath into a sequence of paths such
 * that where a path enters or leaves one of the polygons it gets
 * split into two paths. In this way it generates a new array of paths
 * where the odd-numbered paths are outside the polygons, while the
 * even numbered paths are inside the polygons.
 * @param {ClipperLib.Path} toolPath path being followed by the cutter
 * @param {ClipperLib.Paths} tabGeometry polygons representing tabs
 * @author Crawford Currie
 */
export function separateTabs(toolPath, tabGeometry) {
  const tabPolys = new ClipperLib.Paths();
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

  const paths = new ClipperLib.Paths();
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

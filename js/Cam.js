/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

//CPP /* global Module */ // from Emscripten

/* global App */

import { Point, Segment, Polygon } from 'flatten-js';
import * as InternalPaths from "./InternalPaths.js";
import { convexPartition } from "./Partition.js";

/**
 * Support for different CAM operations
 * @namespace Cam
 */

/**
 * @typedef {object} CamPath
 * @property {InternalPath} path path in internal units
 * @property {boolean} safeToClose Is it safe to close the path without
 * retracting?
 */

/**
 * Convert a set of internal paths to CamPath.
 * @param {InternalPath[]} paths paths to convert
 * @param {InternalPath?} clipPoly used for closable test. if not given,
 * path is assumed to be closable.
 * @return {CamPath[]} merged paths
 * @private
 */
function internalToCamPaths(paths, clipPoly) {
  return paths.map(path => {
    // convert to CamPath
    return {
      path: path,
      // It's safe to close if the closing segment doesn't cross the clip poly
      safeToClose: clipPoly ? !InternalPaths.crosses(
        clipPoly, path[0], path[path.length - 1])
      : true
    };
  });
}

/**
 * Compute pocket tool path. The pocket is cleared using concentric passes,
 * starting from the outside and working towards the centre.
 * @param {number} cutterDia is in internal units
 * @param {number} overlap is in the range [0, 1)
 * @return {CamPath[]}
 * @memberof Cam
 */
export function concentricPocket(geometry, cutterDia, overlap, climb) {
  // Shrink by half the cutter diameter
  let current = InternalPaths.offset(geometry, -cutterDia / 2);
  // take a copy of the shrunk pocket to clip against
  const clipPoly = current.slice(0);
  // Iterate, shrinking the pocket for each pass
  let allPaths = [];
  while (current.length != 0) {
    if (climb)
      for (let i = 0; i < current.length; ++i)
        current[i].reverse();
    allPaths = current.concat(allPaths);
    current = InternalPaths.offset(current, -cutterDia * (1 - overlap));
  }
  return internalToCamPaths(
    InternalPaths.mergePaths(allPaths, clipPoly), clipPoly);
}

/**
 * Compute tool pockets using rasters. The geometry is decomposed into
 * convex areas and each is rasterised with horizontal tool sweeps.
 * @return {InternalPath} rasters
 */
function rasteriseConvexPocket(pocket, step) {
  // Get the min Y
  const bb = pocket.box;
  let y = bb.ymin + step;
  let direction = 1;
  let path = [];
  while (y < bb.ymax) {
    const ray = new Segment(bb.xmin - step, y, bb.xmax + step, y);
    const intersections = ray.intersect(pocket);
    if (direction === 1)
      intersections.sort((a, b) => a.x - b.x);
    else
      intersections.sort((a, b) => b.x - a.x);
    let up = true;
    for (const intersection of intersections)
        path.push({ X: intersection.x, Y: intersection.y });
    y += step;
    // boustrophedonically
    direction = -direction;
  }
  return path;
}

export function rasterPocket(geometry, cutterDia, overlap, climb) {
  const step = cutterDia * (1 - overlap);
  // Shrink first path by half the cutter diameter
  let iPockets = InternalPaths.offset(geometry, -cutterDia / 2);

  const pockets = [];
  for (const poly of iPockets) {
    const pocket = new Polygon(poly.map(pt => new Point(pt.X, pt.Y)));
    // outline first
    const outline = pocket.vertices.map(v => { return { X: v.x, Y: v.y }; } );
    pockets.push(outline);
    // now rasterise interior
    const convexPockets = convexPartition(pocket);
    for (const convexPocket of convexPockets) {
      const rasters = rasteriseConvexPocket(convexPocket, step);
      if (rasters.length > 0)
        pockets.push(rasters);
    }
  }

  return internalToCamPaths(pockets);
}

/**
 * Compute outline tool path.
 * @param {InternalPath[]} geometry
 * @param {number} cutterDia is in internal units
 * @param {boolean} isInside true to cut inside the path, false to cut outside
 * @param {number} width desired path width (may be wider than the cutter)
 * @param {number} overlap is in the range [0, 1)
 * @param {boolean} climb true to reverse cutter direction
 * @return {CamPath[]}
 * @memberof Cam
 */
export function outline(geometry, cutterDia, isInside, width, overlap, climb) {
  let currentWidth = cutterDia;
  let allPaths = [];
  const eachWidth = cutterDia * (1 - overlap);

  let current;
  let clipPoly;
  let eachOffset;
  let needReverse;

  if (isInside) {
    current = InternalPaths.offset(geometry, -cutterDia / 2);
    clipPoly = InternalPaths.diff(
      current, InternalPaths.offset(geometry, -(width - cutterDia / 2)));
    eachOffset = -eachWidth;
    needReverse = climb;
  } else { // is outside
    current = InternalPaths.offset(geometry, cutterDia / 2);
    clipPoly = InternalPaths.diff(
      InternalPaths.offset(geometry, width - cutterDia / 2), current);
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
      current = InternalPaths.offset(current, width - currentWidth);
      if (needReverse)
        for (i = 0; i < current.length; ++i)
          current[i].reverse();
      allPaths = current.concat(allPaths);
      break;
    }
    currentWidth = nextWidth;
    current = InternalPaths.offset(current, eachOffset);
  }
  return internalToCamPaths(
    InternalPaths.mergePaths(allPaths, clipPoly), clipPoly);
};

/**
 * Calculate perforations along a path.
 * @param {InternalPath} path
 * @param {number} cutterDia in internal units
 * @param {number} spacing is the gap to leave between perforations
 * @param {number} topZ is the Z to which the tool is withdrawn
 * @param {number} botZ is the depth of the perforations
 * @return {CamPath}
 * @private
 * @memberof Cam
 */
function perforatePath(path, cutterDia, spacing, topZ, botZ) {
  // Measure the path
  let segStart = path[path.length - 1], segEnd, segLen, dx, dy;
  let totalPathLength = 0;
  for (segEnd of path) {
    dx = segEnd.X - segStart.X, dy = segEnd.Y - segStart.Y;
    segLen = Math.sqrt(dx * dx + dy * dy);
    totalPathLength += segLen;
    segStart = segEnd;
  }

  // Work out number of holes, and step between them, allowing spacing
  // between adjacent holes
  const numHoles = Math.floor(totalPathLength / (cutterDia + spacing));
  const step = totalPathLength / numHoles;

  // Walk round the path stopping at every hole, generating a new path
  let newPath = [];
  let gap = 0; // distance along the path from the last hole;
  let segi = 0; // index of end of current segment
  // Start of the current segment
  segStart = path[path.length - 1], segEnd = path[0];
  // dimensions of the current segment
  dx = segEnd.X - segStart.X, dy = segEnd.Y - segStart.Y;
  // Length of the current segment
  segLen = Math.sqrt(dx * dx + dy * dy);
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
 * @param {InternalPath[]} geometry
 * @param {number} cutterDia in internal units
 * @param {number} spacing is the gap to leave between perforations
 * @param {number} topZ is the Z to which the tool is withdrawn
 * @param {number} botZ is the depth of the perforations
 * @return {CamPath[]}
 * @memberof Cam
 */
export function perforate(geometry, cutterDia, spacing, topZ, botZ) {
  const allPaths = [];

  // Bloat the paths by half the cutter diameter
  const bloated = InternalPaths.offset(geometry, cutterDia / 2);

  for (const path of bloated) {
    allPaths.push(perforatePath(path, cutterDia, spacing, topZ, botZ));
  }
  return allPaths;
}

/**
 * Compute paths for engraving. This simply generates a tool path
 * that follows the outline of the geometry, regardless of the tool
 * diameter.
 * @param {InternalPath[]} geometry the engraving
 * @param {boolean} climb reverse cutter direction
 * @return {CamPath[]}
 * @memberof Cam
 */
export function engrave(geometry, climb) {
  const allPaths = [];
  for (const path of geometry) {
    const copy = path.slice(0); // take a copy
    if (!climb)
      copy.reverse();
    copy.push(copy[0]); // close the path
    allPaths.push(copy);
  }
  const result = internalToCamPaths(InternalPaths.mergePaths(allPaths));
  return result;
};

/**
 * Geometry paths define the centre of a groove being cut by an angled
 * bit. The depth of the groove is limited by the `depth` parameter.
 * The tool will cut no deeper than that, but will always cut a groove
 * `width` wide.
 * @param {InternalPath[]} geometry the engraving
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
 * @param {InternalPath} toolPath path being followed by the cutter
 * @param {InternalPath[]} tabGeometry polygons representing tabs
 * @author Crawford Currie
 */
export function separateTabs(toolPath, tabGeometry) {
  const tabPolys = [];
  for (const poly of tabGeometry) {
    const poly2d = new Polygon(poly.map(pt => new Point(pt.X, pt.Y)));
    tabPolys.push(poly2d);
  }
  let ip0 = toolPath[toolPath.length - 1];
  let p0 = new Point(ip0.X, ip0.Y);

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

  const paths = [];
  let currPath = [ ip0 ];
  //console.debug("Path starts at ", ip0);
  for (const ip1 of toolPath) {
    if (ip1.X !== ip0.X || ip1.Y !== ip0.Y) {
      //console.debug("\tnew point at ", ip1);
      const p1 = new Point(ip1.X, ip1.Y);
      const seg = new Segment(p0, p1);
      for (const tabPoly of tabPolys) {
        const intersections = seg.intersect(tabPoly);
        if (intersections.length > 0) {
          // Sort the intersections by ascending distance from the start point
          // of the segment
          intersections.sort((a, b) => a.distanceTo(p0)[0] - b.distanceTo(p0)[0]);
          //console.debug("\tintersections at ", intersections);
          // Each intersection is the start of a new path
          for (const intersection of intersections) {
            const ins = { X: intersection.x, Y: intersection.y };
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

/*CPP
function vPocket(geometry, cutterAngle, passDepth, maxDepth) {
  if (cutterAngle <= 0 || cutterAngle >= 180)
    return [];

  const memoryBlocks = [];

  const cGeometry = InternalPaths.toCpp(geometry, memoryBlocks);

  const resultPathsRef = Module._malloc(4);
  const resultNumPathsRef = Module._malloc(4);
  const resultPathSizesRef = Module._malloc(4);
  memoryBlocks.push(resultPathsRef);
  memoryBlocks.push(resultNumPathsRef);
  memoryBlocks.push(resultPathSizesRef);

  //extern "C" void vPocket(
  //    int debugArg0, int debugArg1,
  //    double** paths, int numPaths, int* pathSizes,
  //    double cutterAngle, double passDepth, double maxDepth,
  //    double**& resultPaths, int& resultNumPaths, int*& resultPathSizes)
  Module.ccall(
    'vPocket',
    'void', ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
    [App.models.Misc.debugArg0(), App.models.Misc.debugArg1(), cGeometry[0], cGeometry[1], cGeometry[2], cutterAngle, passDepth, maxDepth, resultPathsRef, resultNumPathsRef, resultPathSizesRef]);

  const result = convertPathsFromCppToCamPath(memoryBlocks, resultPathsRef, resultNumPathsRef, resultPathSizesRef);

  for (let i = 0; i < memoryBlocks.length; ++i)
    Module._free(memoryBlocks[i]);

  return result;
};

let displayedCppTabError1 = false;
let displayedCppTabError2 = false;

/**
 * Convert C format paths to array of CamPath.
 * double**& cPathsRef, int& cNumPathsRef, int*& cPathSizesRef
 * Assumes each point has X, Y, Z (stride = 3)
 * @private
 * @memberof Cam
 *
function convertPathsFromCppToCamPath(memoryBlocks, cPathsRef, cNumPathsRef, cPathSizesRef) {

  const cPaths = Module.HEAPU32[cPathsRef >> 2];
  memoryBlocks.push(cPaths);
  const cPathsBase = cPaths >> 2;

  const cNumPaths = Module.HEAPU32[cNumPathsRef >> 2];

  const cPathSizes = Module.HEAPU32[cPathSizesRef >> 2];
  memoryBlocks.push(cPathSizes);
  const cPathSizesBase = cPathSizes >> 2;

  const convertedPaths = [];
  for (let i = 0; i < cNumPaths; ++i) {
    const pathSize = Module.HEAPU32[cPathSizesBase + i];
    let cPath = Module.HEAPU32[cPathsBase + i];
    // cPath contains value to pass to Module._free(). The aligned version contains the actual data.
    memoryBlocks.push(cPath);
    if (cPath & 4)
      cPath += 4;
    const pathArray = new Float64Array(Module.HEAPU32.buffer, Module.HEAPU32.byteOffset + cPath);

    const convertedPath = [];
    convertedPaths.push({ path: convertedPath, safeToClose: false });
    for (let j = 0; j < pathSize; ++j)
      convertedPath.push({
        X: pathArray[j * 3],
        Y: pathArray[j * 3 + 1],
        Z: pathArray[j * 3 + 2]
      });
  }

  return convertedPaths;
  }

/**
 * This was never called in jscut; just as well, as I have no idea what
 * it was supposed to do (the C++ code is truly obscure)
 * @param {number} cutterDia is in internal units
 * @param {number} overlap is in the range [0, 1)
 * @return {CamPath[]}
 * @memberof Cam
 *
export function hspocket(geometry, cutterDia, overlap, climb) {
  const memoryBlocks = [];

  const cGeometry = InternalPaths.toCpp(geometry, memoryBlocks);

  const resultPathsRef = Module._malloc(4);
  const resultNumPathsRef = Module._malloc(4);
  const resultPathSizesRef = Module._malloc(4);
  memoryBlocks.push(resultPathsRef);
  memoryBlocks.push(resultNumPathsRef);
  memoryBlocks.push(resultPathSizesRef);

  //extern "C" void hspocket(
  //    double** paths, int numPaths, int* pathSizes, double cutterDia,
  //    double**& resultPaths, int& resultNumPaths, int*& resultPathSizes)
  Module.ccall(
  'hspocket',
  'void', ['number', 'number', 'number', 'number', 'number', 'number', 'number'],
  [cGeometry[0], cGeometry[1], cGeometry[2], cutterDia, resultPathsRef, resultNumPathsRef, resultPathSizesRef]);

  const result = convertPathsFromCppToCamPath(memoryBlocks, resultPathsRef, resultNumPathsRef, resultPathSizesRef);

  for (let i = 0; i < memoryBlocks.length; ++i)
  Module._free(memoryBlocks[i]);

  return result;
  };
/CPP*/


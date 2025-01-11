/*Copyright Tim Fleming, Crawford Currie 2014-2024. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global Module */

/* global ClipperLib */ //

const CLEAN_POLY_DIST = 1;
const ARC_TOLERANCE = 2.5;

/**
 * Functions for manipulating paths in internal coordinates.
 * @namespace InternalPaths
 */

/**
 * A 2D point in internal units
 * @typedef {object} InternalPoint
 * @property {number} X X coord in internal units (100K to the inch)
 * @property {number} Y Y coord in internal units
 * @memberof InternalPaths
 */

/**
 * A simple array of 2D points in internal units.
 * @typedef {InternalPoint[]} InternalPath
 * @memberof InternalPaths
 */

/**
 * Simplify and clean up Clipper geometry.
 * @param {InternalPath} geometry
 * @param {ClipperLib.PolyFillType} fillRule
 * @return {InternalPath} cleaned up geometry
 * @memberof InternalPaths
 */
export function simplifyAndClean(geometry, fillRule) {
  geometry = ClipperLib.Clipper.CleanPolygons(geometry, CLEAN_POLY_DIST);
  geometry = ClipperLib.Clipper.SimplifyPolygons(geometry, fillRule);
  return geometry;
};

/**
 * Clip Clipper geometry. "clippable" will be clipped to "clipPaths".
 * @param {InternalPath[]} clippable paths to clip
 * @param {InternalPath[]} clipPaths clip paths
 * @param {ClipperLib.ClipType} clipType
 * @return {InternalPath[]} new geometry.
 * @memberof InternalPaths
 */
export function clip(clippable, clipPaths, clipType) {
  const clipper = new ClipperLib.Clipper();
  clipper.AddPaths(clippable, ClipperLib.PolyType.ptSubject, true);
  clipper.AddPaths(clipPaths, ClipperLib.PolyType.ptClip, true);
  const result = [];
  clipper.Execute(clipType, result, ClipperLib.PolyFillType.pftEvenOdd,
                  ClipperLib.PolyFillType.pftEvenOdd);
  return result;
};

/**
 * Return difference between to Clipper geometries. Returns new geometry.
 * @param {InternalPath[]} paths1 first set of paths
 * @param {InternalPath[]} paths2 second set of paths
 * @return {InternalPath[]} new geometry.
 * @memberof InternalPaths
 */
export function diff(paths1, paths2) {
  return clip(paths1, paths2, ClipperLib.ClipType.ctDifference);
};

/**
 * Offset Clipper geometries by amount.
 * @param {InternalPath[]} paths set of paths
 * @param {number} amount positive expands, negative shrinks.
 * @param {ClipperLib.JoinType} joinType optional path join type
 * @param {ClipperLib.EndType} endType optional path end type
 * @return {InternalPath[]} new geometry.
 * @memberof InternalPaths
 */
export function offset(
  paths, amount,
  joinType = ClipperLib.JoinType.jtRound,
  endType = ClipperLib.EndType.etClosedPolygon) {

  // bug workaround: join types are swapped in ClipperLib 6.1.3.2
  if (joinType == ClipperLib.JoinType.jtSquare)
    joinType = ClipperLib.JoinType.jtMiter;
  else if (joinType == ClipperLib.JoinType.jtMiter)
    joinType = ClipperLib.JoinType.jtSquare;

  const co = new ClipperLib.ClipperOffset(2, ARC_TOLERANCE);
  co.AddPaths(paths, joinType, endType);
  const offsetted = [];
  co.Execute(offsetted, amount);
  //offsetted = ClipperLib.Clipper.CleanPolygons(offsetted, CLEAN_POLY_DIST);
  return offsetted;
};

/**
 * Convert array of CamPath to Internal paths
 * @param {CamPath[]} paths CamPaths
 * @return {InternalPath[]} converted paths
 * @memberof InternalPaths
 */
export function fromCamPaths(paths) {
  return paths.map(p => p.path);
};

/*CPP*
 * Convert internal paths to C format.
 * @param {InternalPath[]} paths paths to convert
 * @param {[]} memoryBlocks
 * return {[]} [double** cPaths, int cNumPaths, int* cPathSizes]
 * @memberof InternalPaths
 *
export function toCpp(paths, memoryBlocks) {
  const doubleSize = 8;

  const cPaths = Module._malloc(paths.length * 4);
  memoryBlocks.push(cPaths);
  const cPathsBase = cPaths >> 2;

  const cPathSizes = Module._malloc(paths.length * 4);
  memoryBlocks.push(cPathSizes);
  const cPathSizesBase = cPathSizes >> 2;

  for (let i = 0; i < paths.length; ++i) {
    const path = paths[i];

    let cPath = Module._malloc(path.length * 2 * doubleSize + 4);
    memoryBlocks.push(cPath);
    if (cPath & 4)
      cPath += 4;
    //console.debug("-> " + cPath.toString(16));
    const pathArray = new Float64Array(
      Module.HEAPU32.buffer, Module.HEAPU32.byteOffset + cPath);

    for (let j = 0; j < path.length; ++j) {
      const point = path[j];
      pathArray[j * 2] = point.X;
      pathArray[j * 2 + 1] = point.Y;
    }

    Module.HEAPU32[cPathsBase + i] = cPath;
    Module.HEAPU32[cPathSizesBase + i] = path.length;
  }

  return [ cPaths, paths.length, cPathSizes ];
};
/CPP*/

/*CPP*
 * Convert C format paths to Clipper paths.
 * Assumes each point has X, Y (stride = 2).
 * @param memoryBlocks
 * @param {double**&} cPathsRef
 * @param {int&} cNumPathsRef
 * @param {int*&} cPathSizesRef
 * @return {InternalPath[]} converted paths
 *
export function fromCpp(memoryBlocks, cPathsRef, cNumPathsRef, cPathSizesRef) {
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
    convertedPaths.push(convertedPath);
    for (let j = 0; j < pathSize; ++j)
      convertedPath.push({
        X: pathArray[j * 2],
        Y: pathArray[j * 2 + 1]
      });
  }

  return convertedPaths;
};
/CPP*/

/**
 * Does the line from p1 to p2 cross the bounds
 * @param {InternalPath} bounds the bounds path
 * @param {InternalPoint} p1 line endpoint
 * @param {InternalPoint} p2 line endpoint
 * @return {boolean} true if the line cross the bounds path, or the bounds
 * path is null.
 * @memberof InternalPaths
 */
export function crosses(bounds, p1, p2) {
  if (bounds == null)
    return true;
  if (p1.X == p2.X && p1.Y == p2.Y)
    return false;
  const clipper = new ClipperLib.Clipper();
  clipper.AddPath([p1, p2], ClipperLib.PolyType.ptSubject, false);
  clipper.AddPaths(bounds, ClipperLib.PolyType.ptClip, true);
  const result = new ClipperLib.PolyTree();
  clipper.Execute(ClipperLib.ClipType.ctIntersection, result, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);
  if (result.ChildCount() == 1) {
    const child = result.Childs()[0];
    const points = child.Contour();
    if (points.length == 2) {
      if (points[0].X == p1.X && points[1].X == p2.X && points[0].Y == p1.Y && points[1].Y == p2.Y)
        return false;
      if (points[0].X == p2.X && points[1].X == p1.X && points[0].Y == p2.Y && points[1].Y == p1.Y)
        return false;
    }
  }
  return true;
}

/**
 * Try to merge paths. A merged path doesn't cross outside of bounds.
 * @param {InternalPath} bounds
 * @param {InternalPath[]} paths
 * @return {InternalPath[]} merged paths
 * @memberof InternalPaths
 */
export function mergePaths(bounds, paths) {
  if (paths.length == 0)
    return [];

  let currentPath = paths[0];
  currentPath.push(currentPath[0]);
  let currentPoint = currentPath[currentPath.length - 1];
  paths[0] = [];

  const mergedPaths = [];
  let numLeft = paths.length - 1;
  while (numLeft > 0) {
    let closestPathIndex = null;
    let closestPointIndex = null;
    let closestPointDist2 = Number.MAX_VALUE;
    for (let pathIndex = 0; pathIndex < paths.length; ++pathIndex) {
      const path = paths[pathIndex];
      for (let pointIndex = 0; pointIndex < path.length; ++pointIndex) {
        const point = path[pointIndex];
        const dist2 = (currentPoint.X - point.X) * (currentPoint.X - point.X)
              + (currentPoint.Y - point.Y) * (currentPoint.Y - point.Y);
        if (dist2 < closestPointDist2) {
          closestPathIndex = pathIndex;
          closestPointIndex = pointIndex;
          closestPointDist2 = dist2;
        }
      }
    }

    let path = paths[closestPathIndex];
    paths[closestPathIndex] = [];
    numLeft -= 1;
    const needNew = crosses(bounds, currentPoint, path[closestPointIndex]);
    path = path.slice(closestPointIndex, path.length)
    .concat(path.slice(0, closestPointIndex));
    path.push(path[0]);
    if (needNew) {
      mergedPaths.push(currentPath);
      currentPath = path;
      currentPoint = currentPath[currentPath.length - 1];
    }
    else {
      currentPath = currentPath.concat(path);
      currentPoint = currentPath[currentPath.length - 1];
    }
  }
  mergedPaths.push(currentPath);
  return mergedPaths;
}

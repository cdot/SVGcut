/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global Module */

/* global ClipperLib */ //

import { UnitConverter } from "./UnitConverter.js";

/**
 * @typedef {object} ClipperPoint
 * @property {number} ClipperPoint.X
 * @property {number} ClipperPoint.Y
 */

const CLEAN_POLY_DIST = 1;
const ARC_TOLERANCE = 2.5;

/**
 * Support for operations using Clipper (integer) points
 * @namespace Clipper
 */

/**
 * Get the square of the distance between two Clipper points
 * @param {ClipperPoint} a
 * @param {ClipperPoint} b
 */
export function dist2(a, b) {
  const dx = a.X - b.X;
  const dy = a.Y - b.Y;
  return dx * dx + dy + dy;
}

/**
 * Simplify and clean up Clipper geometry.
 * @param {ClipperLib.Paths} geometry
 * @param {ClipperLib.PolyFillType} fillRule
 * @return {ClipperLib.Paths} cleaned up geometry
 * @memberof Clipper
 */
export function simplifyAndClean(geometry, fillRule) {
  geometry = ClipperLib.Clipper.CleanPolygons(geometry, CLEAN_POLY_DIST);
  geometry = ClipperLib.Clipper.SimplifyPolygons(geometry, fillRule);
  return geometry;
};

/**
 * Clip Clipper geometry. "clippable" will be clipped to "clipPaths".
 * @param {ClipperLib.Paths} clippable paths to clip
 * @param {ClipperLib.Paths} clipPaths clip paths
 * @param {ClipperLib.ClipType} clipType
 * @return {ClipperLib.Paths} new geometry.
 * @memberof Clipper
 */
export function clip(clippable, clipPaths, clipType) {
  const clipper = new ClipperLib.Clipper();
  clipper.AddPaths(clippable, ClipperLib.PolyType.ptSubject, true);
  clipper.AddPaths(clipPaths, ClipperLib.PolyType.ptClip, true);
  const newGeom = new ClipperLib.Paths();
  clipper.Execute(clipType, newGeom, ClipperLib.PolyFillType.pftEvenOdd,
                  ClipperLib.PolyFillType.pftEvenOdd);
  return newGeom;
};

/**
 * Return difference between to Clipper geometries. Returns new geometry.
 * @param {ClipperLib.Paths} paths1 first set of paths
 * @param {ClipperLib.Paths} paths2 second set of paths
 * @return {ClipperLib.Paths} new geometry.
 * @memberof Clipper
 */
export function diff(paths1, paths2) {
  return clip(paths1, paths2, ClipperLib.ClipType.ctDifference);
};

/**
 * Offset Clipper geometries by amount.
 * @param {ClipperLib.Paths} paths set of paths
 * @param {number} amount positive expands, negative shrinks.
 * @param {ClipperLib.JoinType} joinType optional path join type
 * @param {ClipperLib.EndType} endType optional path end type
 * @return {ClipperLib.Paths} new geometry.
 * @memberof Clipper
 */
export function offset(
  paths, amount,
  joinType = ClipperLib.JoinType.jtMiter,
  endType = ClipperLib.EndType.etClosedPolygon) {

  const co = new ClipperLib.ClipperOffset(2, ARC_TOLERANCE);
  co.AddPaths(paths, joinType, endType);
  const offsetted = new ClipperLib.Paths();
  co.Execute(offsetted, amount);
  //offsetted = ClipperLib.Clipper.CleanPolygons(offsetted, CLEAN_POLY_DIST);
  return offsetted;
};

/**
 * Does the line from p1 to p2 cross the poly?
 * @param {ClipperLib.Path} bounds the bounds path
 * @param {ClipperLib.IntPoint} p1 line endpoint
 * @param {ClipperLib.IntPoint} p2 line endpoint
 * @return {boolean} true if the line cross the bounds poly, or the bounds
 * poly is null.
 * @memberof Clipper
 */
export function crosses(bounds, p1, p2) {
  if (!bounds)
    return true;
  if (p1.X === p2.X && p1.Y === p2.Y) // 1D line, can't cross anything
    return false;
  const clipper = new ClipperLib.Clipper();
  clipper.AddPath([p1, p2], ClipperLib.PolyType.ptSubject, false);
  clipper.AddPaths(bounds, ClipperLib.PolyType.ptClip, true);
  const polyTree = new ClipperLib.PolyTree();
  clipper.Execute(ClipperLib.ClipType.ctIntersection,
                  polyTree,
                  ClipperLib.PolyFillType.pftEvenOdd,
                  ClipperLib.PolyFillType.pftEvenOdd);
  if (polyTree.ChildCount() === 1) {
    const child = polyTree.Childs()[0];
    const points = child.Contour();
    if (points.length === 2) {
      if (points[0].X === p1.X
          && points[1].X === p2.X
          && points[0].Y === p1.Y
          && points[1].Y === p2.Y)
        return false;
      if (points[0].X === p2.X
          && points[1].X === p1.X
          && points[0].Y === p2.Y
          && points[1].Y === p1.Y)
        return false;
    }
  }
  return true;
}

/**
 * Try to merge poly paths by linking them with an edge that doesn't
 * cross the boundingGeometry (if specified). Paths are considered in
 * order, by looking for the shortest edge between the last point on poly[N]
 * to all points on all polys[>N] that doesn't cross the bounding poly
 * (if specified). This is very inefficient, try to avoid calling it with
 * more than 2 polys.
 * @param {ClipperLib.Paths} paths list of paths to merge
 * @param {ClipperLib.Path?} boundingGeometry poly not to cross
 * @return {ClipperLib.Paths} merged paths
 * @memberof Clipper
 */
export function joinPaths(paths, boundingGeometry) {
  if (paths.length < 2)
    return paths; // nothing to do

  let currentPath = paths[0];
  currentPath.push(currentPath[0]);
  let currentPoint = currentPath[currentPath.length - 1];
  paths[0] = new ClipperLib.Path();

  const mergedPaths = new ClipperLib.Paths();
  // While there are paths left to consider
  let numLeft = paths.length - 1;
  while (numLeft > 0) {
    let closestPathIndex = null;
    let closestPointIndex = null;
    let closestPointDist2 = Number.MAX_VALUE;

    // Find the closest point on the remaining paths to the last
    // point on the current path
    for (let pathIndex = 0; pathIndex < paths.length; ++pathIndex) {
      const path = paths[pathIndex];
      for (let pointIndex = 0; pointIndex < path.length; ++pointIndex) {
        const point = path[pointIndex];
        const dist2 = dist2(currentPoint, point);
        if (dist2 < closestPointDist2) {
          closestPathIndex = pathIndex;
          closestPointIndex = pointIndex;
          closestPointDist2 = dist2;
        }
      }
    }
    let path = paths[closestPathIndex];

    paths[closestPathIndex] = new ClipperLib.Path();
    numLeft -= 1;
    const needNew = crosses(
      boundingGeometry, currentPoint, path[closestPointIndex]);
    // Merge the two paths at the closest approach
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

/**
 * @typedef {Array} svgSegment
 * [0] is always a character. [1...] are numbers.
 */

/**
 * Convert a set of Clipper paths to an SVG paths, using only `M` and
 * `L` path commands. The resulting path is suitable for a `d` attribute
 * on an SVG `path`.
 * @see {@link http://snapsvg.io/docs/#Paper.path|Snap}
 * @param {ClipperLib.Paths} integerPaths
 * @return {svgSegment[]}
 * @memberof Clipper
 */
export function integer2SVG(integerPaths) {
  const segments = [];
  for (const path of integerPaths) {
    let first = true;
    const l = [ 'L' ];
    for (const p of path) {
      if (first) {
        segments.push([
          'M',
          p.X * UnitConverter.from.integer.to.px,
          p.Y * UnitConverter.from.integer.to.px
        ]);
        first = false;
      } else {
        l.push(p.X * UnitConverter.from.integer.to.px,
               p.Y * UnitConverter.from.integer.to.px);
      }
    }
    if (l.length > 1)
      segments.push(l);
  }
  return segments;
}

/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global assert */
/* global ClipperLib */
ClipperLib.use_xyz = true;

import { UnitConverter } from "./UnitConverter.js";

/**
 * Paths processed by ClipperLib are simple arrays of points. That
 * means you can't flag a path as closed. That's OK if you only process
 * polys, but if you have open paths it's a PITA. To work round this
 * problem we have to use our own path definiiton.
 */
export class CutPath extends Array {

  /**
   * Get the square of the distance between two ClipperLib.IntPoints
   * @param {ClipperLib.IntPoint} a
   * @param {ClipperLib.IntPoint} b
   */
  static dist2(a, b) {
    const dx = a.X - b.X;
    const dy = a.Y - b.Y;
    return dx * dx + dy * dy;
  }

  /**
   * Convert an array of points to a CutPath if necessary
   * @param {CutPath|Array} path
   * @param {boolean?} closed true to close (make a poly) but only if
   * initialising from Arrays. If initialising from a CutPath, the
   * closedness is retained. If path is a (non-CutPath) array, then the
   * individual entries must be { x:number, y:number } or
   * { X:number, Y:number } with optional Z.
   * @return {CutPath}
   */
  constructor(path, closed) {
    if (typeof path === "number")
      super(path);
    else
      super();

    /**
     * True if this is a closed poly. Default is false.
     * @member {boolean}
     */
    this.isClosed = false;

    if (path && path instanceof CutPath)
      this.isClosed = path.isClosed;
    else if (typeof closed !== "undefined")
      this.isClosed = closed;

    if (Array.isArray(path)) {
      for (const point of path) {
        const x = point.x ?? point.X;
        const y = point.y ?? point.Y;
        if (ClipperLib.use_xyz) {
          const z = point.z ?? point.Z ?? 0;
          // IntPoint defaults Z to 0
          this.push(new ClipperLib.IntPoint(x, y, z));
        } else
          this.push(new ClipperLib.IntPoint(x, y));
      }
    }
  }

  /**
   * Convert to a set of SVG paths, using only `M`, `L`, and `Z` path
   * commands. The resulting path is suitable for a `d` attribute on
   * an SVG `path`.
   * @return {svgSegment[]}
   */
  toSegments() {
    const segments = [];
    let first = true;
    const l = [ 'L' ];
    for (const p of this) {
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
    if (this.isClosed)
      segments.push([ 'Z' ]);

    return segments;
  }

  /**
   * Return the perimeter of the path
   * @return {number} perimeter
   */
  perimeter() {
    return ClipperLib.JS.PerimeterOfPath(this, true, 1 /* number scale */);
  }

  /**
   * Find the closest vertex on this path to the given point
   * @param {ClipperLib.IntPoint} point to test
   * @return {object?} { point: number, dist2: number } or undefined.
   * point is the index of the closest point, dist2 is the square of the
   * distance
   */
  closestVertex(pt) {
    let best, i = 0;
    for (const tp of this) {
      const d2 = CutPath.dist2(pt, tp);
      if (best && d2 < best.dist2) {
        best.point = i;
        best.dist2 = d2;
      } else if (!best)
        best = { point: i, dist2: d2 };
      i++;
    }
    return best;
  }

  /**
   * Make the ith point the first point in a closed poly
   */
  makeFirst(i) {
    assert(this.isClosed);
    if (i === 0 || this.length <= 1) return;
    if (i < this.length / 2)
      while (i-- > 0)
        this.push(this.shift());
    else {
      i = this.length - i;
      while (i-- > 0)
        this.unshift(this.pop());
    }
  }

  /**
   * Make the ith point the last point in a closed poly
   */
  makeLast(i) {
    assert(this.isClosed);
    if (i === this.length - 1 || this.length <= 1) return;
    this.makeFirst(i + 1);
  }

  /**
   * Inside test for a point.
   * @param {ClipperLib.IntPoint} pt point to check
   * @returns {number} -1: outside, 0: on edge, 1: inside
   */
  inside(pt) {
    if (!this.isClosed)
      return false;
    const between = (p, a, b) => p >= a && p <= b || p <= a && p >= b;
    let inside = false;
    for (let i = this.length - 1, j = 0; j < this.length; i = j, j++) {
      const A = this[i];
      const B = this[j];
      // corner cases
      if (pt.X == A.X && pt.Y == A.Y || pt.X == B.X && pt.Y == B.Y)
        return 0;
      if (A.Y == B.Y && pt.Y == A.Y && between(pt.X, A.X, B.X))
        return 0;

      if (between(pt.Y, A.Y, B.Y)) { // if pt inside the vertical range
        // filter out "ray pass vertex" problem by treating the line
        // a little lower
        if (pt.Y == A.Y && B.Y >= A.Y || pt.Y == B.Y && A.Y >= B.Y)
          continue;
        // calc cross product `ptA X ptB`, pt lays on left side of AB if c > 0
        const c = (A.X - pt.X) * (B.Y - pt.Y) - (B.X - pt.X) * (A.Y - pt.Y);
        if (c == 0)
          return 0;
        if ((A.Y < B.Y) == (c > 0))
          inside = !inside;
      }
    }

    return inside? 1 : -1;
  }
}

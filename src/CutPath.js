/*Copyright Todd Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global assert */
/* global ClipperLib */
ClipperLib.use_xyz = true;

import { UnitConverter } from "./UnitConverter.js";
import { CutPoint } from "./CutPoint.js";
import { BBox3D } from "./BBox3D.js";
import { CONST } from "./Constants.js";

// Remove path vertices closer than this.
const CLEAN_PATH_DIST2 = CONST.CLEAN_PATH_DIST * CONST.CLEAN_PATH_DIST;

/**
 * Paths processed by ClipperLib are simple arrays of points. That
 * means you can't flag a path as closed. That's OK if you only process
 * polys, but if you have open paths it's a PITA. To work round this
 * problem we have to use our own path definiiton.
 * @extends Array
 */
export class CutPath extends Array {

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

    if (path && path instanceof CutPoint)
      path = [ path ];

    if (Array.isArray(path)) {
      for (const point of path) {
        const x = point.x ?? point.X;
        const y = point.y ?? point.Y;
        const z = point.z ?? point.Z;
        if (typeof z === "number") {
          this.push(new CutPoint(x, y, z));
        } else
          this.push(new CutPoint(x, y));
      }
      if (typeof path.isClosed !== "undefined")
        this.isClosed = path.isClosed;
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
    let p0 = this[0];
    let len = 0;
    for (let i = 1; i < this.length; i++) {
      const p1 = this[i];
      len += Math.sqrt((p1.X - p0.X) * (p1.X - p0.X)
                       + (p1.Y - p0.Y) * (p1.Y - p0.Y));
      p0 = p1;
    }
    if (this.isClosed)
      len += Math.sqrt((this[0].X - p0.X) * (this[0].X - p0.X)
                       + (this[0].Y - p0.Y) * (this[0].Y - p0.Y));
    return len;
  }

  /**
   * Find the closest vertex on this path to the given point
   * @param {CutPoint} point to test
   * @return {object?} { pointIndex: number, dist2: number } or undefined.
   * point is the index of the closest point, dist2 is the square of the
   * distance
   */
  closestVertex(pt) {
    let best;
    for (let i = 0; i < this.length; i++) {
      const d2 = pt.dist2(this[i]);
      if (best && d2 < best.dist2) {
        best.pointIndex = i;
        best.dist2 = d2;
      } else if (!best)
        best = { pointIndex: i, dist2: d2 };
    }
    return best;
  }

  /**
   * Find the closest endpoint of this path to the given point. While it only
   * make geometric sense on open paths, it may also be useful when joining
   * closed paths.
   * @param {CutPoint} point to test
   * @return {object?} `{ pointIndex: number, point: CutPoint, dist2: number }`
   * or undefined. `pointIndex` is the index of the closest endpoint,
   * `point` is the actual endpoint, `dist2` is the square of the distance.
   */
  closestEndpoint(pt) {
    const s = this[0];
    const e = this[this.length - 1];

    const ds = pt.dist2(s);
    const de = pt.dist2(e);
    if (de < ds)
      return { dist2: de, pointIndex: this.length - 1, point: e };
    else
      return { dist2: ds, pointIndex: 0, point: s };
  }

  /**
   * Remove adjacent duplicate vertices
   */
  unduplicate() {
    if (this.isClosed)
      this.push(this[0]);
    let i = 1;
    while (i < this.length) {
      if (this[i].equals(this[i - 1]))
        this.splice(i, 1);
      else
        i++;
    }
    if (this.isClosed)
      this.pop();
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
   * Inside test for a point. This path must be closed.
   * @param {CutPoint} pt point to check
   * @returns {number} -1: outside, 0: on edge, 1: inside
   */
  inside(pt) {
    assert(this.isClosed);

    const between = (p, a, b) => p >= a && p <= b || p <= a && p >= b;
    let inside = false;
    for (let i = this.length - 1, j = 0; j < this.length; i = j, j++) {
      const A = this[i];
      const B = this[j];
      // corner cases
      if (pt.equals(A) || pt.equals(B))
        return 0;
      if (A.Y === B.Y && pt.Y === A.Y && between(pt.X, A.X, B.X))
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

  /**
   * Assign a single Z value to all CutPoints in this path that
   * don't already have a Z.
   * @param {boolean} force force the new Z value even if the point already
   * has a Z.
   */
  Z(z, force) {
    for (const p of this)
      if (force || typeof p.Z === "undefined")
        p.Z = z;
  }

  /**
   * Get the 3D BB of the paths
   * @return {BBox3D}
   */
  bbox3D() {
    const bb = new BBox3D(this[0]);
    for (let i = 1; i < this.length; i++)
      bb.expand(this[i]);
    return bb;
  }

  toJson() {
    const a = { isClosed: this.isClosed, pts: [] };
    this.map(p => a.pts.push(p));
    return a;
  }

  /**
   * Construct from data previously saved using toJson
   * @param {object} json data
   * @return {CutPath}
   */
  static fromJson(json) {
    return new CutPath(json.pts, json.isClosed);
  }
}

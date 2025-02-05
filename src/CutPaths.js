/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global assert */
/* global ClipperLib */
ClipperLib.use_xyz = true;

import { UnitConverter } from "./UnitConverter.js";
import { CutPoint } from "./CutPoint.js";
import { CutPath } from "./CutPath.js";

/*
 * The distance parameter's default value is approximately √2 so that
 * a vertex will be removed when adjacent or semi-adjacent vertices
 * having their corresponding X and Y coordinates differing by no more
 * than 1 unit. However according to tests by the clipper-lib
 * developers, the best distance value to remove artifacts before
 * offsetting is 0.1 * scale.
 */
const CLEAN_POLY_DIST = 0.001 * UnitConverter.from.mm.to.integer;

/*
 * Only relevant when JoinType = jtRound and/or EndType = etRound.
 * Since flattened paths can never perfectly represent arcs, this
 * field/property specifies a maximum acceptable imprecision
 * ('tolerance') when arcs are approximated in an offsetting
 * operation. Smaller values will increase 'smoothness' up to a point
 * though at a cost of performance and in creating more vertices to
 * construct the arc.
 * The default ArcTolerance is 0.25 units. This means that the maximum
 * distance the flattened path will deviate from the 'true' arc will
 * be no more than 0.25 units (before rounding).
 * Reducing tolerances below 0.25 will not improve smoothness since
 * vertex coordinates will still be rounded to integer values. The
 * only way to achieve sub-integer precision is through coordinate
 * scaling before and after offsetting (see example below).
 * It's important to make ArcTolerance a sensible fraction of the
 * offset delta (arc radius). Large tolerances relative to the offset
 * delta will produce poor arc approximations but, just as
 * importantly, very small tolerances will substantially slow
 * offsetting performance while providing unnecessary degrees of
 * precision.
 */
const ARC_TOLERANCE = 0.25 * UnitConverter.from.mm.to.integer;

/**
 * A single CutPaths object can represent both a disjoint set of CutPath
 * (open and closed), or can represent a single closed polygon, possibly with
 * with holes.
 */
export class CutPaths extends Array {

  /**
   * Corner join type. See ClipperLib documentation for more.
   * `jtRound` Approximate acute corners with a series of arc chords.
   * `jtSquare` Flatten out acute edge joins that would produce
   * excessively long and narrow 'spikes'.
   * `jtMiter` where possible extend acute edge joins out, but switch
   * to `jsSquare` if that would create long thin spikes.
   */
  static JoinType = ClipperLib.JoinType;

  /**
   * @param {CutPaths|CutPath|Array} paths if defined, initialise from this.
   * Array can be an Array of Arrays, though the inner Arrays must be
   * arrays of { x: number, y: number } or  { X: number, Y: number } points.
   * CutPaths and arrays are deep copied.
   * @param {boolean?} closed if defined, will set the paths to closed,
   * but only if they are being built from arrays. CutPaths and CutPath
   * retain their closedness.
   */
  constructor(paths, closed) {
    if (typeof paths === "number")
      super(paths);
    else
      super();

    if (paths instanceof CutPath) {
      if (paths.length > 0)
        this.push(new CutPath(paths));
    } else if (paths instanceof CutPaths) {
      for (const p of paths) {
        if (p.length > 0)
          this.push(new CutPath(p));
      }
    } else if (Array.isArray(paths) && paths.length > 0) {
      if (Array.isArray(paths[0])) {
        for (const p of paths) {
          if (p.length > 0)
            this.push(new CutPath(p, closed));
        }
      } else
          this.push(new CutPath(paths, closed));
    }
  }

  /**
   * Convert a list of SVG segments to CutPaths.
   * May return multiple paths. This is NOT a generic SVG `path` to CutPaths,
   * as it only supports `M` and `L` path commands.
   * @param {svgSegment[]} segments the segments to convert. The first
   * segment must be an `M`.
   * @return {CutPaths}
   * @throws {Error} if there's a problem.
   */
  static fromSegments(segments) {
    function px2Integer(x, y) {
      return new CutPoint(
        x * UnitConverter.from.px.to.integer,
        y * UnitConverter.from.px.to.integer);
    };

    let currentPath;
    const cutPaths = new CutPaths();
    for (const segment of segments) {
      if (segment[0] === 'M') {
        if (currentPath)
          cutPaths.push(currentPath);
        currentPath = new CutPath();
        currentPath.push(px2Integer(segment[1], segment[2]));
      } else if (segment[0] === 'L') {
        if (!currentPath)
          throw new Error("Internal Error: Segments do not begin with M");
        for (let j = 1; j < segment.length; j += 2)
          currentPath.push(px2Integer(segment[j], segment[j + 1]));
      } else if (segment[0] === 'Z')
        currentPath.isClosed = true;
      else
        throw new Error(`Unsupported path command: ${segment[0]}`);
    }
    if (currentPath)
      cutPaths.push(currentPath);
    return cutPaths;
  }

  /**
   * Convert to a set of SVG paths, using only `M` and
   * `L` path commands. The resulting path is suitable for a `d` attribute
   * on an SVG `path`.
   * @return {svgSegment[]}
   */
  toSegments() {
    const segments = [];
    for (const path of this)
      for (const seg of path.toSegments())
        segments.push(seg);
    return segments;
  }

  /**
   * Offset (bloat/shrink) closed paths by amount. Only closed paths are
   * offset, open paths are returned unchanged.
   * @param {number} amount positive expands, negative shrinks.
   * @param {ClipperLib.JoinType} joinType optional path join type.
   * Default is `ClipperLib.JoinType.jtMiter`.
   * @param {ClipperLib.EndType} endType optional path end type.
   * Default is `ClipperLib.EndType.etClosedPolygon`.
   * @return {CutPaths} new geometry.
   * @memberof Clipper
   */
  offset(amount, joinType = ClipperLib.JoinType.jtMiter,
         endType = ClipperLib.EndType.etClosedPolygon) {

    const co = new ClipperLib.ClipperOffset(2, ARC_TOLERANCE);
    const open = [];
    for (const p of this) {
      if (p.isClosed)
        co.AddPath(p, joinType, endType);
      else
        open.push(p);
    }
    const offsetted = [];
    co.Execute(offsetted, amount);
    const res = new CutPaths(offsetted, true);
    for (const p of open)
      res.push(p);
    return res;
  }

  /**
   * Clip geometry. `this` will be clipped to "clipPaths".
   * @param {CutPaths} clipPaths clip paths (always treated as poly)
   * @param {ClipperLib.ClipType} clipType
   * @return {CutPaths} new geometry.
   * @private
   */
  clip(clipPaths, clipType) {
    assert(clipPaths instanceof CutPaths);
    const clipper = new ClipperLib.Clipper();
    clipper.AddPaths(this, ClipperLib.PolyType.ptSubject, true);
    clipper.AddPaths(clipPaths, ClipperLib.PolyType.ptClip, true);
    const newGeom = new ClipperLib.Paths();
    clipper.Execute(clipType, newGeom, ClipperLib.PolyFillType.pftEvenOdd,
                    ClipperLib.PolyFillType.pftEvenOdd);
    return new CutPaths(newGeom, true);
  }

  /**
   * Return union of Clipper geometries. Returns new geometry.
   * @param {CutPaths} paths2 second set of paths
   * @return {CutPaths} new geometry.
   */
  union(paths) {
    return this.clip(paths, ClipperLib.ClipType.ctUnion);
  }

  /**
   * Return difference between to Clipper geometries. Returns new geometry.
   * @param {CutPaths} paths second set of paths
   * @return {CutPaths} new geometry.
   */
  diff(paths) {
    return this.clip(paths, ClipperLib.ClipType.ctDifference);
  }

  /**
   * Return intersection between to Clipper geometries. Returns new geometry.
   * @param {CutPaths} paths second set of paths
   * @return {CutPaths} new geometry.
   */
  intersection(paths2) {
    return this.clip(paths2, ClipperLib.ClipType.ctIntersection);
  }

  /**
   * Return xor between to Clipper geometries. Returns new geometry.
   * @param {CutPaths} paths2 second set of paths
   * @return {CutPaths} new geometry.
   */
  xor(paths2) {
    return this.clip(paths2, ClipperLib.ClipType.ctXor);
  }

  /**
   * Simplify and clean up geometry.
   * @param {string} fillRule "nonzero" or "evenodd" (see SVG docs)
   * @return {CutPaths} cleaned up geometry
   * @memberof Clipper
   */
  simplifyAndClean(fillRule) {
    const cleanPaths = new CutPaths();
    for (const path of this) {
      if (path.isClosed) {
        // Remove vertices:
        // 1. that join co-linear edges, or join edges that are almost
        // co-linear (such that if the vertex was moved no more than the
        // specified distance the edges would be co-linear)
        // 2. that are within the specified distance of an adjacent vertex
        // 3. that are within the specified distance of a semi-adjacent
        // vertex together with their out-lying vertices
        const cleanPolys = ClipperLib.Clipper.CleanPolygon(
          path, CLEAN_POLY_DIST);
        // Remove self-intersections
        const fr = fillRule === "evenodd"
            ? ClipperLib.PolyFillType.pftEvenOdd
            : ClipperLib.PolyFillType.pftNonZero;
        const simplePolys = ClipperLib.Clipper.SimplifyPolygon(cleanPolys, fr);
        cleanPaths.push(new CutPath(simplePolys[0], true));
      } else {
        // Remove vertices that are within the specified distance of an
        // adjacent vertex.
        path.unduplicate();
        const clean = ClipperLib.JS.Clean(path, CLEAN_POLY_DIST);
        cleanPaths.push(new CutPath(clean, false));
      }
    }
    return cleanPaths;
  }

  /**
   * Does the line from p1 to p2 cut a poly?
   * @param {CutPoint} p1 line endpoint
   * @param {CutPoint} p2 line endpoint
   * @return {boolean} true if the line crossed an edge.
   * @memberof Clipper
   */
  crosses(p1, p2) {
    if (p1.X === p2.X && p1.Y === p2.Y) // 1D line, can't cross anything
      return false;
    const clipper = new ClipperLib.Clipper();
    clipper.AddPath([p1, p2], ClipperLib.PolyType.ptSubject, false);
    clipper.AddPaths(this, ClipperLib.PolyType.ptClip, true);
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
   * Find the closest point on this geometry to the given point
   * @param {CutPoint} point to test
   * @param {boolean} match must match isClosed
   * @return {object?} { path: number, point: number, dist2: number }
   */
  closestVertex(pt, match) {
    let best;
    for (let i = 0; i < this.length; ++i) {
      const path = this[i];
      if (path.isClosed === match) {
        let cp = path.closestVertex(pt);
        if (!cp) continue;
        if ((best && cp.dist2 < best.dist2) || !best) {
          best = cp;
          best.path = i;
        }
      }
    }
    return best;
  }

  /**
   * If a `within` object is given, the paths will be merged with
   * existing paths where a transition between the paths can be
   * completed without raising the tool. Where merging isn't possible,
   * the polys are sorted so that the tool moves are kept short.
   * This isn't a general solution to the problem of computing an
   * optimal tool path, that is NP-hard.
   * @param {CutPaths?} within merge closed polys if the shortest
   * joining edge won't cross these closed polys. This is used when
   * pocketing.
   */
  mergePaths(within) {
    assert(!within || within instanceof CutPaths);
    const cp = this.filter(p => p.isClosed);
    if (cp.length === this.length) {
      this.mergeClosedPaths(within);
      return; // all paths are closed?
    }
    if (cp.length === 0) {
      // cp is empty, so all paths must be open
      this.mergeOpenPaths();
      return;
    }
    // mix of open and closed paths
    cp.mergeClosedPaths(within);
    const op = this.filter(p => !p.isClosed);
    op.mergeOpenPaths();
    this.splice(0, this.length);
    while (cp.length > 0) this.push(cp.shift());
    while (op.length > 0) this.push(op.shift());
  }

  /**
   * Try to merge a set of paths paths by linking them with
   * an edge that doesn't cross the bounds. Paths are
   * considered in order, by looking for the shortest edge between the
   * last point on `path` to all points on all polys in `this`.
   * @param {CutPaths?} bounds the boundary paths
   * @private
   */
  mergeClosedPaths(bounds) {
    if (this.length < 2)
      return;

    // start with the first point on the first poly
    let currentPath = this[0];
    currentPath.push(currentPath[0]); // close it.
    let currentPoint = currentPath[currentPath.length - 1];
    // remove the first poly (why leave it?)
    this.shift();//[0] = new CutPath();

    const mergedPaths = [];
    while (this.length > 0) {
      // find the closest point on any of the remaining polys to the
      // current point
      const best = this.closestVertex(currentPoint, true);
      const closestPathIndex = best.path;
      const closestPointIndex = best.point;

      const path = this[closestPathIndex];
      this.splice(closestPathIndex, 1);

      // re-order the points on the closest path to bring the closest
      // point to the front
      path.makeLast(closestPathIndex);
      path.push(path[0]); // close the "new" path
      // Does the edge from the current point to the closest point cross
      // the bounds?
      if (bounds.crosses(currentPoint, path[0])) {
        // it crosses, need a new path
        mergedPaths.push(currentPath);
        currentPath = path;
        currentPoint = currentPath[currentPath.length - 1];
      }
      else { // doesn't cross, merge the two paths
        currentPath = currentPath.concat(path);
        currentPoint = currentPath[currentPath.length - 1];
      }
    }
    mergedPaths.push(currentPath);

    while (mergedPaths.length > 0)
      this.push(mergedPaths.shift());
  }

  /**
   * The only way to merge open paths is by connecting endpoints. An
   * open path could be merged into a closed path to make a new open
   * path, but that's not currently done.
   * @private
   */
  mergeOpenPaths() {
    let p1i = 0;
    while (p1i < this.length - 1) {
      let p1 = this[p1i];
      let p1a = p1[0], p1b = p1[p1.length - 1];
      let p2i = p1i + 1;
      while (p2i < this.length) {
        let p2 = this[p2i];
        let p2a = p2[0], p2b = p2[p2.length - 1];

        if (p1b.X === p2a.X && p1b.Y === p2b.Y) {
          this[p1i] = p1.concat(p2);
          this.splice(p2i, 1);
          p1b = p2b;
        } else if (p1a.X === p2b.X && p1a.Y === p2b.Y) {
          this[p1i] = p2.concat(p1);
          this.splice(p2i, 1);
          p1a = p2a;
        } else if (p1a.X === p2a.x && p1a.Y === p2a.Y) {
          this[p2i] = p2.reverse();
          const t = p2a;
          p2a = p2b;
          p2b = t;
        } else
          p2i++;
      }
    }
  }
}


/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global assert */
/* global ClipperLib */
ClipperLib.use_xyz = true;

import { UnitConverter } from "./UnitConverter.js";
import { CutPath } from "./CutPath.js";

/*
 * The distance parameter's default value is approximately √2 so that
 * a vertex will be removed when adjacent or semi-adjacent vertices
 * having their corresponding X and Y coordinates differing by no more
 * than 1 unit. However according to tests by the clipper-lib
 * developers, the best distance value to remove artifacts before
 * offsetting is 0.1 * scale.
 */
const CLEAN_POLY_DIST = 0.1 * UnitConverter.from.mm.to.integer;

/*
 * Remove path vertices closer than this.
 */
const CLEAN_PATH_DIST2 = CLEAN_POLY_DIST * CLEAN_POLY_DIST;

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
 * A list of `CutPath`. Cutpaths are treated as sets of disjoint polygons
 * and paths.
 */
export class CutPaths extends Array {

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
      return new ClipperLib.IntPoint(
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
        let i = 1;
        while (i < path.length) {
          const d2 = CutPath.dist2(path[i], path[i - 1]);
          if (d2 < CLEAN_PATH_DIST2)
            path.splice(i, 1);
          else
            i++;
        }
        const clean = ClipperLib.JS.Clean(path, CLEAN_POLY_DIST);
        cleanPaths.push(new CutPath(clean, false));
      }
    }
    return cleanPaths;
  }

  /**
   * Does the line from p1 to p2 cut a poly?
   * @param {ClipperLib.IntPoint} p1 line endpoint
   * @param {ClipperLib.IntPoint} p2 line endpoint
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
   * @param {ClipperLib.IntPoint} point to test
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
   * Add a set of paths to the current path set. The paths will be
   * joined to existing paths if possible. This is used where a
   * transition between paths can be completed without raising the
   * tool. Note: merged paths are never closed.
   * @param {CutPaths} paths paths to add
   * @param {CutPaths?} clip only add joining edge if it
   * doesn't cross this poly.
   */
  mergePaths(paths, clip) {
    assert(paths instanceof CutPaths);
    assert(!clip || clip instanceof CutPaths);
    for (const path of paths)
      this.mergePath(path, clip);
  }

  /**
   * Add a path to the current path set. The path will be
   * joined to an existing path if possible.
   * @param {CutPath} path paths to add
   * @param {CutPaths?} clip only add joining edge if it
   * doesn't cross this poly.
   * @private
   */
  mergePath(path, clip) {
    if (path.length === 0)
      return;

    if (path.isClosed)
      this.mergeClosedPath(path, clip);
    else
      this.mergeOpenPath(path);
  }

  /**
   * Try to merge the new path into existing paths by linking them with
   * an edge that doesn't cross the clip. Paths are
   * considered in order, by looking for the shortest edge between the
   * last point on `path` to all points on all polys in `this`. This is
   * expensive, try to avoid calling it with more than 2 polys.
   * @param {CutPath} path
   * @param {CutPaths?} clip
   * @private
   */
  mergeClosedPath(path, clip) {
    // The best merge is one that shares a common point
    let best;
    for (let i = 0; i < path.length; i++) {
      const pt = path[i];
      const cv = this.closestVertex(pt, path.isClosed);
      if (cv) {
        if (!best || cv.dist2 < best.dist2) {
          best = cv;
          cv.closest = i;
          // best.path = index of path in `this`
          // best.point = index of point in `best.path`
          // best.dist2 = best dist2 so far
          // best.closest = index of point in `path`
        }
      }
    }

    if (!best) {
      // Nothing to merge with
      this.push(path);
      return;
    }

    // best gives us the point of closest approach between the
    // two closed paths

    const p1 = path[best.closest];
    const path2 = this[best.path];
    const p2 = path2[best.point];
    const edgeIsCut = clip ? clip.crosses(p1, p2) : false;

    if (edgeIsCut) {
      this.unshift(path);
    } else {
      path2.makeLast(best.point);
      // Insert a closing vertex
      path2.unshift(path2[path2.length - 1]);
      let n = path.length + 1; // +1 to duplicate the closing vertex
      for (let vi = best.closest;
           n > 0;
           vi = (vi + 1) % path.length, n--)
        path2.push(path[vi]);
      path2.isClosed = false;
    }
  }

  /**
   * The only way to merge open paths is by connecting endpoints. An
   * open path could be merged into a closed path to make a new open
   * path, but that's not currently done.
   * @param {CutPath} path
   * @private
   */
  mergeOpenPath(path) {
    let a = path[0], b = path[path.length - 1];
    for (const tpath of this) {
      if (tpath.isClosed) {
        // can't merge into a closed path (yet)
      } else {
        // Connect endpoints
        const ta = tpath[0], tb = tpath[tpath.length - 1];
        if (a.X === ta.X && a.Y === ta.Y
            || b.X === tb.X && b.Y === tb.Y) {
          path = path.reverse();
          const t = b; b = a; a = t;
        }
        if (a.X === tb.X && a.Y === tb.Y) {
          // connect path start to tpath end
          for (const pt of path)
            tpath.push(pt);
          return;
        }
        if (b.X === ta.X && b.Y === ta.Y) {
          // connect path end to tpath start
          for (let i = path.length - 1; i >= 0; i--)
            tpath.unshift(path[i]);
          return;
        }
      }
    }
    // Couldn't connect endpoints
    this.push(path);
  }
}


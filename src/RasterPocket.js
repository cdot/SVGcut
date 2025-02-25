/*Copyright Crawford Currie 2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global assert */
/* global ClipperLib */
ClipperLib.use_xyz = true;
import * as Flatten from 'flatten-js';
import * as Partition from "./Partition.js";

import { CutPoint } from "./CutPoint.js";
import { CutPath } from "./CutPath.js";
import { CutPaths } from "./CutPaths.js";
import { ToolpathGenerator } from "./ToolpathGenerator.js";

/**
 * A pocket the is cleared using raster passes.
 * @extends ToolpathGenerator
 */
export class RasterPocket extends ToolpathGenerator {
  constructor() {
    super({ cutRate: true, direction: true, margin: true,
            passDepth: true, ramp: true, stepOver: true });
  }

  /**
   * @override
   */
  static worksOnPaths() { return "CLOSED"; }

  /**
   * Compute tool pocket using rasters.
   * @param {CutPath} pocket the pocket being resterised
   * @param {number} step the gap between rasters
   * @param {boolean} climb true for climb milling
   * @return {CutPath} rasters
   * @private
   */
  rasteriseConvexPocket(pocket, step, climb) {
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
   * @param {object} params named parameters
   * @param {number} params.cutterDiameter is in "integer" units
   * @param {number} params.overlap is in the range [0, 1)
   * @param {boolean} params.climb true for climb milling
   * @param {JoinType} params.joinType join type
   * @param {number} params.mitreLimit join mitre limit
   * @return {CutPaths} rasters
   * @override
   */
  generateToolpaths(geometry, params) {
    assert(geometry instanceof CutPaths);
    geometry = geometry.filter(p => p.isClosed);
    const toolPaths = new CutPaths();
    if (geometry.length === 0)
      return toolPaths;

    // Shrink first path by half the cutter diameter
    let off = -params.cutterDiameter / 2;
    // Add the margin
    if (params.margin !== 0)
      off -= -params.margin;

    let iPockets = geometry.offset(off, params);

    const step = params.cutterDiameter * (1 - params.overlap);

    for (let poly of iPockets) {
      if (!poly.isClosed)
        continue; // ignore this poly for rasterisation
      // Rasterise interior
      const pocket = new Flatten.Polygon(
        poly.map(pt => new Flatten.Point(pt.X, pt.Y)));
      const convexPockets = Partition.convex(pocket);
      let firstPoint;
      for (const convexPocket of convexPockets) {
        const rasters = this.rasteriseConvexPocket(convexPocket, step, params.climb);
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

    return toolPaths;
  }

  /**
   * @override
   */
  generatePreviewGeometry(geometry, params) {
    const w = params.width + (params.margin ?? 0);
    return geometry.offset(-w, params);
  }
}

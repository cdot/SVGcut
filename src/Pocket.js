/*Copyright Todd Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

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
 * A pocket that is cleared using either annular tool orbits, or
 * raster strips, according to the user-selected strategy.
 * @extends ToolpathGenerator
 */
export class Pocket extends ToolpathGenerator {

  constructor() {
    super({
      cutRate: true,
      direction: true,
      margin: true,
      passDepth: true,
      ramp: true,
      stepOver: true,
      strategy: true
    });
  }

  /**
   * @override
   */
  static worksOnPaths() { return "CLOSED"; }

  /**
   * Compute pocket tool paths. The pockets are cleared using annular passes,
   * starting from the outside and working towards the centre. Only works
   * on closed paths.
   * @private
   */
  annularToolpaths(geometry, params) {
    assert(geometry instanceof CutPaths);
    geometry = geometry.filter(p => p.isClosed);
    if (geometry.length === 0)
      return geometry;

    const vBit = (params.cutterAngle > 0 && params.cutterAngle < Math.PI / 2);

    // Shrink by half the cutter diameter plus the margin
    // to get the first orbit
    let off = params.cutterDiameter / 2;
    if (params.margin > 0)
      off += params.margin;
    let current = geometry.offset(-off, params);

    // take a copy of the shrunk pocket to clip against. Each time
    // the poly merges, there's a risk that an edge between the
    // outer poly and the inner poly might cross an edge of the
    // (non-convex) original poly, this is used to detect this.
    const clip = new CutPaths(current);

    // How much to shrink for each successive orbit
    let shrink = params.cutterDiameter * (1 - params.overlap);
    // How much to step the cutter down on each orbit (vBit only)
    let zStep = 0;
    this.generatesZ = vBit;
    if (vBit) {
      // If we have a vBit, can't shrink more than the cutter radius
      shrink = Math.min(params.cutterDiameter / 2, shrink);
      zStep = shrink / Math.tan(params.cutterAngle);
    }

    const toolPaths = new CutPaths();
    // Iterate, shrinking the pocket for each pass until the pocket
    // shrinks to 0
    let z = params.topZ;
    const innerPaths = [];
    while (current.length != 0) {
      if (vBit) {
        z -= zStep;
        current.Z(Math.max(z, -params.cutDepth), true);
      }
      for (const path of current)
        toolPaths.push(path);
      if (params.climb)
        // SMELL: why? Does offset reverse the path?
        for (let i = 0; i < current.length; ++i)
          current[i].reverse();
      current = current.offset(-shrink, params);
    }
    toolPaths.mergePaths(clip);
    return toolPaths;
  }

  /**
   * Compute tool pocket using rasters.
   * @param {CutPath} pocket the pocket being rasterised
   * @param {boolean} h true for horizontal rasters, false for vertical
   * @param {number} step the gap between rasters
   * @param {boolean} climb true for climb milling
   * @return {CutPath} rasters
   * @private
   */
  rasteriseConvexPocket(pocket, h, step, climb) {

    const bb = pocket.box;
    const rasters = (h ? bb.height: bb.width) / step;
    const axis = h ? "x" : "y";
    let level = (h ? bb.ymax : bb.xmax) - step; // row/col
    let stepway = -1;

    if (climb) {
      level = (h ? bb.ymin : bb.xmin) + step;
      stepway = 1;
    }

    let direction = 1;
    let path = new CutPath();
    let c = 0;
    while (c++ < rasters) {
      const ray = h
            ? new Flatten.Segment(bb.xmin - step, level, bb.xmax + step, level)
            : new Flatten.Segment(level, bb.ymin - step, level, bb.ymax + step);
      const intersections = ray.intersect(pocket);
      if (direction === 1)
        intersections.sort((a, b) => a[axis] - b[axis]);
      else
        intersections.sort((a, b) => b[axis] - a[axis]);
      let up = true;
      for (const intersection of intersections)
        path.push(new CutPoint(intersection.x, intersection.y));
      level += step * stepway;
      // boustrophedonically
      direction = -direction;
    }
    return path;
  }

  /**
   * Compute pocket-clearing rasters.
   * @private
   */
  rasterToolpaths(geometry, horz, params) {
    assert(geometry instanceof CutPaths);
    geometry = geometry.filter(p => p.isClosed);
    const toolPaths = new CutPaths();
    if (geometry.length === 0)
      return toolPaths;

    // Shrink first path by half the cutter diameter
    let off = -params.cutterDiameter / 2;
    // Add the margin
    if (params.margin !== 0)
      off -= params.margin;

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
        const rasters = this.rasteriseConvexPocket(
          convexPocket, horz, step, params.climb);
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
   * Compute tool pockets, using the selected strategy. Only works on
   * closed paths.
   * @param {CutPaths} geometry
   * @param {object} params named parameters
   * @param {string} params.strategy the dig strategy e.g. "FlatXRaster"
   * @param {number} params.cutterDiameter bit diameter
   * @param {number} params.cutterAngle bit angle (radians)
   * @param {number} params.cutDepth maximum cut depth
   * @param {number} params.topZ top of the material
   * @param {number} params.overlap is in the range [0, 1)
   * @param {boolean} params.climb true for climb milling
   * @param {JoinType} params.joinType join type
   * @param {number} params.mitreLimit join mitre limit
   * @return {CutPaths} rasters
   * @override
   */
  generateToolpaths(geometry, params) {
    assert(typeof params.strategy === "string");
    assert(typeof params.cutterDiameter === "number");
    assert(typeof params.cutterAngle === "number");
    assert(typeof params.cutDepth === "number");
    assert(typeof params.topZ === "number");
    assert(typeof params.overlap === "number");
    assert(typeof params.climb === "boolean");
    assert(typeof params.joinType === "number");
    assert(typeof params.mitreLimit === "number");
    switch (params.strategy) {
    case "XRaster":
      return this.rasterToolpaths(geometry, true, params);
    case "YRaster":
      return this.rasterToolpaths(geometry, false, params);
    case "Annular":
      return this.annularToolpaths(geometry, params);
    default:
      assert(false, params.strategy);
      return geometry;
    }
  }
}

/*Copyright Todd Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global assert */
/* global ClipperLib */
ClipperLib.use_xyz = true;

import { CutPoint } from "./CutPoint.js";
import { CutPath } from "./CutPath.js";
import { CutPaths } from "./CutPaths.js";
import { ToolpathGenerator } from "./ToolpathGenerator.js";

/**
 * Engrave a simple path
 * @extends ToolpathGenerator
 */
export class Engrave extends ToolpathGenerator {

  constructor() {
    super({
      cutRate: true, direction: true, passDepth: true, ramp: true,
      offset: true, margin: true, width: true, stepOver: true,
      climb: true });
  }

  /**
   * @override
   */
  static worksOnPaths() { return "ALL"; }

  /**
   * Compute tool path.
   * @param {CutPaths} geometry
   * @param {object} params named parameters
   * @param {string} params.offset whether to cut On, Inside, or Outside
   * @param {number} params.cutterDiameter is in "integer" units
   * @param {number} params.width desired path width (may be wider than the
   * cutter)
   * @param {number} params.overlap is in the range [0, 1)
   * @param {boolean} params.climb true for climb milling
   * @param {JoinType} params.joinType join type
   * @param {number} params.mitreLimit join mitre limit
   * @return {CutPaths}
   * @private
   */
  generateToolpaths(geometry, params) {
    assert(geometry instanceof CutPaths);
    assert(typeof params.offset === "string");
    assert(typeof params.cutterDiameter === "number");
    assert(typeof params.overlap === "number");
    assert(typeof params.width === "number");
    assert(typeof params.margin === "number");
    if (geometry.length === 0)
      return geometry;

    let clipPoly, step = 1;
    if (params.offset === "On") {
      // "On" always follows the geometry. width and margin are ignored.
      // TODO: support .width
    } else {
      const clipA = params.margin + params.cutterDiameter / 2;
      const clipB = params.margin + params.width - params.cutterDiameter / 2;
      if (params.offset === "Inside")
        step = -1;
      if (clipB !== clipA) {
        clipPoly = geometry
        .offset(step * clipA, params)
        .difference(geometry.offset(step * clipB, params));
      }
      geometry = geometry.offset(step * clipA, params);
    }

    let currentWidth = params.cutterDiameter;
    let passWidth = params.cutterDiameter * (1 - params.overlap);

    const toolPaths = new CutPaths();
    while (currentWidth <= params.width) {
      if (params.climb)
        for (let i = 0; i < geometry.length; ++i)
          geometry[i].reverse();
      toolPaths.push(...geometry);
      if (currentWidth + passWidth > params.width)
        passWidth = params.width - currentWidth;
      if (passWidth <= 0)
        break;
      currentWidth += passWidth;
      geometry = geometry.offset(step * passWidth, params);
    }
    toolPaths.mergePaths(clipPoly);
    return toolPaths;
  }

  /**
   * @override
   */
  bbBloat(toolPathWidth) {
    return toolPathWidth;
  }

  /**
   * Generate preview geometry for the paths.
   * @param {CutPaths} geometry
   * @param {object} params named parameters
   * @param {number} params.width desired path width (will be at least
   * the cutter width)
   * @param {JoinType} params.joinType join type for offsetting
   * @param {number} params.mitreLimit join mitre limit for offsetting
   * @param {number?} params.margin margin
   * @override
   */
  generatePreviewGeometry(geometry, params) {
    return geometry.offset(params.width / 2, params)
    .difference(geometry.offset(-params.width / 2, params));
  }
}

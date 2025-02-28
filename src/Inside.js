/*Copyright Crawford Currie 2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global assert */
/* global ClipperLib */
ClipperLib.use_xyz = true;

import { CutPoint } from "./CutPoint.js";
import { CutPath } from "./CutPath.js";
import { CutPaths } from "./CutPaths.js";
import { ToolpathGenerator } from "./ToolpathGenerator.js";

/**
 * Cut a line inside the geometry.
 * @extends ToolpathGenerator
 */
export class Inside extends ToolpathGenerator {
  constructor() {
    super({ cutRate: true, direction: true, margin: true, passDepth: true,
            ramp: true, width: true, stepOver: true });
  }

  /**
   * @override
   */
  static worksOnPaths() { return "CLOSED"; }

  /**
   * Compute inside tool path.
   * @param {CutPaths} geometry
   * @param {object} params named parameters
   * @param {number} params.cutterDiameter is in "integer" units
   * @param {number} params.width desired path width (may be wider than the
   * cutter)
   * @param {number} params.overlap is in the range [0, 1)
   * @param {boolean} params.climb true for climb milling
   * @param {JoinType} params.joinType join type
   * @param {number} params.mitreLimit join mitre limit
   * @return {CutPaths}
   * @override
   */
  generateToolpaths(geometry, params) {
    assert(geometry instanceof CutPaths);
    geometry = geometry.filter(p => p.isClosed);
    if (geometry.length === 0)
      return new CutPaths();
    const off = -params.cutterDiameter / 2 - (params.margin ?? 0);
    const current = geometry.offset(off, params);
    params.clipPoly = geometry.difference(
        geometry.offset(-(params.width - params.cutterDiameter / 2), params));
    params.step = -1;
    params.needReverse = params.climb;

    return this.outline(current, params);
  }
}

/*Copyright Todd Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global assert */
/* global ClipperLib */
ClipperLib.use_xyz = true;

import { CutPoint } from "./CutPoint.js";
import { CutPath } from "./CutPath.js";
import { CutPaths } from "./CutPaths.js";
import { ToolpathGenerator } from "./ToolpathGenerator.js";

/**
 * A pocket that is cleared using annular tool orbits.
 * @extends ToolpathGenerator
 */
export class AnnularPocket extends ToolpathGenerator {

  constructor() {
    super({
      cutRate: true,
      direction: true,
      margin: true,
      passDepth: true,
      ramp: true,
      stepOver: true
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
   * @param {CutPaths} geometry the geometry to compute for
   * @param {object} params named parameters
   * @param {number} params.cutterDiameter in "integer" units
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
      return geometry;

    // Shrink by half the cutter diameter
    let off = -params.cutterDiameter / 2;

    // Add margin
    if (params.margin !== 0)
      off -= params.margin;

    let current = geometry.offset(off, params);

    // take a copy of the shrunk pocket to check against. Each time
    // the poly merges, there's a risk that an edge between the
    // outer poly and the inner poly might cross an edge of the
    // (non-convex) original poly, this is used to detect this.
    const outer = new CutPaths(current);

    const toolPaths = new CutPaths();
    // Iterate, shrinking the pocket for each pass
    let n = 1;
    const innerPaths = [];
    while (current.length != 0) {
      for (const p of current)
        toolPaths.push(p);
      if (params.climb)
        for (let i = 0; i < current.length; ++i)
          current[i].reverse();
      current = current.offset(
        -params.cutterDiameter * (1 - params.overlap), params);
    }
    toolPaths.mergePaths(outer);
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

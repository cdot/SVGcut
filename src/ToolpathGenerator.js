/*Copyright Crawford Currie 2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global assert */
/* global ClipperLib */
ClipperLib.use_xyz = true;

import { CutPoint } from "./CutPoint.js";
import { CutPath } from "./CutPath.js";
import { CutPaths } from "./CutPaths.js";

/**
 * Base class of all toolpath/preview geometry generators.
 */
export class ToolpathGenerator {

  /**
   * @param {Object.<string,boolean>} needs list of UI options needed
   * by this generator.
   */
  constructor(needs) {

    /**
     * List of options needed by this generator.
     * @member {Object.<string,boolean>}
     */
    this.needs = needs ?? {};

    /**
     * True if the operator precalculates Z coordinates on generated
     * paths.
     * @member {boolean}
     */
    this.generatesZ = false;
  }

  /**
   * Whether the generator works on all paths, or only on closed
   * or open paths.
   * @return {string} "ALL", "CLOSED", "OPEN"
   */
  static worksOnPaths() { return "ALL"; }

  /**
   * Generate path step to create a hole
   * @param {CutPoint} pt where to drill the hole
   * @param {number} safeZ is above the top of the hole
   * @param {number} botZ is the bottom of the hole
   * @return {CutPath}
   * @protected
   */
  drillHole(pt, safeZ, botZ) {
    return new CutPath([
      { X: pt.X, Y: pt.Y, Z: safeZ },
      { X: pt.X, Y: pt.Y, Z: botZ },
      { X: pt.X, Y: pt.Y, Z: safeZ }
    ], false);
  }

  /**
   * Compute outline tool path.
   * @param {CutPaths} geometry
   * @param {object} params named parameters. All the parameters
   * of generateToolpaths, plus:
   * @param {boolean} params.needReverse
   * @param {number} params.step
   * @param {CutPaths} params.clipPoly
   * @return {CutPaths}
   * @protected
   */
  outline(geometry, params) {
    let currentWidth = params.cutterDiameter;
    const eachWidth = params.cutterDiameter * (1 - params.overlap);

    const toolPaths = new CutPaths();
    while (currentWidth <= params.width) {
      toolPaths.push(...geometry);
      let i;
      if (params.needReverse)
        for (i = 0; i < geometry.length; ++i)
          geometry[i].reverse();
      const nextWidth = currentWidth + eachWidth;
      if (nextWidth > params.width && params.width - currentWidth > 0) {
        geometry = geometry.offset(params.width - currentWidth, params);
        if (params.needReverse)
          for (i = 0; i < geometry.length; ++i)
            geometry[i].reverse();
        break;
      }
      currentWidth = nextWidth;
      geometry = geometry.offset(params.step * eachWidth, params);
    }
    toolPaths.mergePaths(params.clipPoly);
    return toolPaths;
  }

  /**
   * Subclasses must override. All input measurements are in "integer" units.
   * @param {CutPaths} geometry input geometry
   * @param {object} params named parameters. Not all are used by all
   * operations.
   * @param {number} params.cutterDiameter diameter of thickest part of cutter.
   * @param {number} params.cutterAngle angle (radians) of cutter edge
   * from axis of rotation
   * @param {number} params.width desired path width (may be wider than the
   * cutter)
   * @param {number} params.spacing is the gap to leave between perforations
   * @param {number} params.overlap is in the range [0, 1)
   * @param {boolean} params.climb true for climb milling
   * @param {JoinType} params.joinType join type
   * @param {number} params.safeZ is the Z to which the tool is withdrawn
   * @param {number} params.botZ is the depth of drill holes
   * @param {JoinType} params.joinType edge join type
   * @param {number} params.mitreLimit join mitre limit
   */
  generateToolpaths(geometry, params) {
    assert(false, "Pure virtual");
  }

  /**
   * Extra space required in a bounding box outside of the basic
   * operand paths.
   * @return {number} in "integer" units
   */
  bbBloat(toolPathWidth) {
    return 0;
  }

  /**
   * Generate preview geometry for the paths.
   * @param {CutPaths} geometry
   * @param {object} params named parameters
   * @param {number} params.width desired path width (will be at least
   * the cutter width)
   * @param {JoinType} params.joinType join type for offsetting
   * @param {number} params.mitreLimit join mitre limit for offsetting
   * @param {number?} params.margin margin, for those that use it
   */
  generatePreviewGeometry(geometry, params) {
    return geometry.offset(params.cutterDiameter / 2, params)
    .difference(geometry.offset(-params.cutterDiameter / 2, params));
  }
}

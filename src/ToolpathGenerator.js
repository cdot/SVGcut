/*Copyright Crawford Currie 2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global assert */
/* global ClipperLib */
ClipperLib.use_xyz = true;

import { CutPoint } from "./CutPoint.js";
import { CutPath } from "./CutPath.js";
import { CutPaths } from "./CutPaths.js";
import { UnitConverter } from "./UnitConverter.js";

// Delta angle (rad) for generating hole preview
const HOLE_DTHETA = Math.PI / 8;

/**
 * Base class of all toolpath/preview geometry generators.
 */
export class ToolpathGenerator {

// A small scaling that brings values within the maximum resolution
  static FP_TOLERANCE = 1 - 1 / UnitConverter.from.mm.to.integer;

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
   * @param {object} params named parameters
   * @param {number} params.safeZ is above the top of the hole
   * @param {number} params.botZ is the bottom of the hole
   * @return {CutPath}
   * @protected
   */
  drillHole(pt, params) {
    return new CutPath([
      { X: pt.X, Y: pt.Y, Z: params.safeZ },
      { X: pt.X, Y: pt.Y, Z: params.botZ },
      { X: pt.X, Y: pt.Y, Z: params.safeZ }
    ], false);
  }

  /**
   * Generate preview geometry for a drill hole.
   * @param {CutPoint} pt where to drill the hole
   * @param {object} params named parameters
   * @param {number} cutterDiameter diameter to cutter tip
   * @return {CutPath} a closed path
   */
  previewHole(pt, params) {
    const hole = new CutPath();
    const r = params.cutterDiameter / 2;
    for (let theta = 0; theta < 2 * Math.PI; theta += HOLE_DTHETA) {
      const dx = r * Math.cos(theta);
      const dy = r * Math.sin(theta);
      hole.push(new CutPoint(pt.X + dx, pt.Y + dy));
    }
    hole.isClosed = true;
    return hole;
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
   * @param {number} params.cutterDiameter is in "integer" units
   * @param {JoinType} params.joinType join type for offsetting
   * @param {number} params.mitreLimit join mitre limit for offsetting
   * @param {number?} params.margin margin, for those that use it
   */
  generatePreviewGeometry(geometry, params) {
    return geometry.offset(params.cutterDiameter / 2, params)
    .difference(geometry.offset(-params.cutterDiameter / 2, params));
  }
}

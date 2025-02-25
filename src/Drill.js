/*Copyright Crawford Currie 2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global assert */
/* global ClipperLib */
ClipperLib.use_xyz = true;

import { CutPath } from "./CutPath.js";
import { CutPaths } from "./CutPaths.js";
import { ToolpathGenerator } from "./ToolpathGenerator.js";

/**
 * Drill holes at the vertices of path.
 * @extends ToolpathGenerator
 */
export class Drill extends ToolpathGenerator {

  constructor() {
    super();
    this.generatesZ = true;
  }

  /**
   * @override
   */
  static worksOnPaths() { return "ALL"; }

  /**
   * Compute a drill path. This is a path where each vertex is a site
   * for a drill hole. The holes are drilled in the order of the edges.
   * Works on both open and closed paths.
   * @param {CutPaths} geometry
   * @param {object} params named parameters
   * @param {number} params.safeZ is the Z to which the tool is withdrawn
   * @param {number} params.botZ is the depth of the perforations
   * @return {CutPaths}
   * @override
   */
  generateToolpaths(geometry, params) {
    const drillPath = new CutPath();
    for (const path of geometry) {
      for (const hole of path) {
        drillPath.push(...this.drillHole(hole, params.safeZ, params.botZ));
      }
    }
    return new CutPaths(drillPath);
  }

  /**
   * @override
   */
  bbBloat(toolPathWidth) {
    return toolPathWidth / 2;
  }

  /**
   * @override
   */
  generatePreviewGeometry(geometry, params) {
    return geometry.offset(params.width, params).diff(geometry);
  }
}

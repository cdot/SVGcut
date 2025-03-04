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
    super({ cutRate: true, direction: true, passDepth: true, ramp: true });
  }

  /**
   * @override
   */
  static worksOnPaths() { return "ALL"; }

  /**
   * Compute paths for engraving. This simply generates a tool path
   * that follows the outline of the geometry, regardless of the tool
   * diameter. Works on both open and closed paths.
   * @param {CutPaths} geometry the engraving
   * @param {object} params named parameters
   * @param {boolean} params.climb true for climb milling; not that it
   * should make any difference!
   * @return {CutPaths}
   * @override
   */
  generateToolpaths(geometry, params) {
    assert(geometry instanceof CutPaths);
    const toolPaths = new CutPaths();
    for (const path of geometry) {
      const copy = new CutPath(path); // take a copy
      if (!params.climb)
        copy.reverse();
      toolPaths.push(copy);
    }
    //toolPaths.mergePaths(geometry);
    return toolPaths;
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
    // A band half the cutter diameter either side of the cut path
    const w = params.cutterDiameter / 2;
    return geometry.offset(w, params).difference(geometry.offset(-w, params));
  }
}

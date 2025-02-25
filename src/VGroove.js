/*Copyright Crawford Currie 2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global assert */
/* global ClipperLib */
ClipperLib.use_xyz = true;

import { CutPoint } from "./CutPoint.js";
import { CutPath } from "./CutPath.js";
import { CutPaths } from "./CutPaths.js";
import { ToolpathGenerator } from "./ToolpathGenerator.js";

/**
 * Cut a V-shaped groove following the path. The size of the goove
 * is dictated by the angle of the cutter, and the maximum depth of
 * the cut.
 * @extends ToolpathGenerator
 */
export class VGroove extends ToolpathGenerator {
  constructor() {
    super({ cutRate: true, direction: true, passDepth: true,
            width: true, stepOver: true });
  }

  /**
   * @override
   */
  static worksOnPaths() { return "ALL"; }

  /**
   * @override
   */
  generateToolpaths(geometry, params) {
    return geometry;
  }

  /**
   * @override
   */
  generatePreviewGeometry(geometry, params) {
    return geometry;
  }
}

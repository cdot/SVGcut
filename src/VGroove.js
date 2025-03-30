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
   * @param {CutPaths} geometry input geometry
   * @param {object} params named parameters. Not all are used by all
   * operations.
   * @param {number} params.cutterDiameter diameter of thickest part of cutter
   * in "integer" units
   * @param {number} params.cutterAngle angle of cutter edge from axis of
   * rotation
   * @param {number} params.width desired path width (may be wider than the
   * cutter)
   * @param {number} params.overlap is in the range [0, 1)
   * @param {boolean} params.climb true for climb milling
   * @override
   */
  generateToolpaths(geometry, params) {
    /**
     * Don't exceed the path width
     * Cut to the target depth
     * Just like outline, except it's centred on the path
     */
    assert(geometry instanceof CutPaths);

    // An open path can be closed by backtracking it
    const w = params.width;
    params.clipPoly = geometry
    .offset(w / 2, params)
    .difference(geometry.offset(-w / 2, params));

    // This has to be done in layers. Can I use pocket?
    const off = 0;
    const current = geometry.offset(off, params);
    params.step = -1;
    params.needReverse = params.climb;

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
   * @override
   */
  generatePreviewGeometry(geometry, params) {
    const w = params.width;
    return geometry
    .offset(w / 2, params)
    .difference(geometry.offset(-w / 2, params));
  }
}

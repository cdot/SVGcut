/*Copyright Crawford Currie 2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global assert */
/* global ClipperLib */
ClipperLib.use_xyz = true;

import { CutPoint } from "./CutPoint.js";
import { CutPath } from "./CutPath.js";
import { CutPaths } from "./CutPaths.js";
import { ToolpathGenerator } from "./ToolpathGenerator.js";

/**
 * Drill al ine of perforations along the path (or outside it, in the case
 * of a closed geometry).
 * @extends ToolpathGenerator
 */
export class Perforate extends ToolpathGenerator {

  constructor() {
    super({ spacing: true });
    this.generatesZ = true;
  }

  /**
   * @override
   */
  static worksOnPaths() { return "ALL"; }

  /**
   * Calculate perforations along a path.
   * @param {CutPath} path
   * @param {object} params named parameters
   * @param {number} params.cutterDiameter in "integer" units
   * @param {number} params.spacing is the gap to leave between perforations
   * @param {number} params.safeZ is the Z to which the tool is withdrawn
   * @param {number} params.botZ is the depth of the perforations
   * @return {CutPath}
   * @private
   */
  perforatePath(path, params) {
    assert(path instanceof CutPath);

    // Measure the path
    let totalPathLength = path.perimeter();

    if (path.isClosed)
      path.push(path[0]); // duplicate first vertex

    // Work out number of holes, and step between them, allowing spacing
    // between adjacent holes
    const numHoles = Math.floor(
      totalPathLength / (params.cutterDiameter + params.spacing));
    const step = totalPathLength / (numHoles - 1);
    // Walk round the path stopping at every hole, generating a new path
    let newPath = new CutPath();
    let gap = 0; // distance along the path from the last hole;
    let segi = 1; // index of end of current segment
    // Start of the current segment
    let segStart = path[0], segEnd = path[1];
    // dimensions of the current segment
    let dx = segEnd.X - segStart.X, dy = segEnd.Y - segStart.Y;
    // Length of the current segment
    let segLen = Math.sqrt(dx * dx + dy * dy);
    // Unit vector for the current segment
    let segVec = new CutPoint(dx / segLen, dy / segLen);
    while (segi < path.length) {
      // Place a hole here
      //console.debug(`Hole at ${segStart.X},${segStart.Y}`);
      newPath.push(...this.drillHole(segStart, params.safeZ, params.botZ));
      gap = 0;
      while (gap + segLen < step) {
        if (++segi === path.length)
          break; // no more segments, we're done
        // Remaining segment isn't long enough for another hole.
        // Walk the path until we get to the segment that it's in.
        segStart = segEnd;
        segEnd = path[segi];
        dx = segEnd.X - segStart.X, dy = segEnd.Y - segStart.Y;
        segLen = Math.sqrt(dx * dx + dy * dy);
        segVec = { X: dx / segLen, Y : dy / segLen };
        if (gap + segLen > step)
          // hole is on this segment.
          break;
        gap += segLen;
      }
      // Next hole is on this segment. Move segStart up to the hole.
      const where = step - gap;
      segStart = new CutPoint(segStart.X + segVec.X * where,
                              segStart.Y + segVec.Y * where);
      segLen -= where;
      gap += where;
    }
    if (path.isClosed)
      path.pop(); // remove pseudo-vertex

    return newPath;
  }

  /**
   * Compute perforation tool path. This is an outline path, but it
   * has a vertex at every tool diameter step along the path. Gcode generation
   * will convert those vertices to drill holes. Works on both open and closed
   * paths; closed paths the tool will follow outside the path, open paths the
   * tool will follow the path.
   * @param {CutPaths} geometry
   * @param {object} params named parameters
   * @param {number} params.cutterDiameter in "integer" units
   * @param {number} params.spacing is the gap to leave between perforations
   * @param {number} params.topZ is the Z to which the tool is withdrawn
   * @param {number} params.botZ is the depth of the perforations
   * @return {CutPaths}
   * @override
   */
  generateToolpaths(geometry, params) {
    assert(geometry instanceof CutPaths);
    const toolPaths = new CutPaths();

    // Bloat the closed paths by half the cutter diameter
    const bloated = new CutPaths();
    for (const path of geometry) {
      if (path.isClosed) {
        params.joinType ??= ClipperLib.JoinType.jtRound;
        const bloated = new CutPaths(path)
              .offset(params.cutterDiameter / 2, params)[0];
        const ring = this.perforatePath(bloated, params);
        toolPaths.push(ring);
      } else { // just follow open paths
        toolPaths.push(this.perforatePath(path, params));
      }
    }

    return toolPaths;
  }

  /**
   * @override
   */
  bbBloat(toolPathWidth) {
    // When the geometry is closed, this is excessive
    return toolPathWidth;
  }

  /**
   * @override
   */
  generatePreviewGeometry(geometry, params) {
    // When the geometry is closed, this is excessive
    return geometry.offset(params.width, params).difference(geometry);
  }
}

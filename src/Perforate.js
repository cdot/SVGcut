/*Copyright Crawford Currie 2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global assert */
/* global ClipperLib */
ClipperLib.use_xyz = true;

import { CutPoint } from "./CutPoint.js";
import { CutPath } from "./CutPath.js";
import { CutPaths } from "./CutPaths.js";
import { ToolpathGenerator } from "./ToolpathGenerator.js";

/**
 * Drill a line of perforations along the path (or outside it, in the case
 * of a closed geometry).
 * @extends ToolpathGenerator
 */
export class Perforate extends ToolpathGenerator {

  constructor() {
    super({ spacing: true, offset: true });
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
   * @return {CutPath} a path where each vertex is a drill hole position
   * @private
   */
  perforatedPath(path, params) {
    assert(path instanceof CutPath);
    assert(params.spacing >= 0);
    assert(params.cutterDiameter > 0);

    // Normalise the vector between p1 and p2 and return the vector and len
    function normalise(p1, p2) {
      const dx = p2.X - p1.X, dy = p2.Y - p1.Y;
      const len = Math.sqrt(dx * dx + dy * dy);
      return [ { X: dx / len, Y: dy / len }, len ];
    }

    // Measure the path
    let totalPathLength = path.perimeter();

    if (totalPathLength === 0)
      return path;

    // Work out number of holes, and step between them, allowing spacing
    // between adjacent holes
    const numSteps = Math.ceil(
      totalPathLength / (params.cutterDiameter + params.spacing));
    const step = totalPathLength / numSteps;

    if (path.isClosed)
      path.push(path[0]); // duplicate first vertex

    // Walk round the path stopping at every hole, generating a new path
    let newPath = new CutPath();
    let distFromLastHole = 0; // distance along the path from the last hole;
    let segIndex = 1; // index of end of current segment
    let lastHole = path[0]; // Where the last hole was drilled
    let segEnd = path[1]; // end of current segment
    // Normal vector of the current segment, and remaining length
    // after distFromLastHole
    let [ segVec, segRem ] = normalise(lastHole, segEnd);
    while (segIndex < path.length) {
      // Place a hole here
      //console.debug(`Hole at ${lastHole.X},${lastHole.Y}`);
      newPath.push(new CutPoint(lastHole.X, lastHole.Y));
      distFromLastHole = 0;
      while (distFromLastHole + segRem <
             step * ToolpathGenerator.FP_TOLERANCE) {
        // FP_TOLERANCE to defeat floating point error.
        if (++segIndex === path.length)
          break; // no more segments, we're done
        // Remaining segment isn't long enough for another hole.
        // Walk the path until we get to the segment that it's in.
        lastHole = segEnd;
        segEnd = path[segIndex];
        [ segVec, segRem ] = normalise(lastHole, segEnd);
        if (distFromLastHole + segRem > step)
          // hole is on this segment.
          break;
        distFromLastHole += segRem;
      }
      // Next hole is on this segment. Move lastHole up to the hole.
      const where = step - distFromLastHole;
      lastHole = new CutPoint(lastHole.X + segVec.X * where,
                              lastHole.Y + segVec.Y * where);
      segRem -= where;
      distFromLastHole += where;
    }
    if (path.isClosed) {
      newPath.pop();
      path.pop(); // remove pseudo-vertex
    }

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
   * @param {string} params.offset whether to cut On, Inside, or Outside
   * @param {number} params.spacing is the gap to leave between perforations
   * @param {number} params.topZ is the Z to which the tool is withdrawn
   * @param {number} params.safeZ is the Z to which the tool is withdrawn
   * @param {number} params.botZ is the depth of the perforations
   * @return {CutPaths}
   * @override
   */
  generateToolpaths(geometry, params) {
    assert(geometry instanceof CutPaths);
    const toolPath = new CutPath();

    const bloated = new CutPaths();
    for (const path of geometry) {
      let vertexPath = path;
      if (path.isClosed) {
        if (params.offset === "Outside") {
          // Bloat the closed paths by half the cutter diameter
          params.joinType ??= ClipperLib.JoinType.jtRound;
          vertexPath = new CutPaths(path)
          .offset(params.cutterDiameter / 2, params)[0];
        } else if (params.offset === "Inside") {
          params.joinType ??= ClipperLib.JoinType.jtMiter;
          vertexPath = new CutPaths(path)
          .offset(-params.cutterDiameter / 2, params)[0];
        }
      }
      const ring = this.perforatedPath(vertexPath, params);
      for (const vertex of ring)
        toolPath.push(...this.drillHole(vertex, params));
    }

    return new CutPaths([ toolPath ], false);
  }

  /**
   * @override
   */
  bbBloat(toolPathWidth) {
    // When the geometry is closed, this is excessive. But it's OK
    // as an approximation for bounding box computation.
    return toolPathWidth;
  }

  /**
   * @override
   */
  generatePreviewGeometry(toolPaths, params) {
    const holes = new CutPaths();
    for (const path of toolPaths) {
      // A drill hole has 3 vertices, and a perforated path is a
      // string of drill holes
      for (let i = 0; i < path.length; i += 3)
        holes.push(this.previewHole(path[i], params));
    }
    return holes;
  }
}

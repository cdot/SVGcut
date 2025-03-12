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
    function measure(p1, p2) {
      const dx = p2.X - p1.X, dy = p2.Y - p1.Y;
      const len = Math.sqrt(dx * dx + dy * dy);
      return [ { X: dx / len, Y: dy / len }, len ];
    }

    // Measure the path
    let totalPathLength = path.perimeter();
    if (totalPathLength < params.cutterDiameter + params.spacing)
      return path;

    // Work out number of holes, and step between them, allowing spacing
    // between adjacent holes
    const numHoles = Math.ceil(
      totalPathLength / (params.cutterDiameter + params.spacing));
    const holeSpacing = totalPathLength / numHoles;
    //console.debug("perim", totalPathLength, "nh",numHoles,"hs",holeSpacing);

    // Walk round the path stopping at every hole, generating a new path
    let newPath = new CutPath();
    let distFromLastHole = 0; // distance along the path from the last hole
    // (or the first vertex)
    let segIndex = 0; // index of end of current segment
    let segStart = path[segIndex++]; // start of current segment
    let segEnd = path[segIndex++]; // end of current segment
    let distfromLastHole = 0;
    let segVec, segLength;
    newPath.push(new CutPoint(segStart.X, segStart.Y));
    while (newPath.length < numHoles) {
      [ segVec, segLength ] = measure(segStart, segEnd);
      //console.debug("seg",segStart, segEnd, segVec, segLength);
      let remainLength = segLength;
      while (distfromLastHole + remainLength >= holeSpacing) {
        const excessLength = distfromLastHole + remainLength - holeSpacing;
        const t = segLength - excessLength;
        const hole = new CutPoint(
          segStart.X + t * segVec.X, segStart.Y + t * segVec.Y);
        //console.debug("Hole",hole);
        newPath.push(hole);
        remainLength = excessLength;
        distfromLastHole = 0;
      }
      if (!path.isClosed && segIndex === path.length)
        break;
      distfromLastHole += remainLength;
      segStart = segEnd;
      segEnd = path[segIndex++ % path.length];
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

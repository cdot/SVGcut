/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */
/* global assert */

/* global App */

import * as Cam from "./Cam.js";
import { CutPath } from "./CutPath.js";
import { CutPaths } from "./CutPaths.js";

/**
 * Gcode parsing an generation.
 * @namespace Gcode
 */

/**
 * @typedef {object} CNCPoint
 * @property {number} x X coordinate
 * @property {number} y Y coordinate
 * @property {number} z Z coordinate
 * @property {number} f feed rate
 * @memberof Gcode
 */

/**
 * Parse a block of linux-CNC gcode to a path. Only simple G-codes
 * (G0, G1) are interpreted, and only X, Y, Z and F. Polar coordinates
 * are not supported.
 *
 * *WARNING* feed rate (F) is assumed to be specified in units-per-minute.
 * G93-G71 will be ignored.
 *
 * @see {@link https://linuxcnc.org/docs/stable/html/nb/gcode/overview.html}
 * @param {string|string[]} gcode the gcode to parse, either a single string
 * containing \n separated code lines, or an array of lines.
 * @return {CNCPoint[]} path in machine units (no scaling is performed).
 * @memberof Gcode
 */
export function parse(gcode) {
  const path = [];
  const lines = Array.isArray(gcode) ? gcode : gcode.split(/\r?\n/);
  let lineNo = 0;
  let last = { x: NaN, y: NaN, z: NaN, f: NaN };
  let terminated = false, percents = 0;
  for (const l of lines) {
    if (terminated) // terminated by M2 or M30?
      break;
    lineNo++;

    const line = l.replace(/\(.*?\)/g, "") // embedded remarks
          .replace(/;.*$/, "") // end of code line
          .replace(/^\s*(.*?)\s*$/, "$1"); // trim

    if (line.length === 0
       || line[0] === "/") // block delete
      continue;

    if (line === '%') { // program begin/end
      // "Demarcating a file with percents is optional if the file
      // has an M2 or M30 in it, but is required if not. An error
      // will be signaled if a file has a percent line at the
      // beginning but not at the end. The useful contents of a file
      // demarcated by percents stop after the second percent
      // line. Anything after that is ignored."
      if (++percents === 2)
        break;
      continue;
    }

    const re = /(\S)\s*([-+]?[\d.]+)/g;
    let m, pending, parsingLine = true;
    while (parsingLine && (m = re.exec(line))) {
      const code = m[1].toLowerCase(), value = Number(m[2]);
      switch (code) {
      case 'g':
        if (pending) {
          path.push(pending);
          last = pending;
        }
        switch (value) {
        case 0: case 1:
          pending = { x: last.x, y: last.y, z: last.z, f: last.f }; break;
        default:
          //console.debug(`Gcode:${lineNo} ignored g${value}`);
          pending = undefined;
        }
        break;

      case 'f': // feed rate
      case 'x': // X axis of machine
      case 'y': // Y axis of machine
      case 'z': // Z axis of machine
        if (pending)
          pending[code] = value;
        else
          console.debug(`Gcode:${lineNo} lost ${code}`);
        break;

      case 'm': // M-code (miscellaneous function)
        // M2 and M30 terminate the program
        if (value === 2 || value === 30)
          terminated = true;
        break;

      case 'o': // subroutine marker
        // ignore the rest of this line
        parsingLine = false;
        // fall through intended

      case '@': // polar coordinates - distance
      case '^': // polar coordinates - angle (degrees)
      case 'a': // Rotation about X axis
      case 'b': // Rotation about Y axis
      case 'c': // Rotation about Z axis
      case 'd': // Cutter diameter compensation
      case 'h': // tool length offset
      case 'i': // arc-centre X vector
      case 'j': // arc-centre Y vector
      case 'k': // arc-centre Z vector
      case 'l': // generic parameter word for G10, M66 and others
      case 'n': // line number
      case 'p': // dwell time
      case 'q': // feed increment, used in drill cycles
      case 'r': // arc radius
      case 's': // spindle speed (decorator)
      case 't': // tool number
      case 'u': // U axis of machine
      case 'v': // V axis of machine
      case 'w': // W axis of machine
        //console.debug(`Gcode:${lineNo} ignored ${code}${value}`);
        break;
      default:
        console.error(`Gcode:${lineNo} unsupported ${code}${value}`);
      }
    }
    if (pending) {
      path.push(pending);
      last = pending;
      pending = undefined;
    }
    lineNo++;
  }

  if (percents === 1) // error, see remark above
    // Warn about it, but plough on regardless.
    console.debug("Gcode: malformed, no terminating %");

  // When a program starts, the position and feed rate of the tool
  // are unknown. They only become known when X, Y, Z, and F have
  // all been invoked once.
  // Make sure all path vertices have all of x, y, z, f by reading
  // the first-defined value of the fields back
  for (const field of [ 'x', 'y', 'z', 'f' ]) {
    let readBack;
    for (const pt of path) {
      if (!isNaN(pt[field])) {
        readBack = pt[field];
        break;
      }
    }
    if (typeof readBack === "undefined") {
      console.debug(`Gcode: ${field} never gets a value`);
      readBack = 0;
    }
    for (const pt of path) {
      if (isNaN(pt[field]))
        pt[field] = readBack;
      else
        break;
    }
  }

  return path;
}

/**
 * A generator for Gcode
 */
export class Generator {

  /**
   * Set up a gcode job.
   * @param {object} job job parameters
   * @param {number} job.xScale Factor to convert "integer" units to
   * gcode units
   * @param {number} job.yScale Factor to convert "integer" units to
   * gcode units
   * @param {number} job.zScale Factor to convert "integer" units to
   * gcode units
   * @param {number} job.offsetX Origin offset X
   * @param {number} job.offsetY Origin offset Y
   * @param {number} job.decimal Number of decimal places to keep
   * in gcode
   * @param {number} job.topZ Top of area to cut
   * @param {number} job.tabZ Depth to cut over tabs (only useful if
   * tabGeometry is not empty)
   * @param {number} job.safeZ Z position to safely move over
   * uncut areas
   * @param {number} job.passDepth Cut depth for each pass
   * @param {number} job.plungeFeed Feedrate to plunge cutter
   * @param {number} job.retractFeed Feedrate to retract cutter
   * @param {number} job.cutFeed Feedrate for horizontal cuts
   * @param {number} job.rapidFeed Feedrate for rapid moves
   */
  constructor(job) {

    for (const k of Object.keys(job))
    this[k] = job[k];

    /**
     * Generate Gcode for the start of a cut job.
     * @param {JobCard} job the job card
     * @param {string[]} gcode array of gcode lines
     */
    const u = this.gunits;
    this.gcode = [
      `; Work area:${this.workWidth.toFixed(2)}x${this.workHeight.toFixed(2)} ${u}`,
      `; Offset:   (${this.offsetX.toFixed(2)},${this.offsetY.toFixed(2)}) ${u}`,
    ];

    switch (u) {
    case "inch": this.G(20, { rem: "Set units to inches" }); break;
    case "mm": this.G(21, { rem: "Set units to mm"}); break;
    default: throw new Error(`${u} units not supported by gcode`);
    }

    this.stopSpindle();
    this.G(90, { rem: "Absolute positioning" });
    this.decimal = this.decimal ?? 2;

    this.spindleTurning = false;
    this.lastF = NaN;
    this.lastX = NaN;
    this.lastY = NaN;
    this.G(0, { z: this.safeZ, f: this.rapidFeed, rem: "Move to clearance level" });
  }

  /**
   * Generate gcode to mark the end of a job
   * @return {string[]} array of gcode commands
   */
  end() {
    const p = {
      z: this.safeZ,
      f: this.rapidFeed
    };
    if (this.returnTo00) {
      this.offsetX = this.offsetY = 0;
      this.xScale = this.yScale = 0;
      p.pt = { X: 0, Y: 0 };
      p.rem = "Return to 0,0";
    }
    this.G(0, p);
    this.M(2, { rem: "end program" });
    return this.gcode;
  }

  /**
   * @private
   */
  rem(remark) {
    this.gcode.push(`; ${remark}`);
  }

  mapX(x) { return x * this.xScale + this.offsetX; }

  mapY(y) { return y * this.yScale + this.offsetY; }

  toolAt(pt) {
    return this.lastX !== this.mapX(pt.X) ||
    this.lastY !== this.mapY(pt.Y);
  }

  /**
   * Generate a G gcode
   * @param {string} code the code e.g. G0
   * @param {object} opts optional data
   * @param {number} opts.f the speed, undefined means no change
   * @param {Vector?} opts.pt the position, undefined means no move
   * @param {number?} opts.z the z coord, undefined means same z
   * @param {string?} opts.rem optional remark (comment)
   * @private
   */
  code(code, opts) {
    const line = [ code ];
    if (typeof opts.pt !== "undefined") {
      const x = this.mapX(opts.pt.X);
      if (x !== this.lastX) {
        line.push(`X${x.toFixed(this.decimal)}`);
        this.lastX = x;
      }
      const y = this.mapY(opts.pt.Y);
      if (y !== this.lastY) {
        line.push(`Y${y.toFixed(this.decimal)}`);
        this.lastY = y;
      }
    }

    if (typeof opts.z === "undefined"
        && typeof opts.pt !== "undefined" && typeof opts.pt.Z !== "undefined")
      opts.z = opts.pt.Z * this.zScale + this.topZ;

    if (typeof opts.z !== "undefined" && opts.z !== this.lastZ) {
      if (opts.z !== this.lastZ) {
        line.push(`Z${opts.z}`);
        this.lastZ = opts.z;
      }
    }

    // Don't add zero moves
    if (line.join("") === "G0" || line.join("") == "G1")
      return;

    if (typeof opts.f !== "undefined" && opts.f !== this.lastF) {
      line.push(`F${opts.f}`);
      this.lastF = opts.f;
    }

    if (typeof opts.rem !== "undefined")
      line.push(`; ${opts.rem}`);

    this.gcode.push(line.join(" "));
  }

  /**
   * @private
   */
  M(code, opts) {
    this.code(`M${code}`, opts);
  }

  /**
   * @private
   */
  G(code, opts) {
    this.code(`G${code}`, opts);
  }

  /**
   * Get distance between two points in gcode units
   * @private
   */
  dist(p1, p2) {
    const dx = (p2.X - p1.X) * this.xScale;
    const dy = (p2.Y - p1.Y) * this.yScale;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * @private
   */
  startSpindle() {
    if (!this.spindleTurning)
      this.M(3, { rem: "Start spindle" });
    this.spindleTurning = true;
  }

  /**
   * @private
   */
  stopSpindle() {
    if (this.spindleTurning)
      this.M(5, { rem: "Stop spindle" });
    this.spindleTurning = false;
  }

  /**
   * Ramp in by backtracking the path, then turn and cut at
   * that depth.
   * @param {CutPath} path path we are ramping into
   * @param {number} required target Z at the end of the ramp
   * @return true if the path could be ramped, false otherwise
   * @private
   */
  rampIn(path, requiredZ) {
    // Start at the first point on the path, cut the ramp down for
    // half the time a drill plunge would take, then turn and cut back
    // to the start point.

    // Calculate the best angle for the ramp
    const minPlungeTime = (this.topZ - requiredZ) / this.plungeFeed;
    const idealDist = this.cutFeed * minPlungeTime;

    // Calculate the path segments that need to be
    // involved in the ramp.
    let end;
    const edgeLens = [];
    let totalLen = 0;
    for (end = 1; end < path.length && totalLen < idealDist / 2; end++) {
      // 2 * because it's out and back
      const edgeLen = this.dist(path[end - 1], path[end]);
      edgeLens.push(edgeLen);
      totalLen += edgeLen;
    }

    if (totalLen <= 0) // is the ramp doable?
      // TODO: could wrap a closed poly, or do multiple passes
      // over the range of segments
      return false;

    this.rem('ramp');

    let curZ = this.lastZ;
    const dZ = (this.topZ - requiredZ) / (2 * totalLen);
    const feed = Math.min(2 * totalLen / minPlungeTime, this.cutFeed);
    // Out
    for (let i = 0; i < edgeLens.length; i++) {
      curZ -= edgeLens[i] * dZ;
      this.G(1, { f: feed, pt: path[i + 1], z: curZ });
    }
    // Back
    for (let i = edgeLens.length - 1; i >= 0; i--) {
      curZ -= edgeLens[i] * dZ;
      this.G(1, { f: feed, pt: path[i], z: curZ });
    }
    assert(this.lastZ === requiredZ, `${this.lastZ} != ${requiredZ}`);
    return true;
  }

  /**
   * Generate gcode for a set of paths. Assumes that the current Z
   * position is safe. Parameters are in gcode units unless specified
   * otherwise.
   * @param {object} op operation description
   * @param {CutPaths} op.paths Paths to convert. These paths are
   * in "integer" units, and will be transformed to Gcode units using the
   * `Scale` parameters.
   * @param {boolean} op.ramp Ramp plunge. Default is to drill plunge.
   * @param {boolean} op.precalculatedZ Use Z coordinates in paths.
   * Some operations (such as Perforate) have pre-calculated
   * Z coordinates.  Use of these is enabled by this switch.
   * @param {CutPaths} op.tabGeometry Tab geometry (optional),
   * defined in "integer" units and requires scaling.
   */
  addOperation(op) {

    // Tab depth must be > the botZ depth of the Operation. If it isn't,
    // then ignore the tab geometry
    let tabGeometry = op.tabGeometry;
    // NOTE the cut depth might be a lot less than the material thickness
    const botZ = this.topZ - op.cutDepth;
    let tabZ = this.tabZ ?? botZ;

    if (tabGeometry && tabZ <= botZ) {
      App.showAlert("tabsDeeper", 'alert-warning');
      tabGeometry = undefined;
    }

    this.rem(`** Operation "${op.name}"`);
    this.rem(`Type:        ${op.cutType}`);
    this.rem(`Paths:       ${op.paths.length}`);
    this.rem(`Direction:   ${op.direction}`);
    this.rem(`Cut Depth:   ${op.cutDepth} ${this.gunits}`);
    this.rem(`Pass Depth:  ${op.passDepth} ${this.gunits}`);
    this.rem(`Plunge rate: ${this.plungeFeed} ${this.gunits}/min`);

    let pathIndex = 0;
    assert(op.paths instanceof CutPaths);

    console.debug(`Generating Gcode for ${op.name}, ${op.paths.length} paths`);
    for (const path of op.paths) {

      if (path.length === 0)
        continue;

      // If necessary, split path where it enters/leaves tab geometry
      const separatedPaths = (tabGeometry && tabGeometry.length > 0)
            ? Cam.separateTabs(path, tabGeometry)
            : [ path ];

      this.rem(`Path ${++pathIndex}`);

      // Loop over the paths until the target cut depth is reached
      let lastCutZ = this.topZ;
      while (this.lastZ > botZ) {
        // Calculate cut depth for this pass
        const targetZ = Math.max(lastCutZ - this.passDepth, botZ);

        // The current Z is deeper than the safe Z and the path isn't
        // safe to close or there is tab geometry, retract to
        // a safe depth
        //if (this.lastZ < this.safeZ && (!path.safeToClose || tabGeometry))
        //  this.G(0, { f: this.rapidFeed, z: this.safeZ, rem: "Z safe" });

        // If the tool isn't over the start of the next cut, lift it
        // before moving it there
        if (!this.toolAt(path[0])) {
          this.stopSpindle();
          this.G(0, { f: this.rapidFeed, z: this.safeZ }); // clear
        }
        // Drop to top of material
        if (this.lastZ > lastCutZ)
          this.G(0, { f: this.rapidFeed, pt: path[0], z: lastCutZ } );

        // We're over the start of the path, we can start cutting
        this.startSpindle();

        let cutPaths;
        if (targetZ >= tabZ || op.precalculatedZ)
          // Cutting above tab depth, or we are using coordinates
          cutPaths = [ path ];
        else
          // Cutting below tab depth, so need to exclude tabGeometry
          cutPaths = separatedPaths;

        // Every even-numbered path is cut to tabZ, every odd numbered
        // to targetZ. Without tabGeometry, all paths are cut to targetZ,
        // but with tabGeometry, even numbered paths are the tab
        // paths so are cut shallower.
        let overTab = true;
        for (const cutPath of cutPaths) {
          overTab = !overTab;
          let requiredZ = overTab ? tabZ : targetZ;

          if (cutPath.length === 0)
            continue;

          if (op.precalculatedZ) {
            this.G(1, { f: this.cutFeed, pt: cutPath[0],
                        rem: "Precalculated Z" });
            requiredZ = undefined; // so G uses the coordinate
          } else {
            this.G(1, { f: this.cutFeed, pt: cutPath[0], z: lastCutZ });

            if (requiredZ < this.lastZ) { // do we need to be deeper?
              if (!(op.ramp && this.rampIn(cutPath, requiredZ)))
                // No ramp, so drill plunge
                this.G(1, { f: this.plungeFeed, z: requiredZ,
                            rem: "Drill plunge" });

            } else
              this.G(0, { f: this.rapidFeed, z: requiredZ });
          }

          // Cut the rest of the path at the current depth
          for (let i = 1; i < cutPath.length; ++i)
            this.G(1, { f: this.cutFeed, pt: cutPath[i], z: requiredZ });
          if (cutPath.isClosed)
            this.G(1, { f: this.cutFeed, pt: cutPath[0], z: requiredZ });
        }

        if (op.precalculatedZ)
          break;

        lastCutZ = targetZ;
      }

      this.G(0, { f: this.rapidFeed, z: this.safeZ, rem: "Path done" });
    } // each path
    this.stopSpindle();
    console.debug(`${this.gcode.length} lines of Gcode generated`);
  }
}

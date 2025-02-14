/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */
/* global assert */

/* global App */

import * as Cam from "./Cam.js";
import { CutPoint } from "./CutPoint.js";
import { CutPath } from "./CutPath.js";
import { CutPaths } from "./CutPaths.js";

/**
 * Gcode parsing an generation.
 * @namespace Gcode
 */

/**
 * State of the CNC machine, or a CNC coordinate
 * @memberof Gcode
 */
class CNC {
  /**
   * All default to NaN unless otherwise documented.
   * @param {object?} init initialisation
   * @param {number?} init.x X coordinate
   * @param {number?} init.y Y coordinate
   * @param {number?} init.z Z coordinate
   * @param {number?} init.f feed rate
   * @param {number?} init.s spindle speed (default 0)
   */
  constructor(init) {
    if (init) {
      this.x = init.x ?? NaN;
      this.y = init.y ?? NaN;
      this.z = init.z ?? NaN;
      this.f = init.f ?? NaN;
      this.s = init.s ?? 0;
    } else {
      this.x = this.y = this.z = this.f = NaN;
      this.s = 0;
    }
  }

  toString() {
    return `<${this.x},${this.y},${this.z} F${this.f} ${this.s}>`;
  }
}

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
  let state = new CNC();
  let terminated = false, percents = 0;
  let last;

  function fieldChanged(from, to, field) {
    if (isNaN(from)) return !isNaN(to);
    assert(!isNaN(to));
    return to !== from;
  }

  function changed(from, to) {
    return fieldChanged(from.x, to.x)
    || fieldChanged(from.y, to.y)
    || fieldChanged(from.z, to.z)
    || fieldChanged(from.f, to.f)
    || fieldChanged(from.s, to.s);
  }

  function saveState(which) {
    const last = path[path.length - 1];
    if (!last || changed(last, state)) {

      path.push({
        x: state.x, y: state.y, z: state.z, f: state.f, s: state.s
      });
    }
  }

  let updateState = false;

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
    let m, parsingLine = true;
    let spindle = 0, waitingForSpindle = false;
    while (parsingLine && (m = re.exec(line))) {
      const code = m[1].toLowerCase(), value = Number(m[2]);
      switch (code) {

        // Commands
      case 'g':
        saveState("G");
        switch (value) {
        case 0: case 1:
          updateState = true;
          break;
        default:
          updateState = false; // ignore the rest of
        }
        break;

      case 'm': // M-code (miscellaneous function)
        saveState("M");
        // M2 and M30 terminate the program
        if (value === 2 || value === 30)
          terminated = true, parsingLine = false;
        else if (value === 3) {
          // start/stop spindle
          updateState = true;
        } else if (value === 5)
          state.s = 0;
        break;

        // Parameters. These just change the state.
      case 'f': // feed rate
      case 'x': // X axis of machine
      case 'y': // Y axis of machine
      case 'z': // Z axis of machine
      case 's': // Spindle speed
        if (updateState)
          state[code] = value;
        break;

      case 'o': // subroutine marker
        saveState("O");
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
    lineNo++;
  }
  saveState("END");

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
    if (!readBack) {
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

  // Remove null steps
  let prev = path[0], i = 1;
  while (i < path.length) {
    if (!changed(prev, path[i]))
      path.splice(i, 1);
    else
      prev = path[i], i++;
  }

  return path;
}

/**
 * @typedef GCommand
 * @property {string} code required code e.g. G0
 * @property {number} optional f
 * @property {CutPoint} pt optional CutPoint to move to
 * @property {number} f optional the speed
 * @property {number} z optional the z coord, undefined means same z, or use
 * z from pt or same z if pt.z is undefined
 * @property {string} rem optional remark (comment)
 * @memberof Gcode
 */

/**
 * A generator for Gcode
 * @memberof Gcode
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
   * @param {number} job.topZ Top of area to cut (gcode units)
   * @param {number} job.safeDepth Z depth to safely move over
   * uncut areas (gcode units).
   * @param {number} job.passDepth Cut depth for each pass (gcode units)
   * @param {number} job.plungeFeed Feedrate to plunge cutter
   * @param {number} job.retractFeed Feedrate to retract cutter
   * @param {number} job.cutFeed Feedrate for horizontal cuts
   * @param {number} job.rapidFeed Feedrate for rapid moves
   */
  constructor(job) {

    for (const k of Object.keys(job))
      this[k] = job[k];

    assert(typeof this.gunits === "string");
    assert(typeof this.xScale === "number");
    assert(typeof this.yScale === "number");
    assert(typeof this.zScale === "number");
    assert(typeof this.decimal === "number");
    assert(typeof this.topZ === "number");
    assert(typeof this.botZ === "number");
    assert(typeof this.safeZ === "number");
    assert(typeof this.passDepth === "number");
    assert(typeof this.plungeFeed === "number");
    assert(typeof this.retractFeed === "number");
    assert(typeof this.cutFeed === "number");
    assert(typeof this.rapidFeed === "number");
    assert(typeof this.returnTo00 === "boolean");
    assert(typeof this.workWidth === "number");
    assert(typeof this.workHeight === "number");
    assert(typeof this.offsetX === "number");
    assert(typeof this.offsetY === "number");

    const u = this.gunits;

    /**
     * The gcode, an array of Gcode lines
     * @member {string[]} array of gcode lines
     */
    this.gcode = [];

    this.rem(`Gcode generated by SVGcut ${new Date().toISOString()}`);
    this.rem(`Work area: ${this.workWidth.toFixed(2)}x${this.workHeight.toFixed(2)} ${u}`);
    this.rem(`Offset: (${this.offsetX.toFixed(2)},${this.offsetY.toFixed(2)}) ${u}`);

    switch (u) {
    case "inch": this.G(20, { rem: "Set units to inches" }); break;
    case "mm": this.G(21, { rem: "Set units to mm"}); break;
    default: throw new Error(`${u} units not supported by gcode`);
    }

    /**
     * Where the tool is thought to be
     * @member {CNCPoint}
     */
    this.last = new CNC();

    this.G(90, { rem: "Absolute positioning" });
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
      p.pt = new CutPoint(0, 0);
      p.rem = "Return to 0,0";
    }
    this.G(0, p);
    this.M(2, { rem: "end program" });
    return this.gcode;
  }

  /**
   * Add a full-line comment to Gcode
   * @param remark {string} the comment
   * @private
   */
  rem(remark) {
    this.gcode.push(`; ${remark}`);
  }

  /**
   * Map a CutPath X to Gcode coords
   * @param {number} x the coord in CutPath units
   * @return {number} the coord mapped to CNC units
   * @private
   */
  mapX(x) { return x * this.xScale + this.offsetX; }

  /**
   * Map a CutPath Y to Gcode coords
   * @param {number} y the coord in CutPath units
   * @return {number} the coord mapped to CNC
   * @private
   */
  mapY(y) { return y * this.yScale + this.offsetY; }

  /**
   * Map a CutPath Z to Gcode coords
   * @param {number} z the coord in CutPath units
   * @return {number} the coord mapped to CNC
   * @private
   */
  mapZ(z) { return z * this.zScale + this.topZ; }

  /**
   * Map a CutPath point to Gcode coords
   * @param {CutPoint} pt the point
   * @return {CNC} the mapped point
   * @private
   */
  map(pt) {
    const npt = new CNC({ x: this.mapX(pt.X), y: this.mapY(pt.Y) });
    if (typeof pt.Z !== "undefined")
      npt.Z = this.mapZ(pt.Z);
    return npt;
  }    

  /**
   * Test if the tool is at the given point (2D)
   * @param {CutPoint} point in Cutpath coords
   * @return {boolean} wether the tool is at that point
   * @private
   */
  toolAt(pt) {
    if (this.last.x !== this.mapX(pt.X) ||
        this.last.y !== this.mapY(pt.Y)) {
      //this.rem(`${this.map(pt).y},${this.map(pt).y} != ${this.last.y},${this.last.y}`);
      return false;
    }
    return true;
  }

  /**
   * Generate a G gcode
   * @param {GCommand} control
   * @private
   */
  code(command) {
    const line = [ command.command ];
    if (command.pt) {
      const x = this.mapX(command.pt.X);
      if (x !== this.last.x) {
        line.push(`X${x.toFixed(this.decimal)}`);
        this.last.x = x;
      }
      const y = this.mapY(command.pt.Y);
      if (y !== this.last.y) {
        line.push(`Y${y.toFixed(this.decimal)}`);
        this.last.y = y;
      }

      if (typeof command.z === "undefined" && typeof command.pt.Z === "number")
        command.z = this.mapZ(command.pt.Z);
    }

    if (typeof command.z === "number" && command.z !== this.last.z) {
      if (command.z !== this.last.z) {
        line.push(`Z${command.z}`);
        this.last.z = command.z;
      }
    }

    // Don't add zero moves
    if (line.join("") === "G0" || line.join("") === "G1")
      return;

    if (typeof command.f === "number" && command.f !== this.last.f) {
      line.push(`F${command.f}`);
      this.last.f = command.f;
    }

    if (typeof command.spin === "number") {
      line.push(`S${command.spin}`);
      this.last.s = command.spin;
    }

    if (typeof command.rem === "string")
      line.push(`; ${command.rem}`);

    //console.debug(line.join(" "));
    this.gcode.push(line.join(" "));
  }

  /**
   * Add an M command
   * @param {GCommand} command command complete except for the command string
   * @private
   */
  M(code, command) {
    command.command = `M${code}`;
    this.code(command);
  }

  /**
   * Add a G command
   * @param {GCommand} command command complete except for the command string
   * @private
   */
  G(code, command) {
    command.command = `G${code}`;
    this.code(command);
  }

  /**
   * Start the spindle
   * @private
   */
  startSpindle(spin) {
    if (this.last.s !== spin)
      this.M(3, { spin: spin, rem: "Start spindle" });
  }

  /**
   * Stop the spindle
   * @private
   */
  stopSpindle() {
    if (this.last.s > 0)
      this.M(5, { rem: "Stop spindle" });
    this.last.s = 0;
  }

  /**
   * Ramp in by backtracking the path, then turn and cut to
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
      const edgeLen = path[end - 1].dist(path[end]);
      edgeLens.push(edgeLen);
      totalLen += edgeLen;
    }

    if (totalLen <= 0) // is the ramp doable?
      // TODO: could wrap a closed poly, or do multiple passes
      // over the range of segments
      return false;

    this.rem('ramp');

    let curZ = this.last.z;
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
    assert(this.last.z === requiredZ, `${this.last.z} != ${requiredZ}`);
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
   * @param {number} op.cutType one of the operations supported by Cam.
   * @param {number} op.spinSpeed spindle speed to use for this operation.
   * @param {boolean} op.ramp Ramp plunge. Default is to drill plunge.
   */
  addOperation(op) {
    console.debug(`Generating Gcode for ${op.name}, ${op.paths.length} paths`);

    assert(typeof op.name === "string");
    assert(typeof op.cutType === "number");
    this.rem(`*** Operation "${op.name}" (${Cam.LONG_OP_NAME[op.cutType]}) ***`);

    assert(op.paths instanceof CutPaths);
    assert(typeof op.ramp === "boolean");
    assert(typeof op.direction === "string");
    assert(typeof op.spinSpeed === "number");

    let pathIndex = 0;

    for (const path of op.paths) {
      pathIndex++;

      if (path.length === 0)
        continue;

      let passNum = 0;
      const minZ = path.bbox3D().minZ;

      this.rem(`Path ${pathIndex}`);

      // Loop over the paths carving away passDepth slices until the
      // target cut depth is reached on all segments.
      let lastCutZ = this.topZ; // depth of the last cut
      while (lastCutZ > minZ) {
        // Calculate maximum cut depth for this pass
        const targetZ = lastCutZ - this.passDepth;
        this.rem(`Pass ${pathIndex}:${++passNum}`);
        console.log(`Pass ${pathIndex}:${passNum}`);
        this.followPath(path, targetZ, op);
        lastCutZ = targetZ;
      }
    }
  }

  /**
   * Cut a path at a maximum of the path depth (as given by the first point
   * on the path) and the z passed.
   * @param {CutPath} path
   * @param {number?} minZ depth below which we must not cut
   * @param {object} op operation description (see addOperation for members)
   * @private
   */
  followPath(path, minZ, op) {
    // If the tool isn't over the start of the path, move it there
    if (!this.toolAt(path[0])) {
      this.stopSpindle();
      this.G(0, { f: this.rapidFeed, z: this.safeZ, rem: "Clear" });
      this.G(0, { f: this.rapidFeed, pt: path[0], z: this.safeZ, rem: "Hang" });
    }

    this.startSpindle(op.spinSpeed);

    // Do we need to move to the start of the path?
    /*
      if (!(op.ramp && this.rampIn(cutPath, requiredZ)))
      // No ramp, so drill plunge
      this.G(1, { f: this.plungeFeed, z: requiredZ,
      rem: "Drill plunge" });
      } else */
    this.G(0, { f: this.rapidFeed, pt: path[0],
                z: Math.max(path[0].Z, minZ), rem: "Sink" } );

    // Cut the rest of the path
    for (let i = 1; i < path.length; i++)
      this.G(1, { f: this.cutFeed, pt: path[i],
                  z: Math.max(path[i].Z, minZ) });

    if (path.isClosed)
      this.G(1, { f: this.cutFeed, pt: path[0],
                  z: Math.max(path[0].Z, minZ), rem: "close" });

    this.stopSpindle();

    this.G(0, { f: this.rapidFeed, z: this.safeZ });
  }
}

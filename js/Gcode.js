/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */
/* global assert */

/* global App */

import * as Cam from "./Cam.js";
import { CutPath } from "./CutPath.js";
import { CutPaths } from "./CutPaths.js";

/**
 * Gcode utilities
 * @namespace Gcode
 */

/**
 * @typedef {object} CNCPoint
 * @property {number} x X coordinate
 * @property {number} y Y coordinate
 * @property {number} z Z coordinate
 * @property {number} f feed rate
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
 * @param {Gcode} gcode the gcode to parse
 * @return {CNCPoint[]} path in machine units (no scaling is performed).
 * @memberof Gcode
 */
export function parse(gcode) {
  const path = [];
  const lines = gcode
        .replace(/\(.*?\)/g, "") // remarks
        .replace(/;[^\n]*/g, "") // end of code line
        .split(/[ \t]*\r?\n[ \t]*/);
  let lineNo = 0;
  let last = { x: NaN, y: NaN, z: NaN, f: NaN };
  let terminated = false, percents = 0;
  for (const line of lines) {
    if (terminated) // terminated by M2 or M30?
      break;
    lineNo++;

    if (line[0] === "/" // block delete,
        || /^\s*$/.test(line)) { // blank line
      continue;
    }

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
          console.debug(`Gcode:${lineNo} ignored g${value}`);
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
        console.debug(`Gcode:${lineNo} ignored ${code}${value}`);
        break;
      default:
        console.debug(`Gcode:${lineNo} unsupported ${code}${value}`);
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

export function startJob(job, gcode) {
  const u = job.gunits;
  gcode.push(
    `; Work area:${job.workWidth.toFixed(2)}x${job.workHeight.toFixed(2)} ${u}`);
  gcode.push(
    `; Offset:   (${job.offsetX.toFixed(2)},${job.offsetY.toFixed(2)}) ${u}`);

  switch (u) {
  case "inch": gcode.push("G20 ; Set units to inches"); break;
  case "mm": gcode.push("G21 ; Set units to mm"); break;
  default: throw new Error(`${u} units not supported by gcode`);
  }
  gcode.push("G90 ; Absolute positioning");
  gcode.push(`G0 Z${job.safeZ} F${job.rapidFeed} ; Move to clearance level`);
}

export function endJob(job, gcode) {
  if (job.returnTo00)
    gcode.push(`G0 X0 Y0 F${job.rapidFeed} ; Return to 0,0`);
  gcode.push("M2 ; end program");
}

/**
 * Generate gcode for a set of paths. Assumes that the current Z
 * position is safe. Parameters are in gcode units unless specified
 * otherwise.
 * @param {object} op
 * @param {CutPaths} op.paths Paths to convert. These paths are
 * in "integer" units, and will be transformed to Gcode units using the
 * `Scale` parameters.
 * @param {boolean} op.ramp Ramp plunge. Default is to drill plunge.
 * @param {boolean} op.precalculatedZ Use Z coordinates in paths.
 * Some operations (such as Perforate) have pre-calculated
 * Z coordinates.  Use of these is enabled by this switch.
 * @param {CutPaths} op.tabGeometry Tab geometry (optional),
 * defined in "integer" units and require scaling.
 * @param {string[]} gcode array of Gcode lines to be added to
 *
 * @param {object} job
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
 * @param {string[]} gcode array of Gcode lines to be added to
 * @memberof Cam
 */
export function generateOperation(op, job, gcode) {
  const dec = job.decimal ?? 2;

  // Tab depth must be > the botZ depth of the Operation. If it isn't,
  // then ignore the tab geometry
  let tabGeometry = op.tabGeometry;
  // NOTE the cut depth might be a lot less than the material thickness
  const botZ = job.topZ - op.cutDepth;
  let tabZ = job.tabZ ?? botZ;

  if (tabGeometry && tabZ <= botZ) {
    App.showAlert("tabsDeeper", 'alert-warning');
    tabGeometry = undefined;
  }

  gcode.push(`; ** Operation "${op.name}"`);
  gcode.push(`; Type:        ${op.cutType}`);
  gcode.push(`; Paths:       ${op.paths.length}`);
  gcode.push(`; Direction:   ${op.direction}`);
  gcode.push(`; Cut Depth:   ${op.cutDepth} ${job.gunits}`);
  gcode.push(`; Pass Depth:  ${op.passDepth} ${job.gunits}`);
  gcode.push(`; Plunge rate: ${job.plungeFeed} ${job.gunits}/min`);

  let lastF = NaN, lastX = NaN, lastY = NaN, lastZ = job.safeZ;

  // Get distance between two points
  function dist(p1, p2) {
    const dx = (p2.x - p1.X) * job.xScale + job.offsetX;
    const dy = (p2.Y - p1.Y) * job.yScale + job.offsetY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Generate a G gcode
  function G(code, f, pt, z, comment) {
    const line = [ `G${code}` ];
    if (typeof pt !== "undefined") {
      const x = pt.X * job.xScale + job.offsetX;
      if (x !== lastX) {
        line.push(`X${x.toFixed(dec)}`);
        lastX = x;
      }
      const y = pt.Y * job.yScale + job.offsetY;
      if (y !== lastY) {
        line.push(`Y${y.toFixed(dec)}`);
        lastY = y;
      }
    }

    if (typeof z === "undefined" && typeof pt.Z !== "undefined")
      z = pt.Z * job.zScale + job.topZ;

    if (typeof z !== "undefined" && z !== lastZ) {
      if (z !== lastZ) {
        line.push(`Z${z}`);
        lastZ = z;
      }
    }

    if (typeof f !== "undefined" && f !== lastF) {
      line.push(`F${f}`);
      lastF = f;
    }

    if (typeof comment !== "undefined")
      line.push(`; ${comment}`);

    return line.join(" ");
  }

  let spindleTurning = false;

  function startSpindle() {
    if (!spindleTurning)
      gcode.push('M3 ; Start spindle');
    spindleTurning = true;
  }

  function stopSpindle() {
    if (spindleTurning)
      gcode.push('M5 ; Stop spindle');
    spindleTurning = false;
  }

  function rampIn(selectedPath, currentZ, selectedZ) {
    // Calculate the best angle for the ramp
    const minPlungeTime = (currentZ - selectedZ)
          / job.plungeFeed;
    const idealDist = job.cutFeed * minPlungeTime;

    // Calculate the path segments that need to be
    // involved in the ramp
    let end;
    let totalDist = 0;
    for (end = 1; end < selectedPath.length; ++end) {
      if (totalDist > idealDist)
        break;
      totalDist += 2 * dist(selectedPath[end - 1], selectedPath[end]);
    }

    if (totalDist <= 0) // is the ramp doable?
      return false;

    gcode.push('; ramp');

    // We ramp in by backtracking the path
    const rampPath = selectedPath.slice(0, end)
          .concat(selectedPath.slice(0, end - 1).reverse());
    let distTravelled = 0;
    const feed = Math.min(totalDist / minPlungeTime, job.cutFeed);
    for (let i = 1; i < rampPath.length; ++i) {
      distTravelled += dist(rampPath[i - 1], rampPath[i]);
      const newZ = currentZ + distTravelled
            / totalDist * (selectedZ - currentZ);
      gcode.push(G(1, feed, rampPath[i], newZ));
      return true;
    }
  }

  let pathIndex = 0;
  assert(op.paths instanceof CutPaths);
  console.log(op.paths);
  for (const path of op.paths) {

    if (path.length === 0)
      continue;

    // If necessary, split path where it enters/leaves tab geometry
    const separatedPaths = (tabGeometry && tabGeometry.length > 0)
          ? Cam.separateTabs(path, tabGeometry)
          : [ path ];

    gcode.push(`; Path ${++pathIndex}`);

    let finishedZ = job.topZ; // Last deepest cut

    // Loop over the paths until the target cut depth is reached
    while (finishedZ > botZ) {
      // Calculate next cut depth
      const nextZ = Math.max(finishedZ - job.passDepth, botZ);

      // The current Z is deeper than the safe Z and the path isn't
      // safe to close or there is tab geometry, retract to
      // a safe depth
      //if (lastZ < job.safeZ && (!path.safeToClose || tabGeometry))
      //  gcode.push(G(0, job.rapidFeed, undefined,
      //               job.safeZ, "Z safe"));

      // If the tool isn't over the next cut, lift it and move it there
      if (lastX !== path[0].X || lastY !== path[0].Y) {
        stopSpindle();
        if (lastZ < job.safeZ)
          gcode.push(G(0, job.rapidFeed, undefined, job.safeZ));
        gcode.push(G(0, job.rapidFeed, path[0], undefined, "Goto path"));
      }

      startSpindle();

      let cutPaths;
      if (nextZ >= tabZ || op.precalculatedZ)
        // Cutting above tab depth, or useZ is defined
        cutPaths = [ path ];
      else
        // Cutting below tab depth, so need to exclude tabGeometry
        cutPaths = separatedPaths;

      // Every even-numbered path is cut to tabZ, every odd numbered
      // to nextZ. Without tabGeometry, all paths are cut to nextZ,
      // but with tabGeometry, even numbered paths are the tab
      // paths so are cut shallower.
      let overTab = true;
      for (const cutPath of cutPaths) {
        overTab = !overTab;

        if (cutPath.length === 0)
          continue;

        if (op.precalculatedZ) {
          gcode.push(G(1, job.cutFeed, cutPath[0],
                       undefined, "Precalculated Z"));
        } else {
          let selectedZ = overTab ? tabZ : nextZ;

          if (selectedZ < lastZ) { // do we need to be deeper?
            if (!(op.ramp && rampIn(cutPath, lastZ, selectedZ)))
              // No ramp, so drill plunge
              gcode.push(
                G(1, job.plungeFeed, undefined, selectedZ, "Drill plunge"));

          } else if (selectedZ > lastZ)
            // We're over a tab, retract to the tab level
            gcode.push(
              G(0, job.rapidFeed, undefined, selectedZ, "Retract for tab"));

          // We're ready to cut the path
        } // !op.precalculatedZ

        for (let i = 1; i < cutPath.length; ++i)
          gcode.push(G(1, job.cutFeed, cutPath[i]));

      }

      if (op.precalculatedZ)
        break;

      finishedZ = nextZ;
    } // while (finishedZ > botZ)

    gcode.push(G(0, job.rapidFeed, undefined, job.safeZ, "Path done"));
  } // each path
  stopSpindle();
}

/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global App */

import * as Cam from "./Cam.js";

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
 * @param {boolean} verbose true to enable verbose logging
 * @return {CNCPoint[]} path in machine units (no scaling is performed).
 * @memberof Gcode
 */
export function parse(gcode, verbose = false) {
  let startTime;
  if (verbose) {
    startTime = Date.now();
    console.debug("Gcode.parse...");
  }

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
          if (verbose) console.debug(`Gcode:${lineNo} ignored g${value}`);
          pending = undefined;
        }
        break;

      case 'f': // feed rate
      case 'x': // X axis of machine
      case 'y': // Y axis of machine
      case 'z': // Z axis of machine
        if (pending)
          pending[code] = value;
        else if (verbose)
          console.debug(`Gcode:${lineNo} lost ${code}`);
        break;

      case 'm': // M-code (miscellaneous function)
        // M2 and M30 terminate the program
        if (value == 2 || value == 30)
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
        if (verbose)
          console.debug(`Gcode:${lineNo} ignored ${code}${value}`);
        break;
      default:
        if (verbose)
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

  if (percents === 1 && verbose) // error, see remark above
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
      if (verbose) console.debug(`Gcode: ${field} never gets a value`);
      readBack = 0;
    }
    for (const pt of path) {
      if (isNaN(pt[field]))
        pt[field] = readBack;
      else
        break;
    }
  }

  if (verbose) {
    console.debug(
      `Gcode.parse: ${path.length} commands in ${Date.now() - startTime}`);
  }

  return path;
}

/**
 * Generate gcode for a set of paths. Assumes that the current Z
 * position is safe. Parameters are in gcode units unless specified
 * otherwise.
 * @param {object} args
 * @param {CamPath[]} args.paths Paths to convert. These paths are
 * in internal units, and will be transformed to Gcode units using the
 * `Scale` parameters.
 * @param {number} args.xScale Factor to convert internal units to
 * gcode units
 * @param {number} args.yScale Factor to convert internal units to
 * gcode units
 * @param {number} args.zScale Factor to convert internal units to
 * gcode units
 * @param {boolean} args.ramp Ramp plunge. Default is to drill plunge.
 * @param {number} args.offsetX Origin offset X
 * @param {number} args.offsetY Origin offset Y
 * @param {number} args.decimal Number of decimal places to keep
 * in gcode
 * @param {number} args.topZ Top of area to cut
 * @param {number} args.botZ Maximum depth to cut
 * @param {number} args.tabZ Depth to cut over tabs (only useful if
 * tabGeometry is not empty)
 * @param {number} args.safeZ Z position to safely move over
 * uncut areas
 * @param {number} args.passDepth Cut depth for each pass
 * @param {number} args.plungeFeed Feedrate to plunge cutter
 * @param {number} args.retractFeed Feedrate to retract cutter
 * @param {number} args.cutFeed Feedrate for horizontal cuts
 * @param {number} args.rapidFeed Feedrate for rapid moves
 * @param {boolean} args.useZ Use Z coordinates in paths. Some operations
 * (such as V Carve) have pre-calculated Z coordinates. Use of these is
 * enabled by this switch.
 * @param {number} args.tabGeometry Tab geometry (optional), will be
 * defined in internal units and require scaling.
 * @return {string[]} array of Gcode lines
 * @memberof Cam
 */
export function generate(args) {
  const dec = args.decimal ?? 2;
  const plungeF = `F${args.plungeFeed}`;
  const cutF = `F${args.cutFeed}`;
  const rapidF = `F${args.rapidFeed}`;

  // Tab depth must be > the botZ depth of the Operation. If it isn't,
  // then ignore the tab geometry
  let tabGeometry = args.tabGeometry;
  let tabZ = args.tabZ ?? args.botZ;

  if (tabGeometry && tabZ <= args.botZ) {
    App.showAlert("tabsDeeper", 'alert-warning');
    tabGeometry = undefined;
  }

  const gcode = [];

  const retractToSafeZ =
        `G0 Z${args.safeZ.toFixed(dec)} ${rapidF} ; Retract`;

  /// Get distance between two points
  function dist(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
  }

  // Scale and offset a internal X coordinate to gcode units
  function getX(x) {
    return x * args.xScale + args.offsetX;
  }

  // Scale and offset an internal Y coordinate to gcode units
  function getY(y) {
    return y * args.yScale + args.offsetY;
  }

  // Generate Gcode for a point, scaling internal to gcode units
  function pt2Gcode(p, useZ) {
    const result = [
      `X${getX(p.X).toFixed(dec)}`,
      `Y${getY(p.Y).toFixed(dec)}`
    ];
    if (useZ)
      result.push(`Z${(p.Z * args.zScale + args.topZ).toFixed(dec)}`);
    return result.join(" ");
  }

  let spindleTurning = false;

  function startSpindle() {
    if (!spindleTurning)
      gcode.push('M3 ; Start spindle');
    spindleTurning = true;
  }

  function stopSpindle() {
    if (spindleTurning)
      gcode.push('M5 ; Sop spindle');
    spindleTurning = false;
  }

  let pathIndex = 0;
  for (const path of args.paths) {
    // paths are CamPath
    const origPath = path.path;
    if (origPath.length == 0)
      continue;

    const separatedPaths = (tabGeometry && tabGeometry.length > 0)
          ? Cam.separateTabs(origPath, tabGeometry)
          : [ origPath ];

    gcode.push(`; Path ${pathIndex++}`);

    let currentZ = args.safeZ; // Current cut depth
    let finishedZ = args.topZ; // Last deepest cut

    while (finishedZ > args.botZ) {
      // Calculate next cut depth
      const nextZ = Math.max(finishedZ - args.passDepth, args.botZ);

      // The current Z is deeper than the safe Z and the path isn't
      // safe to close (perhaps because of tab geometry), retract to
      // a safe depth
      if (currentZ < args.safeZ && (!path.safeToClose || tabGeometry)) {
        gcode.push(retractToSafeZ);
        currentZ = args.safeZ;
      }

      // Note that Math.max in this case means "shallowest"
      currentZ = tabGeometry ? Math.max(finishedZ, tabZ) : finishedZ;

      gcode.push(
        "; Rapid to initial position",
        `G0 ${pt2Gcode(origPath[0], false)} Z${currentZ.toFixed(dec)} ${rapidF}`);
      startSpindle();

      let selectedPaths;
      if (nextZ >= tabZ || args.useZ)
        // Cutting above tab depth, or useZ is defined
        selectedPaths = [ origPath ];
      else
        // Cutting below tab depth, so need to exclude tabGeometry
        selectedPaths = separatedPaths;

      for (let selectedIndex = 0;
           selectedIndex < selectedPaths.length; ++selectedIndex) {
        const selectedPath = selectedPaths[selectedIndex];
        if (selectedPath.length == 0)
          continue;

        if (!args.useZ) {
          // Every even-numbered path is cut to tabZ, every odd numbered
          // to nextZ. Without tabGeometry, all paths are cut to nextZ,
          // but with tabGeometry, even numbered paths are the tab
          // paths so are cut shallower.
          let selectedZ = ((selectedIndex & 1) !== 0) ? tabZ : nextZ;

          if (selectedZ < currentZ) { // do we need to be deeper?
            let executedRamp = false;
            if (args.ramp) {
              // Calculate the best angle for the ramp
              const minPlungeTime = (currentZ - selectedZ)
                    / args.plungeFeed;
              const idealDist = args.cutFeed * minPlungeTime;

              // Calculate the path segments that need to be
              // involved in the ramp
              let end;
              let totalDist = 0;
              for (end = 1; end < selectedPath.length; ++end) {
                if (totalDist > idealDist)
                  break;
                totalDist += 2 * dist(getX(selectedPath[end - 1]),
                                      getY(selectedPath[end - 1]),
                                      getX(selectedPath[end]),
                                      getY(selectedPath[end]));
              }

              if (totalDist > 0) { // is the ramp doable?
                gcode.push('; ramp');

                // We ramp in by backtracking the path
                const rampPath = selectedPath.slice(0, end)
                      .concat(selectedPath.slice(0, end - 1).reverse());
                let distTravelled = 0;
                const feed = Math.min(totalDist / minPlungeTime, args.cutFeed);
                for (let i = 1; i < rampPath.length; ++i) {
                  distTravelled += dist(getX(rampPath[i - 1]),
                                        getY(rampPath[i - 1]),
                                        getX(rampPath[i]),
                                        getY(rampPath[i]));
                  const newZ = currentZ + distTravelled
                        / totalDist * (selectedZ - currentZ);
                  const gp = pt2Gcode(rampPath[i], false);
                  let gc = `G1 ${gp} Z${newZ.toFixed(dec)}`;
                  if (i == 1) gc += ` F${feed.toFixed(dec)}`;

                  gcode.push(gc);
                  executedRamp = true;
                }
              }
            }

            if (!executedRamp) {
              // No ramp, so drill plunge
              gcode.push(
                `G1 Z${selectedZ.toFixed(dec)} ${plungeF} ; Plunge`);
            }
          } else if (selectedZ > currentZ)
            // We're over a tab, retract to the tab level
            // SMELL: why not retract to selectedZ?
            gcode.push(
              `G0 Z${tabZ.toFixed(dec)} ${rapidF} ; Retract for tab`);

          currentZ = selectedZ;
        } // !args.useZ

        // We're ready to cut the path
        gcode.push('; cut');

        for (let i = 1; i < selectedPath.length; ++i) {
          const gp = pt2Gcode(selectedPath[i], args.useZ);
          gcode.push(`G1 ${gp}${i == 1 ? ` ${cutF}` : ""}`);
        }
      } // selectedIndex

      finishedZ = nextZ;
      if (args.useZ)
        break;
    } // while (finishedZ > args.botZ)

    stopSpindle();
    gcode.push(retractToSafeZ);
  } // pathIndex

  return gcode;
}

//CPP /* global Module */ // from Emscripten
/* global App */

import * as ClipperPaths from "./ClipperPaths.js";

/**
 * @typedef {object} CamPath
 * @property {InternalPath} path path in internal units
 * @property {boolean} safeToClose Is it safe to close the path without
 * retracting?
 */

/*CPP*
 * Convert C format paths to array of CamPath.
 * double**& cPathsRef, int& cNumPathsRef, int*& cPathSizesRef
 * Assumes each point has X, Y, Z (stride = 3)
 * @private
 *
function convertPathsFromCppToCamPath(memoryBlocks, cPathsRef, cNumPathsRef, cPathSizesRef) {

  const cPaths = Module.HEAPU32[cPathsRef >> 2];
  memoryBlocks.push(cPaths);
  const cPathsBase = cPaths >> 2;

  const cNumPaths = Module.HEAPU32[cNumPathsRef >> 2];

  const cPathSizes = Module.HEAPU32[cPathSizesRef >> 2];
  memoryBlocks.push(cPathSizes);
  const cPathSizesBase = cPathSizes >> 2;

  const convertedPaths = [];
  for (let i = 0; i < cNumPaths; ++i) {
    const pathSize = Module.HEAPU32[cPathSizesBase + i];
    let cPath = Module.HEAPU32[cPathsBase + i];
    // cPath contains value to pass to Module._free(). The aligned version contains the actual data.
    memoryBlocks.push(cPath);
    if (cPath & 4)
      cPath += 4;
    const pathArray = new Float64Array(Module.HEAPU32.buffer, Module.HEAPU32.byteOffset + cPath);

    const convertedPath = [];
    convertedPaths.push({ path: convertedPath, safeToClose: false });
    for (let j = 0; j < pathSize; ++j)
      convertedPath.push({
        X: pathArray[j * 3],
        Y: pathArray[j * 3 + 1],
        Z: pathArray[j * 3 + 2]
      });
  }

  return convertedPaths;
  }
/CPP*/

/**
 * Get distance between two points
 */
export function dist(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
}

/**
 * Try to merge paths. A merged path doesn't cross outside of bounds.
 * @param {InternalPath} bounds
 * @param {InternalPath[]} paths
 * @return {CamPath[]} merged paths
 */
export function mergePaths(bounds, paths) {
  return ClipperPaths.mergePaths(bounds, paths).map(path => {
    // convert to CamPath
    return {
      path: path,
      safeToClose: !ClipperPaths.crosses(bounds, path[0], path[path.length - 1])
    };});
}

/**
 * Compute paths for pocket operation on Clipper geometry.
 * @param {number} cutterDia is in internal units
 * @param {number} overlap is in the range [0, 1)
 * @return {CamPath[]}
 */
export function pocket(geometry, cutterDia, overlap, climb) {
  let current = ClipperPaths.offset(geometry, -cutterDia / 2);
  const bounds = current.slice(0);
  let allPaths = [];
  while (current.length != 0) {
    if (climb)
      for (let i = 0; i < current.length; ++i)
        current[i].reverse();
    allPaths = current.concat(allPaths);
    current = ClipperPaths.offset(current, -cutterDia * (1 - overlap));
  }
  return mergePaths(bounds, allPaths);
};

/*CPP*
 * Compute paths for vPocket operation on Clipper geometry.
 * @param {number} cutterDia is in internal units
 * @param {number} overlap is in the range [0, 1)
 * @return {CamPath[]}
 *
export function hspocket(geometry, cutterDia, overlap, climb) {
  const memoryBlocks = [];

  const cGeometry = ClipperPaths.toCpp(geometry, memoryBlocks);

  const resultPathsRef = Module._malloc(4);
  const resultNumPathsRef = Module._malloc(4);
  const resultPathSizesRef = Module._malloc(4);
  memoryBlocks.push(resultPathsRef);
  memoryBlocks.push(resultNumPathsRef);
  memoryBlocks.push(resultPathSizesRef);

  //extern "C" void hspocket(
  //    double** paths, int numPaths, int* pathSizes, double cutterDia,
  //    double**& resultPaths, int& resultNumPaths, int*& resultPathSizes)
  Module.ccall(
  'hspocket',
  'void', ['number', 'number', 'number', 'number', 'number', 'number', 'number'],
  [cGeometry[0], cGeometry[1], cGeometry[2], cutterDia, resultPathsRef, resultNumPathsRef, resultPathSizesRef]);

  const result = convertPathsFromCppToCamPath(memoryBlocks, resultPathsRef, resultNumPathsRef, resultPathSizesRef);

  for (let i = 0; i < memoryBlocks.length; ++i)
  Module._free(memoryBlocks[i]);

  return result;
  };
/CPP*/

/**
 * Compute paths for outline operation on Clipper geometry.
 * @param {InternalPath[]} geometry
 * @param {number} cutterDia is in internal units
 * @param {boolean} isInside
 * @param {boolean} width
 * @param {number} overlap is in the range [0, 1)
 * @param {boolean} climb
 * @return {CamPath[]}
 */
export function outline(geometry, cutterDia, isInside, width, overlap, climb) {
  let currentWidth = cutterDia;
  let allPaths = [];
  const eachWidth = cutterDia * (1 - overlap);

  let current;
  let bounds;
  let eachOffset;
  let needReverse;

  if (isInside) {
    current = ClipperPaths.offset(geometry, -cutterDia / 2);
    bounds = ClipperPaths.diff(current, ClipperPaths.offset(geometry, -(width - cutterDia / 2)));
    eachOffset = -eachWidth;
    needReverse = climb;
  } else {
    current = ClipperPaths.offset(geometry, cutterDia / 2);
    bounds = ClipperPaths.diff(ClipperPaths.offset(geometry, width - cutterDia / 2), current);
    eachOffset = eachWidth;
    needReverse = !climb;
  }

  while (currentWidth <= width) {
    let i;
    if (needReverse)
      for (i = 0; i < current.length; ++i)
        current[i].reverse();
    allPaths = current.concat(allPaths);
    const nextWidth = currentWidth + eachWidth;
    if (nextWidth > width && width - currentWidth > 0) {
      current = ClipperPaths.offset(current, width - currentWidth);
      if (needReverse)
        for (i = 0; i < current.length; ++i)
          current[i].reverse();
      allPaths = current.concat(allPaths);
      break;
    }
    currentWidth = nextWidth;
    current = ClipperPaths.offset(current, eachOffset);
  }
  return mergePaths(bounds, allPaths);
};

/**
 * Compute paths for engrave operation on Clipper geometry.
 * @param {InternalPath[]} geometry
 * @param {boolean} climb
 * @return {CamPath[]}
 */
export function engrave(geometry, climb) {
  const allPaths = [];
  for (let i = 0; i < geometry.length; ++i) {
    const path = geometry[i].slice(0);
    if (!climb)
      path.reverse();
    path.push(path[0]);
    allPaths.push(path);
  }
  const result = mergePaths(null, allPaths);
  for (let i = 0; i < result.length; ++i)
    result[i].safeToClose = true;
  return result;
};

/*CPP
function vPocket(geometry, cutterAngle, passDepth, maxDepth) {
  if (cutterAngle <= 0 || cutterAngle >= 180)
    return [];

  const memoryBlocks = [];

  const cGeometry = ClipperPaths.toCpp(geometry, memoryBlocks);

  const resultPathsRef = Module._malloc(4);
  const resultNumPathsRef = Module._malloc(4);
  const resultPathSizesRef = Module._malloc(4);
  memoryBlocks.push(resultPathsRef);
  memoryBlocks.push(resultNumPathsRef);
  memoryBlocks.push(resultPathSizesRef);

  //extern "C" void vPocket(
  //    int debugArg0, int debugArg1,
  //    double** paths, int numPaths, int* pathSizes,
  //    double cutterAngle, double passDepth, double maxDepth,
  //    double**& resultPaths, int& resultNumPaths, int*& resultPathSizes)
  Module.ccall(
    'vPocket',
    'void', ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
    [App.models.Misc.debugArg0(), App.models.Misc.debugArg1(), cGeometry[0], cGeometry[1], cGeometry[2], cutterAngle, passDepth, maxDepth, resultPathsRef, resultNumPathsRef, resultPathSizesRef]);

  const result = convertPathsFromCppToCamPath(memoryBlocks, resultPathsRef, resultNumPathsRef, resultPathSizesRef);

  for (let i = 0; i < memoryBlocks.length; ++i)
    Module._free(memoryBlocks[i]);

  return result;
};

let displayedCppTabError1 = false;
let displayedCppTabError2 = false;

// SMELL: unclear to me why this requires a call out, since Clipper
// can do what it seems to do (intersect polygons)
function separateTabs(cutterPath, tabGeometry) {
  if (tabGeometry.length == 0)
    return [cutterPath];

  if (typeof Module == 'undefined') {
    if (!displayedCppTabError1) {
      App.showAlert("Failed to load cam-cpp.js; tabs will be missing. This message will not repeat.", "alert-danger");
      displayedCppTabError1 = true;
    }
    return cutterPath;
  }

  const memoryBlocks = [];

  const cCutterPath = ClipperPaths.toCpp([ cutterPath ], memoryBlocks);
  const cTabGeometry = ClipperPaths.toCpp(tabGeometry, memoryBlocks);

  const errorRef = Module._malloc(4);
  const resultPathsRef = Module._malloc(4);
  const resultNumPathsRef = Module._malloc(4);
  const resultPathSizesRef = Module._malloc(4);
  memoryBlocks.push(errorRef);
  memoryBlocks.push(resultPathsRef);
  memoryBlocks.push(resultNumPathsRef);
  memoryBlocks.push(resultPathSizesRef);

  //extern "C" void separateTabs(
  //    double** pathPolygons, int numPaths, int* pathSizes,
  //    double** tabPolygons, int numTabPolygons, int* tabPolygonSizes,
  //    bool& error,
  //    double**& resultPaths, int& resultNumPaths, int*& resultPathSizes)
  Module.ccall(
    'separateTabs',
    'void', ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
    [cCutterPath[0], cCutterPath[1], cCutterPath[2], cTabGeometry[0], cTabGeometry[1], cTabGeometry[2], errorRef, resultPathsRef, resultNumPathsRef, resultPathSizesRef]);

  if (Module.HEAPU32[errorRef >> 2] && !displayedCppTabError2) {
    App.showAlert("Internal error processing tabs; tabs will be missing. This message will not repeat.", "alert-danger", false);
   displayedCppTabError2 = true;
  }

  const result = ClipperPaths.fromCpp(
    memoryBlocks, resultPathsRef, resultNumPathsRef, resultPathSizesRef);

  for (let i = 0; i < memoryBlocks.length; ++i)
    Module._free(memoryBlocks[i]);

  return result;
}
/CPP*/

/**
 * Convert paths to gcode. Assumes that the current Z
 * position is safe.
 * @param {object} namedArgs
 * @param {CamPath[]} namedArgs.paths Paths to convert. These paths are
 * in internal units, and will be transformed to Gcode units using the
 * `Scale` parameters.
 * @param {number} namedArgs.xScale Factor to convert internal units to
 * gcode units
 * @param {number} namedArgs.yScale Factor to convert internal units to
 * gcode units
 * @param {number} namedArgs.zScale Factor to convert internal units to
 * gcode units
 * @param {boolean} namedArgs.ramp Ramp these paths?
 * @param {number} namedArgs.offsetX Offset X (Gcode units)
 * @param {number} namedArgs.offsetY Offset Y (Gcode units)
 * @param {number} namedArgs.decimal Number of decimal places to keep
 * in gcode
 * @param {number} namedArgs.topZ Top of area to cut (Gcode units)
 * @param {number} namedArgs.botZ Bottom of area to cut (Gcode units)
 * @param {number} namedArgs.safeZ Z position to safely move over
 * uncut areas (Gcode units)
 * @param {number} namedArgs.passDepth Cut depth for each pass (Gcode
 * units)
 * @param {number} namedArgs.plungeFeed Feedrate to plunge cutter
 * (Gcode units)
 * @param {number} namedArgs.retractFeed Feedrate to retract cutter
 * (Gcode units)
 * @param {number} namedArgs.cutFeed Feedrate for horizontal cuts
 * (Gcode units)
 * @param {number} namedArgs.rapidFeed Feedrate for rapid moves (Gcode
 * units)
 *
 * @param {boolean} namedArgs.useZ Use Z coordinates in paths?
 * (optional, defaults to false)
 * @param {number} namedArgs.tabGeometry Tab geometry (optional), will be
 * defined in internal units and require scaling.
 * @param {number} namedArgs.tabZ Z position over tabs (required if
 * tabGeometry is not empty) (Gcode units)
 * @return {string[]} array of Gcode lines
 */
export function getGcode(namedArgs) {
  const paths = namedArgs.paths;
  const ramp = namedArgs.ramp;
  const xScale = namedArgs.xScale;
  const yScale = namedArgs.yScale;
  const zScale = namedArgs.zScale;
  const offsetX = namedArgs.offsetX;
  const offsetY = namedArgs.offsetY;
  const decimal = namedArgs.decimal;
  const topZ = namedArgs.topZ;
  const botZ = namedArgs.botZ;
  const safeZ = namedArgs.safeZ;
  const passDepth = namedArgs.passDepth;
  const plungeF = `F${namedArgs.plungeFeed}`;
  const cutF = `F${namedArgs.cutFeed}`;
  const rapidF = `F${namedArgs.rapidFeed}`;
  const useZ = namedArgs.useZ ?? false;
  let tabGeometry = namedArgs.tabGeometry;
  let tabZ = namedArgs.tabZ;

  // Tab depth must be > the botZ depth of the Operation. If it isn't,
  // then ignore the tab geometry
  if (!tabGeometry || tabGeometry.length === 0) {
    tabZ = botZ;
  }
  if (tabGeometry && tabZ <= botZ) {
    App.showAlert(
      "Tabs are cut deeper than the max operation depth, and will be ignored.",
      'alert-warning');
    tabGeometry = undefined;
  }

  const gcode = [];

  const retractToSafeZ =
        `G1 Z${safeZ.toFixed(decimal)} ${rapidF} ; Retract`;

  const retractForTabGcode =
      `G1 Z${tabZ.toFixed(decimal)} ${rapidF} ; Retract for tab`;

  // Scale and offset a internal X coordinate to gcode units
  function getX(x) {
    return x * xScale + offsetX;
  }

  // Scale and offset an internal Y coordinate to gcode units
  function getY(y) {
    return y * yScale + offsetY;
  }

  // Generate Gcode for a point, scaling internal to gcode units
  function convertPoint(p, useZ) {
    const result = [
      `X${getX(p.X).toFixed(decimal)}`,
      `Y${getY(p.Y).toFixed(decimal)}`
    ];
    if (useZ)
      result.push(`Z${(p.Z * zScale + topZ).toFixed(decimal)}`);
    return result.join(" ");
  }

  let pathIndex = 0;
  for (const path of paths) {
    const origPath = path.path;
    if (origPath.length == 0)
      continue;

    const separatedPaths = tabGeometry
          ? separateTabs(origPath, tabGeometry) // CPP
          : [ origPath ];

    gcode.push(`; Path ${pathIndex++}`);

    let currentZ = safeZ;
    let finishedZ = topZ;

    while (finishedZ > botZ) {
      const nextZ = Math.max(finishedZ - passDepth, botZ);

      if (currentZ < safeZ && (!path.safeToClose || tabGeometry)) {
        gcode.push(retractToSafeZ);
        currentZ = safeZ;
      }

      currentZ = tabGeometry ? Math.max(finishedZ, tabZ) : finishedZ;

      gcode.push(
        "; Rapid to initial position",
        `G1 ${convertPoint(origPath[0], false)} ${rapidF}`,
        `G1 Z${currentZ.toFixed(decimal)}`);

      let selectedPaths;
      if (nextZ >= tabZ || useZ)
        selectedPaths = [origPath];
      else
        selectedPaths = separatedPaths;

      for (let selectedIndex = 0;
           selectedIndex < selectedPaths.length; ++selectedIndex) {
        const selectedPath = selectedPaths[selectedIndex];
        if (selectedPath.length == 0)
          continue;

        if (!useZ) {
          let selectedZ;
          if (selectedIndex & 1)
            selectedZ = tabZ;
          else
            selectedZ = nextZ;

          if (selectedZ < currentZ) {
            let executedRamp = false;
            if (ramp) {
              const minPlungeTime = (currentZ - selectedZ)
                    / namedArgs.plungeFeed;
              const idealDist = namedArgs.cutFeed * minPlungeTime;
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
              if (totalDist > 0) {
                gcode.push('; ramp');
                executedRamp = true;
                const rampPath = selectedPath.slice(0, end)
                      .concat(selectedPath.slice(0, end - 1).reverse());
                let distTravelled = 0;
                for (let i = 1; i < rampPath.length; ++i) {
                  distTravelled += dist(getX(rampPath[i - 1]),
                                        getY(rampPath[i - 1]),
                                        getX(rampPath[i]),
                                        getY(rampPath[i]));
                  const newZ = currentZ + distTravelled
                        / totalDist * (selectedZ - currentZ);
                  let gc = `G1 ${convertPoint(rampPath[i], false)} Z${newZ.toFixed(decimal)}`;
                  if (i == 1) {
                    const feed = Math.min(totalDist / minPlungeTime,
                                          namedArgs.cutFeed);
                    gc += ` F${feed.toFixed(decimal)}`;
                  }
                  gcode.push(gc);
                }
              }
            }
            if (!executedRamp) {
              gcode.push('M4 ; start spindle');
              gcode.push(
                `G1 Z${selectedZ.toFixed(decimal)} ${plungeF} ; plunge`);
            }
          } else if (selectedZ > currentZ) {
            gcode.push(retractForTabGcode);
          }
          currentZ = selectedZ;
        } // !useZ

        gcode.push('; cut');

        for (let i = 1; i < selectedPath.length; ++i) {
          gcode.push(
            `G1 ${convertPoint(selectedPath[i], useZ)} ${i == 1 ? cutF : ""}`);
        }
      } // selectedIndex
      finishedZ = nextZ;
      if (useZ)
        break;
    } // while (finishedZ > botZ)
    gcode.push(retractToSafeZ);
    gcode.push("M5 ; stop spindle");
  } // pathIndex

  return gcode;
}

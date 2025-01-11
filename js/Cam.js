/*Copyright Tim Fleming, Crawford Currie 2014-2024. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

//CPP /* global Module */ // from Emscripten
/* global App */

import * as InternalPaths from "./InternalPaths.js";

/**
 * Support for different CAM operations
 * @namespace Cam
 */

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
 * @memberof Cam
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
 * Try to merge paths. A merged path doesn't cross outside of bounds.
 * @param {InternalPath} bounds
 * @param {InternalPath[]} paths
 * @return {CamPath[]} merged paths
 * @memberof Cam
 */
export function mergePaths(bounds, paths) {
  return InternalPaths.mergePaths(bounds, paths).map(path => {
    // convert to CamPath
    return {
      path: path,
      safeToClose: !InternalPaths.crosses(bounds, path[0], path[path.length - 1])
    };});
}

/**
 * Compute paths for pocket operation on Clipper geometry.
 * @param {number} cutterDia is in internal units
 * @param {number} overlap is in the range [0, 1)
 * @return {CamPath[]}
 * @memberof Cam
 */
export function pocket(geometry, cutterDia, overlap, climb) {
  let current = InternalPaths.offset(geometry, -cutterDia / 2);
  const bounds = current.slice(0);
  let allPaths = [];
  while (current.length != 0) {
    if (climb)
      for (let i = 0; i < current.length; ++i)
        current[i].reverse();
    allPaths = current.concat(allPaths);
    current = InternalPaths.offset(current, -cutterDia * (1 - overlap));
  }
  return mergePaths(bounds, allPaths);
};

/*CPP*
 * Compute paths for vPocket operation on Clipper geometry.
 * @param {number} cutterDia is in internal units
 * @param {number} overlap is in the range [0, 1)
 * @return {CamPath[]}
 * @memberof Cam
 *
export function hspocket(geometry, cutterDia, overlap, climb) {
  const memoryBlocks = [];

  const cGeometry = InternalPaths.toCpp(geometry, memoryBlocks);

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
 * @memberof Cam
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
    current = InternalPaths.offset(geometry, -cutterDia / 2);
    bounds = InternalPaths.diff(current, InternalPaths.offset(geometry, -(width - cutterDia / 2)));
    eachOffset = -eachWidth;
    needReverse = climb;
  } else {
    current = InternalPaths.offset(geometry, cutterDia / 2);
    bounds = InternalPaths.diff(InternalPaths.offset(geometry, width - cutterDia / 2), current);
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
      current = InternalPaths.offset(current, width - currentWidth);
      if (needReverse)
        for (i = 0; i < current.length; ++i)
          current[i].reverse();
      allPaths = current.concat(allPaths);
      break;
    }
    currentWidth = nextWidth;
    current = InternalPaths.offset(current, eachOffset);
  }
  return mergePaths(bounds, allPaths);
};

/**
 * Compute paths for engrave operation on Clipper geometry.
 * @param {InternalPath[]} geometry
 * @param {boolean} climb
 * @return {CamPath[]}
 * @memberof Cam
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

  const cGeometry = InternalPaths.toCpp(geometry, memoryBlocks);

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
/CPP*/

/**
 * Currently does nothing
 * @private
 */
export function separateTabs(cutterPath, tabGeometry) {
/*CPP
// SMELL: unclear to me why this requires a call out, since Clipper
// can do what it seems to do (intersect polygons)
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

  const cCutterPath = InternalPaths.toCpp([ cutterPath ], memoryBlocks);
  const cTabGeometry = InternalPaths.toCpp(tabGeometry, memoryBlocks);

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

  const result = InternalPaths.fromCpp(
    memoryBlocks, resultPathsRef, resultNumPathsRef, resultPathSizesRef);

  for (let i = 0; i < memoryBlocks.length; ++i)
    Module._free(memoryBlocks[i]);

  return result;
/CPP*/
}

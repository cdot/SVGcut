/* global describe, it, assert */

import ClipperLib from "clipper-lib";
global.ClipperLib = ClipperLib;
ClipperLib.use_xyz = true;

import { UNit } from "./TestSupport.js";
import { UnitConverter } from "../src/UnitConverter.js";
const d = UnitConverter.from.px.to.integer;
let CutPoint, CutPath, CutPaths, Pocket;

describe("Pocket", () => {
  let page;

  // CutPath depends on ClipperLib
  before(() => {
    return Promise.all([
      import("../src/CutPoint.js"),
      import("../src/CutPath.js"),
      import("../src/CutPaths.js"),
      import("../src/Pocket.js") ])
    .then(mods => {
      CutPoint = mods[0].CutPoint;
      CutPath = mods[1].CutPath;
      CutPaths = mods[2].CutPaths;
      Pocket = mods[3].Pocket;
      page = new CutPaths(
        [[{X:-10,Y:-10},{X:140,Y:-10},{X:140,Y:140},{X:-10,Y:140}]]);
    });
  });

  it("flat x raster pocket", () => {
    const path = new CutPaths([[
      { X: -100, Y:   0 },
      { X:    0, Y: 100 },
      { X:  100, Y:   0 },
      { X:    0, Y:  50 }
    ]], true);
    const params = {
      cutterDiameter: 10,
      overlap: 0.5,
      climb: false,
      joinType: 0,
      mitreLimit: 2,
      strategy: "FlatXRaster"
    };
    const gen = new Pocket();
    const result = gen.generateToolpaths(path, params);
    assert.almost(result, new CutPaths(
      [
        new CutPath([
          { X: 0, Y: 92, Z: 0 },
          { X: -73, Y: 19, Z: 0 },
          { X: 0, Y: 56, Z: 0 },
          { X: 73, Y: 19, Z: 0 },
        ], true),
        new CutPath([
          { X: -5, Y: 87, Z: 0 },
          { X: -0, Y: 87, Z: 0 },
          { X: -0, Y: 82, Z: 0 },
          { X: -10, Y: 82, Z: 0 },
          { X: -15, Y: 77, Z: 0 },
          { X: -0, Y: 77, Z: 0 },
          { X: -0, Y: 72, Z: 0 },
          { X: -20, Y: 72, Z: 0 },
          { X: -25, Y: 67, Z: 0 },
          { X: -0, Y: 67, Z: 0 },
          { X: -0, Y: 62, Z: 0 },
          { X: -30, Y: 62, Z: 0 },
          { X: -35, Y: 57, Z: 0 },
          { X: -0, Y: 57, Z: 0 },
          { X: -7.891891891891893, Y: 52, Z: 0 },
          { X: -40, Y: 52, Z: 0 },
          { X: -45, Y: 47, Z: 0 },
          { X: -17.75675675675675, Y: 47, Z: 0 },
          { X: -27.621621621621625, Y: 42, Z: 0 },
          { X: -50, Y: 42, Z: 0 },
          { X: -55, Y: 37, Z: 0 },
          { X: -37.486486486486484, Y: 37, Z: 0 },
          { X: -47.35135135135135, Y: 32, Z: 0 },
          { X: -60, Y: 32, Z: 0 },
          { X: -65, Y: 27, Z: 0 },
          { X: -57.21621621621622, Y: 27, Z: 0 },
          { X: -67.08108108108108, Y: 22, Z: 0 },
          { X: -70, Y: 22, Z: 0 }
        ], false),
        new CutPath([
          { X: 0, Y: 87, Z: 0 },
          { X: 5, Y: 87, Z: 0 },
          { X: 10, Y: 82, Z: 0 },
          { X: 0, Y: 82, Z: 0 },
          { X: 0, Y: 77, Z: 0 },
          { X: 15, Y: 77, Z: 0 },
          { X: 20, Y: 72, Z: 0 },
          { X: 0, Y: 72, Z: 0 },
          { X: 0, Y: 67, Z: 0 },
          { X: 25, Y: 67, Z: 0 },
          { X: 30, Y: 62, Z: 0 },
          { X: 0, Y: 62, Z: 0 },
          { X: 0, Y: 57, Z: 0 },
          { X: 35, Y: 57, Z: 0 },
          { X: 40, Y: 52, Z: 0 },
          { X: 7.891891891891893, Y: 52, Z: 0 },
          { X: 17.75675675675675, Y: 47, Z: 0 },
          { X: 45, Y: 47, Z: 0 },
          { X: 50, Y: 42, Z: 0 },
          { X: 27.621621621621625, Y: 42, Z: 0 },
          { X: 37.486486486486484, Y: 37, Z: 0 },
          { X: 55, Y: 37, Z: 0 },
          { X: 60, Y: 32, Z: 0 },
          { X: 47.35135135135135, Y: 32, Z: 0 },
          { X: 57.21621621621622, Y: 27, Z: 0 },
          { X: 65, Y: 27, Z: 0 },
          { X: 70, Y: 22, Z: 0 },
          { X: 67.08108108108108, Y: 22, Z: 0 }
        ], false)
      ]));
  });
});

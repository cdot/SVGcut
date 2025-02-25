/* global describe, it, assert */

import ClipperLib from "clipper-lib";
global.ClipperLib = ClipperLib;
ClipperLib.use_xyz = true;

import { UNit } from "./TestSupport.js";
import { UnitConverter } from "../src/UnitConverter.js";
const d = UnitConverter.from.px.to.integer;
let CutPoint, CutPath, CutPaths, AnnularPocket;

describe("AnnularPocket", () => {
  let page;

  // CutPath depends on ClipperLib
  before(() => {
    return Promise.all([
      import("../src/CutPoint.js"),
      import("../src/CutPath.js"),
      import("../src/CutPaths.js"),
      import("../src/AnnularPocket.js") ])
    .then(mods => {
      CutPoint = mods[0].CutPoint;
      CutPath = mods[1].CutPath;
      CutPaths = mods[2].CutPaths;
      AnnularPocket = mods[3].AnnularPocket;
      page = new CutPaths(
        [[{X:-10,Y:-10},{X:140,Y:-10},{X:140,Y:140},{X:-10,Y:140}]]);
    });
  });
  it("annular pocket", () => {
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
      mitreLimit: 2
    };
    const gen = new AnnularPocket();
    const result = gen.generateToolpaths(path, params);
    assert.almost(result, new CutPaths(
      [
        [
          { X: 0, Y: 92, Z: 0 },
          { X: -73, Y: 19, Z: 0 },
          { X: 0, Y: 56, Z: 0 },
          { X: 73, Y: 19, Z: 0 },
          { X: 0, Y: 92, Z: 0 },
          { X: -46, Y: 38, Z: 0 },
          { X: 0, Y: 62, Z: 0 },
          { X: 46, Y: 38, Z: 0 },
          { X: 0, Y: 84, Z: 0 },
          { X: -46, Y: 38, Z: 0 },
          { X: -17, Y: 59, Z: 0 },
          { X: 0, Y: 68, Z: 0 },
          { X: 17, Y: 59, Z: 0 },
          { X: 0, Y: 76, Z: 0 },
          { X: -17, Y: 59, Z: 0 },
        ]
      ], false));
  });
});

/* global describe, it, assert */

import ClipperLib from "clipper-lib";
global.ClipperLib = ClipperLib;
ClipperLib.use_xyz = true;

import { UNit } from "./TestSupport.js";
import { UnitConverter } from "../src/UnitConverter.js";
const d = UnitConverter.from.px.to.integer;
let CutPoint, CutPath, CutPaths, Outside;

describe("Outside", () => {

  // CutPath depends on ClipperLib
  before(() => {
    return Promise.all([
      import("../src/CutPoint.js"),
      import("../src/CutPath.js"),
      import("../src/CutPaths.js"),
      import("../src/Outside.js") ])
    .then(mods => {
      CutPoint = mods[0].CutPoint;
      CutPath = mods[1].CutPath;
      CutPaths = mods[2].CutPaths;
      Outside = mods[3].Outside;
    });
  });

  it("outside path", () => {
    const path = new CutPaths([[
      { X:   0, Y:   0 },
      { X: 100, Y:   0 },
      { X: 100, Y: 100 },
      { X:   0, Y: 100 }
    ]], true);
    const params = {
      cutterDiameter: 1,
      width: 2,
      overlap: 0.5,
      climb: false
    };
    const gen = new Outside();
    const result = gen.generateToolpaths(path, params);
    assert.deepEqual(result, new CutPaths(
      [
        [
          { X: 101, Y: -1, Z: 0 },
          { X: -1, Y: -1, Z: 0 },
          { X: -1, Y: 101, Z: 0 },
          { X: 101, Y: 101, Z: 0 },
          { X: 101, Y: -1, Z: 0 },
          { X: -2, Y: -2, Z: 0 },
          { X: -2, Y: 102, Z: 0 },
          { X: 102, Y: 102, Z: 0 },
          { X: 102, Y: -2, Z: 0 },
          { X: -2, Y: -2, Z: 0 },
        ],
        [
          { X: -3, Y: -3, Z: 0 },
          { X: -3, Y: 103, Z: 0 },
          { X: 103, Y: 103, Z: 0 },
          { X: 103, Y: -3, Z: 0 },
          { X: -3, Y: -3, Z: 0 },
        ]
      ], true));
  });
});

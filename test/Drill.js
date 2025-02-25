/* global describe, it, assert */

import ClipperLib from "clipper-lib";
global.ClipperLib = ClipperLib;
ClipperLib.use_xyz = true;

import { UNit } from "./TestSupport.js";
import { UnitConverter } from "../src/UnitConverter.js";
const d = UnitConverter.from.px.to.integer;
let CutPoint, CutPath, CutPaths, Drill;

describe("Drill", () => {
  // CutPath depends on ClipperLib
  before(() => {
    return Promise.all([
      import("../src/CutPoint.js"),
      import("../src/CutPath.js"),
      import("../src/CutPaths.js"),
      import("../src/Drill.js") ])
    .then(mods => {
      CutPoint = mods[0].CutPoint;
      CutPath = mods[1].CutPath;
      CutPaths = mods[2].CutPaths;
      Drill = mods[3].Drill;
    });
  });

  it("drill path", () => {
    const path = new CutPaths([[
      { X:   0, Y:   0 },
      { X: 100, Y:   0 },
      { X: 100, Y: 100 },
      { X:   0, Y: 100 }
    ]], true);
    const params = {
      safeZ: 5,
      botZ: -5
    };
    const result = (new Drill()).generateToolpaths(path, params);
    assert.deepEqual(result, new CutPaths(
      [
        [
          { X: 0, Y: 0, Z: 5 }, // move
          { X: 0, Y: 0, Z: -5 }, // top left
          { X: 0, Y: 0, Z: 5 }, // clear
          { X: 100, Y: 0, Z: 5 }, // move
          { X: 100, Y: 0, Z: -5 }, // top right
          { X: 100, Y: 0, Z: 5 }, // clear
          { X: 100, Y: 100, Z: 5 }, // move
          { X: 100, Y: 100, Z: -5 }, // bottom right
          { X: 100, Y: 100, Z: 5 }, // clear
          { X: 0, Y: 100, Z: 5 }, // move
          { X: 0, Y: 100, Z: -5 }, // bottom left
          { X: 0, Y: 100, Z: 5 }, // clear
        ]
      ],false));
  });
});

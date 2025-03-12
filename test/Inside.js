/* global describe, it, assert */

import ClipperLib from "clipper-lib";
global.ClipperLib = ClipperLib;
ClipperLib.use_xyz = true;

import { UNit } from "./TestSupport.js";
import { UnitConverter } from "../src/UnitConverter.js";
const d = UnitConverter.from.px.to.integer;
let CutPoint, CutPath, CutPaths, Engrave;

describe("Engrave", () => {

  // CutPath depends on ClipperLib
  before(() => {
    return Promise.all([
      import("../src/CutPoint.js"),
      import("../src/CutPath.js"),
      import("../src/CutPaths.js"),
      import("../src/Engrave.js") ])
    .then(mods => {
      CutPoint = mods[0].CutPoint;
      CutPath = mods[1].CutPath;
      CutPaths = mods[2].CutPaths;
      Engrave = mods[3].Engrave;
    });
  });

  it("inside path", () => {
    const path = new CutPaths([[
      { X:   0, Y:   0 },
      { X: 1000, Y:   0 },
      { X: 1000, Y: 1000 },
      { X:   0, Y: 1000 }
    ]], true);
    const params = {
      cutterDiameter: 10,
      offset: "Inside",
      width: 20,
      overlap: 0.5,
      margin: 0,
      climb: true
    };
    const gen = new Engrave();
    const result = gen.generateToolpaths(path, params);
    assert.deepEqual(result, new CutPaths([
      [
        { X: 995, Y: 995, Z: 0 },
        { X: 5, Y: 995, Z: 0 },
        { X: 5, Y: 5, Z: 0 },
        { X: 995, Y: 5, Z: 0 },
        { X: 995, Y: 995, Z: 0 },

        { X: 990, Y: 990, Z: 0 },
        { X: 10, Y: 990, Z: 0 },
        { X: 10, Y: 10, Z: 0 },
        { X: 990, Y: 10, Z: 0 },
        { X: 990, Y: 990, Z: 0 },

        { X: 985, Y: 985, Z: 0 },
        { X: 15, Y: 985, Z: 0 },
        { X: 15, Y: 15, Z: 0 },
        { X: 985, Y: 15, Z: 0 },
        { X: 985, Y: 985, Z: 0 },
      ]
    ], false));
  });
  // TODO: test with margin
});

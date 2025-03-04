/* global describe, it, assert */

import ClipperLib from "clipper-lib";
global.ClipperLib = ClipperLib;
ClipperLib.use_xyz = true;

import { UNit } from "./TestSupport.js";
import { UnitConverter } from "../src/UnitConverter.js";
const d = UnitConverter.from.px.to.integer;
let CutPoint, CutPath, CutPaths, Perforate;

describe("Perforate", () => {

  // CutPath depends on ClipperLib
  before(() => {
    return Promise.all([
      import("../src/CutPoint.js"),
      import("../src/CutPath.js"),
      import("../src/CutPaths.js"),
      import("../src/Perforate.js") ])
    .then(mods => {
      CutPoint = mods[0].CutPoint;
      CutPath = mods[1].CutPath;
      CutPaths = mods[2].CutPaths;
      Perforate = mods[3].Perforate;
    });
  });

  it("perforate simple open path", () => {
    const path = new CutPath([
      //  --------
      // -o--oo--o-
      { X: 0, Y: 0 }, { X: 4, Y: 0 }
    ], false);
    const params = {
      cutterDiameter: 1,
      spacing: 1
    };
    const result = (new Perforate()).perforatedPath(path, params);
    assert.almost(result, new CutPath([
      { X: 0, Y: 0 },
      { X: 2, Y: 0 },
      { X: 4, Y: 0 }
    ]));
  });

  it("perforate simple open square", () => {
    const path = new CutPath([
      { X: 0, Y: 0 },
      { X: 4, Y: 0 },
      { X: 4, Y: 4 },
      { X: 0, Y: 4 }
    ], false);
    const params = {
      cutterDiameter: 1,
      spacing: 1
    };
    const result = (new Perforate()).perforatedPath(path, params);
    assert.almost(result, new CutPath([
      { X: 0, Y: 0, Z: 0 },
      { X: 2, Y: 0, Z: 0 },
      { X: 4, Y: 0, Z: 0 },
      { X: 4, Y: 2, Z: 0 },
      { X: 4, Y: 4, Z: 0 },
      { X: 2, Y: 4, Z: 0 },
      { X: 0, Y: 4, Z: 0 },
    ], false));
  });

  it("perforate simple closed square", () => {
    const path = new CutPath([
      { X: 0, Y: 0 },
      { X: 4, Y: 0 },
      { X: 4, Y: 4 },
      { X: 0, Y: 4 }
    ], true);
    const params = {
      cutterDiameter: 1,
      spacing: 1
    };
    const result = (new Perforate()).perforatedPath(path, params);
    assert.almost(result, new CutPath([
      { X: 0, Y: 0, Z: 0 },
      { X: 2, Y: 0, Z: 0 },
      { X: 4, Y: 0, Z: 0 },
      { X: 4, Y: 2, Z: 0 },
      { X: 4, Y: 4, Z: 0 },
      { X: 2, Y: 4, Z: 0 },
      { X: 0, Y: 4, Z: 0 },
      { X: 0, Y: 2, Z: 0 }
    ], false));
  });

  it("perforate open path", () => {
    const path = new CutPaths([[
      { X:   0, Y: 0 },
      { X: 100, Y: 0 },
      { X: 100, Y: 100 },
      { X:   0, Y: 100 }
    ]], false);
    const params = {
      cutterDiameter: 2,
      spacing: 18,
      safeZ: 5,
      botZ: -5
    };
    const result = (new Perforate()).generateToolpaths(path, params);
    assert.almost(result, new CutPaths(
      [
        [
          { X: 0, Y: 0, Z: 5 },
          { X: 0, Y: 0, Z: -5 },
          { X: 0, Y: 0, Z: 5 },
          { X: 20, Y: 0, Z: 5 },
          { X: 20, Y: 0, Z: -5 },
          { X: 20, Y: 0, Z: 5 },
          { X: 40, Y: 0, Z: 5 },
          { X: 40, Y: 0, Z: -5 },
          { X: 40, Y: 0, Z: 5 },
          { X: 60, Y: 0, Z: 5 },
          { X: 60, Y: 0, Z: -5 },
          { X: 60, Y: 0, Z: 5 },
          { X: 80, Y: 0, Z: 5 },
          { X: 80, Y: 0, Z: -5 },
          { X: 80, Y: 0, Z: 5 },
          { X: 100, Y: 0, Z: 5 },
          { X: 100, Y: 0, Z: -5 },
          { X: 100, Y: 0, Z: 5 },
          { X: 100, Y: 20, Z: 5 },
          { X: 100, Y: 20, Z: -5 },
          { X: 100, Y: 20, Z: 5 },
          { X: 100, Y: 40, Z: 5 },
          { X: 100, Y: 40, Z: -5 },
          { X: 100, Y: 40, Z: 5 },
          { X: 100, Y: 60, Z: 5 },
          { X: 100, Y: 60, Z: -5 },
          { X: 100, Y: 60, Z: 5 },
          { X: 100, Y: 80, Z: 5 },
          { X: 100, Y: 80, Z: -5 },
          { X: 100, Y: 80, Z: 5 },
          { X: 100, Y: 100, Z: 5 },
          { X: 100, Y: 100, Z: -5 },
          { X: 100, Y: 100, Z: 5 },
          { X: 80, Y: 100, Z: 5 },
          { X: 80, Y: 100, Z: -5 },
          { X: 80, Y: 100, Z: 5 },
          { X: 60, Y: 100, Z: 5 },
          { X: 60, Y: 100, Z: -5 },
          { X: 60, Y: 100, Z: 5 },
          { X: 40, Y: 100, Z: 5 },
          { X: 40, Y: 100, Z: -5 },
          { X: 40, Y: 100, Z: 5 },
          { X: 20, Y: 100, Z: 5 },
          { X: 20, Y: 100, Z: -5 },
          { X: 20, Y: 100, Z: 5 },
          { X: 0, Y: 100, Z: 5 },
          { X: 0, Y: 100, Z: -5 },
          { X: 0, Y: 100, Z: 5 }
        ]
      ],false));
  });

  it("perforate closed path", () => {
    // A closed path is bloated by cutterDiameter/2 before perforation
    // So the bloated square would be 0,0->100,100. But the corners are
    // squared off.
    const path = new CutPaths([[
      { X:  10000, Y:  10000 },
      { X: 990000, Y:  10000 },
      { X: 990000, Y: 990000 },
      { X:  10000, Y: 990000 }
    ]], true);
    const params = {
      cutterDiameter: 20000,
      spacing: 180000,
      // A closed path is bloated by cutterDiameter/2 before perforation
      // Normally the corners would be rounded, but to maintain integer
      // we'll square them off.
      joinType: ClipperLib.JoinType.jtMiter,
      safeZ: 5,
      botZ: -5
    };
    const result = (new Perforate()).generateToolpaths(path, params);
    assert.almost(result, new CutPaths(
      [
        [
          { X: 1000000, Y: 1000000, Z: 5 },
          { X: 1000000, Y: 1000000, Z: -5 },
          { X: 1000000, Y: 1000000, Z: 5 },
          { X: 800000, Y: 1000000, Z: 5 },
          { X: 800000, Y: 1000000, Z: -5 },
          { X: 800000, Y: 1000000, Z: 5 },
          { X: 600000, Y: 1000000, Z: 5 },
          { X: 600000, Y: 1000000, Z: -5 },
          { X: 600000, Y: 1000000, Z: 5 },
          { X: 400000, Y: 1000000, Z: 5 },
          { X: 400000, Y: 1000000, Z: -5 },
          { X: 400000, Y: 1000000, Z: 5 },
          { X: 200000, Y: 1000000, Z: 5 },
          { X: 200000, Y: 1000000, Z: -5 },
          { X: 200000, Y: 1000000, Z: 5 },
          { X: 0, Y: 1000000, Z: 5 },
          { X: 0, Y: 1000000, Z: -5 },
          { X: 0, Y: 1000000, Z: 5 },
          { X: 0, Y: 800000, Z: 5 },
          { X: 0, Y: 800000, Z: -5 },
          { X: 0, Y: 800000, Z: 5 },
          { X: 0, Y: 600000, Z: 5 },
          { X: 0, Y: 600000, Z: -5 },
          { X: 0, Y: 600000, Z: 5 },
          { X: 0, Y: 400000, Z: 5 },
          { X: 0, Y: 400000, Z: -5 },
          { X: 0, Y: 400000, Z: 5 },
          { X: 0, Y: 200000, Z: 5 },
          { X: 0, Y: 200000, Z: -5 },
          { X: 0, Y: 200000, Z: 5 },
          { X: 0, Y: 0, Z: 5 },
          { X: 0, Y: 0, Z: -5 },
          { X: 0, Y: 0, Z: 5 },
          { X: 200000, Y: 0, Z: 5 },
          { X: 200000, Y: 0, Z: -5 },
          { X: 200000, Y: 0, Z: 5 },
          { X: 400000, Y: 0, Z: 5 },
          { X: 400000, Y: 0, Z: -5 },
          { X: 400000, Y: 0, Z: 5 },
          { X: 600000, Y: 0, Z: 5 },
          { X: 600000, Y: 0, Z: -5 },
          { X: 600000, Y: 0, Z: 5 },
          { X: 800000, Y: 0, Z: 5 },
          { X: 800000, Y: 0, Z: -5 },
          { X: 800000, Y: 0, Z: 5 },
          { X: 1000000, Y: 0, Z: 5 },
          { X: 1000000, Y: 0, Z: -5 },
          { X: 1000000, Y: 0, Z: 5 },
          { X: 1000000, Y: 200000, Z: 5 },
          { X: 1000000, Y: 200000, Z: -5 },
          { X: 1000000, Y: 200000, Z: 5 },
          { X: 1000000, Y: 400000, Z: 5 },
          { X: 1000000, Y: 400000, Z: -5 },
          { X: 1000000, Y: 400000, Z: 5 },
          { X: 1000000, Y: 600000, Z: 5 },
          { X: 1000000, Y: 600000, Z: -5 },
          { X: 1000000, Y: 600000, Z: 5 },
          { X: 1000000, Y: 800000, Z: 5 },
          { X: 1000000, Y: 800000, Z: -5 },
          { X: 1000000, Y: 800000, Z: 5 }
        ]
      ], false));
  });

  it("perforate scaled open path", () => {
    const path = new CutPath([
      { X: 0, Y: 0 }, { X: 7500000, Y: 0 }
    ], false);
    const params = {
      cutterDiameter: 100000,
      spacing: 100000
    };
    const result = (new Perforate()).perforatedPath(path, params);
    assert.equal(39, result.length);
    assert.almost(0, result[0].X);
    assert.almost(7500000, result[38].X);
  });
});

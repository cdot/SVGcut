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

  it("perforate single segment open path", () => {
    const path = new CutPath([
      //  --------
      // -o--oo--o-
      { X: 0, Y: 0 }, { X: 4000, Y: 0 }
    ], false);
    const params = {
      cutterDiameter: 1000,
      spacing: 1000
    };
    const result = (new Perforate()).perforatedPath(path, params);
    assert.almost(result, new CutPath([
      { X: 0, Y: 0 },
      { X: 2000, Y: 0 },
      { X: 4000, Y: 0 }
    ]));
  });

  it("perforate two segment open path", () => {
    const path = new CutPath([
      //  --------
      // -o--oo--o-
      { X: 0, Y: 0 }, { X: 1900, Y: 0 }, { X: 4000, Y: 0 }
    ], false);
    const params = {
      cutterDiameter: 1000,
      spacing: 1000
    };
    const result = (new Perforate()).perforatedPath(path, params);
    assert.almost(result, new CutPath([
      { X: 0, Y: 0 },
      { X: 2000, Y: 0 },
      { X: 4000, Y: 0 }
    ]));
  });

  it("perforate simple open square", () => {
    const path = new CutPath([
      { X:    0, Y:    0 },
      { X: 4000, Y:    0 },
      { X: 4000, Y: 4000 },
      { X:    0, Y: 4000 }
    ], false);
    const params = {
      cutterDiameter: 1000,
      spacing: 1000
    };
    const result = (new Perforate()).perforatedPath(path, params);
    assert.almost(result, new CutPath([
      { X:    0, Y:    0, Z: 0 },
      { X: 2000, Y:    0, Z: 0 },
      { X: 4000, Y:    0, Z: 0 },
      { X: 4000, Y: 2000, Z: 0 },
      { X: 4000, Y: 4000, Z: 0 },
      { X: 2000, Y: 4000, Z: 0 },
      { X:    0, Y: 4000, Z: 0 },
    ], false));
  });

  it("perforate simple closed square", () => {
    const path = new CutPath([
      { X: 0, Y: 0 },
      { X: 4000, Y: 0 },
      { X: 4000, Y: 4000 },
      { X: 0, Y: 4000 }
    ], true);
    const params = {
      cutterDiameter: 1000,
      spacing: 1000
    };
    const result = (new Perforate()).perforatedPath(path, params);
    assert.almost(result, new CutPath([
      { X:    0, Y:    0, Z: 0 },
      { X: 2000, Y:    0, Z: 0 },
      { X: 4000, Y:    0, Z: 0 },
      { X: 4000, Y: 2000, Z: 0 },
      { X: 4000, Y: 4000, Z: 0 },
      { X: 2000, Y: 4000, Z: 0 },
      { X:    0, Y: 4000, Z: 0 },
      { X:    0, Y: 2000, Z: 0 },
      { X:    0, Y:    0, Z: 0 },
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
          { X: 10000, Y: 10000, Z: 5 },
          { X: 10000, Y: 10000, Z: -5 },
          { X: 10000, Y: 10000, Z: 5 },
          { X: 206000, Y: 10000, Z: 5 },
          { X: 206000, Y: 10000, Z: -5 },
          { X: 206000, Y: 10000, Z: 5 },
          { X: 402000, Y: 10000, Z: 5 },
          { X: 402000, Y: 10000, Z: -5 },
          { X: 402000, Y: 10000, Z: 5 },
          { X: 598000, Y: 10000, Z: 5 },
          { X: 598000, Y: 10000, Z: -5 },
          { X: 598000, Y: 10000, Z: 5 },
          { X: 794000, Y: 10000, Z: 5 },
          { X: 794000, Y: 10000, Z: -5 },
          { X: 794000, Y: 10000, Z: 5 },
          { X: 990000, Y: 10000, Z: 5 },
          { X: 990000, Y: 10000, Z: -5 },
          { X: 990000, Y: 10000, Z: 5 },
          { X: 990000, Y: 206000, Z: 5 },
          { X: 990000, Y: 206000, Z: -5 },
          { X: 990000, Y: 206000, Z: 5 },
          { X: 990000, Y: 402000, Z: 5 },
          { X: 990000, Y: 402000, Z: -5 },
          { X: 990000, Y: 402000, Z: 5 },
          { X: 990000, Y: 598000, Z: 5 },
          { X: 990000, Y: 598000, Z: -5 },
          { X: 990000, Y: 598000, Z: 5 },
          { X: 990000, Y: 794000, Z: 5 },
          { X: 990000, Y: 794000, Z: -5 },
          { X: 990000, Y: 794000, Z: 5 },
          { X: 990000, Y: 990000, Z: 5 },
          { X: 990000, Y: 990000, Z: -5 },
          { X: 990000, Y: 990000, Z: 5 },
          { X: 794000, Y: 990000, Z: 5 },
          { X: 794000, Y: 990000, Z: -5 },
          { X: 794000, Y: 990000, Z: 5 },
          { X: 598000, Y: 990000, Z: 5 },
          { X: 598000, Y: 990000, Z: -5 },
          { X: 598000, Y: 990000, Z: 5 },
          { X: 402000, Y: 990000, Z: 5 },
          { X: 402000, Y: 990000, Z: -5 },
          { X: 402000, Y: 990000, Z: 5 },
          { X: 206000, Y: 990000, Z: 5 },
          { X: 206000, Y: 990000, Z: -5 },
          { X: 206000, Y: 990000, Z: 5 },
          { X: 10000, Y: 990000, Z: 5 },
          { X: 10000, Y: 990000, Z: -5 },
          { X: 10000, Y: 990000, Z: 5 },
          { X: 10000, Y: 794000, Z: 5 },
          { X: 10000, Y: 794000, Z: -5 },
          { X: 10000, Y: 794000, Z: 5 },
          { X: 10000, Y: 598000, Z: 5 },
          { X: 10000, Y: 598000, Z: -5 },
          { X: 10000, Y: 598000, Z: 5 },
          { X: 10000, Y: 402000, Z: 5 },
          { X: 10000, Y: 402000, Z: -5 },
          { X: 10000, Y: 402000, Z: 5 },
          { X: 10000, Y: 206000, Z: 5 },
          { X: 10000, Y: 206000, Z: -5 },
          { X: 10000, Y: 206000, Z: 5 },
          { X: 10000, Y: 10000, Z: 5 },
          { X: 10000, Y: 10000, Z: -5 },
          { X: 10000, Y: 10000, Z: 5 },

        ]
      ], false));
  });
});

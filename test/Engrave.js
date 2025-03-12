/* global describe, it, assert */

import ClipperLib from "clipper-lib";
global.ClipperLib = ClipperLib;
ClipperLib.use_xyz = true;

import { UNit } from "./TestSupport.js";
import { UnitConverter } from "../src/UnitConverter.js";
const d = UnitConverter.from.px.to.integer;
let CutPoint, CutPath, CutPaths, Engrave;

describe("Engrave", () => {
  let page;

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
      page = new CutPaths(
        [[{X:-10,Y:-10},{X:140,Y:-10},{X:140,Y:140},{X:-10,Y:140}]]);
    });
  });

  it("engrave closed", () => {
    const path = new CutPaths([[
      { X:   0, Y:   0 },
      { X: 100, Y:   0 },
      { X: 100, Y: 100 },
      { X:   0, Y: 100 }
    ]], true);
    const params = {
      offset: "On",
      margin: 0,
      overlap: 0,
      width: 1,
      cutterDiameter: 1,
      climb: false
    };
    const op = new Engrave();
    const result = op.generateToolpaths(path, params);
    assert.deepEqual(result,new CutPaths([
      [
        { X: 0, Y: 100, Z: 0 },
        { X: 100, Y: 100, Z: 0 },
        { X: 100, Y: 0, Z: 0 },
        { X: 0, Y: 0, Z: 0 },
      ]
    ], true));
  });

  it("engrave closed wide", () => {
    const path = new CutPaths([[
      { X:   0, Y:   0 },
      { X: 10000, Y:   0 },
      { X: 10000, Y: 10000 },
      { X:   0, Y: 10000 }
    ]], true);
    const params = {
      offset: "On",
      margin: 0,
      overlap: 0,
      cutterDiameter: 100,
      width: 200, // should give us 2 passes
      climb: false
    };
    const op = new Engrave();
    const result = op.generateToolpaths(path, params);
    assert.deepEqual(result,new CutPaths(
      [
        [
          { X: 10050, Y: -50, Z: 0 },
          { X: -50, Y: -50, Z: 0 },
          { X: -50, Y: 10050, Z: 0 },
          { X: 10050, Y: 10050, Z: 0 },
          { X: 10050, Y: -50, Z: 0 },
          { X: 9950, Y: 50, Z: 0 },
          { X: 50, Y: 50, Z: 0 },
          { X: 50, Y: 9950, Z: 0 },
          { X: 9950, Y: 9950, Z: 0 },
          { X: 9950, Y: 50, Z: 0 }
        ]
      ], false));
  });

  it("engrave open", () => {
    const path = new CutPaths([[
      { X: 0, Y: 0 },
      { X: 10000, Y: 0 },
    ]], false);
    const params = {
      offset: "On",
      margin: 0,
      overlap: 0,
      cutterDiameter: 100,
      width: 0,
      climb: false
    };
    const op = new Engrave();
    const result = op.generateToolpaths(path, params);
    assert.deepEqual(result, new CutPaths(
      [
        [
          { X: 10000, Y: 0, Z: 0 },
          { X: 0, Y: 0, Z: 0 },
        ]
      ], false));
  });

  it("engrave open wide", () => {
    const path = new CutPaths([[
      { X: 0, Y: 0 },
      { X: 10000, Y: 0 },
    ]], false);
    const params = {
      offset: "On",
      margin: 0,
      overlap: 0,
      cutterDiameter: 100,
      width: 200, // should give us 2 passes
      climb: false
    };
    const op = new Engrave();
    const result = op.generateToolpaths(path, params);
    assert.deepEqual(result, new CutPaths(
      [
        [
          { X: 10000, Y: -50, Z: 0 },
          { X: 0, Y: -50, Z: 0 },
          { X: 0, Y: 50, Z: 0 },
          { X: 10000, Y: 50, Z: 0 }
        ]
      ], false));
  });
});

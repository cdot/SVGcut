/* global describe, it, assert */

import ClipperLib from "clipper-lib";
global.ClipperLib = ClipperLib;
ClipperLib.use_xyz = true;

import { UNit } from "./TestSupport.js";
import { UnitConverter } from "../src/UnitConverter.js";
const d = UnitConverter.from.px.to.integer;
let CutPoint, CutPath, CutPaths, Cam;

describe("Cam", () => {
  let page;

  // CutPath depends on ClipperLib
  before(() => {
    return Promise.all([
      import("../src/CutPoint.js"),
      import("../src/CutPath.js"),
      import("../src/CutPaths.js"),
      import("../src/Cam.js") ])
    .then(mods => {
      CutPoint = mods[0].CutPoint;
      CutPath = mods[1].CutPath;
      CutPaths = mods[2].CutPaths;
      Cam = mods[3];
      page = new CutPaths(
        [[{X:-10,Y:-10},{X:140,Y:-10},{X:140,Y:140},{X:-10,Y:140}]]);
    });
  });

  it("segment misses tab", () => {
    const tabs = new CutPaths([
      new CutPath([{ X:   0, Y:   0 },
                   { X: 100, Y:   0 },
                   { X: 100, Y: 100 },
                   { X:   0, Y: 100 }], true)]);
    const path = new CutPath([
      {X:-100,Y:500},
      {X:400,Y:500}], false);
    const ps = Cam.splitPathOverTabs(path, tabs, -2, -1);
    assert.deepEqual(ps, new CutPaths([
      [  { X: 400, Y: 500, Z: -2 }, { X: -100, Y: 500, Z: -2 } ]
    ]));
  });

  it("segment starts in tab", () => {
    const tabs = new CutPaths([
      new CutPath([{ X:   0, Y:   0 },
                   { X: 100, Y:   0 },
                   { X: 100, Y: 100 },
                   { X:   0, Y: 100 }], true)]);
    const path = new CutPath([
      {X: 50, Y:50},
      {X:400, Y:50}], false);
    const ps = Cam.splitPathOverTabs(path, tabs, -2, -1);
    assert.deepEqual(ps, new CutPaths([
      [
        { X: 400, Y: 50, Z: -2 },
        { X: 100, Y: 50, Z: -2 },
        { X: 100, Y: 50, Z: -1 },
        { X: 50, Y: 50, Z: -1 }
      ]
    ], false));
  });

  it("segment ends in tab", () => {
    const tabs = new CutPaths([
      new CutPath([{ X:   0, Y:   0 },
                   { X: 100, Y:   0 },
                   { X: 100, Y: 100 },
                   { X:   0, Y: 100 }], true)]);
    const path = new CutPath([
      {X:400, Y:50},
      {X: 50, Y:50}], false);
    const ps = Cam.splitPathOverTabs(path, tabs, -2, -1);
    assert.deepEqual(ps, new CutPaths([
      [
        { X:  50, Y: 50, Z: -1 },
        { X: 100, Y: 50, Z: -1 },
        { X: 100, Y: 50, Z: -2 },
        { X: 400, Y: 50, Z: -2 },
      ]
    ]));
  });

  it("segment cuts one tab", () => {
    const tabs = new CutPaths([
      new CutPath([{ X:   0, Y:   0 },
                   { X: 100, Y:   0 },
                   { X: 100, Y: 100 },
                   { X:   0, Y: 100 }], true)]);
    const path = new CutPath([
      {X:-100,Y:50},
      {X:400,Y:50}], false);
    const ps = Cam.splitPathOverTabs(path, tabs, -2, -1);
    assert.deepEqual(ps, new CutPaths([
      [
        { X: 400, Y: 50, Z: -2 },
        { X: 100, Y: 50, Z: -2 },
        { X: 100, Y: 50, Z: -1 },
        { X: 0, Y: 50, Z: -1 },
        { X: 0, Y: 50, Z: -2 },
        { X: -100, Y: 50, Z: -2 },
      ]
    ]));
  });

  it("segment cuts two tabs", () => {
    const tabs = new CutPaths([
      new CutPath([{ X:  0, Y:  0},
                   { X: 10, Y:  0 },
                   { X: 10, Y: 10},
                   { X:  0, Y: 10 }], true),
      new CutPath([{ X: 20, Y:  0},
                   { X: 30, Y:  0 },
                   { X: 30, Y: 10},
                   { X: 20, Y: 10 }], true)]);
    const path = new CutPath([
      {X:-10,Y:5},
      {X: 40,Y:5}]);
    const ps = Cam.splitPathOverTabs(path, tabs, -2, -1);
    assert.deepEqual(ps, new CutPaths([
      { X: 40, Y: 5, Z: -2 },
      { X: 30, Y: 5, Z: -2 },
      { X: 30, Y: 5, Z: -1 },
      { X: 20, Y: 5, Z: -1 },
      { X: 20, Y: 5, Z: -2 },
      { X: 10, Y: 5, Z: -2 },
      { X: 10, Y: 5, Z: -1 },
      { X: 0, Y: 5, Z: -1 },
      { X: 0, Y: 5, Z: -2 },
      { X: -10, Y: 5, Z: -2 },
    ]));
  });

  it("path intersects one tab", () => {
    const tabs = new CutPaths([
      [
        { X:   0, Y:   0 },
        { X: 100, Y:   0 },
        { X: 100, Y: 100 },
        { X:   0, Y: 100 }
      ]], true);
    const path = new CutPath([
      {X: -10, Y: 40},
      {X: 110, Y: 40},
      {X: 110, Y: 60},
      {X: -10, Y: 60}
    ], true);
    const ps = Cam.splitPathOverTabs(path, tabs, -2, -1);
    assert.deepEqual(ps, new CutPaths([
      [
        { X: 0, Y: 40, Z: -1 },
        { X: 100, Y: 40, Z: -1 },
        { X: 100, Y: 40, Z: -2 },
        { X: 110, Y: 40, Z: -2 },
        { X: 110, Y: 60, Z: -2 },
        { X: 100, Y: 60, Z: -2 },
        { X: 100, Y: 60, Z: -1 },
        { X: 0, Y: 60, Z: -1 },
        { X: 0, Y: 60, Z: -2 },
        { X: -10, Y: 60, Z: -2 },
        { X: -10, Y: 40, Z: -2 },
        { X: 0, Y: 40, Z: -2 }
      ]
    ], false));
  });

  it("path intersects two tabs", () => {
    const path = new CutPath([
      { X:   0, Y:   0 },
      { X: 100, Y:   0 },
      { X: 100, Y: 100 },
      { X:   0, Y: 100 }
    ], true);
    const tabs = new CutPaths([
      [
        {X: -10, Y: 40},
        {X:  10, Y: 40},
        {X:  10, Y: 60},
        {X: -10, Y: 60}
      ],
      [
        {X: 110, Y: 40},
        {X: 110, Y: 60},
        {X:  90, Y: 60},
        {X:  90, Y: 40}
      ]
    ], true);
    const ps = Cam.splitPathOverTabs(path, tabs, -2, -1);
    assert.deepEqual(ps, new CutPaths([
      [
        { X: 100, Y: 40, Z: -1 },
        { X: 100, Y: 60, Z: -1 },
        { X: 100, Y: 60, Z: -2 },
        { X: 100, Y: 100, Z: -2 },
        { X: 0, Y: 100, Z: -2 },
        { X: 0, Y: 60, Z: -2 },
        { X: 0, Y: 60, Z: -1 },
        { X: 0, Y: 40, Z: -1 },
        { X: 0, Y: 40, Z: -2 },
        { X: 0, Y: 0, Z: -2 },
        { X: 100, Y: 0, Z: -2 },
        { X: 100, Y: 40, Z: -2 }
      ]
    ], false));
  });
});

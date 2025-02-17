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

  it("drill path", () => {
    const path = new CutPaths([[
      { X:   0, Y:   0 },
      { X: 100, Y:   0 },
      { X: 100, Y: 100 },
      { X:   0, Y: 100 }
    ]], true);
    const result = Cam.drill(path, 5, -5);
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

  it("perforate open path", () => {
    const path = new CutPaths([[
      { X:   0, Y: 0 },
      { X: 100, Y: 0 },
      { X: 100, Y: 100 },
      { X:   0, Y: 100 }
    ]], false);
    const result = Cam.perforate(path, 2, 19, 5, -5);
    assert.almost(result, new CutPaths(
      [
        [
          { X: 0, Y: 0, Z: 5 },
          { X: 0, Y: 0, Z: -5 },
          { X: 0, Y: 0, Z: 5 },
          { X: 22.22222222222222, Y: 0, Z: 5 },
          { X: 22.22222222222222, Y: 0, Z: -5 },
          { X: 22.22222222222222, Y: 0, Z: 5 },
          { X: 44.44444444444444, Y: 0, Z: 5 },
          { X: 44.44444444444444, Y: 0, Z: -5 },
          { X: 44.44444444444444, Y: 0, Z: 5 },
          { X: 66.66666666666666, Y: 0, Z: 5 },
          { X: 66.66666666666666, Y: 0, Z: -5 },
          { X: 66.66666666666666, Y: 0, Z: 5 },
          { X: 88.88888888888889, Y: 0, Z: 5 },
          { X: 88.88888888888889, Y: 0, Z: -5 },
          { X: 88.88888888888889, Y: 0, Z: 5 },
          { X: 100, Y: 22.22222222222222, Z: 5 },
          { X: 100, Y: 22.22222222222222, Z: -5 },
          { X: 100, Y: 22.22222222222222, Z: 5 },
          { X: 100, Y: 44.44444444444444, Z: 5 },
          { X: 100, Y: 44.44444444444444, Z: -5 },
          { X: 100, Y: 44.44444444444444, Z: 5 },
          { X: 100, Y: 66.66666666666666, Z: 5 },
          { X: 100, Y: 66.66666666666666, Z: -5 },
          { X: 100, Y: 66.66666666666666, Z: 5 },
          { X: 100, Y: 88.88888888888889, Z: 5 },
          { X: 100, Y: 88.88888888888889, Z: -5 },
          { X: 100, Y: 88.88888888888889, Z: 5 },
          { X: 77.77777777777777, Y: 100, Z: 5 },
          { X: 77.77777777777777, Y: 100, Z: -5 },
          { X: 77.77777777777777, Y: 100, Z: 5 },
          { X: 55.55555555555555, Y: 100, Z: 5 },
          { X: 55.55555555555555, Y: 100, Z: -5 },
          { X: 55.55555555555555, Y: 100, Z: 5 },
          { X: 33.33333333333333, Y: 100, Z: 5 },
          { X: 33.33333333333333, Y: 100, Z: -5 },
          { X: 33.33333333333333, Y: 100, Z: 5 },
          { X: 11.111111111111107, Y: 100, Z: 5 },
          { X: 11.111111111111107, Y: 100, Z: -5 },
          { X: 11.111111111111107, Y: 100, Z: 5 }
        ]
      ],false));
  });

  it("perforate closed path", () => {
    const path = new CutPaths([[
      { X:   0, Y: 0 },
      { X: 100, Y: 0 },
      { X: 100, Y: 100 },
      { X:   0, Y: 100 }
    ]], true);
    const result = Cam.perforate(path, 2, 18, 5, -5);
    assert.almost(result, new CutPaths(
      [
        [
          { X: 101, Y: 0, Z: 5 },
          { X: 101, Y: 0, Z: -5 },
          { X: 101, Y: 0, Z: 5 },
          { X: 101, Y: 21.350360749973287, Z: 5 },
          { X: 101, Y: 21.350360749973287, Z: -5 },
          { X: 101, Y: 21.350360749973287, Z: 5 },
          { X: 101, Y: 42.700721499946575, Z: 5 },
          { X: 101, Y: 42.700721499946575, Z: -5 },
          { X: 101, Y: 42.700721499946575, Z: 5 },
          { X: 101, Y: 64.05108224991986, Z: 5 },
          { X: 101, Y: 64.05108224991986, Z: -5 },
          { X: 101, Y: 64.05108224991986, Z: 5 },
          { X: 101, Y: 85.40144299989315, Z: 5 },
          { X: 101, Y: 85.40144299989315, Z: -5 },
          { X: 101, Y: 85.40144299989315, Z: 5 },
          { X: 80.0638528123998, Y: 101, Z: 5 },
          { X: 80.0638528123998, Y: 101, Z: -5 },
          { X: 80.0638528123998, Y: 101, Z: 5 },
          { X: 58.71349206242651, Y: 101, Z: 5 },
          { X: 58.71349206242651, Y: 101, Z: -5 },
          { X: 58.71349206242651, Y: 101, Z: 5 },
          { X: 37.36313131245322, Y: 101, Z: 5 },
          { X: 37.36313131245322, Y: 101, Z: -5 },
          { X: 37.36313131245322, Y: 101, Z: 5 },
          { X: 16.012770562479933, Y: 101, Z: 5 },
          { X: 16.012770562479933, Y: 101, Z: -5 },
          { X: 16.012770562479933, Y: 101, Z: 5 },
          { X: -1, Y: 80.0638528123998, Z: 5 },
          { X: -1, Y: 80.0638528123998, Z: -5 },
          { X: -1, Y: 80.0638528123998, Z: 5 },
          { X: -1, Y: 58.71349206242651, Z: 5 },
          { X: -1, Y: 58.71349206242651, Z: -5 },
          { X: -1, Y: 58.71349206242651, Z: 5 },
          { X: -1, Y: 37.36313131245322, Z: 5 },
          { X: -1, Y: 37.36313131245322, Z: -5 },
          { X: -1, Y: 37.36313131245322, Z: 5 },
          { X: -1, Y: 16.012770562479933, Z: 5 },
          { X: -1, Y: 16.012770562479933, Z: -5 },
          { X: -1, Y: 16.012770562479933, Z: 5 },
          { X: 19.93614718760019, Y: -1, Z: 5 },
          { X: 19.93614718760019, Y: -1, Z: -5 },
          { X: 19.93614718760019, Y: -1, Z: 5 },
          { X: 41.286507937573475, Y: -1, Z: 5 },
          { X: 41.286507937573475, Y: -1, Z: -5 },
          { X: 41.286507937573475, Y: -1, Z: 5 },
          { X: 62.636868687546766, Y: -1, Z: 5 },
          { X: 62.636868687546766, Y: -1, Z: -5 },
          { X: 62.636868687546766, Y: -1, Z: 5 },
          { X: 83.98722943752006, Y: -1, Z: 5 },
          { X: 83.98722943752006, Y: -1, Z: -5 },
          { X: 83.98722943752006, Y: -1, Z: 5 },
        ]
      ],false));
  });

  it("annular pocket", () => {
    const path = new CutPaths([[
      { X: -100, Y:   0 },
      { X:    0, Y: 100 },
      { X:  100, Y:   0 },
      { X:    0, Y:  50 }
    ]], true);
    const result = Cam.annularPocket(path, 10, 0.5, false);
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

  it("raster pocket", () => {
    const path = new CutPaths([[
      { X: -100, Y:   0 },
      { X:    0, Y: 100 },
      { X:  100, Y:   0 },
      { X:    0, Y:  50 }
    ]], true);
    const result = Cam.rasterPocket(path, 10, 0.5, false);
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

  it("outline inside path", () => {
    const path = new CutPaths([[
      { X:   0, Y:   0 },
      { X: 100, Y:   0 },
      { X: 100, Y: 100 },
      { X:   0, Y: 100 }
    ]], true);
    const result = Cam.outline(path, 5, true, 1, 0.5, true);
  });

  it("outline outside path", () => {
    const path = new CutPaths([[
      { X:   0, Y:   0 },
      { X: 100, Y:   0 },
      { X: 100, Y: 100 },
      { X:   0, Y: 100 }
    ]], true);
    const result = Cam.outline(path, 5, false, 1, 0.5, true);
  });

  it("engrave", () => {
    const path = new CutPaths([[
      { X:   0, Y:   0 },
      { X: 100, Y:   0 },
      { X: 100, Y: 100 },
      { X:   0, Y: 100 }
    ]], true);
    const result = Cam.engrave(path, false);
  });
});

import { assert } from "chai";
/* global describe, it */

global.ClipperLib = {};

import * as Gcode from "../js/Gcode.js";
import { CutPath } from "./CutPath.js";
import { CutPaths } from "./CutPaths.js";

function UNit() {}

global.assert = assert;

describe("Gcode", () => {

  before(() => {
    console.log("SMEG");
    return import("clipper-lib")
    .then(mod => console.log(mod))
    .then(() => { ClipperLib.use_xyz = true; });
  });

  it("parser neutralises XYZ", () => {
    const res = Gcode.parse("G1");
    assert.deepEqual(res, [{ x: 0, y: 0, z: 0, f: 0 }]);
  });

  it("parser handles whitespace", () => {
    const res = Gcode.parse("G1X0 Y1  Z2\tF3");
    assert.deepEqual(res, [{ x: 0, y: 1, z: 2, f: 3 }]);
  });

  it("parser reads forward/back", () => {
    const res = Gcode.parse("G1 X99\nG0 Y2 Z3 F4\nG1 X5");
    assert.deepEqual(res, [
      { x: 99, y: 2, z: 3, f: 4 },
      { x: 99, y: 2, z: 3, f: 4 },
      { x: 5, y: 2, z: 3, f: 4 }
    ]);
  });

  it("handles line numbers", () => {
    const res = Gcode.parse("N99 G0 X1 Y2 Z3 F4\nN0 G0 X5 Y6 Z7\nN1");
    assert.deepEqual(res, [
      { x: 1, y: 2, z: 3, f: 4 },
      { x: 5, y: 6, z: 7, f: 4 }
    ]);
  });

  it("parser handles blank lines", () => {
    const res = Gcode.parse("\nG0 X1 Y2 Z3 F4\n\n\nG0 X5 Y6 Z7\n");
    assert.deepEqual(res, [
      { x: 1, y: 2, z: 3, f: 4 },
      { x: 5, y: 6, z: 7, f: 4 }
    ]);
  });

  it("parser handles () comments", () => {
    const res = Gcode.parse("(line 1)G0 (line 1) X1 Y2 Z3 F4");
    assert.deepEqual(res, [
      { x: 1, y: 2, z: 3, f: 4 }
    ]);
  });

  it("parser handles ; comments", () => {
    const res = Gcode.parse("G0 X1; Y2 Z3 F4");
    assert.deepEqual(res, [
      { x: 1, y: 0, z: 0, f: 0 }
    ]);
  });

  it("parser handles %%", () => {
    const res = Gcode.parse("%\nG0 X1 Y2 Z3 F4\n%\nG0 X5 Y6 Z7\n");
    assert.deepEqual(res, [
      { x: 1, y: 2, z: 3, f: 4 }
    ]);
  });

  it("parser handles M2", () => {
    const res = Gcode.parse("G0 X1 Y2 Z3 F4\nM2\nG0 X5 Y6 Z7\n");
    assert.deepEqual(res, [
      { x: 1, y: 2, z: 3, f: 4 }
    ]);
  });

  it("parser handles numbers", () => {
    const res = Gcode.parse("G0 X -1 Y2.0 Z-3.5 F +4");
    assert.deepEqual(res, [
      { x: -1, y: 2, z: -3.5, f: 4 }
    ]);
  });

  const job = {
    gunits:      "inch",
    xScale:      10,
    yScale:      -7,
    zScale:      1,
    offsetX:     100,
    offsetY:     -100,
    decimal:     1,
    topZ:        3,
    safeZ:       5,
    passDepth:   5,
    plungeFeed:  50,
    retractFeed: 100,
    cutFeed:     80,
    rapidFeed:   1000,
    returnTo00:  true,
    workWidth:   300,
    workHeight:  180
  };

  it("generates preamble", () => {
    const gcode = [];
    Gcode.startJob(job, gcode);
    assert.deepEqual(gcode, [
      '; Work area:300.00x180.00 inch',
      '; Offset:   (100.00,-100.00) inch',
      'G20 ; Set units to inches',
      'G90 ; Absolute positioning',
      'G0 Z5 F1000 ; Move to clearance level'
    ]);
  });

  it("generates postamble", () => {
    const gcode = [];
    Gcode.endJob(job, gcode);
    assert.deepEqual(gcode, [
      "G0 X0 Y0 F1000 ; Return to 0,0",
      "M2 ; end program"
    ]);
  });

  const opJob = {
    gunits:      "mm",
    xScale:      1,
    yScale:      1,
    zScale:      1,
    offsetX:     0,
    offsetY:     0,
    decimal:     0,
    topZ:        0,
    safeZ:       10,
    passDepth:   1,
    plungeFeed:  50,
    cutFeed:     60,
    retractFeed: 70,
    rapidFeed:   80,
    returnTo00:  true,
    workWidth:   300,
    workHeight:  180
  };

  it("engrave lines", () => {
    const op = {
      paths: new CutPaths([
        [ { X: 0, Y: 0 }, { X: 10, Y: 10 } ],
        [ { X: 20, Y: 20 }, { X: 30, Y: 30 } ]
      ], false),
      name: "Test",
      cutType: "Cut Type",
      passDepth: 1,
      cutDepth: 3,
      direction: "Conventional"
    };
    const gcode = [];
    Gcode.generateOperation(op, opJob, gcode);
    let i = 0;
    const expected = [
  '; ** Operation "Test"',
  '; Type:        Cut Type',
  '; Paths:       2',
  '; Direction:   Conventional',
  '; Cut Depth:   3 mm',
  '; Pass Depth:  1 mm',
  '; Plunge rate: 50 mm/min',
  '; Path 1',
  'G0 X0 Y0 Z0 F80 ; Goto path',
  'M3 ; Start spindle',
  'G1 Z-1 F50 ; Drill plunge',
  'G1 X10 Y10 Z0 F60',
  'M5 ; Stop spindle',
  'G0 Z10 F80',
  'G0 X0 Y0 Z0 ; Goto path',
  'M3 ; Start spindle',
  'G1 Z-2 F50 ; Drill plunge',
  'G1 X10 Y10 Z0 F60',
  'M5 ; Stop spindle',
  'G0 Z10 F80',
  'G0 X0 Y0 Z0 ; Goto path',
  'M3 ; Start spindle',
  'G1 Z-3 F50 ; Drill plunge',
  'G1 X10 Y10 Z0 F60',
  'G0 Z10 F80 ; Path done',
  '; Path 2',
  'M5 ; Stop spindle',
  'G0 X20 Y20 Z0 ; Goto path',
  'M3 ; Start spindle',
  'G1 Z-1 F50 ; Drill plunge',
  'G1 X30 Y30 Z0 F60',
  'M5 ; Stop spindle',
  'G0 Z10 F80',
  'G0 X20 Y20 Z0 ; Goto path',
  'M3 ; Start spindle',
  'G1 Z-2 F50 ; Drill plunge',
  'G1 X30 Y30 Z0 F60',
  'M5 ; Stop spindle',
  'G0 Z10 F80',
  'G0 X20 Y20 Z0 ; Goto path',
  'M3 ; Start spindle',
  'G1 Z-3 F50 ; Drill plunge',
  'G1 X30 Y30 Z0 F60',
  'G0 Z10 F80 ; Path done',
  'M5 ; Stop spindle'
    ];
    assert.equal(gcode.length, expected.length);
    for (let i = 0; i < expected.length; i++)
      assert.equal(gcode[i], expected[i]);
  });

  it("generates using Z", () => {
    const op = {
      paths: [
        [
          { X: 0, Y: 0, Z: -3 },
          { X: 10, Y: 10, Z: 0 }
        ]
      ],
      precalculatedZ: true,
      name: "Test",
      cutType: "Cut Type",
      passDepth: 1,
      cutDepth: 3,
      direction: "Conventional"
    };
    const gcode = [];
    Gcode.generateOperation(op, opJob, gcode);
    const expected = [
      '; ** Operation "Test"',
      '; Type:        Cut Type',
      '; Paths:       1',
      '; Direction:   Conventional',
      '; Cut Depth:   3 mm',
      '; Pass Depth:  1 mm',
      '; Plunge rate: 50 mm/min',
      '; Path 1',
      'G0 Z0 F80',
      'G0 X0 Y0 Z-3 ; Goto path',
      'M3 ; Start spindle',
      'G1 F60 ; Precalculated Z',
      'G1 X10 Y10 Z0',
      'M5 ; Stop spindle',
      'G0 Z10 F80 ; Path done'
    ];
    console.log(gcode);
    assert.equal(gcode.length, expected.length);
    for (let i = 0; i < expected.length; i++)
      assert.equal(gcode[i], expected[i]);
  });
});

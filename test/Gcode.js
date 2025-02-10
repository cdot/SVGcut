import { assert } from "chai";
/* global describe, it */

import ClipperLib from "clipper-lib";
global.ClipperLib = ClipperLib;
ClipperLib.use_xyz = true;

import { UNit } from "./TestSupport.js";
let CutPoint, CutPath, CutPaths, Gcode;

global.assert = assert;

describe("Gcode", () => {
  before(() => {
    return Promise.all([
      import("../src/CutPoint.js"),
      import("../src/CutPath.js"),
      import("../src/CutPaths.js"),
      import("../src/Gcode.js") ])
    .then(mods => {
      CutPoint = mods[0].CutPoint;
      CutPath = mods[1].CutPath;
      CutPaths = mods[2].CutPaths;
      Gcode = mods[3];
    });
  });

  it("parser neutralises XYZ", () => {
    const res = Gcode.parse("G1");
    assert.deepEqual(res, [{ x: 0, y: 0, z: 0, f: 0, s: 0 }]);
  });

  it("parser handles whitespace", () => {
    const res = Gcode.parse("G 1X0 Y1Z 2\tF 3");
    assert.deepEqual(res, [{ x: 0, y: 1, z: 2, f: 3, s: 0 }]);
  });

  it("parser reads forward/back", () => {
    const res = Gcode.parse("G1 X99\nM0\nG0 Y2 Z3 F4\nM0\nG1 X5");
    assert.deepEqual(res, [
      { x: 99, y: 2, z: 3, f: 4, s: 0 },
      { x: 5, y: 2, z: 3, f: 4, s: 0 }
    ]);
  });

  it("parse line numbers", () => {
    const res = Gcode.parse("N99 G0 X1 Y2 Z3 F4\nM0\nN0 G0 X5 Y6 Z7\nN1");
    assert.deepEqual(res, [
      { x: 1, y: 2, z: 3, f: 4, s: 0 },
      { x: 5, y: 6, z: 7, f: 4, s: 0 }
    ]);
  });

  it("parse spindle change", () => {
    const res = Gcode.parse("G0 X1 Y2 Z3 F4\nM3 S100\nG0 F4\nN1");
    assert.deepEqual(res, [
      { x: 1, y: 2, z: 3, f: 4, s: 0 },
      { x: 1, y: 2, z: 3, f: 4, s: 100 }
    ]);
  });

  it("parse blank lines", () => {
    const res = Gcode.parse("\nG0 X1 Y2 Z3 F4\n\n\nG0 X5 Y6 Z7\n");
    assert.deepEqual(res, [
      { x: 1, y: 2, z: 3, f: 4, s: 0 },
      { x: 5, y: 6, z: 7, f: 4, s: 0 }
    ]);
  });

  it("parser handles () comments", () => {
    const res = Gcode.parse("(line 1)G0 (line 1) X1 Y2 Z3 F4");
    assert.deepEqual(res, [
      { x: 1, y: 2, z: 3, f: 4, s: 0 }
    ]);
  });

  it("parser handles ; comments", () => {
    const res = Gcode.parse("G0 X1; Y2 Z3 F4");
    assert.deepEqual(res, [
      { x: 1, y: 0, z: 0, f: 0, s: 0 }
    ]);
  });

  it("parser handles %%", () => {
    const res = Gcode.parse("%\nG0 X1 Y2 Z3 F4\n%\nG0 X5 Y6 Z7\n");
    assert.deepEqual(res, [
      { x: 1, y: 2, z: 3, f: 4, s: 0 }
    ]);
  });

  it("parser handles M2", () => {
    const res = Gcode.parse("G0 X1 Y2 Z3 F4\nM2\nG0 X5 Y6 Z7\n");
    assert.deepEqual(res, [
      { x: 1, y: 2, z: 3, f: 4, s: 0 }
    ]);
  });

  it("parser handles M3/M5", () => {
    const res = Gcode.parse("M3 S2000\nG0 X1 Y2 Z3 F4\nM3 S50\nG0 X5 Y6\nM5\nG0 X7\n");
    assert.deepEqual(res, [
      { x: 1, y: 2, z: 3, f: 4, s: 0 },
      { x: 1, y: 2, z: 3, f: 4, s: 2000 },
      { x: 1, y: 2, z: 3, f: 4, s: 50 },
      { x: 5, y: 6, z: 3, f: 4, s: 50 },
      { x: 5, y: 6, z: 3, f: 4, s: 0 },
      { x: 7, y: 6, z: 3, f: 4, s: 0 },
      
    ]);
  });

  it("parser handles arrays", () => {
    const res = Gcode.parse([
      "G0 X1 Y2 Z3 F4", "M2", "G0 X5 Y6 Z7"]);
    assert.deepEqual(res, [
      { x: 1, y: 2, z: 3, f: 4, s: 0 }
    ]);
  });

  it("parser handles numbers", () => {
    const res = Gcode.parse("G0 X -1 Y2.0 Z-3.5 F +4");
    assert.deepEqual(res, [
      { x: -1, y: 2, z: -3.5, f: 4, s: 0 }
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
    const gen = new Gcode.Generator(job);
    assert.deepEqual(gen.gcode, [
      '; Work area:300.00x180.00 inch',
      '; Offset:   (100.00,-100.00) inch',
      'G20 ; Set units to inches',
      'G90 ; Absolute positioning',
      'G0 Z5 F1000 ; Move to clearance level'
    ]);
  });

  it("generates postamble", () => {
    const gen = new Gcode.Generator(job);
    gen.end();
    assert.equal(gen.gcode[gen.gcode.length - 2], "G0 X0.0 Y0.0 ; Return to 0,0");
    assert.equal(gen.gcode[gen.gcode.length - 1], "M2 ; end program");
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
    retractFeed: 200,
    rapidFeed:   1000,
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
      spinSpeed: 2000,
      direction: "Conventional"
    };
    const job = new Gcode.Generator(opJob);
    job.addOperation(op);
    const gcode = job.end();
    while (gcode[0].indexOf("; ** Operation") !== 0)
      gcode.shift();
    while (gcode[gcode.length - 1][0] === ";")
      gcode.pop();
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
      'G0 X0 Y0 ; Hang',
      'G0 Z0 ; Sink',
      'M3 S2000 ; Start spindle',
      'G1 Z-1 F50 ; Drill plunge',
      'G1 X10 Y10 F60',
      'M5 ; Stop spindle',
      'G0 Z10 F1000 ; Clear',
      'G0 X0 Y0 ; Hang',
      'G0 Z-1 ; Sink',
      'M3 S2000 ; Start spindle',
      'G1 Z-2 F50 ; Drill plunge',
      'G1 X10 Y10 F60',
      'M5 ; Stop spindle',
      'G0 Z10 F1000 ; Clear',
      'G0 X0 Y0 ; Hang',
      'G0 Z-2 ; Sink',
      'M3 S2000 ; Start spindle',
      'G1 Z-3 F50 ; Drill plunge',
      'G1 X10 Y10 F60',
      'G0 Z10 F1000 ; Path done',
      '; Path 2',
      'M5 ; Stop spindle',
      'G0 X20 Y20 ; Hang',
      'G0 Z0 ; Sink',
      'M3 S2000 ; Start spindle',
      'G1 Z-1 F50 ; Drill plunge',
      'G1 X30 Y30 F60',
      'M5 ; Stop spindle',
      'G0 Z10 F1000 ; Clear',
      'G0 X20 Y20 ; Hang',
      'G0 Z-1 ; Sink',
      'M3 S2000 ; Start spindle',
      'G1 Z-2 F50 ; Drill plunge',
      'G1 X30 Y30 F60',
      'M5 ; Stop spindle',
      'G0 Z10 F1000 ; Clear',
      'G0 X20 Y20 ; Hang',
      'G0 Z-2 ; Sink',
      'M3 S2000 ; Start spindle',
      'G1 Z-3 F50 ; Drill plunge',
      'G1 X30 Y30 F60',
      'G0 Z10 F1000 ; Path done',
      'M5 ; Stop spindle',
      'G0 X0 Y0 ; Return to 0,0',
      'M2 ; end program'
    ];
    for (let i = 0; i < expected.length; i++)
      assert.equal(gcode[i], expected[i], `mismatch line ${i}`);
    assert.equal(gcode.length, expected.length);
  });

  it("generates using Z", () => {
    const op = {
      paths: new CutPaths([
        [
          { X: 0, Y: 0, Z: -3 },
          { X: 10, Y: 10, Z: 0 },
          { X: 10, Y: 20, Z: -5 }
        ]
      ]),
      precalculatedZ: true,
      name: "Test",
      cutType: "Cut Type",
      passDepth: 1,
      cutDepth: 3,
      direction: "Conventional"
    };
    const job = new Gcode.Generator(opJob);
    job.addOperation(op);
    const gcode = job.end();
    while (gcode[0].indexOf("; ** Operation") !== 0)
      gcode.shift();
    while (gcode[gcode.length - 1][0] === ";")
      gcode.pop();
    const expected = [
      '; ** Operation "Test"',
      '; Type:        Cut Type',
      '; Paths:       1',
      '; Direction:   Conventional',
      '; Cut Depth:   3 mm',
      '; Pass Depth:  1 mm',
      '; Plunge rate: 50 mm/min',
      '; Path 1',
      'G0 X0 Y0 ; Hang',
      'G0 Z0 ; Sink',
      'M3 ; Start spindle',
      'G1 Z-3 F60 ; Precalculated Z',
      'G1 X10 Y10 Z0',
      'G1 Y20 Z-5',
      'G0 Z10 F1000 ; Path done',
      'G0 X0 Y0 ; Return to 0,0',
      'M2 ; end program'
    ];
    for (let i = 0; i < expected.length; i++)
      assert.equal(gcode[i], expected[i]);
    assert.equal(gcode.length, expected.length);
  });
});

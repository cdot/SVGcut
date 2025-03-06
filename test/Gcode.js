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
    xOffset:     100,
    yOffset:     -100,
    decimal:     1,
    topZ:        0,
    botZ:        -5,
    safeZ:       5,
    tabsDepth:   1,
    plungeRate:  50,
    retractRate: 100,
    cutRate:     80,
    rapidRate:   1000,
    returnHome:  true,
    workWidth:   300,
    workHeight:  180
  };

  it("generates preamble", () => {
    const gen = new Gcode.Generator(job);
    gen.gcode.shift();
    assert.deepEqual(gen.gcode, [
      '; Work area: 300x180 inch',
      '; Offset: (100,-100) inch',
      'G20 ; Set units to inches',
      'G90 ; Absolute positioning',
      'G0 Z5 F1000 ; Move to clearance level'
    ]);
  });

  it("generates postamble", () => {
    const gen = new Gcode.Generator(job);
    gen.end();
    assert.equal(gen.gcode[gen.gcode.length - 2], "G0 X0 Y0 ; Return to 0,0");
    assert.equal(gen.gcode[gen.gcode.length - 1], "M2 ; End program");
  });

  const opJob = {
    gunits:      "mm",
    xScale:      1,
    yScale:      1,
    zScale:      1,
    xOffset:     0,
    yOffset:     0,
    decimal:     2,
    topZ:        0,
    botZ:        -5,
    tabsDepth:   1,
    safeZ:       10,
    plungeRate:  50,
    retractRate: 200,
    rapidRate:   1000,
    returnHome:  true,
    workWidth:   300,
    workHeight:  180
  };

  it("engrave lines", () => {
    const op = {
      paths: new CutPaths([
        [ { X: 0, Y: 0, Z: -2 }, { X: 10, Y: 10, Z: -2 } ],
        [ { X: 20, Y: 20, Z: -2 }, { X: 30, Y: 30, Z: -2 } ]
      ], false),
      name: "Test",
      cutType: "Engrave",
      cutRate:     60,
      passDepth:   0.5,
      precalculatedZ : false,
      ramp: false,
      rpm: 2000,
      direction: "Conventional"
    };
    const job = new Gcode.Generator(opJob);
    job.addOperation(op);
    const gcode = job.end();
    while (gcode[0].indexOf("; *** Operation") !== 0)
      gcode.shift();
    while (gcode[gcode.length - 1][0] === ";")
      gcode.pop();
    let i = 0;
    const expected = [
      '; *** Operation "Test" (Engrave) ***',
      '; Path 1',
      '; Pass 1:1',
      'G0 X0 Y0 ; Hang',
      'G0 Z0 ; Sink',
      'M3 S2000 ; Start spindle',
      'G1 Z-0.5 F60',
      'G1 X10 Y10',
      '; Pass 1:2',
      'G1 Z-1',
      'G1 X0 Y0',
      '; Pass 1:3',
      'G1 Z-1.5',
      'G1 X10 Y10',
      '; Pass 1:4',
      'G1 Z-2',
      'G1 X0 Y0',
      'G0 Z10 F1000 ; Retract',
      '; Path 2',
      '; Pass 2:1',
      'G0 X20 Y20 ; Hang',
      'G0 Z0 ; Sink',
      'G1 Z-0.5 F60',
      'G1 X30 Y30',
      '; Pass 2:2',
      'G1 Z-1',
      'G1 X20 Y20',
      '; Pass 2:3',
      'G1 Z-1.5',
      'G1 X30 Y30',
      '; Pass 2:4',
      'G1 Z-2',
      'G1 X20 Y20',
      'G0 Z10 F1000 ; Retract',
      'M5 ; Stop spindle',
      'G0 X0 Y0 ; Return to 0,0',
      'M2 ; End program'
    ];
    for (let i = 0; i < expected.length; i++)
      assert.equal(gcode[i], expected[i], `mismatch line ${i}`);
    assert.equal(gcode.length, expected.length);
  });

  it("pocket with precalculated Z", () => {
    const op = {
      paths: new CutPaths([
        [
          { X:  0, Y:  0, Z: -3 },
          { X: 10, Y: 10, Z:  0 },
          { X: 10, Y: 20, Z: -5 }
        ]
      ]),
      name: "Test",
      cutType: "AnnularPocket",
      ramp: false,
      direction: "Conventional",
      cutRate:     60,
      passDepth:   0.5,
      precalculatedZ : false,
      rpm: 9999
    };
    const job = new Gcode.Generator(opJob);
    job.addOperation(op);
    const gcode = job.end();
    while (gcode[0].indexOf("; *** Operation") !== 0)
      gcode.shift();
    while (gcode[gcode.length - 1][0] === ";")
      gcode.pop();
    const expected = [
      '; *** Operation "Test" (AnnularPocket) ***',
      '; Path 1',
      '; Pass 1:1',
      'G0 X0 Y0 ; Hang',
      'G0 Z0 ; Sink',
      'M3 S9999 ; Start spindle',
      'G1 Z-0.5 F60',
      'G1 X10 Y10 Z0',
      'G1 Y20 Z-0.5',
      '; Pass 1:2',
      'G1 Z-1',
      'G1 Y10 Z0',
      'G1 X0 Y0 Z-1',
      '; Pass 1:3',
      'G1 Z-1.5',
      'G1 X10 Y10 Z0',
      'G1 Y20 Z-1.5',
      '; Pass 1:4',
      'G1 Z-2',
      'G1 Y10 Z0',
      'G1 X0 Y0 Z-2',
      '; Pass 1:5',
      'G1 Z-2.5',
      'G1 X10 Y10 Z0',
      'G1 Y20 Z-2.5',
      '; Pass 1:6',
      'G1 Z-3',
      'G1 Y10 Z0',
      'G1 X0 Y0 Z-3',
      '; Pass 1:7',
      'G1 X10 Y10 Z0',
      'G1 Y20 Z-3.5',
      '; Pass 1:8',
      'G1 Z-4',
      'G1 Y10 Z0',
      'G1 X0 Y0 Z-3',
      '; Pass 1:9',
      'G1 X10 Y10 Z0',
      'G1 Y20 Z-4.5',
      '; Pass 1:10',
      'G1 Z-5',
      'G1 Y10 Z0',
      'G1 X0 Y0 Z-3',
      'G0 Z10 F1000 ; Retract',
      'M5 ; Stop spindle',
      'M2 ; End program'
    ];
    for (let i = 0; i < expected.length; i++)
      assert.equal(gcode[i], expected[i], `mismatch line ${i}`);
    assert.equal(gcode.length, expected.length);
  });

  it("closed path ramping", () => {
    const opJob = {
      gunits:      "mm",
      xScale:      1,      yScale:      1,      zScale:      1,
      xOffset:     0,      yOffset:     0,
      decimal:     2,
      topZ:        0,      botZ:        -5,
      tabsDepth:   1,      safeZ:       10,
      plungeRate:  4,
      retractRate: 200,      rapidRate:   1000,
      returnHome:  true,      workWidth:   300,      workHeight:  180
    };
    const op = {
      paths: new CutPaths([
        [ { X: -10, Y: -10, Z: -4 }, { X: 10, Y: -10, Z: -4 },
          { X: 10, Y: 10, Z: -4 }, { X: -10, Y: 10, Z: -4 } ]
      ], true),
      name: "Test",
      cutType: "Engrave",
      ramp: true,
      rpm: 2000,
      cutRate:     80,
      passDepth:   5,
      precalculatedZ : false,
      direction: "Conventional"
    };
    const job = new Gcode.Generator(opJob);
    job.addOperation(op);
    const gcode = job.end();
    while (gcode[0].indexOf("; *** Operation") !== 0)
      gcode.shift();
    while (gcode[gcode.length - 1][0] === ";")
      gcode.pop();
    const expected = [
      '; *** Operation "Test" (Engrave) ***',
      '; Path 1',
      '; Pass 1:1',
      'G0 X-10 Y-10 ; Hang',
      'G0 Z0 ; Sink',
      'M3 S2000 ; Start spindle',
      'G1 X10 Z-1 F80 ; Ramp step',
      'G1 Y10 Z-2 ; Ramp step',
      'G1 X-10 Z-3 ; Ramp step',
      'G1 Y-10 Z-4 ; Ramp step',
      'G1 X10',
      'G1 Y10',
      'G1 X-10',
      'G1 Y-10',
      'G1 X10 ; Close path', // TODO: this is unnecessary
      'G0 Z10 F1000 ; Retract',
      'M5 ; Stop spindle',
      'G0 X0 Y0 ; Return to 0,0',
      'M2 ; End program'
    ];
    for (let i = 0; i < expected.length; i++)
      assert.equal(gcode[i], expected[i], `mismatch line ${i}`);
    assert.equal(gcode.length, expected.length);
  });

  it("open path ramping", () => {
    const opJob = {
      gunits:     "mm",  xScale:     1,   yScale:      1,
      zScale:     1,    xOffset:    0,    yOffset:     0,
      decimal:    2,    topZ:       0,    botZ:        -5,
      tabsDepth:  1,    safeZ:      10,
      plungeRate: 4,    retractRate: 200,
      rapidRate:  1000, returnHome: true,
      workWidth:  300,  workHeight: 180
    };
    const op = {
      paths: new CutPaths([
        [ { X: -10, Y: -10, Z: -4 }, { X: 10, Y: -10, Z: -4 },
          { X: 10, Y: 10, Z: -4 }, { X: -10, Y: 10, Z: -4 } ]
      ], false),
      name: "Test", cutType: "Engrave", rpm: 2000,
      direction: "Conventional",
      cutRate:     80,
      passDepth:   5,
      precalculatedZ : false,
      ramp: true
    };
    const job = new Gcode.Generator(opJob);
    job.addOperation(op);
    const gcode = job.end();
    while (gcode[0].indexOf("; *** Operation") !== 0)
      gcode.shift();
    while (gcode[gcode.length - 1][0] === ";")
      gcode.pop();
    const expected = [
      '; *** Operation "Test" (Engrave) ***',
      '; Path 1',
      '; Pass 1:1',
      'G0 X-10 Y-10 ; Hang',
      'G0 Z0 ; Sink',
      'M3 S2000 ; Start spindle',
      'G1 X10 Z-1 F80 ; Ramp step',
      'G1 Y10 Z-2 ; Ramp step',
      'G1 X-10 Z-3 ; Ramp step',
      'G1 X10 Z-4 ; Ramp step',
      'G1 Y-10 ; Reset open ramp path',
      'G1 X-10',
      'G1 X10',
      'G1 Y10',
      'G1 X-10',
      'G0 Z10 F1000 ; Retract',
      'M5 ; Stop spindle',
      'G0 X0 Y0 ; Return to 0,0',
      'M2 ; End program'
    ];
    for (let i = 0; i < expected.length; i++)
      assert.equal(gcode[i], expected[i], `mismatch line ${i}`);
    assert.equal(gcode.length, expected.length);
  });

  it("partial segment ramping", () => {
    // ramp to depth within a single segment
    // ramp should be 45 degrees
    const opJob = {
      gunits:      "mm",  xScale:      1,   yScale:      1,
      zScale:      1,     xOffset:     0,   yOffset:     0,
      decimal:     2,     retractRate: 200, rapidRate:   1000,
      returnHome:  true,  workWidth:   300, workHeight:  180,
      tabsDepth:   1,     safeZ:       10,  topZ:        0,
      botZ:        -5,
      plungeRate:  50
    };
    const op = {
      paths: new CutPaths([
        [ { X: -100, Y: 0, Z: -4 }, { X: 100, Y: 0, Z: -4 } ]
      ], false),
      name: "Test", cutType: "Engrave", rpm: 2000,
      cutRate:     50,
      passDepth:   4,
      precalculatedZ : false,
      direction: "Conventional",

      ramp: true
    };
    const job = new Gcode.Generator(opJob);
    job.addOperation(op);
    const gcode = job.end();
    while (gcode[0].indexOf("; *** Operation") !== 0)
      gcode.shift();
    while (gcode[gcode.length - 1][0] === ";")
      gcode.pop();
    const expected = [
      '; *** Operation "Test" (Engrave) ***',
      '; Path 1',
      '; Pass 1:1',
      'G0 X-100 Y0 ; Hang',
      'G0 Z0 ; Sink',
      'M3 S2000 ; Start spindle',
      'G1 X-96 Z-4 F50 ; Bottom of ramp',
      'G1 X100 ; Ramp step',
      'G1 X-100',
      'G1 X100', // unnecesary
      'G0 Z10 F1000 ; Retract',
      'M5 ; Stop spindle',
      'G0 X0 ; Return to 0,0',
      'M2 ; End program'
    ];
    for (let i = 0; i < expected.length; i++)
      assert.equal(gcode[i], expected[i], `mismatch line ${i}`);
    assert.equal(gcode.length, expected.length);
  });

  it("precalculated drill path", () => {
    const opJob = {
      gunits:      "mm",
      xScale:      1, yScale: 1, zScale: 1,
      xOffset:     0, yOffset: 0,
      decimal:     2,
      topZ:        0, botZ: -5, safeZ: 10,
      workWidth: 300, workHeight:  180,
      tabsDepth:   1,
      plungeRate:  4, retractRate: 200, rapidRate: 1000,
      returnHome:  true
    };
    const op = {
      paths: new CutPaths([
        [ { X: -10, Y: -10, Z: -1 }, { X: 10, Y: -10, Z: -2 },
          { X: 10, Y: 10, Z: -3 }, { X: -10, Y: 10, Z: -4 } ]
      ], true),
      name: "Test",
      cutType: "Drill",
      ramp: true,
      rpm: 2000,
      cutRate:     80,
      passDepth:   5,
      precalculatedZ : true,
      direction: "Conventional"
    };
    const job = new Gcode.Generator(opJob);
    job.addOperation(op);
    const gcode = job.end();
    while (gcode[0].indexOf("; *** Operation") !== 0)
      gcode.shift();
    while (gcode[gcode.length - 1][0] === ";")
      gcode.pop();
    const expected = [
      '; *** Operation "Test" (Drill) ***',
      '; Path 1',
      'G0 X-10 Y-10 ; Hang',
      'G0 Z0 ; Sink',
      'M3 S2000 ; Start spindle',
      'G1 Z-1 F4',
      'G1 X10 Z-2 F80',
      'G1 Y10 Z-3',
      'G1 X-10 Z-4',
      'G1 Y-10 Z-1 ; Close path',
      'G0 Z10 F1000 ; Retract',
      'M5 ; Stop spindle',
      'G0 X0 Y0 ; Return to 0,0',
      'M2 ; End program'
    ];
    for (let i = 0; i < expected.length; i++)
      assert.equal(gcode[i], expected[i], `mismatch line ${i}`);
    assert.equal(gcode.length, expected.length);
  });
});

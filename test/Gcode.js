import { assert } from "chai";
/* global describe, it */

import * as Gcode from "../js/Gcode.js";

describe("Gcode", () => {
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

  it("generates op", () => {
    const op = {
      paths: [ {
        path: [ { X: 1, Y: 2 }, { X: 3, Y: 4 } ],
        safeToClose: false
      }],
      useZ: false,
      name: "Test",
      cutType: "Cut Type",
      passDepth: 1,
      tabZ: 4,
      cutDepth: 3,
      direction: "Conventional"
    };
    const gcode = [];
    Gcode.generateOperation(op, job, gcode);
    let i = 0;
    assert.equal(gcode[i++], "; ** Operation \"Test\"");
    assert.equal(gcode[i++], "; Type:        Cut Type");
    assert.equal(gcode[i++], "; Paths:       1");
    assert.equal(gcode[i++], "; Direction:   Conventional");
    assert.equal(gcode[i++], "; Cut Depth:   3inch");
    assert.equal(gcode[i++], "; Pass Depth:  1inch");
    assert.equal(gcode[i++], "; Plunge rate: 50inch/min");
    assert.equal(gcode[i++], "; Path 0");
    assert.equal(gcode[i++], "G0 X110.0 Y-114.0 Z3.0 F1000");
    assert.equal(gcode[i++], "M3 ; Start spindle",);
    assert.equal(gcode[i++], "G1 Z0.0 F50 ; Plunge");
    assert.equal(gcode[i++], "; cut");
    assert.equal(gcode[i++], "G1 X130.0 Y-128.0 F80");
    assert.equal(gcode[i++], "M5 ; Stop spindle");
    assert.equal(gcode[i++], "G0 Z5.0 F1000 ; Retract");
  });
});

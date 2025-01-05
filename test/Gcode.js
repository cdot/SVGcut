import { assert } from "chai";
/* global describe, it */

import * as Gcode from "../js/Gcode.js";

describe("Gcode", () => {
  it("neutralises XYZ", () => {
    const res = Gcode.parse("G1");
    assert.deepEqual(res, [{ x: 0, y: 0, z: 0, f: 0 }]);
  });

  it("handles whitespace", () => {
    const res = Gcode.parse("G1X0 Y1  Z2\tF3");
    assert.deepEqual(res, [{ x: 0, y: 1, z: 2, f: 3 }]);
  });

  it("reads forward/back", () => {
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

  it("handles blank lines", () => {
    const res = Gcode.parse("\nG0 X1 Y2 Z3 F4\n\n\nG0 X5 Y6 Z7\n");
    assert.deepEqual(res, [
      { x: 1, y: 2, z: 3, f: 4 },
      { x: 5, y: 6, z: 7, f: 4 }
    ]);
  });

  it("handles () comments", () => {
    const res = Gcode.parse("(line 1)G0 (line 1) X1 Y2 Z3 F4");
    assert.deepEqual(res, [
      { x: 1, y: 2, z: 3, f: 4 }
    ]);
  });

  it("handles ; comments", () => {
    const res = Gcode.parse("G0 X1; Y2 Z3 F4");
    assert.deepEqual(res, [
      { x: 1, y: 0, z: 0, f: 0 }
    ]);
  });

  it("handles %%", () => {
    const res = Gcode.parse("%\nG0 X1 Y2 Z3 F4\n%\nG0 X5 Y6 Z7\n");
    assert.deepEqual(res, [
      { x: 1, y: 2, z: 3, f: 4 }
    ]);
  });

  it("handles M2", () => {
    const res = Gcode.parse("G0 X1 Y2 Z3 F4\nM2\nG0 X5 Y6 Z7\n");
    assert.deepEqual(res, [
      { x: 1, y: 2, z: 3, f: 4 }
    ]);
  });

  it("handles numbers", () => {
    const res = Gcode.parse("G0 X -1 Y2.0 Z-3.5 F +4");
    assert.deepEqual(res, [
      { x: -1, y: 2, z: -3.5, f: 4 }
    ]);
  });
});

/* global describe, it, assert */

import ClipperLib from "clipper-lib";
global.ClipperLib = ClipperLib;
ClipperLib.use_xyz = true;

import { UNit } from "./TestSupport.js";
import { CutPath } from "../js/CutPath.js";
import { CutPaths } from "../js/CutPaths.js";
import { UnitConverter } from "../js/UnitConverter.js";
const d = UnitConverter.from.px.to.integer;

describe("CutPaths", () => {
  it("empty", () => {
    const cp = new CutPaths();
    assert(cp instanceof CutPaths);
    assert(Array.isArray(cp));
  });

  it("from arrays", () => {
    const cp = new CutPaths([
      [ { x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 } ],
      [{X:0,Y:0},{X:100,y:0},{X:0,y:100}]
    ]);
    assert(cp[0] instanceof CutPath);
    assert.equal(cp.length, 2);
  });

  it("from CutPath", () => {
    const cp = new CutPaths([
      [ { x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 } ],
      [{X:0,Y:0},{X:100,y:0},{X:0,y:100}]
    ]);
    assert(cp[0] instanceof CutPath);
    assert.equal(cp.length, 2);
  });

  it("from CutPaths", () => {
    const path = new CutPath([{X:0,Y:0},{X:100,y:0},{X:0,y:100}], true);
    const cp = new CutPaths(path);
    assert.deepEqual(cp, [path]);
  });

  it("toSegments", () => {
    const cp = new CutPaths([
      [ { x: d, y: 2*d }, { x: 3*d, y: 4*d }, { x: 5*d, y: 6*d } ],
      new CutPath([{X:0,Y:0},{X:100*d,y:0},{X:100*d,Y:100*d},{X:0,y:100*d}], true)
    ]);
    assert.almost(cp.toSegments(), [
      [ 'M', 1, 2 ],
      [ 'L', 3, 4, 5, 6 ],
      [ 'M', 0, 0 ],
      [ 'L', 100, 0, 100,100, 0, 100 ],
      [ 'Z' ]
    ]);
  });

  it("fromSegments", () => {
    const cp = new CutPaths([
      [ { x: d, y: 2*d }, { x: 3*d, y: 4*d }, { x: 5*d, y: 6*d } ],
      new CutPath([{X:0,Y:0},{X:100*d,y:0},{X:100*d,Y:100*d},{X:0,y:100*d}],
                  true)
    ]);
    const s = cp.toSegments();
    const sp = CutPaths.fromSegments(s);
    assert.almost(sp, cp);
  });

  it("offset", () => {
    const cps = new CutPaths([
      [ { x: d, y: 2*d }, { x: 3*d, y: 4*d }, { x: 5*d, y: 6*d } ],
      new CutPath([{X:0,Y:0},{X:100*d,y:0},{X:100*d,Y:100*d},{X:0,y:100*d}],
                  true)
    ]);
    const off = cps.offset(d);
    assert.almost(off.toSegments(),[
      [ 'M', 101, 101 ],
      [ 'L', -1, 101, -1, -1, 101, -1 ],
      [ 'Z' ],
      [ 'M', 1, 2 ],
      [ 'L', 3, 4, 5, 6 ]
    ]);
  });

  it("mergePaths simple", () => {
    const cps = new CutPaths([
      new CutPath([
        { X:0, Y:0 }, { X:100*d, y:0 }, { X:100*d, Y:100*d }, { X:0,y:100*d }],
                  true)
    ]);
    const off = cps.offset(-d);
    cps.mergePaths(off);
    assert.almost(cps.toSegments(), [
      [ 'M', 0, 0 ],
      [
        'L', 100,   0, 100, 100,  0, 100,  0,  0,
               1,   1,  99,   1, 99,  99,  1, 99, 1, 1
      ],
      [ 'Z' ]
    ]);
  });

  it("mergePaths crossing", () => {
    const big = new CutPaths([
      new CutPath([
        { X:0, Y:0 }, { X:100, y:100 }, { X:200, Y:0 }, { X:100,y:200 }],
                  true)
    ]);
    const wee = new CutPaths([
      new CutPath([{ X:90, Y:90 }, { X:80, y:80 }, { X:100, Y:80 } ], true)
    ]);

    big.mergePaths(wee, big);
    assert.almost(big, new CutPaths([
      new CutPath([
        { X: 90, Y: 90, Z: 0 },
        { X: 80, Y: 80, Z: 0 },
        { X: 100, Y: 80, Z: 0 },
      ], true),
      new CutPath([
        { X: 0, Y: 0, Z: 0 },
        { X: 100, Y: 100, Z: 0 },
        { X: 200, Y: 0, Z: 0 },
        { X: 100, Y: 200, Z: 0 }
      ], true)
    ]));
  });

  it("mergePaths not crossing", () => {
    const big = new CutPaths([
      new CutPath([
        { X:0, Y:0 }, { X:100, y:100 }, { X:200, Y:0 }, { X:100,y:200 }],
                  true)
    ]);
    const wee = new CutPaths([
      new CutPath([{ X:90, Y:90 }, { X:80, y:80 }, { X:100, Y:80 } ], true)
    ]);

    big.mergePaths(wee);
    assert.equal(big.length, 1);
    assert.almost(big, new CutPaths([
      { X: 100, Y: 100, Z: 0 },
      { X: 200, Y: 0, Z: 0 },
      { X: 100, Y: 200, Z: 0 },
      { X: 0, Y: 0, Z: 0 },
      { X: 100, Y: 100, Z: 0 },
      { X: 90, Y: 90, Z: 0 },
      { X: 80, Y: 80, Z: 0 },
      { X: 100, Y: 80, Z: 0 },
      { X: 90, Y: 90, Z: 0 },
    ], false));
  });

  it("clip", () => {
  });

  it("diff", () => {
  });

  it("simplifyAndClean", () => {
  });

  it("crosses", () => {
  });

  it("closestVertex", () => {
  });

});

/* global describe, it, assert */

import ClipperLib from "clipper-lib";
global.ClipperLib = ClipperLib;
ClipperLib.use_xyz = true;

import { UNit } from "./TestSupport.js";
import { UnitConverter } from "../src/UnitConverter.js";
let CutPoint, CutPath;

describe("CutPath", () => {
  // CutPath depends on ClipperLib
  before(() => Promise.all([
    import("../src/CutPoint.js"),
    import("../src/CutPath.js")
  ]).then(mods => { CutPoint = mods[0].CutPoint, CutPath = mods[1].CutPath; }));

  it("empty", () => {
    const cp = new CutPath();
    assert(cp instanceof CutPath);
    assert(Array.isArray(cp));
    assert.equal(cp.isClosed, false);
  });

  it("from 2D array", () => {
    const cp = new CutPath([ { x: 1, y: 2 }, { x: 3, y: 4 } ]);
    assert(cp instanceof CutPath);
    assert(Array.isArray(cp));
    assert(cp[0] instanceof CutPoint);
    assert.equal(cp.isClosed, false);
    assert.equal(cp.length, 2);
  });

  it("from 2D CutPath", () => {
    const old = new CutPath([ { x: 1, y: 2 }, { x: 3, y: 4 } ], true);
    assert(old.isClosed);
    const cp = new CutPath(old);
    assert.deepEqual(cp, old);
    old[0].X = 99;
    old[0].Y = 99;
    assert.equal(cp[0].X, 1);
    assert.equal(cp[0].Y, 2);
  });

  it("from 3D CutPath", () => {
    const old = new CutPath([ { X: 1, Y: 2, Z:100 }, { x: 3, y: 4, Z: 102 } ]);
    const cp = new CutPath(old);
    assert.deepEqual(cp, old);
    for (const point of old) {
      point.X = 99;
      point.Y = 99;
      point.Z = 99;
    }
    assert.equal(cp.length, old.length);
    assert.equal(cp[0].X, 1);
    assert.equal(cp[0].Y, 2);
    assert.equal(cp[0].Z, 100);
    assert.equal(cp[1].X, 3);
    assert.equal(cp[1].Y, 4);
    assert.equal(cp[1].Z, 102);
  });

  it("toSegments", () => {
    const d = UnitConverter.from.px.to.integer;
    const cp = new CutPath([{X: 0,Y:0}, {x:d, y:0}, {x:0, y:d} ], false);
    const s = cp.toSegments();
    assert.almost(s, [
      [ 'M', 0, 0 ],
      [ 'L', 1, 0, 0, 1 ]
    ]);
    const cp2 = new CutPath([
      {X:0,Y:0},{X:100*d,y:0},{X:100*d,Y:100*d},{X:0,y:100*d}], true);
    const s2 = cp2.toSegments();
    assert.almost(s2, [
      [ 'M', 0, 0 ],
      [ 'L', 100, 0, 100, 100, 0, 100 ],
      [ 'Z' ]
    ]);
  });

  it("perimeter", () => {
    const d = UnitConverter.from.px.to.integer;
    const cp = new CutPath([{X: 0,Y:0}, {x:d, y:0}, {x:0, y:d} ], true);
    assert.almost(cp.perimeter() * UnitConverter.from.integer.to.px,
                  1 + 1 + Math.sqrt(2));
  });

  it("makeFirst", () => {
    const base = new CutPath([{X:0,Y:0}, {X:1,y:0}, {X:2,y:0}, {X:3,Y:0}], true);
    const cp = new CutPath(base);
    const mf = new CutPath([{X:1,Y:0}, {X:2,Y:0}, {X:3,Y:0}, {X:0,Y:0} ], true);
    cp.makeFirst(1);
    assert.equal(cp[0].X, 1);
    assert.equal(cp[1].X, 2);
    assert.equal(cp[2].X, 3);
    assert.equal(cp[3].X, 0);
    cp.makeFirst(0);
    assert.equal(cp[0].X, 1);
    cp.makeFirst(2);
    assert.equal(cp[0].X, 3);
    assert.equal(cp[1].X, 0);
    assert.equal(cp[2].X, 1);
    assert.equal(cp[3].X, 2);
    cp.makeFirst(3);
    assert.equal(cp[0].X, 2);
    assert.equal(cp[1].X, 3);
    assert.equal(cp[2].X, 0);
    assert.equal(cp[3].X, 1);
  });

  it("makeLast", () => {
    const cp = new CutPath([{X:0,Y:0}, {X:1,y:0}, {X:2,y:0}], true);
    const mf = new CutPath([{X:2,Y:0}, {X:0,Y:0}, {X:1,Y:0} ], true);
    cp.makeLast(1);
    assert.deepEqual(cp, mf);
  });

  it("closestVertex", () => {
    const path = new CutPath([{X:0,Y:0},{X:100,y:0},{X:0,y:100}], true);
    let p = path.closestVertex(new CutPoint(-1, -1));
    assert.equal(p.pointIndex, 0);
    assert.almost(p.dist2, 2);

    p = path.closestVertex(new CutPoint(0, 200));
    assert.equal(p.pointIndex, 2);
    assert.almost(p.dist2, 100*100);

    p = path.closestVertex(new CutPoint(300, 200));
    assert.equal(p.pointIndex, 1);
    assert.almost(p.dist2, 200*200+200*200);
  });

  it("inside", () => {
    const path = new CutPath([{X:0,Y:0},{X:100,y:0},{X:0,y:100}], true);
    assert.equal(path.inside(new CutPoint(0, 0)), 0);
    assert.equal(path.inside(new CutPoint(-1, -1)), -1);
    assert.equal(path.inside(new CutPoint(1, 1)), 1);
    assert.equal(path.inside(new CutPoint(10, 0)), 0);
    assert.equal(path.inside(new CutPoint(0, 10)), 0);
  });

  it("unduplicate inner", () => {
    const path = new CutPath([
      {X:0,Y:0},
      {X:100,y:0},
      {X:100,y:0},
      {X:0,y:100}
    ], true);
    path.unduplicate();
    assert.deepEqual(path, new CutPath([
      {X:0,Y:0},
      {X:100,y:0},
      {X:0,y:100}
    ], true));
  });

  it("unduplicate start", () => {
    const path = new CutPath([
      {X:0,Y:0},
      {X:0,Y:0},
      {X:100,y:0},
      {X:0,y:100}
    ], true);
    path.unduplicate();
    assert.deepEqual(path, new CutPath([
      {X:0,Y:0},
      {X:100,y:0},
      {X:0,y:100}
    ], true));
  });

  it("unduplicate end", () => {
    const path = new CutPath([
      {X:0,Y:0},
      {X:100,y:0},
      {X:0,y:100},
      {X:0,y:100}
    ], true);
    path.unduplicate();
    assert.deepEqual(path, new CutPath([
      {X:0,Y:0},
      {X:100,y:0},
      {X:0,y:100}
    ], true));
  });

  it("unduplicate wrap", () => {
    const path = new CutPath([
      {X:0,Y:0},
      {X:100,y:0},
      {X:0,y:100},
      {X:0,y:0}
    ], true);
    path.unduplicate();
    assert.deepEqual(path, new CutPath([
      {X:0,Y:0},
      {X:100,y:0},
      {X:0,y:100}
    ], true));
  });

  it("unduplicate nowrap", () => {
    const path = new CutPath([
      {X:0,Y:0},
      {X:100,y:0},
      {X:0,y:100},
      {X:0,y:0}
    ], false);
    path.unduplicate();
    assert.deepEqual(path, new CutPath([
      {X:0,Y:0},
      {X:100,y:0},
      {X:0,y:100},
      {X:0,y:0}
    ], false));
  });
});


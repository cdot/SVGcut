/* global describe, it, assert */

import ClipperLib from "clipper-lib";
global.ClipperLib = ClipperLib;
ClipperLib.use_xyz = true;

import { UNit } from "./TestSupport.js";
import { UnitConverter } from "../src/UnitConverter.js";
const d = UnitConverter.from.px.to.integer;
let CutPoint, CutPath, CutPaths;

describe("CutPaths", () => {
  let page;

  // CutPath depends on ClipperLib
  before(() => {
    return Promise.all([
      import("../src/CutPoint.js"),
      import("../src/CutPath.js"),
      import("../src/CutPaths.js") ])
    .then(mods => {
      CutPoint = mods[0].CutPoint;
      CutPath = mods[1].CutPath;
      CutPaths = mods[2].CutPaths;
      page = new CutPaths(
        [[{X:-10,Y:-10},{X:140,Y:-10},{X:140,Y:140},{X:-10,Y:140}]]);
    });
  });

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

  it("closestVertex", () => {
    const paths = new CutPaths([
      [
        { X: 30, Y: 0, Z: 0 },
        { X: 40, Y: 10, Z: 0 },
        { X: 50, Y: 0, Z: 0 },
      ],
      [
        { X: 40, Y: 15, Z: 0 },
        { X: 50, Y: 25, Z: 0 },
        { X: 30, Y: 25, Z: 0 },
      ]
    ], true);
    assert.deepEqual(paths.closestVertex(new CutPoint(30,0), true),
                     { pointIndex: 0, dist2: 0, pathIndex: 0 });
    assert(!paths.closestVertex(new CutPoint(30,0), false));
    assert.deepEqual(paths.closestVertex(new CutPoint(30,0)),
                     { pointIndex: 0, dist2: 0, pathIndex: 0 });
    assert.deepEqual(paths.closestVertex(new CutPoint(41,1), true),
                     { pointIndex: 1, dist2: 82, pathIndex: 0 });
    assert.deepEqual(paths.closestVertex(new CutPoint(51,26), true),
                     { pointIndex: 1, dist2: 2, pathIndex: 1 });
  });

  it("closestEndPoint", () => {
    const paths = new CutPaths([
      [
        { X: 30, Y: 0, Z: 0 },
        { X: 40, Y: 10, Z: 0 },
        { X: 50, Y: 0, Z: 0 },
      ],
      [
        { X: 40, Y: 15, Z: 0 },
        { X: 50, Y: 25, Z: 0 },
        { X: 30, Y: 25, Z: 0 },
      ]
    ], true);
    assert.deepEqual(paths.closestEndpoint(new CutPoint(30,0), true),
                     { pointIndex: 0, dist2: 0, pathIndex: 0,
                       point: { X: 30, Y: 0, Z: 0 }});
    assert(!paths.closestEndpoint(new CutPoint(30,0), false));
    assert.deepEqual(paths.closestEndpoint(new CutPoint(30,0)),
                     { pointIndex: 0, dist2: 0, pathIndex: 0,
                     point: { X: 30, Y: 0, Z: 0 }});
    assert.deepEqual(paths.closestEndpoint(new CutPoint(41,1), true),
                     { pointIndex: 2, dist2: 82, pathIndex: 0,
                       point: { X: 50, Y: 0, Z: 0 }});
    // endpoints, so even though 50,25 is closer...
    assert.deepEqual(paths.closestEndpoint(new CutPoint(51,26)),
                     { pointIndex: 0, dist2: 242, pathIndex: 1,
                     point: { X: 40, Y: 15, Z: 0 }});
  });

  it("to/from json", () => {
    const paths = new CutPaths([
      new CutPath([
        { X: 30, Y: 0, Z: 0 },
        { X: 40, Y: 10, Z: 0 },
        { X: 50, Y: 0, Z: 0 },
      ], false),
      new CutPath([
        { X: 40, Y: 15, Z: 0 },
        { X: 50, Y: 25, Z: 0 },
        { X: 30, Y: 25, Z: 0 },
      ], true)
    ]);
    const a = paths.toJson();
    const shtap = CutPaths.fromJson(a);
    assert.deepEqual(shtap, paths);
  });
  
  it("sort open paths 2D", () => {
    const cps = new CutPaths([
      [
        { X: 0, Y: 60, Z: -2 },
        { X: -10, Y: 60, Z: -2 },
        { X: -10, Y: 40, Z: -2 }
      ],
      [
        { X:   0, Y: 60, Z: -1 },
        { X: 100, Y: 60, Z: -1 }
      ],
      [
        { X: 100, Y: 40, Z: -2 },
        { X: 110, Y: 40, Z: -2 },
        { X: 110, Y: 60, Z: -2 },
        { X: 100, Y: 60, Z: -2 }
      ],
      [
        { X:   0, Y: 40, Z: -1 },
        { X: 100, Y: 40, Z: -1 }
      ],
      [
        { X: -10, Y: 40, Z: -2 },
        { X: 0, Y: 40, Z: -2 }
      ]
    ]);
    cps.sortPaths(2);
    assert.deepEqual(cps, new CutPaths([
      [
        { X: -10, Y: 40, Z: -2 },
        { X: 0, Y: 40, Z: -2 },
        { X: 100, Y: 40, Z: -1 },
        { X: 110, Y: 40, Z: -2 },
        { X: 110, Y: 60, Z: -2 },
        { X: 100, Y: 60, Z: -2 },
        { X: 0, Y: 60, Z: -1 },
        { X: -10, Y: 60, Z: -2 },
        { X: -10, Y: 40, Z: -2 },
    ]], false));
  });

  it("sort open paths 3D", () => {
    const cps = new CutPaths([
      [
        { X: 0, Y: 60, Z: -2 },
        { X: -10, Y: 60, Z: -2 },
        { X: -10, Y: 40, Z: -2 }
      ],
      [
        { X: 100, Y: 40, Z: -2 },
        { X: 110, Y: 40, Z: -2 },
        { X: 110, Y: 60, Z: -2 },
        { X: 100, Y: 60, Z: -2 }
      ],
      [
        { X:   0, Y: 60, Z: -1 },
        { X: 100, Y: 60, Z: -1 }
      ],
      [
        { X:   0, Y: 40, Z: -1 },
        { X: 100, Y: 40, Z: -1 }
      ],
      [
        { X: -10, Y: 40, Z: -2 },
        { X: 0, Y: 40, Z: -2 }
      ]
    ]);
    cps.sortPaths(3);
    assert.deepEqual(cps, new CutPaths([
      [
        { X: -10, Y: 40, Z: -2 },
        { X:   0, Y: 40, Z: -2 },
        { X:   0, Y: 40, Z: -1 },
        { X: 100, Y: 40, Z: -1 },
        { X: 100, Y: 40, Z: -2 },
        { X: 110, Y: 40, Z: -2 },
        { X: 110, Y: 60, Z: -2 },
        { X: 100, Y: 60, Z: -2 },
        { X: 100, Y: 60, Z: -1 },
        { X:   0, Y: 60, Z: -1 },
        { X:   0, Y: 60, Z: -2 },
        { X: -10, Y: 60, Z: -2 },
        { X: -10, Y: 40, Z: -2 },
      ]
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

  /*
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

  it("mergePaths 1 within", () => {
    const existing = new CutPaths([[{X:0,Y:0},{X:10,Y:10},{X:20,Y:0}]], true);
    const path = new CutPath([{X:0,Y:20},{X:10,Y:10},{X:20,Y:20}], true);
    existing.mergeClosedPath(path, page);
    assert.deepEqual(
      existing,
      new CutPaths([{ X: 0, Y: 0, Z: 0 },
                    { X: 10, Y: 10, Z: 0 },
                    { X: 20, Y: 20, Z: 0 },
                    { X: 0, Y: 20, Z: 0 },
                    { X: 10, Y: 10, Z: 0 },
                    { X: 20, Y: 0, Z: 0 }],
                   true));

  });
   
  it("mergePaths 2 within", () => {
    const existing = new CutPaths([[{X:30,Y:0},{X:40,Y:10},{X:50,Y:0}]], true);
    const path = new CutPath([{X:30,Y:25},{X:40,Y:15},{X:50,Y:25}], true);
    existing.mergeClosedPath(path, page);
    assert.deepEqual(
      existing,
      new CutPaths([
        { X: 30, Y: 0, Z: 0 },
        { X: 40, Y: 10, Z: 0 },
        { X: 40, Y: 15, Z: 0 },
        { X: 50, Y: 25, Z: 0 },
        { X: 30, Y: 25, Z: 0 },
        { X: 40, Y: 15, Z: 0 },
        { X: 40, Y: 10, Z: 0 },
        { X: 50, Y: 0, Z: 0 }],
                   true));
  });
   
  it("mergePaths 3 within", () => {
    const existing = new CutPaths([[{X:60,Y:0},{X:70,Y:10},{X:80,Y:0}]], true);
    const path = new CutPath([{X:65,Y:10},{X:75,Y:20},{X:65,Y:30}], true);
    existing.mergeClosedPath(path, page);
    assert.deepEqual(
      existing,
      new CutPaths([
        { X: 60, Y: 0, Z: 0 },
        { X: 70, Y: 10, Z: 0 },
        { X: 65, Y: 10, Z: 0 },
        { X: 75, Y: 20, Z: 0 },
        { X: 65, Y: 30, Z: 0 },
        { X: 65, Y: 10, Z: 0 },
        { X: 70, Y: 10, Z: 0 },
        { X: 80, Y: 0, Z: 0 }],
                   true));
  });
   
  it("mergePaths 4 within", () => {
    const existing = new CutPaths([[{X:90,Y:0},{X:100,Y:10},{X:110,Y:0}]], true);
    const path = new CutPath([{X:115,Y:0},{X:125,Y:10},{X:115,Y:20}], true);
    existing.mergeClosedPath(path, page);
    assert.deepEqual(
      existing,
      new CutPaths([
        { X: 115, Y: 0, Z: 0 },
        { X: 125, Y: 10, Z: 0 },
        { X: 115, Y: 20, Z: 0 },
        { X: 115, Y: 0, Z: 0 },
        { X: 110, Y: 0, Z: 0 },
        { X: 90, Y: 0, Z: 0 },
        { X: 100, Y: 10, Z: 0 },
        { X: 110, Y: 0, Z: 0 }],
                   true));
  });

  it("mergePaths 1 without", () => {
    const existing = new CutPaths([[{X:0,Y:0},{X:10,Y:10},{X:20,Y:0}]], true);
    const path = new CutPath([{X:0,Y:20},{X:10,Y:10},{X:20,Y:20}], true);
    existing.mergeClosedPath(path);
    assert.deepEqual(
      existing,
      new CutPaths([
        new CutPath([
          { X: 10, Y: 10, Z: 0 },
          { X: 20, Y: 20, Z: 0 },
          { X: 0, Y: 20, Z: 0 },
        ], true),
        new CutPath([
          { X: 0, Y: 0, Z: 0 },
          { X: 10, Y: 10, Z: 0 },
          { X: 20, Y: 0, Z: 0 }
        ], true)
      ]));
  });
   
  it("mergePaths 2 without", () => {
    const existing = new CutPaths([[{X:30,Y:0},{X:40,Y:10},{X:50,Y:0}]], true);
    const path = new CutPath([{X:30,Y:25},{X:40,Y:15},{X:50,Y:25}], true);
    existing.mergeClosedPath(path);
    assert.deepEqual(
      existing,
      new CutPaths([
        [
          { X: 40, Y: 15, Z: 0 },
          { X: 50, Y: 25, Z: 0 },
          { X: 30, Y: 25, Z: 0 },
        ],
        [
          { X: 30, Y: 0, Z: 0 },
          { X: 40, Y: 10, Z: 0 },
          { X: 50, Y: 0, Z: 0 },
        ]
      ], true));
  });
   
  it("mergePaths 3 without", () => {
    const existing = new CutPaths([[{X:60,Y:0},{X:70,Y:10},{X:80,Y:0}]], true);
    const path = new CutPath([{X:65,Y:10},{X:75,Y:20},{X:65,Y:30}], true);
    existing.mergeClosedPath(path);
    assert.deepEqual(
      existing,
      new CutPaths([
        [
          { X: 65, Y: 10, Z: 0 },
          { X: 75, Y: 20, Z: 0 },
          { X: 65, Y: 30, Z: 0 },
        ],
        [
          { X: 60, Y: 0, Z: 0 },
          { X: 70, Y: 10, Z: 0 },
          { X: 80, Y: 0, Z: 0 }
        ]
      ], true));
  });
   
  it("mergePaths 4 without", () => {
    const existing = new CutPaths([[{X:90,Y:0},{X:100,Y:10},{X:110,Y:0}]], true);
    const path = new CutPath([{X:115,Y:0},{X:125,Y:10},{X:115,Y:20}], true);
    existing.mergeClosedPath(path);
    assert.deepEqual(
      existing,
      new CutPaths([
        [
          { X: 115, Y: 0, Z: 0 },
          { X: 125, Y: 10, Z: 0 },
          { X: 115, Y: 20, Z: 0 },
        ],
        [
          { X: 90, Y: 0, Z: 0 },
          { X: 100, Y: 10, Z: 0 },
          { X: 110, Y: 0, Z: 0 },
        ]
      ], true));
  });

  it("mergePaths 2 clipped", () => {
    const clip = new CutPaths(
        [[{X:-10,Y:-10},{X:140,Y:-10},{X:140,Y:12},{X:-10,Y:12}]]);
    const existing = new CutPaths([[{X:30,Y:0},{X:40,Y:10},{X:50,Y:0}]], true);
    const path = new CutPath([{X:30,Y:25},{X:40,Y:15},{X:50,Y:25}], true);
    existing.mergeClosedPath(path, clip);
    assert.deepEqual(
      existing,
      new CutPaths([
        [
          { X: 40, Y: 15, Z: 0 },
          { X: 50, Y: 25, Z: 0 },
          { X: 30, Y: 25, Z: 0 },
        ],
        [
          { X: 30, Y: 0, Z: 0 },
          { X: 40, Y: 10, Z: 0 },
          { X: 50, Y: 0, Z: 0 },
        ]
      ], true));
  });*/

});

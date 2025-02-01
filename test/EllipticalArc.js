/* global assert */
/* global describe, it */

import { Vector } from "flatten-js";
import * as EllipticalArc from "../src/EllipticalArc.js";

import { UNit } from "./TestSupport.js";

function a(cx, cy, rx, ry, xang, laf, sf, x, y) {
  return EllipticalArc.toBeziers(
    new Vector(cx, cx),
    new Vector(rx, ry),
    Math.PI * xang / 180,
    laf>1,
    sf>1,
    new Vector(cx + x, cy + y));
}

describe("Elliptical Arc", () => {

  // Some angles used in tests
  const D45 = Math.PI / 4;
  const D90 = 2 * D45;
  const D135 = 3 * D45;
  const D180 = 2 * D90;
  const D270 = 3 * D90;
  const D315 = 7 * D45;

  // PI = 3.14 = 180deg
  // PI*3/2 = 4.217 = 270deg
  // +ve rotation is clockwise

  // See arcs.svg for coloured arcs
  it("a 10,10 0 0 0 10,10 red", () => {
    const p1 = new Vector(0, 0);
    const p2 = new Vector(10, 10);
    const r = new Vector(10, 10);
    const xAngle = 0;
    const largeArc = false;
    const sweep = false;
    const cap = EllipticalArc.endpointToCentreArcParams(
      p1, p2, r, xAngle, largeArc, sweep);
    assert.deepEqual(cap.c, new Vector(10,0));
    // bowl
    assert.equal(cap.theta, D180);
    assert.equal(cap.delta, -D90);
  });

  it("a 10,10 0 0 S 10,10 green", () => {
    const p1 = new Vector(0, 0);
    const p2 = new Vector(10, 10);
    const r = new Vector(10, 10);
    const xAngle = 0;
    const largeArc = false;
    const sweep = true; // clockwise arc
    const cap = EllipticalArc.endpointToCentreArcParams(
      p1, p2, r, xAngle, largeArc, sweep);
    assert.deepEqual(cap.c, new Vector(0,10));
    assert.equal(cap.theta, D270);
    assert.equal(cap.delta, D90);
  });

  it("a 10,10 0 L 0 10,10 blue", () => {
    const p1 = new Vector(0, 0);
    const p2 = new Vector(10, 10);
    const r = new Vector(10, 10);
    const xAngle = 0;
    const largeArc = true;
    const sweep = false;
    const cap = EllipticalArc.endpointToCentreArcParams(p1, p2, r, xAngle, largeArc, sweep);
    assert.deepEqual(cap.c, new Vector(0,10));
    assert.equal(cap.theta, D270);
    assert.equal(cap.delta, -D270);
  });

  it("a 10,10 0 L S 10,10 yellow", () => {
    const p1 = new Vector(0, 0);
    const p2 = new Vector(10, 10);
    const r = new Vector(10, 10);
    const xAngle = 0;
    const largeArc = true;
    const sweep = true;
    const cap = EllipticalArc.endpointToCentreArcParams(p1, p2, r, xAngle, largeArc, sweep);
    assert.deepEqual(cap.c, new Vector(10,0));
    assert.equal(cap.theta, D180);
    assert.equal(cap.delta, D270);
  });

  it("a 10,10 0 0 0 -10,-10 red", () => {
    const p1 = new Vector(10, 10);
    const p2 = new Vector(0, 0);
    const r = new Vector(10, 10);
    const xAngle = 0;
    const largeArc = false;
    const sweep = false;
    const cap = EllipticalArc.endpointToCentreArcParams(
      p1, p2, r, xAngle, largeArc, sweep);
    assert.deepEqual(cap.c, new Vector(0,10));
    assert.equal(cap.theta, 0);
    assert.equal(cap.delta, -D90);
  });

  it("a 10,10 0 0 S -10,-10 green", () => {
    const p1 = new Vector(10, 10);
    const p2 = new Vector(0, 0);
    const r = new Vector(10, 10);
    const xAngle = 0;
    const largeArc = false;
    const sweep = true;
    const cap = EllipticalArc.endpointToCentreArcParams(
      p1, p2, r, xAngle, largeArc, sweep);
    assert.deepEqual(cap.c, new Vector(10,0));
    assert.equal(cap.theta, D90);
    assert.equal(cap.delta, D90);
  });

  it("a 10,10 0 L 0 -10,-10 blue", () => {
    const p1 = new Vector(10, 10);
    const p2 = new Vector(0, 0);
    const r = new Vector(10, 10);
    const xAngle = 0;
    const largeArc = true;
    const sweep = false;
    const cap = EllipticalArc.endpointToCentreArcParams(
      p1, p2, r, xAngle, largeArc, sweep);
    assert.deepEqual(cap.c, new Vector(10,0));
    assert.equal(cap.theta, D90);
    assert.equal(cap.delta, -D270);
  });

  it("a 10,10 0 L 0 -10,-10 yellow", () => {
    const p1 = new Vector(10, 10);
    const p2 = new Vector(0, 0);
    const r = new Vector(10, 10);
    const xAngle = 0;
    const largeArc = true;
    const sweep = true;
    const cap = EllipticalArc.endpointToCentreArcParams(
      p1, p2, r, xAngle, largeArc, sweep);
    assert.deepEqual(cap.c, new Vector(0,10));
    assert.equal(cap.theta, 0);
    assert.equal(cap.delta, D270);
  });

  it("a 10,10 45 0 0 10,10", () => {
    const p1 = new Vector(0, 0);
    const p2 = new Vector(10, 10);
    const r = new Vector(10, 10);
    const xAngle = Math.PI / 4;
    const largeArc = false;
    const sweep = false;
    const cap = EllipticalArc.endpointToCentreArcParams(
      p1, p2, r, xAngle, largeArc, sweep);
    assert.almost(cap.c.x, 10);
    assert.almost(cap.c.y, 0);
    assert.almost(cap.theta, D135);
    assert.almost(cap.delta, -D90);
  });

  it("bez quad 1", () => {
    const p1 = new Vector(0, 10);
    const p2 = new Vector(10, 0);
    const r = new Vector(10, 10);
    const xAngle = 0;
    const largeArc = false;
    const sweep = false;
    const cap = EllipticalArc.endpointToCentreArcParams(
      p1, p2, r, xAngle, largeArc, sweep);
    const bez = EllipticalArc.toBezier(cap.c, cap.theta, cap.delta, r, xAngle);
    assert.almost(bez[0].x, 0);
    assert.almost(bez[0].y, 10);
    assert.almost(bez[1].x, 5.4858377035486345);
    assert.almost(bez[1].y, 10);
    assert.almost(bez[2].x, 10);
    assert.almost(bez[2].y, 5.4858377035486345);
    assert.almost(bez[3].x, 10);
    assert.almost(bez[3].y, 0);
  });

  it("bez quad 1 half", () => {
    const p1 = new Vector(0, 10);
    const p2 = new Vector(10, 0);
    const r = new Vector(10, 10);
    const xAngle = 0;
    const largeArc = false;
    const sweep = false;
    const cap = EllipticalArc.endpointToCentreArcParams(
      p1, p2, r, xAngle, largeArc, sweep);
    const bez = EllipticalArc.toBezier(
      cap.c, cap.theta, cap.delta/2, r, xAngle);
    assert.almost(bez[0].x, 0);
    assert.almost(bez[0].y, 10);
    assert.almost(bez[1].x, 2.651147734913025);
    assert.almost(bez[1].y, 10);
    assert.almost(bez[2].x, 5.19642327058112);
    assert.almost(bez[2].y, 8.94571235314983);
    assert.almost(bez[3].x, 7.0710678118654755);
    assert.almost(bez[3].y, 7.0710678118654755);
  });

  it("bezs quad 1", () => {
    const p1 = new Vector(0, 10);
    const p2 = new Vector(10, 0);
    const r = new Vector(10, 10);
    const xAngle = 0;
    const largeArc = false;
    const sweep = false;
    const bez = EllipticalArc.toBeziers(p1, r, xAngle, largeArc, sweep, p2);
    assert.almost(bez, [
      [
        new Vector(0, 10),
        new Vector(2.651147734913025, 10),
        new Vector(5.19642327058112, 8.94571235314983),
        new Vector(7.0710678118654755, 7.071067811865475)
      ],
      [
        new Vector(7.0710678118654755, 7.071067811865475),
        new Vector(8.94571235314983, 5.1964232705811195),
        new Vector(10, 2.6511477349130246),
        new Vector(10, 0)
      ]
    ]);
  });

  it("circle", () => { // 5 5 180 1 0 10 0
    const r = new Vector(5, 5);
    const p1 = new Vector(10, 0);
    const p2 = new Vector(20, 0);
    const xAngle = Math.PI;
    const largeArc = false;
    const sweep = false;
    const bez = EllipticalArc.toBeziers(p1, r, xAngle, largeArc, sweep, p2);
    // a semicircle should give us 4 curves
    assert.almost(bez, [
      [
        { x: 10, y: 0 },
        { x: 10, y: 1.3255738674565123 },
        { x: 10.527143823425085, y: 2.5982116352905598 },
        { x: 11.464466094067262, y: 3.5355339059327378 }
      ],
      [
        { x: 11.464466094067262, y: 3.5355339059327378 },
        { x: 12.40178836470944, y: 4.472856176574916 },
        { x: 13.674426132543488, y: 5 },
        { x: 15, y: 5 }
      ],
      [
        { x: 15, y: 5 },
        { x: 16.325573867456512, y: 5 },
        { x: 17.59821163529056, y: 4.472856176574915 },
        { x: 18.535533905932738, y: 3.5355339059327373 }
      ],
      [
        { x: 18.535533905932738, y: 3.5355339059327373 },
        { x: 19.472856176574915, y: 2.5982116352905598 },
        { x: 20, y: 1.3255738674565123 },
        { x: 20, y: 0 }
      ]
    ]);
  });
});

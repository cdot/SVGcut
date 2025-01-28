/* global assert */
/* global describe, it */

import{ Vector } from "../js/Vector.js";
import { endpointToCentreArcParams, ellipticalArcToBezier, ellipticalArcToBeziers } from "../js/EllipticalArc.js";

import { UNit } from "./TestSupport.js";

function a(cx, cy, rx, ry, xang, laf, sf, x, y) {
  return ellipticalArcToBeziers(
    new Vector(cx, cx),
    new Vector(rx, ry),
    Math.PI * xang / 180,
    laf>1,
    sf>1,
    new Vector(cx + x, cy + y));
}

describe("Elliptical Arc", () => {
  it("cap quad 1 clockwise", () => {
    const p1 = new Vector(0, 10);
    const p2 = new Vector(10, 0);
    const r = new Vector(10, 10);
    const xAngle = 0;
    const largeArc = false;
    const sweep = false;
    const cap = endpointToCentreArcParams(p1, p2, r, xAngle, largeArc, sweep);
    assert.deepEqual(cap.c, new Vector(0,0));
    assert.equal(cap.theta, Math.PI / 2);
    assert.equal(cap.delta, -Math.PI / 2);
  });

  it("cap quad 1 clockwise sweep", () => {
    const p1 = new Vector(0, 10);
    const p2 = new Vector(10, 0);
    const r = new Vector(10, 10);
    const xAngle = 0;
    const largeArc = false;
    const sweep = true;
    const cap = endpointToCentreArcParams(p1, p2, r, xAngle, largeArc, sweep);
    assert.deepEqual(cap.c, new Vector(10,10));
    assert.equal(cap.theta, Math.PI);
    assert.equal(cap.delta, Math.PI / 2);
  });

  it("cap quad 1 clockwise largeArc", () => {
    const p1 = new Vector(0, 10);
    const p2 = new Vector(10, 0);
    const r = new Vector(10, 10);
    const xAngle = 0;
    const largeArc = true;
    const sweep = false;
    const cap = endpointToCentreArcParams(p1, p2, r, xAngle, largeArc, sweep);
    assert.deepEqual(cap.c, new Vector(10,10));
    assert.equal(cap.theta, Math.PI);
    assert.equal(cap.delta, -3 * Math.PI / 2);
  });

  it("cap quad 1 clockwise largeArc sweep", () => {
    const p1 = new Vector(0, 10);
    const p2 = new Vector(10, 0);
    const r = new Vector(10, 10);
    const xAngle = 0;
    const largeArc = true;
    const sweep = true;
    const cap = endpointToCentreArcParams(p1, p2, r, xAngle, largeArc, sweep);
    assert.deepEqual(cap.c, new Vector(0,0));
    assert.equal(cap.theta, Math.PI / 2);
    assert.equal(cap.delta, 3 * Math.PI / 2);
  });

  it("cap quad 1 anticlockwise", () => {
    const p1 = new Vector(10, 0);
    const p2 = new Vector(0, 10);
    const r = new Vector(10, 10);
    const xAngle = 0;
    const largeArc = false;
    const sweep = false;
    const cap = endpointToCentreArcParams(p1, p2, r, xAngle, largeArc, sweep);
    assert.deepEqual(cap.c, new Vector(10,10));
    assert.equal(cap.theta, -Math.PI / 2);
    assert.equal(cap.delta, -Math.PI / 2);
  });

  it("cap quad 1 twisted", () => {
    const p1 = new Vector(0, 10);
    const p2 = new Vector(10, 0);
    const r = new Vector(10, 10);
    const xAngle = Math.PI / 4;
    const largeArc = false;
    const sweep = false;
    const cap = endpointToCentreArcParams(p1, p2, r, xAngle, largeArc, sweep);
    assert.almost(cap.c.x, 0);
    assert.almost(cap.c.y, 0);
    assert.almost(cap.theta, 0.7853981633974484);
    assert.almost(cap.delta, -1.570796326794897);
  });

  it("bez quad 1", () => {
    const p1 = new Vector(0, 10);
    const p2 = new Vector(10, 0);
    const r = new Vector(10, 10);
    const xAngle = 0;
    const largeArc = false;
    const sweep = false;
    const cap = endpointToCentreArcParams(p1, p2, r, xAngle, largeArc, sweep);
    const bez = ellipticalArcToBezier(cap.c, cap.theta, cap.delta, r, xAngle);
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
    const cap = endpointToCentreArcParams(p1, p2, r, xAngle, largeArc, sweep);
    const bez = ellipticalArcToBezier(cap.c, cap.theta, cap.delta/2, r, xAngle);
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
    const bez = ellipticalArcToBeziers(p1, r, xAngle, largeArc, sweep, p2);
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
    const bez = ellipticalArcToBeziers(p1, r, xAngle, largeArc, sweep, p2);
    console.log(bez);
  });
});

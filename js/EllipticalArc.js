/*Copyright Crawford Currie 2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */
import { Vector } from "./Vector.js";

/**
 * @namespace EllipticalArc
 * Computations for approximation of elliptical arcs using cubic Bezier curves
 * @see {@link https://www.w3.org/TR/SVG2/implnote.html#ArcImplementationNotes}
 */

// PI/2 is apparently pixel-accurate. Use PI/4 for even better.
const MAX_BEZIER_THETA = Math.PI / 4; // 45 degree bezier is OK

/**
 * Return value from endpoint to centre transformation.
 * @typedef {object} CentreArcParams
 * @property {Vector} c the arc centre
 * @property {number} theta the start angle
 * @property {number} delta the angle
 */

/**
 * Perform the endpoint to center arc parameter conversion as detailed
 * in the SVG 2 spec. B.2.4 Conversion from endpoint to center paramaterization
 * parameterization.
 * @param {Vector} p1 current position
 * @param {Vector} p2 finish position
 * @param {Vector} r Radii. May be scaled up, as per the SVG spec
 * @param {number} xAngle x axis rotation (radians)
 * @param {boolean} largeArc large arc flag
 * @param {boolean} sweep sweep flag
 * @return {CentreArcParams}
 * @private
 */
export function endpointToCentreArcParams(p1, p2, r, xAngle, largeArc, sweep) {
  r.x = Math.abs(r.x); r.y = Math.abs(r.y);

  // B.2.4 Step 1
  const h = p1.minus(p2).times(0.5);
  const m = p1.plus(p2).times(0.5);
  const mp = h.rotate(-xAngle);

  // B.2.4 Step 2
  let rs = r.times(r);
  const mps = mp.times(mp);

  // check if the radius is too small `pq < 0`, when `dq > rxs * rys`
  // (see below)
  // cr is the ratio (dq : rxs * rys) 
  const cr = mps.x / rs.x + mps.y / rs.y;
  if (cr > 1) {
    // scale up rX, rY equally so cr == 1
    const s = Math.sqrt(cr);
    r.x = s * r.x;
    r.y = s * r.y;
    rs = r.times(r);
  }
  const denominator = rs.dot(mps);
  const numerator = (rs.x * rs.y - denominator);
  const square = numerator / denominator;
  // use max to account for float precision
  let root = Math.sqrt(Math.max(0, square));
  if (largeArc === sweep)
    root = -root;

  const cp = new Vector(r.x * mp.y / r.y, -r.y * mp.x / r.x).times(root);

  // B.2.4 Step 3
  const c = cp.rotate(xAngle).plus(m);
  //console.debug("c", c);

  // B.2.4 Step 4
  const v = mp.minus(cp).over(r);
  const stop = mp.plus(cp).over(r).times(-1);
  //console.debug("stop", stop);

  let theta = new Vector(1, 0).angle(v) % (2 * Math.PI);
  //console.debug("theta", theta);

  let delta = v.angle(stop);
  //console.debug("predelta", delta);
  delta %= 2 * Math.PI;
  //console.debug("delta", delta);
  if (!sweep && delta > 0)
    delta -= 2 * Math.PI;
  else if (sweep && delta < 0)
    delta += 2 * Math.PI;

  //console.debug(c.x + r.x * Math.cos(theta), c.y + r.y * Math.sin(theta));

  return {
    c: c,
    theta: theta,
    delta: delta
  };
}

/**
 * Compute the cubic Bezier control points for an elliptical arc.
 * @param {Vector} c centre of the ellipse
 * @param {number} theta start angle of the arc (radians)
 * @param {number} delta delta angle of the arc (radians)
 * @param {Vector} r radii of the ellipse
 * @param {number} xAngle rotation around the Z axis
 * @return {Vector[]} the four control points p1, c1, c2, p2
 * @private
 */
export function ellipticalArcToBezier(c, theta, delta, r, xAngle) {

  // EllipticArcVector function
  function E(theta) {
    const ct = Math.cos(theta);
    const st = Math.sin(theta);
    return c.plus(new Vector(r.x * ct, r.y * st).rotate(xAngle));
  }

  // EllipticArcVector derivative function
  function Ee(theta) {
    return new Vector(-r.x * Math.sin(theta),
                     r.y * Math.cos(theta)).rotate(xAngle);
  }

  // The control points p1, q1, q2 and p2 of a cubic Bezier approximating
  // an elliptical arc
  const t = Math.tan(delta / 2);
  const alpha = Math.sin(delta) * (Math.sqrt(4 + 3 * t * t) - 1) / 3;
  const theta2 = theta + delta;
  const cp1 = E(theta), cp2 = E(theta2);
  const tee = Ee(theta);
  const q1 = cp1.plus(tee.times(alpha));
  const tee2 = Ee(theta2);
  const q2 = cp2.minus(tee2.times(alpha));
  return [ cp1, q1, q2, cp2 ];
}

/*
 * Convert SVG elliptical arc parameters to a sequence of Bezier
 * curves. The curves closely approximate the elliptical arc.
 * @param {Vector} p1 the absolute coordinates of the current point on
 * the path.
 * @param {Vector} r the radii of the ellipse (also known as its
 * semi-major and semi-minor axes).
 * @param {number} xAngle rotation of the ellipse around the Z axis (radians)
 * @param {boolean} largeArc false if an arc spanning less than or
 * equal to 180 degrees is chosen, or true if an arc spanning greater
 * than 180 degrees is chosen.
 * @param {boolean} sweep false if the line joining center to arc
 * sweeps through decreasing angles, or true if it sweeps through
 * increasing angles.
 * @param {Vector} p2 the absolute coordinates of the final point of
 * the arc
 * @return {number[][]} an array of cubic Bezier curve control points.
 * Each entry is the four control points p1, c1, c2, p2 for a curve.
 * @memberof EllipticalArc
 */
export function ellipticalArcToBeziers(p1, r, xAngle, largeArc, sweep, p2) {
  const cap = endpointToCentreArcParams(p1, p2, r, xAngle, largeArc, sweep);
  let theta = cap.theta;
  const steps = Math.abs(cap.delta / MAX_BEZIER_THETA);
  const step = cap.delta / steps;
  const stop = theta + cap.delta;
  const curves = [];
  while (true) {
    if (step < 0 && theta <= stop || step > 0 && theta >= stop)
      break;
    curves.push(ellipticalArcToBezier(cap.c, theta, step, r, xAngle));
    theta += step;
  }
  return curves;
}

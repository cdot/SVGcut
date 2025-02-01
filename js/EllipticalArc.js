/*Copyright Crawford Currie 2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */
import { Vector } from "flatten-js";

// Per-ordinate divide
Vector.prototype.over = function (v) {
  return new Vector(this.x / v.x, this.y / v.y);
};

/**
 * Computations for approximation of elliptical arcs using cubic Bezier curves
 * @see {@link https://www.w3.org/TR/SVG2/implnote.html#ArcImplementationNotes}
 * @namespace EllipticalArc
 */

// PI/2 is apparently pixel-accurate. Use PI/4 for even better.
const MAX_BEZIER_THETA = Math.PI / 4; // 45 degree bezier is OK

/**
 * Return value from endpoint to centre transformation.
 * @typedef {object} CentreArcParams
 * @property {Vector} c the arc centre
 * @property {number} theta the start angle
 * @property {number} delta the angle
 * @memberof EllipticalArc
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
 * @memberof EllipticalArc
 */
export function endpointToCentreArcParams(p1, p2, r, xAngle, largeArc, sweep) {
  r.x = Math.abs(r.x); r.y = Math.abs(r.y);

  // B.2.4 Step 1
  const h = p1.subtract(p2).multiply(0.5);
  const m = p1.add(p2).multiply(0.5);
  const mp = h.rotate(-xAngle);

  // B.2.4 Step 2
  let rs = new Vector(r.x * r.x, r.y * r.y);
  const mps = new Vector(mp.x * mp.x, mp.y * mp.y);

  // check if the radius is too small `pq < 0`, when `dq > rxs * rys`
  // (see below)
  // cr is the ratio (dq : rxs * rys)
  const cr = mps.x / rs.x + mps.y / rs.y;
  if (cr > 1) {
    // scale up rX, rY equally so cr == 1
    const s = Math.sqrt(cr);
    r.x = s * r.x;
    r.y = s * r.y;
    rs = new Vector(r.x * r.x, r.y * r.y);
  }
  const denominator = rs.dot(mps);
  const numerator = (rs.x * rs.y - denominator);
  const square = numerator / denominator;
  // use max to account for float precision
  let root = Math.sqrt(Math.max(0, square));
  if (largeArc === sweep)
    root = -root;

  const cp = new Vector(r.x * mp.y / r.y, -r.y * mp.x / r.x).multiply(root);

  // B.2.4 Step 3
  const c = cp.rotate(xAngle).add(m);
  //console.debug("c", c);

  // B.2.4 Step 4
  const v = mp.subtract(cp).over(r);
  const stop = mp.add(cp).over(r).multiply(-1);
  //console.debug("stop", stop);

  let theta = new Vector(1, 0).angleTo(v) % (2 * Math.PI);
  //console.debug("theta", theta);

  let delta = v.angleTo(stop);
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
 * @memberof EllipticalArc
 * @private
 */
export function toBezier(c, theta, delta, r, xAngle) {

  // EllipticArcVector function
  function E(theta) {
    const ct = Math.cos(theta);
    const st = Math.sin(theta);
    return c.add(new Vector(r.x * ct, r.y * st).rotate(xAngle));
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
  const q1 = cp1.add(tee.multiply(alpha));
  const tee2 = Ee(theta2);
  const q2 = cp2.subtract(tee2.multiply(alpha));
  return [ cp1, q1, q2, cp2 ];
}

/**
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
export function toBeziers(p1, r, xAngle, largeArc, sweep, p2) {
  const cap = endpointToCentreArcParams(p1, p2, r, xAngle, largeArc, sweep);
  let theta = cap.theta;
  const steps = Math.abs(cap.delta / MAX_BEZIER_THETA);
  const step = cap.delta / steps;
  const stop = theta + cap.delta;
  const curves = [];
  while (true) {
    if (step < 0 && theta <= stop || step > 0 && theta >= stop)
      break;
    curves.push(toBezier(cap.c, theta, step, r, xAngle));
    theta += step;
  }
  return curves;
}

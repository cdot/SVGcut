/*Copyright Crawford Currie 2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */
/* global assert */
import { Vector } from "flatten-js";
const { PI, sin, cos, tan, abs, sqrt } = Math;

// Per-ordinate divide
Vector.prototype.over = function (v) {
  return new Vector(this.x / v.x, this.y / v.y);
};

/**
 * Computations for approximation of elliptical arcs using cubic Bezier curves
 * @see {@link https://www.w3.org/TR/SVG2/implnote.html#ArcImplementationNotes}
 * @namespace EllipticalArc
 */

// There is a limit to the arc of a curve that can be represented by a Bezier.
// PI/2 is apparently pixel-accurate.
const MAX_BEZIER_THETA = PI / 2;

/**
 * Return value from endpoint to centre transformation.
 * @typedef {object} CentreArcParams
 * @property {Vector} c the arc centre
 * @property {number} theta the start angle
 * @property {number} dTheta the arc angle
 * @memberof EllipticalArc
 */

/**
 * Perform the endpoint to centre arc parameter conversion as detailed
 * in the SVG 2 spec. B.2.4 Conversion from endpoint to center
 * parameterization and B.2.5 Correction of out of range radii
 * @param {Vector} p1 current position
 * @param {Vector} p2 finish position
 * @param {Vector} r Radii. May be scaled up, as per the SVG spec
 * @param {number} phi x axis rotation (radians)
 * @param {boolean} fa large arc flag
 * @param {boolean} fs sweep flag
 * @return {CentreArcParams}
 * @memberof EllipticalArc
 */
export function endpointToCentreArcParams(p1, p2, r, phi, fa, fs) {
  // B.2.5. Correction of out-of-range radii
  // B.2.5. Step 1: Ensure radii are non-zero.
  // This case is detected and dealt with in SVG.js
  assert(r.x !== 0 && r.y !== 0);

  const sinPhi = sin(phi); // 0 if phi = 0
  const cosPhi = cos(phi); // 1 if phi = 0

  // Step 1: rotate line from p1 to p2 about Z by phi
  // Place origin at midpoint of p1..p2
  const mx = (p1.x - p2.x) / 2, my = (p1.y - p2.y) / 2;
  // Rotate to line up coordinate axes with the axes of the ellipse
  const mpx = cosPhi * mx + sinPhi * my, mpy = -sinPhi * mx + cosPhi * my;
  // Square it
  const mpx2 = mpx * mpx, mpy2 = mpy * mpy;

  //  B.2.5. Step 2: Ensure radii are positive
  r.x = abs(r.x);
  r.y = abs(r.y);

  // B.2.5. Step 3: Ensure radii are large enough to span the arc
  let rx2 = r.x * r.x, ry2 = r.y * r.y;
  const L = mpx2 / rx2 + mpy2 / ry2;
  if (L > 1) {
    const L2 = sqrt(L);
    r.x = L2 * r.x;
    r.y = L2 * r.y;
    rx2 = r.x * r.x;
    ry2 = r.y * r.y;
  }

  // Step 2: compute (cx', cy')
  const sign = (fa === fs) ? -1 : 1;

  // pow(sqrt(L) * r.x, 2) will be less than L * pow(r.x, 2) after L2
  // branch above, so below value will be negative. abs() will fix it.
  const M = sign * sqrt(abs(
    (rx2 * ry2 - rx2 * mpy2 - ry2 * mpx2) /
    (rx2 * mpy2 + ry2 * mpx2)));
  const cpx = M * (r.x * mpy) / r.y, cpy = M * (-r.y * mpx) / r.x;

  // Step 3: Compute centre from (cx′, cy′)
  const c = new Vector(cosPhi * cpx - sinPhi * cpy + (p1.x + p2.x) / 2,
                       sinPhi * cpx + cosPhi * cpy + (p1.y + p2.y) / 2);

  // Step 4: compute θ and dθ
  const start = new Vector((mpx - cpx) / r.x, (mpy - cpy) / r.y);
  const theta = new Vector(1, 0).angleTo(start);

  let dTheta = start.angleTo(
    new Vector((-mpx - cpx) / r.x, (-mpy - cpy) / r.y)) % (2 * PI);

  if (!fs && dTheta > 0) dTheta -= 2 * PI;
  if (fs && dTheta < 0) dTheta += 2 * PI;

  return { c: c, theta: theta, dTheta: dTheta };
}

/**
 * Compute the cubic Bezier control points for an elliptical arc that
 * subtends an angle less than MAX_BEZIER_THETA.
 * @param {Vector} c centre of the ellipse
 * @param {number} theta start angle of the arc (radians)
 * @param {number} dTheta delta angle of the arc (radians)
 * @param {Vector} r radii of the ellipse
 * @param {number} xAngle rotation around the Z axis
 * @return {Vector[]} the four control points p1, c1, c2, p2
 * @memberof EllipticalArc
 */
export function toBezier(c, theta, dTheta, r, xAngle) {

  const { sin, cos } = Math;

  // EllipticArcVector function
  function E(theta) {
    const ct = cos(theta);
    const st = sin(theta);
    return c.add(new Vector(r.x * ct, r.y * st).rotate(xAngle));
  }

  // EllipticArcVector derivative function
  function Ee(theta) {
    return new Vector(-r.x * sin(theta),
                     r.y * cos(theta)).rotate(xAngle);
  }

  // The control points p1, q1, q2 and p2 of a cubic Bezier approximating
  // an elliptical arc
  const t = tan(dTheta / 2);
  const alpha = sin(dTheta) * (sqrt(4 + 3 * t * t) - 1) / 3;
  const theta2 = theta + dTheta;
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
 * @return {Vector[][]} an array of cubic Bezier curve control points.
 * Each entry is the four control points p1, c1, c2, p2 for a curve.
 * @memberof EllipticalArc
 */
export function toBeziers(p1, r, xAngle, largeArc, sweep, p2) {
  const cap = endpointToCentreArcParams(p1, p2, r, xAngle, largeArc, sweep);
  // Split the curve into Bezier segments, each no more than
  // MAX_BEZIER_THETA radians of the arc.
  const curves = [];
  while (cap.dTheta !== 0) {
    let ang = cap.dTheta;
    if (abs(ang) > MAX_BEZIER_THETA) {
      if (ang < 0) {
        ang = -MAX_BEZIER_THETA;
        cap.dTheta += MAX_BEZIER_THETA;
      } else {
        ang = MAX_BEZIER_THETA;
        cap.dTheta -= MAX_BEZIER_THETA;
      }
    } else {
      ang = cap.dTheta;
      cap.dTheta = 0;
    }
    curves.push(toBezier(cap.c, cap.theta, ang, r, xAngle));
    cap.theta += ang;
  }
  return curves;
}

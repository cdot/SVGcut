/*Copyright Crawford Currie 2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */
/* global assert */

/**
 * Simple 2S vector class
 */
export class Vector {
  /**
   * Construct fro (x,y) or an object that has x and y (such as a
   * flatten-js Point) or X and Y (such as a ClipperLib.IntPoint)
   */
  constructor(x, y) {
    if (typeof x === "object") {
      if (typeof x.x === "number" && typeof x.y === "number")
        this.x = x.x, this.y = x.y;
      else if (typeof x.X === "number" && typeof x.Y === "number")
        this.x = x.X, this.y = x.Y;
      else
        assert(false);
    } else
      this.x = x, this.y = y;
  }

  /**
   * Negate the vector
   * @return {Vector} -this
   */
  negated(v) {
    return new Vector(-this.x, -this.y);
  }

  /**
   * Add another Vector
   * @param {Vector} v the other vector
   * @return {Vector} the vector sum
   */
  plus(v) {
    return new Vector(this.x + v.x, this.y + v.y);
  }

  /**
   * Subtract another Vector
   * @param {Vector} v the other vector
   * @return {Vector} the vector difference
   */
  minus(v) {
    return new Vector(this.x - v.x, this.y - v.y);
  }

  /**
   * Dot product
   * @param {Vector} v the other vector
   * @return {Vector} the dot product
   */
  dot(v) {
    return this.x * v.x + this.y * v.y;
  }

  /**
   * Rotate about the Z-axis
   * @param {number} theta the rotation angle (radians)
   * @return {Vector} the rotated vector
   */
  rotate(theta) {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    return new Vector(this.x * c - this.y * s,
                     this.x * s + this.y * c);
  }

  /**
   * Multiply by another vector or a scalar.
   * @param {number|Vector} v
   * @return {Vector} either (x*v,y*v) or (x*v.x,y*v.y)
   */
  times(v) {
    if (typeof v === "object")
      return new Vector(this.x * v.x, this.y * v.y);
    else
      return new Vector(this.x * v, this.y * v);
  }

  /**
   * Divide by another vector or a scalar.
   * @param {number|Vector} v
   * @return {Vector} either (x/v,y/v) or (x/v.x,y/v.y)
   */
  over(v) {
    if (typeof v === "object")
      return new Vector(this.x / v.x, this.y / v.y);
    else
      return new Vector(this.x / v, this.y / v);
  }

  /**
   * Square of the length of the vector
   * @return {number} length**2
   */
  len2() {
    return this.x * this.x + this.y * this.y;
  }

  /**
   * Length of the vector
   * @return {number} length
   */
  len() {
    return Math.sqrt(this.len2());
  }

  /**
   * Vector normalisation
   * @return {Vector} the normalised vector
   */
  normalised() {
    return this.over(this.len());
  }

  /**
   * Determinant of the vector
   * @return {number} the determinant
   */
  det(v) {
    return this.x * v.y - this.y * v.x;
  }

  /**
   * Find the angle made with another vector
   * @param {Vector} v the other vector
   * @return {number} the angle between the vectors (radians)
   */
  angle(v) {
    let dot = this.dot(v) / (this.len() * v.len());
    // floating point precision, slightly over values may appear
    if (dot > 1) dot = 1; else if (dot < -1) dot = -1;
    const ang = Math.acos(dot);
    if (this.det(v) < 0)
      return -ang;
    return ang;
  }
}

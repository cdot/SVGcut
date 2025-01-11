/*Copyright Crawford Currie 2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/**
 * Class of rectangles. Designed to be reasonably compatible with
 * both DOMRect and SVGRect.
 * The basic parameters of the rectangle are x, y, width and height.
 * If these are set, there is no check for inside-outness, so caveat
 * emptor.
 * Also provided are left, right, top and bottom, which will check
 * for inside-outness.
 * (an inside-out rect is one where the left edge is to the right of
 * the right edge)
 */
class Rect {

  /**
   * @param {number|Rect|DOMRect|SVGRect} x x origin, or an object
   * copy-construct
   * @param {number} y y origin
   * @param {number} width width of the rect (negative if the rect
   * extends to the left of the origin)
   * @param {number} height (negative if the rect extends above the
   * origin)
   */
  constructor(x = 0, y = 0, width = 0, height = 0) {
    if (typeof x === "object") {
      y = x.y;
      width = x.width;
      height = x.height;
      x = x.x;
    }

    /**
     * The x coordinate of the origin (the left of the rectangle).
     * @member {number}
     */
    this.x = width < 0 ? x + width : x;

    /**
     * The y coordinate of the origin (the top of the rectangle).
     * @member {number}
     */
    this.y = height < 0 ? y + height : y;

    /**
     * The width of the rect.
     * @member {number}
     */
    this.width = Math.abs(width);

    /**
     * The height of the rect.
     * @member {number}
     */
    this.height = Math.abs(height);
  }

  /**
   * Extend the rectangle if necessary to enclose a point (x, y)
   * or another rectangle.
   * @param {number|Rect|DOMRect|SVGRect} x coordinate, or another
   * rectangle to enclose.
   * @param {number} y (undefined if x is an object)
   */
  enclose(x, y) {
    if (typeof x === "object")
      return this.enclose(x.x, x.y).enclose(x.x + x.width, x.y + x.height);

    if (x < this.left)
      this.left = x;
    else if (x > this.right)
      this.right = x;
    if (y < this.top)
      this.top = y;
    else if (y > this.bottom)
      this.bottom = y;
    return this;
  }

  /**
   * Test if the rect contains the given point
   * @param {number} x
   * @param {number} y
   */
  contains(x, y) {
    return !(x < this.left
             || x > this.right
             || y < this.top
             || y > this.bottom);
  }

  /**
   * Returns the left coordinate of the Rect.
   * @return {number} minimum x
   */
  get left() {
    return this.x;
  }

  /**
   * Set the left coordinate of the Rect. Width will be increased/decreased
   * to maintain the same right.
   * @return {number} minimum x
   * @throws {Error} if the rect would be inside-out
   */
  set left(x) {
    if (x > this.right)
      throw new Error("Cannot set left, rect would be inside-out");
    this.width += this.x - x;
    this.x = x;
  }

  /**
   * Returns the right coordinate of the Rect.
   * @return {number} x + width, or x if width is negative
   */
  get right() {
    return this.x + this.width;
  }

  /**
   * Set the left coordinate of the Rect. Width will be increased/decreased
   * to maintain the same left.
   * @return {number} maximum x
   * @throws {Error} if the rect would be inside-out
   */
  set right(x) {
    if (x < this.left)
      throw new Error("Cannot set right, rect would be inside-out");
    this.width = x - this.x;
  }

  /**
   * Returns the top coordinate of the Rect.
   * @return {number} y, or y + height if height is negative
   */
  get top() {
    return this.y;
  }

  /**
   * Set the top coordinate of the Rect. Height will be increased/decreased
   * to maintain the same right.
   * @return {number} minimum y
   * @throws {Error} if the rect would be inside-out
   */
  set top(y) {
    if (y > this.bottom)
      throw new Error("Cannot set top, rect would be inside-out");
    this.height += this.y - y;
    this.y = y;
  }

  /**
   * Returns the bottom coordinate of the Rect
   * @return y + height
   */
  get bottom() {
    return this.y + this.height;
  }

  /**
   * Set the bottom coordinate of the Rect. Width will be increased/decreased.
   * @return {number} maximum y
   * @throws {Error} if the rect would be inside-out
   */
  set bottom(y) {
    if (y < this.top)
      throw new Error("Cannot set bottom, rect would be inside-out");
    this.height = y - this.y;
  }

  /**
   * Make sure the rectangle isn't inside out. This can happen if
   * width or height is manually set negative.
   * @return {Rect} this
   */
  normalise() {
    if (this.width < 0) {
      this.width = -this.width;
      this.x -= this.width;
    }
    if (this.height < 0) {
      this.height = -this.height;
      this.y -= this.height;
    }
    return this;
  }

  toString() {
    return `Rect{${this.x},${this.y},${this.width},${this.height}}`;
  }
}

export { Rect }

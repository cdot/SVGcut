/*Copyright Crawford Currie 2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */
/* global assert */

/**
 * Class of 3D bounding boxes.
 */
export class BBox3D {

  /**
   * Construct from two points, or from a single CutPoint
   * @param {number|CutPoint} minX
   * @param {number?} minY
   * @param {number?} minZ
   * @param {number?} maxX
   * @param {number?} maxY
   * @param {number?} maxZ
   */
  constructor(minX, minY, minZ, maxX, maxY, maxZ) {
    if (typeof minX === "object") {
      maxZ = minZ = minX.Z;
      maxY = minY = minX.Y;
      maxX = minX = minX.X;
    }
    this.minX = minX;
    this.minY = minY;
    this.minZ = minZ;
    this.maxX = maxX;
    this.maxY = maxY;
    this.maxZ = maxZ;
  }

  /**
   * Extend the bounding box to contain the point
   * @param {number|CutPoint} x x, y, z, or a CutPoint
   * @param {number} y
   * @param {number} z
   */
  expand(x, y, z) {
    if (typeof x === "object") {
      if (x instanceof BBox3D) {
        this.expand(x.minX, x.minY, x.minZ);
        this.expand(x.maxX, x.maxY, x.maxZ);
      } else if (typeof x.X === "number")
        this.expand(x.X, x.Y, x.Z);
      else assert(false);
    } else {
      if (x < this.minX) this.minX = x;
      if (y < this.minY) this.minY = y;
      if (z < this.minZ) this.minZ = z;
      if (x > this.maxX) this.maxX = x;
      if (y > this.maxY) this.maxY = y;
      if (z > this.maxZ) this.maxZ = z;
    }
  }
}

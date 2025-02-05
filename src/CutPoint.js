/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global assert */
/* global ClipperLib */
ClipperLib.use_xyz = true;

/**
 * Extension of ClipperLib.IntPoint, used to represent points
 * in CutPath space. Just used to isolate ClipperLib from the rest
 * of the code as far as possible.
 */
export class CutPoint extends ClipperLib.IntPoint {
  /**
   * Get the square of the distance between two points
   * @param {CutPoint} b
   */
  dist2(b) {
    const dx = this.X - b.X;
    const dy = this.Y - b.Y;
    return dx * dx + dy * dy;
  }

  dist(b) {
    return Math.sqrt(this.dist(b));
  }

  equals(b) {
		return this.X === b.X && this.Y === b.Y;
  }
};

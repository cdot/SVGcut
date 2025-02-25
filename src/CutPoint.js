/*Copyright Crawford Currie 2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global assert */
/* global ClipperLib */
ClipperLib.use_xyz = true;

/**
 * Extension of ClipperLib.IntPoint, used to represent points
 * in CutPath space. Just used to isolate ClipperLib from the rest
 * of the code as far as possible.
 * @extends ClipperLib.IntPoint
 */
export class CutPoint extends ClipperLib.IntPoint {
  /**
   * Use linear interpolation to determine the Z of a 2D intersection point.
   * The computed Z is written back to the intersection point.
   * Where the two points are coincident in 2D, the assigned Z will be halfway
   * between their Z's.
   * @param {CutPoint} v1 start of intersected edge
   * @param {CutPoint} v2 end of intersected edge
   * @param {CutPoint} ip intersection point
   */
  static interpolateZ(v1, v2, ip) {
    const ex = v2.X - v1.X, ey = v2.Y - v1.Y;
    const el = Math.sqrt(ex * ex + ey * ey);
    if (el === 0) { ip.Z = (v1.Z + v2.Z) / 2; return; }
    const sx = ip.X - v1.X, sy = ip.Y - v1.Y;
    const sl = Math.sqrt(sx * sx + sy * sy);
    const t = sl / el;
    const dZ = v2.Z - v1.Z;
    ip.Z = v1.Z + dZ * t;
  }

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
    return Math.sqrt(this.dist2(b));
  }

  equals(b) {
		return this.X === b.X && this.Y === b.Y;
  }
};

/*Copyright Crawford Currie 2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global assert */
/* global ClipperLib */
ClipperLib.use_xyz = true;

import { CutPoint } from "./CutPoint.js";
import { CutPath } from "./CutPath.js";
import { CutPaths } from "./CutPaths.js";

/**
 * Given a single tool path and an array of paths representing a set
 * of disjoint polygons representing tabs, split the toolpath into a
 * sequence of paths such that where a path enters or leaves one of
 * the polygons it gets split into two paths. Assign Z values to path
 * vertices that reflect the depth to which that path segment is to be
 * cut.
 * @param {CutPath} toolPath path being followed by the cutter, may be
 * open or closed.
 * @param {CutPaths} tabGeometry polygons representing tabs, must all
 * be closed paths and non-overlapping.
 * @param {number} cutZ the Z to cut to outside of tabs (integer units)
 * @param {number} tabZ the Z to cut to within tabs (integer units)
 * @return {CutPaths} array of puts with Z coords assigned
 * @author Crawford Currie
 * @memberof Cam
 */
export function splitPathOverTabs(toolPath, tabGeometry, cutZ, tabZ) {
  if (toolPath.isClosed)
    toolPath.push(toolPath[0]);

  if (!tabGeometry || tabGeometry.length === 0) {
    toolPath.Z(cutZ, true);
    return new CutPaths([ toolPath ]);
  }

  // Use Difference to extract the cut paths
  let clpr = new ClipperLib.Clipper();
  clpr.ZFillFunction = CutPoint.interpolateZ;
  clpr.AddPath(toolPath, ClipperLib.PolyType.ptSubject, false);
  clpr.AddPaths(tabGeometry, ClipperLib.PolyType.ptClip, true);
  let solution_polytree = new ClipperLib.PolyTree();
  clpr.Execute(ClipperLib.ClipType.ctDifference, solution_polytree,
               ClipperLib.PolyFillType.pftNonZero,
               ClipperLib.PolyFillType.pftNonZero);
  const cutDepthPaths = new CutPaths(
    ClipperLib.Clipper.OpenPathsFromPolyTree(solution_polytree));
  cutDepthPaths.Z(cutZ, true);

  // Use intersection to extract the tab paths
  clpr = new ClipperLib.Clipper();
  clpr.ZFillFunction = CutPoint.interpolateZ;
  clpr.AddPath(toolPath, ClipperLib.PolyType.ptSubject, false);
  clpr.AddPaths(tabGeometry, ClipperLib.PolyType.ptClip, true);
  solution_polytree = new ClipperLib.PolyTree();
  clpr.Execute(ClipperLib.ClipType.ctIntersection, solution_polytree,
               ClipperLib.PolyFillType.pftNonZero,
               ClipperLib.PolyFillType.pftNonZero);
  const tabDepthPaths = new CutPaths(ClipperLib.Clipper.OpenPathsFromPolyTree(
    solution_polytree));
  tabDepthPaths.Z(tabZ, true);

  // Combine and merge the paths
  return cutDepthPaths.concat(tabDepthPaths).sortPaths(3);
}

//import "snapsvg";
/* global Snap */

import { UnitConverter } from "./UnitConverter.js";

/**
 * Functions for handling Snap paths.
 * Snap paths are used for generating the SVG displayed in the middle
 * of the UI. They are used for visual feedback only, and play no part in
 * Gcode generation.
 * @see {@link http://snapsvg.io/docs/#Paper.path|Snap}
 * @typedef {(string|number)[]} a tuple representing an SVG drawing
 * operation. The first letter is the operation (e.g. L or M) followed
 * by 2 or more numbers.
 * @typedef {Segment[][]} SnapPath an array of Segments.
 */
      
/**
 * Linearize a cubic bezier to a snap path.
 * @param {number} p1x start point X
 * @param {number} p1y start point Y
 * @param {number} c1x control point 1 X
 * @param {number} c1y control point 1 Y
 * @param {number} c2x control point 2 X
 * @param {number} c2y control point 2 Y
 * @param {number} p2x end point X
 * @param {number} p2y end point Y
 * @param {number} minSegs minimum number of segments in the path
 * @param {number} minSegLen minimum length of a segment
 * @return {SnapPath} ['L', x2, y2, x3, y3, ...]. Doesn't
 * include (p1x, p1y); it's part of the previous segment.
 * @private
 */
function linearizeCubicBezier(
  p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, minSegs, minSegLen) {

  function bez(p0, p1, p2, p3, t) {
    return (1 - t) * (1 - t) * (1 - t) * p0 + 3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t * p3;
  }
  
  if (p1x == c1x && p1y == c1y && p2x == c2x && p2y == c2y)
    return [ 'L', p2x, p2y ];

  let numSegments = minSegs;
  let result = null;
  while (result == null) {
    let x = p1x;
    let y = p1y;
    result = [ 'L' ];
    for (let i = 1; i <= numSegments; ++i) {
      const t = 1.0 * i / numSegments;
      const nextX = bez(p1x, c1x, c2x, p2x, t);
      const nextY = bez(p1y, c1y, c2y, p2y, t);
      if ((nextX - x) * (nextX - x) + (nextY - y) * (nextY - y)
          > minSegLen * minSegLen) {
        numSegments *= 2;
        result = null;
        break;
      }
      result.push(nextX, nextY);
      x = nextX;
      y = nextY;
    }
  }
  return result;
}

/**
 * Linearize a snap path.
 * @param {SnapPath} path
 * @param {number} curveMinSegs minimum number of segments in a curve
 * @param {number} curveMinSegLen minimum length of a segment in a curve
 * @return {SnapPath}
 * @throws {Error} if there's a problem
 * @private
 */
function linearize(path, curveMinSegs, curveMinSegLen) {
  if (path.length < 2 || path[0].length != 3 || path[0][0] != 'M')
    throw new Error("Path does not begin with M");
  let x = path[0][1];
  let y = path[0][2];
  const result = [path[0]];
  for (let i = 1; i < path.length; ++i) {
    const subpath = path[i];
    if (subpath[0] == 'C' && subpath.length == 7) {
      result.push(linearizeCubicBezier(
        x, y, subpath[1], subpath[2], subpath[3],
        subpath[4], subpath[5], subpath[6], curveMinSegs, curveMinSegLen));
      x = subpath[5];
      y = subpath[6];
    } else if (subpath[0] == 'M' && subpath.length == 3) {
      result.push(subpath);
      x = subpath[1];
      y = subpath[2];
    } else
      throw new Error(`Subpath has an unknown prefix: ${subpath[0]}`);
  }
  return result;
};

/**
 * Get a linear Snap path from an SVG Element.
 * @see {@link http://snapsvg.io/docs/#Paper.path|Snap}
 * @param {Element} element the element (only path or rect currently supported)
 * @param {number} curveMinSegs minimum number of segments in a curve
 * @param {number} curveMinSegLen minimum segment length in a curve
 * @throws {Error} if there's a problem
 */
export function fromElement(element, curveMinSegs, curveMinSegLen) {
  let path = null;

  switch (element.type) {
  case "svg": return null;
  case "path": path = element.attr("d"); break;
  case "rect": {
    const x = Number(element.attr("x"));
    const y = Number(element.attr("y"));
    const w = Number(element.attr("width"));
    const h = Number(element.attr("height"));
    path = `m${x},${y} ${w},${0} 0,${h} ${-w},0 0, ${-h}`;
    break;
  }
  default:
    throw new Error(`<b>${element.type}</b> is not supported; try Inkscape's <strong>Object to Path</strong> command`);
  }

  if (element.attr('clip-path') != "none")
    throw new Error("clip-path is not supported");

  if (element.attr('mask') != "none")
    throw new Error("mask is not supported");

  const snapTx = element.transform();
  path = Snap.path.map(path, snapTx.globalMatrix);
  path = Snap.parsePathString(path);
  path = linearize(path, curveMinSegs, curveMinSegLen);
  return path;
};

/**
 * Convert a single Snap path to Internal format.
 * May return multiple paths. Only supports linear paths.
 * @param {SnapPath} path the path to convert
 * @throws {Error} if there's a problem.
 */
export function toInternal(path) {
  function pt2ToInternal(x, y) {
    return {
      X: Math.round(x * UnitConverter.from.px.to.internal),
      Y: Math.round(y * UnitConverter.from.px.to.internal)
    };
  };

  if (path.length < 2 || path[0].length != 3 || path[0][0] != 'M')
    throw new Error("Path does not begin with M");

  let currentPath = [ pt2ToInternal(path[0][1], path[0][2]) ];
  const result = [currentPath];
  for (let i = 1; i < path.length; ++i) {
    const subpath = path[i];
    if (subpath[0] === 'M' && subpath.length === 3) {
      currentPath = [ pt2ToInternal(subpath[1], subpath[2]) ];
      result.push(currentPath);
    } else if (subpath[0] == 'L') {
      for (let j = 0; j < (subpath.length - 1) / 2; ++j)
        currentPath.push(pt2ToInternal(subpath[1 + j * 2], subpath[2 + j * 2]));
    } else
      throw new Error("Subpath has a non-linear prefix: " + subpath[0]);
  }
  return result;
};

/**
 * Convert a set of Internal paths to Snap paths.
 * @see {@link http://snapsvg.io/docs/#Paper.path|Snap}
 * @param {InternalPath} paths
 * @return {SnapPath}
 */
export function fromInternal(paths) {
  const result = [];
  for (const path of paths) {
    let first = true;
    const l = [ 'L' ];
    for (const p of path) {
      if (first) {
        result.push([
          'M',
          p.X * UnitConverter.from.internal.to.px,
          p.Y * UnitConverter.from.internal.to.px
        ]);
        first = false;
      } else {
        l.push(p.X * UnitConverter.from.internal.to.px,
               p.Y * UnitConverter.from.internal.to.px);
      }
    }
    if (l.length > 1)
      result.push(l);
  }
  return result;
};

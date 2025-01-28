/*Copyright Crawford Currie 2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */
/* global Snap */
/* global assert */

import { Bezier } from "bezier-js";
import { ellipticalArcToBeziers } from "./EllipticalArc.js";
import { Vector } from "./Vector.js";

/**
 * A single command taken from a 'd' attribute on a \<path\> element.
 * @typedef {Array} svgSegment
 * [0] is always a character. [1...] are numbers.
 */

/**
 * Linearize a bezier to a svgSegment.
 * @param {Bezier} curve the curve being linearised
 * @param {number} minSegs minimum number of segments in the path
 * @param {number} minSegLen minimum length of a segment
 * @return {svgSegment} Doesn't include (p1x, p1y); it's part of
 * the previous segment.
 * @private
 */
function lineariseBezier(curve, minSegs, minSegLen) {
  // SMELL: not a strict interpretation of "minSigLen" ;-)
  const steps = Math.max(minSegs, curve.length() / minSegLen);
  const lut = curve.getLUT(steps);
  const segment = [ "L" ];
  for (let i = 1; i < lut.length; i++)
    segment.push(lut[i].x, lut[i].y);
  return segment;
}

/**
 * Linearize a SVG path. This function is responsible for flattening
 * out path commands (though not all are supported)
 * @param {svgSegment[]} path
 * @param {number} curveMinSegs minimum number of segments in a curve
 * @param {number} curveMinSegLen minimum length of a segment in a curve
 * @return {svgSegment[]}
 * @throws {Error} if there's a problem
 * @private
 */
function linearise(path, curveMinSegs, curveMinSegLen) {
  let last = new Vector(0, 0), lastCP;
  const segments = [];
  for (const segment of path) {
    switch (segment[0]) {

    case 'c':
      for (let i = 1; i < segment.length; i += 2) {
        segment[i] += last.x;
        segment[i + 1] += last.y;
      }
      // fall through
    case 'C':
      for (let i = 1; i < segment.length; i += 6) {
        lastCP = new Vector(segment[i + 2], segment[i + 3]);
        const p2 = new Vector(segment[i + 4], segment[i + 5]);
        const q1 = new Vector(segment[i], segment[i + 1]);
        const curve = new Bezier(last, q1, lastCP, p2);
        segments.push(lineariseBezier(curve, curveMinSegs, curveMinSegLen));
        last = p2;
      }
      break;

    case 's':
      for (let i = 1; i < segment.length; i += 2) {
        segment[i] += last.x;
        segment[i + 1] += last.y;
      }
      // fall through
    case 'S':
      for (let i = 1; i < segment.length; i += 4) {
        const cp = last.plus(last.minus(lastCP).negated());
        lastCP = new Vector(segment[i + 2], segment[i + 3]);
        const p2 = new Vector(segment[i + 2], segment[i + 3]);
        const curve = new Bezier(last, cp, lastCP, p2);
        segments.push(lineariseBezier(curve, curveMinSegs, curveMinSegLen));
        last = p2;
      }
      break;

    case 'm': case 'l':
      for (let i = 1; i < segment.length; i += 2) {
        segment[i] = last.x = last.x + segment[i];
        segment[i + 1] = last.y = last.y + segment[i + 1];
      }
      segment[0] = segment[0].toUpperCase();
      // fall through
    case 'M': case 'L':
      segments.push([ segment[0], segment[1], segment[2] ]);
      for (let i = 3; i < segment.length; i += 2)
        segments.push([ "L", segment[i], segment[i + 1] ]);
      last.x = segment[segment.length - 2];
      last.y = segment[segment.length - 1];
      break;

    case 'v':
      for (let i = 1; i < segment.length; i++)
        segment[i] = last.y = last.y + segment[i];
      // fall through
    case 'V':
      for (let i = 1; i < segment.length; i++)
        segments.push(["L", last.x, segment[i]]);
      last.y = segment[segment.length - 1];
      break;

    case 'h':
      for (let i = 1; i < segment.length; i++)
        segment[i] = last.x = last.x + segment[i];
      // fall through
    case 'H':
      for (let i = 1; i < segment.length; i++)
        segments.push(["L", segment[i], last.y]);
      last.x = segment[segment.length - 1];
      break;

    case 'Z': case 'z': // close path
      segments.push([ "Z" ]);
      break;

    case 'q':
      for (let i = 1; i < segment.length; i += 2) {
        segment[i] += last.x;
        segment[i + 1] += last.y;
      }
      // fall through
    case 'Q':
      for (let i = 1; i < segment.length; i += 6) {
        lastCP = new Vector(segment[i], segment[i + 1]);
        const p2 = new Vector(segment[i + 2], segment[i + 3]);
        const curve = new Bezier(last, lastCP, p2);
        segments.push(lineariseBezier(curve, curveMinSegs, curveMinSegLen));
        last = p2;
      }
      break;

    case 't':
      for (let i = 1; i < segment.length; i += 2) {
        segment[i] += last.x;
        segment[i + 1] += last.y;
      }
      // fall through
    case 'T':
      for (let i = 1; i < segment.length; i += 2) {
        lastCP = last.plus(last.minus(lastCP).negated());
        const p2 = new Vector(segment[i], segment[i + 1]);
        const curve = new Bezier(last, lastCP, p2);
        segments.push(lineariseBezier(curve, curveMinSegs, curveMinSegLen));
        last = p2;
      }
      break;

    case 'a':
      // rx ry xAngle largeArc sweep p2x p2y
      segment[6] += last.x; segment[7] += last.y;
      // fall through
    case 'A':
      {
        const r = new Vector(segment[1], segment[2]);
        const p2 = new Vector(segment[6], segment[7]);
        const xAngle = Math.PI * segment[3] / 180;
        const curves = ellipticalArcToBeziers(
          last, r, xAngle, segment[4] > 0, segment[5] > 0, p2);
        for (const bez of curves) {
          const curve = new Bezier(
            bez[0].x, bez[0].y,
            bez[1].x, bez[1].y,
            bez[2].x, bez[2].y,
            bez[3].x, bez[3].y);
          segments.push(lineariseBezier(curve, curveMinSegs, curveMinSegLen));
        }
        last = p2;
      }
      break;

    default:
      throw new Error(`Segment has an nsupported command: ${segment[0]}`);
    }
  }
  return segments;
}

/**
 * Parse a string from a 'd' attribute on a <path> node
 * @param {string} the command string
 * @return {svgSegment[]} segments
 * @throws {NumberFormatException} if the string is bad
 * @private
 */
function parsePathD(s) {
  const cmds = [];
  const bits = s.replace(/([MLHVCSQTAZ])(\d)/gi, "$1 $2").split(/[\s,]+/);
  let cmd;
  for (const bit of bits) {
    if ("MmLlHhVvCcSsQqTtAaZz".indexOf(bit) >= 0) {
      if (cmd) cmds.push(cmd);
      cmd = [ bit ];
    } else
      // will barf if format is snafu
      cmd.push(parseFloat(bit));
  }
  if (cmd.length > 0) cmds.push(cmd);
  return cmds;
}

/**
 * Get a linear path (sequence of M and L path commands) from an SVG Element.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/SVG}
 * @param {SVGElement} element the element
 * @param {number} curveMinSegs minimum number of segments in a curve
 * @param {number} curveMinSegLen minimum segment length in a curve
 * @return {svgSegment[]}
 * @throws {Error} if there's a problem
 */
export function segmentsFromElement(element, curveMinSegs, curveMinSegLen) {
  let pathString = null;

  // see https://developer.mozilla.org/en-US/docs/Web/SVG

  switch (element.type) {
  case "svg": return null;
  case "path": pathString = element.attr("d"); break;
  case "rect": {
    const x = Number(element.attr("x"));
    const y = Number(element.attr("y"));
    const w = Number(element.attr("width"));
    const h = Number(element.attr("height"));
    pathString = `M ${x},${y} l ${w},0 0,${h} ${-w},0 Z`;
    break;
  }
  case "circle": { // cx cy r, use elliptic arc
    const cx = Number(element.attr("cx"));
    const cy = Number(element.attr("cy"));
    const r = Number(element.attr("r"));
    const p1 = new Vector(cx - r, cy); 
    const p2 = new Vector(cx + r, cy);
    pathString = `M ${cx - r},${cy} ` +
                  `a ${r},${r} 180 0 0 ${2 * r},0 ` +
                  `a ${r},${r} 180 0 0 ${-2 * r},0 Z`;
    break;
  }
  case "ellipse": { // cx cy rx ry, use elliptic arc
    const cx = Number(element.attr("cx"));
    const cy = Number(element.attr("cy"));
    const rx = Number(element.attr("rx"));
    const ry = Number(element.attr("ry"));
    const p1 = new Vector(cx - rx, cy); 
    const p2 = new Vector(cx + rx, cy);
    pathString = `M ${cx - rx},${cy} ` +
                 `a ${rx},${ry} 180 0 0 ${2 * rx},0 ` +
                 `a ${rx},${ry} 180 0 0 ${-2 * rx},0`;
    console.log(pathString);
    break;
  }
  case "line": { // x1 y1 x2 y2
    const x1 = Number(element.attr("x1"));
    const y1 = Number(element.attr("y1"));
    const x2 = Number(element.attr("x2"));
    const y2 = Number(element.attr("y2"));
    pathString = `M ${x1},${y1} L ${x2},${y2}`; break;
  }
  case "polyline": // points
  case "polygon": {
    // points
    const pts = element.attr("points").map(s => Number(s));
    const p0x  = pts.shift();
    const p0y  = pts.shift();
    pathString = `M ${p0x},${p0y} L ${pts.join(" ")}`;
    if (element.type === "polygon")
      pathString += " Z";
    break;
  }
  default:
    throw new Error(`<b>${element.type}</b> is not supported; try Inkscape's <strong>Object to Path</strong> command`);
  }

  const cp = element.attr('clip-path');
  if (cp && cp !== "none")
    throw new Error("clip-path ${cp} is not supported");

  const mask = element.attr('mask');
  if (mask && mask !== "none")
    throw new Error(`mask ${mask} is not supported`);

  let tx;
  try {
    tx = element.node.getCTM();
    // // Contrary to the documentation, Snap.path.map returns an array
    // // of segments
    // tx = element.transform();
    // pathString = Snap.path.map(pathString, tx.globalMatrix);
    // // Snap.path.map converts all straight line segments to bezier
    // // curves. We really don't want that!
  } catch (e) {
    // SVGElement doesn't have getCTM in node.js, works in browser OK.
  }
  // Convert path to M, L and Z
  const path = linearise(parsePathD(pathString), curveMinSegs, curveMinSegLen);
  if (tx) {
    for (const command of path) {
      // All command parameters are absolute coordinates since linearisation
      for (let i = 1; i < command.length; i += 2) {
        const x = command[i], y = command[i + 1];
        // apply matrix transform
        command[i]     = x * tx.a + y * tx.c + tx.e;
        command[i + 1] = x * tx.b + y * tx.d + tx.f;
      }
    }
  }
    
  return path;
}

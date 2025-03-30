/*Copyright Crawford Currie 2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */
/* global assert */
/* global structuredClone */
/* global CustomEvent */

import { Bezier } from "bezier-js";
import { Vector } from "flatten-js";
import { Rect } from "./Rect.js";
import * as EllipticalArc from "./EllipticalArc.js";

/**
 * Parsing and interpretation of SVG.
 * @namespace SVG
 */

/**
 * A single command taken from a 'd' attribute on a <path> element.
 * [0] is always a character. [1...] are numbers.
 * @typedef {Array} svgSegment
 * @memberof SVG
 */

/**
 * Linearize a bezier to a svgSegment.
 * @param {Bezier} curve the curve being linearised
 * @param {object?} params see segmentsFromElement
 * @param {number} params.curveMinSegs minimum number of segments
 * @param {number} params.curveMinSegLen minimum length of a segment
 * @return {svgSegment} Doesn't include (p1x, p1y); it's part of
 * the previous segment.
 * @memberof SVG
 */
export function lineariseBezier(curve, params) {
  // SMELL: not a strict interpretation of "minSigLen" ;-)
  let steps = Math.max(
    params.curveMinSegs, Math.round(curve.length() / params.curveMinSegLen));
  const lut = curve.getLUT(steps);
  const segment = [];
  for (const pt of lut)
    segment.push(pt.x, pt.y);
  segment.unshift('L');
  return segment;
}

/**
 * Linearize a SVG path. This function is responsible for flattening
 * out path commands (though not all are supported)
 * @param {svgSegment[]} path
 * @param {object?} params see segmentsFromElement
 * @return {svgSegment[]}
 * @throws {Error} if there's a problem
 * @memberof SVG
 */
export function linearise(path, params) {
  let last = new Vector(0, 0), lastCP, xp, yp, i, j;
  let initialPoint = new Vector(0, 0); // coords of the last M or m
  const segments = [];

  for (const segment of path) {
    switch (segment[0]) {

    case 'c':
      // Transform to absolute coordinates
      xp = last.x, yp = last.y;
      for (i = 1; i < segment.length; i += 6) {
        for (j = 0; j < 6; j += 2)
          segment[i + j] += xp, segment[i + j + 1] += yp;
        xp = segment[i + 4], yp = segment[i + 5];
      }
      // fall through
    case 'C':
      for (i = 1; i < segment.length; i += 6) {
        const q1 = new Vector(segment[i], segment[i + 1]);
        const q2 = new Vector(segment[i + 2], segment[i + 3]);
        const p2 = new Vector(segment[i + 4], segment[i + 5]);
        const curve = new Bezier(last, q1, q2, p2);
        const seg = lineariseBezier(curve, params);
        //seg.push(p2.x, p2.y);
        segments.push(seg);
        lastCP = q2;
        last = p2;
      }
      break;

    case 's':
      xp = last.x, yp = last.y;
      for (i = 1; i < segment.length; i += 4) {
        for (j = 0; j < 4; j += 2)
          segment[i + j] += xp, segment[i + j + 1] += yp;
        xp = segment[i + 2], yp = segment[i + 3];
      }
      // fall through
    case 'S':
      for (i = 1; i < segment.length; i += 4) {
        const cp = last.add(last.subtract(lastCP).invert());
        lastCP = new Vector(segment[i + 2], segment[i + 3]);
        const p2 = new Vector(segment[i + 2], segment[i + 3]);
        const curve = new Bezier(last, cp, lastCP, p2);
        segments.push(lineariseBezier(curve, params));
        last = p2;
      }
      break;

    case 'm': case 'l':
      for (i = 1; i < segment.length; i += 2) {
        segment[i] = last.x = last.x + segment[i];
        segment[i + 1] = last.y = last.y + segment[i + 1];
      }
      segment[0] = segment[0].toUpperCase();
      // fall through
    case 'M': case 'L':
      segments.push([ segment[0], segment[1], segment[2] ]);
      if (segment[0] === 'M')
        initialPoint.x = segment[1], initialPoint.y = segment[2];
      for (i = 3; i < segment.length; i += 2)
        segments.push([ "L", segment[i], segment[i + 1] ]);
      last.x = segment[segment.length - 2];
      last.y = segment[segment.length - 1];
      break;

    case 'v':
      yp = last.y;
      for (i = 1; i < segment.length; i++) {
        segment[i] += yp;
        yp = segment[i];
      }
      // fall through
    case 'V':
      for (let i = 1; i < segment.length; i++)
        segments.push(["L", last.x, segment[i]]);
      last.y = segment[segment.length - 1];
      break;

    case 'h':
      xp = last.x;
      for (i = 1; i < segment.length; i++) {
        segment[i] += xp;
        xp = segment[i];
      }
      // fall through
    case 'H':
      for (i = 1; i < segment.length; i++)
        segments.push(["L", segment[i], last.y]);
      last.x = segment[segment.length - 1];
      break;

    case 'Z': case 'z': // close path
      last.x = initialPoint.x, last.y = initialPoint.y;
      segments.push([ "Z" ]);
      break;

    case 'q':
      xp = last.x, yp = last.y;
      for (i = 1; i < segment.length; i += 4) {
        for (j = 0; j < 4; j += 2)
          segment[i + j] += xp, segment[i + j + 1] += yp;
        xp = segment[i + 2];
        yp = segment[i + 3];
      }
      // fall through
    case 'Q':
      for (i = 1; i < segment.length; i += 4) {
        lastCP = new Vector(segment[i], segment[i + 1]);
        const p2 = new Vector(segment[i + 2], segment[i + 3]);
        const curve = new Bezier(last, lastCP, p2);
        segments.push(lineariseBezier(curve, params));
        last = p2;
      }
      break;

    case 't':
      xp = last.x, yp = last.y;
      for (i = 1; i < segment.length; i += 2) {
        segment[i] += xp, segment[i + 1] += yp;
        xp = segment[i], yp = segment[i + 1];
      }
      // fall through
    case 'T':
      for (i = 1; i < segment.length; i += 2) {
        lastCP = last.add(last.subtract(lastCP).invert());
        const p2 = new Vector(segment[i], segment[i + 1]);
        const curve = new Bezier(last, lastCP, p2);
        segments.push(lineariseBezier(curve, params));
        last = p2;
      }
      break;

    case 'a':
      // rx ry xAngle largeArc sweep p2x p2y
      xp = last.x, yp = last.y;
      for (i = 1; i < segment.length; i += 7) {
        segment[i + 5] += xp; segment[i + 6] += yp;
        xp = segment[i + 5], yp = segment[i + 6];
      }
      // fall through
    case 'A':
      for (i = 1; i < segment.length; i += 7) {
        const r = new Vector(segment[i], segment[i + 1]);
        const p2 = new Vector(segment[i + 5], segment[i + 6]);
        const xAngle = Math.PI * segment[i + 2] / 180;
        if (r.x === 0 || r.y === 0) {
          // https://www.w3.org/TR/SVG/paths.html#ArcOutOfRangeParameters
          // 9.5.1 If either rx or ry is 0, then this arc is treated
          // as a straight line segment (a "lineto") joining the
          // endpoints.
          segments.push([ "L", p2.x, p2.y ]);
        } else {
          const curves = EllipticalArc.toBeziers(
            last, r, xAngle, segment[i + 3] > 0, segment[i + 4] > 0, p2);
          for (const bez of curves) {
            const curve = new Bezier(
              bez[0].x, bez[0].y,
              bez[1].x, bez[1].y,
              bez[2].x, bez[2].y,
              bez[3].x, bez[3].y);
            const seg = lineariseBezier(curve, params);
            segments.push(seg);
          }
        }
        last = p2;
      }
      break;

    default:
      console.error(segment);
      throw new Error(`Segment has an unsupported command: '${segment[0]}'`);
    }
  }
  return segments;
}

/**
 * Parse a string from a 'd' attribute on a <path> node.
 * @param {string} the command string
 * @return {svgSegment[]} segments
 * @throws {NumberFormatException} if the string is bad
 * @memberof SVG
 */
export function parsePathD(s) {
  const cmds = [];
  const bits = s.replace(/([MLHVCSQTAZ])(\d)/gi, "$1 $2").split(/[\s,]+/);
  let cmd;
  for (const bit of bits) {
    if (bit === "") continue;
    if ("MmLlHhVvCcSsQqTtAaZz".indexOf(bit) >= 0) {
      if (cmd) cmds.push(cmd);
      cmd = [ bit ];
    } else {
      // will barf if format is snafu
      cmd.push(parseFloat(bit));
    }
  }
  if (cmd.length > 0) cmds.push(cmd);
  return cmds;
}

/**
 * Get a linear path (sequence of M and L path commands) from an SVG Element.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/SVG}
 * @param {SVGElement} element the element
 * @param {object?} params info needed for resolving some SVG
 * syntax. Only needed if there are curves in the SVG, or % is used in
 * measures.
 * @param {number} params.curveMinSegs minimum number of segments in a curve
 * @param {number} params.curveMinSegLen minimum segment length in a curve
 * @param {number} params.vbx viewbox dimension, for %
 * @param {number} params.vby viewbox dimension, for %
 * @return {svgSegment[]}
 * @throws {Error} if there's a problem
 * @memberof SVG
 */
export function segmentsFromElement(element, params) {

  let pathString;

  /**
   * If the attribute is defined, throw, cos we don't support it
   * @param {string} attr the attribute name
   */
  function unsupported(attr) {
    const v = element.getAttribute(attr);
    if (v && v !== "none" && v !== "")
      document.Event(new CustomEvent("UNSUPPORTED_SVG", {
        detail: { tag: element.tagName, attr: attr, value: v }
      }));
  }

  /*
   * @param {string} attr the attribute name
   * @param {string|number} defawlt the default
   * @param {number} vb the dimension for %
   */
  function number(attr, defawlt, vb) {
    const v = element.getAttribute(attr);
    if (typeof v === "undefined") return defawlt;
    if (v === "auto") return v;
    let n;
    try {
      n = parseFloat(v);
    } catch (e) {
      console.error(e);
      throw new Error(`${element.tagName}.${attr} ${v} number format error`);
    }
    if (v.indexOf("%") === v.length - 1)
      n = n * vb / 100;

    return n;
  }

  // Paths are made absolute by linearisation, but are still in the
  // coordinate space of the original element. Transform the paths back
  // into the (pixel) coordinate space of the outermost enclosing SVG element.
  function unTransform(path, element) {
    try {
      // SVG 2 spec: "CTM is a matrix that transforms the coordinate
      // space of the current element (including its transform
      // property) to the coordinate space of its closest ancestor
      // *viewport-establishing( element (also including its transform
      // property)."
      // Note: it's not clear what constitutes a viewport-establishing element.
      // element.viewportElement returns the closest enclosing SVG, but that's
      // not the transform that getCTM returns. The result from getCTM()
      // changes when when the element isn't visible on the screen.
      const tx = element.getCTM();
      for (const command of path) {
        for (let i = 1; i < command.length; i += 2) {
          const x = command[i], y = command[i + 1];
          // [x, y, 1] * [a b
          //              c d
          //              e f]
          command[i]     = x * tx.a + y * tx.c + tx.e;
          command[i + 1] = x * tx.b + y * tx.d + tx.f;
        }
      }
    } catch (e) {
      console.error("No getCTM support?");
    }
  }

  // see https://developer.mozilla.org/en-US/docs/Web/SVG
  unsupported('clip-path');
  unsupported('mask');

  const tag = element.tagName.toLowerCase();
  switch (tag) {

  case "path":
    pathString = element.getAttribute("d");
    break;

  case "rect": {
    const x = number("x", 0, params.vbx);
    const y = number("y", 0, params.vby);
    let w = number("width", "auto", params.vbx);
    let h = number("height", "auto", params.vby);
    unsupported("rx"); unsupported("ry");
    if (w === "auto") {
      if (h === "auto")
        w = h = 0;
      else
        h = w;
    } else if (h === "auto")
      h = w;
    // pathLength ignored
    if (w > 0 && h > 0)
      pathString = `M ${x},${y} l ${w},0 0,${h} ${-w},0 Z`;
    break;
  }

  case "circle": { // cx cy r, use elliptic arc
    const cx = number("cx", 0, params.vbx);
    const cy = number("cy", 0, params.vby);
    const r = number("r", 0,
      Math.sqrt(params.vbx * params.vbx + params.vby * params.vby));
    // pathLength ignored
    if (r > 0)
      pathString = `M ${cx - r},${cy} ` +
                   `a ${r},${r} 180 0 0 ${2 * r},0 ` +
                   `a ${r},${r} 180 0 0 ${-2 * r},0 Z`;
    break;
  }

  case "ellipse": { // cx cy rx ry, use elliptic arc
    const cx = number("cx", 0, params.vbx);
    const cy = number("cy", 0, params.vby);
    let rx = number("rx", "auto", params.vbx);
    let ry = number("ry", "auto", params.vby);
    if (ry === "auto") {
      if (rx === "auto")
        rx = ry = 0;
      else
        ry = rx;
    } else if (rx === "auto")
      rx = ry;
    if (rx > 0 && ry > 0) {
      // pathLength ignored
      pathString = `M ${cx - rx},${cy} ` +
      `a ${rx},${ry} 180 0 0 ${2 * rx},0 ` +
      `a ${rx},${ry} 180 0 0 ${-2 * rx},0 Z`;
    }
    break;
  }

  case "line": { // x1 y1 x2 y2
    const x1 = number("x1", 0, params.vbx);
    const y1 = number("y1", 0, params.vby);
    const x2 = number("x2", 0, params.vbx);
    const y2 = number("y2", 0, params.vby);
    if (!(x1 === x2 && y1 === y2))
      pathString = `M ${x1},${y1} L ${x2},${y2}`;
    break;
  }

  case "polyline": // points
  case "polygon": {
    const points = element.getAttribute("points"); // gets parsed by attr
    if (typeof points === "undefined")
      break;
    const pts = points.split(/[\s,]+/).map(s => parseFloat(s));
    // pathLength ignored
    const p0x = pts.shift();
    const p0y = pts.shift();
    pathString = `M ${p0x},${p0y} L ${pts.join(" ")}`;
    if (tag === "polygon")
      pathString += " Z";
    break;
  }

    /* c8 ignore start */
  case "a": case "clippath": case "cursor": case "defs": case "desc":
  case "feblend": case "fecolormatrix": case "fecomponenttransfer":
  case "fecomposite": case "feconvolvematrix": case "fediffuselighting":
  case "fedisplacementmap": case "fedistantlight": case "fedropshadow":
  case "feflood": case "fefunca": case "fefuncb": case "fefuncg":
  case "fefuncr": case "fegaussianblur": case "feimage": case "femerge":
  case "femergenode": case "femorphology": case "feoffset":
  case "fepointlight": case "fespecularlighting": case "fespotlight":
  case "fetile": case "feturbulence": case "filter":
  case "font-face-format": case "font-face-name": case "font-face-src":
  case "font-face-uri": case "font-face": case "font":
  case "foreignobject": case "glyph": case "glyphref": case "hkern":
  case "image": case "lineargradient": case "marker": case "mask":
  case "metadata": case "missing-glyph": case "mpath": case "pattern":
  case "radialgradient": case "script": case "set": case "stop":
  case "style": case "switch": case "symbol": case "title": case "tref":
  case "tspan": case "view": case "vkern":
  default: // e.g. sodipodi:namedview
    // Ignore
    //console.debug(`SVGElement "${element.tagName}" ignored`);
    break;
    /* c8 ignore stop */

  case "svg": case "g": {
    // Recurse
    let r = structuredClone(params);
    if (element.viewBox) {
      // A viewBox changes the interpretation of %
      r.vbx = element.viewBox.baseVal.width;
      r.vby = element.viewBox.baseVal.height;
    }
    let segs = [];
    for (const child of element.children) {
      const subsegs = segmentsFromElement(child, r);
      if (subsegs.length > 0)
        segs = segs.concat(subsegs);
    }
    // Don't need to unTransform because for a `g`, the CTM of the leaf elements
    // should have already done that to the closest enclosing
    // viewbox i.e. the containing <svg> element. Not sure about an svg
    // within an svg, but going to quietly ignore that.
    return segs;
  }

  case "animateMotion": case "animateTransform": case "textPath": case "text":
    // Unsupported
    console.warn(`Unsupported element: ${element.tagName}`);
  }

  if (pathString) {
    // Convert path to M, L and Z
    const d = parsePathD(pathString);
    const path = linearise(d, params);
    // and map to outermost SVG coordinate space
    try {
      unTransform(path, element);
    } catch (e) {
      // SVGElement doesn't have getCTM in node.js, works fine in browser.
    }
    return path;
  }
  return [];
}

/**
 * Read SVG from plain text of an SVG element. The SVG must be
 * well formed.
 * @param {Buffer|string} content the svg plain text
 * @return {SVGElement} the <svg> element
 * @memberof SVG
 */
export function importFromText(content) {
  const container = document.createElement("div");
  container.innerHTML = String(content);
  const svgs = container.getElementsByTagName("svg");
  return svgs[0];
}

/**
 * Construct a "d" attribute value from a list of segments.
 * @param {svgSegment[]} segs
 * @return {string}
 * @memberof SVG
 */
export function segments2d(segs) {
  const d = segs.map(s => s.join(" ")).join(" ");
  return d;
}

/**
 * Get the view box of the SVG which this element is in.
 * @param {SVGElement} elem the element
 * @throws {Error} if the element is not in an SVG with a viewBox
 * @memberof SVG
 */
export function getViewBox(elem) {
  let above = elem;
  while (above && above.tagName.toLowerCase() !== "svg")
    above = above.parentElement;
  const vb = above.getAttribute("viewBox");
  if (vb)
    return new Rect(vb);
  throw new Error("No viewBox on SVG");
}

/**
 * Get the pixel dimensions of the SVG which this element is in.
 * @param {SVGElement} elem the element
 * @return {Rect} only width and height, x and y will always be 0.
 * @throws {Error} if the element is not in an SVG with a viewBox
 * @memberof SVG
 */
export function getDimensions(elem) {
  let above = elem;
  while (above && above.tagName.toLowerCase() !== "svg")
    above = above.parentElement;
  let w = above.width.baseVal.value;
  let h = above.height.baseVal.value;
  if (typeof w !== "undefined" && typeof h !== "undefined")
    return new Rect(0, 0, w, h);

  // If there is a viewbox but only one of w or h isn't defined,
  // use the viewBox to apply the aspect ratio.
  const vb = above.getAttribute("viewBox");
  if (!vb)
    throw new Error("None of width, height, viewBox defined");

  if (typeof w === "undefined") {
    if (typeof h !== "undefined")
      return new Rect(0, 0, h * vb.width / vb.height, h);
  } else if (typeof h === "undefined")
    return new Rect(0, 0, w, w * vb.height / vb.width);

  return vb;
}

/**
 * Get the bounding box for the geometry in the element, in pixels,
 * ignoring the `viewBox`. The standard `SVGElement.getBBox` only
 * works when the SVG has already been rendered, but works for all SVG
 * elements. This function works even when the SVG hasn't been
 * rendered yet, but only works for the subset of SVG supported by
 * SVGcut.
 * @param {SVGElement} el the element to measure
 * @return {Rect} the bounds
 * @memberof SVG
 */
export function getBounds(el) {
  // Try getBBox first
  /* c8 ignore start */
  if (typeof el.getBBox === "function") {
    const system = el.getBBox();
    if (system) {
      if (system.baseVal &&
          system.baseVal.width > 0 && system.baseVal.height > 0)
        return new Rect(system.baseVal);
      else if (typeof system.width !== "undefined"
               && typeof system.height !== "undefined") {
        if (system.width > 0 && system.height > 0) {
          const systemBB = new Rect(system);
          //console.debug("System BB", systemBB);
          return systemBB;
        }
      } else
        throw new Error(`Wierd type from getBBox: ${system}`);
    }
  }
  /* c8 ignore stop */

  // Otherwise analyse the element
  // Get the closest enclosing <svg> for computing %ages
  let above = el;
  while (above && above.tagName.toLowerCase() !== "svg")
    above = above.parentElement;

  // Get width and height of the <svg>
  const w = Number(above.getAttribute("width"));
  const h = Number(above.getAttribute("height"));

  // If there's a viewBox use it to compute %, otherwise all
  // values are pixels and % relate to the container width/height
  const r = {
    curveMinSegs: 10,
    curveMinSegLen: 1,
    vbx: w,
    vby: h
  };

  // If the <svg> has a viewbox, it redefines the mapping from user units
  // to pixels for the contained elements.
  if (above.viewBox)
    r.vbx = above.viewBox.baseVal.width,
    r.vby = above.viewBox.baseVal.height;

  // Linearise all the elements and then measure.
  const segs = segmentsFromElement(el, r);
  if (!segs || segs.length === 0) {
    const emptyBB = el.viewBox ? new Rect(el.viewBox.baseVal) :
    Rect(0, 0, 10, 10);
    //console.debug("Empty BB", emptyBB);
    return emptyBB;

  }
  let minx = Number.MAX_VALUE, maxx = 0;
  let miny = minx, maxy = maxx;
  for (const s of segs) {
    // M, L and Z only, all coords flattened
    for (let i = 1; i < s.length; i += 2) {
      minx = Math.min(minx, s[i]);
      maxx = Math.max(maxx, s[i]);
      miny = Math.min(miny, s[i + 1]);
      maxy = Math.max(maxy, s[i + 1]);
    }
  }
  // Dimensions in pixels already
  const computedBB = new Rect(minx, miny, maxx - minx, maxy - miny);
  //console.debug("Computed BB", computedBB);
  return computedBB;
}

/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

// import "knockout";
/* global ko */

//import "clipper-lib";
/* global ClipperLib */
import * as Clipper from "./Clipper.js";

//import "snapsvg";
/* global Snap */

/* global App */

import { ViewModel } from "./ViewModel.js";
import { UnitConverter } from "./UnitConverter.js";

/**
 * Convert a list of segments to a set of integer (ClipperLib.Paths).
 * May return multiple paths. This is NOT a generic SVG `path` to Clipper,
 * as it only supports `M` and `L` path commands.
 * @param {svgSegment[]} segments the segments to convert. The first
 * segment must be an `M`.
 * @return {ClipperLib.Paths}
 * @throws {Error} if there's a problem.
 * @private
 */
function segments2Clipper(segments) {
  function px2Integer(x, y) {
    return new ClipperLib.IntPoint(
      x * UnitConverter.from.px.to.integer,
      y * UnitConverter.from.px.to.integer);
  };

  let currentPath;
  const integerPaths = [];
  for (const segment of segments) {
    if (segment[0] === 'M') {
      if (currentPath)
        integerPaths.push(currentPath);
      currentPath = [ px2Integer(segment[1], segment[2]) ];
    } else if (segment[0] === 'L') {
      if (!currentPath)
        throw new Error("Internal Error: Segments do not begin with M");
      for (let j = 1; j < segment.length; j += 2)
        currentPath.push(px2Integer(segment[j], segment[j + 1]));
    } else
      // Should never happen, because paths are linearised when selected
      throw new Error("Subpath has an unsupported path command: " + segment[0]);
  }
  if (currentPath)
    integerPaths.push(currentPath);
  return integerPaths;
}

/**
 * Extract paths from an SVG element and return them as integer paths. The
 * element must already have been linearised; only `M` and `L` path commands
 * are supported.
 * @param {SVGElement} svgElement
 * @param {number} scale scale factor to convert from SVG coordinates to
 * integer coordinates.
 * @return {ClipperLib.Paths}
 * @private
 */
function integerPathsFromLinearElement(svgElement, scale) {
  const integerPaths = new ClipperLib.Paths();
  // see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/d
  const ps = svgElement.attr('d'); 
  const segments = Snap.parsePathString(ps);
  if (segments) {
    const fillRule = svgElement.attr("fill-rule") === "evenodd"
          ? ClipperLib.PolyFillType.pftEvenOdd
          : ClipperLib.PolyFillType.pftNonZero;
    const paths = Clipper.simplifyAndClean(
      segments2Clipper(segments), fillRule);
    integerPaths.push(...paths);
  } else
    throw new Error(`${ps} didn't yield a path`);
  return integerPaths;
}

/**
 * Linearize a cubic bezier to a svgSegment.
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
 * @return {svgSegment} Doesn't include (p1x, p1y); it's part of
 * the previous segment.
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
  let svgSegment = null;
  while (svgSegment == null) {
    let x = p1x;
    let y = p1y;
    svgSegment = [ 'L' ];
    for (let i = 1; i <= numSegments; ++i) {
      const t = 1.0 * i / numSegments;
      const nextX = bez(p1x, c1x, c2x, p2x, t);
      const nextY = bez(p1y, c1y, c2y, p2y, t);
      if ((nextX - x) * (nextX - x) + (nextY - y) * (nextY - y)
          > minSegLen * minSegLen) {
        numSegments *= 2;
        svgSegment = null;
        break;
      }
      svgSegment.push(nextX, nextY);
      x = nextX;
      y = nextY;
    }
  }
  return svgSegment;
}

/**
 * Linearize a SVG path. This function is responsible for flattening
 * out path commands 'C', 'A', 'S', 'Q', 'T' and 'Z' (though not all
 * are supported)
 * @param {svgSegment[]} path
 * @param {number} curveMinSegs minimum number of segments in a curve
 * @param {number} curveMinSegLen minimum length of a segment in a curve
 * @return {svgSegment[]}
 * @throws {Error} if there's a problem
 * @private
 */
function linearize(path, curveMinSegs, curveMinSegLen) {
  if (path.length < 2 || path[0].length !== 3 || path[0][0] !== 'M')
    throw new Error("Path does not begin with M");
  let x = path[0][1];
  let y = path[0][2];
  const segments = [ path[0] ];
  for (let i = 1; i < path.length; ++i) {
    const subpath = path[i];
    if (subpath[0] === 'C' && subpath.length === 7) {
      segments.push(linearizeCubicBezier(
        x, y, subpath[1], subpath[2], subpath[3],
        subpath[4], subpath[5], subpath[6], curveMinSegs, curveMinSegLen));
      x = subpath[5];
      y = subpath[6];
    } else if (subpath[0] === 'M' && subpath.length == 3) {
      segments.push(subpath);
      x = subpath[1];
      y = subpath[2];
    } else
      throw new Error(`Subpath has an unknown prefix: ${subpath[0]}`);
  }
  return segments;
}

/**
 * Get a linear path (sequence of M and L path commands) from an SVG Element.
 * @see {@link http://snapsvg.io/docs/#Paper.path|Snap}
 * @param {SVGElement} element the element (only path or rect currently
 * supported)
 * @param {number} curveMinSegs minimum number of segments in a curve
 * @param {number} curveMinSegLen minimum segment length in a curve
 * @return {svgSegment[]}
 * @throws {Error} if there's a problem
 * @private
 */
function segmentsFromElement(element, curveMinSegs, curveMinSegLen) {
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
}

/**
 * Support for selection in SVG views.
 */
class SelectionViewModel extends ViewModel {

  /**
   * Note that this model doesn't require a unit converter, as it has
   * no UI components that require conversion.
   */
  constructor() {
    super();

    /**
     * Number of elements selected (==App.svgGroups.selection size)
     * @member {observable.<number>}
     */
    this.numSelected = ko.observable(0);
  }

  /**
   * Handler for a click event on the SVG window.
   * @param {Element} elem SVG element that was hit by the click
   * @return {boolean} true if the event has been handled
   */
  clickOnSvg(elem) {
    const clas = elem.attr("class");

    // Filter out App-generated classes
    if (clas === "combinedGeometry"
        || clas === "toolPath"
        || clas === "tabsGeometry")
      return false;

    // Deselect previously selected path
    if (clas === "selectedPath") {
      elem.remove();
      this.numSelected(this.numSelected() - 1);
      return true;
    }

    // When something is selected in the SVG it is automatically linearised
    // before being added to the selection SVG. That way when an operation is
    // created, the paths can simply be converted to Clipper coordinates
    // without worrying about linearisation.
    try {
      const path = segmentsFromElement(
        elem,
        App.models.CurveConversion.minSegs(),
        App.models.CurveConversion.minSegLen.toUnits("px"));
      const newPath = App.svgGroups.selection.path(path);
      newPath.attr("class", "selectedPath");
      if (elem.attr("fill-rule") === "evenodd")
        newPath.attr("fill-rule", "evenodd");
      this.numSelected(this.numSelected() + 1);
      return true;
    } catch (e) {
      console.error(e);
    }

    return false;
  }

  /**
   * @return {boolean} True if at least one path is selected
   */
  isSomethingSelected() {
    return this.numSelected() > 0;
  }

  /**
   * Get the list of SVG elements that are currently selected.
   * @return {SVGElement[]} list of SVG elements
   */
  getSelection() {
    return App.svgGroups.selection.selectAll("path");
  }

  /**
   * Consume the current selection and return it as a set of
   * ClipperLib paths. Clears the selection.
   * @return {ClipperLib.Paths}
   */
  getSelectedPaths() {
    const cps = new ClipperLib.Paths();
    this.getSelection().forEach(element => {
      // Elements in the selectionSVG have already been linearised, when
      // the selection was made (in clickOnSVG)
      const elPath = integerPathsFromLinearElement(element);
      cps.push(elPath);
    });
    this.clearSelection();
    return cps;
  }

  /**
   * Deselect all SVG elements
   */
  clearSelection() {
    App.svgGroups.selection.selectAll("path").remove();
    this.numSelected(0);
  }

  /**
   * @override
   */
  jsonFieldName() { return "selection"; }
}

export { SelectionViewModel }

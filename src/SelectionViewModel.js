/*Copyright Todd Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */
/* global assert */

// import "knockout";
/* global ko */

/* global App */

import { CutPaths } from "./CutPaths.js";
import { ViewModel } from "./ViewModel.js";
import { UnitConverter } from "./UnitConverter.js";
import * as SVG from "./SVG.js";

/**
 * Support for selection in SVG views.
 * @extends ViewModel
 */
export class SelectionViewModel extends ViewModel {

  /**
   * Note that this model doesn't require a unit converter, as it has
   * no UI components that require conversion.
   */
  constructor() {
    super();

    /**
     * Number of open paths currently selected
     * @member {observable.<number>}
     */
    this.openSelected = ko.observable(0);

    /**
     * Number of closed paths currently selected
     * @member {observable.<number>}
     */
    this.closedSelected = ko.observable(0);

    /**
     * The SVG group that is used to display all selected elements
     */
    this.svgGroup = document.getElementById("SelectionSVGGroup");
  }

  selectAll() {
    // Select everything

    if (this.isSomethingSelected())
      // Deselect current selection
      this.clearSelection();

    const selectedEls = App.contentSVGGroup.querySelectorAll(
      'path,rect,circle,ellipse,line,polyline,polygon');
    if (selectedEls.length > 0) {
      selectedEls.forEach(element => this.clickOnSVG(element, true));
    }
  }

  /**
   * Handler for a click event on the SVG window.
   * + Click elem (!extend) - clear current selection, select elem
   * + Click elem (extend) - add elem to selection
   * + Click space (!extend) - clear current selection
   * + Click space (extend) - no-op
   * @param {SVGElement?} elem the element hit
   * @param {boolean} extend true to extend the selection
   * @return {boolean} true if the event has been handled
   */
  clickOnSVG(elem, extend) {

    if (!extend)
      this.clearSelection();

    if (elem) {
      const clas = elem.getAttribute("class");
      if (clas && clas.indexOf("selected-path") >= 0)
        return this.removeFromSelection(elem);
      else if (elem.tagName.toLowerCase() !== "svg")
        return this.addToSelection(elem);
    }

    return true;
  }

  /**
   * Add the element to the current selection.
   * When something is selected in the content SVG it is linearised
   * here before being added to the selection SVG. That way when an
   * operation is created, the paths can be converted to integer
   * coordinates trivially. It also means the selection display shows
   * the linearised paths, and not the original selected figure.
   * @param {SVGElement} elem the element hit (an element in the content
   * SVG)
   * @return {boolean} true if the element was selected, false otherwise
   * @private
   */
  addToSelection(elem) {
    // Get the viewbox for the SVG the elem is in, for calculating %ages
    const vb = SVG.getViewBox(elem);

    // Linearise, and add each generated path to the selection SVG
    // with appropriate styling.
    try {
      const segs = SVG.segmentsFromElement(
        elem,
        {
          curveMinSegs: App.models.Approximation.minSegs(),
          curveMinSegLen: App.models.Approximation.minSegLen.toUnits("px"),
          vbx: vb.width,
          vby: vb.height
        });
      if (segs && segs.length > 0) {
        const newPath = document.createElementNS(
          'http://www.w3.org/2000/svg', "path");
        newPath.setAttribute("d", SVG.segments2d(segs));
        newPath.classList.add("selected-path");
        // .path loses 'Z', so we save it using a class (which also
        // provides a rendering cue)
        if (segs[segs.length - 1][0] === 'Z') {
          if (elem.getAttribute("fill-rule") === "evenodd")
            newPath.setAttribute("fill-rule", "evenodd");
          newPath.classList.add("closed-path");
          this.closedSelected(this.closedSelected() + 1);
        } else {
          newPath.classList.add("open-path");
          this.openSelected(this.openSelected() + 1);
        }
        this.svgGroup.appendChild(newPath);
        return true;
      }
    } catch (e) {
      console.warn(e);
    }

    return false;
  }

  /**
   * Deselect previously selected path
   * @param {SVGElement} elem the element hit
   * @return {boolean} true if the element was removed
   * @private
   */
  removeFromSelection(elem) {
    const clas = elem.getAttribute("class");
    if (clas && clas.indexOf("selected-path") >= 0) {
      elem.remove();
      if (clas.indexOf("open-path") >= 0) {
        // Math.max because clearSelection() may have zeroed this already
        this.openSelected(Math.max(this.openSelected() - 1, 0));
      } else {
        this.closedSelected(Math.max(this.closedSelected() - 1, 0));
      }
      return true;
    }
    return false;
  }

  /**
   * @return {boolean} True if at least one path is selected
   */
  isSomethingSelected() {
    return (this.openSelected() + this.closedSelected()) > 0;
  }

  /**
   * Consume the current selection and return it as a CutPaths. Note
   * polygons - objects with inner contours will be included as peers to
   * completely disjoint polgons/paths.
   * @return {CutPaths}
   */
  getSelectedPaths() {
    const cps = new CutPaths();
    this.svgGroup.querySelectorAll("path")
    .forEach(element => {
      // Elements in the selectionSVG have already been linearised and
      // transformed, when the selection was made (in clickOnSVG)
      const segments = SVG.parsePathD(element.getAttribute("d"));
      let sps = CutPaths.fromSegments(segments);
      const clazz = element.getAttribute("class") ?? "";
      const isClosed = (clazz.indexOf("closed-path") >= 0);
      for (const p of sps)
        p.isClosed = isClosed;
      sps = sps.simplifyAndClean(element.getAttribute("fill-rule"));
      assert(sps instanceof CutPaths);
      cps.push(...sps);
    });
    this.clearSelection();
    return cps;
  }

  /**
   * Deselect everything
   * @return {boolean} true
   */
  clearSelection() {
    // replaceChildren with no parameters clears the node
    this.svgGroup.replaceChildren();
    this.openSelected(0);
    this.closedSelected(0);
    return true;
  }

  /**
   * @override
   */
  jsonFieldName() { return "selection"; }
}


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
 */
class SelectionViewModel extends ViewModel {

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
   * Add the element to the current selection
   * @param {SVGElement} elem the element hit
   * @return {boolean} true if the element was selected, false otherwise
   * @private
   */
  addToSelection(elem) {
    // When something is selected in the SVG it is automatically linearised
    // before being added to the selection SVG. That way when an operation is
    // created, the paths can simply be converted to integer coordinates
    // without worrying about linearisation.
    const vb = App.getMainSVGBBox();
    try {
      const segs = SVG.segmentsFromElement(
        elem,
        {
          curveMinSegs: App.models.CurveConversion.minSegs(),
          curveMinSegLen: App.models.CurveConversion.minSegLen.toUnits("px"),
          vbx: vb.width,
          vby: vb.height
        });
      if (segs && segs.length > 0) {
        const newPath = document.createElementNS(
          'http://www.w3.org/2000/svg', "path");
        newPath.setAttribute("d", SVG.segments2d(segs));
        let classes = "selected-path";
        // .path loses 'Z', so have to save it somehow
        if (segs[segs.length - 1][0] === 'Z') {
          if (elem.getAttribute("fill-rule") === "evenodd")
            newPath.setAttribute("fill-rule", "evenodd");
          classes += " closed-path";
          this.closedSelected(this.closedSelected() + 1);
        } else {
          classes += " open-path";
          this.openSelected(this.openSelected() + 1);
        }
        newPath.setAttribute("class", classes);
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
      if (clas.indexOf("open-path") >= 0)
        this.openSelected(this.openSelected() - 1);
      else
        this.closedSelected(this.closedSelected() - 1);
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

export { SelectionViewModel }

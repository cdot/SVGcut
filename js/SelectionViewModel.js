/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */
/* global assert */

// import "knockout";
/* global ko */

//import "snapsvg";
/* global Snap */

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
     * Number of elements selected (==App.svgGroups.selection size)
     * @member {observable.<number>}
     */
    this.numSelected = ko.observable(0);
  }

  /**
   * Handler for a click event on the SVG window.
   * @param {Snap.Element} elem SVG element that was hit by the click
   * @return {boolean} true if the event has been handled
   */
  clickOnSVG(elem) {
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
      const path = SVG.segmentsFromElement(
        elem,
        App.models.CurveConversion.minSegs(),
        App.models.CurveConversion.minSegLen.toUnits("px"));
      if (path) {
        const newPath = App.svgGroups.selection.path(path);
        let classes = "selectedPath";
        // .path loses Z, so have to save it somehow
        if (path[path.length - 1][0] === 'Z') {
          if (elem.attr("fill-rule") === "evenodd")
            newPath.attr("fill-rule", "evenodd");
        } else
          classes += " openPath";
        newPath.attr("class", classes);

        this.numSelected(this.numSelected() + 1);
        return true;
      }
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
   * Consume the current selection and return it as a CutPaths. Clears
   * the selection.
   * @return {CutPaths}
   */
  getSelectedPaths() {
    const cps = new CutPaths();
    this.getSelection().forEach(element => {
      // Elements in the selectionSVG have already been linearised, when
      // the selection was made (in clickOnSVG)
      const segments = SVG.segmentsFromElement(element);
      let sps = CutPaths.fromSegments(segments);
      const isClosed = (element.attr("class").indexOf("openPath") < 0);
      for (const p of sps)
        p.isClosed = isClosed;
      sps = sps.simplifyAndClean(element.attr("fill-rule"));
      assert(sps instanceof CutPaths);
      cps.push(...sps);
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

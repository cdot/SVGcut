// import "knockout";
/* global ko */

/* global JSCut */

import { ViewModel } from "./ViewModel.js";
import * as SnapPaths from "./SnapPaths.js";

/**
 * Support for selection in SVG views.
 */
class SelectionViewModel extends ViewModel {

  /**
   * Note that this model doesn't require a unit converter, as it has
   * no UI components that require conversion.
   * @param {SVGGraphicsElement} svgGroup SVG group for containing the selection
   */
  constructor(svgGroup) {
    super();

    /**
     * The SVG group used for selections
     * @member {SVGGraphicsElement}
     * @private
     */
    this.svgGroup = svgGroup;

    /**
     * Number of elements selected (==this.svgGroup size)
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

    // Filter out JSCut-generated classes
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

    try {
      const path = SnapPaths.fromElement(
        elem,
        JSCut.models.CurveConversion.curveMinSegs(),
        JSCut.models.CurveConversion.curveMinSegLen.toUnits("px"));
      const newPath = this.svgGroup.path(path);
      newPath.attr("class", "selectedPath");
      if (elem.attr("fill-rule") === "evenodd")
        newPath.attr("fill-rule", "evenodd");
      this.numSelected(this.numSelected() + 1);
      return true;
    } catch (e) {
      JSCut.showAlert(e, "alert-warning");
    }

    return false;
  }

  /**
   * Get the list of SVG elements that are currently selected.
   * @return {SVGElement[]} list of SVG elements
   */
  getSelection() {
    return this.svgGroup.selectAll("path");
  }

  /**
   * Deselect all SVG elements
   */
  clearSelection() {
    this.svgGroup.selectAll("path").remove();
    this.numSelected(0);
  }
}

export { SelectionViewModel }

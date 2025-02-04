/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */
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
    this.svgGroup = document.getElementById("selectionSVGGroup");
  }

  /**
   * Handler for a click event on the SVG window.
   * @param {SVGElement} elem SVG element that was hit by the click
   * @return {boolean} true if the event has been handled
   */
  clickOnSVG(elem) {
    if (elem.tagName.toLowerCase() === "svg") {
      this.clearSelection();
      return false;
    }

    const clas = elem.getAttribute("class");

    if (clas) {
      // Filter out App-generated classes
      if (clas.indexOf("combinedGeometry") >= 0
          || clas.indexOf("toolPath") >= 0
          || clas.indexOf("tabsGeometry") >= 0)
        return false;

      // Deselect previously selected path
      if (clas.indexOf("selectedPath") >= 0) {
        elem.remove();
        if (clas.indexOf("openPath") >= 0)
          this.openSelected(this.openSelected() - 1);
        else
          this.closedSelected(this.closedSelected() - 1);
        return true;
      }
    }

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
        let classes = "selectedPath";
        // .path loses Z, so have to save it somehow
        if (segs[segs.length - 1][0] === 'Z') {
          if (elem.getAttribute("fill-rule") === "evenodd")
            newPath.setAttribute("fill-rule", "evenodd");
          classes += " closedPath";
          this.closedSelected(this.closedSelected() + 1);
        } else {
          classes += " openPath";
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
   * @return {boolean} True if at least one path is selected
   */
  isSomethingSelected() {
    return (this.openSelected() + this.closedSelected()) > 0;
  }

  /**
   * Consume the current selection and return it as a CutPaths. Clears
   * the selection.
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
      const isClosed = (clazz.indexOf("closedPath") >= 0);
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
   */
  clearSelection() {
    // replaceChildren with no parameters clears the node
    this.svgGroup.replaceChildren();
    this.openSelected(0);
    this.closedSelected(0);
  }

  /**
   * @override
   */
  jsonFieldName() { return "selection"; }
}

export { SelectionViewModel }

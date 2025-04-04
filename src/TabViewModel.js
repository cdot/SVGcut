/*Copyright Todd Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

//import "knockout";
/* global ko */

/* global App */

import { CutPath } from "./CutPath.js";
import { CutPaths } from "./CutPaths.js";
import { ViewModel } from "./ViewModel.js";
import { segments2d } from "./SVG.js";
import { DEFAULT } from "./Constants.js";

/**
 * View model for a holding tab within the `Tabs` card.
 * @extends ViewModel
 */
export class TabViewModel extends ViewModel {

  /**
   * @param {UnitConverter} unit converter to use
   * @param {CutPaths} tabPaths input paths to the operation
   */
  constructor(unitConverter, tabPaths) {
    super(unitConverter);

    if (!(tabPaths instanceof CutPaths))
      throw new Error("CutPaths only");

    /**
     * Lock out flag
     * @member {boolean}
     * @private
     */
    this.disableRecombination = false;

    /**
     * The input to this operation.
     * @member {CutPaths}
     * @private
     */
    this.tabPaths = tabPaths;

    /**
     * Tabs can be selectively enabled/disabled for Gcode
     * generation
     * @member {observable.<boolean>}
     */
    this.enabled = ko.observable(true);
    this.enabled.subscribe(newValue => {
      const v = newValue ? "visible" : "hidden";
      if (this.previewSVG)
        this.previewSVG.setAttribute("visibility", v);
      document.dispatchEvent(new Event("UPDATE_GCODE"));
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
    });

    /**
     * Positive: how much to expand tab. Negative: how much to shrink
     * tab.
     * @member {observable.<number>}
     */
    this.margin = ko.observable(DEFAULT.TAB_MARGIN);
    unitConverter.addComputed(this.margin);
    this.margin.subscribe(() => {
      this.recombine();
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
    });

    /**
     * Geometry generated by combining all the tab paths
     * using `union`.
     * @member {CutPaths}
     * @private
     */
    this.combinedGeometry = new CutPaths();

    /**
     * The combined geometry as an SVG path element.
     * @member {SVGGaphicsElement}
     * @private
     */
    this.previewSVG = undefined;

    this.recombine();
  }

  /**
   * Invoked from HTML. Operations are bound to this view model, so
   * when removeTab is bound it comes here.
   */
  removeTab() {
    App.models.Tabs.removeTab(this);
  }

  /**
   * Remove the SVG geometry contributed by this operation
   */
  removeCombinedGeometry() {
    if (this.previewSVG)
      this.previewSVG.remove();
    this.previewSVG = undefined;
    this.combinedGeometry = new CutPaths();
  }

  /**
   * (Re)generate combinedGeometry from the paths associated with this
   * operation (this.tabPaths)
   */
  recombine() {
    if (this.disableRecombination)
      return;

    if (!App.inputsAreValid())
      return;

    this.removeCombinedGeometry();

    this.combinedGeometry = new CutPaths().union(this.tabPaths);

    const off = this.margin.toUnits("integer");
    if (off !== 0) // bloat/shrink
      this.combinedGeometry = this.combinedGeometry.offset(off);

    if (this.combinedGeometry.length > 0) {
      const segs = this.combinedGeometry.toSegments();
      if (segs) {
        const svgel = document.createElementNS(
          'http://www.w3.org/2000/svg', "path");
        svgel.setAttribute("d", segments2d(segs));
        svgel.setAttribute("class", "tabs-geometry");
        document.getElementById("TabsSVGGroup").append(svgel);
        this.previewSVG = svgel;

        this.enabled(true);
      }
    }

    document.dispatchEvent(new Event("UPDATE_TOOL_PATHS"));
  }

  /**
   * @override
   */
  toJson() {
    // Will never be called with templateOnly
    return {
      tabPaths: this.tabPaths.toJson(),
      enabled: this.enabled(),
      margin: this.margin()
    };
  };

  /**
   * @override
   */
  fromJson(json) {
    // suppress recombine until we're finished
    this.disableRecombination = true;

    this.updateObservable(json, 'margin');
    this.updateObservable(json, 'enabled');

    this.disableRecombination = false;
    this.recombine();
  };
}

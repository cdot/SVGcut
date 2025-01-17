/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global ClipperLib */ // ../lib/clipper_unminified-6.1.3.2.js

//import "knockout";
/* global ko */

/* global App */

import * as InternalPaths from "./InternalPaths.js";
import * as SnapPaths from "./SnapPaths.js";
import { ViewModel } from "./ViewModel.js";

/**
 * View model for a holding tab within the `Tabs` card.
 */
export class TabViewModel extends ViewModel {

  /**
   * @param {UnitConverter} unit converter to use
   * @param {RawPath[]} rawPaths input paths to the operation
   */
  constructor(unitConverter, rawPaths) {
    super(unitConverter);

    /**
     * Lock out flag
     * @member {boolean}
     * @private
     */
    this.disableRecombination = false;

    /**
     * The input to this operation.
     * @member {RawPath[]}
     * @private
     */
    this.rawPaths = rawPaths;

    /**
     * Tabs can be selectively enabled/disabled for Gcode
     * generation
     * @member {observable.<boolean>}
     */
    this.enabled = ko.observable(true);
    this.enabled.subscribe(
      () => document.dispatchEvent(new Event("TOOL_PATHS_CHANGED")));
    this.enabled.subscribe(newValue => {
      const v = newValue ? "visible" : "hidden";
      if (this.combinedGeometrySvg)
        this.combinedGeometrySvg.attr("visibility", v);
    });

    /**
     * Positive: how much to expand tab. Negative: how much to shrink
     * tab.
     * @member {observable.<number>}
     */
    this.margin = ko.observable("0.0");
    unitConverter.addComputed(this.margin);
    this.margin.subscribe(() => this.recombine());

    /**
     * Geometry generated by combining all the paths in this operation
     * using combineOp
     * @member {InternalPath[]}
     * @private
     */
    this.combinedGeometry = [];

    /**
     * SVG showing the geometry for this tab.
     * This is a path that gets added to App.svgGroups.tabs
     * @member {SVGGaphicsElement}
     * @private
     */
    this.combinedGeometrySvg = null;

    this.recombine();
  }

  /**
   * @override
   */
  initialise(nodes) {
    this.addPopovers([
      { id: "tabEnabled" },
      { id: "tabMargin" }
    ], nodes);
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
    if (this.combinedGeometrySvg)
      this.combinedGeometrySvg.remove();
    this.combinedGeometrySvg = null;
    this.combinedGeometry = [];
  }

  /**
   * (Re)generate combinedGeometry from the paths associated with this
   * operation (this.rawPaths)
   */
  recombine() {
    if (this.disableRecombination)
      return;

    const startTime = Date.now();
    console.debug("Tab recombine...");

    this.removeCombinedGeometry();

    const all = [];
    for (const rp of this.rawPaths) {
      const geometry = SnapPaths.toInternal(rp.path);
      const fillRule = rp.nonzero
            ? ClipperLib.PolyFillType.pftNonZero
            : ClipperLib.PolyFillType.pftEvenOdd;
      all.push(InternalPaths.simplifyAndClean(geometry, fillRule));
    }

    if (all.length > 0) {
      this.combinedGeometry = all[0];
      for (let i = 1; i < all.length; ++i)
        this.combinedGeometry = InternalPaths.clip(
          this.combinedGeometry, all[i], ClipperLib.ClipType.ctUnion);
    }

    const off = this.margin.toUnits("internal");
    if (off !== 0) // bloat/shrink
      this.combinedGeometry = InternalPaths.offset(this.combinedGeometry, off);

    if (this.combinedGeometry.length > 0) {
      const path = SnapPaths.fromInternal(this.combinedGeometry);
      if (path) {
        this.combinedGeometrySvg = App.svgGroups.tabs
        .path(path)
        .attr("class", "tabsGeometry");
        this.enabled(true);
      }
    }

    console.debug("Tab recombine took " + (Date.now() - startTime));

    App.models.Operations.generateToolPaths();
  };

  /**
   * @override
   */
  toJson() {
    // Will never be called with templateOnly
    return {
      rawPaths: this.rawPaths,
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

    this.rawPaths = json.rawPaths;
    this.updateObservable(json, 'margin');
    this.updateObservable(json, 'enabled');

    this.disableRecombination = false;
    this.recombine();
  };
}

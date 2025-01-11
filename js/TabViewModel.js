/*Copyright Tim Fleming, Crawford Currie 2014-2024. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global ClipperLib */ // ../lib/clipper_unminified-6.1.3.2.js

//import "knockout";
/* global ko */

/* global App */

import * as InternalPaths from "./InternalPaths.js";
import * as SnapPaths from "./SnapPaths.js";
import { ViewModel } from "./ViewModel.js";

/**
 * View model for a tab withn the `Tabs` card.
 */
export class TabViewModel extends ViewModel {
  // SMELL: suspect this should extend OperationViewModel, to get at
  // recombine()
  constructor(rawPaths, loading) {
    super();
    this.loading = loading;
    this.rawPaths = rawPaths;
    this.enabled = ko.observable(true);
    this.margin = ko.observable("0.0");
    this.combinedGeometry = [];
    this.combinedGeometrySvg = null;

    App.models.Tabs.unitConverter.addComputed(this.margin);
    this.enabled.subscribe(
      () => document.dispatchEvent(new Event("toolPathsChanged")));

    this.enabled.subscribe(newValue => {
      const v = newValue ? "visible" : "hidden";
      if (this.combinedGeometrySvg)
        this.combinedGeometrySvg.attr("visibility", v);
    });

    this.margin.subscribe(() => this.recombine());
    this.recombine();
  }

  // @override
  initSubview(nodes) {
    this.addPopovers([
      { id: "tabEnabled" },
      { id: "tabMargin" }
    ], nodes);
  }

  removeCombinedGeometrySvg() {
    if (this.combinedGeometrySvg) {
      this.combinedGeometrySvg.remove();
      this.combinedGeometrySvg = null;
    }
  }

  recombine() {
    if (this.loading)
      return;

    const startTime = Date.now();
    console.debug("tabs recombine...");

    this.removeCombinedGeometrySvg();

    const all = [];
    for (const rp of this.rawPaths) {
      try {
        const geometry = SnapPaths.toInternal(rp.path);
        const fillRule = rp.nonzero
              ? ClipperLib.PolyFillType.pftNonZero
              : ClipperLib.PolyFillType.pftEvenOdd;
        all.push(InternalPaths.simplifyAndClean(geometry, fillRule));
      } catch (e) {
        App.showAlert(e, "alert-warning");
      }
    }

    if (all.length == 0)
      this.combinedGeometry = [];
    else {
      this.combinedGeometry = all[0];
      for (let i = 1; i < all.length; ++i)
        this.combinedGeometry = InternalPaths.clip(
          this.combinedGeometry, all[i], ClipperLib.ClipType.ctUnion);
    }

    const off = this.margin.toUnits("internal");
    if (off != 0)
      this.combinedGeometry = InternalPaths.offset(
        this.combinedGeometry, off);

    if (this.combinedGeometry.length != 0) {
      const path = SnapPaths.fromInternal(this.combinedGeometry);
      if (path != null)
        this.combinedGeometrySvg = App.group.Tabs.path(path)
      .attr("class", "tabsGeometry");
    }

    console.debug("tabs recombine: " + (Date.now() - startTime));

    this.enabled(true);

    document.dispatchEvent(new Event("toolPathsChanged"));
  };

  // @override
  toProjectJson() {
    return {
      rawPaths: this.rawPaths,
      enabled: this.enabled(),
      margin: this.margin()
    };
  };

  // @override
  fromProjectJson(json) {
    this.loading = true;
    this.rawPaths = json.rawPaths;
    this.updateObservable(json, 'margin');

    this.loading = false;
    this.recombine();

    this.updateObservable(json, 'enabled');
  };
}


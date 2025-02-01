/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

// import "knockout";
/* global ko */

import { ViewModel } from "./ViewModel.js";

const POPOVERS = [
  { id: "inputMinNumSegments" },
  { id: "inputMinSegmentLength" }
];

/**
 * View model for curve conversion parameters
 */
class CurveConversionViewModel extends ViewModel {

  /**
   * @param {UnitConverter} unitConverter the UnitConverter to use
   */
  constructor(unitConverter) {
    super(unitConverter);

    /**
     * Minimum number of segments in a curve
     * @member {observable.<number>}
     */
    this.minSegs = ko.observable(1);
    this.minSegs.subscribe(
      () => document.dispatchEvent(new Event("UPDATE_GEOMETRY")));

    /**
     * Minimum number of segments in a curve
     * @member {observable.<number>}
     */
    this.minSegLen = ko.observable(unitConverter.fromUnits(0.25, "mm"));

    unitConverter.add(this.minSegLen);
  }

  /**
   * @override
   */
  initialise() {
    super.addPopovers(POPOVERS);

    ko.applyBindings(this, document.getElementById("CurveConversionView"));
  }

  /**
   * @override
   */
  jsonFieldName() { return "curveToLine"; }

  /**
   * @override
   */
  toSettingsJson() {
    return {
      minSegs: this.minSegs(),
      minSegLen: this.minSegLen()
    };
  }

  /**
   * @override
   */
  fromSettingsJson(json) {
    this.updateObservable(json, 'minSegs');
    this.updateObservable(json, 'minSegLen');
  }
}

export { CurveConversionViewModel }

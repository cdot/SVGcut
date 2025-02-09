/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

// import "knockout";
/* global ko */

/* global App */

import { ViewModel } from "./ViewModel.js";

const POPOVERS = [
  { id: "inputMinNumSegments" },
  { id: "inputMinSegmentLength" }
];

const DEFAULT_MINSEGS = 5;
const DEFAULT_MINSEGLEN = 0.25; //mm

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
    this.minSegs = ko.observable(DEFAULT_MINSEGS);
    this.minSegs.subscribe(() =>
      document.dispatchEvent(new Event("PROJECT_CHANGED")));

    /**
     * Minimum number of segments in a curve
     * @member {observable.<number>}
     */
    this.minSegLen = ko.observable(
      unitConverter.fromUnits(DEFAULT_MINSEGLEN, "mm"));
    this.minSegLen.subscribe(() =>
      document.dispatchEvent(new Event("PROJECT_CHANGED")));

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
  reset() {
    this.minSegs(DEFAULT_MINSEGS);
    this.minSegLen(this.unitConverter.fromUnits(DEFAULT_MINSEGLEN, "mm"));
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

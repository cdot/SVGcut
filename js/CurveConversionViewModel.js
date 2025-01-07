// import "knockout";
/* global ko */

import { ViewModel } from "./ViewModel.js";

const popovers = [
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
     * @member {number}
     */
    this.curveMinSegs = ko.observable(1);

    /**
     * Minimum number of segments in a curve
     * @member {number}
     */
    this.curveMinSegLen = ko.observable(unitConverter.fromUnits(0.25, "mm"));

    unitConverter.add(this.curveMinSegLen);
  }

  getCurveConversion() {
    return this.svgGroup.selectAll("path");
  }

  clearCurveConversion() {
    this.svgGroup.selectAll("path").remove();
    this.numSelected(0);
  }
 
  // @override
  initialise() {
    super.addPopovers(popovers);

    ko.applyBindings(this, document.getElementById("CurveConversionView"));
  }

  // @override
  get jsonFieldName() { return "curveToLineConversion"; }

  // @override
  toJson() {
    return {
      curveMinSegs: this.curveMinSegs(),
      curveMinSegLen: this.curveMinSegLen()
    };
  }

  // @override
  fromJson(json) {
    this.updateObservable(json, 'curveMinSegs');
    this.updateObservable(json, 'curveMinSegLen');
  }
}

export { CurveConversionViewModel }

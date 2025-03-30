/*Copyright Todd Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

/* global ko */
/* global ClipperLib */
/* global App */

import { ViewModel } from "./ViewModel.js";
import { DEFAULT } from "./Constants.js";

/**
 * View model for curve conversion parameters
 * @extends ViewModel
 */
export class ApproximationViewModel extends ViewModel {

  /**
   * Minimum number of segments in a curve. Used when selecting.
   * @member {observable.<number>}
   */
  minSegs = ko.observable(DEFAULT.MIN_SEGS);

  /**
   * Minimum number of segments in a curve. Used when selecting.
   * @member {observable.<number>}
   */
  minSegLen = ko.observable();

  /**
   * Join type when offsetting polys during toolpath generation.
   * @member {observable.<number>}
   */
  joinType = ko.observable(DEFAULT.JOIN_TYPE);

  /**
   * Join mitre limit during toolpath generation.
   * @member {observable.<number>}
   */
  mitreLimit = ko.observable(DEFAULT.MITRE_LIMIT);

  /**
   * @param {UnitConverter} unitConverter the UnitConverter to use
   */
  constructor(unitConverter) {
    super(unitConverter, );

    this.minSegs.subscribe(() =>
      document.dispatchEvent(new Event("PROJECT_CHANGED")));

    this.minSegLen(unitConverter.fromUnits(DEFAULT.MIN_SEG_LEN, "mm"));
    this.minSegLen.subscribe(() =>
      document.dispatchEvent(new Event("PROJECT_CHANGED")));
    unitConverter.add(this.minSegLen, "minSegLen");

    this.joinType.subscribe(() => App.models.Operations.recombine());
    this.mitreLimit.subscribe(() => App.models.Operations.recombine());
  }

  /**
   * @override
   */
  bind() {
    super.bind("ApproximationView");
  }

  get approximations() {
    return {
      minSegs: Number(this.minSegs()),
      minSegLen: Number(this.minSegLen()),
      joinType: Number(this.joinType()),
      mitreLimit: Number(this.mitreLimit())
    };
  }

  /**
   * @override
   */
  reset() {
    this.minSegs(DEFAULT.MIN_SEGS);
    this.minSegLen(this.unitConverter.fromUnits(DEFAULT.MIN_SEG_LEN, "mm"));
    this.joinType(DEFAULT.JOIN_TYPE);
    this.mitreLimit(DEFAULT.MITRE_LIMIT);
  }

  /**
   * @override
   */
  jsonFieldName() { return "curveToLine"; }

  /**
   * @override
   */
  toSettingsJson() {
    return this.approximations;
  }

  /**
   * @override
   */
  fromSettingsJson(json) {
    this.updateObservable(json, 'minSegs');
    this.updateObservable(json, 'minSegLen');
    this.updateObservable(json, 'joinType');
    this.updateObservable(json, 'mitreLimit');
  }
}


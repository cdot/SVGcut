/*Copyright Todd Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

// import "knockout";
/* global ko */

/* global App */

import { ViewModel } from "./ViewModel.js";
import { DEFAULT, MIN } from "./Constants.js";

/**
 * View model for the Tool pane
 * @extends ViewModel
 */
export class ToolViewModel extends ViewModel {

  constructor(unitConverter) {
    super(unitConverter);

    /**
     * Tool diameter mm, must be >= 0.01mm
     * @member {observable.<number>}
     */
    this.cutterDiameter = ko
    .observable(unitConverter.fromUnits(DEFAULT.TOOL_DIAMETER, "mm"))
    .extend({
      MIN: ko.computed(() => unitConverter.fromUnits(MIN.TOOL_DIAMETER, "mm"))
    });
    unitConverter.add(this.cutterDiameter);
    this.cutterDiameter.subscribe(v => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      App.models.Operations.recombine();
    });

    /**
     * Tool v-bit angle
     * @member {observable.<number>}
     */
    this.cutterAngle = ko
    .observable(DEFAULT.TOOL_ANGLE)
    .extend({ MIN: 1, MAX: 90 });
    this.cutterAngle.subscribe(newValue => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      App.models.Operations.recombine();
    });

    /**
     * Depth of each tool pass. Operator can override.
     * @member {observable.<number>}
     */
    this.passDepth = ko
    .observable(unitConverter.fromUnits(DEFAULT.PASS_DEPTH, "mm"))
    .extend({ MIN: ko.computed(() =>
      unitConverter.fromUnits(MIN.PASS_DEPTH, "mm"))});
    unitConverter.add(this.passDepth);
    this.passDepth.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      document.dispatchEvent(new Event("UPDATE_GCODE"));
    });

    /**
     * Percentage of the tool diameter. Operator can override.
     * @member {observable.<number>}
     */
    this.stepOver = ko.observable(DEFAULT.STEP_OVER)
    .extend({ MIN: 1, MAX: 100 });
    this.stepOver.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      App.models.Operations.recombine();
    });

    /**
     * Rapid movement rate mm/min
     * @member {observable.<number>}
     */
    this.rapidRate = ko.observable(
      unitConverter.fromUnits(DEFAULT.RAPID_RATE, "mm"))
    .extend({ MIN: ko.computed(() =>
      unitConverter.fromUnits(MIN.RAPID_RATE, "mm")) });
    unitConverter.add(this.rapidRate);
    this.rapidRate.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      document.dispatchEvent(new Event("UPDATE_GCODE"));
    });

    /**
     * Tool plunge rate mm/min
     * @member {observable.<number>}
     */
    this.plungeRate = ko.observable(
      unitConverter.fromUnits(DEFAULT.PLUNGE_RATE, "mm"))
    .extend({ MIN: ko.computed(() =>
      unitConverter.fromUnits(MIN.PLUNGE_RATE, "mm")) });
    unitConverter.add(this.plungeRate);
    this.plungeRate.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      document.dispatchEvent(new Event("UPDATE_GCODE"));
    });

    /**
     * Tool cut rate mm/min. Operator can override.
     * @member {observable.<number>}
     */
    this.cutRate = ko.observable(
      unitConverter.fromUnits(DEFAULT.CUT_RATE, "mm"))
    .extend({ MIN: ko.computed(() =>
      unitConverter.fromUnits(MIN.CUT_RATE, "mm")) });
    unitConverter.add(this.cutRate);
    this.cutRate.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      document.dispatchEvent(new Event("UPDATE_GCODE"));
    });

    /**
     * Spindle speed. Operator can override.
     * @member {observable.<number>}
     */
    this.rpm = ko.observable(DEFAULT.SPINDLE_RPM)
    .extend({ MIN: 0 });
    this.rpm.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      document.dispatchEvent(new Event("UPDATE_GCODE"));
    });

    const el = document.getElementById("ToolView");
    ko.applyBindings(this, el);
    this.addPopovers(el);
  }

  /**
   * @override
   */
  reset() {
    this.cutterDiameter(DEFAULT.TOOL_DIAMETER);
    this.cutterAngle(DEFAULT.TOOL_ANGLE);
    this.stepOver(DEFAULT.STEP_OVER);
    this.passDepth(DEFAULT.PASS_DEPTH);
    this.rapidRate(DEFAULT.RAPID_RATE);
    this.plungeRate(DEFAULT.PLUNGE_RATE);
    this.cutRate(DEFAULT.CUT_RATE);
    this.rpm(DEFAULT.SPINDLE_RPM);
  }

  /**
   * @override
   */
  jsonFieldName() { return "tool"; }

  /**
   * @override
   */
  toJson() {
    return {
      cutterDiameter: this.cutterDiameter(),
      cutterAngle: this.cutterAngle(),
      passDepth: this.passDepth(),
      stepOver: this.stepOver(),
      rapidRate: this.rapidRate(),
      plungeRate: this.plungeRate(),
      cutRate: this.cutRate(),
      rpm: this.rpm()
    };
  }

  /**
   * @override
   */
  fromJson(json) {
    this.updateObservable(json, 'diameter');
    this.updateObservable(json, 'cutterAngle');
    this.updateObservable(json, 'passDepth');
    this.updateObservable(json, 'stepOver');
    this.updateObservable(json, 'rapidRate');
    this.updateObservable(json, 'plungeRate');
    this.updateObservable(json, 'cutRate');
  };
}


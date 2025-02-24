/*Copyright Todd Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

// import "knockout";
/* global ko */

/* global App */

import { ViewModel } from "./ViewModel.js";

const DEFAULT_STEP_OVER   = 40;   // percentage of tool diameter
const DEFAULT_DIAMETER    = 1;    // mm
const DEFAULT_ANGLE       = 90;   // degrees, 90=flat
const DEFAULT_PASSDEPTH   = 0.2;  // mm
const DEFAULT_RAPID_RATE  = 1000; // mm/min
const DEFAULT_PLUNGE_RATE = 100;  // mm/min
const DEFAULT_CUT_RATE    = 100;  // mm/min
const DEFAULT_SPINDLE_RPM = 1000; // rpm

/**
 * View model for the Tool pane
 */
class ToolViewModel extends ViewModel {

  constructor(unitConverter) {
    super(unitConverter);

    /**
     * Tool diameter mm, must be > 0
     * @member {observable.<number>}
     */
    this.cutterDiameter = ko.observable(
      unitConverter.fromUnits(DEFAULT_DIAMETER, "mm"))
    .extend({ min: unitConverter.fromUnits(0.01, "mm")});
    unitConverter.add(this.cutterDiameter);
    this.cutterDiameter.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      App.models.Operations.recombine();
    });

    /**
     * Tool v-bit angle
     * @member {observable.<number>}
     */
    this.cutterAngle = ko.observable(DEFAULT_ANGLE);
    this.cutterAngle.subscribe(newValue => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      document.dispatchEvent(new Event("UPDATE_GCODE"));
    });

    /**
     * Depth of each tool pass.
     * @member {observable.<number>}
     */
    this.passDepth = ko.observable(
      unitConverter.fromUnits(DEFAULT_PASSDEPTH, "mm"));
    unitConverter.add(this.passDepth);
    this.passDepth.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      document.dispatchEvent(new Event("UPDATE_GCODE"));
    });

    /**
     * Fraction of the tool diameter, [0..1]
     * @member {observable.<number>}
     */
    this.stepOver = ko.observable(DEFAULT_STEP_OVER);
    this.stepOver.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      App.models.Operations.recombine();
    });

    /**
     * Rapid movement rate mm/min
     * @member {observable.<number>}
     */
    this.rapidRate = ko.observable(
      unitConverter.fromUnits(DEFAULT_RAPID_RATE, "mm"));
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
      unitConverter.fromUnits(DEFAULT_PLUNGE_RATE, "mm"));
    unitConverter.add(this.plungeRate);
    this.plungeRate.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      document.dispatchEvent(new Event("UPDATE_GCODE"));
    });

    /**
     * Tool cut rate mm/min
     * @member {observable.<number>}
     */
    this.cutRate = ko.observable(
      unitConverter.fromUnits(DEFAULT_CUT_RATE, "mm"));
    unitConverter.add(this.cutRate);
    this.cutRate.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      document.dispatchEvent(new Event("UPDATE_GCODE"));
    });

    /**
     * Spindle speed (only one supported)
     * @member {observable.<number>}
     */
    this.rpm = ko.observable(DEFAULT_SPINDLE_RPM);
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
    this.cutterDiameter(DEFAULT_DIAMETER);
    this.cutterAngle(DEFAULT_ANGLE);
    this.stepOver(DEFAULT_STEP_OVER);
    this.passDepth(DEFAULT_PASSDEPTH);
    this.rapidRate(DEFAULT_RAPID_RATE);
    this.plungeRate(DEFAULT_PLUNGE_RATE);
    this.cutRate(DEFAULT_CUT_RATE);
    this.rpm(DEFAULT_SPINDLE_RPM);
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

export { ToolViewModel }

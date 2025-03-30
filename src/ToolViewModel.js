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

  /**
   * Tool diameter mm, must be >= 0.01mm
   * @member {observable.<number>}
   */
  cutterDiameter = this.limited("TOOL_DIAMETER");

  /**
   * Tool v-bit angle
   * @member {observable.<number>}
   */
  cutterAngle = ko.observable(DEFAULT.TOOL_ANGLE).extend({ MIN: 1, MAX: 90 });

  /**
   * Depth of each tool pass. Operator can override.
   * @member {observable.<number>}
   */
  passDepth = this.limited("PASS_DEPTH");

  /**
   * Percentage of the tool diameter. Operator can override.
   * @member {observable.<number>}
   */
  stepOver = ko.observable(DEFAULT.STEP_OVER).extend({ MIN: 1, MAX: 100 });

  /**
   * Rapid movement rate mm/min
   * @member {observable.<number>}
   */
  rapidRate = this.limited("RAPID_RATE");

  /**
   * Tool plunge rate mm/min
   * @member {observable.<number>}
   */
  plungeRate = this.limited("PLUNGE_RATE");

  /**
   * Tool cut rate mm/min. Operator can override.
   * @member {observable.<number>}
   */
  cutRate = this.limited("CUT_RATE");

  /**
   * Spindle speed. Operator can override.
   * @member {observable.<number>}
   */
  rpm = ko.observable(DEFAULT.SPINDLE_RPM).extend({ MIN: 0 });

  constructor(unitConverter) {
    super(unitConverter);

    unitConverter.add(this.cutterDiameter, "cutterDiameter");
    this.cutterDiameter.subscribe(v => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      App.models.Operations.recombine();
    });

    this.cutterAngle.subscribe(newValue => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      App.models.Operations.recombine();
    });

    unitConverter.add(this.passDepth, "passDepth");
    this.passDepth.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      document.dispatchEvent(new Event("UPDATE_GCODE"));
    });

    this.stepOver.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      App.models.Operations.recombine();
    });

    unitConverter.add(this.rapidRate, "rapidRate");
    this.rapidRate.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      document.dispatchEvent(new Event("UPDATE_GCODE"));
    });

    unitConverter.add(this.plungeRate, "plungeRate");
    this.plungeRate.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      document.dispatchEvent(new Event("UPDATE_GCODE"));
    });

    unitConverter.add(this.cutRate, "cutRate");
    this.cutRate.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      document.dispatchEvent(new Event("UPDATE_GCODE"));
    });

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

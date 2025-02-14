/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

// import "knockout";
/* global ko */

/* global App */

import { ViewModel } from "./ViewModel.js";

const DEFAULT_STEPOVER = 0.4;
const DEFAULT_DIAMETER = 3; // mm
const DEFAULT_PASSDEPTH = 1; // mm
const DEFAULT_RAPIDRATE = 1000; // mm/min
const DEFAULT_PLUNGERATE = 300; // mm/min
const DEFAULT_CUTRATE = 300; // mm/min
const DEFAULT_ANGLE = 180; // degrees, 180=flat

/**
 * View model for the Tool pane
 */
class ToolViewModel extends ViewModel {

  constructor(unitConverter) {
    super(unitConverter);

    /**
     * Fraction of the tool diameter, [0..1]
     * @member {observable.<number>}
     */
    this.stepover = ko.observable(DEFAULT_STEPOVER);
    this.stepover.subscribe(() => App.models.Operations.recombine());

    /**
     * Tool diameter mm, must be > 0
     * @member {observable.<number>}
     */
    this.diameter = ko.observable(
      unitConverter.fromUnits(DEFAULT_DIAMETER, "mm"))
    .extend({ min: unitConverter.fromUnits(0.01, "mm")});
    unitConverter.add(this.diameter);
    this.diameter.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      App.models.Operations.recombine();
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
     * Rapid movement rate mm/min
     * @member {observable.<number>}
     */
    this.rapidRate = ko.observable(
      unitConverter.fromUnits(DEFAULT_RAPIDRATE, "mm"));
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
      unitConverter.fromUnits(DEFAULT_PLUNGERATE, "mm"));
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
      unitConverter.fromUnits(DEFAULT_CUTRATE, "mm"));
    unitConverter.add(this.cutRate);
    this.cutRate.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      document.dispatchEvent(new Event("UPDATE_GCODE"));
    });

    /**
     * Tool v-bit angle
     * @member {observable.<number>}
     */
    this.angle = ko.observable(DEFAULT_ANGLE);
    this.angle.subscribe(newValue => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      if (newValue <= 0 || newValue > 180) {
        this.angle(180);
        document.dispatchEvent(new Event("UPDATE_GCODE"));
      }
    });

    const el = document.getElementById("ToolView");
    ko.applyBindings(this, el);
    this.addPopovers(el);
  }

  /**
   * @override
   */
  reset() {
    this.diameter(DEFAULT_DIAMETER);
    this.stepover(DEFAULT_STEPOVER);
    this.passDepth(DEFAULT_PASSDEPTH);
    this.rapidRate(DEFAULT_RAPIDRATE);
    this.plungeRate(DEFAULT_PLUNGERATE);
    this.cutRate(DEFAULT_CUTRATE);
    this.angle(DEFAULT_ANGLE);
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
      diameter: this.diameter(),
      angle: this.angle(),
      passDepth: this.passDepth(),
      stepover: this.stepover(),
      rapidRate: this.rapidRate(),
      plungeRate: this.plungeRate(),
      cutRate: this.cutRate()
    };
  }

  /**
   * @override
   */
  fromJson(json) {
    this.updateObservable(json, 'diameter');
    this.updateObservable(json, 'angle');
    this.updateObservable(json, 'passDepth');
    if (typeof json.overlap !== "undefined") // backwards compat
      this.stepover(1 - json.overlap);
    this.updateObservable(json, 'stepover');
    this.updateObservable(json, 'rapidRate');
    this.updateObservable(json, 'plungeRate');
    this.updateObservable(json, 'cutRate');
  };
}

export { ToolViewModel }

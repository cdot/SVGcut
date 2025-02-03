/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

// import "knockout";
/* global ko */

/* global App */

import { ViewModel } from "./ViewModel.js";

const POPOVERS = [
  { id: "toolUnits" },
  { id: "toolDiameter" },
  { id: "toolAngle" },
  { id: "toolPassDepth" },
  { id: "toolStepOver" },
  { id: "toolRapidRate" },
  { id: "toolPlungeRate" },
  { id: "toolCutRate" }
];

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
    this.stepover = ko.observable(0.4);
    this.stepover.subscribe(() => App.models.Operations.recombine());

    /**
     * Tool diameter mm, must be > 0
     * @member {observable.<number>}
     */
    this.diameter = ko.observable(unitConverter.fromUnits(3, "mm"))
    .extend({ min: unitConverter.fromUnits(0.01, "mm")});
    unitConverter.add(this.diameter);
    this.diameter.subscribe(() => App.models.Operations.recombine());
    this.diameter.subscribe(() => App.projectChanged(true));

    /**
     * Depth of each tool pass.
     * @member {observable.<number>}
     */
    this.passDepth = ko.observable(unitConverter.fromUnits(1, "mm"));
    unitConverter.add(this.passDepth);
    this.passDepth.subscribe(
      () => document.dispatchEvent(new Event("UPDATE_GCODE")));
    this.passDepth.subscribe(() => App.projectChanged(true));

    /**
     * Rapid movement rate mm/min
     * @member {observable.<number>}
     */
    this.rapidRate = ko.observable(unitConverter.fromUnits(300, "mm"));
    unitConverter.add(this.rapidRate);
    this.rapidRate.subscribe(
      () => document.dispatchEvent(new Event("UPDATE_GCODE")));
    this.rapidRate.subscribe(() => App.projectChanged(true));

    /**
     * Tool plunge rate mm/min
     * @member {observable.<number>}
     */
    this.plungeRate = ko.observable(unitConverter.fromUnits(80, "mm"));
    unitConverter.add(this.plungeRate);
    this.plungeRate.subscribe(
      () => document.dispatchEvent(new Event("UPDATE_GCODE")));
    this.plungeRate.subscribe(() => App.projectChanged(true));

    /**
     * Tool cut rate mm/min
     * @member {observable.<number>}
     */
    this.cutRate = ko.observable(unitConverter.fromUnits(100, "mm"));
    unitConverter.add(this.cutRate);
    this.cutRate.subscribe(
      () => document.dispatchEvent(new Event("UPDATE_GCODE")));
    this.cutRate.subscribe(() => App.projectChanged(true));

    /**
     * Tool v-bit angle
     * @member {observable.<number>}
     */
    this.angle = ko.observable(180 /*degrees, 180=flat*/);
    this.angle.subscribe(newValue => {
      if (newValue <= 0 || newValue > 180) {
        this.angle(180);
        document.dispatchEvent(new Event("UPDATE_GCODE"));
      }
    });
    this.angle.subscribe(() => App.projectChanged(true));
  }

  /**
   * @override
   */
  initialise() {
    this.addPopovers(POPOVERS);
    ko.applyBindings(this, document.getElementById("ToolView"));
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

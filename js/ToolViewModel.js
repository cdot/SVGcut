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
     * Fraction of the tool diameter.
     * @member {observable.<number>}
     */
    this.stepover = ko.observable(0.4);

    /**
     * Tool diameter mm
     * @member {observable.<number>}
     */
    this.diameter = ko.observable(unitConverter.fromUnits(3, "mm"));
    unitConverter.add(this.diameter);

    /**
     * Depth of each tool pass.
     * @member {observable.<number>}
     */
    this.passDepth = ko.observable(unitConverter.fromUnits(1, "mm"));
    unitConverter.add(this.passDepth);

    /**
     * Rapid movement rate mm/min
     * @member {observable.<number>}
     */
    this.rapidRate = ko.observable(unitConverter.fromUnits(300, "mm"));
    unitConverter.add(this.rapidRate);

    /**
     * Tool plunge rate mm/min
     * @member {observable.<number>}
     */
   this.plungeRate = ko.observable(unitConverter.fromUnits(80, "mm"));
    unitConverter.add(this.plungeRate);

    /**
     * Tool cut rate mm/min
     * @member {observable.<number>}
     */
    this.cutRate = ko.observable(unitConverter.fromUnits(100, "mm"));
    unitConverter.add(this.cutRate);

    /**
     * Tool v-bit angle
     * @member {observable.<number>}
     */
    this.angle = ko.observable(180 /*degrees, 180=flat*/);
    this.angle.subscribe(newValue => {
      if (newValue <= 0 || newValue > 180)
        this.angle(180);
    });
  }

  /**
   * @override
   */
  initialise() {
    this.addPopovers(POPOVERS);
    ko.applyBindings(this, document.getElementById("ToolView"));
  }

  /**
   * Retrieve arguments that are associated with CAM.
   * @return {object} the current values of: diameter, passDepth,
   * and stepover. Sizes are in jscut units.
   */
  getCamArgs() {
    const result = {
      diameter: this.diameter.toUnits("internal"),
      passDepth: this.passDepth.toUnits("internal"),
      stepover: Number(this.stepover())
    };
    if (result.diameter <= 0) {
      App.showAlert("toolTooSmall", "alert-danger");
      return null;
    }
    if (result.stepover <= 0) {
      App.showAlert("stepoverTooSmall", "alert-danger");
      return null;
    }
    if (result.stepover > 1) {
      App.showAlert("stepoverTooBig", "alert-danger");
      return null;
    }
    return result;
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

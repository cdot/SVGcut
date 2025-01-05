// import "knockout";
/* global ko */

/* global JSCut */

import { UnitConverter } from "./UnitConverter.js";
import { ViewModel } from "./ViewModel.js";

const popovers = [
  { id: "toolUnits" },
  { id: "toolDiameter" },
  { id: "toolAngle" },
  { id: "toolPassDepth" },
  { id: "toolStepOver" },
  { id: "toolRapidRate" },
  { id: "toolPlungeRate" },
  { id: "toolCutRate" }
];

class ToolViewModel extends ViewModel {

  constructor() {
    super();

    this.unitConverter = new UnitConverter(this.units);

    // Fraction of the tool diameter
    this.stepover = ko.observable(0.4);

    // Tool diameter
    this.diameter = ko.observable(3 /*mm*/);
    this.unitConverter.add(this.diameter);

    // Depth of each tool pass
    this.passDepth = ko.observable(3 /*mm*/);
    this.unitConverter.add(this.passDepth);

    // Rapid movement rate
    this.rapidRate = ko.observable(2500 /*mm/min*/);
    this.unitConverter.add(this.rapidRate);

    // Tool plunge rate
    this.plungeRate = ko.observable(100/*mm/min*/);
    this.unitConverter.add(this.plungeRate);

    // Tool cut rate
    this.cutRate = ko.observable(1000 /*mm/min*/);
    this.unitConverter.add(this.cutRate);

    this.angle = ko.observable(180 /*degrees*/);
    this.angle.subscribe(newValue => {
      if (newValue <= 0 || newValue > 180)
        this.angle(180);
    });
  }

  // @override
  initialise() {
    this.addPopovers(popovers);
    ko.applyBindings(this, document.getElementById("ToolCard"));
  }

  /**
   * Retrieve arguments that are associated with CAM.
   * @return {object} the current values of: diameter, passDepth,
   * and stepover. Sizes are in jscut units.
   */
  getCamArgs() {
    const result = {
      diameter: this.diameter.toUnits("jscut"),
      passDepth: this.passDepth.toUnits("jscut"),
      stepover: Number(this.stepover())
    };
    if (result.diameter <= 0) {
      JSCut.showAlert("Tool diameter must be greater than 0", "alert-danger");
      return null;
    }
    if (result.stepover <= 0) {
      JSCut.showAlert("Tool stepover must be geater than 0", "alert-danger");
      return null;
    }
    if (result.stepover > 1) {
      JSCut.showAlert(
        "Tool stepover must be less than or equal to 1", "alert-danger");
      return null;
    }
    return result;
  }

  // @override
  get jsonFieldName() { return "tool"; }

  // @override
  toJson() {
    return {
      units: this.units(),
      diameter: this.diameter(),
      angle: this.angle(),
      passDepth: this.passDepth(),
      stepover: this.stepover(),
      rapidRate: this.rapidRate(),
      plungeRate: this.plungeRate(),
      cutRate: this.cutRate()
    };
  }

  // @override
  fromJson(json) {
    this.updateObservable(json, 'tool');
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

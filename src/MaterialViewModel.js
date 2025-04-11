/*Copyright Todd Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

// import "knockout";
/* global ko */
/* global assert */
/* global App */

import { ViewModel } from "./ViewModel.js";
import * as SVG from "./SVG.js";
import { DEFAULT } from "./Constants.js";

function formatZ(z) {
  return parseFloat(z).toFixed(3);
}

/**
   * View model for the Material pane
 * @extends ViewModel
 */
export class MaterialViewModel extends ViewModel {

  /**
   * Material thickness
   * @member {observable.<number>}
   */
  thickness = ko.observable(
    this.unitConverter.fromUnits(DEFAULT.THICKNESS, "mm"));

  /**
   * Tool clearance level
   * @member {observable.<number>}
   */
  clearance = ko.observable(
    this.unitConverter.fromUnits(DEFAULT.CLEARANCE, "mm"));

  /**
   * Z origin, Top or Bottom of the material
   * @member {observable.<string>}
   */
  zOrigin = ko.observable(DEFAULT.Z_ORIGIN);

  /**
   * Z level for Z origin, computed
   * @member {observable.<number>}
   */
  topZ = ko.pureComputed(() => {
      if (this.zOrigin() === "Top")
        return 0;
      return this.thickness();
    });

  /**
   * Z level for bottom of material, computed
   * @member {observable.<number>}
   */
  botZ = ko.pureComputed(() => {
    if (this.zOrigin() === "Bottom")
      return 0;
    else
      return -this.thickness();
  });

  /**
   * Safe level, computed
   * @member {observable.<number>}
   */
  zSafeMove = ko.pureComputed(() => {
    if (this.zOrigin() === "Top")
      return parseFloat(this.clearance());
    else
      return parseFloat(this.thickness()) + parseFloat(this.clearance());
  });
  
  /**
   * The little picture at the top of the card
   * @member {observable.<SVGElement>}
   */
  #materialSVG = ko.observable();

  /**
   * @param {UnitConverter} unitConverter the UnitConverter to use
   */
  constructor(unitConverter) {
    super(unitConverter);

    unitConverter.add(this.thickness, "thickness");
    this.thickness.subscribe(
      () => {
        document.dispatchEvent(new Event("UPDATE_GCODE"));
        document.dispatchEvent(new Event("PROJECT_CHANGED"));
      });

    unitConverter.add(this.clearance, "clearance");
    this.clearance.subscribe(
      () => {
        document.dispatchEvent(new Event("UPDATE_GCODE"));
        document.dispatchEvent(new Event("PROJECT_CHANGED"));
      });

    this.zOrigin.subscribe(
      () => {
        document.dispatchEvent(new Event("UPDATE_GCODE"));
        document.dispatchEvent(new Event("PROJECT_CHANGED"));
      });

    // Set some text in the SVG
    function setText(id, text) {
      const el = document.getElementById(id);
      if (el)
        el.firstChild.textContent = text;
    }

    this.topZ.subscribe(newValue => setText("matTopZ", newValue));
    this.unitConverter.add(this.topZ);
    this.botZ.subscribe(newValue => setText("matBotZ", formatZ(newValue)));
    this.unitConverter.add(this.botZ);
    this.zSafeMove.subscribe(newValue =>
      setText("matZSafeMove", formatZ(newValue)));
    this.unitConverter.add(this.zSafeMove);

    this.#materialSVG.subscribe(newValue => {
      setText("matTopZ", formatZ(this.topZ()));
      setText("matBotZ", formatZ(this.botZ()));
      setText("matZSafeMove", formatZ(this.zSafeMove()));
    });

    const svg = document.getElementById("MaterialSVG");
    fetch("images/Material.svg")
    .then(response => response.text())
    .then(content => Promise.resolve(SVG.importFromText(content)))
    .then(dom => { svg.replaceWith(dom); this.#materialSVG(dom); });

    const el = document.getElementById("MaterialView");
    ko.applyBindings(this, el);
    this.addPopovers(el);
  }

  /**
   * @override
   */
  reset() {
    this.thickness(
      this.unitConverter.fromUnits(DEFAULT.THICKNESS, "mm"));
    this.clearance(
      this.unitConverter.fromUnits(DEFAULT.CLEARANCE, "mm"));
    this.zOrigin("Top");
  }

  /**
   * @override
   */
  jsonFieldName() { return "operations"; }

  /**
   * @override
   */
  toJson() {
    return {
      thickness: this.thickness(),
      zOrigin: this.zOrigin(),
      clearance: this.clearance()
    };
  };

  /**
   * @override
   */
  fromJson(json) {
    this.updateObservable(json, 'thickness');
    this.updateObservable(json, 'zOrigin');
    this.updateObservable(json, 'clearance');
  };
}


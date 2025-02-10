/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

// import "knockout";
/* global ko */

/* global App */

import { ViewModel } from "./ViewModel.js";
import { loadSVGFromText } from "./SVG.js";

const DEFAULT_THICKNESS = 10; //mm
const DEFAULT_CLEARANCE = 10; //mm

const POPOVERS = [
  { id:"inputMatThickness" },
  { id:"selectMatZOrigin" },
  { id:"inputMatClearance" }
];

function formatZ(z) {
  return parseFloat(z).toFixed(3);
}

export class MaterialViewModel extends ViewModel {

  /**
   * @param {UnitConverter} unitConverter the UnitConverter to use
   */
  constructor(unitConverter) {
    super(unitConverter);

    /**
     * Path thickness
     * @member {observable.<number>}
     */
    this.thickness = ko.observable(
      unitConverter.fromUnits(DEFAULT_THICKNESS, "mm"));
    unitConverter.add(this.thickness);
    this.thickness.subscribe(
      () => {
        document.dispatchEvent(new Event("UPDATE_GCODE"));
        document.dispatchEvent(new Event("PROJECT_CHANGED"));
      });

    /**
     * Tool clearance level
     * @member {observable.<number>}
     */
    this.clearance = ko.observable(
      unitConverter.fromUnits(DEFAULT_CLEARANCE, "mm"));
    unitConverter.add(this.clearance);
    this.clearance.subscribe(
      () => {
        document.dispatchEvent(new Event("UPDATE_TOOL_PATHS"));
        document.dispatchEvent(new Event("PROJECT_CHANGED"));
      });

    /**
     * Z origin, Top or Bottom of the material
     * @member {observable.<string>}
     */
    this.zOrigin = ko.observable("Top");
    this.zOrigin.subscribe(
      () => {
        document.dispatchEvent(new Event("UPDATE_GCODE"));
        document.dispatchEvent(new Event("PROJECT_CHANGED"));
      });

    /**
     * Z level for Z origin, computed
     * @member {observable.<number>}
     */
    this.topZ = ko.computed(() => {
      if (this.zOrigin() === "Top")
        return 0;
      else
        return this.thickness();
    });

    // Set some text in the SVG
    function setText(id, text) {
      const el = document.getElementById(id);
      if (el)
        el.firstChild.textContent = text;
    }

    unitConverter.addComputed(this.topZ);
    // Subscribe to range values to update the SVG picture
    this.topZ.subscribe(newValue => setText("matTopZ", newValue));

    /**
     * Z level for bottom of material, computed
     * @member {observable.<number>}
     */
    this.botZ = ko.computed(() => {
      if (this.zOrigin() === "Bottom")
        return 0;
      else
        return -this.thickness();
    });
    unitConverter.addComputed(this.botZ);
    this.botZ.subscribe(newValue => setText("matBotZ", formatZ(newValue)));

    /**
     * Safe level, computed
     * @member {observable.<number>}
     */
    this.zSafeMove = ko.computed(() => {
      if (this.zOrigin() === "Top")
        return parseFloat(this.clearance());
      else
        return parseFloat(this.thickness()) + parseFloat(this.clearance());
    });
    unitConverter.addComputed(this.zSafeMove);
    this.zSafeMove.subscribe(newValue =>
      setText("matZSafeMove", formatZ(newValue)));

    /**
     * The little picture at the top of the card
     * @member {observable.<SVGElement>}
     */
    this.materialSvg = ko.observable();
    this.materialSvg.subscribe(newValue => {
      setText("matTopZ", formatZ(this.topZ()));
      setText("matBotZ", formatZ(this.botZ()));
      setText("matZSafeMove", formatZ(this.zSafeMove()));
    });

    const svg = document.getElementById("MaterialSvg");
    fetch("images/Material.svg")
    .then(response => response.text())
    .then(content => Promise.resolve(loadSVGFromText(content)))
    .then(dom => { svg.replaceWith(dom); this.materialSvg(dom); });
  }

  /**
   * @override
   */
  initialise() {
    this.addPopovers(POPOVERS);

    ko.applyBindings(this, document.getElementById("MaterialView"));
  }

  /**
   * @override
   */
  reset() {
    this.thickness(
      this.unitConverter.fromUnits(DEFAULT_THICKNESS, "mm"));
    this.clearance(
      this.unitConverter.fromUnits(DEFAULT_CLEARANCE, "mm"));
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


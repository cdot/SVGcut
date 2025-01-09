/*Copyright Tim Fleming, Crawford Currie 2014-2024. This file is part of SVG2Gcode, see the copyright and LICENSE at the root of the distribution. */

// import "knockout";
/* global ko */

// import "snapsvg"
/* global Snap */

import { ViewModel } from "./ViewModel.js";

const popovers = [
  { id:"inputMatClearance" }
];

function formatZ(z) {
  return parseFloat(z).toFixed(3);
}

class MaterialViewModel extends ViewModel {

  /**
   * @param {UnitConverter} unitConverter the UnitConverter to use
   */
  constructor(unitConverter) {
    super(unitConverter);

    /**
     * Path thickness
     * @member {observable.<number>}
     */
    this.thickness = ko.observable(unitConverter.fromUnits(10, "mm"));
    unitConverter.add(this.thickness);

    /**
     * Tool clearance level
     * @member {observable.<number>}
     */
    this.clearance = ko.observable(unitConverter.fromUnits(10, "mm"));
    unitConverter.add(this.clearance);

    /**
     * Z origin, Top or Bottom of the material
     * @member {observable.<string>}
     */
    this.zOrigin = ko.observable("Top");

    /**
     * Z level for Z origin, computed
     * @member {observable.<number>}
     */
    this.topZ = ko.computed(() => {
      if (this.zOrigin() == "Top")
        return 0;
      else
        return this.thickness();
    });
    unitConverter.addComputed(this.topZ);
    // Subscribe to range values to update the SVG picture
    this.topZ.subscribe(newValue => {
      if (this.materialSvg()) {
        this.materialSvg().select("#matTopZ").node.textContent
        = formatZ(newValue);
      }
    });

    /**
     * Z level for bottom of material, computed
     * @member {observable.<number>}
     */
    this.botZ = ko.computed(() => {
      if (this.zOrigin() == "Bottom")
        return 0;
      else
        return "-" + this.thickness();
    });
    unitConverter.addComputed(this.botZ);
    this.botZ.subscribe(newValue => {
      if (this.materialSvg()) {
        this.materialSvg().select("#matBotZ").node.textContent
        = formatZ(newValue);
      }
    });

    /**
     * Safe level, computed
     * @member {observable.<number>}
     */
    this.zSafeMove = ko.computed(() => {
      if (this.zOrigin() == "Top")
        return parseFloat(this.clearance());
      else
        return parseFloat(this.thickness()) + parseFloat(this.clearance());
    });
    unitConverter.addComputed(this.zSafeMove);
    this.zSafeMove.subscribe(newValue => {
      if (this.materialSvg()) {
        this.materialSvg().select("#matZSafeMove").node.textContent
        = formatZ(newValue);
      }
    });

    /**
     * The little picture at the top of the card
     * @member {observable.<SnapElement>}
     */
    this.materialSvg = ko.observable(null);
    this.materialSvg.subscribe(newValue => {
      newValue.select("#matTopZ").node.textContent = formatZ(this.topZ());
      newValue.select("#matBotZ").node.textContent = formatZ(this.botZ());
      newValue.select("#matZSafeMove").node.textContent
      = formatZ(this.zSafeMove());
    });

    const materialSvg = Snap("#MaterialSvg");
    Snap.load("images/Material.svg", f => {
      // f is a Snap.Fragment
      materialSvg.append(f);
      this.materialSvg(materialSvg);
    });
  }

  // @override
  initialise() {
    this.addPopovers(popovers);

    ko.applyBindings(this, document.getElementById("MaterialView"));
  }

  // @override
  jsonFieldName() { return "operations"; }

  // @override
  toJson() {
    return {
      thickness: this.thickness(),
      zOrigin: this.zOrigin(),
      clearance: this.clearance()
    };
  };

  // @override
  fromJson(json) {
    this.updateObservable(json, 'thickness');
    this.updateObservable(json, 'zOrigin');
    this.updateObservable(json, 'clearance');
  };
}

export { MaterialViewModel }

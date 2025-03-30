/*Copyright Todd Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */
//import "knockout";
/* global ko */

/* global App */

import { ViewModel } from "./ViewModel.js";
import { CutPaths } from "./CutPaths.js";
import { TabViewModel } from "./TabViewModel.js";
import { DEFAULT, MIN } from "./Constants.js";

/**
 * View model for (holding) Tabs pane.
 * @extends ViewModel
 */
export class TabsViewModel extends ViewModel {

  /**
   * List of tabs.
   * @member {observableArray.<TabViewModel>}
   */
  tabs = ko.observableArray();

  /**
   * Maximum depth operations may cut to when they pass over tabs.
   * @member {observable.<number>}
   */
  maxCutDepth = this.limited("TAB_CUT_DEPTH");

  /**
   * @param {UnitConverter} unitConverter the UnitConverter to use
   */
  constructor(unitConverter) {
    super(unitConverter);

    unitConverter.add(this.maxCutDepth, "maxCutDepth");
    this.maxCutDepth.subscribe(() => {
      document.dispatchEvent(new Event("UPDATE_GCODE"));
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
    });
  }

  /**
   * @override
   */
  bind() {
    super.bind("TabsView");
  }

  /**
   * Invoked from #TabsViewPane
   */
  addTab() {
    // Get integer paths from the current selection
    const operands = App.models.Selection.getSelectedPaths()
          .filter(p => p.isClosed);
    if (operands.length === 0) {
      App.showAlert("tabsMustBeClosed", "alert-error");
      return;
    }
    const tab = new TabViewModel(this.unitConverter, operands);
    tab.recombine();
    this.tabs.push(tab);

    document.dispatchEvent(new Event("PROJECT_CHANGED"));
    document.dispatchEvent(new Event("UPDATE_GCODE"));
  };

  /**
   * Remove a tab. Invoked from #TabsView
   */
  removeTab(tab) {
    tab.removeCombinedGeometry();
    this.tabs.remove(tab);
    document.dispatchEvent(new Event("UPDATE_GCODE"));
  };

  /**
   * @override
   */
  reset() {
    for (const tab of this.tabs())
      tab.removeCombinedGeometry();
    this.tabs.removeAll();
    this.maxCutDepth(App.models.Material.thickness() / 2);
  }

  /**
   * @override
   */
  jsonFieldName() { return "tabs"; }

  /**
   * @override
   */
  toJson(template) {
    const json = {
      maxCutDepth: this.maxCutDepth()
    };
    if (!template)
      json.tabs = this.tabs().map(tab => tab.toJson());
    return json;
  }

  /**
   * @override
   */
  fromJson(json) {
    this.updateObservable(json, 'maxCutDepth');
    if (json.tabs)
      for (const tabJson of json.tabs) {
        const paths = CutPaths.fromJson(tabJson.tabPaths);
        const tab = new TabViewModel(this.unitConverter, paths);
        tab.fromJson(tabJson);
        this.tabs.push(tab);
        // No need to tab.recombine(), it's already in the json
      }
  };
}


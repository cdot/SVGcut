//import "knockout";
/* global ko */

//import "snapsvg";
/* global Snap */

/* global App */

import { ViewModel } from "./ViewModel.js";
import { TabViewModel } from "./TabViewModel.js";

class TabsViewModel extends ViewModel {

  /**
   * @param {UnitConverter} unitConverter the UnitConverter to use
   */
  constructor(unitConverter) {
    super();
    this.tabs = ko.observableArray();

    this.maxCutDepth = ko.observable(0);
    unitConverter.add(this.maxCutDepth);
    this.maxCutDepth.subscribe(() =>
      document.dispatchEvent(new Event("toolPathsChanged")));

    this.units.subscribe(newValue => {
      const factor = (newValue == "inch") ? 1 / 25.4 : 25.4;
      for (const tab of this.tabs())
        tab.margin(tab.margin() * factor);
    });
  }

  // @override
  initialise() {
    this.addPopovers([{ id: "tabsMaxCutDepth" } ]);
    ko.applyBindings(this, document.getElementById("TabsView"));
  }

  addTab() {
    const rawPaths = [];

    App.models.Selection.getSelection().forEach(element => {
      rawPaths.push({
        'path': Snap.parsePathString(element.attr('d')),
        'nonzero': element.attr("fill-rule") != "evenodd"
      });
    });
    App.models.Selection.clearSelection();

    const tab = new TabViewModel(rawPaths, false);
    this.tabs.push(tab);

    document.dispatchEvent(new Event("toolPathsChanged"));
  };

  removeTab(tab) {
    tab.removeCombinedGeometrySvg();
    this.tabs.remove(tab);

    document.dispatchEvent(new Event("toolPathsChanged"));
  };

  // @override
  get jsonFieldName() { return "tabs"; }

  // @override
  toJson() {
    return {
      maxCutDepth: this.maxCutDepth(),
      tabs: this.tabs.map(tab => tab.toJson())
    };
  };

  // @override
  fromJson(json) {
    this.updateObservable(json, 'units');
    this.updateObservable(json, 'maxCutDepth');

    for (const tab of this.tabs())
      tab.removeCombinedGeometrySvg();

    this.tabs.removeAll();

    if (json.tabs)
      for (const tabJson of json.tabs) {
        const tab = new TabViewModel([], true);
        tab.fromJson(tabJson);
        this.tabs.push(tab);
      }
  };
}

export { TabsViewModel }

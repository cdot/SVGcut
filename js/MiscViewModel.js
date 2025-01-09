/*Copyright Tim Fleming, Crawford Currie 2014-2024. This file is part of SVG2Gcode, see the copyright and LICENSE at the root of the distribution. */

//import "file-saver"
/* global saveAs */

//import "knockout";
/* global ko */

/* global App */

/**
 * @typedef {('mm'|'inch')} Unit
 */

import { UnitConverter } from "./UnitConverter.js";
import { ViewModel } from "./ViewModel.js";

// Name of a key in browser LocalStorage that can store many sets of settings
const LOCAL_STORAGE_AREA = "svg2gcode";
// Name of a default key within the LOCAL_STORAGE_AREA
const SETTINGS_KEY = "default";

// Default name for a filename to store settings
const SETTINGS_FILENAME = "svg2gcode.json";

class MiscViewModel extends ViewModel {

  constructor() {
    super();

    /**
     * Units in use e.g. "mm". The Tool model has the units used by
     * everything other than the Gcode converter.
     * @member {observable.<Unit>}
     */
    this.units = ko.observable("mm");

    /**
     * Unit converter in the tool model. Shared by everything else.
     */
    this.unitConverter = new UnitConverter(this.units);

    /**
     * "Filename" to load/save settings.
     * @member {observable.<string>}
     */
    this.settingsFilename = ko.observable(SETTINGS_FILENAME);

    /**
     * Local storage key to load/save settings.
     * @member {observable.<string>}
     */
    this.settingsKey = ko.observable(SETTINGS_KEY);

    /**
     * Dropdown for local storage keys to load settings from.
     * @member {observable.<string>}
     */
    this.browserSettings = ko.observableArray([]);

    // SMELL: the following should be part of GcodeGeneration, but are
    // only relevant to calls out to CPP
    //CPP this.loadedCamCpp = ko.observable(false);
    //CPP this.camCppError = ko.observable("");
    //CPP this.debugArg0 = ko.observable(0);
    //CPP this.debugArg1 = ko.observable(0);
  }

  // @override
  initialise() {
    ko.applyBindings(
      this,
      document.getElementById("SaveSettingsModal"));

    ko.applyBindings(
      this,
      document.getElementById("LoadSettingsFromBrowserModal"));

    ko.applyBindings(
      this,
      document.getElementById("DeleteSettingsFromBrowserModal"));
  }

  /**
   * Support for storing settings in the browser local storage
   */
  checkBrowserForSettings() {
    const settings = localStorage.getItem(LOCAL_STORAGE_AREA);
    if (settings) {
      this.browserSettings(Object.keys(JSON.parse(settings)));
      return "";
    } else
      return "No settings stored locally yet.";
  }

  /**
   * Invoked from dialog
   */
  saveSettingsInBrowser() {
    let settings = JSON.parse(localStorage.getItem(LOCAL_STORAGE_AREA)) ?? {};
    const fn = this.settingsKey();
    settings[fn] = App.toJson();
    localStorage.setItem(LOCAL_STORAGE_AREA, JSON.stringify(settings));
    this.hideModal('SaveSettingsModal');
  }

  /**
   * Invoked from dialog
   */
  saveSettingsInLocalFile() {
    const json = JSON.stringify(App.toJson());
    const blob = new Blob([json], {type: 'text/json'});
    const fn = this.settingsFilename();
    saveAs(blob, fn);
    this.hideModal('SaveSettingsModal');
  }

  /**
   * Invoked from dialog and on preload
   */
  loadSettingsFromBrowser() {
    this.hideModal('LoadSettingsFromBrowserModal');
    const settings = JSON.parse(localStorage.getItem(LOCAL_STORAGE_AREA));
    if (settings) {
      const json = settings[this.settingsKey()];
      App.fromJson(json);
    }
  }

  /**
   * Invoked from dialog
   */
  gotoBrowserDelete() {
    App.hideModal('LoadSettingsFromBrowserModal');
    App.showModal('DeleteSettingsFromBrowserModal');
  }

  /**
   * Invoked from dialog
   */
  deleteSettingsFromBrowser() {
    debugger;
    const settings = JSON.parse(localStorage.getItem(LOCAL_STORAGE_AREA));
    const name = this.settingsKey();
    delete settings[name];
    localStorage.setItem(LOCAL_STORAGE_AREA, JSON.stringify(settings));
    this.hideModal('DeleteSettingsFromBrowserModal');
    alert(`Deleted "${name}" from browser`, "alert-info");
  }

  // @override
  jsonFieldName() { return 'misc'; }

  // @override
  toJson() {
    return {
      units: this.units(),
      settingsFilename: this.settingsFilename(),
      settingsKey: this.settingsKey()
    };
  }

  // @override
  fromJson(json) {
    this.updateObservable(json, 'units');
    this.updateObservable(json, 'settingsFilename');
    this.updateObservable(json, 'settingsKey');
  }
}

export { MiscViewModel }

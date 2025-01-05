//import "file-saver"
/* global saveAs */

//import "knockout";
/* global ko */

/* global JSCut */
import { ViewModel } from "./ViewModel.js";

class MiscViewModel extends ViewModel {

  constructor() {
    super();
    this.debug = ko.observable(JSCut.options.debug);
    this.saveSettingsFilename = ko.observable("settings.jscut");
    this.loadLocalStorageFilename = ko.observable("settings.jscut");
    this.localStorageSettings = ko.observableArray([]);
    // SMELL: the following should be part of GcodeConversion, but are
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
      document.getElementById("save-settings-modal"));

    ko.applyBindings(
      this,
      document.getElementById("load-local-storage-settings-modal"));

    ko.applyBindings(
      this,
      document.getElementById("delete-local-storage-settings-modal"));
  }

  /**
   * Support for storing settings in the browser local storage
   */
  checkLocalStorageForSettings() {
    const settings = localStorage.getItem("settings");
    if (settings) {
      this.localStorageSettings(Object.keys(JSON.parse(settings)));
      return "";
    } else
      return "No settings stored locally yet.";
  }

  saveSettingsInLocalStorage() {
    let settings = JSON.parse(localStorage.getItem("settings")) ?? {};
    const fn = this.saveSettingsFilename();
    settings[fn] = JSCut.toJson();
    localStorage.setItem("settings", JSON.stringify(settings));
    this.hideModal('save-settings-modal');
    alert(`Settings saved in browser as '${fn}'`);
  }

  saveSettingsInLocalFile() {
    const json = JSON.stringify(JSCut.toJson());
    const blob = new Blob([json], {type: 'text/json'});
    const fn = this.saveSettingsFilename();
    saveAs(blob, fn);
    this.hideModal('save-settings-modal');
    alert(`Settings saved in file '${fn}'`);
  }

  loadSettingsFromLocalStorage() {
    const settings = JSON.parse(localStorage.getItem("settings"));
    const json = settings[this.models.Misc.loadLocalStorageFilename()];
    JSCut.fromJson(json);
    JSCut.updateSvgSize();
    this.hideModal('load-local-storage-settings-modal');
  }

  deleteSettingsFromLocalStorage() {
    const settings = JSON.parse(localStorage.getItem("settings"));
    const name = this.loadLocalStorageFilename();
    delete settings[name];
    localStorage.setItem("settings", JSON.stringify(settings));
    this.hideModal('delete-local-storage-settings-modal');
    alert(
      `Deleted "${name}" from browser local storage`, "alert-info");
  }

  // @override
  get jsonFieldName() { return 'misc'; }
}

export { MiscViewModel }

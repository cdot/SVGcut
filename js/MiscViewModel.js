/*Copyright Crawford Currie 2024-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

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

// Name of a key in browser LocalStorage that can store many projects
const LOCAL_PROJECTS_AREA = "svgcut";

// Default name for a project
const DEFAULT_PROJECT_NAME = "default";

const POPOVERS = [
  { id: "selectProject" }
];

/**
 * View model that handles miscellaneous UI features; specifically:
 * + Global units
 * + Loading and saving projects
 * + The toolbar
 */
class MiscViewModel extends ViewModel {

  constructor() {
    super();

    /**
     * Units in use e.g. "mm". The Tool model has the units used by
     * everything other than the Gcode converter.
     * @member {observable.<Unit>}
     */
    this.units = ko.observable("mm");
    this.units.subscribe(nu => {
     document.getElementById("pickedUnits").innerText = nu;
    });

    /**
     * Unit converter in the tool model. Shared by everything else.
     */
    this.unitConverter = new UnitConverter(this.units);

    /**
     * Local storage key / file basename to load/save project.
     8 When the App starts up it will try to load this project.
     * @member {observable.<string>}
     */
    this.projectName = ko.observable(DEFAULT_PROJECT_NAME);

    /**
     * Whether to save just a template, or a whole project
     * @member {observable.<boolean>}
     */
    this.templateOnly = ko.observable(false);

    /**
     * Dropdown for local storage keys to load projects from.
     * @member {observable.<string>}
     */
    this.browserProjects = ko.observableArray([]);

    // SMELL: the following are only relevant to calls out to CPP
    //CPP this.loadedCamCpp = ko.observable(false);
    //CPP this.camCppError = ko.observable("");
    //CPP this.debugArg0 = ko.observable(0);
    //CPP this.debugArg1 = ko.observable(0);
  }

  /**
   * @override
   */
  initialise() {
    ko.applyBindings(
      this,
      document.getElementById("NavBar"));

    ko.applyBindings(
      this,
      document.getElementById("SaveProjectModal"));

    ko.applyBindings(
      this,
      document.getElementById("LoadProjectFromBrowserModal"));

    ko.applyBindings(
      this,
      document.getElementById("DeleteProjectFromBrowserModal"));

    // Handler for loading a project from disc when a file is chosen
    // in the browser
    document.getElementById('chosenProjectFile')
    .addEventListener("change", event => {
      this.addPopovers(POPOVERS);

      const files = event.target.files;
      for (const file of files) {
        //console.log(file);
        const lert = App.showAlert("loadingProject", "alert-info", file.name);
        const reader = new FileReader();
        reader.addEventListener("load", e => {
          App.loadSaveable(JSON.parse(e.target.result));
          lert.remove();
          App.showAlert("loadedProject", "alert-success", file.name);
        });
        reader.addEventListener("abort", () => {
          lert.remove();
          App.showAlert("projectLoadAbort", "alert-danger", file.name);
        });
        reader.addEventListener("error", e => {
          console.error(e);
          lert.remove();
          App.showAlert("projectLoadError", "alert-danger", file.name);
        });
        reader.readAsText(file);
      }
    });
  }

  /**
   * Support for storing projects in the browser local storage.
   * Get a list of projects already there.
   * Invoked from #LoadProjectFromBrowserModal.
   */
  getBrowserProjectsList() {
    const json = localStorage.getItem(LOCAL_PROJECTS_AREA);
    if (json) {
      this.browserProjects(Object.keys(JSON.parse(json)));
      return "";
    } else
      return "No projects found in the browser.";
  }

  /**
   * Save the project in the browser local storage. If the selected
   * project name is DEFAULT_PROJECT_NAME, will only save a template.
   * Invoked from #SaveProjectModal.
   */
  saveProjectInBrowser() {
    App.hideModals();
    let json = JSON.parse(localStorage.getItem(LOCAL_PROJECTS_AREA)) ?? {};
    const name = this.projectName();
    json[name] = App.getSaveable(
      this.templateOnly() || name === DEFAULT_PROJECT_NAME);
    localStorage.setItem(LOCAL_PROJECTS_AREA, JSON.stringify(json, null, " "));
    App.showAlert("projectSavedInBrowser", "alert-info", name);
  }

  /**
   * Save the project in a file.
   * Invoked from #SaveProjectModal.
   */
  saveProjectInFile() {
    App.hideModals();

    const json = JSON.stringify(App.getSaveable(this.templateOnly()));
    const blob = new Blob([ json ], { type: 'text/json' });
    const fn = `${this.projectName()}.json`;
    // No way to get a status report back, we just have to hope
    saveAs(blob, fn);
  }

  /**
   * Load a project from the browser local storage.
   * Invoked from #LoadProjectFromBrowserModal and from App.js
   * on preload.
   */
  loadProjectFromBrowser() {
    App.hideModals();

    const projects = JSON.parse(localStorage.getItem(LOCAL_PROJECTS_AREA));
    const name = this.projectName();
    if (projects) {
      const json = projects[name];
      if (json) {
        App.loadSaveable(json);
        return;
      }
    }
    if (name !== DEFAULT_PROJECT_NAME)
      App.showAlert("projectNotInBrowser", "alert-danger", name);
  }

  /**
   * Invoked from #LoadProjectFromBrowserModal when the delete
   * button is pressed. Switches into the #DeleteProjectFromBrowserModal.
   */
  gotoDeleteBrowserProject() {
    App.hideModals();
    App.showModal(`DeleteProjectFromBrowserModal`);
  }

  /**
   * Delete the chosen projects from browser local storage.
   * Invoked from #DeleteProjectFromBrowserModal.
   */
  deleteProjectFromBrowser() {
    App.hideModals();

    const json = JSON.parse(localStorage.getItem(LOCAL_PROJECTS_AREA));
    const name = this.projectName();
    delete json[name];
    localStorage.setItem(LOCAL_PROJECTS_AREA, JSON.stringify(json));
    alert(`Deleted project "${name}" from the browser`, "alert-info");
  }

  /**
   * @override
   */
  jsonFieldName() { return 'misc'; }

  /**
   * @override
   */
  toJson() {
    return {
      units: this.units(),
      projectName: this.projectName()
    };
  }

  /**
   * @override
   */
  fromJson(json) {
    this.updateObservable(json, 'units');
    this.updateObservable(json, 'projectName');
  }
}

export { MiscViewModel }

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
import * as SVG from "./SVG.js";

const POPOVERS = [
  { id: "SelectProject" }
];

/**
 * Name of a key in browser LocalStorage that can store
 * many projects
 */
const LOCAL_PROJECTS_AREA = "svgcut";

/**
 * Special project where defaults are saved in the browser
 */
const DEFAULTS_PROJECT = "defaults";

/**
 * View model that handles projects
 * @extends ViewModel
 */
export class ProjectViewModel extends ViewModel {

  /**
   * Units in use e.g. "mm". The Tool model has the units used by
   * everything other than the Gcode converter.
   * @member {observable.<Unit>}
   */
  units = ko.observable("mm");

  /**
   * Unit converter in the tool model. Shared by everything else.
   */
  unitConverter = undefined;

  /**
   * Local storage key / file basename to load/save project.
   * When the App starts up it will try to load this project.
   * @member {observable.<string>}
   */
  projectName = ko.observable(
    document.getElementById("ProjectName").textContent);

  /**
   * When loading from the browser, the projectName is selected from
   * a dropdown. If we link that dropdown to projectName, then
   * initialisation cabbages the value. So we have to use a different
   * observable for the dropdown values.
   */
  selectedProject = ko.observable();

  /**
   * True if one of the parameters saved with the project has changed
   * since the last save.
   * @member {observable.<boolean>}
   */
  projectChanged = ko.observable(false);

  /**
   * Whether to save just a template, or a whole project
   * @member {observable.<boolean>}
   */
  templateOnly = ko.observable(false);

  /**
   * Dropdown for local storage keys to load projects from.
   * @member {observable.<string>}
   */
  browserProjects = ko.observableArray([]);

  constructor() {
    super();

    this.units.subscribe(nu => {
      document.getElementById("PickedUnits").innerText = nu;
    });
    this.unitConverter = new UnitConverter(this.units);

    this.projectChanged.subscribe(v => {
      if (v) {
        for (const el of document.querySelectorAll(".change-activated"))
          el.classList.remove("disabled");
      } else {
        for (const el of document.querySelectorAll(".change-activated"))
          el.classList.add("disabled");
      }
    });

    // Handler for loading a project from disc when a file is chosen
    // in the browser
    document.getElementById("ChooseProjectFile")
    .addEventListener("click", () =>
      document.getElementById("ChosenProjectFile").click());
    document.getElementById("ChosenProjectFile")
    .addEventListener("change", event => {
      const file = event.target.files[0];
      this.#confirmDataLoss(() => {
        const lert = App.showAlert("loadingProject", "alert-info", file.name);
        const reader = new FileReader();
        reader.addEventListener("load", e => {
          App.loadSaveable(JSON.parse(e.target.result));
          this.projectChanged(false);
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
      });
    });

    document.getElementById('ChooseImportSVGFile')
    .addEventListener("click", event =>
      document.getElementById('ChosenImportSVGFile').click());
    document.getElementById('ChosenImportSVGFile')
    .addEventListener("change", event => {
      // Import an SVG file

      const files = event.target.files;
      for (const file of files) {
        const lert = App.showAlert("loadingSVG", "alert-info", file.name);
        const reader = new FileReader();
        reader.addEventListener("load", e => {
          const svgEl = SVG.importFromText(e.target.result);
          document.getElementById("ContentSVGGroup").append(svgEl);
          App.fitSVG();
          lert.remove();
          document.dispatchEvent(new Event("PROJECT_CHANGED"));
          App.showAlert("loadedSVG", "alert-success", file.name);
          App.tutorial(2);
        });
        reader.addEventListener("abort", e => {
          lert.remove();
          App.showAlert("svgLoadAbort", "alert-danger", file.name);
        });
        reader.addEventListener("error", e => {
          lert.remove();
          console.error(e);
          App.showAlert("svgLoadError", "alert-danger");
        });
        reader.readAsText(file);
      }
    });

    document.addEventListener(
      "PROJECT_CHANGED", () => this.projectChanged(true));
  }

  /**
   * @override
   */
  bind() {
    for (const id of [ "ProjectView", "Toolbar", "SaveProjectModal",
                       "LoadProjectFromBrowserModal",
                       "DeleteProjectFromBrowserModal",
                       "ConfirmDataLossModal", "Messages" ])
      super.bind(id);
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
   * project name is DEFAULTS_PROJECT, will only save a template.
   * Invoked from #SaveProjectModal.
   */
  saveProjectInBrowser() {
    App.hideModals();
    let json = JSON.parse(localStorage.getItem(LOCAL_PROJECTS_AREA)) ?? {};
    const name = this.projectName();
    json[name] = App.getSaveable(
      this.templateOnly() || name === DEFAULTS_PROJECT);
    localStorage.setItem(LOCAL_PROJECTS_AREA, JSON.stringify(json, null, 1));
    this.projectChanged(false);
    App.showAlert("projectSavedInBrowser", "alert-info", name);
    this.getBrowserProjectsList();
  }

  /**
   * Save the project in a file.
   * Invoked from #SaveProjectModal.
   */
  saveProjectInFile() {
    App.hideModals();

    const json = JSON.stringify(App.getSaveable(this.templateOnly()), null, 1);
    const blob = new Blob([ json ], { type: 'text/json' });
    const filename = `${this.projectName()}.svgcut`;
    // No way to get a status report back, we just have to hope
    saveAs(blob, filename);
    this.projectChanged(false);
  }

  /**
   * Try to load the defaults project. Invoked from SVGcut when the
   * simulation is ready.
   */
  loadDefaults() {
    if (this.#importProject(DEFAULTS_PROJECT)) {
      //console.debug(`Loaded "${DEFAULTS_PROJECT}" from browser`);
    }
    this.projectChanged(false);
  }

  /**
   * Load a project from the browser local storage.
   * Invoked from #LoadProjectFromBrowserModal.
   * @return {boolean} true if a project was loaded
   */
  loadProjectFromBrowser() {
    App.hideModals();
    const name = this.selectedProject();
    if (!this.#importProject(name))
      App.showAlert("projectNotInBrowser", "alert-danger", name);
  }

  /**
   * Try to import a project from the browser storage.
   * @param {string} name name of the project to import
   * @return {boolean} true if the project was imported
   */
  #importProject(name) {
    const projects = JSON.parse(localStorage.getItem(LOCAL_PROJECTS_AREA));

    if (!projects || !projects[name])
      return false;

    const json = projects[name];
    if (json) {
      App.loadSaveable(json);
      this.projectChanged(false);
      return true;
    }

    return false;
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
    localStorage.setItem(LOCAL_PROJECTS_AREA, JSON.stringify(json, null, 1));
    alert(`Deleted project "${name}" from the browser`, "alert-info");
  }

  /**
   * True if there is gcode associated with the project.
   */
  haveGcode() {
    return App.models.GcodeGeneration.haveGcode();
  }

  /**
   * Invoked from the UI to create a new project.
   */
  newProject() {
    this.#confirmDataLoss(() => {
      App.emptySVG();
      for (const model of Object.keys(App.models))
        App.models[model].reset();
      this.projectName("New project");
      this.loadDefaults();
      //console.debug("Started new project");
    });
  }

  /**
   * Confirm that data loss is acceptable
   * @param {function} callback function to call if data loss is OK
   */
  #confirmDataLoss(callback) {
    if (this.projectChanged()) {
      this.dataLossCallback = callback;
      App.showModal('ConfirmDataLossModal');
    } else
      callback();
  }

  /**
   * Called from the UI modal to confirm data loss.
   */
  dataLossConfirmed() {
    App.hideModals();
    this.dataLossCallback();
  }

  /**
   * Called from the UI modal to reject data loss.
   */
  dataLossRejected() {
    App.hideModals();
  }

  /**
   * Support for storing gcode in local files.
   * Saves the gcode in a user-selected file.
   */
  saveGcodeInFile() {
    const gcode = App.models.GcodeGeneration.gcodeS();
    const blob = new Blob([gcode], {type: 'text/plain'});
    // No way to know what it was last saved as, so just guess
    // at <project name>.nc
    saveAs(blob, `${this.projectName()}.nc`);
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
    if (json.projectName && json.projectName !== DEFAULTS_PROJECT)
      this.updateObservable(json, 'projectName');
    else
      this.projectName("New project");
  }
}


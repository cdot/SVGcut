/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

// import "file-saver"
/* global saveAs */

// import "bootstrap"
/* global bootstrap */

import { ToolViewModel } from "./ToolViewModel.js";
import { OperationsViewModel } from "./OperationsViewModel.js";
import { GcodeGenerationViewModel } from "./GcodeGenerationViewModel.js";
import { TabsViewModel } from "./TabsViewModel.js";
import { MaterialViewModel } from "./MaterialViewModel.js";
import { SelectionViewModel } from "./SelectionViewModel.js";
import { CurveConversionViewModel } from "./CurveConversionViewModel.js";
import { MiscViewModel } from "./MiscViewModel.js";
import { Simulation } from "./Simulation.js";
import { Rect } from "./Rect.js";
import * as Gcode from "./Gcode.js";
import * as SVG from "./SVG.js";

/**
 * Singleton.
 * SVGcut makes extensive use of "knockout" to bind the various parts
 * of the UI together. You will need to understand the basics of
 * knockout to read this code.
 * @see {@link ../DEVELOPING.md}
 * @listens UPDATE_SIMULATION updates the simulation for new Gcode
 */
export class SVGcut {

  /**
   * Construct the SVGcut singleton. This is available throughout the code
   * via the global variable `App`.
   * @param {object} config currently unused, but might be needed again.
   */
  constructor(config) {

    /**
     * Enumeration for supported operations on polygons
     * @member {object.<name,string>}
     */
    this.PolyOps = {
      ConcentricPocket: 0,
      Engrave: 1,
      Inside: 2,
      Outside: 3,
      Perforate: 4,
      RasterPocket: 5
    };

    /**
     * Map from model name (e.g. "Operations") to the view model
     * for the relevant card. Note that all tool models share the Tool
     * UnitConverter except GcodeGenerationViewModel which has it's own,
     * specific to Gcode units.
     * @member {ViewModel[]}
     */
    this.models = {};

    /**
     * Simulation render path - there can be only one
     */
    this.renderPath = undefined;

    /**
     * The Element for the alert being used for the next tutorial step
     * @member {Element}
     * @private
     */
    this.tutorialAlert = undefined;

    /**
     * The index of the current tutorial step. -1 indicates
     * the step isn't currently shown.
     * @member {number}
     * @private
     */
    this.currentTutorialStep = -1;

    /**
     * Configuration options
     */
    this.options = config;

    // global reference to this singleton
    window.App = this;

    /**
     * The loaded SVG(s) drawing surface. This is given a default viewBox
     * of 0,0,500,500 before an SVG is loaded.
     * @member {Element}
     */
    this.mainSVG = document.getElementById("MainSvg");

    // Create the simulation canvas.
    this.simulation = new Simulation(
      "glShaders",
      document.getElementById("simulationCanvas"),
      document.getElementById('timeControl'));

    // Create view models.

    this.models.Misc = new MiscViewModel();
    const unitConverter = this.models.Misc.unitConverter;

    this.models.Tool = new ToolViewModel(unitConverter);
    this.models.Material = new MaterialViewModel(unitConverter);
    this.models.CurveConversion = new CurveConversionViewModel(unitConverter);
    this.models.Selection = new SelectionViewModel();
    this.models.Operations = new OperationsViewModel(unitConverter);
    this.models.Tabs = new TabsViewModel(unitConverter);
    this.models.GcodeGeneration = new GcodeGenerationViewModel();

    // bootstrap is a bit crap at submenus. If we want to close a menu
    // tree when an action is selected, we have to jump through some hoops.
    // Since our actions can be classified as "choose-file" or "open-modal"
    // we can use that to trigger a close.
    document
    .querySelectorAll(".dropdown-item>.choose-file,.dropdown-item>.open-modal")
    .forEach(el => el.addEventListener("click", () => {
      const nel = document.querySelectorAll(
        ".dropdown-toggle[data-toggle='collapse']");
      nel.forEach(e => bootstrap.Dropdown.getInstance(e).hide());
    }));

    // Import an SVG file
    document.getElementById('chosenImportSVGFile')
    .addEventListener("change", event => {

      const files = event.target.files;
      for (const file of files) {
        const lert = this.showAlert("loadingSVG", "alert-info", file.name);
        const reader = new FileReader();
        reader.addEventListener("load", e => {
          const svgEl = SVG.loadSVGFromText(e.target.result);
          document.getElementById("contentSVGGroup").append(svgEl);
          this.updateMainSvgSize();
          lert.remove();
          this.showAlert("loadedSVG", "alert-success", file.name);
          this.tutorial(2);
        });
        reader.addEventListener("abort", e => {
          lert.remove();
          this.showAlert("svgLoadAbort", "alert-danger", file.name);
        });
        reader.addEventListener("error", e => {
          lert.remove();
          console.error(e);
          this.showAlert("svgLoadError", "alert-danger");
        });
        reader.readAsText(file);
      }
    });

    this.addSVGEventHandlers();

    window.addEventListener("resize", () => {
      this.updateMainSvgSize();
      this.updateSimulationCanvasSize();
    });

    document.addEventListener("UPDATE_SIMULATION", () => {
      // Set the simulation path from the Gcode
      const uc = this.models.GcodeGeneration.unitConverter;
      const topZ = this.models.Material.topZ.toUnits(uc.units());
      const diam = this.models.Tool.diameter.toUnits(uc.units());
      const ang = this.models.Tool.angle();
      const cutterH = uc.fromUnits(1, "mm");
      const toolPath = Gcode.parse(this.models.GcodeGeneration.gcode());
      this.simulation.setPath(toolPath, topZ, diam, ang, cutterH);
    });

    // Try and load default project
    this.models.Misc.loadProjectFromBrowser();

    // Complete UI initialisation of the view models
    for (const m in this.models)
      this.models[m].initialise();
  }

  /**
   * Finish initialisation, start the simulation animation.
   * @return {Promise} promise that resolves to undefined
   */
  start() {
    this.updateMainSvgSize();
    this.updateSimulationCanvasSize();

    this.tutorial(1);

    return this.simulation.start();
  }

  /**
   * Add handlers for evenet in SVG
   */
  addSVGEventHandlers() {
    this.mainSVG
    .addEventListener("click", e => setTimeout(() => {
      if (e.detail > 1)
        return false; // ignore dblclick first click

      const element = e.target;
      if (e.target != null) {
        // Ignore clicks that are not on SVG elements
        if (this.models.Selection.clickOnSVG(e.target)) {
          if (this.models.Selection.isSomethingSelected()) {
            this.tutorial(3);
            return true;
          }
        }
      }
      return false;
    }, 200));

    this.mainSVG
    .addEventListener("dblclick", e => {
      // Select everything

      if (this.models.Selection.isSomethingSelected())
        // Deselect current selection
        this.models.Selection.clearSelection();

      const selectedEls = this.mainSVG.querySelectorAll(
        'path,rect,circle,ellipse,line,polyline,polygon');
      if (selectedEls.length > 0) {
        selectedEls.forEach(element =>
          this.models.Selection.clickOnSVG(element));
        if (this.models.Selection.isSomethingSelected())
          this.tutorial(3);
      }
    });
  }

  opName(v) {
    switch (v) {
    case this.PolyOps.Engrave: return "Engrave";
    case this.PolyOps.Perforate: return "Perforate";
    case this.PolyOps.Inside: return "Inside";
    case this.PolyOps.Outside: return "Outside";
    case this.PolyOps.ConcentricPocket: return "Pocket (concentric)";
    case this.PolyOps.RasterPocket: return "Pocket (raster)";
    }
  }

  /**
   * Show an alert
   * @param {string} id HTML name= of a message in <div id="alerts">
   * @param {string} alerttype CSS class, e.g. "alert-warning"
   * @param {object[]} params remaining paramsers are used to expan $n in the
   * message
   */
  showAlert(id, alerttype, ...params) {
    let s = document.querySelector(`#alerts>[name="${id}"]`);
    if (s) {
      s = s.innerHTML.replace(
        /\$(\d+)/g,
        (m, index) => params[index - 1]);
    } else
      s = id;
    const alDiv = document.createElement("div");
    alDiv.classList.add("alert");
    alDiv.classList.add(alerttype);
    alDiv.innerHTML = s;
    const a = document.createElement("a");
    a.append("× ");
    a.classList.add("close");
    a.classList.add("ecks");
    a.dataset.dismiss = "alert";
    alDiv.prepend(a);
    a.addEventListener("click", event => alDiv.remove());

    const alp = document.getElementById('alert_placeholder');
    alp.prepend(alDiv);

    return alDiv;
  }

  /**
   * Show the referenced modal, creating it if it is not currently shown.
   * @param {string} id the id attribute of the modal
   */
  showModal(id) {
    const el = document.getElementById(id);
    const modal = bootstrap.Modal.getOrCreateInstance(el);
    modal.show();
    return modal;
  }

  /**
   * Hide all open modals, if any.
   * @param {string} id the id attribute of the modal
   */
  hideModals() {
    const els = document.querySelectorAll(".modal");
    els.forEach(el => {
      const modal = bootstrap.Modal.getInstance(el);
      if (modal)
        modal.hide();
    });
  }

  /**
   * Get the bounding box of the content in the main SVG.
   * This is the smallest box that encompasses the content.
   * @return {Rect} the BB (in px units)
   */
  getMainSVGBBox() {
    return SVG.getBounds(this.mainSVG);
  }

  /**
   * Update the size of the simulation canvas to match
   * the size of the main SVG.
   * @private
   */
  updateSimulationCanvasSize() {
    // Get the whole middle section for width
    const middleDiv = document.getElementById("Middle");
    const mSvgW = middleDiv.clientWidth;
    // Make the simulation square
    const canvas = document.getElementById("simulationCanvas");
    canvas.setAttribute("width", mSvgW);
    canvas.setAttribute("height", mSvgW);
  }

  /**
   * Set the viewBox of the main SVG so that it fits the
   * viewing area.
   * @private
   */
  updateMainSvgSize() {
    // Get the whole middle section that the SVG has to fit in
    const middleDiv = document.getElementById("Middle");
    // Get the SVG and attribute it accordingly
    const mSvg = this.mainSVG;
    // Get the BB for the main SVG view
    const bbox = mSvg.getBBox();
    // Mine; works even when the SVG hasn't been rendered, but is heavy.
    //const bbox = this.getMainSVGBBox();
    // Set the viewBox to view all the contents of the main svg
    mSvg.setAttribute(
      "viewBox",
      `${bbox.x - 2} ${bbox.y - 2} ${bbox.width + 4} ${bbox.height + 4}`);
  }

  /**
   * Change the tutorial alert to the given tutorial step.  Changing to a step
   * that has no message in the HTML will clear the tutorial alert. The
   * tutorial will only run through once.
   * @param {number} step the step to change to.
   */
  tutorial(step) {
    // Don't go backwards
    if (step > this.currentTutorialStep) {
      if (this.tutorialAlert)
        this.tutorialAlert.remove();
      const messEl = document.querySelector(
        `#tutorialSteps>div[name="Step${step}"]`);
      if (messEl) {
        const message = messEl.innerHTML;
        this.tutorialAlert = this.showAlert(
          "tutorialStep", "alert-info", step, message);
        this.currentTutorialStep = step;
      }
    }
  }

  /**
   * Get a hierarchical object that reflects the application state
   * in a form that can be safely serialised e.g to JSON
   * @param {boolean} template true to save a template, but not the
   * geometry
   */
  getSaveable(template) {
    const container = { model: {}, svg: {}};
    for (const m in this.models) {
      const json = this.models[m].toJson(template);
      if (json)
        container.model[this.models[m].jsonFieldName()] = json;
    }
    if (!template) {
      // Only the content and toolPaths SVG need to be saved, everything
      // else can be regenerated
      const svgGroups = document.querySelector(".serialisableSVGGroup");
      for (const svgel of svgGroups)
        container.svg[svgel.id] = svgel.innerHTML;
    }
    return container;
  }

  /**
   * Reload application state from a hierarchical object as saved
   * by `getSaveable()`.
   * @param {object} container application state
   * @param {object[]} saveable.model mapping from model name to model state
   * @param {string[]} saveable.svg mapping from svg group name to geometry
   */
  loadSaveable(container) {
    // Clean out SVG groups
    let svgGroups = document.querySelector(".managedSVGGroup");
    for (const svgel of svgGroups)
      svgel.replaceChildren();

    // Reload models
    for (const m in this.models) {
      this.models[m].reset();
      const json = container.model[this.models[m].jsonFieldName()];
      if (json)
        this.models[m].fromJson(json);
    }

    // Reload content
    svgGroups = document.querySelector(".serialisableSVGGroup");
    for (const svgel of svgGroups) {
      if (container.svg[svgel.id]) {
        const el = SVG.loadSVGFromText(container.svg[svgel.id]);
        svgel.append(el);
      }
    }
    this.updateMainSvgSize();
  }
}

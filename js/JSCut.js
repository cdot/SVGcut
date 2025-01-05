// import "file-saver"
/* global saveAs */

// import "snapsvg"
/* global Snap */

// import "bootstrap"
/* global bootstrap */

import { ToolViewModel } from "./ToolViewModel.js";
import { OperationsViewModel } from "./OperationsViewModel.js";
import { GcodeConversionViewModel } from "./GcodeConversionViewModel.js";
//CPP import { TabsViewModel } from "./TabsViewModel.js";
import { MaterialViewModel } from "./MaterialViewModel.js";
import { SelectionViewModel } from "./SelectionViewModel.js";
import { CurveConversionViewModel } from "./CurveConversionViewModel.js";
import { MiscViewModel } from "./MiscViewModel.js";
import { Simulation } from "./Simulation.js";
import * as Gcode from "./Gcode.js";
//CPP import { getScript } from "./getScript.js";

/**
 * Singleton.
 * jscut makes extensive use of "knockout" to bind the various parts
 * of the UI together. You will need to understand the basics of
 * knockout to read this code.
 */
class JSCutApp {

  constructor(config) {
    /**
     * UID for alerts
     * @member {number}
     * @private
     */
    this.nextAlertNum = 1;

    /**
     * Map from model name (e.g. "GcodeConversion") to the view model
     * for the relevant card. Note that all tool models share the Tool
     * UnitConverter except GcodeConversion which has it's own,
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
    window.JSCut = this;

    /**
     * The loaded SVG(s) drawing surface. This is given a default viewBox
     * of 0,0,500,500 before an SVG is loaded.
     * @member {Element}
     */
    this.mainSvg = Snap("#MainSvg");

    // Note: The order the groups are created in is important. Later
    // groups will override earlier groups during selections, so we always
    // create the selection group last.
    
    /**
     * SVG group containing geometry loaded from input files.
     * @member {SVGGraphicsElement}
     */
    this.contentSvgGroup = this.mainSvg.group();

    /**
     * SVG group containing geometry for tool paths. This will be populated
     * by operations, as and when they determine tool paths.
     * @member {SVGGraphicsElement}
     */
    this.toolPathsSvgGroup = this.mainSvg.group();

    /**
     * SVG group containing geometry generated by dynamically combining various
     * paths to generate it.
     * @member {SVGGraphicsElement}
     */
    this.cgSvgGroup = this.mainSvg.group();

    //CPP this.tabsGroup this.mainSvg.group()

    this.contentSvgGroup.attr({
      filter: this.mainSvg.filter(
        Snap.filter.contrast(.5)).attr("filterUnits", "objectBoundingBox")
    });

    // Create view models.
    this.models.Tool = new ToolViewModel();
    const unitConverter = this.models.Tool.unitConverter;

    this.models.Misc = new MiscViewModel();
    this.models.Material = new MaterialViewModel(unitConverter);
    this.models.CurveConversion = new CurveConversionViewModel(unitConverter);
    this.models.Selection = new SelectionViewModel(this.mainSvg.group());
    this.models.Operations = new OperationsViewModel(unitConverter);
    //CPP this.models.Tabs = new TabsViewModel(unitConverter);
    this.models.GcodeConversion = new GcodeConversionViewModel();

    /*CPP*
     * Paths to try to load CPP module asynchronously
     * @member {String[]}
     *
    this.tryCppPaths = Array.from(config.camCppPaths);
    // requires Misc model

    this.downloadCpp();
    this.models.Misc.loadedCamCpp(true); // not if downloadCpp is used
    /CPP*/

    /**
     * The little picture at the top of the Material tab
     * @member {Element}
     */
    this.materialSvg = Snap("#MaterialSvg");
    Snap.load("Material.svg", f => {
      this.materialSvg.append(f);
      this.models.Material.materialSvg(this.materialSvg);
    });

    document.getElementById('choose-svg-file')
    .addEventListener("change", event => {

      const files = event.target.files;
      for (const file of files) {
        const lert = this.showAlert(`loading ${file.name}`, "alert-info");
        const reader = new FileReader();
        reader.addEventListener("load", e => {
          this.loadSvg(e.target.result);
          if (lert)
            lert.remove();
          this.showAlert(`loaded ${file.name}`, "alert-success");
          this.tutorial(2, 'Click 1 or more objects');
        });
        reader.addEventListener("abort", e => {
          lert.remove();
          this.showAlert(`aborted reading ${file.name} ${e}`, "alert-danger");
        });
        reader.addEventListener("error", e => {
          lert.remove();
          this.showAlert(`error reading ${file.name} ${e}`, "alert-danger");
        });
        reader.readAsText(file);
      }
      // SMELL: why? It's a clone, it should be identical, no? Maybe
      // something to do with the change event handler only firing once?
      // Seems to work fine without this.
      //const control = $(event.target).clone(true);
      //$(event.target).replaceWith(control);
    });

    document.getElementById("MainSvg")
    .addEventListener("click", e => {
      const element = Snap.getElementByPoint(e.pageX, e.pageY);
      if (element != null) {
        if (this.models.Selection.clickOnSvg(element)) {
          if (this.models.Selection.numSelected() > 0) {
            this.tutorial(3, 'Click "Create Operation" after you have finished selecting objects.');
            return true;
          }
        }
      }
      return false;
    });

    document.getElementById('choose-settings-file')
    .addEventListener("change", event => {
      var files = event.target.files;
      for (const file of files) {
        var lert = this.showAlert(
          `loading settings from ${file.name}`, "alert-info");
        var reader = new FileReader();
        reader.addEventListener("load", e => {
          this.fromJson(JSON.parse(e.target.result));
          this.updateMainSvgSize();
          lert.remove();
          this.showAlert(`loaded setting from ${file.name}`, "alert-success");
        });
        reader.addEventListener("abort", () => {
          lert.remove();
          this.showAlert(
            `aborted reading settings from ${file.name}`, "alert-danger");
        });
        reader.addEventListener("error", e => {
          console.error(e);
          lert.remove();
          this.showAlert(
            `error reading settings from ${file.name}`, "alert-danger");
        });
        reader.readAsText(file);
      }
      // SMELL: see comments above
      //const control = $(event.target).clone(true);
      //$(event.target).replaceWith(control);
    });

    window.addEventListener("resize", () => {
      this.updateMainSvgSize();
      this.updateSvgAutoHeight();
      this.updateSimulationCanvasSize();
    });

    document.addEventListener("updateSimulation", () => {
      console.debug("Update simulation");
      if (this.simulation) {
        // Set the simulation path from the Gcode
        const uc = this.models.GcodeConversion.unitConverter;
        const topZ = this.models.Material.topZ.toUnits(uc.units());
        const diam = this.models.Tool.diameter.toUnits(uc.units());
        const ang = this.models.Tool.angle();
        const cutterH = uc.fromUnits(1, "mm");
        const toolPath = Gcode.parse(this.models.GcodeConversion.gcode());
        this.simulation.setPath(toolPath, topZ, diam, ang, cutterH);
      }
    });

    if (this.options.preloadInBrowser) {
      const settings = JSON.parse(localStorage.getItem("settings"));
      if (settings)
        this.fromJson(settings[this.options.preloadInBrowser]);
    }

    // Complete UI initialisation of the view models
    for (const m in this.models)
      this.models[m].initialise();

    // Create the simulation canvas.
    this.simulation = new Simulation(
      "glShaders",
      document.getElementById("simulationCanvas"),
      document.getElementById('timeControl'));
  }

  /**
   * Finish initialisation, start the simulation animation.
   * @return {Promise} promise that resolves to undefined
   */
  start() {
    this.updateSvgAutoHeight();   
    this.updateMainSvgSize();
    this.updateSimulationCanvasSize();

    this.tutorial(1, 'Open an SVG file.');

    return this.simulation.start();
  }

  /**
   * Asynchronously find and load cpp interface
   */
  /*
  downloadCpp() {
    if (this.tryCppPaths.length == 0) {
      const e = "cam-cpp.js is unavailable; tried the following paths:<ul>"
            + this.options.camCppPaths.map(path => `<li>${path}</li>`).join("")
            + "</ul>";
      console.error(`Error: ${e}`);
      this.models.Misc.camCppError(e);
      return;
    }
    const nextLocation = this.tryCppPaths.shift();
    const script = `${nextLocation}/cam-cpp.js`;
    let element = document.createElement('script');
    element.setAttribute("src", script);
    document.head.appendChild(element);
    getScript(script)
    .then(() => {
      console.debug(`cam-cpp.js found at: ${script}`);
      this.models.Misc.loadedCamCpp(true);
    })
    .catch(() => this.downloadCpp());
  }
*/

  /**
   * @param {boolean} timeout if true, message will be shown for 5s then deleted
   */
  showAlert(message, alerttype, timeout = false) {
    const alertNum = this.nextAlertNum++;
    const alDiv = document.createElement("div");
    alDiv.setAttribute("id", `AlertNum${alertNum}`);
    alDiv.classList.add("alert");
    alDiv.classList.add(alerttype);
    const a = document.createElement("a");
    a.append("×");
    a.classList.add("close");
    a.dataset.dismiss = "alert";
    alDiv.prepend(a, message);

    const alp = document.getElementById('alert_placeholder');
    alp.prepend(alDiv);

    if (timeout)
      setTimeout(() => alDiv.remove(), 5000);

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
   * Hide the referenced modal, if it is currently shown.
   * @param {string} id the id attribute of the modal
   */
  hideModal(id) {
    const el = document.getElementById(id);
    const modal = bootstrap.Modal.getInstance(el);
    if (modal)
      modal.hide();
  }

  /**
   * Update the size of the simulation canvas to match
   * the size of the main SVG.
   */
  updateSimulationCanvasSize() {
    const canvas = document.getElementById("simulationCanvas");
    const mSvgDiv = document.getElementById("MainSvgDiv");
    const mSvgW = mSvgDiv.getAttribute("width");
    canvas.setAttribute("width", mSvgW);
    canvas.setAttribute("height", mSvgW);
  }

  /**
   * Update the client size of any svg that's tagged as autoheight
   * so that the aspect ratio is preserved. This is currently only
   * used for the MaterialSvg picture.
   */
  updateSvgAutoHeight() {
    const nodes = document.querySelectorAll("svg.autoheight");
    for (const node of nodes) {
      const ar = node.getAttribute("internalHeight")
            / node.getAttribute("internalWidth");
      node.setAttribute("clientHeight", node.clientWidth * ar);
    }
  }

  /**
   * Set the client area of the main SVG so that it fits the
   * viewing area.
   */
  updateMainSvgSize() {
    const bbox = this.mainSvg.getBBox();
    const mSvgDiv = document.getElementById("MainSvgDiv");
    const mSvg = document.getElementById("MainSvg");
    mSvg.setAttribute("clientWidth", mSvgDiv.clientWidth);
    mSvg.setAttribute("clientHeight", Math.max(10, window.clientHeight - 120));
    mSvg.setAttribute("preserveAspectRatio", 'xMinYMin meet');
    mSvg.setAttribute(
      "viewBox", `${bbox.x - 2} ${bbox.y - 2} ${bbox.w + 4} ${bbox.h + 4}`);
  }

  /**
   * Load SVG from plain text
   * @param {Buffer|string} content the svg plain text
   */
  loadSvg(content) {
    const svg = Snap.parse(content);
    this.contentSvgGroup.append(svg);
    this.updateMainSvgSize();
  }

  /**
   * Change to the given tutorial step
   * @param {number} step the step to change to
   * @param {string} message text for the tutorial message
   */
  tutorial(step, message) {
    // Don't go backwards
    if (step > this.currentTutorialStep) {
      if (this.tutorialAlert)
        this.tutorialAlert.remove();
      this.tutorialAlert = this.showAlert(
        `Step ${step}: ${message}`, "alert-info");
      this.currentTutorialStep = step;
    }
  }

  toJson() {
    const json = {};
    for (const m in this.models)
      this.models[m].putJson(json);
    return json;
  }

  fromJson(json) {
    if (json)
      for (const m in this.models)
        this.models[m].getJson(json);
  }
}

export { JSCutApp };

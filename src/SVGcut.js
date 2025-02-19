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
import { ProjectViewModel } from "./ProjectViewModel.js";
import { Simulation } from "./Simulation.js";
import { Rect } from "./Rect.js";
import * as Gcode from "./Gcode.js";
import * as SVG from "./SVG.js";
import * as Cam from "./Cam.js";

/**
 * Format a time for display in a string e.g
 * `formatTime(601)` -> `"10:01"`
 * @param {number} t time period in seconds
 */
function formatTime(t) {
  const s = `0${t % 60}`.slice(-2);
  t = Math.floor(t / 60);
  const m = `0${t % 60}`.slice(-2);
  return `${Math.floor(t / 60)}:${m}:${s}`;
}

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
    this.mainSVG = document.getElementById("MainSVG");

    // Create the simulation canvas.
    this.simulation = new Simulation(
      "glShaders",
      document.getElementById("SimulationCanvas"),
      document.getElementById('TimeControl'),
      spot => { // stopWatch callback
        document.getElementById('StopWatchT').textContent = formatTime(spot.t);
        document.getElementById('StopWatchX').textContent = spot.x.toFixed(2);
        document.getElementById('StopWatchY').textContent = spot.y.toFixed(2);
        document.getElementById('StopWatchZ').textContent = spot.z.toFixed(2);
        document.getElementById('StopWatchF').textContent = Math.floor(spot.f);
        document.getElementById('StopWatchS').textContent = Math.floor(spot.s);
      });

    // Create view models.

    this.models.Project = new ProjectViewModel();
    const unitConverter = this.models.Project.unitConverter;

    this.models.Tool = new ToolViewModel(unitConverter);
    this.models.Material = new MaterialViewModel(unitConverter);
    this.models.CurveConversion = new CurveConversionViewModel(unitConverter);
    this.models.Selection = new SelectionViewModel();
    this.models.Operations = new OperationsViewModel(unitConverter);
    this.models.Tabs = new TabsViewModel(unitConverter);
    this.models.GcodeGeneration = new GcodeGenerationViewModel();

    // bootstrap is a bit crap at submenus. If we want to close a menu
    // tree when an action is selected, we have to jump through some hoops.
    // Since our actions can be easily identified by classes we can use
    // that to trigger a close.
    document
    .querySelectorAll(".dropdown-item>.close-on-click")
    .forEach(el => el.addEventListener("click", () => {
      const nel = document.querySelectorAll(
        ".dropdown-toggle[data-toggle='collapse']");
      nel.forEach(e => bootstrap.Dropdown.getInstance(e).hide());
    }));

    // If a SVG is imported / project opened when the toolpath is closed,
    // then the viewbox won't get updated. Detect when we switch back
    // and update it then. This will reset the zoom level to the default.
    document.getElementById("ActivateToolpathsTab")
    .addEventListener("click", () => {
      this.fitSVG();
    });

    this.addSVGEventHandlers();

    window.addEventListener("resize", () => {
      //console.debug("Main resized");
      this.fitSVG();
      this.updateSimulationCanvasSize();
    });

    // handle popovers flagged by trigger:"manual" and class="manual-popover"
    const mans = document.querySelectorAll('.manual-popover');
    for (const man of mans) {
      man.parentElement.addEventListener("mouseenter", () => {
        if (man.disabled) {
          const popover = bootstrap.Popover.getInstance(man);
          popover.show();
        }
      });

      man.parentElement.addEventListener("mouseleave", () => {
        const popover = bootstrap.Popover.getInstance(man);
        popover.hide();
      });
    }

    document.addEventListener("UPDATE_SIMULATION", () => {
      // Set the simulation path from the Gcode
      const uc = this.models.GcodeGeneration.unitConverter;
      const topZ = this.models.Material.topZ.toUnits(uc.units());
      const diam = this.models.Tool.diameter.toUnits(uc.units());
      const ang = this.models.Tool.angle();
      const cutterH = uc.fromUnits(10, "mm");
      const toolPath = Gcode.parse(this.models.GcodeGeneration.gcode());
      //console.debug(`Updating simulation of ${toolPath.length} gcode steps`);
      this.simulation.setPath(toolPath, topZ, diam, ang, cutterH);
    });

    document.addEventListener("UNSUPPORTED_SVG", e =>
      this.showAlert("unsupportedSVG", "alert-warning",
                     e.tag, e.attr, e.value));

    for (const m in this.models)
      this.models[m].bind();

    this.tutorial(1);
  }

  /**
   * Finish initialisation, start the simulation animation.
   * @return {Promise} promise that resolves to undefined
   */
  start() {
    this.fitSVG();
    this.updateSimulationCanvasSize();

    return this.simulation.start()
    .then(() => this.models.Project.loadDefaults());
  }

  /**
   * Get the long name for a Cam op
   */
  longOpName(op) {
    return Cam.LONG_OP_NAME[op];
  }

  /**
   * Add handlers for events in SVG
   */
  addSVGEventHandlers() {
    // Click to select
    this.mainSVG
    .addEventListener("click", e => setTimeout(() => {
      // Timeout to give space for double-click
      if (e.detail > 1)
        return false; // ignore dblclick first click

      if (e.target) {
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

    // Double-click select all
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

    // Zooming using the mouse wheel
    this.mainSVG
    .addEventListener("wheel", event => {
      event.preventDefault();

      // set the scaling factor (and make sure it's at least 10%)
      let scale = event.deltaY / 1000;
      scale = Math.abs(scale) < 0.1
      ? 0.1 * event.deltaY / Math.abs(event.deltaY) : scale;

      // Get point in SVG space
      let pt = new DOMPoint(event.clientX, event.clientY);
      pt = pt.matrixTransform(this.mainSVG.getScreenCTM().inverse());

      // Get viewbox transform
      let [x, y, width, height] = this.mainSVG
          .getAttribute('viewBox').split(' ').map(Number);

      // Get pt.x as a proportion of width and pt.y as proportion of height
      let [xPropW, yPropH] = [(pt.x - x) / width, (pt.y - y) / height];

      // Calc new width and height, new x2, y2 (using proportions and
      // new width and height)
      let [width2, height2] = [width + width * scale, height + height * scale];
      let x2 = pt.x - xPropW * width2;
      let y2 = pt.y - yPropH * height2;

      this.mainSVG.setAttribute('viewBox', `${x2} ${y2} ${width2} ${height2}`);
    });

    // Panning
    const getSVGPointFromEvent = event => {
      const point = new DOMPoint(event.clientX, event.clientY);
      const mat = this.mainSVG.getScreenCTM().inverse();
      return point.matrixTransform(mat);
    };

    const mouse = {};
    this.mainSVG
    .addEventListener("mousedown", event => {
      mouse.viewBox = this.mainSVG.viewBox.baseVal;
      mouse.start = getSVGPointFromEvent(event);
      mouse.isDown = true;
    });

    this.mainSVG.addEventListener("mouseleave", () => mouse.isDown = false);
    this.mainSVG.addEventListener("mouseup", () => mouse.isDown = false);

    this.mainSVG
    .addEventListener("mousemove", event => {
      if (!mouse.isDown)
        return;

      event.preventDefault();

      const here = getSVGPointFromEvent(event);
      mouse.viewBox.x -= here.x - mouse.start.x;
      mouse.viewBox.y -= here.y - mouse.start.y;
    });
  }

  /**
   * Show an alert
   * @param {string} id HTML name= of a message in <div id="Alerts">
   * @param {string} alerttype CSS class, e.g. "alert-warning"
   * @param {object[]} params remaining paramsers are used to expan $n in the
   * message
   */
  showAlert(id, alerttype, ...params) {
    let s = document.querySelector(`#Alerts>[name="${id}"]`);
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

    const alp = document.getElementById("AlertPlaceholder");
    alp.prepend(alDiv);

    return alDiv;
  }

  /**
   * Show the referenced modal, creating it if it is not currently shown.
   * @param {string} id the id attribute of the modal
   * @return {Element} the bootstrap modal
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
    // When the main SVG element is hidden (e.g. when viewing the Simulation
    // tab) then SVGElement.getCTM goes belly up and returns a mysterious
    // transformation matrix that doesn't bear any relation to the viewport
    // establishing element (as far as I can tell). Luckily we can cache the
    // last computed BB and use that. It won't be exactly right when the
    // operation is changed e.g from Inside to Outside while in the Simulation
    // view, but it'll be close enough.
    const isHidden = this.mainSVG.offsetWidth === 0
          || this.mainSVG.offsetHeight === 0
          || this.mainSVG.getClientRects().length === 0
          || window.getComputedStyle(this.mainSVG).visibility === "hidden";
    if (isHidden && this.bbCache)
      return this.bbCache;
    return this.bbCache = SVG.getBounds(this.mainSVG);
  }

  /**
   * Update the size of the simulation canvas to match
   * the size of the main SVG.
   * @private
   */
  updateSimulationCanvasSize() {
    // Get the whole middle section for width
    const middleDiv = document.getElementById("Middle");
    const mSVGW = Math.min(
      middleDiv.clientWidth, middleDiv.clientHeight); // pixels
    // Make the simulation square
    this.simulation.resizeCanvas(mSVGW, mSVGW);
  }

  /**
   * Set the viewBox of the main SVG so that it fits the
   * viewing area.
   * @private
   */
  fitSVG() {
    // Get the SVG and attribute it accordingly
    const mSVG = this.mainSVG;
    // Get the BB for the main SVG view
    const bbox = mSVG.getBBox();
    // Mine; works even when the SVG hasn't been rendered, but is heavy.
    //const bbox = this.getMainSVGBBox();
    // Set the viewBox to view all the contents of the main svg
    const bbs =
          `${bbox.x - 2} ${bbox.y - 2} ${bbox.width + 4} ${bbox.height + 4}`;
    console.debug("Set bbox", bbs);
    mSVG.setAttribute(
      "viewBox", bbs);
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
        `#TutorialSteps>[name="Step${step}"]`);
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
      const svgGroups = document.querySelectorAll(
        ".managed-SVG-group.serialisable");
      for (const svgel of svgGroups)
        container.svg[svgel.id] = svgel.innerHTML;
    }
    return container;
  }

  /**
   * Clean out SVG groups
   */
  emptySVG() {
    let svgGroups = document.querySelectorAll(".managed-SVG-group");
    for (const svgel of svgGroups)
      svgel.replaceChildren();
    this.fitSVG();
  }

  /**
   * Reload application state from a hierarchical object as saved
   * by `getSaveable()`.
   * @param {object} container application state
   * @param {object[]} saveable.model mapping from model name to model state
   * @param {string[]} saveable.svg mapping from svg group name to geometry
   */
  loadSaveable(container) {
    this.emptySVG();

    // Disable gcode generation until all ops are loaded
    this.models.GcodeGeneration.disable = true;

    // Reload models
    for (const m in this.models) {
      this.models[m].reset();
      const json = container.model[this.models[m].jsonFieldName()];
      if (json)
        this.models[m].fromJson(json);
    }

    // Reload SVG content
    const svgGroups = document.querySelectorAll(
      ".managed-SVG-group.serialisable");
    for (const svgel of svgGroups) {
      if (container.svg[svgel.id]) {
        //console.debug("**** Reloading SVG", svgel.id);
        const el = SVG.loadSVGFromText(container.svg[svgel.id]);
        svgel.append(el);
      }
    }

    this.models.GcodeGeneration.disable = false;

    document.dispatchEvent(new Event("UPDATE_GCODE"));

    this.fitSVG();
  }

  /**
   * Zoom the main SVG by the given factor
   * @param {number} scale scale amount, <1 to zoom in, >1 to zoom out
   */
  zoom(scale) {
    let [x, y, width, height] = this.mainSVG
        .getAttribute('viewBox').split(' ').map(Number);

    let [width2, height2] = [width * scale, height * scale];
    x += (width - width2) / 2;
    y += (height - height2) / 2;

    this.mainSVG.setAttribute('viewBox', `${x} ${y} ${width2} ${height2}`);
  }

  zoomOut() {
    this.zoom(1.1);
  }

  zoomIn() {
    this.zoom(0.9);
  }

  hideSVG() {
    const control = document.getElementById("HideSVG");
    document.getElementById("ContentSVGGroup")
    .setAttribute("visibility", control.checked ? "hidden" : "visible");
  }
}

/*Copyright Todd Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */
/* global assert */

// import "knockout";
/* global ko */
/* global App */

import { ViewModel } from "./ViewModel.js";

import { CutPath } from "./CutPath.js";
import { CutPaths } from "./CutPaths.js";
import { Rect } from "./Rect.js";
import * as SVG from "./SVG.js";
import { Drill } from "./Drill.js";
import { Engrave } from "./Engrave.js";
import { Inside } from "./Inside.js";
import { Outside } from "./Outside.js";
import { Perforate } from "./Perforate.js";
import { Pocket } from "./Pocket.js";

const DEFAULT_DIRECTION = "Conventional";
const DEFAULT_STRATEGY  = "Annular";
const DEFAULT_CUTDEPTH  = 1; // mm
const DEFAULT_RAMP      = false;
const DEFAULT_MARGIN    = 0; // mm
const DEFAULT_SPACING   = 1; // mm
const DEFAULT_WIDTH     = 0; // mm

const FIELDS = [
  "name", "enabled", "combineOp", "opName", "cutDepth", "width",
  "direction", "spacing", "ramp", "margin", "strategy"
];

/**
 * Boolean operations on closed polygons.
 * @typedef {('Group'|'Union'|'Intersect'|'Difference'|'XOR')} CombineOp
 * @memberof OperationViewModel
 */
const DEFAULT_COMBINEOP = "Group";

// Map from operation name to class of generator.
const GENERATORS = {
  Drill:         Drill,
  Engrave:       Engrave,
  Inside:        Inside,
  Outside:       Outside,
  Perforate:     Perforate,
  Pocket:        Pocket
};

/**
 * ViewModel for an operation in the `Operations` card
 * @listens UPDATE_TOOL_PATHS signal to update all tool paths
 * @extends ViewModel
 */
export class OperationViewModel extends ViewModel {

  /**
   * @param {UnitConverter} unit converter to use
   * @param {CutPaths} operandPaths input paths to the operation
   */
  constructor(unitConverter, operandPaths) {
    super(unitConverter);

    assert(!operandPaths || operandPaths instanceof CutPaths);

    /**
     * The input to this operation.
     * @member {CutPaths}
     * @private
     */
    this.operandPaths = operandPaths;

    /**
     * Geometry generated by combining all the paths in this operation
     * using combineOp.
     * @member {CutPaths}
     * @private
     */
    this.combinedGeometry = new CutPaths();

    /**
     * The combined geometry generated by the operation, in SVG format
     * for adding to #ToolPathsSVGGroup. This will be a single path.
     * @member {SVGGaphicsElement}
     * @private
     */
    this.previewSVG = undefined;

    /**
     * SVG path generated to show the tool paths. Will be added to
     * the #ToolPathsSVGGroup element
     * @member {SVGElement}
     * @private
     */
    this.toolPathSVG = undefined;

    /**
     * The operation used to combine raw paths to generate the resulting
     * combinedGeometry.
     * @member {observable.<string>}
     */
    this.combineOp = ko.observable(DEFAULT_COMBINEOP);
    this.combineOp.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      this.recombine();
    });

    /**
     * The available operations. This is based on the
     * the mix of open and closed paths in the operandPaths.
     */
    this.availableOperations = ko.observableArray();
    this.updateAvailableOperations();

    /**
     * The toolpath (and preview geometry) generator for the
     * selected operation.
     * @member {ToolpathGenerator}
     */
    this.toolpathGenerator = new (GENERATORS.Engrave)();

    /**
     * The operation name. Default is Engrave as it's simplest.
     * @member {observable.<string>}
     */
    this.operation = ko.observable("Engrave");
    this.operation.subscribe(value => {
      // Instantiate a new toolpath generator for the chosen op
      const genClass = GENERATORS[value];
      this.toolpathGenerator = new (genClass)();
      this.needs(this.toolpathGenerator.needs);
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      this.recombine();
    });

    /**
     * The UI button that opens the detail pane for this operation
     * @member {observable.<button>}
     */
    this.showDetail = ko.observable(false);

    /**
     * The (optional, user provided) name of this operation
     * @member {observable.<string>}
     */
    this.name = ko.observable("");
    this.name.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      this.updateGcode();
    });

    /**
     * Operations can be selectively enabled/disabled for Gcode
     * generation
     * @member {observable.<boolean>}
     */
    this.enabled = ko.observable(true);
    this.enabled.subscribe(newValue => {
      let v = newValue ? "visible" : "hidden";
      if (this.previewSVG)
        this.previewSVG.setAttribute("visibility", v);
      if (this.toolPathSVG)
        this.toolPathSVG.setAttribute("visibility", v);
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      this.updateGcode();
    });

    /**
     * Enable ramping. See README.md
     * @member {observable.<boolean>}
     */
    this.ramp = ko.observable(DEFAULT_RAMP);
    this.ramp.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      this.updateGcode();
    });

    /**
     * Either "Conventional" or "Climb". See README.md
     * @member {observable.<string>}
     */
    this.direction = ko.observable(DEFAULT_DIRECTION);
    this.direction.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      this.generateToolpaths();
    });

    /**
     * Pocketing strategy.
     * @member {observable.<string>}
     */
    this.strategy = ko.observable(DEFAULT_STRATEGY);
    this.strategy.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      this.generateToolpaths();
    });

    /**
     * Paths taken by the tool to execute this operation.
     * @member {observable.<CutPaths>}
     */
    this.toolPaths = ko.observable(new CutPaths());
    this.toolPaths.subscribe(() => this.updateGcode());

    /**
     * Maximum depth to cut to.
     * @member {observable.<number>}
     */
    this.cutDepth = ko.observable(DEFAULT_CUTDEPTH);
    unitConverter.add(this.cutDepth);
    this.cutDepth(App.models.Tool.passDepth());
    this.cutDepth.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      this.generateToolpaths();
    });

    /**
     * Amount of material to leave uncut.
     * @member {observable.<number>}
     */
    this.margin = ko.observable(DEFAULT_MARGIN);
    unitConverter.add(this.margin);
    this.margin.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      this.recombine();
    });

    /**
     * Spacing of perforations.
     * @member {observable.<number>}
     */
    this.spacing = ko.observable(DEFAULT_SPACING);
    unitConverter.add(this.spacing);
    this.spacing.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      this.recombine();
    });

    /**
     * How wide a path to cut. If this is less than the cutter diameter
     * it will be rounded up.
     * @member {observable.<number>}
     */
    this.width = ko.observable(DEFAULT_WIDTH);
    unitConverter.add(this.width);
    this.width.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      this.recombine();
    });

    /**
     * Override Tool Defaults
     * @member {observable.<number>}
     */
    this.passDepth = ko.observable();
    unitConverter.add(this.passDepth);
    this.passDepth.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      this.recombine();
    });

    /**
     * Override Tool Defaults
     * @member {observable.<number>}
     */
    this.stepOver = ko.observable();
    this.stepOver.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      this.recombine();
    });

    /**
     * Override Tool Defaults
     * @member {observable.<number>}
     */
    this.cutRate = ko.observable();
    unitConverter.add(this.cutRate);
    this.cutRate.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      document.dispatchEvent(new Event("UPDATE_GCODE"));
    });

    /**
     * Override Tool Defaults
     * @member {observable.<number>}
     */
    this.rpm = ko.observable();
    this.rpm.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      document.dispatchEvent(new Event("UPDATE_GCODE"));
    });

    /**
     * Determine which of the operation fields needs to be enabled for this
     * operation.
     */
    this.needs = ko.observable({});

    /**
     * Flag to lock out recombination, usually because we are in a
     * sequence of steps and recombination can wait. See recombine()
     * for more.
     * @member {boolean}
     * @private
     */
    this.disableRecombination = false;

    /**
     * Flag to lock out toolpath generation.
     * @member {boolean}
     * @private
     */
    this.generatingToolpath = false;

    document.addEventListener(
      "UPDATE_TOOL_PATHS", () => this.generateToolpaths());
  }

  /**
   */
  updateAvailableOperations() {
    const haveClosed =
          this.operandPaths.filter(p => p.isClosed).length > 0;
    for (const opName of Object.keys(GENERATORS)) {
      const op = GENERATORS[opName];
      if (op.worksOnPaths() === "ALL" || op.worksOnPaths() === "OPEN")
        this.availableOperations.push(opName);
      else if (haveClosed && op.worksOnPaths() === "CLOSED")
        this.availableOperations.push(opName);
    }
  }

  /**
   * Used internally to signal that toolPaths or Gcode generation
   * parameters have changed.
   * @private
   */
  updateGcode() {
    if (!this.generatingToolpath)
      document.dispatchEvent(new Event("UPDATE_GCODE"));
  }

  /**
   * Toggle the display of the detail dropdown.
   * Used from HTML via knockout.
   */
  toggleDetail() {
    this.showDetail(!this.showDetail());
  }

  /**
   * Invoked from HTML. Operations are bound to this view model, so
   * when removeOperation is bound it comes here.
   */
  removeOperation() {
    App.models.Operations.removeOperation(this);
  }

  /**
   * Invoked from HTML. Operations are bound to this view model, so
   * when promoteOperation is bound it comes here.
   */
  promoteOperation() {
    App.models.Operations.promoteOperation(this);
  }

  /**
   * Invoked from HTML. Operations are bound to this view model, so
   * when demoteOperation is bound it comes here.
   */
  demoteOperation() {
    App.models.Operations.demoteOperation(this);
  }

  /**
   * Remove the combined geometry (and toolpaths) contributed by this operation
   */
  removeCombinedGeometry() {
    if (this.previewSVG)
      this.previewSVG.remove();
    this.previewSVG = undefined;
    this.removeToolPaths();
    this.combinedGeometry = undefined;
  }

  /**
   * Remove the tool paths contributed by this operation
   */
  removeToolPaths() {
    if (this.toolPathSVG)
      this.toolPathSVG.remove();
    this.toolPathSVG = undefined;
    this.toolPaths(new CutPaths());
  }

  /**
   * Map from short (internal) generator name to long (translatable)
   * name from HTML
   * @param {string} shortName internal name e.g. "Pocket"
   * @return {string} user-friendly, trabslatable name e.g. "Pocket (raster)"
   */
  longOpName(shortName) {
    return document
    .querySelector(`#Generators [name='${shortName}']`)
    .textContent;
  }

  /**
   * Get the width of the path to be created by the tool as it cuts.
   * If the user specified width is less than the cutter diameter
   * then it uses the cutter diameter.
   * @return {number} in CutPoint units
   */
  toolPathWidth() {
    const td = App.models.Tool.cutterDiameter.toUnits("integer");
    const width = this.width.toUnits("integer");
    if (width < td)
      return td;
    return width;
  }

  /**
   * (Re)generate geometry and tool paths from the paths associated
   * with this operation, by applying the requested combination op
   * (Intersect, Union etc.) The geometry is kept in this.combinedGeometry,
   * and is also added to the combinedGeometry SVG group for preview.
   */
  recombine() {
    if (this.disableRecombination)
      return;

    this.removeCombinedGeometry();

    // Combined paths operations are only applied to closed paths
    const closedPaths = this.operandPaths.filter(p => p.isClosed);
    let geom = new CutPaths(closedPaths[0]);

    const bop = this.combineOp();
    if (bop === "Group")
      geom = closedPaths;
    else {
      for (let i = 1; i < closedPaths.length; i++) {
        const others = new CutPaths(closedPaths[i]);
        switch (bop) {
        case "Intersect":  geom = geom.intersect(others); break;
        case "Difference": geom = geom.difference(others); break;
        case "XOR":        geom = geom.xor(others); break;
        case "Union":      geom = geom.union(others); break;
        default: assert(false);
        }
      }
    }

    const openPaths = this.operandPaths.filter(p => !p.isClosed);
    for (const op of openPaths)
      geom.push(op);

    this.combinedGeometry = geom;

    if (this.combinedGeometry.length > 0) {
      const params = structuredClone(App.models.Approximation.approximations);
      params.margin = this.margin.toUnits("integer");
      params.width = this.toolPathWidth();

      const previewGeometry = this.toolpathGenerator.generatePreviewGeometry(
        this.combinedGeometry, params);

      if (previewGeometry.length > 0) {
        const segs = previewGeometry.toSegments();
        if (segs && segs.length > 0) {
          const svgel = document.createElementNS(
            'http://www.w3.org/2000/svg', "path");
          svgel.setAttribute("d", SVG.segments2d(segs));
          svgel.setAttribute("class", "combined-geometry");
          document.getElementById("CombinedGeometrySVGGroup")
          .append(svgel);
          this.previewSVG = svgel;
        }
      }
    }

    this.generateToolpaths();
  }

  /**
   * (Re)generate the tool path(s) for this operation. The tool paths are
   * kept in `this.toolPaths`. Generating toolPaths invalidates the Gcode,
   * so triggers `UPDATE_GCODE` to signal this.
   */
  generateToolpaths() {
    if (this.generatingToolpath)
      return;

    if (!this.combinedGeometry)
      return;

    this.generatingToolpath = true;

    //console.debug(`generateToolpath for the ${this.combinedGeometry.length} paths in ${this.name()}`);

    let geometry = this.combinedGeometry;

    const toolModel = App.models.Tool;
    const passDepth = (this.passDepth()
          ? this.passDepth : toolModel.passDepth).toUnits("integer");
    const stepOver = Number((this.stepOver())
                            ? this.stepOver()
                            : toolModel.stepOver());
    const zOnTop = App.models.Material.zOrigin() === "Top";
    const cutDepth = this.cutDepth.toUnits("integer");
    const clear = App.models.Material.clearance.toUnits("integer");

    const params = App.models.Approximation.approximations;
    params.cutterDiameter = toolModel.cutterDiameter.toUnits("integer");
    params.cutterAngle = toolModel.cutterAngle() * Math.PI / 180;
    params.cutDepth = cutDepth;
    params.overlap = 1 - stepOver / 100; // convert %age
    params.climb = (this.direction() === "Climb");
    params.safeZ = zOnTop ? clear : clear + cutDepth;
    params.topZ = zOnTop ? 0 : cutDepth;
    params.botZ = zOnTop ? -cutDepth : 0;
    params.width = Math.max(
      this.width.toUnits("integer"), params.cutterDiameter);
    params.spacing = this.spacing.toUnits("integer");
    params.margin = this.margin.toUnits("integer");
    params.strategy = this.strategy();

    const paths = this.toolpathGenerator.generateToolpaths(geometry, params);

    this.removeToolPaths();
    this.toolPaths(paths);

    //console.debug(`generated ${paths.length} tool paths for ${this.name()}`);

    this.generatingToolpath = false;

    // Signal this change to other listeners
    document.dispatchEvent(new Event("UPDATE_GCODE"));

    // Add the toolpaths to the SVG view
    const segs = this.toolPaths().toSegments();
    if (segs && segs.length > 0) {
      const svgel = document.createElementNS(
          'http://www.w3.org/2000/svg', "path");
      svgel.setAttribute("d", SVG.segments2d(segs));
      svgel.setAttribute("class", "tool-path");
      document.getElementById("ToolPathsSVGGroup").append(svgel);
      this.toolPathSVG = svgel;
    }
  }

  /**
   * Get the bounding box of the operation in CutPoint units.
   * @return {Rect?} bounding box in Cutpath units. Returns undefined
   * if the operation is not enabled, or doen't generate any paths.
   */
  boundingBox() {
    const paths = this.toolPaths();
    if (!this.enabled() || paths.length === 0)
      return undefined;

    // Expand the BB if necessary to account for the radius of the
    // tool cutting outside the tool path, Inside and Pocket ops
    // should already have accounted for it.
    const bloat = this.toolpathGenerator.bbBloat(this.toolPathWidth());

    let BB;
    for (const path of paths) {
      for (const point of path) {
        if (BB)
          BB.enclose(point.X - bloat, point.Y - bloat)
          .enclose(point.X + bloat, point.Y + bloat);
        else
          BB = new Rect(point.X - bloat, point.Y - bloat,
                        2 * bloat, 2 * bloat);
      }
    }
    return BB;
  }

  /**
   * @override
   */
  toJson() {
    const json = {
      operandPaths: this.operandPaths.toJson()
    };

    for (const f of FIELDS)
      if (this.needs(f))
        json[f] = this[f]();

    return json;
  };

  /**
   * @override
   */
  fromJson(json) {
    // suppress recombine until we're finished
    this.disableRecombination = true;
    for (const f of FIELDS)
      this.updateObservable(json, f);
    const genClass = GENERATORS[this.operation()];
    this.toolpathGenerator = new (genClass)();
    this.updateAvailableOperations();

    this.disableRecombination = false;
    this.recombine();
  };
}


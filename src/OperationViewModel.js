/*Copyright Tim Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */
/* global assert */

// import "knockout";
/* global ko */
/* global App */

import { ViewModel } from "./ViewModel.js";

import { CutPath } from "./CutPath.js";
import { CutPaths } from "./CutPaths.js";
import { Rect } from "./Rect.js";
import * as SVG from "./SVG.js";
import * as Cam from "./Cam.js";

const DEFAULT_RAMP = false;
const DEFAULT_COMBINEOP = "Union";
const DEFAULT_DIRECTION = "Conventional";
const DEFAULT_CUTDEPTH = 1;        // mm
const DEFAULT_MARGIN = 0;          // mm
const DEFAULT_SPACING = 1;         //mm
const DEFAULT_SPINDLESPEED = 1000; // rpm
const DEFAULT_WIDTH = 0;           //mm

const POPOVERS = [
  { id: "OpEnabled" },
  { id: "OpOperation" },
  { id: "OpCutDepth" },
  { id: "OpName" },
  { id: "OpRamp" },
  { id: "OpCombine" },
  { id: "OpDirection" },
  { id: "OpVMaxDepth" },
  { id: "OpMargin" },
  { id: "OpSpacing" },
  { id: "OpSpindleSpeed" },
  { id: "OpWidth" }
];

const FIELDS = [
  "name", "enabled", "combineOp", "operation", "cutDepth", "width",
  "direction", "spacing", "ramp", "margin", "spindleSpeed"
];

/**
 * ViewModel for an operation in the `Operations` card
 * @listens UPDATE_TOOL_PATHS signal to update all tool paths
 */
class OperationViewModel extends ViewModel {

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
     * combinedGeometry. One of "Union" (the default), "Intersect", "Diff"
     * or "Xor"
     * @member {observable.<string>}
     */
    this.combineOp = ko.observable(DEFAULT_COMBINEOP);
    this.combineOp.subscribe(() => {
      this.recombine();
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
    });

    /**
     * The available operations. This is based on the
     * the mix of open and closed paths in the operandPaths.
     */
    this.availableOperations = ko.observableArray([
      Cam.OP.Engrave,
      Cam.OP.Perforate,
      Cam.OP.Drill
    ]);

    if (operandPaths && operandPaths.filter(p => p.isClosed).length > 0) {
      this.availableOperations.push(
        Cam.OP.Inside,
        Cam.OP.Outside,
        Cam.OP.AnnularPocket,
        Cam.OP.RasterPocket);
    }

    /**
     * The operation type. Default is Engrave as it's simplest.
     * @member {observable.<string>}
     */
    this.operation = ko.observable(Cam.OP.Engrave);
    this.operation.subscribe(() => {
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
      this.generateToolPaths();
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
      this.generateToolPaths();
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
     * Spindle speed (only one supported)
     * @member {observable.<number>}
     */
    this.spindleSpeed = ko.observable(DEFAULT_SPINDLESPEED);
    this.spindleSpeed.subscribe(() => {
      document.dispatchEvent(new Event("PROJECT_CHANGED"));
      document.dispatchEvent(new Event("UPDATE_GCODE"));
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
      "UPDATE_TOOL_PATHS", () => this.generateToolPaths());
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
   * @override
   */
  initialise(nodes) {
    this.addPopovers(POPOVERS, nodes);
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
   * Get the width of the path to be created by the tool as it cuts.
   * If the user specified width is less than the cutter diameter
   * then it uses the cutter diameter.
   * @return {number} in CutPoint units
   */
  toolPathWidth() {
    const td = App.models.Tool.diameter.toUnits("integer");
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

    const oper = this.operation();

    this.removeCombinedGeometry();

    // Combined paths operations are only applied to closed paths
    const closedPaths = this.operandPaths.filter(p => p.isClosed);
    let geom = new CutPaths(closedPaths[0]);

    for (let i = 1; i < closedPaths.length; i++) {
      const others = new CutPaths(closedPaths[i]);
      switch (this.combineOp()) {
      case "Intersect": geom = geom.intersection(others); break;
      case "Diff":      geom = geom.diff(others); break;
      case "Xor":       geom = geom.xor(others); break;
      default:          geom = geom.union(others); break;
      }
    }
    const openPaths = this.operandPaths.filter(p => !p.isClosed);
    for (const op of openPaths)
      geom.push(op);

    this.combinedGeometry = geom;

    let previewGeometry = this.combinedGeometry;

    // TODO: this could be farmed off to an event handler
    if (previewGeometry.length > 0) {
      let off = this.margin.toUnits("integer");

      if (oper === Cam.OP.AnnularPocket
          || oper === Cam.OP.Inside)
        off = -off;

      if (oper !== Cam.OP.Engrave && off !== 0)
        previewGeometry = previewGeometry.offset(off);

      if (oper === Cam.OP.Inside
          || oper === Cam.OP.Outside
          || oper === Cam.OP.Perforate
          || oper === Cam.OP.Drill) {
        const width = this.toolPathWidth();
        if (oper === Cam.OP.Inside) {
          previewGeometry =
            previewGeometry.diff(previewGeometry.offset(-width));
        } else // Outside or Perforate or Drill
          previewGeometry =
            previewGeometry.offset(width).diff(previewGeometry);
      }

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

    this.generateToolPaths();
  }

  /**
   * (Re)generate the tool path(s) for this operation. The tool paths are
   * kept in `this.toolPaths`. Generating toolPaths invalidates the Gcode,
   * so triggers `UPDATE_GCODE` to signal this.
   */
  generateToolPaths() {
    if (this.generatingToolpath)
      return;

    if (!this.combinedGeometry)
      return;

    this.generatingToolpath = true;

    console.debug(`generateToolpath for the ${this.combinedGeometry.length} paths in ${this.name()}`);

    let geometry = this.combinedGeometry;
    const oper = this.operation();
    const toolModel = App.models.Tool;
    const toolDiameter = toolModel.diameter.toUnits("integer");
    const bitAngle = toolModel.angle();
    const passDepth = toolModel.passDepth.toUnits("integer");
    const stepover = toolModel.stepover();
    const climb = (this.direction() === "Climb");
    const zOnTop = App.models.Material.zOrigin() === "Top";
    const cutDepth = this.cutDepth();
    const clear = App.models.Material.clearance();
    const safeZ = zOnTop ? clear : clear + cutDepth;
    const botZ = zOnTop ? -cutDepth : 0;

    // inset/outset the geometry as dictated by the margin
    let off = this.margin.toUnits("integer");
    if (oper === Cam.OP.AnnularPocket
        || oper === Cam.OP.RasterPocket
        || oper === Cam.OP.Inside)
      off = -off; // inset
    if (oper !== Cam.OP.Engrave && off !== 0)
      geometry = geometry.offset(off);

    let paths, width;
    switch (oper) {

    case Cam.OP.AnnularPocket:
      paths = Cam.annularPocket(geometry, toolDiameter, 1 - stepover, climb);
      break;

    case Cam.OP.RasterPocket:
      paths = Cam.rasterPocket(geometry, toolDiameter, 1 - stepover, climb);
      break;

    case Cam.OP.Inside:
    case Cam.OP.Outside:
      width = this.width.toUnits("integer");
      if (width < toolDiameter)
        width = toolDiameter;
      paths = Cam.outline(
        geometry, toolDiameter,
        oper === Cam.OP.Inside, // isInside
        width,
        1 - stepover,
        climb);
      break;

    case Cam.OP.Perforate:
      paths = Cam.perforate(
        geometry, toolDiameter, this.spacing.toUnits("integer"),
        safeZ, botZ);
      break;

    case Cam.OP.Drill:
      paths = Cam.drill(geometry, safeZ, botZ);
      break;

    case Cam.OP.Engrave:
      paths = Cam.engrave(geometry, climb);
      break;
    }

    this.removeToolPaths();
    this.toolPaths(paths);

    console.debug(`generated ${paths.length} tool paths for ${this.name()}`);

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

    let overlap = 0, BB;
    // Expand the BB if necessary to account for the radius of the
    // tool cutting outside the tool path, Inside and Pocket ops
    // should already have accounted for it.
    const op = this.operation();
    if (op === Cam.OP.Engrave)
      overlap = this.toolPathWidth() / 2;
    else if (op === Cam.OP.Outside
             || op === Cam.OP.Perforate
             || op === Cam.OP.Drill)
      overlap = this.toolPathWidth();
    for (const path of paths) {
      for (const point of path) {
        if (BB)
          BB.enclose(point.X - overlap, point.Y - overlap)
          .enclose(point.X + overlap, point.Y + overlap);
        else
          BB = new Rect(point.X - overlap, point.Y - overlap,
                        2 * overlap, 2 * overlap);
      }
    }
    return BB;
  }

  /**
   * Determine which of the operation fields needs to be enabled for this
   * operation.
   * @param {string} what which field e.g. "width"
   * @return {boolean} true if the field is needed for the current op.
   * @private
   */
  needs(what) {
    const op = this.operation();
    switch (what) {
    case "width": return op === Cam.OP.Inside
      || op === Cam.OP.Outside;

    case "direction":
    case "ramp":  return op !== Cam.OP.Perforate
      && op !== Cam.OP.Drill;

    case "margin":  return op !== Cam.OP.Perforate
      && op !== Cam.OP.Drill
      && op !== Cam.OP.Engrave;

    case "spacing": return op === Cam.OP.Perforate;
    }
    return true;
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

    if (this.operandPaths.filter(p => p.isClosed).length > 0) {
      this.availableOperations.push(
        Cam.OP.Inside,
        Cam.OP.Outside,
        Cam.OP.AnnularPocket,
        Cam.OP.RasterPocket);
    }

    this.disableRecombination = false;
    this.recombine();
  };
}

export { OperationViewModel }

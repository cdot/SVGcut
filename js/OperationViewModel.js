/* global ClipperLib */ // ../lib/clipper_unminified-6.1.3.2.js

// import "knockout";
/* global ko */
/* global App */

import { ViewModel } from "./ViewModel.js";

import * as ClipperPaths from "./ClipperPaths.js";
import * as SnapPaths from "./SnapPaths.js";
import * as Cam from "./Cam.js";

/**
 * @typedef {object} RawPath
 * @property {SnapPath} path path segments
 * @property {boolean} nonzero winding rule
*/

/**
 * ViewModel for an operation in the `Operations` card
 */
class OperationViewModel extends ViewModel {

  /**
   * @param {UnitConverter} unit converter to use
   * @param {RawPath[]} rawPaths input paths to the operation
   * @param {boolean} disableRecombination true to stop recombination,
   * usually because we are in a sequence of steps and recombination can
   * wait.
   */
  constructor(unitConverter, rawPaths, disableRecombination = false) {
    super(unitConverter);

    /**
     * Flag to stop recombination, usually because we are in a
     * sequence of steps and recombination can wait.
     * @member {boolean}
     * @private
     */
    this.disableRecombination = disableRecombination;

    /**
     * Flag to lock out toolpath generation.
     * @member {boolean}
     * @private
     */
    this.generatingToolpath = false;

    /**
     * The input to this operation.
     * @member {RawPath[]}
     * @private
     */
    this.rawPaths = rawPaths;

    /**
     * Geometry generated by combining all the paths in this operation
     * using combineOp
     * @member {ClipperPath[]}
     * @private
     */
    this.combinedGeometry = [];

    /**
     * The operation used to combine raw paths to generate the resulting
     * combinedGeometry. One of "Union" (the default), "Intersect", "Diff"
     * or "Xor"
     * @private
     */
    this.combineOp = ko.observable("Union");
    this.combineOp.subscribe(() => this.recombine());

    /**
     * The operation, one of "Pocket", "Inside", "Outside" or "Engrave".
     * The default is "Pocket"
     * @member {string}
     */
    this.operation = ko.observable("Pocket");
    this.operation.subscribe(() => this.recombine());

    /**
     * The UI button that opens the detail pane for this operation
     * @private
     */
    this.showDetail = ko.observable(false);

    /**
     * The (optional, user provided) name of ths operation
     * @member string}
     * @private
     */
    this.name = ko.observable("");
    this.name.subscribe(() => {
      if (!this.generatingToolpath)
        document.dispatchEvent(new Event("toolPathsChanged"));
    });

    /**
     * Operations can be selectively enabled/disabled for Gcode
     * generation
     * @member {boolean}
     * @private
     */
    this.enabled = ko.observable(true);
    this.enabled.subscribe(newValue => {
      let v = newValue ? "visible" : "hidden";
      if (this.combinedGeometrySvg)
        this.combinedGeometrySvg.attr("visibility", v);
      if (this.toolPathSvg)
        this.toolPathSvg.attr("visibility", v);
    });
    this.enabled.subscribe(() => {
      if (!this.generatingToolpath)
        document.dispatchEvent(new Event("toolPathsChanged"));
    });

    /**
     * SMELL: dunno what this does
     * @member {boolean}
     */
    this.ramp = ko.observable(false);

    /**
     * Either "Conventional" or "Climb"
     * SMELL: dunno what this does
     */
    this.direction = ko.observable("Conventional");
    this.direction.subscribe(() => this.removeToolPaths());

    /**
     * Reference to SVG group that is used to display combined geometry
     * @member {SVGGaphicsElement}
     * @private
     */
    this.combinedGeometrySvg = null;

    /**
     * Paths taken by the tool to execute this operation
     * @member {CamPath[]}
     */
    this.toolPaths = ko.observable([]);
    this.toolPaths.subscribe(() => {
      if (!this.generatingToolpath)
        document.dispatchEvent(new Event("toolPathsChanged"));
    });

    /**
     * Svg path generated to show the tool path. Will be held in
     * App.toolPathsSvgGroup
     * @member {SVGElement}
     * @private
     */
    this.toolPathSvg = null;

    /**
     * Depth to cut on each pass. Mirrors passDepth in the Tool model.
     * @member {number}
     */
    this.cutDepth = ko.observable(0);
    unitConverter.add(this.cutDepth);
    this.cutDepth(App.models.Tool.passDepth());

    /**
     * Amount of material to leave uncut
     * @member {number}
     * @private
     */
    this.margin = ko.observable(0);
    unitConverter.add(this.margin);
    this.margin.subscribe(() => this.recombine());

    /**
     * How wide a path to cut. If this is less than the cutter diameter
     * it will be rounded up.
     */
    this.width = ko.observable(0);
    unitConverter.add(this.width);
    this.width.subscribe(() => this.recombine());

    this.recombine();
  }

  // @override
  initialise(nodes) {
    this.addPopovers([
      { id: "opEnabled" },
      { id: "opGenerate" },
      { id: "opName" },
      { id: "opRamp" },
      { id: "opCombine" },
      { id: "opDirection" },
 //CPP     { id: "opVMaxDepth" },
      { id: "opMargin" },
      { id: "opWidth" }
    ], nodes);
  }

  toggleDetail() {
    this.showDetail(!this.showDetail());
  }

  /**
   * Remove this operation
   */
  removeOperation() {
    this.removeCombinedGeometrySvg();
    this.removeToolPaths();
    App.models.Operations.removeOperation(this);
  }

  /**
   * Remove the SVG geometry contributed by this operation
   */
  removeCombinedGeometrySvg() {
    if (this.combinedGeometrySvg)
      this.combinedGeometrySvg.remove();
    this.combinedGeometrySvg = null;
  }

  /**
   * Remove the tool path geometry contributed by this operation
   */
  removeToolPaths() {
    if (this.toolPathSvg) {
      this.toolPathSvg.remove();
      this.toolPathSvg = null;
      this.toolPaths([]);
    }
  }

  /**
   * Get the width of the path created by the tool as it cuts
   * @return {number} in internal units
   */
  toolPathWidth() {
    const td = App.models.Tool.diameter.toUnits("internal");
    const width = this.width.toUnits("internal");
    if (width < td)
      return td;
    return width;
  }

  /**
   * (Re)generate combinedGeometry from the paths associated with this
   * operation (this.rawPaths)
   */
  recombine() {
    if (this.disableRecombination)
      return;

    const startTime = Date.now();
    console.debug("recombine...");

    this.removeCombinedGeometrySvg();
    this.removeToolPaths();

    const all = [];
    for (const rp of this.rawPaths) {
      const geometry = SnapPaths.toInternal(rp.path);
      const fillRule = rp.nonzero
            ? ClipperLib.PolyFillType.pftNonZero
            : ClipperLib.PolyFillType.pftEvenOdd;
      all.push(ClipperPaths.simplifyAndClean(geometry, fillRule));
    }

    if (all.length == 0)
      this.combinedGeometry = [];
    else {
      let clipType;
      switch (this.combineOp()) {
      case "Intersect": clipType = ClipperLib.ClipType.ctIntersection; break;
      case "Diff":      clipType = ClipperLib.ClipType.ctDifference; break;
      case "Xor":       clipType = ClipperLib.ClipType.ctXor; break;
      case "Union":
      default:          clipType = ClipperLib.ClipType.ctUnion; break;
      }
      // Merge
      this.combinedGeometry = all[0];
      for (let i = 1; i < all.length; ++i)
        this.combinedGeometry = ClipperPaths.clip(
          this.combinedGeometry, all[i], clipType);
    }

    let previewGeometry = this.combinedGeometry;

    if (previewGeometry.length != 0) {
      let off = this.margin.toUnits("internal");
      if (this.operation() == "Pocket"
          //CPP || this.operation() == "V Pocket"
          || this.operation() == "Inside")
        off = -off;
      if (this.operation() != "Engrave" && off != 0) {
        previewGeometry = ClipperPaths.offset(previewGeometry, off);
      }

      if (this.operation() == "Inside" || this.operation() == "Outside") {
        const width = this.toolPathWidth();
        if (this.operation() == "Inside")
          previewGeometry = ClipperPaths.diff(
            previewGeometry, ClipperPaths.offset(previewGeometry, -width));
        else
          previewGeometry = ClipperPaths.diff(
            ClipperPaths.offset(previewGeometry, width), previewGeometry);
      }
    }

    if (previewGeometry.length != 0) {
      const path = SnapPaths.fromInternal(previewGeometry);
      if (path != null) {
        // Add the new geometry to the global SVG group
        this.combinedGeometrySvg = App.cgSvgGroup
        .path(path)
        .attr("class", "combinedGeometry");
      }
    }

    if (App.options.profile)
      console.debug(`recombine took ${Date.now() - startTime}`);

    this.enabled(true);
  }

  /**
   * Generate the tool path(s) for this operation. The tool paths
   * are type CamPath and are written to `this.toolPaths`.
   */
  generateToolPath() {
    const toolCamArgs = App.models.Tool.getCamArgs();

    const startTime = Date.now();
    console.debug("generateToolPath...");

    this.generatingToolpath = true;
    this.removeToolPaths();

    let geometry = this.combinedGeometry;

    let off = this.margin.toUnits("internal");
    if (this.operation() == "Pocket"
        //CPP || this.operation() == "V Pocket"
        || this.operation() == "Inside")
      off = -off;
    if (this.operation() !== "Engrave" && off != 0)
      geometry = ClipperPaths.offset(geometry, off);

    let paths;
    switch (this.operation()) {
    case "Pocket":
      paths = Cam.pocket(geometry, toolCamArgs.diameter,
                   1 - toolCamArgs.stepover,
                   this.direction() == "Climb");
      break;
    /* CPP
    case "V Pocket":
      paths = Cam.vPocket(geometry, App.models.Tool.angle(),
        toolCamArgs.passDepthClipper, this.cutDepth.toUnits("internal"),
        toolCamArgs.stepover, this.direction() == "Climb"));
      break;
    */
    case "Inside": case "Outside":
      let width = this.width.toUnits("internal");
      if (width < toolCamArgs.diameter)
        width = toolCamArgs.diameter;
      paths = Cam.outline(geometry, toolCamArgs.diameter,
                          this.operation() == "Inside", width,
                          1 - toolCamArgs.stepover,
                          this.direction() == "Climb");
      break;
    case "Engrave":
      paths = Cam.engrave(geometry, this.direction() == "Climb");
    }
    this.toolPaths(paths);

    // Display the computer toolpaths
    const path = SnapPaths.fromInternal(
      ClipperPaths.fromCamPaths(this.toolPaths()));
    if (path != null && path.length > 0) {
      this.toolPathSvg = App.toolPathsSvgGroup
      .path(path)
      .attr("class", "toolPath");
    }

    if (App.options.profile)
      console.debug(`generateToolPath took ${Date.now() - startTime}`);

    this.enabled(true);
    this.generatingToolpath = false;
    document.dispatchEvent(new Event("toolPathsChanged"));
  }

  // @override
  toJson() {
    const result = {
      rawPaths: this.rawPaths,
      name: this.name(),
      enabled: this.enabled(),
      combineOp: this.combineOp(),
      operation: this.operation()
    };
    /* CPP
    if (this.operation() != 'V Pocket') { */
      result.direction = this.direction();
      result.cutDepth = this.cutDepth();
      result.ramp = this.ramp();
    /*CPP }*/
    if (this.operation() != 'Engrave')
      result.margin = this.margin();
    if (this.operation() == 'Inside' || this.operation() == 'Outside')
      result.width = this.width();
    return result;
  };

  // @override
  fromJson(json) {
    // suppress recombine until we're finished
    this.disableRecombination = true;

    this.rawPaths = json.rawPaths;
    this.updateObservable(json, 'name');
    this.updateObservable(json, 'ramp');
    this.updateObservable(json, 'combineOp');
    if (json.operation == "Outline")
      this.operation('Outside'); // compatibility, I guess
    else
      this.updateObservable(json, 'operation');
    this.updateObservable(json, 'direction');
    this.updateObservable(json, 'cutDepth');
    this.updateObservable(json, 'margin');
    this.updateObservable(json, 'width');

    // backwards compat: each rawPaths[i] used to be an array
    // instead of an object
    for (let i = 0; i < this.rawPaths.length; ++i)
      if (this.rawPaths[i] instanceof Array)
        this.rawPaths[i] = {
          path: this.rawPaths[i],
          nonzero: false
        };

    this.disableRecombination = false;
    this.recombine();
    this.updateObservable(json, 'enabled');
  };
}

export { OperationViewModel }

// import "snapsvg";
/* global Snap */
// import "knockout";
/* global ko */
// import "bootstrap";
/* global bootstrap */

/* global JSCut */
import { OperationViewModel } from "./OperationViewModel.js";
import { ViewModel } from "./ViewModel.js";

/**
 * ViewModel for the `Operations` card
 */
class OperationsViewModel extends ViewModel {

  /**
   * @param {UnitConverter} unitConverter the UnitConverter to use
   */
  constructor(unitConverter) {
    super(unitConverter);

    this.operations = ko.observableArray();

    // Bounding box for all operation tool paths
    // All in Clipper coords
    this.bbMinX = ko.observable(0);
    this.bbMinY = ko.observable(0);
    this.bbMaxX = ko.observable(0);
    this.bbMaxY = ko.observable(0);

    JSCut.models.Tool.stepover.subscribe(() => {
      for (const op of this.operations())
        op.removeToolPaths();
    });

    JSCut.models.Tool.diameter.subscribe(() => {
      for (const op of this.operations())
        op.recombine();
    });
  }

  // @override
  initialise() {
    this.addPopovers([
      {
        id: "createOperationButton",
        trigger: "manual"
      }]);

    const cob = document.getElementById('createOperationButton');
    cob.parentElement.addEventListener("mouseenter", () => {
      if (cob.disabled) {
        const popover = bootstrap.Popover.getInstance(cob);
        popover.show();
      }
    });
    cob.parentElement.addEventListener("mouseleave", () => {
      const popover = bootstrap.Popover.getInstance(cob);
      popover.hide();
    });

    ko.applyBindings(this, document.getElementById("OperationsCard"));
  }

  /**
   * Find Min/Max of tool paths
   * @private
   */
  findMinMax() {
    let minX = Number.MAX_VALUE, maxX = Number.MIN_VALUE,
        minY = Number.MAX_VALUE, maxY = Number.MIN_VALUE;
    for (const op of this.operations()) {
      if (op.enabled() && op.toolPaths() != null) {
        for (const tp of op.toolPaths()) {
          // toolPaths are CamPaths
          const toolPath = tp.path;
          for (const point of toolPath) {
              minX = Math.min(minX, point.X);
              minY = Math.min(minY, point.Y);
              maxX = Math.max(maxX, point.X);
              maxY = Math.max(maxY, point.Y);
          }
        }
      }
    }
    this.bbMinX(minX);
    this.bbMaxX(maxX);
    this.bbMinY(minY);
    this.bbMaxY(maxY);
  }
  
  tutorialGenerateToolpath() {
    if (this.operations().length > 0)
      JSCut.tutorial(4, 'Click "Generate".');
  };

  addOperation() {
    // Get the paths from the current selection
    const rawPaths = [];
    JSCut.models.Selection.getSelection().forEach(element => {
      const ps = element.attr('d');
      rawPaths.push({ // @see OperationViewModel.RawPath
        // @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/d
        path: Snap.parsePathString(ps),
        nonzero: element.attr("fill-rule") != "evenodd"
      });
    });
    JSCut.models.Selection.clearSelection();

    // Construct the operation view model
    const op = new OperationViewModel(this.unitConverter, rawPaths);
    this.operations.push(op);
    op.enabled.subscribe(() => this.findMinMax());
    op.toolPaths.subscribe(() => this.findMinMax());

    this.tutorialGenerateToolpath();
  };

  /**
   * Remove the given operation from consideration
   * @param {OperationViewModel} operation the operation to remove
   */
  removeOperation(operation) {
    this.operations.remove(operation);
  };

  /**
   * Used in data-bind for enabling Create Operation button
   * @return {boolean} true if something is selected in the SVG
   */
  isSomethingSelected() {
    return JSCut.models.Selection.numSelected() > 0;
  }

  // @override
  get jsonFieldName() { return "operations"; }

  // @override
  toJson() {
    return { 
      operations: this.operations().map(op => op.toJson())
    };
  }

  // @override
  fromJson(json) {
    for (const op of this.operations()) {
      op.removeCombinedGeometrySvg();
      op.removeToolPaths();
    }

    this.operations.removeAll();

    for (const opJson of json.operations) {
      const op = new OperationViewModel([], true);
      op.fromJson(opJson);
      this.operations.push(op);
      op.enabled.subscribe(() => this.findMinMax());
      op.toolPaths.subscribe(() => this.findMinMax());
    }

    this.findMinMax();
  }
}

export { OperationsViewModel }

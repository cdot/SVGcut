/*Copyright Tim Fleming, Crawford Currie 2014-2024. This file is part of SVG2Gcode, see the copyright and LICENSE at the root of the distribution. */

// import "snapsvg";
/* global Snap */
// import "knockout";
/* global ko */
// import "bootstrap";
/* global bootstrap */

/* global App */
import { OperationViewModel } from "./OperationViewModel.js";
import { ViewModel } from "./ViewModel.js";
import { Rect } from "./Rect.js";

/**
 * ViewModel for the `Operations` card
 */
class OperationsViewModel extends ViewModel {

  /**
   * @param {UnitConverter} unitConverter the UnitConverter to use
   */
  constructor(unitConverter) {
    super(unitConverter);

    /**
     * List of operations
     * @member {observableArray.OperationViewModel}
     */
    this.operations = ko.observableArray();

    /**
     * Bounding box for all operation tool paths in internal units
     * @member {observable.<Rect>}
     */
    this.boundingBox = ko.observable(new Rect());

    App.models.Tool.stepover.subscribe(() => {
      for (const op of this.operations())
        op.removeToolPaths();
    });

    App.models.Tool.diameter.subscribe(() => {
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

    ko.applyBindings(this, document.getElementById("OperationsView"));
  }

  /**
   * Get the bounding box for all operations. The bounding box wraps
   * the entire cut path, not just the tool path, so all removed
   * material should be encompassed. Units are "internal".
   * @return {Rect}
   */
  getBBox() {
    return this.boundingBox();
  }

  /**
   * Refresh the bounding box by inspecting tool paths.
   * @private
   */
  updateBB() {
    let newBB;
    for (const op of this.operations()) {
      if (op.enabled() && op.toolPaths() != null) {
        let overlap = 0;
        // Expand the BB if necessary to account for the radius of the
        // tool cutting outside the tool path, "Inside" and "Pocket"
        // should already have accounted for it.
        if (op.operation() === "Engrave" || op.operation() === "Outside")
          overlap = op.toolPathWidth() / 2;
        for (const tp of op.toolPaths()) {
          const toolPath = tp.path; // toolPaths are CamPaths
          for (const point of toolPath) {
            if (!newBB)
              newBB = new Rect(point.X - overlap, point.Y - overlap,
                                     2 * overlap, 2 * overlap);
            else {
              newBB.enclose(point.X - overlap, point.Y - overlap)
                   .enclose(point.X + overlap, point.Y + overlap);
            }
          }
        }
      }
    }
    if (newBB)
      this.boundingBox(newBB);
  }

  addOperation() {
    // Get the paths from the current selection
    const rawPaths = [];
    App.models.Selection.getSelection().forEach(element => {
      // see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/d
      const ps = element.attr('d');
      // SMELL: this should be a CamPath, shouldn't it?
      rawPaths.push({ // @see OperationViewModel.RawPath
        path: Snap.parsePathString(ps),
        nonzero: element.attr("fill-rule") != "evenodd"
      });
    });
    App.models.Selection.clearSelection();

    // Construct the operation view model
    const op = new OperationViewModel(this.unitConverter, rawPaths);
    this.operations.push(op);
    // Give it a random name
    op.name(`Op${this.operations.length + 1}`);
    op.enabled.subscribe(() => this.updateBB());
    op.toolPaths.subscribe(() => this.updateBB());

    App.tutorial(4);
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
    return App.models.Selection.isSomethingSelected();
  }

  // @override
  jsonFieldName() { return "operations"; }

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
      op.enabled.subscribe(() => this.updateBB());
      op.toolPaths.subscribe(() => this.updateBB());
    }

    this.updateBB();
  }
}

export { OperationsViewModel }

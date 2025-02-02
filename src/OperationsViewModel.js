/*Copyright Tim Fleming, Crawford Currie 2014-2024. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

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
     * List of operations.
     * @member {observableArray.OperationViewModel}
     */
    this.operations = ko.observableArray();

    /**
     * Bounding box for all operation tool paths in internal units
     * @member {observable.<Rect>}
     */
    this.boundingBox = ko.observable(new Rect());
  }

  /**
   * @override
   */
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
   * material should be encompassed.
   * @return {ClipperLib.IntRect}
   */
  getBounds() {
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
        // tool cutting outside the tool path, Inside and Pocket ops
        // should already have accounted for it.
        if (op.operation() === App.Ops.Engrave)
            overlap = op.toolPathWidth() / 2;
        else if (op.operation() === App.Ops.Outside
                 || op.operation() === App.Ops.Perforate
                 || op.operation() === App.Ops.Drill)
          overlap = op.toolPathWidth();
        for (const camPath of op.toolPaths()) {
          for (const point of camPath) {
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

  /**
   * Invoked from #OperationsViewPane
   */
  addOperation() {
    // Get integer paths from the current selection
    const operands = App.models.Selection.getSelectedPaths();
    const op = new OperationViewModel(this.unitConverter, operands);
    op.recombine();
    this.operations.push(op);

    // Give it a random name
    op.name(`Op${this.operations.length + 1}`);
    op.enabled.subscribe(() => this.updateBB());
    op.toolPaths.subscribe(() => this.updateBB());

    op.generateToolPaths();

    App.tutorial(4);
  };

  /**
   * Remove the given operation.
   * @param {OperationViewModel} op the operation to remove
   */
  removeOperation(op) {
    op.removeCombinedGeometry();
    op.removeToolPaths();
    this.operations.remove(op);
    document.dispatchEvent(new Event("UPDATE_GCODE"));
  };

  /**
   * (Re)generate combinedGeometry from the paths associated with all
   * operations and recompile tool paths.
   */
  recombine() {
    for (const op of this.operations())
      op.recombine();
  }

  /**
   * Used in data-bind for enabling Create Operation button
   * @return {boolean} true if something is selected in the SVG
   */
  isSomethingSelected() {
    return App.models.Selection.isSomethingSelected();
  }

  /**
   * @override
   */
  jsonFieldName() { return "operations"; }

  /**
   * @override
   */
  reset() {
    for (const op of this.operations()) {
      op.removeCombinedGeometry();
      op.removeToolPaths();
    }
    this.operations.removeAll();
  }

  /**
   * @override
   */
  toJson(template) {
    if (template)
      return undefined;
    return {
      operations: this.operations().map(op => op.toJson())
    };
  }

  /**
   * @override
   */
  fromJson(json) {
    if (json.operations) {
      for (const opJson of json.operations) {
        const op = new OperationViewModel(this.unitConverter, []);
        op.fromJson(opJson);
        // Don't need to op.recombine(), it's already in the json
        this.operations.push(op);
        op.enabled.subscribe(() => this.updateBB());
        op.toolPaths.subscribe(() => this.updateBB());
      }
    }

    document.dispatchEvent(new Event("UPDATE_GCODE"));
    this.updateBB();
  }
}

export { OperationsViewModel }

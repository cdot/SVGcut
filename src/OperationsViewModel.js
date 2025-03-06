/*Copyright Todd Fleming, Crawford Currie 2014-2024. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

// import "knockout";
/* global ko */

// import "bootstrap";
/* global bootstrap */

/* global App */
import { OperationViewModel } from "./OperationViewModel.js";
import { ViewModel } from "./ViewModel.js";
import { CutPaths } from "./CutPaths.js";
import { Rect } from "./Rect.js";

/**
 * ViewModel for the `Operations` card
 * @extends ViewModel
 */
export class OperationsViewModel extends ViewModel {

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

    /**
     * Can an operation be added? Parameters have to be valid, and there
     * has to be a selection
     * @return {boolean} true if an operation can be added
     */
    this.canAddOperation = ko.computed(() => 
      App.inputsAreValid()
      && App.models.Selection.isSomethingSelected());
  }

  /**
   * @override
   */
  bind() {
    super.bind("OperationsView");
  }

  /**
   * Get the bounding box for all operations, in CutPoint coordinates.
   * The bounding box wraps the entire cut path, not just the tool
   * path, so all removed material should be encompassed.
   * @return {Rect}
   */
  getBounds() {
    return this.boundingBox(); // ask the observable
  }

  /**
   * Refresh the bounding box by inspecting tool paths.
   * @private
   */
  updateBB() {
    let newBB;
    for (const op of this.operations()) {
      const opBB = op.boundingBox();
      if (opBB) {
        if (newBB)
          newBB.enclose(opBB);
        else
          newBB = opBB;
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
    // Give it a random name
    op.name(`Op${this.operations().length + 1}`);
    this.operations.push(op);
    op.enabled.subscribe(() => this.updateBB());
    op.toolPaths.subscribe(() => this.updateBB());

    // Trigger the toolpath generation pipeline
    op.recombine();
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
   * Promote the given operation.
   * @param {OperationViewModel} op the operation to remove
   */
  promoteOperation(op) {
    const where = this.operations.indexOf(op);
    if (where === 0 || this.operations.length === 1) return;
    this.operations.remove(op);
    this.operations.splice(where - 1, 0, op);
    document.dispatchEvent(new Event("UPDATE_GCODE"));
  };

  /**
   * Demote the given operation.
   * @param {OperationViewModel} op the operation to remove
   */
  demoteOperation(op) {
    const where = this.operations.indexOf(op);
    if (where === this.operations.length - 1) return;
    this.operations.remove(op);
    this.operations.splice(where + 1, 0, op);
    document.dispatchEvent(new Event("UPDATE_GCODE"));
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
  isValid() {
    if (!super.isValid())
      return false;
    for (const op of this.operations())
      if (!op.isValid())
        return false;
    return true;
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
        const op = new OperationViewModel(
          this.unitConverter,
          CutPaths.fromJson(opJson.operandPaths));
        op.fromJson(opJson);
        this.operations.push(op);
        op.enabled.subscribe(() => this.updateBB());
        op.toolPaths.subscribe(() => this.updateBB());
        op.recombine();
      }
    }
    this.updateBB();
  }
}


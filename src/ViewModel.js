/*Copyright Crawford Currie 2024. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

// import "bootstrap"
/* global bootstrap */
// import "knockout"
/* global ko */

/**
 * Base class of all view models. There is a view model for each main panel
 * in the UI.
 * Some view models (OperationsViewModel, TabsViewModel) support dynamic
 * tables of sub-views.
 *
 */
class ViewModel {

  /**
   * Models that bind to UI components that can be expressed in
   * different units require a unit converter. If the model has no such
   * components, a unit converter is not required.
   * @param {UnitConverter?} unitConverter the UnitConverter to use
   */
  constructor(unitConverter) {
    /**
     * Unit converter for this model. May be undefined.
     * @member {UnitConverter?}
     */
    this.unitConverter = unitConverter;
  }

  /**
   * Apply popovers. Locations to attach popovers are identified by
   * the element id, which is matched in the `#Popovers` div in HTML.
   * @param {Node|NodeList} nodes (list of) nodes to apply the popovers on.
   * @protected
   */
  addPopovers(nodes) {

    function connectHelper(node, trigger) {
      const id = node.getAttribute("name") ?? node.id;
      const pot = document.querySelector(`#Popovers [name="${id}"]`);
      if (!pot)
        throw new Error(`No #Popovers [name="${id}"]`);
      if (!trigger)
        node.classList.add("btn", "btn-link");
      new bootstrap.Popover(node, {
        title: pot.getAttribute("title") ?? id,
        trigger: trigger ?? "focus",
        html: true,
        container: "body",
        content: pot.innerHTML,
        placement: "top"
      });
    }

    if (Array.isArray(nodes)) {
      for (const node of nodes)
        this.addPopovers(node);
    } else if (nodes.querySelectorAll) {
      let candidates = nodes.querySelectorAll(".hover-help");
      for (const node of candidates)
        connectHelper(node, "hover");

      candidates = nodes.querySelectorAll(".manual-popover");
      for (const node of candidates)
        connectHelper(node, "manual");

      candidates = nodes.querySelectorAll(".helper");
      for (const node of candidates) {
        connectHelper(node);
      }
    }
  }

  /**
   * Apply bindings and create popovers. Inteded to be overridden
   * in subclasses which know their id's.
   */
  bind(id) {
    if (id) {
      const el = document.getElementById(id);
      ko.applyBindings(this, el);
      this.addPopovers(el);
    }
  }

  /**
   * This is invoked by knockout via an afterRender handler, to
   * connect popovers to the components of the subview. Note that
   * it is invoked without 'this' being set.
   * @param {NodeList} nodes nodes to decorate
   * @param {ViewModel} subview subview model instance (OperationViewModel
   * or TabViewModel)
   * @protected
   */
  addSubview(nodes, subview) {
    subview.addPopovers(nodes);
  }

  /**
   * For top level views, apply bindings and popovers, and any other
   * late initialisation.
   * For Subviews only, this is invoked from addSubview to bind
   * popovers onto the components of the subview.
   * @param {NodeList?} nodes list of nodes (only for Subviews)
   */
  initialise() {
  }

  /**
   * Reset, removing all geometry. Virtual, intended to be implemented
   * by subclasses.
   */
  reset() {
  }

  /**
   * Get the field name to use for this model when serializing. It
   * must be unique for each view model.
   */
  jsonFieldName() {
    throw new Error("Pure virtual");
  }

  /**
   * Populate a structure that is serialisable to JSON.
   * @param {boolean} template true if caller is only serialising a project
   * template, not the actual project. A template consists just of the
   * settings for the view model, and not the data (tool paths etc).
   * @return {object?} an object suitable for serialisation, or undefined
   * if there is nothing to serialise
   */
  toJson(template) {
    return undefined;
  }

  /**
   * Reconstruct from a structure created by `toJson`.
   * @param {object} json the structure being recreated from.
   */
  fromJson(json) {
  }

  /**
   * Convenience support for `fromJson` methods in subclasses.
   * Update the value in an observable iff it is defined.
   * @param {object} json structure rebuilt from JSON
   * @param {string} key the key
   * @protected
   */
  updateObservable(json, key) {
    if (typeof json[key] !== "undefined")
      this[key](json[key]);
  }
}

export { ViewModel }

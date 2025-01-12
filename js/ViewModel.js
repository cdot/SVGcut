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
     * Unit converter for this model. May be null/undefined.
     * @member {UnitConverter?}
     */
    this.unitConverter = unitConverter;
  }

  /**
   * Apply popovers. Locations to attach popovers are identified by
   * the element id, which is matched in the `#popovers` div in HTML.
   * If `nodes` are passed, then the id's of those nodes (and their
   * descendants) will be matched agains the keys in popovers, and the
   * popovers only applied if there is a match. If nodes are not
   * passed, then the id's are looked up in the document.
   * @param {object?} popovers a map from id to popover info {pos, text}
   * @param {NodeList} nodes list of nodes to apply the popovers on.
   * @protected
   */
  addPopovers(popovers, nodes) {
    if (!popovers)
      return;

    // Get the HTML for the popover associated with the given id
    function getHTML(id) {
      const pot = document.querySelector(`#popovers>[name="${id}"]`);
      if (!pot)
        throw new Error(`No #popovers>[name="${id}"]`);
      return pot.innerHTML;
    }

    // Handle a mousein on a popovered element
    function popoverHover(element, po) {
      if (element && po) {
        new bootstrap.Popover(element, {
          trigger: po.trigger ?? "hover",
          html: true,
          container: "body",
          content: po.content ?? getHTML(element.id),
          placement: po.placement ?? "top"
        });
      }
    }

    if (nodes) {
      // Apply popovers to nodes and their descendants
      const pol = {};
      popovers.map(po => pol[po.id] = po);

      // Recursively explore a list of child nodes
      function explore(nodes) {
        if (nodes)
          for (const node of nodes) {
            if (node.id in pol)
              popoverHover(node, pol[node.id]);
            explore(node.childNodes);
          }
      }
      explore(nodes);
    } else {
      // Apply popovers to elements found in the document
      for (const po of popovers)
        popoverHover(document.getElementById(po.id), po);
    }
  }

  /**
   * Top level views only. This is invoked by knockout
   * via an afterRender handler, to connect popovers to the components
   * of the subview. Note that this is invoked without 'this' being set.
   * @param {NodeList} nodes nodes to decorate
   * @param {ViewModel} subview subview model instance
   * @protected
   */
  addSubview(nodes, subview) {
    subview.initialise(nodes);
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

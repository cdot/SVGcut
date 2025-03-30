/*Copyright Todd Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */
/* global assert */

import { Rect } from "./Rect.js";

// Define transformations for different unit types to integer units.
const INTEGER_PER_MM   = 100000; // millimetres
const INTEGER_PER_INCH = 25.4 * INTEGER_PER_MM; // inches
// Browsers assume a fixed conversion of pixels to mm of
// 25.4/96 (96 dpi).
const INTEGER_PER_PX = INTEGER_PER_INCH / 96;

// toFixed does wierd stuff. This is a reliable way to round to
// a number of decimal places.
function roundTo(n, places = 0) {
  const multiplicator = Math.pow(10, places);
  n = parseFloat((n * multiplicator).toFixed(11));
  return Math.round(n) / multiplicator;
}

/**
 * Significant decimal places of a value after conversion from one
 * set of units to another.
 */
const PLACES = {
  integer: 1,
  px: 2,
  mm: 4,
  inch: 5
};

/**
 * Instances of this class maintain a set of inputs that show a value
 * in user-selected units. The class attaches observables that support
 * the conversion of these values into other units. Unit systems supported
 * are: `mm`, `inch`, `px` and `integer`. Integer units are designed to
 * scale up numbers for more accurate integer operations on geometry.
 */
export class UnitConverter {

  /**
   * Literate code; mm = inches * UnitConverter.from.inch.to.mm
   */
  static from = {
    mm: {
      to: {
        mm: 1,
        integer: INTEGER_PER_MM,
        inch: INTEGER_PER_MM / INTEGER_PER_INCH,
        px: INTEGER_PER_MM / INTEGER_PER_PX
      }
    },
    integer: {
      to: {
        mm: 1 / INTEGER_PER_MM,
        integer: 1,
        inch: 1 / INTEGER_PER_INCH,
        px: 1 / INTEGER_PER_PX
      }
    },
    inch: {
      to: {
        mm: INTEGER_PER_INCH / INTEGER_PER_MM,
        integer: INTEGER_PER_INCH,
        inch: 1,
        px: INTEGER_PER_INCH / INTEGER_PER_PX
      }
    },
    px: {
      to: {
        mm: INTEGER_PER_PX / INTEGER_PER_MM,
        integer: INTEGER_PER_PX,
        inch: INTEGER_PER_PX / INTEGER_PER_INCH,
        px: 1
      }
    }
  };

  /**
   * List of observables that must be rescaled when the units change.
   * @member {observable[]}
   */
  #unitsObservables = [];

  #uon = [];

  /**
   * Cache of the units current in use in the context. This is required
   * so we know what the uints were before they were changed by an interaction.
   * @member {string}
   */
  #currentUnits = "mm";

  /**
   * Observable that defines the units in use.
   */
  units = undefined;

  /**
   * Construct to observe an observable that defines the current
   * units in use in the content where the UnitConverter is
   * instantiated. Different view models can have different unit
   * systems.
   * @param {observable} units the observable that defines the units
   * in use where the converter is employed.
   */
  constructor(units) {
    this.units = units;
    this.#currentUnits = units();

    // Subscribe to the observable that defines the units currently
    // in use.
    units.subscribe(newUnits => {
      // Unfortunately units() is already the new units. We could add
      // a beforeChange handler, but that's clumsy and shouldn't
      // be needed. So instead we cache the current units.
      if (newUnits === this.#currentUnits)
        return;
      const factor = UnitConverter.from[this.#currentUnits].to[newUnits];
      if (factor !== 1) {
        const places = PLACES[newUnits];
        for (const o of this.#unitsObservables)
          o(roundTo(o() * factor, places));
      }
      this.#currentUnits = newUnits;
    });
  }

  /**
   * Convert x from the current units to toUnits
   * @param {number} x value to convert
   * @param {string} toUnits name of target units
   */
  toUnits(x, toUnits) {
    return roundTo(x * UnitConverter.from[this.units()].to[toUnits],
                   PLACES[toUnits]);
  }

  /**
   * Convert x from fromUnits to the current units
   * @param {number|Rect|Vector|CutPoint} x value to convert, if an object
   * will convert the whole thing *in place*.
   * @param {string} fromUnits name of source fromUnits
   * @return {number|Rect|Vector|CutPoint} converted input
   */
  fromUnits(x, fromUnits) {
    if (typeof x === "object") {
      for (const field of [ "x", "y", "X", "Y", "width", "height" ])
        x[field] = this.fromUnits(x[field], fromUnits);
      return x;
    }
    return roundTo(x * UnitConverter.from[fromUnits].to[this.units()],
                   PLACES[this.units()]);
  }

  /**
   * Add an observable to the list of observables that have to
   * be notified when the units changed. This decorates the observable
   * with a toUnits method.
   * @param {observable} observable
   */
  add(observable, name) {
    this.#unitsObservables.push(observable);
    this.#uon.push(name);

    // Decorate the observable with a method to get the current
    // units
    observable.units = () => {
      assert(false, "Not used?");
      this.units();
    };

    /**
     * Decorate the observable with a method to convert the value
     * to the named units.
     */
    observable.toUnits = units => this.toUnits(Number(observable()), units);

    // Could fromUnits, but it's not needed.
  }
}


/*Copyright Todd Fleming, Crawford Currie 2014-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */

import { Rect } from "./Rect.js";

// Define transformations for different unit types to integer units.
const INTEGER_PER_MM   = 100000; // millimetres
const INTEGER_PER_INCH = 25.4 * INTEGER_PER_MM; // inches
// Browsers assume a fixed conversion of pixels to mm of
// 25.4/96 (96 dpi).
const INTEGER_PER_PX = INTEGER_PER_INCH / 96;

/**
 * Instances of this class maintain a set of inputs that show a value
 * in user-selected units. The class attaches observables that support
 * the conversion of these values into other units. Unit systems supported
 * are: `mm`, `inch`, `px` and `integer`. Integer units are designed to
 * scale up numbers for more accurate integer operations.
 */
class UnitConverter {

  // Literate code; mm = inches * UnitConverter.from.inch.to.mm
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
   * Construct to observe an observable that defines the current
   * units in use in the content where the UnitConverter is
   * instantiated. Different view models can have different unit
   * systems.
   * @param {observable} units
   */
  constructor(units) {
    this.unitsObservables = [];
    this.units = units;
    this.currentUnits = units();

    // Subscribe to the observable that defines the units currently
    // in use.
    units.subscribe(newValue => {
      // Unfortunately units() is already the new value. We could add
      // a beforeChange handler, but that's clumsy and shouldn't
      // be needed.
      if (newValue === this.currentUnits)
        return;
      let factor = UnitConverter.from[this.currentUnits].to[newValue];
      if (factor !== 1)
        for (const o of this.unitsObservables)
          o(o() * factor);
      this.currentUnits = newValue;
    });
  }

  /**
   * Convert x from the current units to tunits
   * @param {number} value to convert
   * @param {string} name of target units
   */
  toUnits(x, tunits) {
    return x * UnitConverter.from[this.units()].to[tunits];
  }

  /**
   * Convert x from funits to the current units
   * @param {number|Rect} x value to convert, if a Rect will convert
   * the whole thing
   * @param {string} name of source funits
   * @return {number|Rect} converted input
   */
  fromUnits(x, funits) {
    const f = UnitConverter.from[funits].to[this.units()];
    if (typeof x === "number")
      return x * f;
    return new Rect(x.x * f, x.y * f, x.width * f, x.height * f);
  }

  add(observable) {
    this.unitsObservables.push(observable);
    observable.units = () => {
      return this.units();
    };
    /**
     * Convert the value to the named units
     */
    observable.toUnits = (units) => {
      return this.toUnits(Number(observable()), units);
    };
  }

  addComputed(observable) {
    observable.units = () => {
      return this.units();
    };
    /**
     * Convert the value to the named units
     */
    observable.toUnits = (units) => {
      return this.toUnits(Number(observable()), units);
    };
  };
}

export { UnitConverter }

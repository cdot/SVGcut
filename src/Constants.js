/*Copyright Crawford Currie 2024-2025. This file is part of SVGcut, see the copyright and LICENSE at the root of the distribution. */
/* global ClipperLib */
import { UnitConverter } from "./UnitConverter.js";

export const CONST = {
  // The distance parameter's default value is approximately √2 so
  // that a vertex will be removed when adjacent or semi-adjacent
  // vertices having their corresponding X and Y coordinates differing
  // by no more than 1 unit. However according to tests by the
  // clipper-lib developers, the best distance value to remove
  // artifacts before offsetting is 0.1 * scale.
  CLEAN_PATH_DIST : 0.001 * UnitConverter.from.mm.to.integer,
  // Also a delta
  CLEAN_POLY_DIST : 0.001 * UnitConverter.from.mm.to.integer,

  // @see {@link https://github.com/junmer/clipper-lib/blob/HEAD/Documentation.md#clipperlibclipperoffsetarctolerance}
  // Setting to 0.06 of the scaled value means the arc tolerance will be
  // 0.06mm for a 1mm bloat/shrink, more than enough for us.
  ARC_TOLERANCE   : 0.06 * UnitConverter.from.mm.to.integer
};

/**
 * Defaults for parameter values captured by the UI.
 */
export const DEFAULT = {
  // Tool
  TOOL_DIAMETER : 1,      // mm, tool diameter
  TOOL_ANGLE    : 90,     // tool angle, degrees, 90=flat
  RAPID_RATE    : 1000,   // mm/min
  PLUNGE_RATE   : 100,    // mm/min
  // Operation
  OPERATION     : "Engrave",
  DIRECTION     : "Conventional",
  OFFSET        : "On",   // Engrave On, Inside, Outside
  COMBINE_OP    : "Group",
  STRATEGY      : "Annular", // pocketing
  PASS_DEPTH    : 0.2,    // mm
  CUT_DEPTH     : 1,      // mm
  RAMP          : false,
  MARGIN        : 0,      // mm
  SPACING       : 1,      // mm, perforations
  WIDTH         : 0,      // mm, engrave path
  STEP_OVER     : 40,     // percentage of tool diameter
  CUT_RATE      : 100,    // mm/min
  SPINDLE_RPM   : 1000,   // rpm
  // Curve conversion
  MIN_SEGS      : 5,
  MIN_SEG_LEN   : 0.25,   // mm
  // Offsetting
  JOIN_TYPE     : ClipperLib.JoinType.jtMiter,
  MITRE_LIMIT   : 2,      // deltas
  // Holding tabs
  TAB_CUT_DEPTH : 0.5,    // mm
  TAB_MARGIN    : 0,
  // Material
  Z_ORIGIN      : "Top",
  THICKNESS     : 10,     // mm
  CLEARANCE     : 10,     // mm
  // Gcode
  GCODE_UNITS   : "mm",
  ORIGIN        : "SVG page",
  EXTRA_X       : 0,      // gcode units
  EXTRA_Y       : 0,      // gcode units
  RETURN_HOME   : false
};

/**
 * Validation constraints for parameters captured by the UI.
 */
export const MIN = {
  TOOL_DIAMETER : 0.01,   // mm
  CUT_DEPTH     : 0,      // mm
  PASS_DEPTH    : 0.001,  // mm
  SPACING       : 0,      // mm
  CUT_RATE      : 0.01,   // mm/min
  PLUNGE_RATE   : 0.01,   // mm/min
  RAPID_RATE    : 0.01,   // mm/min
  TAB_CUT_DEPTH : 0.001   // mm
};

export const MAX = {
};

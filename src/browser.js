import options from "../config.js";
import { SVGcut } from "./SVGcut.js";

window.assert = (cond, mess) => {
  if (!cond)
    // debugger;
    throw new Error(mess||"Assertion failure");
};

document.addEventListener(
  "DOMContentLoaded", () => new SVGcut(options).start());

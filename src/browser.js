import options from "../config.js";
import { SVGcut } from "./SVGcut.js";

document.addEventListener(
  "DOMContentLoaded", () => new SVGcut(options).start());

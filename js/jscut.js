import options from "../config.js";
import { JSCutApp } from "./JSCut.js";

document.addEventListener("DOMContentLoaded", () => {
  const app = new JSCutApp(options);
  app.start();
});

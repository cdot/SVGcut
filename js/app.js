import options from "../config.js";
import { App } from "./App.js";

document.addEventListener("DOMContentLoaded", () => {
  const app = new App(options);
  app.start();
});

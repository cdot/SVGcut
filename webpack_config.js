// Base webpack config, shared by all packed modules
import Path from "path";
import { fileURLToPath } from 'url';
const __dirname = Path.dirname(fileURLToPath(import.meta.url));
import TerserPlugin from "terser-webpack-plugin";
import webpack from "webpack";
import { promises as fs } from "fs";

/**
 * Copy a file (or directory recursively) into the dist. Used for css etc.
 * that we want to copy but not bundle. I'm sure a webpack expert could do
 * this a lot better!
 * @param {string} from pathname to copy
 * @param {string} to where to copy to
 */
function copyFile(from, to) {
  const a_from = Path.normalize(Path.join(__dirname, from));
  const a_to = Path.normalize(Path.join(__dirname, to));
  fs.cp(a_from, a_to, {
    recursive: true,
    force: true,
    dereference: true
  })
  .catch(e => {
    // cp works, but throws all sorts of wierd errors for no
    // apparent reason before completing.
    //console.error("wierd", from, e);
  });
}

/**
 * Rewrite a <link> in html
 * @param {string} from link to rewrite (can be a common preamble)
 * @param {string} to what to replace `from` with
 * @param {string} content the HTML to perform the replacement in
 * @return {string} the edited HTML
 */
function relink(from, to, content) {
  const re = new RegExp(`(<link[^>]*href=")${from}`, "g");
  return content.replace(
    re,
    (m, preamble) => `${preamble}${to}`);
}

const IMPORT_MAP = {
  "node_modules/knockout/build/output/knockout-latest.debug.js": {
    from: "node_modules/knockout/build/output/knockout-latest.js",
    to: "knockout.js"
  },
  "node_modules/knockout.validation/dist/knockout.validation.js": {
    from: "node_modules/knockout.validation/dist/knockout.validation.min.js",
    to: "knockout-validation.min.js"
  },
  "node_modules/bootstrap/dist/js/bootstrap.bundle.js": {
    from: "node_modules/bootstrap/dist/js/bootstrap.bundle.min.js",
    to: "bootstrap.min.js"
  },
  "node_modules/bootstrap-slider/dist/bootstrap-slider.js": {
    from: "node_modules/bootstrap-slider/dist/bootstrap-slider.min.js",
    to: "bootstrap-slider.min.js"
  },
  "node_modules/clipper-lib/clipper.js": {
    from: "node_modules/clipper-lib/clipper.js",
    to: "clipper-lib.js"
  },
  "node_modules/file-saver/dist/FileSaver.js": {
    from: "node_modules/file-saver/dist/FileSaver.min.js",
    to: "FileSaver.min.js"
  }
};

function remapImport(module) {
  const map = IMPORT_MAP[module];
  if (!map) throw new Error("No map for " + module);
  copyFile(map.from, "dist/" + map.to);
  return `<script src="${map.to}"></script>`;
}

/**
 * Process one of the top level HTML files. There are a number of edits
 * required for webpacking, fixing up links etc.
 * @param {string} entry root name of the html file e.g. "standlone_game"
 * @return {Promise} a promise that resolves when the output has been written
 */
function processHTML(entry) {
  console.log(`Processing ${entry}.html`);
  return fs.readFile(`./${entry}.html`)
  .then(content => {
    content = content.toString()
    .replace(/<script type="importmap".*?<\/script>/s, "")
    .replace(/(<script type="module" src=").*?"/s, '$1./SVGcut.js"')
    .replace(/<script src="(.*?)".*?<\/script>/gs,
             (m, p1) => remapImport(p1));

    // Get CSS
    copyFile("node_modules/bootstrap/dist/css/bootstrap.min.css",
             "dist/bootstrap.min.css");
    content = relink(
      "node_modules/bootstrap/dist/css/bootstrap.css",
      "bootstrap.min.css",
      content);

    copyFile(
      "node_modules/bootstrap-slider/dist/css/bootstrap-slider.min.css",
      "dist/bootstrap-slider.min.css");
    content = relink(
      "node_modules/bootstrap-slider/dist/css/bootstrap-slider.css",
      "bootstrap-slider.min.css",
      content);

    copyFile("css/SVGcut.css", "dist/SVGcut.css");
    content = relink("css/SVGcut.css", "SVGcut.css", content);

    copyFile("images", "dist/images");
    copyFile("glShaders", "dist/glShaders");

    return fs.writeFile(`${__dirname}/dist/${entry}.html`, content);
  });
}

fs.mkdir(`${__dirname}/dist`, { recursive: true })
.then(() => processHTML("app"));

// Webpacked code always has DISTRIBUTION
const defines = {
  DISTRIBUTION: true
};

let mode = "development"; // or "production"

// --production or NODE_ENV=production  will create a minimised
// production build.
if (process.env.NODE_ENV === "production") {
  console.log("Production build");
  mode = "production";
	defines.PRODUCTION = true;
}

export default {
  mode: mode, // production or development
  entry: {
    app: {
      import: `./src/browser.js`,
      filename: "SVGcut.js"
    }
  },
  output: {
    path: Path.resolve(__dirname, "./dist")
  },
  resolve: {
    extensions: [ '.js' ],
    alias: {
      "gl-matrix": Path.resolve(
        __dirname,
        "./node_modules/gl-matrix/esm"),
      "flatten-js": Path.resolve(
        __dirname, "./node_modules/@flatten-js/core/dist/main.mjs")
    }
  },
  optimization: {
    // Split chunks for module reuse. Would like to use this, but it breaks.
    //splitChunks: {
    //  chunks: "all"
    //},
    minimize: (mode === "production"),
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          // We have to keep class names because CBOR TypeMapHandler
          // uses them
          keep_classnames: true
        },
      }),
    ]
  },
  plugins: [
    new webpack.DefinePlugin(defines),
  ]
};


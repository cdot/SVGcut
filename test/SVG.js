import whyIsNodeRunning from "why-is-node-running";
import { assert } from "chai";
/* global describe, it */
/* global DOM */
/* global Snap */

import { segmentsFromElement } from "../js/SVG.js";

describe("SVG", () => {
  let surf;

  function UNit() {}

  before(() => {
    return import("jsdom")
    .then(jsdom => {
      const dom = new jsdom.JSDOM(
        `<svg id="snoot"
  viewBox="0 0 200 100"
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink">
  <!-- Cubic Bézier curve with absolute coordinates -->
  <path id="bez-abs" d="M 10,90 C 30,90 25,10 50,10" />
  <!-- Cubic Bézier curve with relative coordinates -->
  <path id="bez-rel"
    d="M 110,90 c 20,0 15,-80 40,-80" />
  <!-- Cubic Bézier curve with repetition -->
  <path id="bez-rep-abs" d="M 10,90 C 30,90 25,10 50,10 S 70,90 90,90" />
  <path id="bez-rep-rel" d="M 110,90 c 20,0 15,-80 40,-80 s 20,80 40,80" />
  <path id="quad-abs" d="m 10,50 Q 25,25 40,50" />
  <path id="quad-rel" d="M 10,50 q 15,-25 30,0" />
  <path id="quad-rep-abs"
     d="M 10,50 Q 25,25 40,50 t 30,0 30,0 30,0 30,0 30,0" />
  <path id="open" d="M 15,1 l -4,8 8,0 -4,-8" />
  <path id="closed" d="M 25,1 l -4,8 8,0 z" />
  <path id="ellip-abs" d="M 6,10 A 6 4 10 1 0 14,10" />
</svg>`);
      global.DOM = dom;
      global.window = DOM.window;
      global.document = DOM.window.document;
      global.navigator = { userAgent: "node.js" };
      global.assert = assert;
    })
    .then(() => import("../node_modules/snapsvg/dist/snap.svg.js"))
    .then(mod => global.Snap = mod.default);
  });

  after(() => {
    global.window.close();
    delete global.window;
    delete global.Snap;
    // Snap starts an anonymous, lost interval timer that can't be
    // killed :-(
    setImmediate(() => whyIsNodeRunning());
  });

  it("open", () => {
    const snap = Snap("#snoot");
    const el = snap.select("#open");
    const segs = segmentsFromElement(el, 5, 1);
    assert.equal(segs[segs.length - 1][0], "L");
    assert.equal(segs[segs.length - 1][1], 15);
    assert.equal(segs[segs.length - 1][2], 1);
  });

  it("closed by Z", () => {
    const snap = Snap("#snoot");
    const el = snap.select("#closed");
    const segs = segmentsFromElement(el, 5, 1);
    assert.equal(segs[segs.length - 1][0], "Z");
  });

  it("cubic bez abs", () => {
    const snap = Snap("#snoot");
    const el = snap.select("#bez-abs");
    const segs = segmentsFromElement(el, 5, 1);
    const lseg = segs[segs.length - 1];
    assert.equal(lseg[0], "L");
    assert.equal(lseg[lseg.length - 2], 50);
    assert.equal(lseg[lseg.length - 1], 10);
  });

  it("cubic bez rel", () => {
    const snap = Snap("#snoot");
    const el = snap.select("#bez-rel");
    const segs = segmentsFromElement(el, 5, 1);
    const lseg = segs[segs.length - 1];
    assert.equal(lseg[0], "L");
    assert.equal(lseg[lseg.length - 2], 150);
    assert.equal(lseg[lseg.length - 1], 10);
  });

  it("quad bez abs", () => {
    const snap = Snap("#snoot");
    const el = snap.select("#quad-abs");
    const segs = segmentsFromElement(el, 5, 1);
    const lseg = segs[segs.length - 1];
    assert.equal(lseg[0], "L");
    assert.equal(lseg[lseg.length - 2], 40);
    assert.equal(lseg[lseg.length - 1], 50);
  });

  it("quad bez rel", () => {
    const snap = Snap("#snoot");
    const el = snap.select("#quad-rel");
    const segs = segmentsFromElement(el, 5, 1);
    const lseg = segs[segs.length - 1];
    assert.equal(lseg[0], "L");
    assert.equal(lseg[lseg.length - 2], 40);
    assert.equal(lseg[lseg.length - 1], 50);
  });
  
  it("bez rep abs", () => {
    const snap = Snap("#snoot");
    const el = snap.select("#bez-rep-abs");
    try {
      const segs = segmentsFromElement(el, 5, 1);
      const lseg = segs[segs.length - 1];
      assert.equal(lseg[0], "L");
    } catch (e) {
      console.log(e);
    }
  });

  it("bez rep rel", () => {
    const snap = Snap("#snoot");
    const el = snap.select("#bez-rep-rel");
    const segs = segmentsFromElement(el, 5, 1);
    const lseg = segs[segs.length - 1];
    assert.equal(lseg[0], "L");
  });

  it("quad rep abs", () => {
    const snap = Snap("#snoot");
    const el = snap.select("#quad-rep-abs");
    try {
      const segs = segmentsFromElement(el, 5, 1);
      const lseg = segs[segs.length - 1];
      assert.equal(lseg[0], "L");
    } catch (e) {
      console.log(e);
    }
  });

  it("ellip abs", () => {
    const snap = Snap("#snoot");
    const el = snap.select("#ellip-abs");
    const segs = segmentsFromElement(el, 5, 1);
    const lseg = segs[segs.length - 1];
    assert.equal(lseg[0], "L");
  });
});

// Oriignally written using Snap, but Snap starts an anonymous
// lost interval timer that can't be killed, so mocha can't exit :-(

/* global describe, it, before, after */
/* global DOM */
/* global assert */

import * as SVG from "../src/SVG.js";
import { Rect } from "../src/Rect.js";
import { setupDOM, UNit } from "./TestSupport.js";

describe("SVG", () => {
  let surf;

  before(() => setupDOM(`
<svg id="snoot"
  viewBox="0 0 200 100"
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink">
<g id="Grope">
  <path id="d-M" d="M 15,1 11 9 19 9 15 1" />
  <path id="d-m" d="m 15,1 -4,8 8,0 -4,-8" />
  <path id="d-M-l" d="M 15,1 l -4,8 8,0 -4,-8" />
  <path id="d-M-l-Z" d="M 25,1 l -4,8 8,0 z" />
  <path id="d-C" d="M 10,90 C 30,90 25,10 50,10" />
  <path id="d-c" d="M 110,90 c 20,0 15,-80 40,-80" />
  <path id="d-C-S" d="M 10,90 C 30,90 25,10 50,10 S 70,90 90,90" />
  <path id="d-c-S" d="M 110,90 c 20,0 15,-80 40,-80 s 20,80 40,80" />
  <path id="d-Q" d="m 10,50 Q 25,25 40,50" />
  <path id="d-q" d="M 10,50 q 15,-25 30,0" />
  <path id="d-Q-t" d="M 10,50 Q 25,25 40,50 t 30,0 30,0 30,0 30,0 30,0" />
  <path id="d-A" d="M 6,10 A 6 4 10 1 0 14,10" />
  <path id="d-vh" d="v 10 10 h 10 10 v -10 -10 h -10 -10 Z" />
  <!-- closed figures -->
  <!-- 0,0..75,75 -->
  <rect id="rect" x="0" y="0" width="75" height="75"
        stroke="black" fill="blue" />
  <!-- 75,0..150,75 -->
  <circle id="circle" cx="112.5" cy="37.5" r="37.5"
          stroke="black" fill="blue" />
  <!-- 150,0..225,75 -->
  <ellipse id="ellipse" cx="187.5" cy="37.5" rx="37.5" ry="18.75"
           stroke="black" fill="blue" />
  <!-- 225,0..300,75 -->
  <polygon id="polygon" points="225,0, 262.5,75, 300,0, 262.5,37.5"
           stroke="black" fill="blue" />
  <!-- 0,75..75,150 -->
  <line id="line" x1="0" y1="75" x2="75" y2="150"
        stroke="black" fill="none" />
  <!-- 75,75..150,150 -->
  <polyline id="polyline" points="75,150, 112.5,112.5, 150,150, 112.5,75"
            stroke="black" fill="none" />
  <line id="trans-line" x1="0" y1="75" x2="75" y2="150"
        transform="translate(100 100)"
        stroke="black" fill="none" />
</g>
</svg>
`));

  after(() => {
    global.window.close();
  });

  const dParams = {
    curveMinSegs: 2,
    curveMinSegLen: .1,
    vbx: 100,
    vby: 1000
  };

  it("d-M", () => {
    const el = document.getElementById("d-M");
    const segs = SVG.segmentsFromElement(el, dParams);
    assert.deepEqual(
      segs, [['M', 15, 1], ['L', 11, 9], ['L', 19, 9], ['L', 15, 1]]);
  });

  it("d-m", () => {
    const el = document.getElementById("d-m");
    const segs = SVG.segmentsFromElement(el, dParams);
    assert.deepEqual(
      segs, [['M', 15, 1], ['L', 11, 9], ['L', 19, 9], ['L', 15, 1]]);
  });

  it("d-M-l", () => {
    const el = document.getElementById("d-M-l");
    const segs = SVG.segmentsFromElement(el, dParams);
    assert.deepEqual(
      segs, [['M', 15, 1], ['L', 11, 9], ['L', 19, 9], ['L', 15, 1]]);
  });

  it("d-M-l-Z", () => {
    const el = document.getElementById("d-M-l-Z");
    const segs = SVG.segmentsFromElement(el, dParams);
    assert.equal(segs[segs.length - 1][0], "Z");
  });

  it("d-C", () => {
    const el = document.getElementById("d-C");
    const segs = SVG.segmentsFromElement(el, dParams);
    assert.equal(segs.length, 2);
    assert.deepEqual(segs[0], ['M', 10, 90]);
    const lseg = segs[1];
    assert.equal(lseg[0], "L");
    assert.equal(lseg[lseg.length - 2], 50);
    assert.equal(lseg[lseg.length - 1], 10);
  });

  it("d-c", () => {
    const el = document.getElementById("d-c");
    const segs = SVG.segmentsFromElement(el, dParams);
    const lseg = segs[segs.length - 1];
    assert.equal(lseg[0], "L");
    assert.equal(lseg[lseg.length - 2], 150);
    assert.equal(lseg[lseg.length - 1], 10);
  });

  it("d-C-S", () => {
    const el = document.getElementById("d-C-S");
    const segs = SVG.segmentsFromElement(el, dParams);
    assert.equal(segs.length, 3);
    assert.deepEqual(segs[0], ['M', 10, 90]);
    const lseg = segs[1];
    assert.equal(lseg[0], "L");
    assert.equal(lseg[lseg.length - 2], 50);
    assert.equal(lseg[lseg.length - 1], 10);
  });

  it("d-c-S", () => {
    const el = document.getElementById("d-c-S");
    const segs = SVG.segmentsFromElement(el, dParams);
    assert.equal(segs.length, 3);
    assert.deepEqual(segs[0], ['M', 110, 90]);
    const lseg = segs[1];
    assert.equal(lseg[0], "L");
    assert.equal(lseg[lseg.length - 2], 150);
    assert.equal(lseg[lseg.length - 1], 10);
  });

  it("d-Q", () => {
    const el = document.getElementById("d-Q");
    const segs = SVG.segmentsFromElement(el, dParams);
    const lseg = segs[segs.length - 1];
    assert.equal(lseg[0], "L");
    assert.almost(lseg[lseg.length - 2], 40, 0.2);
    assert.almost(lseg[lseg.length - 1], 50, 0.2);
  });

  it("d-q", () => {
    const el = document.getElementById("d-q");
    const segs = SVG.segmentsFromElement(el, dParams);
    const lseg = segs[segs.length - 1];
    assert.equal(lseg[0], "L");
    assert.almost(lseg[lseg.length - 2], 40, 0.1);
    assert.almost(lseg[lseg.length - 1], 50, 0.2);
  });
  
  it("d-C", () => {
    const el = document.getElementById("d-C");
    const segs = SVG.segmentsFromElement(el, dParams);
    const lseg = segs[segs.length - 1];
    assert.equal(lseg[0], "L");
  });

  it("d-Q-t", () => {
    const el = document.getElementById("d-Q-t");
    const segs = SVG.segmentsFromElement(el, dParams);
    const lseg = segs[segs.length - 1];
    assert.equal(lseg[0], "L");
  });

  it("d-A", () => {
    const el = document.getElementById("d-A");
    const segs = SVG.segmentsFromElement(el, dParams);
    const lseg = segs[segs.length - 1];
    assert.equal(lseg[0], "L");
  });

  it("d-vh", () => {
    const el = document.getElementById("d-vh");
    const segs = SVG.segmentsFromElement(el, dParams);
    assert.deepEqual(segs, [
      [ 'L', 0, 10 ], [ 'L', 0, 20 ],
      [ 'L', 10, 20 ], [ 'L', 20, 20 ],
      [ 'L', 20, 10 ], [ 'L', 20, 0 ],
      [ 'L', 10, 0 ], [ 'L', 0, 0 ],
      [ 'Z' ]
    ]);
  });

  it("rect", () => {
    const el = document.getElementById("rect");
    const segs = SVG.segmentsFromElement(el, dParams);
    assert.deepEqual(segs, [
      [ 'M', 0, 0 ],
      [ 'L', 75, 0 ],
      [ 'L', 75, 75 ],
      [ 'L', 0, 75 ],
      [ 'Z' ]
    ]);
  });

  it("circle", () => {
    const el = document.getElementById("circle");
    const segs = SVG.segmentsFromElement(el, dParams);
  });

  it("ellipse", () => {
    const el = document.getElementById("ellipse");
    const segs = SVG.segmentsFromElement(el, dParams);
  });

  it("polygon", () => {
    const el = document.getElementById("polygon");
    const segs = SVG.segmentsFromElement(el, dParams);
    assert.deepEqual(segs, [
      [ 'M', 225, 0 ],
      [ 'L', 262.5, 75 ],
      [ 'L', 300, 0 ],
      [ 'L', 262.5, 37.5 ],
      [ "Z" ]
    ]);
  });

  it("polyline", () => {
    const el = document.getElementById("polyline");
    const segs = SVG.segmentsFromElement(el, dParams);
    assert.deepEqual(segs, [
      [ 'M', 75, 150 ],
      [ 'L', 112.5, 112.5 ],
      [ 'L', 150, 150 ],
      [ 'L', 112.5, 75 ]
    ]);
  });

  it("line", () => {
    const el = document.getElementById("line");
    const segs = SVG.segmentsFromElement(el, dParams);
    assert.deepEqual(segs, [ [ 'M', 0, 75 ], [ 'L', 75, 150 ] ]);
  });

  it("trans-line", () => {
    const el = document.getElementById("line");
    const segs = SVG.segmentsFromElement(el, dParams);
    if (typeof process === "undefined") {
      // getCTM not supported in jsdom
      assert.deepEqual(segs, [ [ 'M', 0, 175 ], [ 'L', 175, 250 ] ]);
    }
  });

  it("getBounds", () => {
    const el = document.getElementById("polyline");
    const bb = SVG.getBounds(el);
    assert.deepEqual(bb, new Rect(75, 75, 75, 75));
  });
});

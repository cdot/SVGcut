import { assert } from "chai";
/* global describe, it */

import { Rect } from "../js/Rect.js";

describe("Rect", () => {
  it("construct", () => {
    const r = new Rect(-10, -10, 20, 20);
    assert.equal(r.x, -10);
    assert.equal(r.y, -10);
    assert.equal(r.height, 20);
    assert.equal(r.width, 20);

    assert.equal(r.left, -10);
    assert.equal(r.top, -10);
    assert.equal(r.right, 10);
    assert.equal(r.bottom, 10);
  });

  it("empty", () => {
    const r = new Rect();
    assert.equal(r.x, 0);
    assert.equal(r.y, 0);
    assert.equal(r.height, 0);
    assert.equal(r.width, 0);

    assert.equal(r.left, 0);
    assert.equal(r.top, 0);
    assert.equal(r.right, 0);
    assert.equal(r.bottom, 0);
  });

  it("inside-out", () => {
    const r = new Rect(10, 10, -20, -20);
    assert.equal(r.x, -10);
    assert.equal(r.y, -10);
    assert.equal(r.height, 20);
    assert.equal(r.width, 20);

    assert.equal(r.left, -10);
    assert.equal(r.top, -10);
    assert.equal(r.right, 10);
    assert.equal(r.bottom, 10);
  });

  it("set left", () => {
    const r = new Rect(0, 0, 10, 10);
    r.left = 5;
    assert.equal(r.x, 5);
    assert.equal(r.width, 5);
    assert.equal(r.left, 5);
    assert.equal(r.right, 10);

    r.left = 0;
    assert.equal(r.x, 0);
    assert.equal(r.width, 10);
    assert.equal(r.left, 0);
    assert.equal(r.right, 10);

    r.right = 5;
    assert.equal(r.x, 0);
    assert.equal(r.width, 5);
    assert.equal(r.left, 0);
    assert.equal(r.right, 5);
  });

  it("set top/bottom", () => {
    const r = new Rect(0, 0, 10, 10);
    assert.equal(r.y, 0);
    assert.equal(r.height, 10);
    assert.equal(r.top, 0);
    assert.equal(r.bottom, 10);
    r.top = 5;
    assert.equal(r.y, 5);
    assert.equal(r.height, 5);
    assert.equal(r.top, 5);
    assert.equal(r.bottom, 10);
    r.top = 0;
    assert.equal(r.y, 0);
    assert.equal(r.height, 10);
    assert.equal(r.top, 0);
    assert.equal(r.bottom, 10);
    r.bottom = 5;
    assert.equal(r.y, 0);
    assert.equal(r.height, 5);
    assert.equal(r.top, 0);
    assert.equal(r.bottom, 5);
  });

  it("catches left inside-out", () => {
    const r = new Rect(0, 0, 10, 10);
    try {
      r.left = 11;
    } catch(e) {
      return;
    }
    assert(false, "inside-out should throw");
  });

  it("catches right inside-out", () => {
    const r = new Rect(0, 0, 10, 10);
    try {
      r.right = -1;
    } catch(e) {
      return;
    }
    assert(false, "inside-out should throw");
  });

  it("catches top inside-out", () => {
    const r = new Rect(0, 0, 10, 10);
    try {
      r.top = 11;
    } catch(e) {
      return;
    }
    assert(false, "inside-out should throw");
  });

  it("catches bottom inside-out", () => {
    const r = new Rect(0, 0, 10, 10);
    try {
      r.bottom = -1;
    } catch(e) {
      return;
    }
    assert(false, "inside-out should throw");
  });

  it("contains", () => {
    const r = new Rect(0, 0, 10, 10);
    assert(r.contains(0,0));
    assert(r.contains(10,10));
    assert(r.contains(5,5));
    assert(!r.contains(-1,0));
    assert(!r.contains(0,-1));
    assert(!r.contains(11,0));
    assert(!r.contains(0,11));
  });

  it("enclose point", () => {
    const r = new Rect(0, 0, 10, 10);
    assert.equal(r.enclose(0, 0), r);
    assert.equal(r.left, 0);
    assert.equal(r.right, 10);
    assert.equal(r.top, 0);
    assert.equal(r.bottom, 10);
    assert.equal(r.width, 10);
    assert.equal(r.height, 10);
    r.enclose(11, 11);
    assert.equal(r.left, 0);
    assert.equal(r.right, 11);
    assert.equal(r.top, 0);
    assert.equal(r.bottom, 11);
    assert.equal(r.width, 11);
    assert.equal(r.height, 11);
    r.enclose(-1, -1);
    assert.equal(r.left, -1);
    assert.equal(r.right, 11);
    assert.equal(r.top, -1);
    assert.equal(r.bottom, 11);
    assert.equal(r.width, 12);
    assert.equal(r.height, 12);
  });

  it("enclose rect", () => {
    const r1 = new Rect(0, 0, 10, 10);
    const r2 = new Rect(5, 5, 15, 15);
    r1.enclose(r2);
    assert.deepEqual(r1, new Rect(0, 0, 20, 20));
  });

  it("normalise", () => {
    const r = new Rect();
    r.width = -10;
    r.height = -10;
    assert.equal(r.normalise(), r);
    assert.equal(r.x, -10);
    assert.equal(r.y, -10);
    assert.equal(r.width, 10);
    assert.equal(r.height, 10);
  });
});

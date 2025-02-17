import { assert } from "chai";

const SMALL = 1e-4;

global.assert = assert;

assert.almost = (actual, expected, almost, message) => {
  if (typeof almost === "string") {
    message = almost;
    almost = SMALL;
  } else if (typeof almost !== "number")
    almost = SMALL;
  assert.equal(typeof actual, typeof expected, message);
  if (typeof actual === "object") {
    for (const f of Object.keys(actual))
      assert.almost(actual[f], expected[f], almost, message);
    return;
  }
  if (typeof actual === "number" && Math.abs(actual - expected) < almost) {
    return;
  }
  assert.equal(actual, expected, `${actual} !~ ${expected} +/-${almost}`);
};

export function setupDOM(content) {
  return import("jsdom")
  .then(jsdom => {
    const dom = new jsdom.JSDOM(content);
    global.DOM = dom;
    global.window = dom.window;
    global.document = dom.window.document;
    //global.navigator = { userAgent: "node.js" };
  });
}

export function UNit() {}

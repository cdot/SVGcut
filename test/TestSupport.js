import { assert } from "chai";

const SMALL = 1e-4;

global.assert = assert;

assert.almost = (actual, expected, message) => {
  assert.equal(typeof actual, typeof expected, message);
  if (typeof actual === "object") {
    for (const f of Object.keys(actual))
      assert.almost(actual[f], expected[f], message);
    return;
  }
  if (typeof actual === "number" && Math.abs(actual - expected) < SMALL) {
    return;
  }
  assert.equal(actual, expected, `${actual} !~ ${expected}`);
};

export function UNit() {}

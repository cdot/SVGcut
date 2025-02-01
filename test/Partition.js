import { assert } from "chai";
/* global describe, it */

import { Point, Polygon } from "flatten-js";
import * as Partition from "../js/Partition.js";

describe("Partition", () => {
  it("triangulate", () => {
    const poly = new Polygon([
      new Point(10, 0),
      new Point(20, 0),
      new Point(20, 10),
      new Point(30, 10),
      new Point(30, 20),
      new Point(20, 20),
      new Point(20, 30),
      new Point(10, 30),
      new Point(10, 20),
      new Point(0, 20),
      new Point(0, 10),
      new Point(10, 10)
    ]);
    const triangles = Partition.triangulate(poly);
    assert.equal(triangles.length, 10);
    for (const t of triangles) {
      //console.log(t.vertices);
    }
  });

  it("convexPartition", () => {
    const poly = new Polygon([
      new Point(10, 0),
      new Point(20, 0),
      new Point(20, 10),
      new Point(30, 10),
      new Point(30, 20),
      new Point(20, 20),
      new Point(20, 30),
      new Point(10, 30),
      new Point(10, 20),
      new Point(0, 20),
      new Point(0, 10),
      new Point(10, 10)
    ]);
    const parts = Partition.convex(poly);
    assert.equal(parts.length, 5);
    for (const t of parts) {
      //console.log(t.vertices);
    }
  });
});
                            

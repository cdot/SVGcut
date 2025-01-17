/**Copyright Ivan Frantic, Crawford Currie
   MIT license, see https://github.com/ivanfratric/polypartition/tree/master
   Ported to Javascript by Crawford Currie
*/

import { Vector, Polygon } from "flatten-js";

function isReflex(p1, p2, p3) {
  const tmp = (p3.y - p1.y) * (p2.x - p1.x) - (p3.x - p1.x) * (p2.y - p1.y);
  return (tmp < 0);
}

function isConvex(p1, p2, p3) {
  const tmp = (p3.y - p1.y) * (p2.x - p1.x) - (p3.x - p1.x) * (p2.y - p1.y);
  return (tmp > 0);
}

function isInside(p1, p2, p3, p) {
  return !(isConvex(p1, p, p2)
           || isConvex(p2, p, p3)
           || isConvex(p3, p, p1));
}

class PartitionVertex {
  constructor(p) {
    this.isActive = true;
    this.isEar = false;
    this.p = p;
    this.isConvex = false;
  }
  
  update(vertices) {
    this.isConvex = isConvex(this.previous.p, this.p, this.next.p);

    const v2 = new Vector(this.p.x, this.p.y);
    const v1 = new Vector(this.previous.p.x, this.previous.p.y);
    const v3 = new Vector(this.next.p.x, this.next.p.y);
    const vec1 = v1.subtract(v2).normalize();
    const vec3 = v3.subtract(v2).normalize();
    this.angle = vec1.x * vec3.x + vec1.y * vec3.y;

    if (this.isConvex) {
      this.isEar = true;
      for (let i = 0; i < vertices.length; i++) {
        if ((vertices[i].p.x == v2.x) && (vertices[i].p.y == v2.y)
            || ((vertices[i].p.x == v1.x) && (vertices[i].p.y == v1.y))
            || ((vertices[i].p.x == v3.x) && (vertices[i].p.y == v3.y)))
          continue;
        if (isInside(v1, v2, v3, vertices[i].p)) {
          this.isEar = false;
          break;
        }
      }
    } else
      this.isEar = false;
  }
}

/**
 * Partition a polygon into a set of triangles.
 * @param {Polygon} poly
 * @return {Polygon[]} triangles
 */
export function triangulate(poly) {

  const pv = poly.vertices;
  if (pv.length < 3)
    throw new Error("Poly has too few vertices");
  if (pv.length === 3) 
    return [ poly ];

  // Triangulation by ear removal.

  const nV = pv.length;
  let vertices = [], i;
  for (i = 0; i < nV; i++)
    vertices.push(new PartitionVertex(pv[i]));
  for (i = 0; i < nV; i++) {
    vertices[i].previous = vertices[i > 0 ? i - 1 : nV - 1];
    vertices[i].next = vertices[(i + 1) % nV];
  }

  for (let i = 0; i < nV; i++)
    vertices[i].update(vertices);

  let ear, triangles = [];
  for (i = 0; i < nV - 3; i++) {
    let earfound = false;
    // Find the most extruded ear.
    for (let j = 0; j < nV; j++) {
      if (!(vertices[j].isActive && vertices[j].isEar))
        continue;
      if (!earfound) {
        earfound = true;
        ear = vertices[j];
      } else {
        if (vertices[j].angle > ear.angle)
          ear = vertices[j];
      }
    }
    if (!earfound)
      break;

    triangles.push(new Polygon([ear.previous.p, ear.p, ear.next.p]));

    ear.isActive = false;
    ear.previous.next = ear.next;
    ear.next.previous = ear.previous;
    
    if (i === nV - 4)
      break;

    ear.previous.update(vertices);
    ear.next.update(vertices);
  }
  for (const inner of vertices) {
    if (inner.isActive) {
      triangles.push(new Polygon([ inner.previous.p, inner.p, inner.next.p ]));
      break;
    }
  }

  return triangles;
}

/**
 * Partition a (possibly concave) polygon into a set of convex polygons.
 * @param {Polygon} poly
 * @return {Polygon[]} parts
 */
export function convexPartition(poly) {

  // Check if the poly is already convex.
  let hasReflex = false;
  const pv = poly.vertices;
  for (let i = 0; i < pv.length; i++) {
    const j = (i + 1) % pv.length;
    const k = (i + 2) % pv.length;
    if (isReflex(pv[i], pv[j], pv[k])) {
      hasReflex = true;
      break;
    }
  }
  if (!hasReflex)
    return [ poly ];

  // Hertel-Mehlhorn algorithm
  const parts = triangulate(poly);

  let first, i11;
  for (first = 0; first < parts.length; first++) {
    let poly1 = parts[first];
    for (i11 = 0; i11 < poly1.vertices.length; i11++) {
      const d1 = poly1.vertices[i11];
      const i12 = (i11 + 1) % (poly1.vertices.length);
      const d2 = poly1.vertices[i12];
      let i21, i22;
      let isdiagonal = false;
      let poly2;
      let second;
      for (second = first + 1; second < parts.length; second++) {
        poly2 = parts[second];

        for (i21 = 0; i21 < poly2.vertices.length; i21++) {
          if ((d2.x != poly2.vertices[i21].x)
              || (d2.y != poly2.vertices[i21].y)) {
            continue; // i21
          }
          i22 = (i21 + 1) % (poly2.vertices.length);
          if ((d1.x != poly2.vertices[i22].x)
              || (d1.y != poly2.vertices[i22].y)) {
            continue; // i21
          }
          isdiagonal = true;
          break; // i21
        }
        if (isdiagonal)
          break; // second
      } // /second

      if (!isdiagonal)
        continue; // i11

      let p2 = poly1.vertices[i11];
      let i13 = (i11 == 0) ? poly1.vertices.length - 1 : i11 - 1;
      let p1 = poly1.vertices[i13];
      let i23 = (i22 == (poly2.vertices.length - 1)) ? 0 : i22 + 1;
      let p3 = poly2.vertices[i23];

      if (!isConvex(p1, p2, p3))
        continue; // i11

      p2 = poly1.vertices[i12];
      if (i12 == (poly1.vertices.length - 1)) {
        i13 = 0;
      } else {
        i13 = i12 + 1;
      }
      p3 = poly1.vertices[i13];
      i23 = (i21 == 0) ? poly2.vertices.length - 1 :i21 - 1;
      p1 = poly2.vertices[i23];

      if (!isConvex(p1, p2, p3))
        continue; // i11

      const newV = [];
      for (let j = i12; j != i11; j = (j + 1) % (poly1.vertices.length))
        newV.push(poly1.vertices[j]);
      for (let j = i22; j != i21; j = (j + 1) % (poly2.vertices.length))
        newV.push(poly2.vertices[j]);

      poly1 = parts[first] = new Polygon(newV);
      parts.splice(second, 1);
      i11 = -1;
    } // i11
  } // /first

  return parts;
}

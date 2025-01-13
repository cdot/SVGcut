import Errors from '../utils/errors.js';
import { Matrix } from './Matrix.js';
const ORIGIN_POINT = {
    x: NaN,
    y: NaN,
};
ORIGIN_POINT.x = 0;
ORIGIN_POINT.y = 0;
export var ShapeTag;
(function (ShapeTag) {
    // Edge shapes
    ShapeTag[ShapeTag["Segment"] = 0] = "Segment";
    ShapeTag[ShapeTag["Arc"] = 1] = "Arc";
    ShapeTag[ShapeTag["Bezier"] = 2] = "Bezier";
    ShapeTag[ShapeTag["Quadratic"] = 3] = "Quadratic";
    // Non-edge shapes
    ShapeTag[ShapeTag["Box"] = 4] = "Box";
    ShapeTag[ShapeTag["Circle"] = 5] = "Circle";
    ShapeTag[ShapeTag["Path"] = 6] = "Path";
    ShapeTag[ShapeTag["Ray"] = 7] = "Ray";
    ShapeTag[ShapeTag["Line"] = 8] = "Line";
    ShapeTag[ShapeTag["Multiline"] = 9] = "Multiline";
    ShapeTag[ShapeTag["Point"] = 10] = "Point";
    ShapeTag[ShapeTag["Polygon"] = 11] = "Polygon";
    ShapeTag[ShapeTag["Vector"] = 12] = "Vector";
})(ShapeTag || (ShapeTag = {}));
export const MAX_EDGE_SHAPE_TAG = ShapeTag.Quadratic;
/**
 * Base class representing shape
 * Implement common methods of affine transformations
 */
export class Shape {
    constructor() { }
    translate(a, b) {
        return this.transform(Matrix.IDENTITY.translate(a, b));
    }
    /**
     * Returns new shape rotated by given angle around given center point.
     * If center point is omitted, rotates around zero point (0,0).
     * Positive value of angle defines rotation in counterclockwise direction,
     * negative angle defines rotation in clockwise direction
     * @param angle - angle in radians
     * @param [center=(0,0)] center
     */
    rotate(angle, center = ORIGIN_POINT) {
        return this.transform(Matrix.IDENTITY.rotate(angle, center.x, center.y));
    }
    scale(a, b) {
        return this.transform(Matrix.IDENTITY.scale(a, (b !== null && b !== void 0 ? b : a)));
    }
    transform(_a) {
        throw Errors.CANNOT_INVOKE_ABSTRACT_METHOD;
    }
    /**
     * This method returns an object that defines how data will be
     * serialized when called JSON.stringify() method
     */
    toJSON() {
        return Object.assign({}, this, { name: this.name });
    }
}

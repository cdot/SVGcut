import Errors from '../utils/errors.js';
import { PlanarSet } from '../data_structures/PlanarSet.js';
import * as Utils from '../utils/utils.js';
import * as Distance from '../algorithms/distance.js';
import * as Intersection from '../algorithms/intersection.js';
import { Arc } from './Arc.js';
import { Box } from './Box.js';
import { Line } from './Line.js';
import { Matrix } from './Matrix.js';
import { Ray } from './Ray.js';
import { Segment } from './Segment.js';
import { Polygon } from './Polygon.js';
import { Point } from './Point.js';
import { Shape, ShapeTag } from './Shape.js';
/**
 * Class representing a circle
 */
export class Circle extends Shape {
    constructor(a, b, c) {
        var _a, _b, _c;
        super();
        this.pc = Point.EMPTY;
        this.r = NaN;
        this.r = 1;
        if (a instanceof Circle) {
            this.pc = new Point(a.pc);
            this.r = a.r;
        }
        else if (a instanceof Point) {
            this.pc = a;
            this.r = (_a = b) !== null && _a !== void 0 ? _a : 1;
        }
        else if (typeof a === 'object' && a !== null) {
            this.pc = new Point(a);
            this.r = (_b = b) !== null && _b !== void 0 ? _b : 1;
        }
        else if (typeof a === 'number') {
            this.pc = new Point(a, b);
            this.r = (_c = c) !== null && _c !== void 0 ? _c : 1;
        }
        else {
            throw Errors.ILLEGAL_PARAMETERS;
        }
    }
    /**
     * Return new cloned instance of circle
     */
    clone() {
        return new Circle(this.pc.clone(), this.r);
    }
    get tag() {
        return ShapeTag.Circle;
    }
    get name() {
        return 'circle';
    }
    get box() {
        return new Box(this.pc.x - this.r, this.pc.y - this.r, this.pc.x + this.r, this.pc.y + this.r);
    }
    get center() {
        return this.pc;
    }
    /**
     * Return true if circle contains shape: no point of shape lies outside of the circle
     */
    contains(shape) {
        if (shape instanceof Point) {
            return Utils.LE(shape.distanceTo(this.center)[0], this.r);
        }
        if (shape instanceof Segment) {
            return (Utils.LE(shape.start.distanceTo(this.center)[0], this.r) &&
                Utils.LE(shape.end.distanceTo(this.center)[0], this.r));
        }
        if (shape instanceof Arc) {
            return (this.intersect(shape).length === 0 &&
                Utils.LE(shape.start.distanceTo(this.center)[0], this.r) &&
                Utils.LE(shape.end.distanceTo(this.center)[0], this.r));
        }
        if (shape instanceof Circle) {
            return (this.intersect(shape).length === 0 &&
                Utils.LE(shape.r, this.r) &&
                Utils.LE(shape.center.distanceTo(this.center)[0], this.r));
        }
        /* TODO: box, polygon */
        throw new Error('unimplemented');
    }
    /**
     * Transform circle to closed arc
     */
    toArc(counterclockwise = true) {
        return new Arc(this.center, this.r, Math.PI, -Math.PI, counterclockwise);
    }
    scale(a, b) {
        if (b !== undefined && a !== b)
            throw Errors.OPERATION_IS_NOT_SUPPORTED;
        return new Circle(this.pc, this.r * a);
    }
    /**
     * Return new circle transformed using affine transformation matrix
     */
    transform(matrix = new Matrix()) {
        return new Circle(this.pc.transform(matrix), this.r);
    }
    /**
     * Returns array of intersection points between circle and other shape
     */
    intersect(shape) {
        if (shape instanceof Point) {
            return this.contains(shape) ? [shape] : [];
        }
        if (shape instanceof Line) {
            return Intersection.intersectLine2Circle(shape, this);
        }
        if (shape instanceof Ray) {
            return Intersection.intersectRay2Circle(shape, this);
        }
        if (shape instanceof Segment) {
            return Intersection.intersectSegment2Circle(shape, this);
        }
        if (shape instanceof Circle) {
            return Intersection.intersectCircle2Circle(shape, this);
        }
        if (shape instanceof Box) {
            return Intersection.intersectCircle2Box(this, shape);
        }
        if (shape instanceof Arc) {
            return Intersection.intersectArc2Circle(shape, this);
        }
        if (shape instanceof Polygon) {
            return Intersection.intersectCircle2Polygon(this, shape);
        }
        throw new Error('unimplemented');
    }
    /**
     * Calculate distance and shortest segment from circle to shape and return array [distance, shortest segment]
     * @param shape Shape of the one of supported types Point, Line, Circle, Segment, Arc, Polygon or Planar Set
     * @returns {number} distance from circle to shape
     * @returns {Segment} shortest segment between circle and shape (started at circle, ended at shape)
     */
    distanceTo(shape) {
        if (shape instanceof Point) {
            return Distance.reverse(Distance.point2circle(shape, this));
        }
        if (shape instanceof Circle) {
            return Distance.circle2circle(this, shape);
        }
        if (shape instanceof Line) {
            return Distance.circle2line(this, shape);
        }
        if (shape instanceof Segment) {
            return Distance.reverse(Distance.segment2circle(shape, this));
        }
        if (shape instanceof Arc) {
            return Distance.reverse(Distance.arc2circle(shape, this));
        }
        if (shape instanceof Polygon) {
            return Distance.shape2polygon(this, shape);
        }
        if (shape instanceof PlanarSet) {
            return Distance.shape2planarSet(this, shape);
        }
        throw new Error('unimplemented');
    }
}
Circle.EMPTY = Object.freeze(new Circle(Point.EMPTY, 0));
/**
 * Shortcut to create new circle
 */
export const circle = (a, b, c) => new Circle(a, b, c);

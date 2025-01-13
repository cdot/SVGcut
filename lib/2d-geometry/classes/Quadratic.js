import { Arc } from './Arc.js';
import { Point } from './Point.js';
import { Segment } from './Segment.js';
import { Shape, ShapeTag } from './Shape.js';
import { lerp } from '../utils/lerp.js';
import * as Utils from '../utils/utils.js';
import * as Intersection from '../algorithms/intersection.js';
import * as Distance from '../algorithms/distance.js';
import * as curves from './curves.js';
const EMPTY = Object.freeze([]);
/**
 * Class representing a cubic bezier
 * @type {Quadratic}
 */
export class Quadratic extends Shape {
    constructor(a, b, c) {
        super();
        if (a instanceof Quadratic) {
            this.start = a.start;
            this.end = a.end;
            this.control1 = a.control1;
        }
        else {
            this.start = a;
            this.end = c;
            this.control1 = b;
        }
        this._lut = EMPTY;
        this._vertices = EMPTY;
        this._segments = EMPTY;
    }
    /**
     * Return new cloned instance of segment
     */
    clone() {
        return new Quadratic(this.start, this.control1, this.end);
    }
    get tag() {
        return ShapeTag.Quadratic;
    }
    /**
     * Returns LUT
     */
    get lut() {
        if (this._lut === EMPTY) {
            this._lut = curves.quadratic.generateLUT(this.start.x, this.start.y, this.control1.x, this.control1.y, this.end.x, this.end.y);
        }
        return this._lut;
    }
    /**
     * Returns array of points
     */
    get vertices() {
        if (this._vertices === EMPTY) {
            const lut = this.lut;
            this._vertices = [];
            for (let i = 0; i < lut.length; i += 4) {
                const x = lut[i + 0];
                const y = lut[i + 1];
                this._vertices.push(new Point(x, y));
            }
        }
        return this._vertices;
    }
    /**
     * Returns array of segments
     */
    get segments() {
        if (this._segments === EMPTY) {
            let previous = this.vertices[0];
            this._segments = this.vertices.slice(1).reduce((result, current) => {
                result.push(new Segment(previous, current));
                previous = current;
                return result;
            }, []);
        }
        return this._segments;
    }
    /**
     * Length of the curve
     */
    get length() {
        return this.lut[this.lut.length - 1];
    }
    /**
     * Bounding box
     */
    get box() {
        // FIXME: use the analytical solution
        return curves.boxFromLUT(this.lut);
    }
    get center() {
        return this.pointAtLength(this.length / 2);
    }
    /**
     * Returns true if equals to query segment, false otherwise
     */
    equalTo(other) {
        return this.start.equalTo(other.start) && this.end.equalTo(other.end) && this.control1.equalTo(other.control1);
    }
    /**
     * Returns true if curve contains point
     */
    contains(point) {
        return this.segments.some((segment) => segment.contains(point));
    }
    /**
     * Returns array of intersection points between segment and other shape
     */
    intersect(shape) {
        if (shape instanceof Point) {
            return this.contains(shape) ? [shape] : [];
        }
        const intersect = getSegmentIntersect(shape);
        const segments = this.segments.map((segment) => intersect(segment, shape)).flat();
        return segments;
    }
    /**
     * Calculate distance and shortest segment from segment to shape and return as array [distance, shortest segment]
     * @param {Shape} shape Shape of the one of supported types Point, Line, Circle, Segment, Arc, Polygon or Planar Set
     * @returns {number} distance from segment to shape
     * @returns {Segment} shortest segment between segment and shape (started at segment, ended at shape)
     */
    distanceTo(shape) {
        const distance = getSegmentDistance(shape);
        return this.segments.reduce((result, current) => {
            const currentResult = distance(current, shape);
            if (currentResult[0] < result[0])
                return currentResult;
            return result;
        }, [Infinity, Segment.EMPTY]);
    }
    /**
     * Returns new curve with swapped start and end points
     */
    reverse() {
        return new Quadratic(this.end, this.control1, this.start);
    }
    /**
     * When point belongs to segment, return array of two segments split by given point,
     * if point is inside segment. Returns clone of this segment if query point is incident
     * to start or end point of the segment. Returns empty array if point does not belong to segment
     */
    split(_point) {
        throw new Error('unimplemented');
    }
    splitAtLength(length) {
        if (Utils.EQ_0(length))
            return [null, this.clone()];
        if (Utils.EQ(length, this.length) || Utils.GT(length, this.length))
            return [this.clone(), null];
        const lut = this.lut;
        const index = curves.findIndexFromLUT(lut, length);
        const ta = lut[index * 4 + 2];
        const la = lut[index * 4 + 3];
        const tb = lut[(index + 1) * 4 + 2];
        const lb = lut[(index + 1) * 4 + 3];
        const f = (length - la) / (lb - la);
        const t = lerp(ta, tb, f);
        return this.splitAtT(t);
    }
    /**
     * @param t Factor from 0.0 to 1.0
     */
    splitAtT(t) {
        if (Utils.EQ_0(t))
            return [null, this.clone()];
        if (Utils.GE(t, 1.0))
            return [this.clone(), null];
        // https://stackoverflow.com/questions/18655135/divide-bezier-curve-into-two-equal-halves
        const A = this.start;
        const B = this.control1;
        const C = this.end;
        const D = pointAtRatio(A, B, t);
        const E = pointAtRatio(B, C, t);
        const F = pointAtRatio(D, E, t);
        return [new Quadratic(A, D, F), new Quadratic(F, E, C)];
    }
    /**
     * Return middle point of the curve
     */
    middle() {
        return this.pointAtLength(this.length / 2);
    }
    /**
     * Get point at given length
     * @param length The length along the segment
     */
    pointAtLength(length) {
        if (length === 0) {
            return this.start;
        }
        const segments = this.segments;
        if (segments.length === 0)
            return Point.EMPTY;
        const lut = this.lut;
        const index = curves.findIndexFromLUT(lut, length);
        const lengthAtIndex = lut[index * 4 + 3];
        const lengthInSegment = length - lengthAtIndex;
        const segment = segments[index];
        return segment.pointAtLength(lengthInSegment);
    }
    distanceToPoint(point) {
        return this.segments.reduce((result, current) => {
            const currentResult = Distance.segment2point(current, point);
            if (currentResult[0] < result[0])
                return currentResult;
            return result;
        }, [Infinity, Segment.EMPTY]);
    }
    /**
     * Return new segment transformed using affine transformation matrix
     */
    transform(matrix) {
        return new Quadratic(this.start.transform(matrix), this.control1.transform(matrix), this.end.transform(matrix));
    }
    /**
     * Returns true if segment start is equal to segment end up to DP_TOL
     */
    isZeroLength() {
        return this.start.equalTo(this.end) && this.start.equalTo(this.control1);
    }
    get name() {
        return 'bezier';
    }
}
Quadratic.EMPTY = Object.seal(new Quadratic(Point.EMPTY, Point.EMPTY, Point.EMPTY));
function pointAtRatio(start, end, f) {
    if (f <= 0)
        return start;
    if (f >= 1.0)
        return end;
    return new Point((end.x - start.x) * f + start.x, (end.y - start.y) * f + start.y);
}
function getSegmentIntersect(shape) {
    if (shape instanceof Segment) {
        return Intersection.intersectSegment2Segment;
    }
    if (shape instanceof Arc) {
        return Intersection.intersectSegment2Arc;
    }
    throw new Error('unimplemented');
}
function getSegmentDistance(shape) {
    if (shape instanceof Point) {
        return Distance.segment2point;
    }
    if (shape instanceof Segment) {
        return Distance.segment2segment;
    }
    if (shape instanceof Arc) {
        return Distance.segment2arc;
    }
    throw new Error('unimplemented');
}
/**
 * Shortcut method to create new quadratic
 */
export const quadratic = (...args) => 
// @ts-ignore
new Quadratic(...args);

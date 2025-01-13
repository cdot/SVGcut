import { TAU } from '../utils/constants.js';
import { arc } from './Arc.js';
import { point } from './Point.js';
import { segment } from './Segment.js';
import { Polygon } from './Polygon.js';
/**
 * Class representing a rectangle
 */
export class RoundedRect extends Polygon {
    constructor(x, y, width, height, r) {
        const edges = [
            segment(x + r, y, x + width - r, y),
            arc(point(x + width - r, y + r), r, TAU * 0.75, TAU, true),
            segment(x + width, y + r, x + width, y + height - r),
            arc(point(x + width - r, y + height - r), r, TAU * 0, TAU * 0.25, true),
            segment(x + width - r, y + height, x + r, y + height),
            arc(point(x + r, y + height - r), r, TAU * 0.25, TAU * 0.5, true),
            segment(x, y + height - r, x, y + r),
            arc(point(x + r, y + r), r, TAU * 0.5, TAU * 0.75, true),
        ];
        super(edges);
    }
}
/**
 * Shortcut to create new rectangle
 */
export const roundedRect = (x, y, width, height, radius) => {
    return new RoundedRect(x, y, width, height, radius);
};

import { Polygon } from './Polygon.js';
/**
 * Class representing a rectangle
 */
export class Rect extends Polygon {
    constructor(x, y, width, height) {
        super([
            [x, y],
            [x + width, y],
            [x + width, y + height],
            [x, y + height],
        ]);
    }
}
/**
 * Shortcut to create new rectangle
 */
export const rect = (x, y, width, height) => new Rect(x, y, width, height);

import { Circle, Segment } from "..//index.js";
import { ShapeTag } from '../classes/Shape.js';
import * as Utils from '../utils/utils.js';
import { convertToString } from '../utils/attributes.js';
import { TAU } from '../utils/constants.js';
export function stringify(shape, attrs) {
    var _a;
    switch (shape.tag) {
        case ShapeTag.Point: {
            const point = shape;
            const r = (_a = attrs.r) !== null && _a !== void 0 ? _a : 3;
            return `\n<circle cx="${point.x}" cy="${point.y}" r="${r}"
          ${convertToString({ fill: 'red', ...attrs })} />`;
        }
        case ShapeTag.Arc: {
            const arc = shape;
            let largeArcFlag = arc.sweep <= Math.PI ? '0' : '1';
            let sweepFlag = arc.clockwise ? '1' : '0';
            if (Utils.EQ(arc.sweep, TAU)) {
                return stringify(new Circle(arc.pc, arc.r), attrs);
            }
            else {
                return `\n<path d="M${arc.start.x},${arc.start.y} A${arc.r},${arc.r} 0 ${largeArcFlag},${sweepFlag} ${arc.end.x},${arc.end.y}" ${convertToString({ fill: 'none', ...attrs })} />`;
            }
        }
        case ShapeTag.Box: {
            const box = shape;
            const width = box.xmax - box.xmin;
            const height = box.ymax - box.ymin;
            return `\n<rect x="${box.xmin}" y="${box.ymin}" width=${width} height=${height} ${convertToString({
                fill: 'none',
                ...attrs,
            })} />`;
        }
        case ShapeTag.Circle: {
            const circle = shape;
            return `\n<circle cx="${circle.pc.x}" cy="${circle.pc.y}" r="${circle.r}" ${convertToString({
                fill: 'none',
                ...attrs,
            })} />`;
        }
        case ShapeTag.Path: {
            const path = shape;
            const start = path.pointAtLength(0);
            let d = `M${start.x},${start.y} `;
            for (const part of path.parts) {
                if (part instanceof Segment) {
                    d += `L${part.end.x},${part.end.y}`;
                }
                else {
                    throw new Error('unreachable');
                }
            }
            return `<path d="${d}" ${convertToString({ fill: 'none', ...attrs })} />`;
        }
        case ShapeTag.Polygon: {
            const polygon = shape;
            let svgStr = `\n<path ${convertToString({ fillRule: 'evenodd', fill: 'lightcyan', ...attrs })} d="`;
            for (let face of polygon.faces) {
                svgStr += face.shapes.map(shape => stringify(shape));
            }
            svgStr += `" >\n</path>`;
            return svgStr;
        }
        case ShapeTag.Segment: {
            const segment = shape;
            return `\n<line x1="${segment.start.x}" y1="${segment.start.y}" x2="${segment.end.x}" y2="${segment.end.y}" ${convertToString(attrs)} />`;
        }
        default: {
            throw new Error('unimplemented');
        }
    }
}

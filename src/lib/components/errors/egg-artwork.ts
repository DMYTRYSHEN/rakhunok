import wolfLeftUp from './artwork/wolf-left-up.svg?raw';
import wolfLeftDown from './artwork/wolf-left-down.svg?raw';
import wolfRightUp from './artwork/wolf-right-up.svg?raw';
import wolfRightDown from './artwork/wolf-right-down.svg?raw';
import hare from './artwork/hare.svg?raw';
import window from './artwork/window.svg?raw';
import hen from './artwork/hen.svg?raw';
import chick from './artwork/chick.svg?raw';
import egg from './artwork/egg.svg?raw';
import shell from './artwork/shell.svg?raw';
import grass from './artwork/grass.svg?raw';

const sources = { wolfLeftUp, wolfLeftDown, wolfRightUp, wolfRightDown, hare, window, hen, chick, egg, shell, grass };
export type ArtworkName = keyof typeof sources;
type Shape = { path: Path2D; matrix: DOMMatrix; fill: string; stroke: string; width: number; cap: CanvasLineCap; join: CanvasLineJoin };
const cache = new Map<ArtworkName, Shape[]>();

/** Compile trusted, bundled SVGs synchronously: no image fetch/decode race on error pages. */
function compile(name: ArtworkName): Shape[] {
	const cached = cache.get(name);
	if (cached) return cached;
	const root = new DOMParser().parseFromString(sources[name], 'image/svg+xml');
	if (root.querySelector('parsererror')) throw new Error(`Invalid game artwork: ${name}`);
	const shapes: Shape[] = [];
	function visit(element: Element, parent: Omit<Shape, 'path'>) {
		const matrix = DOMMatrix.fromMatrix(parent.matrix);
		for (const [, operation, values] of (element.getAttribute('transform') ?? '').matchAll(/(matrix|translate|scale|rotate)\s*\(([^)]*)\)/g)) {
			const numbers = values.trim().split(/[\s,]+/).map(Number);
			if (operation === 'matrix') matrix.multiplySelf(new DOMMatrix(numbers));
			if (operation === 'translate') matrix.translateSelf(numbers[0], numbers[1] ?? 0);
			if (operation === 'scale') matrix.scaleSelf(numbers[0], numbers[1] ?? numbers[0]);
			if (operation === 'rotate') {
				matrix.translateSelf(numbers[1] ?? 0, numbers[2] ?? 0);
				matrix.rotateSelf(numbers[0]);
				matrix.translateSelf(-(numbers[1] ?? 0), -(numbers[2] ?? 0));
			}
		}
		const state = {
			matrix,
			fill: element.getAttribute('fill') ?? parent.fill,
			stroke: element.getAttribute('stroke') ?? parent.stroke,
			width: Number(element.getAttribute('stroke-width') ?? parent.width),
			cap: (element.getAttribute('stroke-linecap') ?? parent.cap) as CanvasLineCap,
			join: (element.getAttribute('stroke-linejoin') ?? parent.join) as CanvasLineJoin
		};
		let path: Path2D | undefined;
		if (element.localName === 'path') path = new Path2D(element.getAttribute('d') ?? '');
		if (element.localName === 'ellipse' || element.localName === 'circle') {
			const number = (attribute: string) => Number(element.getAttribute(attribute) ?? 0);
			path = new Path2D();
			path.ellipse(number('cx'), number('cy'), number(element.localName === 'circle' ? 'r' : 'rx'), number(element.localName === 'circle' ? 'r' : 'ry'), 0, 0, Math.PI * 2);
		}
		if (path) shapes.push({ ...state, path });
		for (const child of element.children) visit(child, state);
	}
	visit(root.documentElement, { matrix: new DOMMatrix(), fill: '#000000', stroke: 'none', width: 1, cap: 'butt', join: 'miter' });
	cache.set(name, shapes);
	return shapes;
}

export function drawArtwork(ctx: CanvasRenderingContext2D, name: ArtworkName, muted = false) {
	for (const shape of compile(name)) {
		ctx.save();
		const { a, b, c, d, e, f } = shape.matrix;
		ctx.transform(a, b, c, d, e, f);
		ctx.lineWidth = shape.width;
		ctx.lineCap = shape.cap;
		ctx.lineJoin = shape.join;
		const tint = (color: string) => muted
			? (color === '#a5aa8d' ? 'none' : '#858970')
			: (/^(black|#000|#000000)$/i.test(color) ? '#30372c' : color);
		if (shape.fill !== 'none' && tint(shape.fill) !== 'none') { ctx.fillStyle = tint(shape.fill); ctx.fill(shape.path); }
		if (shape.stroke !== 'none' && tint(shape.stroke) !== 'none') { ctx.strokeStyle = tint(shape.stroke); ctx.stroke(shape.path); }
		ctx.restore();
	}
}
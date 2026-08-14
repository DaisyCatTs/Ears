import {
	DetachedEarsRenderDelegate,
	GROW_AMOUNTS,
	type BodyPart,
	type QuadGrow,
	type TexFlip,
	type TexRotation,
	type TexSource,
} from './delegate.js';
import { calculateUVs } from './uvs.js';

/**
 * Captures everything the renderer draws into a flat display list.
 *
 * The shape matches the `renderObjects` array the old TeaVM manipulator rendered from, and the
 * capture delegate in the Java oracle emits the identical structure — which is what makes the two
 * directly diffable.
 */

export type Move =
	| { type: 'anchor'; part: string }
	| { type: 'translate'; x: number; y: number; z: number }
	| { type: 'scale'; x: number; y: number; z: number }
	| { type: 'rotate'; ang: number; x: number; y: number; z: number };

export interface Quad {
	type: 'quad';
	moves: Move[];
	uvs: [number, number][];
	width: number;
	height: number;
	back: boolean;
	texture: string;
	emissive: boolean;
}

export interface Point {
	type: 'point';
	moves: Move[];
	color: number;
}

export type RenderObject = Quad | Point;

export class CaptureDelegate extends DetachedEarsRenderDelegate {
	readonly objects: RenderObject[] = [];

	private moves: Move[] = [];
	private readonly movesStack: Move[][] = [];
	private texture: TexSource = 'SKIN';
	private emissive = false;

	constructor(
		private readonly slim = false,
		private readonly jacket = false,
	) {
		super();
	}

	override bind(src: TexSource): void {
		this.texture = src;
	}

	override scale(x: number, y: number, z: number): void {
		this.moves.push({ type: 'scale', x, y, z });
	}

	override translate(x: number, y: number, z: number): void {
		this.moves.push({ type: 'translate', x, y, z });
	}

	override rotate(ang: number, x: number, y: number, z: number): void {
		this.moves.push({ type: 'rotate', ang, x, y, z });
	}

	override anchorTo(part: BodyPart): void {
		this.moves.push({ type: 'anchor', part: part.toLowerCase() });
	}

	override push(): void {
		this.movesStack.push(this.moves);
		this.moves = [...this.moves];
	}

	override pop(): void {
		const restored = this.movesStack.pop();
		if (restored === undefined) throw new Error('pop() without a matching push()');
		this.moves = restored;
	}

	override renderFront(u: number, v: number, w: number, h: number, rot: TexRotation, flip: TexFlip, grow: QuadGrow): void {
		this.renderQuad(u, v, w, h, rot, flip, grow, false);
	}

	override renderBack(u: number, v: number, w: number, h: number, rot: TexRotation, flip: TexFlip, grow: QuadGrow): void {
		this.renderQuad(u, v, w, h, rot, flip, grow, true);
	}

	override renderDoubleSided(u: number, v: number, w: number, h: number, rot: TexRotation, flip: TexFlip, grow: QuadGrow): void {
		this.renderFront(u, v, w, h, rot, flip, grow);
		this.renderBack(u, v, w, h, rot, flipHorizontally(flip), grow);
	}

	override renderDebugDot(r: number, g: number, b: number, a: number): void {
		this.objects.push({
			type: 'point',
			moves: [...this.moves],
			color: (((a * 255) << 24) | ((r * 255) << 16) | ((g * 255) << 8) | (b * 255)) | 0,
		});
	}

	private renderQuad(
		u: number,
		v: number,
		width: number,
		height: number,
		rot: TexRotation,
		flip: TexFlip,
		grow: QuadGrow,
		back: boolean,
	): void {
		let w = width;
		let h = height;
		const growAmount = GROW_AMOUNTS[grow];
		if (growAmount > 0) {
			w += growAmount * 2;
			h += growAmount * 2;
			this.push();
			this.translate(-growAmount, -growAmount, 0);
		}
		const quad: Quad = {
			type: 'quad',
			moves: [...this.moves],
			uvs: calculateUVs(u, v, width, height, rot, back ? flipHorizontally(flip) : flip, this.texture),
			width: w,
			height: h,
			back,
			texture: this.texture.toLowerCase(),
			emissive: this.emissive,
		};
		if (growAmount > 0) {
			this.pop();
		}
		this.objects.push(quad);
	}

	override isSlim(): boolean {
		return this.slim;
	}

	override isJacketEnabled(): boolean {
		return this.jacket;
	}

	override setEmissive(emissive: boolean): void {
		this.emissive = emissive;
	}
}

function flipHorizontally(flip: TexFlip): TexFlip {
	switch (flip) {
		case 'BOTH':
			return 'VERTICAL';
		case 'HORIZONTAL':
			return 'NONE';
		case 'NONE':
			return 'HORIZONTAL';
		case 'VERTICAL':
			return 'BOTH';
	}
}

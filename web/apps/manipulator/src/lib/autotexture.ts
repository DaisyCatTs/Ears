import { SkinImage, type PartialFeatures } from '@ears/protocol';

/**
 * Draws ear, tail, snout, horn and claw art into a skin, in the colours of that skin.
 *
 * Ears reads each feature's texture from a corner of the 64x64 skin that vanilla leaves unused —
 * and that every ordinary skin therefore leaves empty. Of six real skins checked, all six had every
 * one of those regions blank, so turning a feature on gave correctly positioned geometry sampling
 * transparent pixels: nothing, or a few stray dots.
 *
 * The geometry is fixed by the mod, so how good a look gets is almost entirely down to this art.
 * Each region is laid out to match exactly how `EarsRenderer` samples it — the snout in particular
 * is a real box whose faces come from separate strips, which is what lets it have an actual nose.
 *
 * Only fully transparent pixels are ever written, so nothing already drawn is touched.
 */

interface Region {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Where each feature reads its texture from. Derived from EarsRenderer's UV arguments. */
export const FEATURE_REGIONS = {
	ears: { x: 24, y: 0, w: 16, h: 8 },
	earsBack: { x: 56, y: 28, w: 8, h: 16 },
	tail: { x: 56, y: 16, w: 8, h: 12 },
	horn: { x: 56, y: 0, w: 8, h: 8 },
	snout: { x: 0, y: 0, w: 8, h: 8 },
	clawLeftLeg: { x: 16, y: 48, w: 4, h: 4 },
	clawRightLeg: { x: 0, y: 16, w: 4, h: 4 },
	clawLeftArm: { x: 44, y: 48, w: 4, h: 4 },
	clawRightArm: { x: 52, y: 16, w: 4, h: 4 },
} as const satisfies Record<string, Region>;

export type FeatureRegion = keyof typeof FEATURE_REGIONS;

/** Which regions a configuration will actually read from. */
export function regionsNeededBy(features: PartialFeatures): FeatureRegion[] {
	const needed: FeatureRegion[] = [];
	if (features.earMode !== 'NONE') needed.push('ears', 'earsBack');
	if (features.tailMode !== 'NONE') needed.push('tail');
	if (features.horn) needed.push('horn');
	if (features.snoutWidth > 0) needed.push('snout');
	if (features.claws) {
		needed.push('clawLeftLeg', 'clawRightLeg', 'clawLeftArm', 'clawRightArm');
	}
	return needed;
}

function isEmpty(img: SkinImage, r: Region): boolean {
	for (let y = 0; y < r.h; y++) {
		for (let x = 0; x < r.w; x++) {
			if (((img.getARGB(r.x + x, r.y + y) >>> 24) & 0xff) > 0) return false;
		}
	}
	return true;
}

/** The regions a configuration needs that the skin has nothing in. */
export function missingRegions(img: SkinImage, features: PartialFeatures): FeatureRegion[] {
	return regionsNeededBy(features).filter((name) => isEmpty(img, FEATURE_REGIONS[name]));
}

/** The most common fully opaque colour in a region, or null if there isn't one. */
function dominantColour(img: SkinImage, r: Region): number | null {
	const counts = new Map<number, number>();
	for (let y = 0; y < r.h; y++) {
		for (let x = 0; x < r.w; x++) {
			const argb = img.getARGB(r.x + x, r.y + y);
			if (((argb >>> 24) & 0xff) < 255) continue;
			const rgb = argb & 0x00ffffff;
			counts.set(rgb, (counts.get(rgb) ?? 0) + 1);
		}
	}
	let best: number | null = null;
	let bestCount = 0;
	for (const [rgb, n] of counts) {
		if (n > bestCount) {
			best = rgb;
			bestCount = n;
		}
	}
	return best === null ? null : (0xff000000 | best) >>> 0;
}

function shade(argb: number, factor: number): number {
	const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
	const r = clamp(((argb >>> 16) & 0xff) * factor);
	const g = clamp(((argb >>> 8) & 0xff) * factor);
	const b = clamp((argb & 0xff) * factor);
	return ((0xff000000 | (r << 16) | (g << 8) | b) >>> 0);
}

function mix(a: number, b: number, t: number): number {
	const ch = (shift: number) =>
		Math.round(((a >>> shift) & 0xff) * (1 - t) + ((b >>> shift) & 0xff) * t);
	return ((0xff000000 | (ch(16) << 16) | (ch(8) << 8) | ch(0)) >>> 0);
}

/** The palette every piece of art is drawn from, derived from the wearer's own skin. */
interface Palette {
	fur: number;
	furDark: number;
	furLight: number;
	inner: number;
	cream: number;
	nose: number;
}

function paletteFor(img: SkinImage): Palette {
	const hair =
		dominantColour(img, { x: 8, y: 0, w: 8, h: 8 }) ??
		dominantColour(img, { x: 8, y: 8, w: 8, h: 8 }) ??
		0xff8b7355;
	const face = dominantColour(img, { x: 8, y: 8, w: 8, h: 8 }) ?? hair;
	return {
		fur: hair,
		furDark: shade(hair, 0.78),
		furLight: shade(hair, 1.2),
		inner: mix(hair, 0xffe8a0b4, 0.6),
		cream: mix(face, 0xfffff2e4, 0.55),
		// a nose is nearly black, but keeping a hint of the skin's hue stops it looking pasted on
		nose: mix(shade(face, 0.22), 0xff2a2028, 0.6),
	};
}

/** Never paints over existing art. */
function put(img: SkinImage, x: number, y: number, colour: number): void {
	if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
	if (((img.getARGB(x, y) >>> 24) & 0xff) !== 0) return;
	img.setARGB(x, y, colour);
}

/**
 * Which way an ear hangs, which decides which end of the texture is the tip.
 *
 * The renderer maps texture row 0 to the top of the quad in every ear mode, but the quads themselves
 * point different ways. ABOVE and OUT stand the ear up off the head, so the tip belongs at row 0.
 * SIDES and FLOPPY hang it down the side of the head instead, so drawing a tip at row 0 pins the
 * narrow end to the skull and leaves the wide end flapping — the ear comes out upside down.
 */
export type EarShape = 'up' | 'down';

export function earShapeFor(mode: string | undefined): EarShape {
	return mode === 'SIDES' || mode === 'FLOPPY' ? 'down' : 'up';
}

/**
 * An 8x8 ear, drawn as row spans so the silhouette is legible as a shape rather than as arithmetic.
 *
 * Upright ears taper to a point. Hanging ears are the other way up and end in a round tip, which is
 * what reads as floppy rather than as a spike someone stuck on sideways.
 */
function drawEar(
	img: SkinImage,
	x: number,
	y: number,
	p: Palette,
	withInner: boolean,
	shape: EarShape,
): void {
	const pointed: [number, number][] = [
		[3, 5],
		[2, 6],
		[2, 6],
		[1, 7],
		[1, 7],
		[0, 8],
		[0, 8],
		[0, 8],
	];
	// kept horizontally symmetric on purpose: SIDES draws both ears with the same orientation, so
	// a lopsided silhouette would come out mirrored on one side of the head
	const floppy: [number, number][] = [
		[2, 6],
		[1, 7],
		[0, 8],
		[0, 8],
		[1, 7],
		[1, 7],
		[2, 6],
		[3, 5],
	];
	const rows = shape === 'up' ? pointed : floppy;
	// the tip is whichever end the shape narrows to, and it catches less light than the rest
	const tipRow = shape === 'up' ? 0 : rows.length - 1;
	rows.forEach(([from, to], row) => {
		for (let dx = from; dx < to; dx++) {
			const isEdge = dx === from || dx === to - 1;
			const isInner =
				withInner && !isEdge && Math.abs(row - tipRow) >= 1 && Math.abs(row - tipRow) <= 6;
			let colour = p.fur;
			if (row === tipRow) colour = p.furDark;
			else if (isInner) colour = p.inner;
			else if (isEdge) colour = shade(p.fur, 0.9);
			else if ((dx + row) % 4 === 0) colour = shade(p.fur, 0.94);
			put(img, x + dx, y + row, colour);
		}
	});
}

/**
 * An 8x12 tail: darker at the base, lighter toward the tip, tapered, with the strands broken up so
 * that crossed segments do not read as one flat card.
 */
function drawTail(img: SkinImage, r: Region, p: Palette): void {
	for (let y = 0; y < r.h; y++) {
		const t = y / (r.h - 1);
		const inset = y >= r.h - 2 ? 1 : 0;
		const base = mix(p.furDark, p.furLight, t);
		for (let x = inset; x < r.w - inset; x++) {
			const edge = x === inset || x === r.w - inset - 1;
			let colour = edge ? shade(base, 0.88) : base;
			if (!edge && (x * 3 + y * 5) % 7 === 0) colour = shade(base, 0.92);
			put(img, r.x + x, r.y + y, colour);
		}
	}
}

/**
 * The snout is a real box, and its faces come from separate strips of this 8x8 corner:
 *
 *     rows 0-1        the top of the muzzle
 *     rows 2..2+h-1   the front — where the nose goes
 *     rows 2+h..      underneath
 *     column 7        both sides
 *
 * Matching that layout is what turns it from a beige block into a muzzle with a nose on it.
 */
function drawSnout(img: SkinImage, r: Region, p: Palette, width: number, height: number): void {
	const w = Math.max(1, Math.min(7, width));
	const h = Math.max(1, Math.min(4, height));

	// the top of the muzzle, and the strip nearest the face
	for (let x = 0; x < w; x++) {
		put(img, r.x + x, r.y, p.fur);
		put(img, r.x + x, r.y + 1, shade(p.fur, 1.05));
	}

	// the front face: a nose across the top, a muzzle line under it
	const noseWidth = Math.max(1, w - 2);
	const noseStart = Math.floor((w - noseWidth) / 2);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const onNose = y === 0 && x >= noseStart && x < noseStart + noseWidth;
			const onMouth = h > 1 && y === 1 && x === Math.floor(w / 2);
			put(img, r.x + x, r.y + 2 + y, onNose ? p.nose : onMouth ? shade(p.cream, 0.7) : p.cream);
		}
	}

	// underneath, lighter, the way fur usually is
	for (let x = 0; x < w; x++) {
		put(img, r.x + x, r.y + 2 + h, p.cream);
		put(img, r.x + x, r.y + 3 + h, shade(p.cream, 0.95));
	}

	// both sides come from column 7 — one strip, then a repeat for the depth
	for (let y = 0; y < h; y++) {
		put(img, r.x + 7, r.y + y, p.fur);
		put(img, r.x + 7, r.y + 4 + y, shade(p.fur, 0.95));
	}
}

/** A tapered horn with a couple of growth rings. */
function drawHorn(img: SkinImage, r: Region, p: Palette): void {
	const base = mix(p.cream, p.furDark, 0.35);
	const rows: [number, number][] = [
		[3, 5],
		[3, 5],
		[2, 6],
		[2, 6],
		[1, 7],
		[1, 7],
		[0, 8],
		[0, 8],
	];
	rows.forEach(([from, to], row) => {
		for (let dx = from; dx < to; dx++) {
			const ring = row === 2 || row === 5;
			put(img, r.x + dx, r.y + row, ring ? shade(base, 0.82) : base);
		}
	});
}

/** Two tapered claws rather than a solid square, which reads as a chunk taken out of the hand. */
/**
 * A 4x4 claw patch.
 *
 * All four claw quads put texture row 0 at the far end — the toes on the feet, the fingertips on the
 * hands — so the claws point up the rows. Confirmed against the display list rather than assumed,
 * because the four are drawn with three different rotation/flip combinations.
 *
 * Only the claws themselves are drawn. Filling the rest of the square gives the feet a solid
 * horizontal plate sticking out past the toes, which reads as a duck's foot rather than as claws.
 */
function drawClaws(img: SkinImage, r: Region, p: Palette): void {
	const claw = mix(p.cream, 0xffffffff, 0.5);
	const clawShade = shade(claw, 0.8);
	for (const x of [0, 2]) {
		put(img, r.x + x, r.y, claw);
		put(img, r.x + x, r.y + 1, clawShade);
	}
}

export interface AutoTextureResult {
	image: SkinImage;
	filled: FeatureRegion[];
}

/**
 * Fills whatever the configuration needs and the skin lacks. Returns a new image; the one passed in
 * is not modified.
 */
export function autoTexture(source: SkinImage, features: PartialFeatures): AutoTextureResult {
	const img = source.clone();
	const missing = missingRegions(img, features);
	if (missing.length === 0) return { image: img, filled: [] };

	const p = paletteFor(img);
	const shape = earShapeFor(features.earMode);

	for (const name of missing) {
		const r = FEATURE_REGIONS[name];
		switch (name) {
			case 'ears':
				// one 16x8 strip covers both ears: two of them, with a gap, not a filled block
				drawEar(img, r.x, r.y, p, true, shape);
				drawEar(img, r.x + 8, r.y, p, true, shape);
				break;
			case 'earsBack':
				// no inner ear on the backs, so the silhouette still matches from behind
				drawEar(img, r.x, r.y, p, false, shape);
				drawEar(img, r.x, r.y + 8, p, false, shape);
				break;
			case 'tail':
				drawTail(img, r, p);
				break;
			case 'horn':
				drawHorn(img, r, p);
				break;
			case 'snout':
				drawSnout(img, r, p, features.snoutWidth, features.snoutHeight);
				break;
			default:
				drawClaws(img, r, p);
				break;
		}
	}

	return { image: img, filled: missing };
}

const LABELS: Record<FeatureRegion, string> = {
	ears: 'ears',
	earsBack: 'the backs of the ears',
	tail: 'a tail',
	horn: 'a horn',
	snout: 'a snout',
	clawLeftLeg: 'claws',
	clawRightLeg: 'claws',
	clawLeftArm: 'claws',
	clawRightArm: 'claws',
};

export function describeRegions(regions: FeatureRegion[]): string {
	const names = [...new Set(regions.map((r) => LABELS[r]))];
	if (names.length === 0) return '';
	if (names.length === 1) return names[0]!;
	return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

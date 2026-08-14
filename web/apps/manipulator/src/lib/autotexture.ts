import { SkinImage, type PartialFeatures } from '@ears/protocol';

/**
 * Draws the ear, tail, snout, horn and claw textures into a skin, in the colours of that skin.
 *
 * Ears reads each feature's texture from a specific corner of the 64x64 skin — corners that vanilla
 * leaves unused, and that every ordinary skin therefore leaves **empty**. Of six real skins checked,
 * all six had every one of those regions blank. Turning on a feature without filling them gives you
 * correctly positioned geometry sampling transparent pixels: nothing, or a few stray dots.
 *
 * So this samples the wearer's own colours — hair from the top of the head, skin from the face — and
 * paints plausible art into the regions the enabled features need. It only ever writes to pixels
 * that are fully transparent, so it cannot paint over anything already drawn.
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

function adjust(argb: number, factor: number): number {
	const r = Math.min(255, Math.round(((argb >>> 16) & 0xff) * factor));
	const g = Math.min(255, Math.round(((argb >>> 8) & 0xff) * factor));
	const b = Math.min(255, Math.round((argb & 0xff) * factor));
	return ((0xff000000 | (r << 16) | (g << 8) | b) >>> 0);
}

/** Pulls a colour toward pink, for the inside of an ear. */
function toPink(argb: number): number {
	const r = Math.min(255, Math.round(((argb >>> 16) & 0xff) * 0.5 + 232 * 0.5));
	const g = Math.min(255, Math.round(((argb >>> 8) & 0xff) * 0.5 + 160 * 0.5));
	const b = Math.min(255, Math.round((argb & 0xff) * 0.5 + 180 * 0.5));
	return ((0xff000000 | (r << 16) | (g << 8) | b) >>> 0);
}

function fillIfEmpty(img: SkinImage, r: Region, colour: number): void {
	for (let y = 0; y < r.h; y++) {
		for (let x = 0; x < r.w; x++) {
			if (((img.getARGB(r.x + x, r.y + y) >>> 24) & 0xff) === 0) {
				img.setARGB(r.x + x, r.y + y, colour);
			}
		}
	}
}

export interface AutoTextureResult {
	image: SkinImage;
	filled: FeatureRegion[];
}

/**
 * Fills whatever the given configuration needs and the skin lacks. Returns a new image; the one
 * passed in is not modified.
 */
export function autoTexture(source: SkinImage, features: PartialFeatures): AutoTextureResult {
	const img = source.clone();
	const missing = missingRegions(img, features);
	if (missing.length === 0) return { image: img, filled: [] };

	// the top of the head is hair on most skins; the front is the face
	const hair =
		dominantColour(img, { x: 8, y: 0, w: 8, h: 8 }) ??
		dominantColour(img, { x: 8, y: 8, w: 8, h: 8 }) ??
		0xff8b7355;
	const face = dominantColour(img, { x: 8, y: 8, w: 8, h: 8 }) ?? hair;

	for (const name of missing) {
		const r = FEATURE_REGIONS[name];
		switch (name) {
			case 'ears': {
				// outer ear in hair colour, with a pink inner ear on each side
				fillIfEmpty(img, r, hair);
				const inner = toPink(hair);
				for (const ox of [2, 10]) {
					for (let y = 2; y < r.h - 1; y++) {
						for (let x = 0; x < 4; x++) {
							const px = r.x + ox + x;
							const py = r.y + y;
							if (((img.getARGB(px, py) >>> 24) & 0xff) === 0 || img.getARGB(px, py) === hair) {
								img.setARGB(px, py, inner);
							}
						}
					}
				}
				break;
			}
			case 'earsBack':
			case 'tail':
				fillIfEmpty(img, r, hair);
				break;
			case 'horn':
				fillIfEmpty(img, r, adjust(face, 0.8));
				break;
			case 'snout':
				fillIfEmpty(img, r, face);
				// a slightly darker nose across the top of the muzzle
				fillIfEmpty(img, { x: r.x + 2, y: r.y + 2, w: 4, h: 2 }, adjust(face, 0.7));
				break;
			default:
				// claws: a pale tip, lighter than the skin
				fillIfEmpty(img, r, adjust(face, 1.35));
				break;
		}
	}

	return { image: img, filled: missing };
}

const LABELS: Record<FeatureRegion, string> = {
	ears: 'ears',
	earsBack: 'the backs of the ears',
	tail: 'tail',
	horn: 'horn',
	snout: 'snout',
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

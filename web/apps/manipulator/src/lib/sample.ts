import { SkinImage, png, write, type AlfalfaData, type PartialFeatures } from '@ears/protocol';

/**
 * A sample skin, generated rather than shipped as an asset.
 *
 * It has to do two jobs: look like an actual character, and paint the regions Ears samples for ears,
 * tails, snouts and horns — those live in otherwise-unused corners of the skin, and a skin that
 * leaves them blank makes every preset render as invisible geometry.
 */

const SKIN = 0xffefc3a8;
const SKIN_SHADE = 0xffd9a184;
const BLUSH = 0xffe89b9b;
const HAIR = 0xff5b4a6f;
const HAIR_LIGHT = 0xff74608c;
const HOODIE = 0xff6f8fd4;
const HOODIE_DARK = 0xff53709f;
const JEANS = 0xff3f4557;
const JEANS_DARK = 0xff333849;
const SHOE = 0xff2b2f3d;
const EYE_WHITE = 0xfff6f6f8;
const EYE = 0xff3a3550;
const INNER_EAR = 0xffe8a0b4;
const WING = 0xff8f7ad0;
const WING_DARK = 0xff6f5cb0;

function fill(img: SkinImage, x: number, y: number, w: number, h: number, color: number): void {
	for (let dy = 0; dy < h; dy++) {
		for (let dx = 0; dx < w; dx++) {
			img.setARGB(x + dx, y + dy, color);
		}
	}
}

/** Lays out a box region the way Minecraft unwraps one: top, bottom, then the four sides. */
function box(
	img: SkinImage,
	u: number,
	v: number,
	w: number,
	h: number,
	d: number,
	side: number,
	top: number,
	bottom = top,
): void {
	fill(img, u + d, v, w, d, top);
	fill(img, u + d + w, v, w, d, bottom);
	fill(img, u, v + d, d, h, side);
	fill(img, u + d, v + d, w, h, side);
	fill(img, u + d + w, v + d, d, h, side);
	fill(img, u + d + w + d, v + d, w, h, side);
}

/** A little vertical shading so flat colour doesn't read as plastic. */
function shade(img: SkinImage, x: number, y: number, w: number, h: number, color: number): void {
	for (let dy = 0; dy < h; dy++) {
		for (let dx = 0; dx < w; dx++) {
			if ((dx + dy) % 7 === 0) img.setARGB(x + dx, y + dy, color);
		}
	}
}

export function sampleSkin(): SkinImage {
	const img = new SkinImage(64, 64);

	// head: hair over the top and back, face on the front
	box(img, 0, 0, 8, 8, 8, SKIN, HAIR, SKIN_SHADE);
	fill(img, 24, 8, 8, 8, HAIR); // back of the head
	fill(img, 0, 8, 8, 3, HAIR); // right side fringe
	fill(img, 16, 8, 8, 3, HAIR); // left side fringe
	fill(img, 8, 8, 8, 3, HAIR); // fringe across the face
	shade(img, 8, 8, 8, 3, HAIR_LIGHT);
	fill(img, 9, 12, 2, 2, EYE_WHITE);
	fill(img, 10, 12, 1, 2, EYE);
	fill(img, 13, 12, 2, 2, EYE_WHITE);
	fill(img, 13, 12, 1, 2, EYE);
	fill(img, 8, 13, 1, 1, BLUSH);
	fill(img, 15, 13, 1, 1, BLUSH);
	fill(img, 11, 14, 2, 1, SKIN_SHADE); // mouth

	// hat layer: a couple of loose strands rather than a solid block
	fill(img, 40, 8, 8, 2, HAIR_LIGHT);
	fill(img, 56, 8, 8, 2, HAIR_LIGHT);

	// torso in a hoodie
	box(img, 16, 16, 8, 12, 4, HOODIE, HOODIE_DARK);
	fill(img, 20, 20, 8, 3, HOODIE_DARK); // hood seam
	shade(img, 20, 20, 8, 12, HOODIE_DARK);

	// arms: sleeves, then hands
	box(img, 40, 16, 4, 12, 4, HOODIE, HOODIE_DARK);
	fill(img, 40, 26, 16, 6, SKIN);
	box(img, 32, 48, 4, 12, 4, HOODIE, HOODIE_DARK);
	fill(img, 32, 58, 16, 6, SKIN);

	// legs in jeans, with shoes
	box(img, 0, 16, 4, 12, 4, JEANS, JEANS_DARK);
	fill(img, 0, 27, 16, 5, SHOE);
	box(img, 16, 48, 4, 12, 4, JEANS, JEANS_DARK);
	fill(img, 16, 59, 16, 5, SHOE);

	// --- the regions Ears samples ---
	// ears (24,0 16x8): outer in hair colour, inner pink
	fill(img, 24, 0, 16, 8, HAIR);
	fill(img, 26, 2, 4, 5, INNER_EAR);
	fill(img, 34, 2, 4, 5, INNER_EAR);
	// the ears' back faces (56,28 8x16)
	fill(img, 56, 28, 8, 16, HAIR);
	// tail (56,16 8x12)
	fill(img, 56, 16, 8, 12, HAIR);
	fill(img, 56, 24, 8, 4, HAIR_LIGHT); // lighter tip
	// horn (56,0 8x8)
	fill(img, 56, 0, 8, 8, SKIN_SHADE);
	// snout (0,0 8x8 area, over the head's top face)
	fill(img, 0, 1, 8, 6, SKIN);
	fill(img, 0, 0, 8, 1, SKIN_SHADE);
	fill(img, 2, 2, 4, 2, SKIN_SHADE); // nose
	// claws
	fill(img, 16, 48, 4, 4, SKIN_SHADE);
	fill(img, 0, 16, 4, 4, SKIN_SHADE);
	fill(img, 44, 48, 4, 4, SKIN_SHADE);
	fill(img, 52, 16, 4, 4, SKIN_SHADE);
	// chest
	fill(img, 20, 22, 8, 4, HOODIE);
	fill(img, 56, 44, 8, 4, HOODIE);
	fill(img, 60, 48, 4, 4, HOODIE_DARK);

	return img;
}

/** A wing texture, so the winged presets have something to draw. */
export function sampleWing(): Uint8Array {
	const img = new SkinImage(20, 16);
	for (let y = 0; y < 16; y++) {
		for (let x = 0; x < 20; x++) {
			// a swept wing: full at the shoulder, tapering to the tip
			const reach = 19 - Math.floor(y * 0.9);
			if (x <= reach) {
				const edge = x > reach - 2 || y > 13;
				img.setARGB(x, y, edge ? WING_DARK : WING);
			}
		}
	}
	// membrane ribs
	for (let i = 0; i < 4; i++) fill(img, 3 + i * 4, 0, 1, 14 - i * 2, WING_DARK);
	return png.encode(img);
}

export interface Sample {
	bytes: Uint8Array;
	features: PartialFeatures;
	alfalfa: AlfalfaData;
}

/** The sample skin with a look already applied, ready to load like any other import. */
export function buildSample(): Sample {
	const features: PartialFeatures = {
		earMode: 'FLOPPY',
		earAnchor: 'CENTER',
		claws: true,
		horn: false,
		tailMode: 'DOWN',
		tailSegments: 3,
		tailBend0: 35,
		tailBend1: 25,
		tailBend2: 15,
		tailBend3: 0,
		snoutOffset: 3,
		snoutWidth: 3,
		snoutHeight: 2,
		snoutDepth: 2,
		chestSize: 0,
		wingMode: 'NONE',
		animateWings: true,
		capeEnabled: false,
		emissive: false,
	};
	const alfalfa: AlfalfaData = { version: 1, entries: new Map([['wing', sampleWing()]]) };
	const img = sampleSkin();
	write(features, img, { format: 'auto', alfalfa });
	return { bytes: png.encode(img), features, alfalfa };
}

import { SkinImage, png, write, type AlfalfaData, type PartialFeatures } from '@ears/protocol';

/**
 * A sample skin, generated rather than shipped as an asset.
 *
 * It exists so the editor has something to show without making you find a skin first, and so the
 * preview demonstrates what the features look like. Deliberately simple and flat — the point is to
 * read the geometry clearly, not to be a good skin.
 */

const SKIN = 0xffe0ac69;
const SKIN_SHADE = 0xffc68642;
const HAIR = 0xff4a3b2a;
const SHIRT = 0xff3f7fa0;
const SHIRT_DARK = 0xff2f5f7c;
const TROUSERS = 0xff3b3f52;
const SHOE = 0xff262a36;
const EYE = 0xff20303f;
const EYE_WHITE = 0xfff2f2f2;
const WING = 0xff8a6fc4;
const WING_EDGE = 0xff6a4fa4;

function fill(img: SkinImage, x: number, y: number, w: number, h: number, color: number): void {
	for (let dy = 0; dy < h; dy++) {
		for (let dx = 0; dx < w; dx++) {
			img.setARGB(x + dx, y + dy, color);
		}
	}
}

/** Lays out the six faces of a box region the way Minecraft unwraps them. */
function box(
	img: SkinImage,
	u: number,
	v: number,
	w: number,
	h: number,
	d: number,
	side: number,
	top: number,
): void {
	fill(img, u, v, d, d, top); // top
	fill(img, u + d, v, w, d, top); // (right/top strip)
	fill(img, u + d + w, v, w, d, top); // bottom
	fill(img, u, v + d, d * 2 + w * 2, h, side);
}

export function sampleSkin(): SkinImage {
	const img = new SkinImage(64, 64);

	// head, with hair on the top and back
	box(img, 0, 0, 8, 8, 8, SKIN, HAIR);
	fill(img, 8, 8, 8, 3, HAIR); // fringe
	fill(img, 10, 12, 1, 1, EYE_WHITE);
	fill(img, 11, 12, 1, 1, EYE);
	fill(img, 13, 12, 1, 1, EYE_WHITE);
	fill(img, 14, 12, 1, 1, EYE);
	fill(img, 11, 14, 3, 1, SKIN_SHADE); // mouth
	box(img, 32, 0, 8, 8, 8, 0, 0); // hat layer stays empty

	// torso
	box(img, 16, 16, 8, 12, 4, SHIRT, SHIRT_DARK);
	fill(img, 20, 20, 8, 4, SHIRT_DARK); // a band across the chest

	// arms: sleeves at the top, skin at the wrists
	box(img, 40, 16, 4, 12, 4, SHIRT, SHIRT_DARK);
	fill(img, 40, 26, 16, 6, SKIN);
	box(img, 32, 48, 4, 12, 4, SHIRT, SHIRT_DARK);
	fill(img, 32, 58, 16, 6, SKIN);

	// legs, with shoes
	box(img, 0, 16, 4, 12, 4, TROUSERS, TROUSERS);
	fill(img, 0, 26, 16, 6, SHOE);
	box(img, 16, 48, 4, 12, 4, TROUSERS, TROUSERS);
	fill(img, 16, 58, 16, 6, SHOE);

	// ears and tail read from the same regions the renderer samples
	fill(img, 24, 0, 16, 8, SKIN);
	fill(img, 26, 2, 4, 4, SKIN_SHADE);
	fill(img, 34, 2, 4, 4, SKIN_SHADE);
	fill(img, 56, 28, 16, 8, SKIN_SHADE);
	fill(img, 56, 16, 8, 12, HAIR); // tail
	fill(img, 56, 0, 8, 8, SKIN_SHADE); // horn
	fill(img, 0, 0, 8, 8, HAIR); // snout region sits at the top-left of the head map
	fill(img, 0, 1, 8, 6, SKIN);
	fill(img, 16, 48, 4, 4, SKIN_SHADE); // claws
	fill(img, 0, 16, 4, 4, SKIN_SHADE);
	fill(img, 44, 48, 4, 4, SKIN_SHADE);
	fill(img, 52, 16, 4, 4, SKIN_SHADE);
	fill(img, 20, 22, 8, 4, SHIRT); // chest
	fill(img, 56, 44, 8, 4, SHIRT);
	fill(img, 60, 48, 4, 4, SHIRT_DARK);

	return img;
}

export function sampleWing(): Uint8Array {
	const img = new SkinImage(20, 16);
	for (let y = 0; y < 16; y++) {
		for (let x = 0; x < 20; x++) {
			// a rough wing shape: wide at the shoulder, tapering away
			if (x < 2 + y) img.setARGB(x, y, x < 3 + y - 2 ? WING_EDGE : WING);
		}
	}
	fill(img, 0, 0, 2, 16, WING_EDGE);
	return png.encode(img);
}

export interface Sample {
	bytes: Uint8Array;
	features: PartialFeatures;
	alfalfa: AlfalfaData;
}

/** The sample skin with a set of features already applied, ready to load like any other import. */
export function buildSample(): Sample {
	const features: PartialFeatures = {
		earMode: 'AROUND',
		earAnchor: 'CENTER',
		claws: true,
		horn: false,
		tailMode: 'DOWN',
		tailSegments: 3,
		tailBend0: 25,
		tailBend1: 20,
		tailBend2: 15,
		tailBend3: 0,
		snoutOffset: 2,
		snoutWidth: 4,
		snoutHeight: 2,
		snoutDepth: 2,
		chestSize: 0,
		wingMode: 'SYMMETRIC_DUAL',
		animateWings: true,
		capeEnabled: false,
		emissive: false,
	};
	const alfalfa: AlfalfaData = { version: 1, entries: new Map([['wing', sampleWing()]]) };
	const img = sampleSkin();
	write(features, img, { format: 'auto', alfalfa });
	return { bytes: png.encode(img), features, alfalfa };
}

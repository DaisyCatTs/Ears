import type { SkinImage } from './image.js';
import type { EarAnchor, EarMode, TailMode, WingMode } from './model.js';
import type { PartialFeatures } from './v1.js';

/**
 * v0 "pixelwise" Ears data: one magic colour per setting in the 4x4 block at (0,32).
 *
 * Ported from `EarsFeaturesParserV0`. Ears has never had a v0 *writer* — the encoder here mirrors
 * the old manipulator's inline JavaScript, which is what actually produced nearly every v0 skin in
 * existence. It is still needed today because v1's 3-bit tail field cannot represent
 * `STAR_OVERLAP`.
 */

export const MAGIC = 0x3f23d8; // Magic Blue

const MAGIC_PIXELS = {
	BLUE: 0x3f23d8,
	GREEN: 0x23d848,
	RED: 0xd82350,
	PURPLE: 0xb923d8,
	CYAN: 0x23d8c6,
	ORANGE: 0xd87823,
	PINK: 0xd823b7,
	PURPLE2: 0xd823ff,
	WHITE: 0xfefdf2,
	GRAY: 0x5e605a,
} as const;

type MagicName = keyof typeof MAGIC_PIXELS | 'UNKNOWN';

const BY_RGB = new Map<number, MagicName>(
	(Object.entries(MAGIC_PIXELS) as [MagicName, number][]).map(([k, v]) => [v, k]),
);

function magicAt(img: SkinImage, idx: number): MagicName {
	return BY_RGB.get(pixelAt(img, idx) & 0x00ffffff) ?? 'UNKNOWN';
}

function pixelAt(img: SkinImage, idx: number): number {
	return img.getARGB(idx % 4, 32 + Math.floor(idx / 4));
}

const EAR_MODE_BY_MAGIC: Partial<Record<MagicName, EarMode>> = {
	RED: 'NONE',
	BLUE: 'ABOVE',
	GREEN: 'SIDES',
	PURPLE: 'BEHIND',
	CYAN: 'AROUND',
	ORANGE: 'FLOPPY',
	PINK: 'CROSS',
	PURPLE2: 'OUT',
	WHITE: 'TALL',
	GRAY: 'TALL_CROSS',
};

const EAR_ANCHOR_BY_MAGIC: Partial<Record<MagicName, EarAnchor>> = {
	BLUE: 'CENTER',
	GREEN: 'FRONT',
	RED: 'BACK',
};

const PROTRUSIONS_BY_MAGIC: Partial<Record<MagicName, { claws: boolean; horn: boolean }>> = {
	BLUE: { claws: false, horn: false },
	RED: { claws: false, horn: false },
	GREEN: { claws: true, horn: false },
	PURPLE: { claws: false, horn: true },
	CYAN: { claws: true, horn: true },
};

const TAIL_MODE_BY_MAGIC: Partial<Record<MagicName, TailMode>> = {
	RED: 'NONE',
	BLUE: 'DOWN',
	GREEN: 'BACK',
	PURPLE: 'UP',
	ORANGE: 'VERTICAL',
	PINK: 'CROSS',
	PURPLE2: 'CROSS_OVERLAP',
	WHITE: 'STAR',
	GRAY: 'STAR_OVERLAP',
};

const WING_MODE_BY_MAGIC: Partial<Record<MagicName, WingMode>> = {
	BLUE: 'NONE',
	RED: 'NONE',
	PINK: 'SYMMETRIC_DUAL',
	GREEN: 'SYMMETRIC_SINGLE',
	CYAN: 'ASYMMETRIC_L',
	ORANGE: 'ASYMMETRIC_R',
	PURPLE: 'ASYMMETRIC_DUAL',
	PURPLE2: 'FLAT',
};

/** Puts 0 at pixel value 0, shifting every other value forward by one. */
function pxValToUnit(i: number): number {
	if (i === 0) return 0;
	let j = i - 128;
	if (j < 0) j -= 1;
	if (j >= 0) j += 1;
	return Math.fround(j / 128);
}

/** Inverse of {@link pxValToUnit}. */
function unitToPxVal(f: number): number {
	if (f === 0) return 0;
	const j = Math.round(f * 128);
	return j > 0 ? j + 127 : j + 129;
}

export function decode(img: SkinImage): PartialFeatures {
	const earMode = EAR_MODE_BY_MAGIC[magicAt(img, 1)] ?? 'NONE';
	// the anchor pixel is not even looked at for these two modes, so it stays null
	const anchorRelevant = earMode !== 'NONE' && earMode !== 'BEHIND';
	const earAnchor = anchorRelevant ? (EAR_ANCHOR_BY_MAGIC[magicAt(img, 2)] ?? 'CENTER') : null;
	const protrusions = PROTRUSIONS_BY_MAGIC[magicAt(img, 3)] ?? { claws: false, horn: false };
	const tailMode = TAIL_MODE_BY_MAGIC[magicAt(img, 4)] ?? 'NONE';

	const tailBend = pixelAt(img, 5);
	let tailSegments = 0;
	let tailBend0 = 0;
	let tailBend1 = 0;
	let tailBend2 = 0;
	let tailBend3 = 0;
	if ((BY_RGB.get(tailBend & 0x00ffffff) ?? 'UNKNOWN') !== 'BLUE') {
		tailSegments++;
		tailBend0 = Math.fround(pxValToUnit(255 - ((tailBend >>> 24) & 0xff)) * 90);
		tailBend1 = Math.fround(pxValToUnit((tailBend >>> 16) & 0xff) * 90);
		tailBend2 = Math.fround(pxValToUnit((tailBend >>> 8) & 0xff) * 90);
		tailBend3 = Math.fround(pxValToUnit(tailBend & 0xff) * 90);
		if (tailBend1 !== 0) {
			tailSegments++;
			if (tailBend2 !== 0) {
				tailSegments++;
				if (tailBend3 !== 0) tailSegments++;
			}
		}
	}

	const snout = pixelAt(img, 6);
	const etc = pixelAt(img, 7);
	let snoutOffset = 0;
	let snoutWidth = 0;
	let snoutHeight = 0;
	let snoutDepth = 0;
	if ((BY_RGB.get(snout & 0x00ffffff) ?? 'UNKNOWN') !== 'BLUE') {
		snoutOffset = (etc >>> 8) & 0xff;
		snoutWidth = (snout >>> 16) & 0xff;
		snoutHeight = (snout >>> 8) & 0xff;
		snoutDepth = snout & 0xff;
		if (snoutOffset > 8 - snoutHeight) snoutOffset = 8 - snoutHeight;
		if (snoutWidth > 7) snoutWidth = 7;
		if (snoutHeight > 4) snoutHeight = 4;
		if (snoutDepth > 8) snoutDepth = 8;
	}

	let chestSize = 0;
	let capeEnabled = false;
	if ((BY_RGB.get(etc & 0x00ffffff) ?? 'UNKNOWN') !== 'BLUE') {
		chestSize = Math.fround(((etc >>> 16) & 0xff) / 128);
		if (chestSize > 1) chestSize = 1;
		capeEnabled = (etc & 16) !== 0;
	}

	const wingMode = WING_MODE_BY_MAGIC[magicAt(img, 8)] ?? 'NONE';
	const animateWings = magicAt(img, 9) !== 'RED';
	const emissive = magicAt(img, 10) === 'ORANGE';

	return {
		earMode,
		earAnchor,
		claws: protrusions.claws,
		horn: protrusions.horn,
		tailMode,
		tailSegments,
		tailBend0,
		tailBend1,
		tailBend2,
		tailBend3,
		snoutOffset,
		snoutWidth,
		snoutHeight,
		snoutDepth,
		chestSize,
		wingMode,
		animateWings,
		capeEnabled,
		emissive,
	};
}

export function encode(feat: PartialFeatures, img: SkinImage): void {
	const put = (idx: number, rgb: number) => {
		const argb = (rgb & 0xff000000) !== 0 ? rgb : 0xff000000 | rgb;
		img.setARGB(idx % 4, 32 + Math.floor(idx / 4), argb >>> 0);
	};
	const keyFor = <T>(table: Partial<Record<MagicName, T>>, value: T, fallback: number): number => {
		for (const [magic, v] of Object.entries(table) as [MagicName, T][]) {
			if (v === value) return MAGIC_PIXELS[magic as keyof typeof MAGIC_PIXELS];
		}
		return fallback;
	};

	put(0, MAGIC_PIXELS.BLUE);
	// NONE maps to both RED and BLUE in several tables; RED is what the old manipulator wrote, and
	// Object.entries order puts RED first only for some of them, so pass it explicitly
	put(1, feat.earMode === 'NONE' ? MAGIC_PIXELS.RED : keyFor(EAR_MODE_BY_MAGIC, feat.earMode, MAGIC_PIXELS.RED));
	put(2, keyFor(EAR_ANCHOR_BY_MAGIC, feat.earAnchor ?? 'CENTER', MAGIC_PIXELS.BLUE));
	put(
		3,
		feat.claws && feat.horn
			? MAGIC_PIXELS.CYAN
			: feat.claws
				? MAGIC_PIXELS.GREEN
				: feat.horn
					? MAGIC_PIXELS.PURPLE
					: MAGIC_PIXELS.RED,
	);
	put(4, feat.tailMode === 'NONE' ? MAGIC_PIXELS.RED : keyFor(TAIL_MODE_BY_MAGIC, feat.tailMode, MAGIC_PIXELS.RED));

	if (feat.tailMode === 'NONE' || feat.tailSegments <= 0) {
		put(5, MAGIC_PIXELS.BLUE);
	} else {
		const a = 255 - unitToPxVal(feat.tailBend0 / 90);
		const r = feat.tailSegments > 1 ? unitToPxVal(feat.tailBend1 / 90) : 0;
		const g = feat.tailSegments > 2 ? unitToPxVal(feat.tailBend2 / 90) : 0;
		const b = feat.tailSegments > 3 ? unitToPxVal(feat.tailBend3 / 90) : 0;
		const rgb = (r << 16) | (g << 8) | b;
		if (rgb === MAGIC_PIXELS.BLUE) {
			// a Magic Blue bend pixel reads back as "no bends at all"
			throw new Error('Tail bends encode to Magic Blue; nudge one of the angles');
		}
		put(5, ((a << 24) | rgb) >>> 0);
	}

	if (feat.snoutWidth > 0 && feat.snoutHeight > 0 && feat.snoutDepth > 0) {
		put(6, (feat.snoutWidth << 16) | (feat.snoutHeight << 8) | feat.snoutDepth);
	} else {
		put(6, MAGIC_PIXELS.BLUE);
	}

	const chest = Math.min(255, Math.trunc(feat.chestSize * 128));
	put(7, (chest << 16) | ((feat.snoutOffset & 0xff) << 8) | (feat.capeEnabled ? 16 : 0));

	put(8, feat.wingMode === 'NONE' ? MAGIC_PIXELS.RED : keyFor(WING_MODE_BY_MAGIC, feat.wingMode, MAGIC_PIXELS.RED));
	put(9, feat.animateWings ? MAGIC_PIXELS.BLUE : MAGIC_PIXELS.RED);
	put(10, feat.emissive ? MAGIC_PIXELS.ORANGE : MAGIC_PIXELS.RED);
}

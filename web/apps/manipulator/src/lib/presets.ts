import type { PartialFeatures } from '@ears/protocol';

/**
 * Ready-made looks.
 *
 * These are starting points, not a menu of everything possible — every value is still editable
 * afterwards. The numbers come from what actually reads well on a player model: ear modes that suit
 * the animal, tail bends that hang rather than stick out, snouts short enough not to swallow the
 * face.
 */

export interface Preset {
	name: string;
	description: string;
	/** Whether this look needs a wing texture in Alfalfa to show up. */
	needsWing?: boolean;
	features: Partial<PartialFeatures>;
}

const NO_TAIL = { tailSegments: 1, tailBend0: 0, tailBend1: 0, tailBend2: 0, tailBend3: 0 } as const;

/**
 * The angle each tail mode starts at, before any bend is applied.
 *
 * `EarsRenderer` gives every mode its own base rotation and then adds the bends on top, cumulatively
 * per segment. The scale runs from straight down at 0 through roughly horizontal-and-backwards at
 * 90: DOWN starts at 30, UP at 130, and every backwards mode — BACK and all four crossed ones — at
 * 90, or 80 when the first bend is exactly zero.
 *
 * This matters because the same bend means completely different things in different modes. A tail
 * on DOWN with `tailBend0: 55` hangs at 85 and looks like a dog; the identical number on CROSS puts
 * it at 145, which is very nearly straight up.
 */
export function tailBaseAngle(mode: PartialFeatures['tailMode'], bend0: number): number {
	switch (mode) {
		case 'DOWN':
			return 30;
		case 'UP':
			return 130;
		case 'BACK':
		case 'CROSS':
		case 'CROSS_OVERLAP':
		case 'STAR':
		case 'STAR_OVERLAP':
			return bend0 === 0 ? 80 : 90;
		default:
			// VERTICAL is rotated onto its own axis and starts from zero
			return 0;
	}
}

/** Where the tail actually points, in the same 0 = straight down scale. */
export function tailAngle(features: PartialFeatures): number {
	return tailBaseAngle(features.tailMode, features.tailBend0) + features.tailBend0;
}

/**
 * Changes tail mode while keeping the tail pointing where it already pointed.
 *
 * Without this, switching a drooping DOWN tail to CROSS for the extra volume swings it 60 degrees
 * upright, because CROSS starts 60 degrees further round.
 */
export function retargetTail(
	features: PartialFeatures,
	mode: PartialFeatures['tailMode'],
): PartialFeatures {
	if (mode === features.tailMode || mode === 'NONE') return { ...features, tailMode: mode };
	const target = tailAngle(features);
	// solve for the bend that lands back on the same angle, allowing for the 80/90 discontinuity
	let bend0 = clampBend(target - tailBaseAngle(mode, 1));
	if (bend0 === 0) bend0 = clampBend(target - tailBaseAngle(mode, 0));
	return { ...features, tailMode: mode, tailBend0: bend0 };
}

/** Bends are stored as a sign bit plus six bits of ninety degrees, so this is the encodable range. */
export function clampBend(deg: number): number {
	return Math.max(-90, Math.min(90, Math.round(deg)));
}

export const PRESETS: Preset[] = [
	{
		name: 'Puppy',
		description: 'Soft ears, a puppy nose and a tail that hangs and curls',
		features: {
			// FLOPPY faces sideways, so from the front the ear is a one-pixel sliver — which is the
			// whole reason floppy ears looked like nothing. SIDES hangs the same 8x8 ear beside the
			// head but facing forward, so it is actually visible, and the drooping silhouette is
			// drawn into the texture instead of being asked of the geometry.
			earMode: 'SIDES',
			earAnchor: 'CENTER',
			claws: true,
			// the OVERLAP variants extend each crossed plane back over the previous segment, which
			// closes the gaps that otherwise open up between segments as the tail curves — without
			// it a four-segment tail reads as a stack of separate fins
			tailMode: 'CROSS_OVERLAP',
			tailSegments: 4,
			// CROSS starts at 90, so a negative first bend is what makes the tail hang down and back;
			// the later bends are positive so the tip curls back up the way a dog's does
			tailBend0: -28,
			tailBend1: 12,
			tailBend2: 12,
			tailBend3: 10,
			snoutWidth: 3,
			snoutHeight: 2,
			snoutDepth: 2,
			snoutOffset: 1,
		},
	},
	{
		name: 'Kitty',
		description: 'Pointed ears, a tiny nose and a tail that curls up',
		features: {
			// ABOVE is a single 16x8 banner above the head; the gap between the two ears is drawn
			// into the texture. CROSS would be one crossed plume on the centre line, not two ears.
			earMode: 'ABOVE',
			earAnchor: 'CENTER',
			claws: true,
			tailMode: 'CROSS_OVERLAP',
			tailSegments: 4,
			// held high and curled over at the tip
			tailBend0: 28,
			tailBend1: 10,
			tailBend2: 10,
			tailBend3: 8,
			snoutWidth: 2,
			snoutHeight: 1,
			snoutDepth: 1,
			snoutOffset: 1,
		},
	},
	{
		name: 'Fox',
		description: 'Sharp ears, a long muzzle and a big brush of a tail',
		features: {
			earMode: 'ABOVE',
			earAnchor: 'FRONT',
			claws: true,
			// a fox's tail is the whole point of a fox, so give it four overlapping crossed segments
			tailMode: 'CROSS_OVERLAP',
			tailSegments: 4,
			tailBend0: -18,
			tailBend1: 8,
			tailBend2: 6,
			tailBend3: 4,
			snoutWidth: 3,
			snoutHeight: 2,
			snoutDepth: 4,
			snoutOffset: 1,
		},
	},
	{
		name: 'Bunny',
		description: 'Tall ears and a little bobtail',
		features: {
			earMode: 'TALL',
			earAnchor: 'CENTER',
			tailMode: 'STAR',
			tailSegments: 1,
			tailBend0: 15,
			tailBend1: 0,
			tailBend2: 0,
			tailBend3: 0,
			snoutWidth: 2,
			snoutHeight: 1,
			snoutDepth: 1,
			snoutOffset: 1,
		},
	},
	{
		name: 'Wolf',
		description: 'Ears up, a deep muzzle and a level tail',
		features: {
			earMode: 'ABOVE',
			earAnchor: 'CENTER',
			claws: true,
			tailMode: 'CROSS_OVERLAP',
			tailSegments: 4,
			tailBend0: -12,
			tailBend1: 6,
			tailBend2: 4,
			tailBend3: 2,
			snoutWidth: 4,
			snoutHeight: 2,
			snoutDepth: 4,
			snoutOffset: 1,
		},
	},
	{
		name: 'Deer',
		description: 'Antler, ears to the sides, small tail',
		features: {
			earMode: 'SIDES',
			earAnchor: 'CENTER',
			horn: true,
			tailMode: 'UP',
			...NO_TAIL,
			tailBend0: -15,
			snoutWidth: 3,
			snoutHeight: 2,
			snoutDepth: 3,
			snoutOffset: 1,
		},
	},
	{
		name: 'Dragon',
		description: 'Horn, wings and a spined tail',
		needsWing: true,
		features: {
			earMode: 'ABOVE',
			earAnchor: 'BACK',
			horn: true,
			claws: true,
			tailMode: 'STAR',
			tailSegments: 4,
			tailBend0: -22,
			tailBend1: 6,
			tailBend2: 4,
			tailBend3: 2,
			wingMode: 'SYMMETRIC_DUAL',
			animateWings: true,
		},
	},
	{
		name: 'Bat',
		description: 'Tall ears and wings held flat',
		needsWing: true,
		features: {
			earMode: 'TALL_CROSS',
			earAnchor: 'CENTER',
			wingMode: 'FLAT',
			animateWings: false,
			...NO_TAIL,
			tailMode: 'NONE',
		},
	},
	{
		name: 'Demon',
		description: 'Horn, a pointed tail and asymmetric wings',
		needsWing: true,
		features: {
			horn: true,
			earMode: 'OUT',
			earAnchor: 'BACK',
			tailMode: 'CROSS',
			tailSegments: 3,
			tailBend0: -10,
			tailBend1: 10,
			tailBend2: 8,
			tailBend3: 0,
			wingMode: 'ASYMMETRIC_DUAL',
			animateWings: true,
		},
	},
	{
		name: 'Cow',
		description: 'Ears down, a wide muzzle and a swishing tail',
		features: {
			earMode: 'SIDES',
			earAnchor: 'CENTER',
			horn: true,
			tailMode: 'DOWN',
			tailSegments: 4,
			tailBend0: 20,
			tailBend1: 10,
			tailBend2: 5,
			tailBend3: 0,
			snoutWidth: 5,
			snoutHeight: 3,
			snoutDepth: 3,
			snoutOffset: 1,
		},
	},
];

/** Applies a preset over the current configuration, clearing what it does not mention. */
export function applyPreset(preset: Preset, base: PartialFeatures): PartialFeatures {
	return {
		...base,
		// start from nothing so switching presets doesn't leave the previous one's bits behind
		earMode: 'NONE',
		earAnchor: 'CENTER',
		claws: false,
		horn: false,
		tailMode: 'NONE',
		tailSegments: 1,
		tailBend0: 0,
		tailBend1: 0,
		tailBend2: 0,
		tailBend3: 0,
		snoutWidth: 0,
		snoutHeight: 0,
		snoutDepth: 0,
		snoutOffset: 0,
		wingMode: 'NONE',
		...preset.features,
	};
}

/**
 * Adds volume to whatever is currently set.
 *
 * Ears draws ears and tails as flat quads, and the crossed modes are the only way to get real
 * thickness out of the format: CROSS is two planes at right angles, STAR is four. Segments help a
 * tail read as fur rather than card.
 *
 * Changing the tail mode moves its base angle, so the bend has to be re-solved or a tail that was
 * hanging down ends up pointing straight up. That is what `retargetTail` is for.
 */
export function fluffier(features: PartialFeatures): PartialFeatures {
	// TALL_CROSS is TALL with a second plane through it, so that upgrade keeps the same silhouette
	// and only adds thickness. Every other ear mode is left alone: CROSS is a single crossed plume
	// on the head's centre line, so "upgrading" a two-eared mode to it would delete an ear.
	const earMode = features.earMode === 'TALL' ? 'TALL_CROSS' : features.earMode;

	const tailMode = (() => {
		switch (features.tailMode) {
			case 'NONE':
				return 'NONE';
			case 'CROSS':
				return 'CROSS_OVERLAP';
			case 'CROSS_OVERLAP':
				return 'STAR';
			case 'STAR':
			case 'STAR_OVERLAP':
				// STAR_OVERLAP is the one tail mode V1 cannot express, so this is also the point
				// where the encoder falls back to V0 — which it does on its own
				return 'STAR_OVERLAP';
			default:
				return 'CROSS_OVERLAP';
		}
	})() as PartialFeatures['tailMode'];

	// re-solve the first bend against the new mode's base angle, so the tail keeps pointing where
	// it was pointing and only gains volume
	const retargeted = retargetTail(features, tailMode);
	if (tailMode === 'NONE') return { ...retargeted, earMode };

	const segments = 4;
	// spread a gentle curl across the segments it did not previously have
	const existing = [features.tailBend0, features.tailBend1, features.tailBend2, features.tailBend3];
	const curl = (n: number) => (features.tailSegments >= n + 1 ? (existing[n] ?? 0) : 0);
	return {
		...retargeted,
		earMode,
		tailSegments: segments,
		tailBend1: clampBend(curl(1) || 10),
		tailBend2: clampBend(curl(2) || 8),
		tailBend3: clampBend(curl(3) || 6),
	};
}

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

export const PRESETS: Preset[] = [
	{
		name: 'Puppy',
		description: 'Floppy ears, a short snout and a wagging tail',
		features: {
			earMode: 'FLOPPY',
			earAnchor: 'CENTER',
			claws: true,
			tailMode: 'DOWN',
			tailSegments: 3,
			tailBend0: 35,
			tailBend1: 25,
			tailBend2: 15,
			tailBend3: 0,
			snoutWidth: 3,
			snoutHeight: 2,
			snoutDepth: 2,
			snoutOffset: 3,
		},
	},
	{
		name: 'Kitty',
		description: 'Pointed ears, a tiny nose and a tail that curls up',
		features: {
			earMode: 'ABOVE',
			earAnchor: 'CENTER',
			claws: true,
			tailMode: 'UP',
			tailSegments: 4,
			tailBend0: -20,
			tailBend1: -25,
			tailBend2: -25,
			tailBend3: -20,
			snoutWidth: 2,
			snoutHeight: 1,
			snoutDepth: 1,
			snoutOffset: 3,
		},
	},
	{
		name: 'Fox',
		description: 'Sharp ears, a long muzzle and a big brush of a tail',
		features: {
			earMode: 'ABOVE',
			earAnchor: 'FRONT',
			claws: true,
			tailMode: 'DOWN',
			tailSegments: 4,
			tailBend0: 40,
			tailBend1: 20,
			tailBend2: 10,
			tailBend3: 5,
			snoutWidth: 3,
			snoutHeight: 2,
			snoutDepth: 4,
			snoutOffset: 3,
		},
	},
	{
		name: 'Bunny',
		description: 'Tall ears and a little round tail',
		features: {
			earMode: 'TALL',
			earAnchor: 'CENTER',
			tailMode: 'UP',
			tailSegments: 1,
			tailBend0: -60,
			tailBend1: 0,
			tailBend2: 0,
			tailBend3: 0,
			snoutWidth: 2,
			snoutHeight: 1,
			snoutDepth: 1,
			snoutOffset: 3,
		},
	},
	{
		name: 'Wolf',
		description: 'Ears out to the sides, a deep muzzle and a straight tail',
		features: {
			earMode: 'SIDES',
			earAnchor: 'CENTER',
			claws: true,
			tailMode: 'BACK',
			tailSegments: 3,
			tailBend0: 20,
			tailBend1: 15,
			tailBend2: 10,
			tailBend3: 0,
			snoutWidth: 4,
			snoutHeight: 2,
			snoutDepth: 4,
			snoutOffset: 3,
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
			tailBend0: -40,
			snoutWidth: 3,
			snoutHeight: 2,
			snoutDepth: 3,
			snoutOffset: 3,
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
			tailBend0: 30,
			tailBend1: 15,
			tailBend2: 10,
			tailBend3: 5,
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
			tailBend0: 35,
			tailBend1: 20,
			tailBend2: 10,
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
			snoutOffset: 3,
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

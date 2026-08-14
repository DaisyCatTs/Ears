import { describe, expect, it } from 'vitest';

import { PRESETS, applyPreset, fluffier, tailAngle, tailBaseAngle } from '../src/lib/presets.js';
import type { PartialFeatures } from '@ears/protocol';

/**
 * Tail bends are relative to a base angle that changes with the tail mode.
 *
 * DOWN starts at 30 and every crossed mode starts at 90, so the same bend number means two very
 * different things: a preset written for DOWN and then switched to CROSS swings 60 degrees upright
 * and ends up pointing at the sky. That is not a hypothetical — it shipped. These tests pin the
 * angle each preset actually produces, and pin the invariant that changing mode for extra volume
 * must not change where the tail points.
 */

const BLANK: PartialFeatures = {
	enabled: true,
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
	snoutOffset: 0,
	snoutWidth: 0,
	snoutHeight: 0,
	snoutDepth: 0,
	chestSize: 0,
	wingMode: 'NONE',
	animateWings: false,
	capeEnabled: false,
	emissive: false,
} as PartialFeatures;

const withTail = PRESETS.filter((p) => (p.features.tailMode ?? 'NONE') !== 'NONE');

describe('tail base angles', () => {
	it('reads the discontinuity the renderer has at a zero first bend', () => {
		expect(tailBaseAngle('CROSS', 0)).toBe(80);
		expect(tailBaseAngle('CROSS', -28)).toBe(90);
		expect(tailBaseAngle('DOWN', 35)).toBe(30);
		expect(tailBaseAngle('UP', 0)).toBe(130);
	});
});

describe('presets', () => {
	// 0 is straight down, 90 is horizontal and backwards, 180 would be straight up
	it.each(withTail.map((p) => [p.name, p] as const))(
		'%s points its tail somewhere between hanging and raised',
		(_name, preset) => {
			const angle = tailAngle(applyPreset(preset, BLANK));
			expect(angle).toBeGreaterThanOrEqual(40);
			expect(angle).toBeLessThanOrEqual(125);
		},
	);

	it('never uses CROSS for ears, which is one plume on the centre line rather than two ears', () => {
		for (const preset of PRESETS) {
			expect(preset.features.earMode, preset.name).not.toBe('CROSS');
		}
	});
});

describe('fluffier', () => {
	it.each(withTail.map((p) => [p.name, p] as const))(
		'keeps %s pointing where it already pointed',
		(_name, preset) => {
			const before = applyPreset(preset, BLANK);
			const after = fluffier(before);
			// the bend is quantised to a sign bit plus six bits of ninety degrees, so allow a step
			expect(Math.abs(tailAngle(after) - tailAngle(before))).toBeLessThanOrEqual(2);
		},
	);

	it('adds volume rather than leaving the mode alone', () => {
		for (const preset of withTail) {
			const after = fluffier(applyPreset(preset, BLANK));
			expect(['CROSS_OVERLAP', 'STAR', 'STAR_OVERLAP'], preset.name).toContain(after.tailMode);
			expect(after.tailSegments, preset.name).toBe(4);
		}
	});

	it('does not collapse a pair of ears into a single plume', () => {
		for (const preset of PRESETS) {
			const after = fluffier(applyPreset(preset, BLANK));
			expect(after.earMode, preset.name).not.toBe('CROSS');
		}
	});

	it('is idempotent once it reaches the top of the ladder', () => {
		const top = fluffier(fluffier(fluffier(applyPreset(PRESETS[0]!, BLANK))));
		expect(fluffier(top).tailMode).toBe(top.tailMode);
		expect(fluffier(top).earMode).toBe(top.earMode);
	});
});

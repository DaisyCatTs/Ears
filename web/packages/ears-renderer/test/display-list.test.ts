import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { alfalfa, detect, png } from '@ears/protocol';
import { describe, expect, it } from 'vitest';

import { CaptureDelegate, render, type Move, type RenderObject } from '../src/index.js';
import { FIXTURES_DIR, loadFixtureIndex } from '../../ears-protocol/test/helpers.js';

/**
 * Diffs our renderer against the Java one, quad for quad, for every fixture.
 *
 * The Java oracle captures its display list through the same delegate shape (see
 * `common/src/oracle/.../CaptureDelegate.java`), so "does the preview match the game" is a numeric
 * comparison rather than a judgement call.
 *
 * Numbers are compared to 4 decimal places: Java does this arithmetic in 32-bit float and we do it
 * in double, so exact equality would be testing IEEE rounding rather than geometry.
 */

const PRECISION = 4;

const index = loadFixtureIndex();

function compareMoves(ours: Move[], theirs: Move[], where: string) {
	expect(ours.length, `${where}: move count`).toBe(theirs.length);
	for (let i = 0; i < ours.length; i++) {
		const a = ours[i]!;
		const b = theirs[i]!;
		expect(a.type, `${where}: move ${i} type`).toBe(b.type);
		if (a.type === 'anchor' && b.type === 'anchor') {
			expect(a.part, `${where}: move ${i} part`).toBe(b.part);
		} else if (a.type === 'rotate' && b.type === 'rotate') {
			expect(a.ang, `${where}: move ${i} ang`).toBeCloseTo(b.ang, PRECISION);
			expect(a.x, `${where}: move ${i} x`).toBeCloseTo(b.x, PRECISION);
			expect(a.y, `${where}: move ${i} y`).toBeCloseTo(b.y, PRECISION);
			expect(a.z, `${where}: move ${i} z`).toBeCloseTo(b.z, PRECISION);
		} else if (a.type !== 'anchor' && b.type !== 'anchor' && a.type !== 'rotate' && b.type !== 'rotate') {
			expect(a.x, `${where}: move ${i} x`).toBeCloseTo(b.x, PRECISION);
			expect(a.y, `${where}: move ${i} y`).toBeCloseTo(b.y, PRECISION);
			expect(a.z, `${where}: move ${i} z`).toBeCloseTo(b.z, PRECISION);
		}
	}
}

describe('renderer display list matches Java', () => {
	for (const entry of index.fixtures) {
		it(entry.name, () => {
			const dir = join(FIXTURES_DIR, entry.name);
			const skin = png.decode(readFileSync(join(dir, 'skin.png')));
			const features = detect(skin, alfalfa.read(skin));

			const capture = new CaptureDelegate(false, false);
			render(features.enabled ? features : null, capture);

			const expected = JSON.parse(
				readFileSync(join(dir, 'display-list.json'), 'utf8'),
			) as RenderObject[];

			expect(capture.objects.length, `${entry.name}: object count`).toBe(expected.length);

			for (let i = 0; i < expected.length; i++) {
				const ours = capture.objects[i]!;
				const theirs = expected[i]!;
				const where = `${entry.name}[${i}]`;
				expect(ours.type, `${where}: type`).toBe(theirs.type);
				compareMoves(ours.moves, theirs.moves, where);
				if (ours.type === 'quad' && theirs.type === 'quad') {
					expect(ours.texture, `${where}: texture`).toBe(theirs.texture);
					expect(ours.back, `${where}: back`).toBe(theirs.back);
					expect(ours.emissive, `${where}: emissive`).toBe(theirs.emissive);
					expect(ours.width, `${where}: width`).toBeCloseTo(theirs.width, PRECISION);
					expect(ours.height, `${where}: height`).toBeCloseTo(theirs.height, PRECISION);
					expect(ours.uvs.length, `${where}: uv count`).toBe(theirs.uvs.length);
					for (let j = 0; j < ours.uvs.length; j++) {
						expect(ours.uvs[j]![0], `${where}: uv ${j} u`).toBeCloseTo(theirs.uvs[j]![0]!, PRECISION);
						expect(ours.uvs[j]![1], `${where}: uv ${j} v`).toBeCloseTo(theirs.uvs[j]![1]!, PRECISION);
					}
				} else if (ours.type === 'point' && theirs.type === 'point') {
					expect(ours.color, `${where}: color`).toBe(theirs.color);
				}
			}
		});
	}
});

describe('renderer coverage', () => {
	it('actually draws something for the kitchen-sink fixture', () => {
		const dir = join(FIXTURES_DIR, 'everything');
		const skin = png.decode(readFileSync(join(dir, 'skin.png')));
		const features = detect(skin, alfalfa.read(skin));
		const capture = new CaptureDelegate(false, false);
		render(features, capture);
		expect(capture.objects.length).toBeGreaterThan(50);
	});
});

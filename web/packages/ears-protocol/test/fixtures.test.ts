import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { alfalfa, detect, png, type EarsFeatures } from '../src/index.js';
import { FIXTURES_DIR, loadFixtureIndex, type FixtureEntry } from './helpers.js';

/**
 * Forward direction: decode what Java produced and check we agree with it.
 *
 * `decoded.json` is the contract, not `config.json` — see tests/README.md.
 */

const index = loadFixtureIndex();

function expectFeaturesMatch(actual: EarsFeatures, expected: Record<string, unknown>, name: string) {
	const scalar: (keyof EarsFeatures)[] = [
		'enabled',
		'earMode',
		'earAnchor',
		'claws',
		'horn',
		'tailMode',
		'tailSegments',
		'snoutOffset',
		'snoutWidth',
		'snoutHeight',
		'snoutDepth',
		'wingMode',
		'animateWings',
		'capeEnabled',
		'emissive',
	];
	for (const key of scalar) {
		expect(actual[key], `${name}: ${key}`).toBe(expected[key]);
	}
	const floats: (keyof EarsFeatures)[] = [
		'tailBend0',
		'tailBend1',
		'tailBend2',
		'tailBend3',
		'chestSize',
	];
	for (const key of floats) {
		expect(actual[key] as number, `${name}: ${key}`).toBeCloseTo(expected[key] as number, 5);
	}
}

describe('golden fixtures (forward: Java encodes, we decode)', () => {
	it('has fixtures to run', () => {
		expect(index.fixtures.length).toBeGreaterThan(40);
	});

	for (const fixture of index.fixtures) {
		describe(fixture.name, () => {
			const dir = join(FIXTURES_DIR, fixture.name);
			const skin = png.decode(readFileSync(join(dir, 'skin.png')));
			const expectedFeatures = JSON.parse(
				readFileSync(join(dir, 'decoded.json'), 'utf8'),
			) as Record<string, unknown>;
			const expectedAlfalfa = JSON.parse(readFileSync(join(dir, 'alfalfa.json'), 'utf8')) as {
				read: { version: number; entries: Record<string, { bytes: number }> };
				afterDetect: { version: number; entries: Record<string, { bytes: number }> };
			};

			const readAlfalfa = alfalfa.read(skin);
			// detect mutates the skin for emissive, which is exactly what Java does
			const features = detect(skin, readAlfalfa);

			it('decodes the features Java read back', () => {
				expectFeaturesMatch(features, expectedFeatures, fixture.name);
			});

			it('reads the same alfalfa out of the alpha channel', () => {
				expect(readAlfalfa.version).toBe(expectedAlfalfa.read.version);
				expect([...readAlfalfa.entries.keys()].sort()).toEqual(
					Object.keys(expectedAlfalfa.read.entries).sort(),
				);
				// raw entries must be byte-identical
				const rawDir = join(dir, 'alfalfa-read');
				for (const [key, value] of readAlfalfa.entries) {
					const expectedBytes = readFileSync(join(rawDir, `${key}.bin`));
					expect(Buffer.from(value).equals(expectedBytes), `${key} bytes`).toBe(true);
				}
			});

			it('produces the same alfalfa after detect', () => {
				expect([...features.alfalfa.entries.keys()].sort()).toEqual(
					Object.keys(expectedAlfalfa.afterDetect.entries).sort(),
				);
				const derivedDir = join(dir, 'alfalfa-after-detect');
				for (const [key, value] of features.alfalfa.entries) {
					const expectedBytes = readFileSync(join(derivedDir, `${key}.bin`));
					if (Buffer.from(value).equals(expectedBytes)) continue;
					// a re-encoded payload (the 12x12 wing upgrade); compare as an image, since a
					// different deflate legitimately produces different bytes for the same pixels
					const ours = png.decode(value);
					const theirs = png.decode(expectedBytes);
					expect([ours.width, ours.height], `${key} size`).toEqual([theirs.width, theirs.height]);
					expect(Buffer.from(ours.data).equals(Buffer.from(theirs.data)), `${key} pixels`).toBe(
						true,
					);
				}
			});

			const emissiveSkinPath = join(dir, 'emissive-skin.png');
			if (existsSync(emissiveSkinPath)) {
				it('extracts the same emissive layer', () => {
					expect(features.emissiveSkin).not.toBeNull();
					const ours = png.decode(features.emissiveSkin!);
					const theirs = png.decode(readFileSync(emissiveSkinPath));
					expect([ours.width, ours.height]).toEqual([theirs.width, theirs.height]);
					expect(Buffer.from(ours.data).equals(Buffer.from(theirs.data))).toBe(true);
				});
			} else {
				it('extracts no emissive skin layer', () => {
					expect(features.emissiveSkin).toBeNull();
				});
			}

			const emissiveWingPath = join(dir, 'emissive-wing.png');
			if (existsSync(emissiveWingPath)) {
				it('extracts the same emissive wing', () => {
					expect(features.emissiveWing).not.toBeNull();
					const ours = png.decode(features.emissiveWing!);
					const theirs = png.decode(readFileSync(emissiveWingPath));
					expect([ours.width, ours.height]).toEqual([theirs.width, theirs.height]);
					expect(Buffer.from(ours.data).equals(Buffer.from(theirs.data))).toBe(true);
				});
			}
		});
	}
});

describe('fixture coverage', () => {
	it('covers both formats and malformed input', () => {
		const formats = new Set(index.fixtures.map((f: FixtureEntry) => f.format));
		expect(formats).toEqual(new Set(['v1', 'v0', 'raw']));
	});

	it('matches the directories on disk', () => {
		const dirs = readdirSync(FIXTURES_DIR, { withFileTypes: true })
			.filter((d) => d.isDirectory())
			.map((d) => d.name)
			.sort();
		expect(dirs).toEqual(index.fixtures.map((f: FixtureEntry) => f.name).sort());
	});
});

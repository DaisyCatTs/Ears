import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { alfalfa, png } from '../src/index.js';
import { FIXTURES_DIR, REPO_ROOT } from './helpers.js';

/**
 * Reverse direction: **we** encode, **Java** decodes.
 *
 * The thing under test is our encoder, so it is deliberately never compared against our own
 * decoder — an encoder and decoder that share a bug agree with each other perfectly. Instead:
 *
 * - for `roundtrip-*` cases, Java decoding our skin must reproduce the exact features Java itself
 *   decoded from its own fixture, and our config block and alpha channel must match Java's bytes;
 * - for hand-written cases, Java's decode is held against the features we asked for, allowing only
 *   the quantization the format actually imposes.
 *
 * Run with `bun run test:reverse`.
 */

const DIR = join(REPO_ROOT, 'tests', 'fixtures-ts');

interface Manifest {
	fixtures: { name: string; format: string; source?: string; compareBytes?: boolean }[];
}

const manifest: Manifest = existsSync(join(DIR, 'index.json'))
	? (JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf8')) as Manifest)
	: { fixtures: [] };

/** chestSize is a 5-bit unit, tail bends a 6-bit sign-and-magnitude unit scaled to 90 degrees. */
const CHEST_STEP = 1 / 31;
const BEND_STEP = 90 / 63;

const EXACT_FIELDS = [
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
] as const;

describe('golden fixtures (reverse: we encode, Java decodes)', () => {
	it('has skins to check', () => {
		expect(
			manifest.fixtures.length,
			'No TypeScript-encoded fixtures found — run `bun run fixtures:emit`',
		).toBeGreaterThan(0);
	});

	for (const entry of manifest.fixtures) {
		const dir = join(DIR, entry.name);

		describe(entry.name, () => {
			const javaPath = join(dir, 'java-decoded.json');
			const decoded = existsSync(javaPath)
				? (JSON.parse(readFileSync(javaPath, 'utf8')) as Record<string, unknown>)
				: null;

			it('was decoded by Java', () => {
				expect(decoded, `run \`bun run fixtures:decode\` to produce ${javaPath}`).not.toBeNull();
			});

			if (entry.source) {
				const expected = JSON.parse(
					readFileSync(join(FIXTURES_DIR, entry.source, 'decoded.json'), 'utf8'),
				) as Record<string, unknown>;

				it("reproduces Java's own decode of the same features", () => {
					for (const key of EXACT_FIELDS) {
						expect(decoded![key], key).toBe(expected[key]);
					}
					for (const key of ['tailBend0', 'tailBend1', 'tailBend2', 'tailBend3', 'chestSize']) {
						expect(decoded![key] as number, key).toBeCloseTo(expected[key] as number, 5);
					}
				});

				// where Java's own re-encode is not byte-stable, its skin carries bits no reader
				// looks at, and reproducing them would mean reproducing a quirk rather than a format
				it.skipIf(entry.compareBytes === false)('writes the same config block bytes as Java', () => {
					const ours = png.decode(readFileSync(join(dir, 'skin.png')));
					const theirs = png.decode(readFileSync(join(FIXTURES_DIR, entry.source!, 'skin.png')));
					for (let y = 32; y < 36; y++) {
						for (let x = 0; x < 4; x++) {
							expect(ours.getARGB(x, y) >>> 0, `pixel ${x},${y}`).toBe(theirs.getARGB(x, y) >>> 0);
						}
					}
				});

				it('writes the same alfalfa alpha channel as Java', () => {
					const ours = png.decode(readFileSync(join(dir, 'skin.png')));
					const theirs = png.decode(readFileSync(join(FIXTURES_DIR, entry.source!, 'skin.png')));
					for (const r of alfalfa.ENCODE_REGIONS) {
						for (let x = r.x1; x < r.x2; x++) {
							for (let y = r.y1; y < r.y2; y++) {
								expect((ours.getARGB(x, y) >>> 24) & 0xff, `alpha ${x},${y}`).toBe(
									(theirs.getARGB(x, y) >>> 24) & 0xff,
								);
							}
						}
					}
				});
			} else {
				const intent = JSON.parse(readFileSync(join(dir, 'intent.json'), 'utf8')) as Record<
					string,
					unknown
				>;

				it('gives Java the features we asked for', () => {
					for (const key of EXACT_FIELDS) {
						if (!(key in intent)) continue;
						if (
							key === 'earAnchor' &&
							entry.format === 'v0' &&
							(intent.earMode === 'NONE' || intent.earMode === 'BEHIND')
						) {
							// v0 does not even look at the anchor pixel for these two modes, so it
							// comes back null however it was written
							expect(decoded!.earAnchor, 'earAnchor').toBeNull();
							continue;
						}
						expect(decoded![key], key).toBe(intent[key]);
					}
					expect(Math.abs((decoded!.chestSize as number) - (intent.chestSize as number))).toBeLessThanOrEqual(
						CHEST_STEP,
					);
					for (const key of ['tailBend0', 'tailBend1', 'tailBend2', 'tailBend3']) {
						expect(
							Math.abs((decoded![key] as number) - (intent[key] as number)),
							key,
						).toBeLessThanOrEqual(BEND_STEP);
					}
				});
			}
		});
	}
});

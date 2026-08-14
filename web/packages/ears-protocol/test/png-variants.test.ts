import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { png } from '../src/index.js';
import { REPO_ROOT } from './helpers.js';

/**
 * Real skins are not all 8-bit RGBA.
 *
 * Of fifteen skins pulled from actual accounts, eight were palette images, two were RGB with a tRNS
 * colour key, and one was 4-bit indexed — which crashed the decoder outright. These fixtures cover
 * every colour type and bit depth PNG allows, with expected pixels produced by an independent
 * decoder (Pillow), so "it decoded without throwing" is not mistaken for "it decoded correctly".
 *
 * Regenerate with `tests/png-variants/generate.py`.
 */

const DIR = join(REPO_ROOT, 'tests', 'png-variants');

interface Expected {
	[file: string]: { w: number; h: number; data: number[] };
}

const expected = JSON.parse(readFileSync(join(DIR, 'expected.json'), 'utf8')) as Expected;

describe('PNG decoding', () => {
	it('covers every colour type and bit depth', () => {
		expect(Object.keys(expected).length).toBeGreaterThanOrEqual(9);
	});

	for (const [file, ref] of Object.entries(expected)) {
		it(`decodes ${file} exactly as an independent decoder does`, () => {
			const img = png.decode(readFileSync(join(DIR, file)));
			expect([img.width, img.height]).toEqual([ref.w, ref.h]);

			const ours = Array.from(img.data);
			// report the first difference rather than dumping 16k numbers
			const at = ours.findIndex((v, i) => v !== ref.data[i]);
			if (at !== -1) {
				const px = Math.floor(at / 4);
				throw new Error(
					`${file}: pixel ${px % ref.w},${Math.floor(px / ref.w)} differs — ` +
						`got [${ours.slice(px * 4, px * 4 + 4).join(', ')}], ` +
						`expected [${ref.data.slice(px * 4, px * 4 + 4).join(', ')}]`,
				);
			}
			expect(at).toBe(-1);
		});
	}

	it('round-trips its own output', () => {
		for (const file of Object.keys(expected)) {
			const once = png.decode(readFileSync(join(DIR, file)));
			const twice = png.decode(png.encode(once));
			expect(Buffer.from(twice.data).equals(Buffer.from(once.data)), file).toBe(true);
		}
	});
});

/**
 * Emits skins written by the TypeScript encoder into tests/fixtures-ts/, for Java to decode.
 *
 * This is the half of the contract that cannot be faked: an encoder checked only against its own
 * decoder can be self-consistently wrong. Java decoding these is what proves otherwise.
 *
 *   bun run fixtures:emit && bun run fixtures:decode && bun run test:reverse
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
	SkinImage,
	alfalfa,
	detect,
	png,
	write,
	type AlfalfaData,
	type PartialFeatures,
} from '../src/index.js';
import { FIXTURES_DIR, REPO_ROOT, loadFixtureIndex } from '../test/helpers.js';

const OUT_DIR = join(REPO_ROOT, 'tests', 'fixtures-ts');

/** Same deterministic base skin the Java oracle uses, so diffs are about data, not noise. */
function baseSkin(): SkinImage {
	const img = new SkinImage(64, 64);
	for (let y = 0; y < 64; y++) {
		for (let x = 0; x < 64; x++) {
			const r = (x * 4) & 0xff;
			const g = (y * 4) & 0xff;
			const b = ((x ^ y) * 4) & 0xff;
			img.setARGB(x, y, ((0xff000000 | (r << 16) | (g << 8) | b) >>> 0));
		}
	}
	return img;
}

function serializeFeatures(f: ReturnType<typeof detect>): Record<string, unknown> {
	return {
		enabled: f.enabled,
		earMode: f.earMode,
		earAnchor: f.earAnchor,
		claws: f.claws,
		horn: f.horn,
		tailMode: f.tailMode,
		tailSegments: f.tailSegments,
		tailBend0: f.tailBend0,
		tailBend1: f.tailBend1,
		tailBend2: f.tailBend2,
		tailBend3: f.tailBend3,
		snoutOffset: f.snoutOffset,
		snoutWidth: f.snoutWidth,
		snoutHeight: f.snoutHeight,
		snoutDepth: f.snoutDepth,
		chestSize: f.chestSize,
		wingMode: f.wingMode,
		animateWings: f.animateWings,
		capeEnabled: f.capeEnabled,
		emissive: f.emissive,
	};
}

interface Case {
	name: string;
	features: PartialFeatures;
	alfalfa?: AlfalfaData;
	format?: 'auto' | 'v1' | 'v0';
	/**
	 * The Java fixture these features came from. When set, Java decoding our skin must reproduce
	 * that fixture's `decoded.json` exactly, and our config block must match theirs byte for byte
	 * — the strongest statement we can make about the encoder.
	 */
	source?: string;
	/** Whether the byte-level comparison against Java's skin is meaningful for this case. */
	compareBytes?: boolean;
}

const cases: Case[] = [];

// 1. Re-encode every Java fixture that decoded to something. If our encoder agrees with theirs,
//    Java must read our skin back as the very same features it produced in the first place.
const index = loadFixtureIndex();
for (const entry of index.fixtures) {
	if (entry.reencode !== 'stable') continue; // the known asymmetries can't survive by definition
	const dir = join(FIXTURES_DIR, entry.name);
	const skin = png.decode(readFileSync(join(dir, 'skin.png')));
	// the raw payload, before detect gets a chance to upgrade a legacy wing — writing back exactly
	// what Java stored is what makes a byte-level comparison of the alpha channel meaningful
	const rawAlfalfa = alfalfa.read(skin);
	const decoded = detect(skin, rawAlfalfa);
	if (!decoded.enabled) continue;
	const { enabled: _e, emissiveSkin: _s, emissiveWing: _w, alfalfa: _a, ...features } = decoded;
	cases.push({
		name: `roundtrip-${entry.name}`,
		features,
		alfalfa: rawAlfalfa.version === 0 ? undefined : rawAlfalfa,
		format: entry.format === 'v0' ? 'v0' : 'auto',
		source: entry.name,
		// only claim byte equality where Java's own re-encode is byte-stable; where it isn't, the
		// original skin carries bits that no reader looks at (see Fixtures.sameConfigBlock)
		compareBytes: entry.reencodeBytes === 'stable',
	});
}

// 2. Cases the Java oracle cannot produce, because Java has no v0 writer at all.
const base: PartialFeatures = {
	earMode: 'NONE',
	earAnchor: 'CENTER',
	claws: false,
	horn: false,
	tailMode: 'NONE',
	tailSegments: 0,
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
};

cases.push({
	name: 'ts-v0-fallback-star-overlap',
	// STAR_OVERLAP is ordinal 8; 'auto' must notice it does not fit v1 and fall back to v0
	features: { ...base, tailMode: 'STAR_OVERLAP', tailSegments: 2, tailBend0: 20, tailBend1: 40 },
});
cases.push({
	name: 'ts-v1-everything',
	features: {
		...base,
		earMode: 'AROUND',
		earAnchor: 'FRONT',
		claws: true,
		horn: true,
		tailMode: 'DOWN',
		tailSegments: 4,
		tailBend0: 30,
		tailBend1: -20,
		tailBend2: 15,
		tailBend3: -10,
		snoutWidth: 4,
		snoutHeight: 2,
		snoutDepth: 3,
		snoutOffset: 3,
		chestSize: 0.75,
		wingMode: 'ASYMMETRIC_DUAL',
		animateWings: true,
		capeEnabled: true,
	},
	alfalfa: {
		version: 1,
		entries: new Map([['wing', png.encode(wingTexture())]]),
	},
});
cases.push({ name: 'ts-v0-forced', features: { ...base, earMode: 'SIDES', claws: true }, format: 'v0' });
cases.push({ name: 'ts-empty', features: base });

function wingTexture(): SkinImage {
	const img = new SkinImage(20, 16);
	for (let y = 1; y < 15; y++) {
		for (let x = 1; x < 19; x++) {
			img.setARGB(x, y, x >= 10 && y >= 8 ? 0xff402080 : 0xff804020);
		}
	}
	return img;
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const manifest: { name: string; format: string; source?: string; compareBytes?: boolean }[] = [];
for (const c of cases) {
	const dir = join(OUT_DIR, c.name);
	mkdirSync(dir, { recursive: true });
	const img = baseSkin();
	const opts: Parameters<typeof write>[2] = { format: c.format ?? 'auto' };
	if (c.alfalfa) opts.alfalfa = c.alfalfa;
	const result = write(c.features, img, opts);
	const bytes = png.encode(img);
	writeFileSync(join(dir, 'skin.png'), bytes);

	// what we ourselves read back out of the skin we just wrote. Note this is NOT the thing the
	// reverse test asserts against — our decode of our own encode would agree with itself even if
	// both were wrong. It is written for debugging a failure.
	const reread = png.decode(bytes);
	const ours = detect(reread, alfalfa.read(reread));
	writeFileSync(join(dir, 'ts-decoded.json'), `${JSON.stringify(serializeFeatures(ours), null, '\t')}\n`);

	// the features we asked for, which is what Java's decode gets held to (modulo quantization)
	writeFileSync(join(dir, 'intent.json'), `${JSON.stringify(c.features, null, '\t')}\n`);

	const entry: { name: string; format: string; source?: string; compareBytes?: boolean } = {
		name: c.name,
		format: result.format,
	};
	if (c.source) entry.source = c.source;
	if (c.compareBytes !== undefined) entry.compareBytes = c.compareBytes;
	manifest.push(entry);
}

writeFileSync(join(OUT_DIR, 'index.json'), `${JSON.stringify({ fixtures: manifest }, null, '\t')}\n`);
console.log(`Wrote ${cases.length} TypeScript-encoded fixtures to ${OUT_DIR}`);

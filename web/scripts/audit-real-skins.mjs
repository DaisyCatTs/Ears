/**
 * Runs real player skins through the editor's pipeline and reports exactly what it changed.
 *
 * The question this answers is "will this work on someone else's skin", and the honest form of that
 * question is: after adding Ears data, which pixels differ, and are they all pixels we are entitled
 * to touch? Anything outside the config block and the Alfalfa alpha regions would be data loss.
 *
 *   bun run scripts/audit-real-skins.mjs <dir-of-skins>
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SkinImage, alfalfa, detect, png, write } from '../packages/ears-protocol/src/index.ts';
import { CaptureDelegate, render } from '../packages/ears-renderer/src/index.ts';

const dir = process.argv[2] ?? 'C:/Users/Daisy/Desktop/Ears/realskins';

/** Same conversion the app does on import. */
function toModern(img) {
	if (img.height === 64) return img;
	const out = new SkinImage(64, 64);
	for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) out.setARGB(x, y, img.getARGB(x, y));
	const faces = [
		[4, 16, 4, 4, 20, 48], [8, 16, 4, 4, 24, 48], [0, 20, 4, 12, 24, 52],
		[4, 20, 4, 12, 20, 52], [8, 20, 4, 12, 16, 52], [12, 20, 4, 12, 28, 52],
		[44, 16, 4, 4, 36, 48], [48, 16, 4, 4, 40, 48], [40, 20, 4, 12, 40, 52],
		[44, 20, 4, 12, 36, 52], [48, 20, 4, 12, 32, 52], [52, 20, 4, 12, 44, 52],
	];
	for (const [sx, sy, w, h, dx, dy] of faces) {
		for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
			out.setARGB(dx + (w - 1 - x), dy + y, img.getARGB(sx + x, sy + y));
		}
	}
	return out;
}

const inConfigBlock = (x, y) => x < 4 && y >= 32 && y < 36;
const inEncodeRegion = (x, y) =>
	alfalfa.ENCODE_REGIONS.some((r) => x >= r.x1 && x < r.x2 && y >= r.y1 && y < r.y2);

const FEATURES = {
	earMode: 'FLOPPY', earAnchor: 'CENTER', claws: true, horn: false,
	tailMode: 'DOWN', tailSegments: 3, tailBend0: 35, tailBend1: 25, tailBend2: 15, tailBend3: 0,
	snoutOffset: 3, snoutWidth: 3, snoutHeight: 2, snoutDepth: 2, chestSize: 0,
	wingMode: 'NONE', animateWings: true, capeEnabled: false, emissive: false,
};

let failures = 0;
const rows = [];

for (const file of readdirSync(dir).filter((f) => f.endsWith('.png')).sort()) {
	const original = png.decode(readFileSync(join(dir, file)));
	const legacy = original.height === 32;
	const base = toModern(original);
	const before = base.clone();

	const out = base.clone();
	const { format } = write(FEATURES, out, { format: 'auto' });
	const bytes = png.encode(out);

	// what did we change, and were we allowed to?
	let configChanged = 0;
	let alphaOnlyInRegion = 0;
	let colourInRegion = 0;
	let outside = 0;
	for (let y = 0; y < 64; y++) {
		for (let x = 0; x < 64; x++) {
			const a = before.getARGB(x, y);
			const b = out.getARGB(x, y);
			if (a === b) continue;
			if (inConfigBlock(x, y)) configChanged++;
			else if (inEncodeRegion(x, y)) {
				// only the alpha channel should move there; the colour is the player's
				if ((a & 0x00ffffff) === (b & 0x00ffffff)) alphaOnlyInRegion++;
				else colourInRegion++;
			} else outside++;
		}
	}

	// and does it read back correctly?
	const reread = png.decode(bytes);
	const decoded = detect(reread, alfalfa.read(reread));
	const roundTrip =
		decoded.enabled &&
		decoded.earMode === 'FLOPPY' &&
		decoded.claws &&
		decoded.tailMode === 'DOWN' &&
		decoded.tailSegments === 3 &&
		decoded.snoutWidth === 3;

	const capture = new CaptureDelegate(false, false);
	render(decoded, capture);

	const ok = roundTrip && outside === 0 && colourInRegion === 0 && capture.objects.length > 0;
	if (!ok) failures++;
	rows.push({
		file, legacy, format, roundTrip, quads: capture.objects.length,
		configChanged, alphaOnlyInRegion, colourInRegion, outside, ok,
	});
}

const pad = (s, n) => String(s).padEnd(n);
console.log(
	`${pad('skin', 22)}${pad('src', 7)}${pad('fmt', 5)}${pad('round', 7)}${pad('quads', 7)}${pad('cfg px', 8)}${pad('alpha px', 10)}${pad('colour px', 11)}${pad('outside', 9)}`,
);
for (const r of rows) {
	console.log(
		pad(r.file, 22) + pad(r.legacy ? '64x32' : '64x64', 7) + pad(r.format, 5) +
		pad(r.roundTrip ? 'ok' : 'BAD', 7) + pad(r.quads, 7) + pad(r.configChanged, 8) +
		pad(r.alphaOnlyInRegion, 10) + pad(r.colourInRegion, 11) + pad(r.outside, 9) +
		(r.ok ? '' : '  <-- PROBLEM'),
	);
}
console.log(`\n${rows.length} skins, ${failures} problems`);
console.log('cfg px = the 4x4 Ears data block; alpha px = alpha-only changes in the Alfalfa regions');
console.log('colour px / outside = pixels we changed that we should not have; both must be 0');
process.exit(failures ? 1 : 0);

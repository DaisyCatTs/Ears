import * as alfalfa from './alfalfa.js';
import { SkinImage } from './image.js';
import { ALFALFA_NONE, disabledFeatures, type AlfalfaData, type EarsFeatures } from './model.js';
import * as png from './png.js';
import * as v0 from './v0.js';
import * as v1 from './v1.js';

/**
 * Decodes everything Ears knows about a skin, mirroring `EarsFeaturesParser.detect`.
 *
 * **This mutates `img`** when emissive is in play: matching pixels are cleared out of the base skin
 * so they aren't drawn twice, exactly as Java does. Pass a clone if you need the original.
 */
export function detect(img: SkinImage, data?: AlfalfaData): EarsFeatures {
	const alf = data ?? alfalfa.read(img);
	if (img.height !== 64) return disabledFeatures();

	const first = img.getARGB(0, 32) & 0x00ffffff;
	let feat: v1.PartialFeatures | null;
	if (first === v0.MAGIC) {
		feat = v0.decode(img);
	} else if (first === v1.MAGIC) {
		feat = v1.decode(v1.readBlock(img));
	} else {
		return disabledFeatures();
	}
	if (feat === null) return disabledFeatures();

	let entries = alf.entries;

	if (feat.wingMode !== 'NONE' && !entries.has('wing')) {
		feat.wingMode = 'NONE';
	}

	const wingBytes = entries.get('wing');
	if (wingBytes) {
		try {
			const wing = png.decode(wingBytes);
			if (wing.width === 12 && wing.height === 12) {
				// legacy wing: blit into a 20x16 at (x, y+2)
				const out = new SkinImage(20, 16);
				for (let x = 0; x < 12; x++) {
					for (let y = 0; y < 12; y++) {
						out.setARGB(x, y + 2, wing.getARGB(x, y));
					}
				}
				entries = new Map(entries);
				entries.set('wing', png.encode(out));
			} else if (wing.width !== 20 || wing.height !== 16) {
				feat.wingMode = 'NONE';
			}
		} catch {
			feat.wingMode = 'NONE';
		}
	}

	let emissiveSkin: Uint8Array | null = null;
	let emissiveWing: Uint8Array | null = null;
	if (feat.emissive) {
		const out = img.clone();
		const palette = new Set<number>();
		for (let x = 52; x < 56; x++) {
			for (let y = 32; y < 36; y++) {
				const color = img.getARGB(x, y);
				if (((color >>> 24) & 0xff) > 0) palette.add(color & 0x00ffffff);
			}
		}
		if (palette.size === 0) {
			feat.emissive = false;
		} else {
			for (let x = 0; x < 64; x++) {
				for (let y = 0; y < 64; y++) {
					const c = img.getARGB(x, y);
					if (palette.has(c & 0x00ffffff)) {
						img.setARGB(x, y, 0);
					} else {
						out.setARGB(x, y, 0);
					}
				}
			}
			const wingEntry = entries.get('wing');
			if (wingEntry && feat.wingMode !== 'NONE') {
				try {
					const wing = png.decode(wingEntry);
					const wout = wing.clone();
					for (let x = 0; x < wing.width; x++) {
						for (let y = 0; y < wing.height; y++) {
							const c = wing.getARGB(x, y);
							if (palette.has(c & 0x00ffffff)) {
								wing.setARGB(x, y, 0);
							} else {
								wout.setARGB(x, y, 0);
							}
						}
					}
					// note: the stripped wing is deliberately *not* written back to alfalfa — Java
					// mutates only its decoded copy here, so the stored texture keeps its
					// emissive pixels
					emissiveWing = png.encode(wout);
				} catch {
					emissiveWing = null;
				}
			}
			emissiveSkin = png.encode(out);
		}
	}

	return {
		enabled: true,
		...feat,
		emissiveSkin,
		emissiveWing,
		// the upgrade path keeps the original version, as Java does
		alfalfa: entries === alf.entries ? alf : { version: alf.version, entries },
	};
}

export { ALFALFA_NONE };

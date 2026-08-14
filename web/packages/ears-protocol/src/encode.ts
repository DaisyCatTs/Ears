import * as alfalfa from './alfalfa.js';
import type { SkinImage } from './image.js';
import { ALFALFA_NONE, type AlfalfaData } from './model.js';
import * as v0 from './v0.js';
import * as v1 from './v1.js';

export type SkinFormat = 'v1' | 'v0';

export interface WriteOptions {
	/**
	 * Which encoding to use. The default, `'auto'`, writes v1 and falls back to v0 only when the
	 * configuration cannot be expressed in v1 — today that means a `STAR_OVERLAP` tail, whose
	 * ordinal (8) does not fit v1's 3-bit field and would silently truncate to `NONE`.
	 */
	format?: SkinFormat | 'auto';
	alfalfa?: AlfalfaData;
}

export interface WriteResult {
	format: SkinFormat;
}

/**
 * Writes Ears data into a skin, in place.
 *
 * Both the config block and the alfalfa payload are written, so this scrubs any previous Ears data
 * — including when there is no alfalfa to store, which resets the alpha channel to opaque.
 */
export function write(feat: v1.PartialFeatures, img: SkinImage, opts: WriteOptions = {}): WriteResult {
	if (img.width !== 64 || img.height !== 64) {
		throw new Error(`Ears data needs a 64x64 skin; got ${img.width}x${img.height}`);
	}
	const requested = opts.format ?? 'auto';
	const format: SkinFormat =
		requested === 'auto' ? (v1.canEncode(feat) ? 'v1' : 'v0') : requested;

	if (format === 'v1' && !v1.canEncode(feat)) {
		throw new Error(
			`Tail mode ${feat.tailMode} cannot be written as v1 — its ordinal does not fit the 3-bit field. Use 'auto' or 'v0'.`,
		);
	}

	if (format === 'v1') {
		v1.writeBlock(v1.encode(feat), img);
	} else {
		v0.encode(feat, img);
	}
	alfalfa.write(opts.alfalfa ?? ALFALFA_NONE, img);
	return { format };
}

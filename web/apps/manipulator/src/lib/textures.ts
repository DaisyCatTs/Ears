import { SkinImage, png, type AlfalfaData } from '@ears/protocol';

/**
 * Wing and cape textures, which live inside Alfalfa rather than in the skin itself.
 */

export type TextureKind = 'wing' | 'cape';

export interface TextureResult {
	entry: Uint8Array;
	notice?: string;
}

/**
 * Ears wings are 20x16. A 12x12 is accepted too — the parser upgrades those in flight by blitting
 * them at (x, y+2), which is what the preview will show.
 */
export function prepareWing(bytes: Uint8Array): TextureResult {
	const img = png.decode(bytes);
	if (img.width === 20 && img.height === 16) return { entry: png.encode(img) };
	if (img.width === 12 && img.height === 12) {
		return {
			entry: png.encode(img),
			notice: 'A 12x12 wing — Ears will upgrade it to 20x16 when it loads the skin.',
		};
	}
	throw new Error(`Wings must be 20x16 (or a legacy 12x12); that one is ${img.width}x${img.height}.`);
}

/**
 * Ears capes are 20x16. A 64x32 Mojang cape is converted by taking the two 10x16 halves out of the
 * standard layout, the same conversion the old manipulator did.
 */
export function prepareCape(bytes: Uint8Array): TextureResult {
	const img = png.decode(bytes);
	if (img.width === 20 && img.height === 16) return { entry: png.encode(img) };
	if (img.width === 64 && img.height === 32) {
		const out = new SkinImage(20, 16);
		blit(img, out, 1, 1, 10, 16, 0, 0);
		blit(img, out, 12, 1, 10, 16, 10, 0);
		return { entry: png.encode(out), notice: 'Converted a 64x32 Minecraft cape to the 20x16 Ears layout.' };
	}
	// Mojang capes have been 64x32 since 1.6; older 22x17 ones are not worth guessing at
	throw new Error(`Capes must be 20x16 or a 64x32 Minecraft cape; that one is ${img.width}x${img.height}.`);
}

function blit(
	src: SkinImage,
	dst: SkinImage,
	sx: number,
	sy: number,
	w: number,
	h: number,
	dx: number,
	dy: number,
): void {
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			dst.setARGB(dx + x, dy + y, src.getARGB(sx + x, sy + y));
		}
	}
}

export function withEntry(alfalfa: AlfalfaData, key: string, value: Uint8Array): AlfalfaData {
	const entries = new Map(alfalfa.entries);
	entries.set(key, value);
	return { version: 1, entries };
}

export function withoutEntry(alfalfa: AlfalfaData, key: string): AlfalfaData {
	const entries = new Map(alfalfa.entries);
	entries.delete(key);
	// dropping the last entry takes the whole payload with it, freeing the alpha channel
	return { version: entries.size === 0 ? 0 : 1, entries };
}

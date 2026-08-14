import { decode as decodePng, encode as encodePng } from 'fast-png';

import { SkinImage } from './image.js';

/**
 * PNG in and out, normalized to RGBA8.
 *
 * Deliberately **not** canvas-based. Ears stores Alfalfa in the alpha channel, and a canvas
 * round-trip premultiplies alpha in some browsers, which silently destroys that data. Decoding has
 * to be done on the raw bytes.
 */

export function decode(bytes: Uint8Array): SkinImage {
	const png = decodePng(bytes);
	const { width, height, depth, channels } = png;
	const src = png.data;
	const out = new Uint8Array(width * height * 4);

	// fast-png hands back 8- or 16-bit samples with 1-4 channels, plus an optional palette
	const shift = depth === 16 ? 8 : 0;
	const palette = png.palette;

	for (let i = 0; i < width * height; i++) {
		let r: number;
		let g: number;
		let b: number;
		let a = 255;
		if (palette) {
			const entry = palette[src[i]!]!;
			r = entry[0]!;
			g = entry[1]!;
			b = entry[2]!;
			if (entry.length > 3) a = entry[3]!;
		} else if (channels === 1) {
			r = g = b = (src[i]! >> shift) & 0xff;
		} else if (channels === 2) {
			r = g = b = (src[i * 2]! >> shift) & 0xff;
			a = (src[i * 2 + 1]! >> shift) & 0xff;
		} else if (channels === 3) {
			r = (src[i * 3]! >> shift) & 0xff;
			g = (src[i * 3 + 1]! >> shift) & 0xff;
			b = (src[i * 3 + 2]! >> shift) & 0xff;
		} else {
			r = (src[i * 4]! >> shift) & 0xff;
			g = (src[i * 4 + 1]! >> shift) & 0xff;
			b = (src[i * 4 + 2]! >> shift) & 0xff;
			a = (src[i * 4 + 3]! >> shift) & 0xff;
		}
		out[i * 4] = r;
		out[i * 4 + 1] = g;
		out[i * 4 + 2] = b;
		out[i * 4 + 3] = a;
	}

	return new SkinImage(width, height, out);
}

export function encode(img: SkinImage): Uint8Array {
	return encodePng({
		width: img.width,
		height: img.height,
		depth: 8,
		channels: 4,
		data: img.data,
	});
}

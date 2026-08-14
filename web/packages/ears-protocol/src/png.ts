import { decode as decodePng, encode as encodePng } from 'fast-png';

import { SkinImage } from './image.js';

/**
 * PNG in and out, normalized to RGBA8.
 *
 * Deliberately **not** canvas-based. Ears stores Alfalfa in the alpha channel, and a canvas
 * round-trip premultiplies alpha in some browsers, which silently destroys that data. Decoding has
 * to be done on the raw bytes.
 *
 * Real skins are not all 8-bit RGBA. In a sample of fifteen skins pulled from actual accounts,
 * eight were palette images, two were RGB with no alpha channel, and one was **4-bit** indexed —
 * so every PNG colour type and bit depth that Minecraft accepts has to be handled here.
 */

export function decode(bytes: Uint8Array): SkinImage {
	const png = decodePng(bytes);
	const { width, height, depth, channels } = png;
	const src = png.data;
	const palette = png.palette;
	const out = new Uint8Array(width * height * 4);

	// A tRNS chunk on a non-palette image names one colour as fully transparent. Skins use it for
	// cut-out second layers, and ignoring it turns every see-through pixel opaque — two of fifteen
	// real skins tested were affected.
	const trns = png.transparency;
	const keyR = trns && trns.length >= 3 ? trns[0] : undefined;
	const keyG = trns && trns.length >= 3 ? trns[1] : undefined;
	const keyB = trns && trns.length >= 3 ? trns[2] : undefined;
	const keyGray = trns && trns.length === 1 ? trns[0] : undefined;

	const put = (i: number, r: number, g: number, b: number, a: number) => {
		out[i * 4] = r;
		out[i * 4 + 1] = g;
		out[i * 4 + 2] = b;
		out[i * 4 + 3] = a;
	};

	if (depth < 8) {
		// Bit depths below 8 are only legal for grayscale and palette images, both single-channel.
		// Samples are packed most significant bit first, and every row starts on a byte boundary.
		const perByte = 8 / depth;
		const mask = (1 << depth) - 1;
		const stride = Math.ceil((width * depth) / 8);
		const maxValue = mask;
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const byte = src[y * stride + Math.floor(x / perByte)] ?? 0;
				const shift = 8 - depth * ((x % perByte) + 1);
				const sample = (byte >> shift) & mask;
				const i = y * width + x;
				if (palette) {
					const entry = palette[sample];
					if (entry) {
						put(i, entry[0] ?? 0, entry[1] ?? 0, entry[2] ?? 0, entry[3] ?? 255);
					} else {
						put(i, 0, 0, 0, 0);
					}
				} else {
					const v = Math.round((sample / maxValue) * 255);
					put(i, v, v, v, keyGray !== undefined && sample === keyGray ? 0 : 255);
				}
			}
		}
		return new SkinImage(width, height, out);
	}

	// 8- or 16-bit samples; for 16 we keep the high byte, which is what the skin was authored in
	const shift = depth === 16 ? 8 : 0;
	for (let i = 0; i < width * height; i++) {
		if (palette) {
			const entry = palette[src[i] ?? 0];
			if (entry) {
				put(i, entry[0] ?? 0, entry[1] ?? 0, entry[2] ?? 0, entry[3] ?? 255);
			} else {
				put(i, 0, 0, 0, 0);
			}
		} else if (channels === 1) {
			const raw = src[i] ?? 0;
			const v = (raw >> shift) & 0xff;
			put(i, v, v, v, keyGray !== undefined && raw === keyGray ? 0 : 255);
		} else if (channels === 2) {
			const v = ((src[i * 2] ?? 0) >> shift) & 0xff;
			put(i, v, v, v, ((src[i * 2 + 1] ?? 0) >> shift) & 0xff);
		} else if (channels === 3) {
			const r = src[i * 3] ?? 0;
			const g = src[i * 3 + 1] ?? 0;
			const b = src[i * 3 + 2] ?? 0;
			const transparent = keyR !== undefined && r === keyR && g === keyG && b === keyB;
			put(i, (r >> shift) & 0xff, (g >> shift) & 0xff, (b >> shift) & 0xff, transparent ? 0 : 255);
		} else {
			put(
				i,
				((src[i * 4] ?? 0) >> shift) & 0xff,
				((src[i * 4 + 1] ?? 0) >> shift) & 0xff,
				((src[i * 4 + 2] ?? 0) >> shift) & 0xff,
				((src[i * 4 + 3] ?? 0) >> shift) & 0xff,
			);
		}
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

import {
	SkinImage,
	alfalfa as alfalfaCodec,
	detect,
	png,
	write,
	type AlfalfaData,
	type EarsFeatures,
	type PartialFeatures,
	type SkinFormat,
} from '@ears/protocol';

/** Everything the editor needs to know about a loaded skin. */
export interface LoadedSkin {
	/** The skin as it will be edited and exported, always 64x64. */
	image: SkinImage;
	/** The same pixels before `detect` stripped emissive pixels out of them. */
	original: SkinImage;
	features: EarsFeatures;
	alfalfa: AlfalfaData;
	notices: Notice[];
	/** Overlay parts to hide on load, keyed by part name. */
	hideOverlays?: string[];
}

export interface Notice {
	kind: 'ok' | 'warn' | 'error';
	message: string;
	detail?: string;
}

const MAX_DIMENSION = 4096;

export function decodeSkin(bytes: Uint8Array): LoadedSkin {
	let image = png.decode(bytes);
	const notices: Notice[] = [];

	// arbitrary PNGs are hostile input; a huge one is a memory problem long before it's a skin
	if (image.width > MAX_DIMENSION || image.height > MAX_DIMENSION) {
		throw new Error(`That image is ${image.width}x${image.height}; skins are 64x64.`);
	}

	const hideOverlays: string[] = [];
	if (image.width === 64 && image.height === 32) {
		const opaqueHat = isFullyOpaque(image, 32, 0, 32, 8);
		image = convertLegacySkin(image);
		notices.push({
			kind: 'warn',
			message: 'Converted a legacy 64x32 skin to 64x64',
			detail: 'The second arm and leg were mirrored from the first, as Minecraft does.',
		});
		if (opaqueHat) {
			// Skins from before alpha was used often have a solid hat layer, which would render as
			// a box around the head. Hide it rather than edit their pixels — the toggle is right
			// there in the Model section if they want it back.
			hideOverlays.push('head');
			notices.push({
				kind: 'warn',
				message: 'The hat layer is solid, so it is hidden',
				detail: 'Old skins often fill it in rather than leaving it transparent. Turn "Hat" back on to see it.',
			});
		}
	} else if (image.width !== 64 || image.height !== 64) {
		throw new Error(`Skins must be 64x64 (or a legacy 64x32); this one is ${image.width}x${image.height}.`);
	} else {
		notices.push({ kind: 'ok', message: '64x64 Java Edition skin' });
	}

	const original = image.clone();
	const alfalfa = alfalfaCodec.read(image);
	// detect strips emissive pixels out of `image`, which is what Ears itself does
	const features = detect(image, alfalfa);

	if (features.enabled) {
		const magic = original.getARGB(0, 32) & 0x00ffffff;
		notices.push({
			kind: 'ok',
			message: `Ears data detected (${magic === 0x3f23d8 ? 'v0 pixelwise' : 'v1 binary'})`,
		});
	} else {
		notices.push({ kind: 'ok', message: 'No Ears data — starting fresh' });
	}

	if (alfalfa.version > 0) {
		notices.push({
			kind: 'ok',
			message: `Alfalfa v${alfalfa.version} with ${alfalfa.entries.size} entr${alfalfa.entries.size === 1 ? 'y' : 'ies'}`,
			detail: [...alfalfa.entries.keys()].join(', '),
		});
	}

	if (features.emissive && features.emissiveSkin) {
		notices.push({ kind: 'ok', message: 'Emissive palette found' });
	}

	return { image, original, features, alfalfa, notices, hideOverlays };
}

function isFullyOpaque(img: SkinImage, x: number, y: number, w: number, h: number): boolean {
	for (let dy = 0; dy < h; dy++) {
		for (let dx = 0; dx < w; dx++) {
			if (((img.getARGB(x + dx, y + dy) >>> 24) & 0xff) !== 0xff) return false;
		}
	}
	return true;
}

/** The vanilla 64x32 → 64x64 conversion: mirror the single arm and leg into the second set. */
export function convertLegacySkin(src: SkinImage): SkinImage {
	const out = new SkinImage(64, 64);
	for (let y = 0; y < 32; y++) {
		for (let x = 0; x < 64; x++) {
			out.setARGB(x, y, src.getARGB(x, y));
		}
	}
	// [sourceX, sourceY, width, height, destX, destY] per face, mirrored horizontally
	const faces: [number, number, number, number, number, number][] = [
		// leg
		[4, 16, 4, 4, 20, 48],
		[8, 16, 4, 4, 24, 48],
		[0, 20, 4, 12, 24, 52],
		[4, 20, 4, 12, 20, 52],
		[8, 20, 4, 12, 16, 52],
		[12, 20, 4, 12, 28, 52],
		// arm
		[44, 16, 4, 4, 36, 48],
		[48, 16, 4, 4, 40, 48],
		[40, 20, 4, 12, 40, 52],
		[44, 20, 4, 12, 36, 52],
		[48, 20, 4, 12, 32, 52],
		[52, 20, 4, 12, 44, 52],
	];
	for (const [sx, sy, w, h, dx, dy] of faces) {
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				out.setARGB(dx + (w - 1 - x), dy + y, src.getARGB(sx + x, sy + y));
			}
		}
	}
	return out;
}

export interface ExportResult {
	bytes: Uint8Array;
	format: SkinFormat;
	/** Populated when the skin could not be decoded back to what was asked for. */
	problems: string[];
}

/**
 * Writes the configuration into a copy of the base skin and then reads it straight back, refusing
 * to hand over a file whose data doesn't survive the round trip.
 */
export function exportSkin(
	base: SkinImage,
	features: PartialFeatures,
	alfalfa: AlfalfaData,
): ExportResult {
	const out = base.clone();
	const { format } = write(features, out, { format: 'auto', alfalfa });
	const bytes = png.encode(out);

	const reread = png.decode(bytes);
	const decoded = detect(reread, alfalfaCodec.read(reread));

	const problems: string[] = [];
	if (!decoded.enabled) {
		problems.push('The exported skin does not read back as having Ears data at all.');
	} else {
		const checks: [string, unknown, unknown][] = [
			['ear mode', decoded.earMode, features.earMode],
			['ear anchor', decoded.earAnchor ?? features.earAnchor, features.earAnchor],
			['claws', decoded.claws, features.claws],
			['horn', decoded.horn, features.horn],
			['tail mode', decoded.tailMode, features.tailMode],
			['snout width', decoded.snoutWidth, features.snoutWidth],
			['wing mode', decoded.wingMode, features.wingMode],
			['cape', decoded.capeEnabled, features.capeEnabled],
			['emissive', decoded.emissive, features.emissive],
		];
		for (const [name, got, want] of checks) {
			// a wing mode with no texture is legitimately dropped by the parser, and emissive
			// without a palette likewise — those are reported as notices, not as export failures
			if (name === 'wing mode' && want !== 'NONE' && !alfalfa.entries.has('wing')) continue;
			if (name === 'emissive' && want === true && got === false) continue;
			if (got !== want) problems.push(`${name} came back as ${String(got)}, expected ${String(want)}`);
		}
	}

	return { bytes, format, problems };
}

export function toImageData(img: SkinImage): ImageData {
	return new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
}

export function decodeEntryToImageData(bytes: Uint8Array | undefined | null): ImageData | null {
	if (!bytes) return null;
	try {
		return toImageData(png.decode(bytes));
	} catch {
		return null;
	}
}

export function download(bytes: Uint8Array, filename: string): void {
	const blob = new Blob([bytes as unknown as BlobPart], { type: 'image/png' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	// revoking immediately can cancel the download in some browsers
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

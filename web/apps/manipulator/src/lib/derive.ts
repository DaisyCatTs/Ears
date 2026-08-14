import { SkinImage, alfalfa as alfalfaCodec, detect, png, write, type AlfalfaData, type PartialFeatures } from '@ears/protocol';
import { CaptureDelegate, render, type RenderObject } from '@ears/renderer';

import { decodeEntryToImageData, toImageData } from './skin.js';

/**
 * What the game would draw for the current configuration.
 *
 * Rather than rendering the editor's state directly, this writes it into a skin and reads it back
 * first. That costs a millisecond and buys exactness: the preview then shows the parser's actual
 * behaviour, quirks included — a wing mode with no texture disappearing, emissive doing nothing
 * without a palette — instead of an idealised version the game won't agree with.
 */
export interface Derived {
	objects: RenderObject[];
	skin: ImageData;
	wing: ImageData | null;
	cape: ImageData | null;
	emissiveSkin: ImageData | null;
	emissiveWing: ImageData | null;
	/** Differences between what was asked for and what the format could express. */
	discrepancies: string[];
	format: 'v1' | 'v0';
}

export function derive(
	original: SkinImage | null,
	features: PartialFeatures,
	alfalfa: AlfalfaData,
): Derived | null {
	if (!original) return null;

	const working = original.clone();
	const { format } = write(features, working, { format: 'auto', alfalfa });
	const bytes = png.encode(working);

	const reread = png.decode(bytes);
	const decoded = detect(reread, alfalfaCodec.read(reread));

	const capture = new CaptureDelegate(false, false);
	render(decoded.enabled ? decoded : null, capture);

	const discrepancies: string[] = [];
	if (decoded.enabled) {
		if (features.wingMode !== 'NONE' && decoded.wingMode === 'NONE') {
			discrepancies.push('Wings are set, but there is no wing texture, so Ears will not draw them.');
		}
		if (features.emissive && !decoded.emissive) {
			discrepancies.push(
				'Emissive is set, but the skin has no palette at (52,32), so nothing will glow.',
			);
		}
		if (features.tailMode !== decoded.tailMode) {
			discrepancies.push(`Tail mode ${features.tailMode} could not be stored; it reads back as ${decoded.tailMode}.`);
		}
	}

	return {
		objects: capture.objects,
		// `reread` has had its emissive pixels stripped by detect, which is what gets drawn
		skin: toImageData(reread),
		wing: decodeEntryToImageData(decoded.alfalfa.entries.get('wing')),
		cape: decodeEntryToImageData(decoded.alfalfa.entries.get('cape')),
		emissiveSkin: decodeEntryToImageData(decoded.emissiveSkin),
		emissiveWing: decodeEntryToImageData(decoded.emissiveWing),
		discrepancies,
		format,
	};
}

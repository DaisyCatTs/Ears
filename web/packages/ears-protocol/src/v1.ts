import { BitReader, BitWriter } from './bits.js';
import type { SkinImage } from './image.js';
import {
	EAR_ANCHORS,
	EAR_MODES,
	TAIL_MODES,
	WING_MODES,
	type EarsFeatures,
	ordinalOr,
} from './model.js';

/**
 * v1 "binary" Ears data: a bit stream packed into the RGB channels of the 4x4 block at (0,32).
 *
 * Ported from `EarsFeaturesParserV1` / `EarsFeaturesWriterV1`.
 */

export const MAGIC = 0xea2501; // EARS01

/** 15 usable pixels x 3 channels. */
export const CAPACITY_BYTES = (4 * 4 - 1) * 3;

/** Pulls the raw bit stream out of the config block, row-major, skipping the magic pixel. */
export function readBlock(img: SkinImage): Uint8Array {
	const out = new Uint8Array(CAPACITY_BYTES);
	let i = 0;
	for (let y = 0; y < 4; y++) {
		for (let x = 0; x < 4; x++) {
			if (x === 0 && y === 0) continue;
			const c = img.getARGB(x, 32 + y);
			out[i++] = (c >>> 16) & 0xff;
			out[i++] = (c >>> 8) & 0xff;
			out[i++] = c & 0xff;
		}
	}
	return out;
}

/** Writes the magic pixel and the given payload into the config block, forcing alpha opaque. */
export function writeBlock(payload: Uint8Array, img: SkinImage): void {
	if (payload.length > CAPACITY_BYTES) {
		throw new Error(`Cannot write ${payload.length} bytes of v1 data; only ${CAPACITY_BYTES} fit`);
	}
	let i = 0;
	const next = () => (i < payload.length ? payload[i++]! : ((i++, 0) as number));
	for (let y = 0; y < 4; y++) {
		for (let x = 0; x < 4; x++) {
			if (x === 0 && y === 0) {
				img.setARGB(0, 32, 0xffea2501);
				continue;
			}
			const r = next();
			const g = next();
			const b = next();
			img.setARGB(x, 32 + y, ((0xff000000 | (r << 16) | (g << 8) | b) >>> 0));
		}
	}
}

export type PartialFeatures = Omit<EarsFeatures, 'enabled' | 'emissiveSkin' | 'emissiveWing' | 'alfalfa'>;

/** Returns null if the stream runs out, which Java treats as "disabled". */
export function decode(bytes: Uint8Array): PartialFeatures | null {
	try {
		const bis = new BitReader(bytes);

		// the version field currently means nothing; future versions may append data, and earlier
		// fields are not allowed to change shape
		bis.read(8);

		const ears = bis.read(6);
		let earMode = 'NONE' as PartialFeatures['earMode'];
		let earAnchor = 'CENTER' as PartialFeatures['earAnchor'];
		if (ears !== 0) {
			earMode = ordinalOr(EAR_MODES, Math.floor((ears - 1) / 3) + 1, 'NONE');
			earAnchor = ordinalOr(EAR_ANCHORS, (ears - 1) % 3, 'CENTER');
		}

		const claws = bis.readBoolean();
		const horn = bis.readBoolean();

		const tailMode = ordinalOr(TAIL_MODES, bis.read(3), 'NONE');
		let tailSegments = 0;
		let tailBend0 = 0;
		let tailBend1 = 0;
		let tailBend2 = 0;
		let tailBend3 = 0;
		if (tailMode !== 'NONE') {
			tailSegments = bis.read(2) + 1;
			tailBend0 = Math.fround(bis.readSAMUnit(6) * 90);
			tailBend1 = tailSegments > 1 ? Math.fround(bis.readSAMUnit(6) * 90) : 0;
			tailBend2 = tailSegments > 2 ? Math.fround(bis.readSAMUnit(6) * 90) : 0;
			tailBend3 = tailSegments > 3 ? Math.fround(bis.readSAMUnit(6) * 90) : 0;
		}

		let snoutOffset = 0;
		const snoutWidth = bis.read(3); // 0 means "no snout"
		let snoutHeight = 0;
		let snoutDepth = 0;
		if (snoutWidth > 0) {
			snoutHeight = bis.read(2) + 1;
			snoutDepth = bis.read(3) + 1;
			snoutOffset = bis.read(3);
			if (snoutOffset > 8 - snoutHeight) snoutOffset = 8 - snoutHeight;
		}

		const chestSize = bis.readUnit(5);

		const wingMode = ordinalOr(WING_MODES, bis.read(3), 'NONE');
		// note: false, not "unspecified" — this is why a decoded NONE + animate pair cannot be
		// re-encoded, see tests/README.md
		const animateWings = wingMode === 'NONE' ? false : bis.readBoolean();

		const capeEnabled = bis.readBoolean();
		const emissive = bis.readBoolean();

		return {
			earMode,
			earAnchor,
			claws,
			horn,
			tailMode,
			tailSegments,
			tailBend0,
			tailBend1,
			tailBend2,
			tailBend3,
			snoutOffset,
			snoutWidth,
			snoutHeight,
			snoutDepth,
			chestSize,
			wingMode,
			animateWings,
			capeEnabled,
			emissive,
		};
	} catch {
		return null;
	}
}

/** True when every field of these features survives the v1 encoding. */
export function canEncode(feat: PartialFeatures): boolean {
	// the tail field is 3 bits, and STAR_OVERLAP is ordinal 8
	return TAIL_MODES.indexOf(feat.tailMode) <= 7;
}

export function encode(feat: PartialFeatures): Uint8Array {
	const bos = new BitWriter();
	bos.write(8, 0); // version

	const earModeOrdinal = EAR_MODES.indexOf(feat.earMode);
	const anchorOrdinal = Math.max(0, EAR_ANCHORS.indexOf(feat.earAnchor ?? 'CENTER'));
	const ears = feat.earMode === 'NONE' ? 0 : (earModeOrdinal - 1) * 3 + anchorOrdinal + 1;
	bos.write(6, ears);

	bos.writeBoolean(feat.claws);
	bos.writeBoolean(feat.horn);

	const tailOrdinal = TAIL_MODES.indexOf(feat.tailMode);
	bos.write(3, tailOrdinal);
	if (feat.tailMode !== 'NONE') {
		bos.write(2, feat.tailSegments - 1);
		bos.writeSAMUnit(6, feat.tailBend0 / 90);
		if (feat.tailSegments > 1) bos.writeSAMUnit(6, feat.tailBend1 / 90);
		if (feat.tailSegments > 2) bos.writeSAMUnit(6, feat.tailBend2 / 90);
		if (feat.tailSegments > 3) bos.writeSAMUnit(6, feat.tailBend3 / 90);
	}

	if (feat.snoutWidth > 0 && feat.snoutHeight > 0 && feat.snoutDepth > 0) {
		bos.write(3, feat.snoutWidth);
		bos.write(2, feat.snoutHeight - 1);
		bos.write(3, feat.snoutDepth - 1);
		bos.write(3, feat.snoutOffset);
	} else {
		bos.write(3, 0);
	}

	bos.writeUnit(5, feat.chestSize);

	bos.write(3, WING_MODES.indexOf(feat.wingMode));
	if (feat.wingMode !== 'NONE') {
		bos.writeBoolean(feat.animateWings);
	}

	bos.writeBoolean(feat.capeEnabled);
	bos.writeBoolean(feat.emissive);

	return bos.finish();
}

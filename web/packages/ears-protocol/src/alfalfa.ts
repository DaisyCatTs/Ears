import type { SkinImage } from './image.js';
import { ALFALFA_NONE, type AlfalfaData } from './model.js';

/**
 * Alfalfa: arbitrary binary data smuggled through the skin's alpha channel.
 *
 * Ported from `common/src/main/java/com/unascribed/ears/common/Alfalfa.java`. Three details here
 * are very easy to get wrong and produce silently unreadable skins:
 *
 * 1. **The pixel walk is column-major within each rectangle** (`for x { for y }`), not row-major.
 * 2. **Pixel 0 carries the least significant 7 bits.** Java treats the payload as one big integer
 *    and shifts right by `n*7` per pixel; because 7 does not divide 8 this is not a byte reversal,
 *    so it has to be done with a bignum.
 * 3. **A fully transparent pixel is skipped on read**, shifting the whole stream, rather than
 *    contributing a zero.
 */

interface Rectangle {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

const rect = (x1: number, y1: number, x2: number, y2: number): Rectangle => ({ x1, y1, x2, y2 });

/**
 * The forced-opaque regions of the skin, minus the front of the head (so avatar renderers and
 * launcher previews don't show the noise).
 */
export const ENCODE_REGIONS: readonly Rectangle[] = [
	rect(8, 0, 24, 8),
	rect(0, 8, 8, 16),
	rect(16, 8, 32, 16),

	rect(4, 16, 12, 20),
	rect(20, 16, 36, 20),
	rect(44, 16, 52, 20),

	rect(0, 20, 56, 32),

	rect(20, 48, 28, 52),
	rect(36, 48, 44, 52),

	rect(16, 52, 48, 64),
];

/** 1568 pixels x 7 bits = 1372 bytes. */
export const CAPACITY_BYTES = 1372;

const PREDEF_KEYS = ['END', 'wing', 'erase', 'cape'];

export const MAGIC = 0xea1fa1fa;

/** Serializes to the byte stream that then gets packed into the alpha channel. */
export function serialize(data: AlfalfaData): Uint8Array {
	if (data.version === 0) return new Uint8Array(0);
	if (data.version !== 1) throw new Error(`Don't know how to write Alfalfa version ${data.version}`);
	const out: number[] = [];
	out.push((MAGIC >>> 24) & 0xff, (MAGIC >>> 16) & 0xff, (MAGIC >>> 8) & 0xff, MAGIC & 0xff);
	out.push(data.version & 0xff);
	for (const [key, value] of data.entries) {
		const idx = PREDEF_KEYS.indexOf(key);
		if (key.startsWith('!unk')) {
			out.push(Number.parseInt(key.substring(4), 10) & 0xff);
		} else if (idx === -1) {
			if (key.length === 0) throw new Error('Cannot write an entry with an empty name');
			for (let i = 0; i < key.length; i++) {
				let c = key.charCodeAt(i);
				if (c < 64 && i === 0) {
					throw new Error(
						`Cannot write an entry named ${key} — it must start with an ASCII character of value 64 (@) or greater`,
					);
				}
				if (c > 127) {
					throw new Error(`Cannot write an entry named ${key} — it must be ASCII only`);
				}
				if (i === key.length - 1) c |= 0x80;
				out.push(c);
			}
		} else {
			out.push(idx);
		}
		const fullLen = value.length;
		let pos = 0;
		do {
			const len = Math.min(255, fullLen - pos);
			out.push(len);
			for (let i = 0; i < len; i++) out.push(value[pos + i]!);
			pos += len;
		} while (pos < fullLen);
	}
	out.push(0);
	return Uint8Array.from(out);
}

/** Parses the byte stream. Mirrors Java by dropping a leading sign byte first. */
export function deserialize(bytes: Uint8Array): AlfalfaData {
	// Java reads this out of BigInteger.toByteArray(), which prefixes a zero sign byte whenever
	// the top bit of the first real byte is set — and the magic starts 0xEA, so it always is.
	let pos = 1;
	const need = (n: number) => {
		if (pos + n > bytes.length) throw new Error('Truncated Alfalfa data');
	};
	const u8 = () => {
		need(1);
		return bytes[pos++]!;
	};

	try {
		need(4);
		const magic =
			((bytes[pos]! << 24) | (bytes[pos + 1]! << 16) | (bytes[pos + 2]! << 8) | bytes[pos + 3]!) >>> 0;
		pos += 4;
		if (magic !== MAGIC >>> 0) return ALFALFA_NONE;
		const version = u8();
		if (version !== 1) return ALFALFA_NONE;

		const entries = new Map<string, Uint8Array>();
		for (;;) {
			let key: string;
			const first = u8();
			if (first < 64) {
				key = first < PREDEF_KEYS.length ? PREDEF_KEYS[first]! : `!unk${first}`;
			} else {
				let sb = String.fromCharCode(first);
				for (;;) {
					const b = u8();
					if ((b & 0x80) !== 0) {
						sb += String.fromCharCode(b & 0x7f);
						break;
					}
					sb += String.fromCharCode(b);
				}
				key = sb;
			}
			if (key === 'END') break;
			const chunks: number[] = [];
			for (;;) {
				const len = u8();
				need(len);
				for (let i = 0; i < len; i++) chunks.push(bytes[pos + i]!);
				pos += len;
				if (len !== 255) break;
			}
			entries.set(key, Uint8Array.from(chunks));
		}
		return { version, entries };
	} catch {
		return ALFALFA_NONE;
	}
}

/** Reads Alfalfa out of a skin's alpha channel. */
export function read(img: SkinImage): AlfalfaData {
	if (img.width !== 64 || img.height !== 64) return ALFALFA_NONE;
	let bi = 0n;
	let count = 0;
	for (const r of ENCODE_REGIONS) {
		for (let x = r.x1; x < r.x2; x++) {
			for (let y = r.y1; y < r.y2; y++) {
				const a = (img.getARGB(x, y) >>> 24) & 0xff;
				if (a === 0) continue;
				const v = 0x7f - (a & 0x7f);
				bi |= BigInt(v) << BigInt(count * 7);
				count++;
			}
		}
	}
	if (bi === 0n) return ALFALFA_NONE;
	return deserialize(toJavaByteArray(bi));
}

/** Writes Alfalfa into a skin's alpha channel, in place. */
export function write(data: AlfalfaData, img: SkinImage): void {
	const bytes = serialize(data);
	if (bytes.length > CAPACITY_BYTES) {
		// Java's own guard says 1428 here, which is the capacity of the forced-opaque regions
		// rather than of the encode regions — anything between 1373 and 1428 bytes passes that
		// check and then silently loses its tail. Refuse instead.
		throw new Error(
			`Alfalfa payload is ${bytes.length} bytes; only ${CAPACITY_BYTES} fit in the skin`,
		);
	}
	let bi = 0n;
	for (const b of bytes) bi = (bi << 8n) | BigInt(b);

	let written = 0;
	for (const r of ENCODE_REGIONS) {
		for (let x = r.x1; x < r.x2; x++) {
			for (let y = r.y1; y < r.y2; y++) {
				let argb = img.getARGB(x, y);
				if (((argb >>> 24) & 0xff) === 0) argb = 0xff000000;
				const v = Number((bi >> BigInt(written * 7)) & 0x7fn);
				const a = (0x7f - v) | 0x80;
				img.setARGB(x, y, ((argb & 0x00ffffff) | ((a & 0xff) << 24)) >>> 0);
				written++;
			}
		}
	}
}

/** Big-endian two's complement bytes for a positive bigint, the way BigInteger.toByteArray does. */
function toJavaByteArray(bi: bigint): Uint8Array {
	if (bi === 0n) return Uint8Array.from([0]);
	const out: number[] = [];
	let v = bi;
	while (v > 0n) {
		out.unshift(Number(v & 0xffn));
		v >>= 8n;
	}
	if ((out[0]! & 0x80) !== 0) out.unshift(0);
	return Uint8Array.from(out);
}

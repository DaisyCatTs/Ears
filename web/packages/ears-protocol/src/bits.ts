/**
 * MSB-first bit streams, mirroring `common/src/main/java/com/unascribed/ears/common/util/`.
 *
 * Two asymmetries in the Java originals are load-bearing and reproduced exactly:
 *
 * - `writeUnit` **ceils** while `readUnit` plainly divides, so a value only survives a round trip
 *   if it was itself produced by that ceil (chest size 0.5 comes back as 0.516129).
 * - `writeSAMUnit` **truncates** the magnitude, while the sign bit is written first and can be set
 *   on a zero magnitude — which is how a decoded tail bend can be -0.
 *
 * Java does this arithmetic in 32-bit float, so every division and multiplication here is wrapped
 * in Math.fround to land on the same value.
 */

export class BitReader {
	private readonly bytes: Uint8Array;
	private pos = 0;
	private data = 0;
	private index = -1;

	constructor(bytes: Uint8Array) {
		this.bytes = bytes;
	}

	readBit(): number {
		if (this.index < 0) {
			if (this.pos >= this.bytes.length) throw new EOFError();
			this.data = this.bytes[this.pos++]!;
			this.index = 6;
			return (this.data >> 7) & 0x01;
		}
		this.index--;
		return (this.data >> (this.index + 1)) & 0x01;
	}

	readBoolean(): boolean {
		return this.readBit() === 1;
	}

	read(bits: number): number {
		if (bits < 0) throw new Error(`Cannot read negative bits (${bits})`);
		let result = 0;
		for (let i = 0; i < bits; i++) {
			result = (result << 1) | this.readBit();
		}
		return result >>> 0;
	}

	readUnit(bits: number): number {
		const max = (1 << bits) - 1;
		return Math.fround(this.read(bits) / max);
	}

	readSAMUnit(bits: number): number {
		const negative = this.readBoolean();
		const v = this.read(bits);
		const max = (1 << bits) - 1;
		const f = Math.fround(v / max);
		return negative ? -f : f;
	}
}

export class BitWriter {
	private readonly bytes: number[] = [];
	private current = 0;
	private index = 0;

	writeBit(bit: number): void {
		this.current |= (bit & 1) << (7 - this.index);
		this.index++;
		if (this.index === 8) {
			this.bytes.push(this.current);
			this.current = 0;
			this.index = 0;
		}
	}

	writeBoolean(value: boolean): void {
		this.writeBit(value ? 1 : 0);
	}

	write(bits: number, value: number): void {
		for (let i = bits - 1; i >= 0; i--) {
			this.writeBit((value >> i) & 1);
		}
	}

	writeUnit(bits: number, value: number): void {
		const max = (1 << bits) - 1;
		this.write(bits, Math.ceil(Math.fround(value * max)));
	}

	writeSAMUnit(bits: number, value: number): void {
		const max = (1 << bits) - 1;
		this.writeBoolean(value < 0);
		this.write(bits, Math.trunc(Math.fround(Math.abs(value) * max)));
	}

	/** Pads with zero bits to the next byte boundary and returns the result. */
	finish(): Uint8Array {
		if (this.index > 0) {
			this.bytes.push(this.current);
			this.current = 0;
			this.index = 0;
		}
		return Uint8Array.from(this.bytes);
	}
}

export class EOFError extends Error {
	constructor() {
		super('Unexpected end of bit stream');
		this.name = 'EOFError';
	}
}

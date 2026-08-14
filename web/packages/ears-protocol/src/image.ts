/**
 * An RGBA8 image with the same ARGB-int accessors Ears' Java code uses, so the ported algorithms
 * can be read side by side with the originals.
 *
 * ARGB values are plain JS numbers in the range 0..0xFFFFFFFF (never negative), unlike Java's
 * signed ints — every comparison in the protocol masks off the channels it cares about, so the
 * difference does not leak.
 */
export class SkinImage {
	readonly width: number;
	readonly height: number;
	/** RGBA, 4 bytes per pixel, row-major. */
	readonly data: Uint8Array;

	constructor(width: number, height: number, data?: Uint8Array) {
		this.width = width;
		this.height = height;
		this.data = data ?? new Uint8Array(width * height * 4);
		if (this.data.length !== width * height * 4) {
			throw new Error(
				`Expected ${width * height * 4} bytes for a ${width}x${height} RGBA image, got ${this.data.length}`,
			);
		}
	}

	getARGB(x: number, y: number): number {
		const i = (y * this.width + x) * 4;
		const d = this.data;
		return (
			((d[i + 3]! << 24) >>> 0) + ((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!)
		);
	}

	setARGB(x: number, y: number, argb: number): void {
		const i = (y * this.width + x) * 4;
		const d = this.data;
		d[i] = (argb >>> 16) & 0xff;
		d[i + 1] = (argb >>> 8) & 0xff;
		d[i + 2] = argb & 0xff;
		d[i + 3] = (argb >>> 24) & 0xff;
	}

	clone(): SkinImage {
		return new SkinImage(this.width, this.height, new Uint8Array(this.data));
	}
}

import { TEX_SOURCES, TRANSPOSES, type TexFlip, type TexRotation, type TexSource } from './delegate.js';

/**
 * The UVs for a quad, ported from `EarsCommon.calculateUVs`.
 *
 * Returns four [u, v] pairs. `pinch` pulls the UVs inward to avoid bleeding between neighbouring
 * regions of the skin.
 */
export function calculateUVs(
	u: number,
	v: number,
	w: number,
	h: number,
	rot: TexRotation,
	flip: TexFlip,
	src: TexSource,
	pinch = 0,
): [number, number][] {
	const tw = TEX_SOURCES[src].width;
	const th = TEX_SOURCES[src].height;
	const transpose = TRANSPOSES[rot];

	let minU = u / tw + pinch;
	let minV = v / th + pinch;
	let maxU = (u + (transpose ? h : w)) / tw - pinch;
	let maxV = (v + (transpose ? w : h)) / th - pinch;

	let f = flip;
	if (transpose) {
		if (f === 'HORIZONTAL') f = 'VERTICAL';
		else if (f === 'VERTICAL') f = 'HORIZONTAL';
	}

	if (f === 'HORIZONTAL' || f === 'BOTH') {
		const swap = maxU;
		maxU = minU;
		minU = swap;
	}
	if (f === 'VERTICAL' || f === 'BOTH') {
		const swap = maxV;
		maxV = minV;
		minV = swap;
	}

	let uv: [number, number][] = [
		[minU, maxV],
		[maxU, maxV],
		[maxU, minV],
		[minU, minV],
	];

	if (rot === 'CW') {
		uv = [uv[3]!, uv[0]!, uv[1]!, uv[2]!];
	} else if (rot === 'CCW') {
		uv = [uv[1]!, uv[2]!, uv[3]!, uv[0]!];
	} else if (rot === 'UPSIDE_DOWN') {
		uv = [uv[2]!, uv[3]!, uv[0]!, uv[1]!];
	}
	return uv;
}

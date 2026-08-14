/**
 * The Ears feature model.
 *
 * Enum values are the **ordinals used on the wire** — the v1 encoding writes
 * `earMode.ordinal()` and friends directly — so these arrays must stay in this exact order. They
 * mirror `EarsFeatures` in `common/src/api/java/com/unascribed/ears/api/features/EarsFeatures.java`.
 */

export const EAR_MODES = [
	'NONE',
	'ABOVE',
	'SIDES',
	'BEHIND',
	'AROUND',
	'FLOPPY',
	'CROSS',
	'OUT',
	'TALL',
	'TALL_CROSS',
] as const;
export type EarMode = (typeof EAR_MODES)[number];

export const EAR_ANCHORS = ['CENTER', 'FRONT', 'BACK'] as const;
export type EarAnchor = (typeof EAR_ANCHORS)[number];

export const TAIL_MODES = [
	'NONE',
	'DOWN',
	'BACK',
	'UP',
	'VERTICAL',
	'CROSS',
	'CROSS_OVERLAP',
	'STAR',
	/**
	 * Ordinal 8, which does not fit in v1's 3-bit tail field. Only v0 can carry this mode; the
	 * encoder falls back to v0 when it sees it.
	 */
	'STAR_OVERLAP',
] as const;
export type TailMode = (typeof TAIL_MODES)[number];

export const WING_MODES = [
	'NONE',
	'SYMMETRIC_DUAL',
	'SYMMETRIC_SINGLE',
	'ASYMMETRIC_L',
	'ASYMMETRIC_R',
	'ASYMMETRIC_DUAL',
	'FLAT',
] as const;
export type WingMode = (typeof WING_MODES)[number];

export interface EarsFeatures {
	enabled: boolean;
	earMode: EarMode;
	/**
	 * v0 leaves this unset when the mode is NONE or BEHIND, in which case it is null. v1 never
	 * produces null — it always writes an anchor alongside a mode.
	 */
	earAnchor: EarAnchor | null;
	claws: boolean;
	horn: boolean;
	tailMode: TailMode;
	tailSegments: number;
	tailBend0: number;
	tailBend1: number;
	tailBend2: number;
	tailBend3: number;
	snoutOffset: number;
	snoutWidth: number;
	snoutHeight: number;
	snoutDepth: number;
	chestSize: number;
	wingMode: WingMode;
	animateWings: boolean;
	capeEnabled: boolean;
	emissive: boolean;
	/** PNG bytes of the extracted emissive layer, or null when there is none. */
	emissiveSkin: Uint8Array | null;
	emissiveWing: Uint8Array | null;
	alfalfa: AlfalfaData;
}

export interface AlfalfaData {
	version: number;
	entries: Map<string, Uint8Array>;
}

export const ALFALFA_NONE: AlfalfaData = { version: 0, entries: new Map() };

/** Matches `EarsFeatures.DISABLED`. */
export function disabledFeatures(): EarsFeatures {
	return {
		enabled: false,
		earMode: 'NONE',
		earAnchor: 'CENTER',
		claws: false,
		horn: false,
		tailMode: 'NONE',
		tailSegments: 0,
		tailBend0: 0,
		tailBend1: 0,
		tailBend2: 0,
		tailBend3: 0,
		snoutOffset: 0,
		snoutWidth: 0,
		snoutHeight: 0,
		snoutDepth: 0,
		chestSize: 0,
		wingMode: 'NONE',
		animateWings: true,
		capeEnabled: false,
		emissive: false,
		emissiveSkin: null,
		emissiveWing: null,
		alfalfa: ALFALFA_NONE,
	};
}

export function ordinalOr<T extends readonly string[]>(
	values: T,
	ordinal: number,
	fallback: T[number],
): T[number] {
	if (ordinal < 0 || ordinal >= values.length) return fallback;
	return values[ordinal] as T[number];
}

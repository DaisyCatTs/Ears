/**
 * The abstract rendering platform, ported from
 * `common/src/main/java/com/unascribed/ears/common/render/EarsRenderDelegate.java`.
 *
 * The renderer never touches a graphics API directly: it walks a transform stack and emits quads
 * through this interface, and each consumer (a Minecraft port, or three.js here) adapts that to
 * whatever it draws with. Keeping that split is what lets the web preview be checked against the
 * game's own output rather than eyeballed.
 */

export const BODY_PARTS = ['HEAD', 'TORSO', 'LEFT_ARM', 'RIGHT_ARM', 'LEFT_LEG', 'RIGHT_LEG'] as const;
export type BodyPart = (typeof BODY_PARTS)[number];

const BODY_PART_SIZES: Record<BodyPart, [number, number, number]> = {
	HEAD: [8, 8, 8],
	TORSO: [8, 12, 4],
	LEFT_ARM: [4, 12, 4],
	RIGHT_ARM: [4, 12, 4],
	LEFT_LEG: [4, 12, 4],
	RIGHT_LEG: [4, 12, 4],
};

export function bodyPartSize(part: BodyPart, slim: boolean): [number, number, number] {
	const [x, y, z] = BODY_PART_SIZES[part];
	if (slim && (part === 'LEFT_ARM' || part === 'RIGHT_ARM')) return [3, y, z];
	return [x, y, z];
}

export type TexSource =
	| 'SKIN'
	| 'WING'
	| 'CAPE'
	| 'EMISSIVE_SKIN'
	| 'EMISSIVE_WING'
	| 'HELMET'
	| 'CHESTPLATE'
	| 'LEGGINGS'
	| 'BOOTS'
	| 'GLINT_HELMET'
	| 'GLINT_CHESTPLATE'
	| 'GLINT_LEGGINGS'
	| 'GLINT_BOOTS';

export interface TexSourceDef {
	width: number;
	height: number;
	builtin: boolean;
	glint: boolean;
	parent: TexSource | null;
}

export const TEX_SOURCES: Record<TexSource, TexSourceDef> = {
	SKIN: { width: 64, height: 64, builtin: true, glint: false, parent: null },

	WING: { width: 20, height: 16, builtin: false, glint: false, parent: null },
	CAPE: { width: 20, height: 16, builtin: false, glint: false, parent: null },
	EMISSIVE_SKIN: { width: 64, height: 64, builtin: false, glint: false, parent: null },
	EMISSIVE_WING: { width: 20, height: 16, builtin: false, glint: false, parent: null },

	HELMET: { width: 64, height: 32, builtin: true, glint: false, parent: null },
	CHESTPLATE: { width: 64, height: 32, builtin: true, glint: false, parent: null },
	LEGGINGS: { width: 64, height: 32, builtin: true, glint: false, parent: null },
	BOOTS: { width: 64, height: 32, builtin: true, glint: false, parent: null },

	GLINT_HELMET: { width: 64, height: 32, builtin: true, glint: true, parent: 'HELMET' },
	GLINT_CHESTPLATE: { width: 64, height: 32, builtin: true, glint: true, parent: 'CHESTPLATE' },
	GLINT_LEGGINGS: { width: 64, height: 32, builtin: true, glint: true, parent: 'LEGGINGS' },
	GLINT_BOOTS: { width: 64, height: 32, builtin: true, glint: true, parent: 'BOOTS' },
};

export type TexRotation = 'NONE' | 'CW' | 'CCW' | 'UPSIDE_DOWN';
export type TexFlip = 'NONE' | 'HORIZONTAL' | 'VERTICAL' | 'BOTH';

export const TRANSPOSES: Record<TexRotation, boolean> = {
	NONE: false,
	CW: true,
	CCW: true,
	UPSIDE_DOWN: false,
};

export type QuadGrow = 'NONE' | 'HALFPIXEL' | 'QUARTERPIXEL' | 'FULLPIXEL';

export const GROW_AMOUNTS: Record<QuadGrow, number> = {
	NONE: 0,
	/** Matches the secondary head layer and the "leggings" armor layer. */
	HALFPIXEL: 0.5,
	/** Matches secondary layers. */
	QUARTERPIXEL: 0.25,
	/** Matches "body" armor layers. */
	FULLPIXEL: 1,
};

export type StateType =
	| 'CREATIVE_FLYING'
	| 'GLIDING'
	| 'WEARING_BOOTS'
	| 'WEARING_CHESTPLATE'
	| 'WEARING_ELYTRA'
	| 'WEARING_HELMET'
	| 'WEARING_LEGGINGS';

export interface EarsRenderDelegate {
	setUp(): void;
	tearDown(): void;

	push(): void;
	pop(): void;

	anchorTo(part: BodyPart): void;
	bind(tex: TexSource): void;
	canBind(tex: TexSource): boolean;

	translate(x: number, y: number, z: number): void;
	rotate(ang: number, x: number, y: number, z: number): void;
	scale(x: number, y: number, z: number): void;

	renderFront(u: number, v: number, w: number, h: number, rot: TexRotation, flip: TexFlip, grow: QuadGrow): void;
	renderBack(u: number, v: number, w: number, h: number, rot: TexRotation, flip: TexFlip, grow: QuadGrow): void;
	renderDoubleSided(u: number, v: number, w: number, h: number, rot: TexRotation, flip: TexFlip, grow: QuadGrow): void;

	renderDebugDot(r: number, g: number, b: number, a: number): void;

	getTime(): number;
	getLimbSwing(): number;
	getHorizontalSpeed(): number;
	getStride(): number;
	getBodyYaw(): number;

	getX(): number;
	getY(): number;
	getZ(): number;
	getCapeX(): number;
	getCapeY(): number;
	getCapeZ(): number;

	isSlim(): boolean;
	isFlying(): boolean;
	isGliding(): boolean;
	isWearingElytra(): boolean;
	isWearingChestplate(): boolean;
	isWearingBoots(): boolean;
	isJacketEnabled(): boolean;
	needsSecondaryLayersDrawn(): boolean;

	setEmissive(emissive: boolean): void;

	/** Only implemented by delegates that buffer, to work around transparency sorting. */
	beginTranslucent?(): void;
}

/**
 * A delegate that isn't running inside a copy of Minecraft, so every piece of game state takes its
 * default. Ported from `AbstractDetachedEarsRenderDelegate`.
 */
export abstract class DetachedEarsRenderDelegate implements EarsRenderDelegate {
	abstract push(): void;
	abstract pop(): void;
	abstract anchorTo(part: BodyPart): void;
	abstract bind(tex: TexSource): void;
	abstract translate(x: number, y: number, z: number): void;
	abstract rotate(ang: number, x: number, y: number, z: number): void;
	abstract scale(x: number, y: number, z: number): void;
	abstract renderFront(u: number, v: number, w: number, h: number, rot: TexRotation, flip: TexFlip, grow: QuadGrow): void;
	abstract renderBack(u: number, v: number, w: number, h: number, rot: TexRotation, flip: TexFlip, grow: QuadGrow): void;
	abstract renderDoubleSided(u: number, v: number, w: number, h: number, rot: TexRotation, flip: TexFlip, grow: QuadGrow): void;
	abstract renderDebugDot(r: number, g: number, b: number, a: number): void;
	abstract isSlim(): boolean;
	abstract isJacketEnabled(): boolean;
	abstract setEmissive(emissive: boolean): void;

	setUp(): void {}
	tearDown(): void {}

	canBind(tex: TexSource): boolean {
		return tex === 'SKIN' || !TEX_SOURCES[tex].builtin;
	}

	getTime(): number {
		return 0;
	}
	getLimbSwing(): number {
		return 0;
	}
	getHorizontalSpeed(): number {
		return 0;
	}
	getStride(): number {
		return 0;
	}
	getBodyYaw(): number {
		return 0;
	}
	getX(): number {
		return 0;
	}
	getY(): number {
		return 0;
	}
	getZ(): number {
		return 0;
	}
	getCapeX(): number {
		return 0;
	}
	getCapeY(): number {
		return 0;
	}
	getCapeZ(): number {
		return 0;
	}
	isFlying(): boolean {
		return false;
	}
	isGliding(): boolean {
		return false;
	}
	isWearingElytra(): boolean {
		return false;
	}
	isWearingChestplate(): boolean {
		return false;
	}
	isWearingBoots(): boolean {
		return false;
	}
	needsSecondaryLayersDrawn(): boolean {
		return false;
	}
}

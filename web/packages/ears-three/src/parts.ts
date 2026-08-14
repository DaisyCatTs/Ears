/**
 * The vanilla player model, in the same coordinate space the Ears renderer anchors to.
 *
 * Sizes and UV origins are Minecraft's. The small arm rotations and the head yaw are *preview pose*
 * rather than anything Ears defines — they match what the old manipulator displayed, so the new
 * preview reads the same way at a glance.
 */

export interface PartDef {
	name: string;
	/** Centre position in model units. */
	pos: [number, number, number];
	/** Width, height, depth. */
	size: [number, number, number];
	/** Top-left of this part's region in the 64x64 skin. */
	uv: [number, number];
	/** The second-layer ("overlay") UV origin, if this part has one. */
	overlayUv?: [number, number];
	/** How far the overlay is inflated. Vanilla uses half a pixel for the hat, a quarter elsewhere. */
	overlayGrow?: number;
	rot?: [number, number, number];
	/** Slim-arm variants override position and width. */
	slim?: { pos: [number, number, number]; size: [number, number, number] };
}

export const PARTS: PartDef[] = [
	{
		name: 'head',
		pos: [0, 10, 0],
		size: [8, 8, 8],
		uv: [0, 0],
		overlayUv: [32, 0],
		overlayGrow: 0.5,
		rot: [0, 20, 0],
	},
	{ name: 'torso', pos: [0, 0, 0], size: [8, 12, 4], uv: [16, 16], overlayUv: [16, 32], overlayGrow: 0.25 },
	{
		name: 'right_arm',
		pos: [-6, 0, 1],
		size: [4, 12, 4],
		uv: [40, 16],
		overlayUv: [40, 32],
		overlayGrow: 0.25,
		rot: [-10, 0, 0],
		slim: { pos: [-5.5, 0, 1], size: [3, 12, 4] },
	},
	{
		name: 'left_arm',
		pos: [6, 0, -1],
		size: [4, 12, 4],
		uv: [32, 48],
		overlayUv: [48, 48],
		overlayGrow: 0.25,
		rot: [10, 0, 0],
		slim: { pos: [5.5, 0, -1], size: [3, 12, 4] },
	},
	{ name: 'right_leg', pos: [-2, -12, 0], size: [4, 12, 4], uv: [0, 16], overlayUv: [0, 32], overlayGrow: 0.25 },
	{ name: 'left_leg', pos: [2, -12, 0], size: [4, 12, 4], uv: [16, 48], overlayUv: [0, 48], overlayGrow: 0.25 },
];

/** Maps the renderer's anchor names onto the parts above. */
export const ANCHOR_TO_PART: Record<string, string> = {
	head: 'head',
	torso: 'torso',
	left_arm: 'left_arm',
	right_arm: 'right_arm',
	left_leg: 'left_leg',
	right_leg: 'right_leg',
};

export function partFor(name: string, slim: boolean): PartDef & { size: [number, number, number]; pos: [number, number, number] } {
	const def = PARTS.find((p) => p.name === name);
	if (!def) throw new Error(`Unknown body part ${name}`);
	if (slim && def.slim) return { ...def, pos: def.slim.pos, size: def.slim.size };
	return def as PartDef & { size: [number, number, number]; pos: [number, number, number] };
}

import type { Move, RenderObject } from '@ears/renderer';
import * as THREE from 'three';

import { ANCHOR_TO_PART, partFor } from './parts.js';

/**
 * Turns the renderer's display list into three.js geometry.
 *
 * The transform semantics come from the old manipulator's `rebuildGeom` — Minecraft's coordinate
 * space is left-handed relative to three.js, so the base matrix flips Z, Y translations are
 * negated, and rotation axes come through as (-x, y, -z).
 *
 * Note what is and isn't verified: the *display list* is diffed against Java quad-for-quad by the
 * renderer package's tests. This file is the presentation layer on top of it and has no golden
 * data behind it — if the preview looks wrong but the display list matches, look here first.
 */

export interface BuildOptions {
	slim: boolean;
	textures: Record<string, THREE.Texture | null>;
	emissiveTextures?: Record<string, THREE.Texture | null>;
}

function anchorMatrix(part: string, slim: boolean): THREE.Matrix4 {
	const def = partFor(ANCHOR_TO_PART[part] ?? part, slim);
	const m = new THREE.Matrix4();
	m.makeTranslation(def.pos[0], def.pos[1], def.pos[2]);
	// rotations are applied in reverse order and negated, matching how the model is posed
	const rot = def.rot ?? [0, 0, 0];
	if (rot[2]) m.multiply(new THREE.Matrix4().makeRotationZ(THREE.MathUtils.degToRad(-rot[2])));
	if (rot[1]) m.multiply(new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(-rot[1])));
	if (rot[0]) m.multiply(new THREE.Matrix4().makeRotationX(THREE.MathUtils.degToRad(-rot[0])));
	// then to the part's own corner, which is where the renderer's coordinates start. Y is minus
	// half the height, not plus: the renderer's part-local Y points down, and its origin is the
	// bottom of the part — get this backwards and everything anchored to the head floats above it.
	m.multiply(
		new THREE.Matrix4().makeTranslation(-def.size[0] / 2, -def.size[1] / 2, -def.size[2] / 2),
	);
	return m;
}

function applyMoves(moves: Move[], slim: boolean): THREE.Matrix4 {
	// Minecraft's Z runs the other way from three's
	const mat = new THREE.Matrix4().makeScale(1, 1, -1);
	for (const move of moves) {
		switch (move.type) {
			case 'anchor':
				mat.multiply(anchorMatrix(move.part, slim));
				break;
			case 'translate':
				mat.multiply(new THREE.Matrix4().makeTranslation(move.x, -move.y, move.z));
				break;
			case 'scale':
				mat.multiply(new THREE.Matrix4().makeScale(move.x, move.y, move.z));
				break;
			case 'rotate': {
				const axis = new THREE.Vector3(-move.x, move.y, -move.z).normalize();
				mat.multiply(new THREE.Matrix4().makeRotationAxis(axis, THREE.MathUtils.degToRad(move.ang)));
				break;
			}
		}
	}
	return mat;
}

/** Builds one group holding every quad in the display list. */
export function buildDisplayList(objects: RenderObject[], opts: BuildOptions): THREE.Group {
	const group = new THREE.Group();
	group.name = 'ears';

	for (const obj of objects) {
		if (obj.type !== 'quad') continue;
		const texture = obj.emissive
			? (opts.emissiveTextures?.[obj.texture] ?? opts.textures[obj.texture] ?? null)
			: (opts.textures[obj.texture] ?? null);
		if (!texture) continue;

		const geom = new THREE.PlaneGeometry(obj.width, obj.height);

		// the display list gives UVs per corner; three's plane winds them differently
		const uv = geom.getAttribute('uv') as THREE.BufferAttribute;
		const [a, b, c, d] = obj.uvs as [number, number][] &
			[[number, number], [number, number], [number, number], [number, number]];
		// plane vertex order is top-left, top-right, bottom-left, bottom-right
		uv.setXY(0, d[0], 1 - d[1]);
		uv.setXY(1, c[0], 1 - c[1]);
		uv.setXY(2, a[0], 1 - a[1]);
		uv.setXY(3, b[0], 1 - b[1]);
		uv.needsUpdate = true;

		geom.translate(obj.width / 2, -obj.height / 2, 0);
		geom.applyMatrix4(applyMoves(obj.moves, opts.slim));
		geom.computeVertexNormals();

		// Emissive means "drawn at full light", which is an unlit material — shading it like the
		// rest washes the whole model out. It also lands on exactly the same plane as the base
		// quad, so it needs a depth bias or the two fight for the same pixels; this is the same
		// bug as upstream issue #235, solved here with polygonOffset rather than by moving
		// geometry around.
		const material = obj.emissive
			? new THREE.MeshBasicMaterial({
					map: texture,
					side: obj.back ? THREE.BackSide : THREE.FrontSide,
					transparent: true,
					alphaTest: 0.01,
					fog: false,
					polygonOffset: true,
					polygonOffsetFactor: -1,
					polygonOffsetUnits: -1,
				})
			: new THREE.MeshLambertMaterial({
					map: texture,
					side: obj.back ? THREE.BackSide : THREE.FrontSide,
					transparent: true,
					alphaTest: 0.01,
					flatShading: true,
					fog: false,
				});

		const mesh = new THREE.Mesh(geom, material);
		mesh.name = `${obj.texture}${obj.back ? ':back' : ''}`;
		group.add(mesh);
	}

	return group;
}

/** Frees everything a previously built group allocated on the GPU. */
export function disposeGroup(group: THREE.Object3D): void {
	group.traverse((child) => {
		const mesh = child as THREE.Mesh;
		if (mesh.geometry) mesh.geometry.dispose();
		const mat = mesh.material;
		if (Array.isArray(mat)) {
			for (const m of mat) m.dispose();
		} else if (mat) {
			mat.dispose();
		}
	});
}

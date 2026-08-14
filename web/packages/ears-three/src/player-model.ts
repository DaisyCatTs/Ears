import * as THREE from 'three';

import { PARTS, partFor } from './parts.js';

/**
 * The vanilla player model — the thing the Ears geometry hangs off.
 *
 * Face UVs follow Minecraft's box unwrap (right, left, top, bottom, front, back), which is the
 * order three's BoxGeometry happens to build its faces in.
 */

function boxUVs(
	geom: THREE.BoxGeometry,
	u: number,
	v: number,
	w: number,
	h: number,
	d: number,
): void {
	const uv = geom.getAttribute('uv') as THREE.BufferAttribute;
	const tw = 64;
	const th = 64;

	// [x, y, width, height] of each face in the skin, in Minecraft's unwrap order
	const faces: [number, number, number, number][] = [
		[u, v + d, d, h], // right (+x)
		[u + d + w, v + d, d, h], // left (-x)
		[u + d, v, w, d], // top
		[u + d + w, v, w, d], // bottom
		[u + d, v + d, w, h], // front
		[u + d + w + d, v + d, w, h], // back
	];

	faces.forEach(([fx, fy, fw, fh], i) => {
		const minU = fx / tw;
		const maxU = (fx + fw) / tw;
		const minV = 1 - fy / th;
		const maxV = 1 - (fy + fh) / th;
		const o = i * 4;
		// bottom faces are mirrored vertically in the vanilla unwrap
		const flipV = i === 3;
		const top = flipV ? maxV : minV;
		const bottom = flipV ? minV : maxV;
		uv.setXY(o + 0, minU, top);
		uv.setXY(o + 1, maxU, top);
		uv.setXY(o + 2, minU, bottom);
		uv.setXY(o + 3, maxU, bottom);
	});
	uv.needsUpdate = true;
}

export interface PlayerModelOptions {
	slim: boolean;
	texture: THREE.Texture;
	/** Which second-layer parts to show, by part name. */
	overlays: Record<string, boolean>;
}

export function buildPlayerModel(opts: PlayerModelOptions): THREE.Group {
	const group = new THREE.Group();
	group.name = 'player';

	for (const base of PARTS) {
		const def = partFor(base.name, opts.slim);
		const [w, h, d] = def.size;

		const geom = new THREE.BoxGeometry(w, h, d);
		boxUVs(geom, def.uv[0], def.uv[1], w, h, d);
		const mesh = new THREE.Mesh(
			geom,
			new THREE.MeshLambertMaterial({ map: opts.texture, flatShading: true, fog: false }),
		);
		mesh.name = def.name;
		mesh.position.set(def.pos[0], def.pos[1], def.pos[2]);
		if (def.rot) {
			mesh.rotation.set(
				THREE.MathUtils.degToRad(def.rot[0]),
				THREE.MathUtils.degToRad(def.rot[1]),
				THREE.MathUtils.degToRad(def.rot[2]),
			);
		}
		group.add(mesh);

		if (def.overlayUv && opts.overlays[def.name] !== false) {
			const grow = def.overlayGrow ?? 0.25;
			const og = new THREE.BoxGeometry(w + grow * 2, h + grow * 2, d + grow * 2);
			boxUVs(og, def.overlayUv[0], def.overlayUv[1], w, h, d);
			const overlay = new THREE.Mesh(
				og,
				new THREE.MeshLambertMaterial({
					map: opts.texture,
					transparent: true,
					alphaTest: 0.1,
					side: THREE.DoubleSide,
					flatShading: true,
					fog: false,
				}),
			);
			overlay.name = `${def.name}2`;
			overlay.position.copy(mesh.position);
			overlay.rotation.copy(mesh.rotation);
			overlay.renderOrder = 1;
			group.add(overlay);
		}
	}

	return group;
}

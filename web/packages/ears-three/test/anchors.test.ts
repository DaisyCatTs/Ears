import { CaptureDelegate } from '@ears/renderer';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { buildDisplayList } from '../src/display-list.js';
import { partFor } from '../src/parts.js';

/**
 * Pins down where anchored geometry actually lands.
 *
 * The display list itself is verified against Java by @ears/renderer; what is *not* covered there
 * is this package's job of turning it into world-space meshes. Getting the part-origin offset
 * backwards put everything anchored to the head a full head-height too high, and it looked
 * plausible enough in a screenshot to survive a review — hence these.
 */

function whiteTexture(): THREE.Texture {
	const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
	tex.needsUpdate = true;
	return tex;
}

/** Renders one quad through the capture delegate and returns its bounding box. */
function boxFor(build: (d: CaptureDelegate) => void): THREE.Box3 {
	const capture = new CaptureDelegate(false, false);
	build(capture);
	const group = buildDisplayList(capture.objects, {
		slim: false,
		textures: { skin: whiteTexture() },
	});
	const box = new THREE.Box3();
	box.setFromObject(group);
	return box;
}

describe('anchoring', () => {
	it('puts a head-anchored quad at the top of the head, not above it', () => {
		// the renderer's part origin is the bottom corner, with local +Y pointing down
		const box = boxFor((d) => {
			d.anchorTo('HEAD');
			d.renderFront(0, 0, 8, 8, 'NONE', 'NONE', 'NONE');
		});
		const head = partFor('head', false);
		const headBottom = head.pos[1] - head.size[1] / 2;
		expect(box.max.y).toBeCloseTo(headBottom, 4);
		expect(box.min.y).toBeCloseTo(headBottom - 8, 4);
	});

	it('translating up by 16 lifts a quad clear of the head', () => {
		// this is what every "ears above the head" mode does
		const box = boxFor((d) => {
			d.anchorTo('HEAD');
			d.translate(-4, -16, 0);
			d.renderFront(24, 0, 16, 8, 'NONE', 'NONE', 'NONE');
		});
		const head = partFor('head', false);
		const headTop = head.pos[1] + head.size[1] / 2;
		// the quad's bottom edge should meet the top of the head exactly
		expect(box.min.y).toBeCloseTo(headTop, 4);
		expect(box.max.y).toBeCloseTo(headTop + 8, 4);
		// X and Z are not asserted here: the head carries a 20 degree yaw as part of the preview
		// pose, so an anchored quad is rotated with it. The torso tests below cover those axes.
	});

	it('places a torso-anchored quad at the torso corner', () => {
		const box = boxFor((d) => {
			d.anchorTo('TORSO');
			d.renderFront(0, 0, 8, 12, 'NONE', 'NONE', 'NONE');
		});
		// the torso has no pose rotation, so the corner offset is directly visible
		expect(box.min.x).toBeCloseTo(-4, 4);
		expect(box.max.x).toBeCloseTo(4, 4);
	});

	it('anchors the torso where the torso is', () => {
		const box = boxFor((d) => {
			d.anchorTo('TORSO');
			d.renderFront(0, 0, 8, 12, 'NONE', 'NONE', 'NONE');
		});
		const torso = partFor('torso', false);
		expect(box.max.y).toBeCloseTo(torso.pos[1] - torso.size[1] / 2, 4);
	});

	it('narrows the arm anchor for slim models', () => {
		const classic = partFor('left_arm', false);
		const slim = partFor('left_arm', true);
		expect(classic.size[0]).toBe(4);
		expect(slim.size[0]).toBe(3);
		expect(slim.pos[0]).not.toBe(classic.pos[0]);
	});

	it('flips Z, because Minecraft and three disagree about handedness', () => {
		const near = boxFor((d) => {
			d.anchorTo('TORSO');
			d.renderFront(0, 0, 8, 12, 'NONE', 'NONE', 'NONE');
		});
		const far = boxFor((d) => {
			d.anchorTo('TORSO');
			d.translate(0, 0, 8);
			d.renderFront(0, 0, 8, 12, 'NONE', 'NONE', 'NONE');
		});
		// +Z in the renderer moves away from the viewer, which is -Z here
		expect(far.min.z).toBeCloseTo(near.min.z - 8, 4);
	});
});

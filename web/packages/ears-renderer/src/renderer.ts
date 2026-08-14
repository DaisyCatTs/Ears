import type { EarsFeatures } from '@ears/protocol';

import type { EarsRenderDelegate, StateType } from './delegate.js';

/**
 * The Ears renderer, ported from `common/src/main/java/com/unascribed/ears/common/EarsRenderer.java`.
 *
 * This is a deliberately literal port: same order, same magic numbers, same push/pop nesting. It is
 * verified by diffing the emitted display list against one captured from the Java renderer for
 * every fixture (see `test/display-list.test.ts`), so drift shows up as a numeric difference rather
 * than as a subtly wrong preview.
 *
 * **Feature geometry changes belong in `common`, not here** — this must keep matching the game.
 */

type FeatureType =
	| 'EARS'
	| 'TAIL'
	| 'CLAW_LEFT_LEG'
	| 'CLAW_RIGHT_LEG'
	| 'CLAW_LEFT_ARM'
	| 'CLAW_RIGHT_ARM'
	| 'HORN'
	| 'SNOUT'
	| 'CHEST'
	| 'WINGS'
	| 'CAPE';

/**
 * Java consults `EarsInhibitorRegistry`, which other mods populate to suppress features. Nothing
 * populates it here, so nothing is ever inhibited — kept as a seam rather than inlined away.
 */
function isInhibited(_delegate: EarsRenderDelegate, _feature: FeatureType): boolean {
	return false;
}

function isActive(delegate: EarsRenderDelegate, state: StateType): boolean {
	switch (state) {
		case 'CREATIVE_FLYING':
			return delegate.isFlying();
		case 'GLIDING':
			return delegate.isGliding();
		case 'WEARING_BOOTS':
			return delegate.isWearingBoots();
		case 'WEARING_CHESTPLATE':
			return delegate.isWearingChestplate();
		case 'WEARING_ELYTRA':
			return delegate.isWearingElytra();
		default:
			return false;
	}
}

function clamp(v: number, min: number, max: number): number {
	return Math.max(Math.min(v, max), min);
}

export function render(features: EarsFeatures | null, delegate: EarsRenderDelegate): void {
	if ((features !== null && features.enabled) || delegate.needsSecondaryLayersDrawn()) {
		// the 1.15+ rendering pipeline introduces nasty transparency sort bugs due to the buffering
		// it does; render in multiple passes to avoid it (third is armor, fourth is armor glint)
		delegate.setUp();
		for (let p = 0; p < 4; p++) {
			renderInner(features, delegate, p, false);
			if (features !== null && features.emissive && p < 2) {
				delegate.setEmissive(true);
				renderInner(features, delegate, p, true);
				delegate.setEmissive(false);
			}
		}
		delegate.bind('SKIN');
		delegate.tearDown();
	}
}

function renderInner(
	features: EarsFeatures | null,
	delegate: EarsRenderDelegate,
	p: number,
	drawingEmissive: boolean,
): void {
	const slim = delegate.isSlim();
	const swingAmount = delegate.getLimbSwing();
	delegate.bind(drawingEmissive ? 'EMISSIVE_SKIN' : 'SKIN');
	if (drawingEmissive) {
		delegate.push();
		delegate.anchorTo('HEAD');
		drawVanillaCuboid(delegate, 0, 0, 8, 8, 8, 0);
		delegate.pop();
		delegate.push();
		delegate.anchorTo('TORSO');
		drawVanillaCuboid(delegate, 16, 16, 8, 12, 4, 0);
		delegate.pop();
		delegate.push();
		delegate.anchorTo('LEFT_ARM');
		drawVanillaCuboid(delegate, 32, 48, slim ? 3 : 4, 12, 4, 0);
		delegate.pop();
		delegate.push();
		delegate.anchorTo('RIGHT_ARM');
		drawVanillaCuboid(delegate, 40, 16, slim ? 3 : 4, 12, 4, 0);
		delegate.pop();
		delegate.push();
		delegate.anchorTo('LEFT_LEG');
		drawVanillaCuboid(delegate, 16, 48, 4, 12, 4, 0);
		delegate.pop();
		delegate.push();
		delegate.anchorTo('RIGHT_LEG');
		drawVanillaCuboid(delegate, 0, 16, 4, 12, 4, 0);
		delegate.pop();
	}
	if (delegate.needsSecondaryLayersDrawn() || drawingEmissive) {
		if (drawingEmissive) {
			delegate.push();
			delegate.anchorTo('HEAD');
			delegate.translate(0, 1, 0);
			drawVanillaCuboid(delegate, 32, 0, 8, 8, 8, 0.5);
			delegate.pop();
		}
		delegate.push();
		delegate.anchorTo('TORSO');
		delegate.translate(0, 0.5, 0);
		drawVanillaCuboid(delegate, 16, 32, 8, 12, 4, 0.25);
		delegate.pop();
		delegate.push();
		delegate.anchorTo('LEFT_ARM');
		delegate.translate(0, 0.5, 0);
		drawVanillaCuboid(delegate, 48, 48, slim ? 3 : 4, 12, 4, 0.25);
		delegate.pop();
		delegate.push();
		delegate.anchorTo('RIGHT_ARM');
		delegate.translate(0, 0.5, 0);
		drawVanillaCuboid(delegate, 40, 32, slim ? 3 : 4, 12, 4, 0.25);
		delegate.pop();
		delegate.push();
		delegate.anchorTo('LEFT_LEG');
		delegate.translate(0, 0.5, 0);
		drawVanillaCuboid(delegate, 0, 48, 4, 12, 4, 0.25);
		delegate.pop();
		delegate.push();
		delegate.anchorTo('RIGHT_LEG');
		delegate.translate(0, 0.5, 0);
		drawVanillaCuboid(delegate, 0, 32, 4, 12, 4, 0.25);
		delegate.pop();
	}

	if (features === null || !features.enabled) return;

	if (p === 1 && delegate.beginTranslucent) {
		delegate.beginTranslucent();
	}
	delegate.bind(drawingEmissive ? 'EMISSIVE_SKIN' : 'SKIN');

	if (p === 0) {
		let earMode = features.earMode;
		const earAnchor = features.earAnchor;

		if (earMode !== 'NONE' && isInhibited(delegate, 'EARS')) earMode = 'NONE';

		if (earMode === 'ABOVE' || earMode === 'AROUND') {
			delegate.push();
			delegate.anchorTo('HEAD');
			if (earAnchor === 'CENTER') {
				delegate.translate(0, 0, 4);
			} else if (earAnchor === 'BACK') {
				delegate.translate(0, 0, 8);
			}
			delegate.push();
			delegate.translate(-4, -16, 0);
			delegate.renderFront(24, 0, 16, 8, 'NONE', 'NONE', 'NONE');
			delegate.renderBack(56, 28, 16, 8, 'CW', 'NONE', 'NONE');
			delegate.pop();
			if (earMode === 'AROUND') {
				delegate.translate(-4, -8, 0);
				delegate.renderFront(36, 16, 4, 8, 'CW', 'NONE', 'NONE');
				delegate.renderBack(12, 16, 4, 8, 'CW', 'NONE', 'NONE');

				delegate.translate(12, 0, 0);
				delegate.renderFront(36, 32, 4, 8, 'CW', 'NONE', 'NONE');
				delegate.renderBack(12, 32, 4, 8, 'CW', 'NONE', 'NONE');
			}
			delegate.pop();
		} else if (earMode === 'SIDES') {
			delegate.push();
			delegate.anchorTo('HEAD');
			if (earAnchor === 'CENTER') {
				delegate.translate(0, 0, 4);
			} else if (earAnchor === 'BACK') {
				delegate.translate(0, 0, 8);
			}
			delegate.translate(-8, -8, 0);
			delegate.renderFront(24, 0, 8, 8, 'NONE', 'NONE', 'NONE');
			delegate.renderBack(56, 28, 8, 8, 'CW', 'NONE', 'NONE');
			delegate.translate(16, 0, 0);
			delegate.renderFront(32, 0, 8, 8, 'NONE', 'NONE', 'NONE');
			delegate.renderBack(56, 36, 8, 8, 'CW', 'NONE', 'NONE');
			delegate.pop();
		} else if (earMode === 'BEHIND') {
			delegate.push();
			delegate.anchorTo('HEAD');
			delegate.rotate(90, 0, 1, 0);
			delegate.translate(-16, -8, 0);
			delegate.renderFront(24, 0, 8, 8, 'NONE', 'NONE', 'NONE');
			delegate.renderBack(56, 28, 8, 8, 'CW', 'NONE', 'NONE');
			delegate.rotate(180, 0, 1, 0);
			delegate.translate(-8, 0, -8);
			delegate.renderFront(32, 0, 8, 8, 'NONE', 'NONE', 'NONE');
			delegate.renderBack(56, 36, 8, 8, 'CW', 'NONE', 'NONE');
			delegate.pop();
		} else if (earMode === 'FLOPPY') {
			delegate.push();
			delegate.anchorTo('HEAD');
			delegate.rotate(90, 0, 1, 0);
			delegate.translate(-8, -7, 0);
			delegate.rotate(-30, 1, 0, 0);
			delegate.translate(0, 0, 0);
			delegate.renderFront(24, 0, 8, 8, 'NONE', 'NONE', 'NONE');
			delegate.renderBack(56, 28, 8, 8, 'CW', 'NONE', 'NONE');
			delegate.pop();
			delegate.push();
			delegate.anchorTo('HEAD');
			delegate.rotate(-90, 0, 1, 0);
			delegate.translate(0, -7, -8);
			delegate.rotate(-30, 1, 0, 0);
			delegate.translate(0, 0, 0);
			delegate.renderFront(32, 0, 8, 8, 'NONE', 'NONE', 'NONE');
			delegate.renderBack(56, 36, 8, 8, 'CW', 'NONE', 'NONE');
			delegate.pop();
		} else if (earMode === 'CROSS') {
			delegate.push();
			delegate.anchorTo('HEAD');
			if (earAnchor === 'CENTER') {
				delegate.translate(0, 0, 4);
			} else if (earAnchor === 'BACK') {
				delegate.translate(0, 0, 8);
			}
			delegate.translate(4, -16, 0);
			delegate.push();
			delegate.rotate(45, 0, 1, 0);
			delegate.translate(-4, 0, 0);
			delegate.renderFront(24, 0, 8, 8, 'NONE', 'NONE', 'NONE');
			delegate.renderBack(56, 28, 8, 8, 'CW', 'NONE', 'NONE');
			delegate.pop();
			delegate.push();
			delegate.rotate(-45, 0, 1, 0);
			delegate.translate(-4, 0, 0);
			delegate.renderFront(32, 0, 8, 8, 'NONE', 'NONE', 'NONE');
			delegate.renderBack(56, 36, 8, 8, 'CW', 'NONE', 'NONE');
			delegate.pop();
			delegate.pop();
		} else if (earMode === 'OUT') {
			delegate.push();
			delegate.anchorTo('HEAD');
			delegate.rotate(90, 0, 1, 0);
			if (earAnchor === 'BACK') {
				delegate.translate(-16, -8, 0);
			} else if (earAnchor === 'CENTER') {
				delegate.translate(-8, -16, 0);
			} else if (earAnchor === 'FRONT') {
				delegate.translate(0, -8, 0);
			}
			delegate.renderFront(24, 0, 8, 8, 'NONE', 'NONE', 'NONE');
			delegate.renderBack(56, 28, 8, 8, 'CW', 'NONE', 'NONE');
			delegate.rotate(180, 0, 1, 0);
			delegate.translate(-8, 0, -8);
			delegate.renderFront(32, 0, 8, 8, 'NONE', 'NONE', 'NONE');
			delegate.renderBack(56, 36, 8, 8, 'CW', 'NONE', 'NONE');
			delegate.pop();
		} else if (earMode === 'TALL') {
			delegate.push();
			delegate.anchorTo('HEAD');
			delegate.translate(0, -8, 0);
			if (earAnchor === 'CENTER') {
				delegate.translate(0, 0, 4);
			} else if (earAnchor === 'BACK') {
				delegate.translate(0, 0, 8);
			}

			let ang = -6;

			const dX = delegate.getCapeX() - delegate.getX();
			const dZ = delegate.getCapeZ() - delegate.getZ();

			const yaw = delegate.getBodyYaw();
			const yawX = Math.sin((yaw * Math.PI) / 180);
			const yawZ = -Math.cos((yaw * Math.PI) / 180);
			let dForward = (dX * yawX + dZ * yawZ) * 25.0;
			if (dForward > 80) dForward = 80;
			if (dForward < -80) dForward = -80;
			ang -= dForward;

			delegate.rotate(ang / 3, 1, 0, 0);
			delegate.translate(0, -4, 0);
			delegate.renderFront(24, 0, 8, 4, 'CW', 'NONE', 'NONE');
			delegate.renderBack(56, 40, 8, 4, 'NONE', 'NONE', 'NONE');

			delegate.rotate(ang, 1, 0, 0);
			delegate.translate(0, -4, 0);
			delegate.renderFront(28, 0, 8, 4, 'CW', 'NONE', 'NONE');
			delegate.renderBack(56, 36, 8, 4, 'NONE', 'NONE', 'NONE');

			delegate.rotate(ang / 2, 1, 0, 0);
			delegate.translate(0, -4, 0);
			delegate.renderFront(32, 0, 8, 4, 'CW', 'NONE', 'NONE');
			delegate.renderBack(56, 32, 8, 4, 'NONE', 'NONE', 'NONE');

			delegate.rotate(ang, 1, 0, 0);
			delegate.translate(0, -4, 0);
			delegate.renderFront(36, 0, 8, 4, 'CW', 'NONE', 'NONE');
			delegate.renderBack(56, 28, 8, 4, 'NONE', 'NONE', 'NONE');
			delegate.pop();
		} else if (earMode === 'TALL_CROSS') {
			delegate.push();
			delegate.anchorTo('HEAD');
			if (earAnchor === 'CENTER') {
				delegate.translate(0, 0, 4);
			} else if (earAnchor === 'BACK') {
				delegate.translate(0, 0, 8);
			}
			delegate.translate(4, -24, 0);
			delegate.push();
			delegate.rotate(45, 0, 1, 0);
			delegate.translate(-4, 0, 0);
			delegate.renderFront(24, 0, 8, 16, 'CW', 'NONE', 'NONE');
			delegate.renderBack(56, 28, 8, 16, 'NONE', 'NONE', 'NONE');
			delegate.pop();
			delegate.push();
			delegate.rotate(-45, 0, 1, 0);
			delegate.translate(-4, 0, 0);
			delegate.renderFront(24, 0, 8, 16, 'CW', 'NONE', 'NONE');
			delegate.renderBack(56, 28, 8, 16, 'NONE', 'NONE', 'NONE');
			delegate.pop();
			delegate.pop();
		}

		const tailMode = features.tailMode;

		if (tailMode !== 'NONE' && !isInhibited(delegate, 'TAIL')) {
			let ang = 0;
			let swing = 0;
			if (tailMode === 'DOWN') {
				ang = 30;
				swing = 40;
			} else if (
				tailMode === 'BACK' ||
				tailMode === 'CROSS' ||
				tailMode === 'CROSS_OVERLAP' ||
				tailMode === 'STAR' ||
				tailMode === 'STAR_OVERLAP'
			) {
				ang = features.tailBend0 !== 0 ? 90 : 80;
				swing = 20;
			} else if (tailMode === 'UP') {
				ang = 130;
				swing = -20;
			}
			let baseAngle = features.tailBend0;
			if (isActive(delegate, 'GLIDING')) {
				baseAngle = -30;
				ang = 0;
			}
			delegate.push();
			delegate.anchorTo('TORSO');
			delegate.translate(0, -2, 4);
			delegate.rotate(ang + swingAmount * swing + Math.sin(delegate.getTime() / 12) * 4, 1, 0, 0);
			const vert = tailMode === 'VERTICAL';
			if (vert) {
				delegate.translate(4, 0, 0);
				delegate.rotate(90, 0, 0, 1);
				if (baseAngle < 0) {
					delegate.translate(4, 0, 0);
					delegate.rotate(baseAngle, 0, 1, 0);
					delegate.translate(-4, 0, 0);
				}
				delegate.translate(-4, 0, 0);
				if (baseAngle > 0) {
					delegate.rotate(baseAngle, 0, 1, 0);
				}
				delegate.rotate(90, 1, 0, 0);
			}
			let segments = features.tailSegments;
			if (segments <= 0) segments = 1;
			const angles = [vert ? 0 : baseAngle, features.tailBend1, features.tailBend2, features.tailBend3];
			const segHeight = Math.trunc(12 / segments);
			for (let i = 0; i < segments; i++) {
				const ofs = i === 0 ? 0 : tailMode === 'CROSS_OVERLAP' || tailMode === 'STAR_OVERLAP' ? 4 : 0;
				delegate.rotate(angles[i]! * (1 - swingAmount / 2), 1, 0, 0);
				delegate.renderDoubleSided(56, 16 + i * segHeight, 8, segHeight, 'NONE', 'HORIZONTAL', 'NONE');
				if (tailMode === 'CROSS' || tailMode === 'CROSS_OVERLAP') {
					delegate.push();
					delegate.translate(4, 0, 0);
					delegate.rotate(90, 0, 1, 0);
					delegate.translate(-4, -ofs, 0);
					delegate.renderDoubleSided(56, 16 + i * segHeight - ofs, 8, segHeight + ofs, 'NONE', 'HORIZONTAL', 'NONE');
					delegate.pop();
				} else if (tailMode === 'STAR' || tailMode === 'STAR_OVERLAP') {
					for (let j = 0; j < 3; j++) {
						delegate.push();
						delegate.translate(4, 0, 0);
						delegate.rotate(45 * (j + 1), 0, 1, 0);
						delegate.translate(-4, -ofs, 0);
						delegate.renderDoubleSided(56, 16 + i * segHeight - ofs, 8, segHeight + ofs, 'NONE', 'HORIZONTAL', 'NONE');
						delegate.pop();
					}
				}
				delegate.translate(0, segHeight, 0);
			}
			delegate.pop();
		}

		const claws = features.claws;
		const horn = features.horn;

		if (claws) {
			if (!isActive(delegate, 'WEARING_BOOTS')) {
				if (!isInhibited(delegate, 'CLAW_LEFT_LEG')) {
					delegate.push();
					delegate.anchorTo('LEFT_LEG');
					delegate.translate(0, 0, -4);
					delegate.rotate(90, 1, 0, 0);
					delegate.renderDoubleSided(16, 48, 4, 4, 'NONE', 'HORIZONTAL', 'NONE');
					delegate.pop();
				}

				if (!isInhibited(delegate, 'CLAW_RIGHT_LEG')) {
					delegate.push();
					delegate.anchorTo('RIGHT_LEG');
					delegate.translate(0, 0, -4);
					delegate.rotate(90, 1, 0, 0);
					delegate.renderDoubleSided(0, 16, 4, 4, 'NONE', 'HORIZONTAL', 'NONE');
					delegate.pop();
				}
			}

			if (!isInhibited(delegate, 'CLAW_LEFT_ARM')) {
				delegate.push();
				delegate.anchorTo('LEFT_ARM');
				delegate.rotate(90, 0, 1, 0);
				delegate.translate(-4, 0, slim ? 3 : 4);
				delegate.renderDoubleSided(44, 48, 4, 4, 'UPSIDE_DOWN', 'HORIZONTAL', 'NONE');
				delegate.pop();
			}

			if (!isInhibited(delegate, 'CLAW_RIGHT_ARM')) {
				delegate.push();
				delegate.anchorTo('RIGHT_ARM');
				delegate.rotate(90, 0, 1, 0);
				delegate.translate(-4, 0, 0);
				delegate.renderDoubleSided(52, 16, 4, 4, 'UPSIDE_DOWN', 'NONE', 'NONE');
				delegate.pop();
			}
		}

		if (horn && !isInhibited(delegate, 'HORN')) {
			delegate.push();
			delegate.anchorTo('HEAD');
			delegate.translate(0, -8, 0);
			delegate.rotate(25, 1, 0, 0);
			delegate.translate(0, -8, 0);
			delegate.renderDoubleSided(56, 0, 8, 8, 'NONE', 'NONE', 'NONE');
			delegate.pop();
		}

		const snoutOffset = features.snoutOffset;
		const snoutWidth = features.snoutWidth;
		const snoutHeight = features.snoutHeight;
		const snoutDepth = features.snoutDepth;

		if (snoutWidth > 0 && snoutHeight > 0 && snoutDepth > 0 && !isInhibited(delegate, 'SNOUT')) {
			delegate.push();
			delegate.anchorTo('HEAD');
			delegate.translate((8 - snoutWidth) / 2, -(snoutOffset + snoutHeight), -snoutDepth);
			delegate.renderDoubleSided(0, 2, snoutWidth, snoutHeight, 'NONE', 'NONE', 'NONE');
			delegate.push();
			// top
			delegate.rotate(-90, 1, 0, 0);
			delegate.translate(0, -1, 0);
			delegate.renderDoubleSided(0, 1, snoutWidth, 1, 'NONE', 'NONE', 'NONE');
			for (let i = 0; i < snoutDepth - 1; i++) {
				delegate.translate(0, -1, 0);
				delegate.renderDoubleSided(0, 0, snoutWidth, 1, 'NONE', 'NONE', 'NONE');
			}
			delegate.pop();
			delegate.push();
			// bottom
			delegate.translate(0, snoutHeight, 0);
			delegate.rotate(90, 1, 0, 0);
			delegate.renderDoubleSided(0, 2 + snoutHeight, snoutWidth, 1, 'NONE', 'NONE', 'NONE');
			for (let i = 0; i < snoutDepth - 1; i++) {
				delegate.translate(0, 1, 0);
				delegate.renderDoubleSided(0, 2 + snoutHeight + 1, snoutWidth, 1, 'NONE', 'NONE', 'NONE');
			}
			delegate.pop();
			delegate.push();
			delegate.rotate(90, 0, 1, 0);
			// right
			delegate.push();
			delegate.translate(-1, 0, 0);
			delegate.renderDoubleSided(7, 0, 1, snoutHeight, 'NONE', 'NONE', 'NONE');
			for (let i = 0; i < snoutDepth - 1; i++) {
				delegate.translate(-1, 0, 0);
				delegate.renderDoubleSided(7, 4, 1, snoutHeight, 'NONE', 'NONE', 'NONE');
			}
			delegate.pop();
			// left
			delegate.push();
			delegate.translate(-1, 0, snoutWidth);
			delegate.renderDoubleSided(7, 0, 1, snoutHeight, 'NONE', 'NONE', 'NONE');
			for (let i = 0; i < snoutDepth - 1; i++) {
				delegate.translate(-1, 0, 0);
				delegate.renderDoubleSided(7, 4, 1, snoutHeight, 'NONE', 'NONE', 'NONE');
			}
			delegate.pop();
			delegate.pop();
			delegate.pop();
		}
	}

	const chestSize = features.chestSize;

	if (
		chestSize > 0 &&
		(!isActive(delegate, 'WEARING_CHESTPLATE') || delegate.canBind('CHESTPLATE')) &&
		(p === 0 ||
			(p === 1 && delegate.isJacketEnabled()) ||
			((p === 2 || (p === 3 && delegate.canBind('GLINT_CHESTPLATE'))) &&
				isActive(delegate, 'WEARING_CHESTPLATE') &&
				!drawingEmissive &&
				delegate.canBind('CHESTPLATE'))) &&
		!isInhibited(delegate, 'CHEST')
	) {
		delegate.push();
		delegate.anchorTo('TORSO');
		delegate.translate(0, -10, 0);
		delegate.rotate(-chestSize * 45, 1, 0, 0);

		if (p === 2) {
			delegate.bind('CHESTPLATE');
		} else if (p === 3) {
			delegate.bind('GLINT_CHESTPLATE');
		}

		if (p === 0) {
			delegate.renderDoubleSided(20, 22, 8, 4, 'NONE', 'NONE', 'NONE');
		} else if (p === 1) {
			delegate.push();
			delegate.translate(4, 2, 0);
			// can't use QuadGrow as we have two quads side-by-side
			delegate.scale(8.5 / 8, 4.5 / 4, 1);
			delegate.translate(-4, -2, 0);
			delegate.translate(0, 0, -0.25);
			delegate.renderDoubleSided(0, 48, 4, 4, 'NONE', 'NONE', 'NONE');
			delegate.translate(4, 0, 0);
			delegate.renderDoubleSided(12, 48, 4, 4, 'NONE', 'NONE', 'NONE');
			delegate.pop();
		} else if (p === 2 || p === 3) {
			delegate.push();
			delegate.translate(0, 1, -1);
			delegate.renderFront(20, 24, 8, 3, 'NONE', 'NONE', 'FULLPIXEL');
			delegate.pop();
		}
		delegate.push();
		delegate.translate(0, 4, 0);
		delegate.rotate(90, 1, 0, 0);
		if (p === 0) {
			delegate.renderDoubleSided(56, 44, 8, 4, 'NONE', 'NONE', 'NONE');
		} else if (p === 1) {
			delegate.push();
			delegate.translate(0, 0, -0.25);
			delegate.renderDoubleSided(28, 48, 8, 4, 'NONE', 'NONE', 'QUARTERPIXEL');
			delegate.pop();
		} else if (p === 2 || p === 3) {
			delegate.push();
			delegate.translate(0, 0, -1);
			delegate.renderFront(20, 25, 8, 3, 'NONE', 'NONE', 'FULLPIXEL');
			delegate.pop();
		}
		delegate.pop();
		delegate.push();
		delegate.rotate(90, 0, 1, 0);
		delegate.translate(-4, 0, 0.01);
		if (p === 0) {
			delegate.renderDoubleSided(60, 48, 4, 4, 'NONE', 'NONE', 'NONE');
		} else if (p === 1) {
			delegate.push();
			delegate.translate(0, 0, -0.25);
			delegate.renderDoubleSided(48, 48, 4, 4, 'NONE', 'NONE', 'QUARTERPIXEL');
			delegate.pop();
		} else if (p === 2 || p === 3) {
			delegate.push();
			delegate.translate(0, 0, -1);
			delegate.renderFront(16, 20, 4, 4, 'NONE', 'NONE', 'FULLPIXEL');
			delegate.pop();
		}
		delegate.translate(0, 0, 7.98);
		delegate.rotate(180, 0, 1, 0);
		delegate.translate(-4, 0, 0);
		if (p === 0) {
			delegate.renderDoubleSided(60, 48, 4, 4, 'NONE', 'HORIZONTAL', 'NONE');
		} else if (p === 1) {
			delegate.push();
			delegate.translate(0, 0, -0.25);
			delegate.renderDoubleSided(48, 48, 4, 4, 'NONE', 'HORIZONTAL', 'QUARTERPIXEL');
			delegate.pop();
		} else if (p === 2 || p === 3) {
			delegate.push();
			delegate.translate(0, 0, -1);
			delegate.renderFront(16, 20, 4, 4, 'NONE', 'NONE', 'FULLPIXEL');
			delegate.pop();
		}
		delegate.pop();
		delegate.pop();
	}

	if (p === 0 && !isInhibited(delegate, 'WINGS')) {
		const wingMode = features.wingMode;

		if (wingMode !== 'NONE') {
			const g = isActive(delegate, 'GLIDING');
			const f = isActive(delegate, 'CREATIVE_FLYING');
			delegate.push();
			let wiggle: number;
			if (features.animateWings) {
				wiggle = g
					? -40
					: Math.sin((delegate.getTime() + 8) / (f ? 2 : 12)) * (f ? 20 : 2) + swingAmount * 10;
			} else {
				wiggle = 0;
			}
			delegate.anchorTo('TORSO');
			delegate.bind(drawingEmissive ? 'EMISSIVE_WING' : 'WING');
			delegate.translate(2, -14, 4);
			if (wingMode === 'SYMMETRIC_DUAL' || wingMode === 'ASYMMETRIC_R') {
				delegate.push();
				delegate.rotate(-120 + wiggle, 0, 1, 0);
				delegate.renderDoubleSided(0, 0, 20, 16, 'NONE', 'NONE', 'NONE');
				delegate.pop();
			}
			if (wingMode === 'SYMMETRIC_DUAL' || wingMode === 'ASYMMETRIC_L') {
				delegate.translate(4, 0, 0);
				delegate.push();
				delegate.rotate(-60 - wiggle, 0, 1, 0);
				delegate.renderDoubleSided(0, 0, 20, 16, 'NONE', 'NONE', 'NONE');
				delegate.pop();
			}
			if (wingMode === 'SYMMETRIC_SINGLE') {
				delegate.translate(2, 0, 0);
				delegate.push();
				delegate.rotate(-90 + wiggle, 0, 1, 0);
				delegate.renderDoubleSided(0, 0, 20, 16, 'NONE', 'NONE', 'NONE');
				delegate.pop();
			}
			if (wingMode === 'ASYMMETRIC_DUAL') {
				delegate.push();
				delegate.rotate(-120 + wiggle, 0, 1, 0);
				delegate.renderDoubleSided(0, 0, 10, 16, 'NONE', 'NONE', 'NONE');
				delegate.pop();
				delegate.translate(4, 0, 0);
				delegate.push();
				delegate.rotate(-60 - wiggle, 0, 1, 0);
				delegate.renderDoubleSided(10, 0, 10, 16, 'NONE', 'NONE', 'NONE');
				delegate.pop();
			}
			if (wingMode === 'FLAT') {
				delegate.translate(-8, 0, 0.75);
				delegate.push();
				delegate.renderDoubleSided(0, 0, 20, 16, 'NONE', 'NONE', 'NONE');
				delegate.pop();
			}
			delegate.pop();
		}
	}

	if (
		!drawingEmissive &&
		p === 0 &&
		features.capeEnabled &&
		!isInhibited(delegate, 'CAPE') &&
		!isActive(delegate, 'WEARING_ELYTRA')
	) {
		delegate.push();
		delegate.anchorTo('TORSO');
		delegate.translate(4, -12, 5);
		const dX = delegate.getCapeX() - delegate.getX();
		const dY = delegate.getCapeY() - delegate.getY();
		const dZ = delegate.getCapeZ() - delegate.getZ();
		const yaw = delegate.getBodyYaw();
		const yawX = Math.sin((yaw * Math.PI) / 180);
		const yawZ = -Math.cos((yaw * Math.PI) / 180);
		let dUp = dY * 10;
		dUp = clamp(dUp, -6, 32);
		let dForward = (dX * yawX + dZ * yawZ) * 100;
		dForward = clamp(dForward, 0, 150);
		let dSide = (dX * yawZ - dZ * yawX) * 100;
		dSide = clamp(dSide, -20, 20);
		if (dForward < 0) {
			dForward = 0;
		}

		const stride = delegate.getStride();
		dUp += Math.sin(delegate.getHorizontalSpeed() * 6) * 32 * stride;

		delegate.rotate(6.0 + dForward / 2.0 + dUp, 1, 0, 0);
		delegate.rotate(dSide / 2.0, 0, 0, 1);
		delegate.rotate(180.0 - dSide / 2.0, 0, 1, 0);

		delegate.bind('CAPE');
		delegate.translate(-5, 0, 0);
		// front
		delegate.renderDoubleSided(0, 0, 10, 16, 'NONE', 'NONE', 'NONE');
		delegate.push();
		// left
		delegate.translate(10, 0, 1);
		delegate.rotate(90, 0, 1, 0);
		delegate.renderDoubleSided(9, 0, 1, 16, 'NONE', 'HORIZONTAL', 'NONE');
		// back
		delegate.translate(0, 0, 0);
		delegate.rotate(90, 0, 1, 0);
		delegate.renderDoubleSided(10, 0, 10, 16, 'NONE', 'NONE', 'NONE');
		// right
		delegate.translate(10, 0, 1);
		delegate.rotate(90, 0, 1, 0);
		delegate.renderDoubleSided(0, 0, 1, 16, 'NONE', 'HORIZONTAL', 'NONE');
		delegate.pop();

		// top
		delegate.rotate(90, 1, 0, 0);
		delegate.renderDoubleSided(0, 0, 10, 1, 'NONE', 'VERTICAL', 'NONE');

		// bottom
		delegate.translate(0, 0, -16);
		delegate.renderDoubleSided(0, 15, 10, 1, 'NONE', 'VERTICAL', 'NONE');
		delegate.bind('SKIN');
		delegate.pop();
	}
}

function drawVanillaCuboid(
	delegate: EarsRenderDelegate,
	u: number,
	v: number,
	w: number,
	h: number,
	d: number,
	g: number,
): void {
	const g2 = g * 2;
	delegate.translate(w / 2, h / 2, d / 2);
	delegate.scale((w + g2) / w, (h + g2) / h, (d + g2) / d);
	delegate.translate(-w / 2, -h * 1.5, -d / 2);
	// front
	delegate.renderDoubleSided(u + d, v + d, w, h, 'NONE', 'NONE', 'NONE');
	delegate.push();
	// left
	delegate.translate(w, 0, d);
	delegate.rotate(90, 0, 1, 0);
	delegate.renderDoubleSided(u + d + w, v + d, d, h, 'NONE', 'HORIZONTAL', 'NONE');
	// back
	delegate.translate(0, 0, 0);
	delegate.rotate(90, 0, 1, 0);
	delegate.renderDoubleSided(u + d + w + d, v + d, w, h, 'NONE', 'NONE', 'NONE');
	// right
	delegate.translate(w, 0, d);
	delegate.rotate(90, 0, 1, 0);
	delegate.renderDoubleSided(u, v + d, d, h, 'NONE', 'HORIZONTAL', 'NONE');
	delegate.pop();

	// top
	delegate.rotate(90, 1, 0, 0);
	delegate.renderDoubleSided(u + d, v, w, d, 'NONE', 'VERTICAL', 'NONE');

	// bottom
	delegate.translate(0, 0, -h);
	delegate.renderDoubleSided(u + d + w, v, w, d, 'NONE', 'VERTICAL', 'NONE');
}

import type { RenderObject } from '@ears/renderer';
import * as THREE from 'three';

import { buildDisplayList, disposeGroup } from './display-list.js';
import { buildPlayerModel } from './player-model.js';

/**
 * A self-contained preview: scene, camera, lights, drag-to-orbit, and a skin-to-mesh pipeline.
 *
 * Textures and geometry are rebuilt only when the thing they depend on actually changes, so
 * dragging a slider doesn't churn the GPU.
 */

export interface PreviewTextures {
	skin: ImageData;
	wing?: ImageData | null;
	cape?: ImageData | null;
	emissiveSkin?: ImageData | null;
	emissiveWing?: ImageData | null;
}

export interface PreviewState {
	slim: boolean;
	overlays: Record<string, boolean>;
}

function toTexture(data: ImageData | null | undefined): THREE.Texture | null {
	if (!data) return null;
	const tex = new THREE.DataTexture(
		new Uint8Array(data.data.buffer.slice(0)),
		data.width,
		data.height,
		THREE.RGBAFormat,
	);
	// Skins are authored in sRGB. Without saying so, three treats the values as linear and every
	// colour comes out washed out — the single most visible rendering bug this preview had.
	tex.colorSpace = THREE.SRGBColorSpace;
	// pixel art: never interpolate, and never wrap
	tex.magFilter = THREE.NearestFilter;
	tex.minFilter = THREE.NearestFilter;
	tex.wrapS = THREE.ClampToEdgeWrapping;
	tex.wrapT = THREE.ClampToEdgeWrapping;
	tex.flipY = true;
	tex.needsUpdate = true;
	return tex;
}

export class Preview {
	private readonly scene = new THREE.Scene();
	private readonly camera: THREE.PerspectiveCamera;
	private readonly renderer: THREE.WebGLRenderer;
	private readonly root = new THREE.Group();

	private textures: Record<string, THREE.Texture | null> = {};
	private emissiveTextures: Record<string, THREE.Texture | null> = {};
	private disposed = false;

	private yaw = 25;
	private pitch = 10;
	/** User zoom, as a multiplier on the automatic fit rather than an absolute distance. */
	private zoom = 1;
	/** What the model currently occupies, recomputed whenever the meshes change. */
	private fitCenter = new THREE.Vector3(0, 1, 0);
	private fitRadius = 22;
	private dragging = false;

	constructor(private readonly canvas: HTMLCanvasElement) {
		this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
		this.scene.add(this.root);

		// Ambient close to 1 so a lit face shows very nearly the skin's own colour, with two soft
		// directionals only to separate the sides. Any more and the pixels stop being the artist's.
		this.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
		const key = new THREE.DirectionalLight(0xffffff, 0.32);
		key.position.set(0.3, 1, -0.9).normalize();
		this.scene.add(key);
		const fill = new THREE.DirectionalLight(0xffffff, 0.32);
		fill.position.set(-0.3, 1, 0.9).normalize();
		this.scene.add(fill);

		this.attachControls();
		this.resize();
	}

	private attachControls(): void {
		const el = this.canvas;
		el.addEventListener('pointerdown', (e) => {
			this.dragging = true;
			el.setPointerCapture(e.pointerId);
		});
		// capture means we keep receiving these even when the cursor leaves the canvas, which the
		// old manipulator got wrong: its drag stuck if you released outside the panel
		el.addEventListener('pointerup', (e) => {
			this.dragging = false;
			el.releasePointerCapture(e.pointerId);
		});
		el.addEventListener('pointermove', (e) => {
			if (!this.dragging) return;
			// subtract, so the model follows the cursor rather than running away from it
			this.yaw = (this.yaw - e.movementX) % 360;
			this.pitch = Math.max(-89, Math.min(89, this.pitch - e.movementY));
		});
		el.addEventListener(
			'wheel',
			(e) => {
				e.preventDefault();
				this.zoom = Math.max(0.4, Math.min(3, this.zoom + e.deltaY / 900));
			},
			{ passive: false },
		);
	}

	/** Points the camera at a named side of the model. */
	setView(view: 'front' | 'side' | 'back' | 'above'): void {
		switch (view) {
			case 'front':
				this.yaw = 25;
				this.pitch = 10;
				break;
			case 'side':
				this.yaw = 90;
				this.pitch = 5;
				break;
			case 'back':
				this.yaw = 205;
				this.pitch = 10;
				break;
			case 'above':
				this.yaw = 25;
				this.pitch = 55;
				break;
		}
	}

	resize(): void {
		const rect = this.canvas.getBoundingClientRect();
		const w = Math.max(1, Math.floor(rect.width));
		const h = Math.max(1, Math.floor(rect.height));
		this.renderer.setSize(w, h, false);
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
	}

	setTextures(tex: PreviewTextures): void {
		for (const t of [...Object.values(this.textures), ...Object.values(this.emissiveTextures)]) {
			t?.dispose();
		}
		this.textures = {
			skin: toTexture(tex.skin),
			wing: toTexture(tex.wing),
			cape: toTexture(tex.cape),
		};
		this.emissiveTextures = {
			skin: toTexture(tex.emissiveSkin),
			emissive_skin: toTexture(tex.emissiveSkin),
			wing: toTexture(tex.emissiveWing),
			emissive_wing: toTexture(tex.emissiveWing),
		};
	}

	/** Rebuilds the meshes. Call after the skin or the configuration changes. */
	rebuild(objects: RenderObject[], state: PreviewState): void {
		disposeGroup(this.root);
		this.root.clear();

		const skin = this.textures.skin;
		if (skin) {
			this.root.add(buildPlayerModel({ slim: state.slim, texture: skin, overlays: state.overlays }));
		}
		this.root.add(
			buildDisplayList(objects, {
				slim: state.slim,
				textures: this.textures,
				emissiveTextures: this.emissiveTextures,
			}),
		);

		// Frame whatever is actually there. A fixed distance suits a bare player and then crops the
		// moment a feature sticks out past it — tall ears and raised tails both went off the top of
		// the viewport, which reads as the cosmetic not rendering at all.
		const box = new THREE.Box3().setFromObject(this.root);
		if (box.isEmpty()) return;
		const sphere = box.getBoundingSphere(new THREE.Sphere());
		this.fitCenter = sphere.center;
		this.fitRadius = Math.max(sphere.radius, 1);
	}

	/** How far back the camera has to sit for the model to fit, on whichever axis is tighter. */
	private fitDistance(): number {
		const vFov = THREE.MathUtils.degToRad(this.camera.fov);
		const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
		// a little margin so nothing grazes the edge
		return (this.fitRadius * 1.08) / Math.sin(Math.min(vFov, hFov) / 2);
	}

	render(): void {
		if (this.disposed) return;
		const yawRad = THREE.MathUtils.degToRad(this.yaw);
		const pitchRad = THREE.MathUtils.degToRad(this.pitch);
		const r = this.fitDistance() * this.zoom;
		const c = this.fitCenter;
		this.camera.position.set(
			c.x + Math.sin(yawRad) * Math.cos(pitchRad) * r,
			c.y + Math.sin(pitchRad) * r,
			c.z + Math.cos(yawRad) * Math.cos(pitchRad) * r,
		);
		this.camera.lookAt(c);
		this.renderer.render(this.scene, this.camera);
	}

	dispose(): void {
		this.disposed = true;
		disposeGroup(this.root);
		for (const t of [...Object.values(this.textures), ...Object.values(this.emissiveTextures)]) {
			t?.dispose();
		}
		this.renderer.dispose();
	}
}

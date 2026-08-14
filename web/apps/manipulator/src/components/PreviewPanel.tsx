import { CaptureDelegate, render } from '@ears/renderer';
import { Preview } from '@ears/three';
import { useEffect, useRef, useState } from 'react';

import type { Derived } from '../lib/derive.js';

export function PreviewPanel({
	derived,
	slim,
	overlays,
}: {
	derived: Derived | null;
	slim: boolean;
	overlays: Record<string, boolean>;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const previewRef = useRef<Preview | null>(null);
	const [animate, setAnimate] = useState(true);
	const [walking, setWalking] = useState(false);

	useEffect(() => {
		if (!canvasRef.current) return;
		const preview = new Preview(canvasRef.current);
		previewRef.current = preview;

		let raf = 0;
		const loop = () => {
			preview.render();
			raf = requestAnimationFrame(loop);
		};
		loop();

		const onResize = () => preview.resize();
		window.addEventListener('resize', onResize);

		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener('resize', onResize);
			preview.dispose();
			previewRef.current = null;
		};
	}, []);

	// textures are uploaded only when the skin itself changes
	useEffect(() => {
		const preview = previewRef.current;
		if (!preview || !derived) return;
		preview.setTextures({
			skin: derived.skin,
			wing: derived.wing,
			cape: derived.cape,
			emissiveSkin: derived.emissiveSkin,
			emissiveWing: derived.emissiveWing,
		});
		preview.rebuild(derived.objects, { slim, overlays });
		preview.resize();
	}, [derived, slim, overlays]);

	// The renderer sways tails and flaps wings off a clock, so a preview stuck at time zero shows a
	// frozen pose. Re-run it a few times a second and rebuild — the geometry is small enough that
	// this is cheaper than it sounds, and it is the difference between a mannequin and a character.
	useEffect(() => {
		const preview = previewRef.current;
		if (!preview || !derived?.features || !animate) return;
		let frame = 0;
		const id = setInterval(() => {
			frame += 1;
			const time = frame * 1.5;
			// a gentle walk cycle when asked, so wings beat and the tail swings
			const swing = walking ? Math.sin(time / 4) * 0.6 : 0;
			const capture = new CaptureDelegate(slim, false, time, swing);
			render(derived.features, capture);
			preview.rebuild(capture.objects, { slim, overlays });
		}, 66);
		return () => clearInterval(id);
	}, [derived, slim, overlays, animate, walking]);

	return (
		<div className="relative h-full w-full">
			<canvas
				ref={canvasRef}
				aria-label="3D preview"
				className="h-full w-full cursor-grab active:cursor-grabbing"
			/>
			<div className="absolute left-2 top-2 flex gap-1">
				{(['front', 'side', 'back', 'above'] as const).map((view) => (
					<button
						key={view}
						type="button"
						className="rounded border border-edge bg-panel/80 px-2 py-0.5 capitalize backdrop-blur transition hover:bg-edge"
						onClick={() => previewRef.current?.setView(view)}
					>
						{view}
					</button>
				))}
			</div>
			{!derived ? (
				<div className="pointer-events-none absolute inset-0 grid place-content-center text-center text-muted">
					<p className="text-base">Drop a skin here</p>
					<p className="mt-1">or paste one, or use Import</p>
				</div>
			) : null}
			<div className="absolute right-2 top-2 flex gap-1">
				<button
					type="button"
					className={`rounded border px-2 py-0.5 backdrop-blur transition ${animate ? 'border-accent bg-accent/20' : 'border-edge bg-panel/80 hover:bg-edge'}`}
					onClick={() => setAnimate((v) => !v)}
				>
					Animate
				</button>
				<button
					type="button"
					className={`rounded border px-2 py-0.5 backdrop-blur transition ${walking ? 'border-accent bg-accent/20' : 'border-edge bg-panel/80 hover:bg-edge'}`}
					onClick={() => setWalking((v) => !v)}
					title="swing the limbs, as if walking"
				>
					Walk
				</button>
			</div>
			<p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] text-muted">
				drag to orbit · scroll to zoom
			</p>
		</div>
	);
}

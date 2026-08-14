import { Preview } from '@ears/three';
import { useEffect, useRef } from 'react';

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

	// textures and meshes are rebuilt together, only when the derived skin actually changes
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

	return (
		<div className="relative h-full w-full">
			<canvas ref={canvasRef} className="h-full w-full cursor-grab active:cursor-grabbing" />
			{!derived ? (
				<div className="pointer-events-none absolute inset-0 grid place-content-center text-center text-muted">
					<p className="text-base">Drop a skin here</p>
					<p className="mt-1">or paste one, or use Import</p>
				</div>
			) : null}
			<p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] text-muted">
				drag to orbit · scroll to zoom
			</p>
		</div>
	);
}

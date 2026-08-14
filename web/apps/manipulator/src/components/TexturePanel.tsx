import { useEffect, useRef } from 'react';

import { Button } from './ui.js';

/**
 * Wing and cape textures. They live in Alfalfa rather than in the skin, so they are uploaded and
 * removed separately from everything else.
 */
export function TexturePanel({
	label,
	data,
	accept,
	onUpload,
	onRemove,
	hint,
}: {
	label: string;
	data: ImageData | null;
	accept: string;
	onUpload: (file: File) => void;
	onRemove: () => void;
	hint: string;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		canvas.width = 20;
		canvas.height = 16;
		ctx.clearRect(0, 0, 20, 16);
		if (data) {
			// a legacy 12x12 wing is drawn where Ears will put it, two pixels down
			const off = document.createElement('canvas');
			off.width = data.width;
			off.height = data.height;
			off.getContext('2d')?.putImageData(data, 0, 0);
			ctx.drawImage(off, 0, data.width === 12 ? 2 : 0);
		}
	}, [data]);

	return (
		<div className="flex items-center gap-3">
			<canvas
				ref={canvasRef}
				aria-label={`${label} preview`}
				className="pixelated h-16 w-20 shrink-0 rounded border border-edge bg-surface"
				style={{ imageRendering: 'pixelated' }}
			/>
			<div className="flex min-w-0 flex-col gap-1">
				<span className="flex gap-1">
					<Button onClick={() => inputRef.current?.click()}>{data ? 'Replace' : 'Upload'}</Button>
					<Button onClick={onRemove} disabled={!data} variant="ghost">
						Remove
					</Button>
				</span>
				<span className="text-[11px] text-muted">{hint}</span>
			</div>
			<input
				ref={inputRef}
				type="file"
				accept={accept}
				className="hidden"
				aria-label={`Upload ${label}`}
				onChange={(e) => {
					const file = e.target.files?.[0];
					if (file) onUpload(file);
					e.target.value = '';
				}}
			/>
		</div>
	);
}

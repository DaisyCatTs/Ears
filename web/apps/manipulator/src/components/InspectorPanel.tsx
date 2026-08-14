import { alfalfa as alfalfaCodec, type AlfalfaData, type PartialFeatures } from '@ears/protocol';
import { useEffect, useRef, useState } from 'react';

import type { Derived } from '../lib/derive.js';
import type { Notice } from '../lib/skin.js';
import { Section, Toggle } from './ui.js';

/**
 * Shows what the editor is actually writing into the skin — which regions carry data, what the
 * config block decodes to, and anything the format quietly changed.
 */
export function InspectorPanel({
	derived,
	features,
	alfalfa,
	notices,
}: {
	derived: Derived | null;
	features: PartialFeatures;
	alfalfa: AlfalfaData;
	notices: Notice[];
}) {
	const [showConfig, setShowConfig] = useState(true);
	const [showAlfalfa, setShowAlfalfa] = useState(true);
	const [showEmissive, setShowEmissive] = useState(true);

	return (
		<div className="flex h-full flex-col overflow-y-auto">
			<Section title="Skin data">
				<SkinMap derived={derived} showConfig={showConfig} showAlfalfa={showAlfalfa} showEmissive={showEmissive} />
				<div className="mt-1 flex flex-col gap-1">
					<Overlay color="#ffb347" label="Ears config block (0,32)" checked={showConfig} onChange={setShowConfig} />
					<Overlay color="#4ea1ff" label="Alfalfa regions (alpha)" checked={showAlfalfa} onChange={setShowAlfalfa} />
					<Overlay color="#ff5ecb" label="Emissive palette (52,32)" checked={showEmissive} onChange={setShowEmissive} />
				</div>
			</Section>

			{derived && derived.discrepancies.length > 0 ? (
				<Section title="Not stored as asked">
					{derived.discrepancies.map((d) => (
						<p key={d} className="rounded border border-amber-700/50 bg-amber-950/40 px-2 py-1.5 text-amber-200">
							{d}
						</p>
					))}
				</Section>
			) : null}

			<Section title="Import">
				{notices.length === 0 ? <p className="text-muted">Nothing loaded yet.</p> : null}
				{notices.map((n) => (
					<p key={n.message} className="flex gap-2">
						<span aria-hidden>{n.kind === 'ok' ? '✓' : n.kind === 'warn' ? '⚠' : '✕'}</span>
						<span>
							{n.message}
							{n.detail ? <span className="block text-[11px] text-muted">{n.detail}</span> : null}
						</span>
					</p>
				))}
			</Section>

			<Section title="Encoded as" aside={derived ? <code className="text-accent">{derived.format}</code> : null}>
				<dl className="grid grid-cols-2 gap-x-3 gap-y-1 tabular-nums">
					<Row k="Ears" v={`${features.earMode} / ${features.earAnchor ?? '—'}`} />
					<Row k="Protrusions" v={[features.claws && 'claws', features.horn && 'horn'].filter(Boolean).join(' + ') || 'none'} />
					<Row k="Tail" v={`${features.tailMode} ×${features.tailSegments}`} />
					<Row
						k="Bends"
						v={[features.tailBend0, features.tailBend1, features.tailBend2, features.tailBend3]
							.slice(0, features.tailSegments)
							.map((b) => `${Math.round(b)}°`)
							.join(', ')}
					/>
					<Row k="Snout" v={features.snoutWidth > 0 ? `${features.snoutWidth}×${features.snoutHeight}×${features.snoutDepth} +${features.snoutOffset}` : 'none'} />
					<Row k="Chest" v={`${Math.round(features.chestSize * 100)}%`} />
					<Row k="Wings" v={`${features.wingMode}${features.animateWings ? ' (animated)' : ''}`} />
					<Row k="Cape" v={features.capeEnabled ? 'on' : 'off'} />
					<Row k="Emissive" v={features.emissive ? 'on' : 'off'} />
				</dl>
			</Section>

			<Section title="Alfalfa" aside={<span className="text-muted">v{alfalfa.version}</span>}>
				{alfalfa.entries.size === 0 ? (
					<p className="text-muted">No entries. Wing and cape textures live here.</p>
				) : (
					[...alfalfa.entries].map(([key, value]) => (
						<div key={key} className="flex justify-between">
							<code>{key}</code>
							<span className="text-muted tabular-nums">{value.length} B</span>
						</div>
					))
				)}
				<p className="text-[11px] text-muted">
					{usedBytes(alfalfa)} of {alfalfaCodec.CAPACITY_BYTES} B used
				</p>
			</Section>
		</div>
	);
}

function usedBytes(alfalfa: AlfalfaData): number {
	try {
		return alfalfaCodec.serialize(alfalfa).length;
	} catch {
		return 0;
	}
}

function Row({ k, v }: { k: string; v: string }) {
	return (
		<>
			<dt className="text-muted">{k}</dt>
			<dd className="truncate" title={v}>
				{v}
			</dd>
		</>
	);
}

function Overlay({
	color,
	label,
	checked,
	onChange,
}: {
	color: string;
	label: string;
	checked: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<label className="flex items-center gap-2">
			<Toggle checked={checked} onChange={onChange} label={label} />
			<span className="inline-block size-2.5 rounded-sm" style={{ background: color }} aria-hidden />
			<span>{label}</span>
		</label>
	);
}

/** The skin at 4x with the data regions drawn over it. */
function SkinMap({
	derived,
	showConfig,
	showAlfalfa,
	showEmissive,
}: {
	derived: Derived | null;
	showConfig: boolean;
	showAlfalfa: boolean;
	showEmissive: boolean;
}) {
	const ref = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = ref.current;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const scale = 4;
		canvas.width = 64 * scale;
		canvas.height = 64 * scale;
		ctx.imageSmoothingEnabled = false;
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		if (derived) {
			const off = document.createElement('canvas');
			off.width = 64;
			off.height = 64;
			off.getContext('2d')?.putImageData(derived.skin, 0, 0);
			ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
		} else {
			ctx.fillStyle = 'rgba(255,255,255,0.04)';
			ctx.fillRect(0, 0, canvas.width, canvas.height);
		}

		if (showAlfalfa) {
			ctx.fillStyle = 'rgba(78,161,255,0.32)';
			for (const r of alfalfaCodec.ENCODE_REGIONS) {
				ctx.fillRect(r.x1 * scale, r.y1 * scale, (r.x2 - r.x1) * scale, (r.y2 - r.y1) * scale);
			}
		}
		if (showConfig) {
			ctx.fillStyle = 'rgba(255,179,71,0.55)';
			ctx.fillRect(0, 32 * scale, 4 * scale, 4 * scale);
		}
		if (showEmissive) {
			ctx.fillStyle = 'rgba(255,94,203,0.55)';
			ctx.fillRect(52 * scale, 32 * scale, 4 * scale, 4 * scale);
		}
	}, [derived, showConfig, showAlfalfa, showEmissive]);

	return <canvas ref={ref} className="pixelated w-full rounded border border-edge bg-surface" />;
}

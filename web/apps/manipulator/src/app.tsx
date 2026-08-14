import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ConfigPanel } from './components/ConfigPanel.js';
import { InspectorPanel } from './components/InspectorPanel.js';
import { PreviewPanel } from './components/PreviewPanel.js';
import { Button } from './components/ui.js';
import { derive } from './lib/derive.js';
import { decodeSkin, download, exportSkin } from './lib/skin.js';
import { useEditor } from './state/editor.js';

export function App() {
	const { state, actions, canUndo, canRedo, onKeyDown } = useEditor();
	const [error, setError] = useState<string | null>(null);
	const [exportProblems, setExportProblems] = useState<string[]>([]);
	const fileRef = useRef<HTMLInputElement>(null);

	const loadBytes = useCallback(
		(bytes: Uint8Array) => {
			try {
				actions.load(decodeSkin(bytes));
				setError(null);
				setExportProblems([]);
			} catch (e) {
				setError(e instanceof Error ? e.message : String(e));
			}
		},
		[actions],
	);

	const loadFile = useCallback(
		async (file: File) => {
			loadBytes(new Uint8Array(await file.arrayBuffer()));
		},
		[loadBytes],
	);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => onKeyDown(e);
		const onDrop = (e: DragEvent) => {
			e.preventDefault();
			const file = e.dataTransfer?.files?.[0];
			if (file) void loadFile(file);
		};
		const onDragOver = (e: DragEvent) => e.preventDefault();
		const onPaste = (e: ClipboardEvent) => {
			const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
			const file = item?.getAsFile();
			if (file) void loadFile(file);
		};
		window.addEventListener('keydown', onKey);
		window.addEventListener('drop', onDrop);
		window.addEventListener('dragover', onDragOver);
		window.addEventListener('paste', onPaste);
		return () => {
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('drop', onDrop);
			window.removeEventListener('dragover', onDragOver);
			window.removeEventListener('paste', onPaste);
		};
	}, [loadFile, onKeyDown]);

	const derived = useMemo(
		() => derive(state.original, state.features, state.alfalfa),
		[state.original, state.features, state.alfalfa],
	);

	const onExport = () => {
		if (!state.original) return;
		const result = exportSkin(state.original, state.features, state.alfalfa);
		setExportProblems(result.problems);
		// a skin that doesn't survive its own round trip is not something to hand someone
		if (result.problems.length === 0) {
			download(result.bytes, 'skin.png');
		}
	};

	return (
		<div className="flex h-full flex-col">
			<header className="flex items-center justify-between border-b border-edge bg-panel px-3 py-2">
				<div className="flex items-baseline gap-2">
					<h1 className="text-sm font-semibold">Ears Manipulator</h1>
					<span className="text-[11px] text-muted">everything stays in your browser</span>
				</div>
				<div className="flex items-center gap-1.5">
					<Button onClick={() => actions.undo()} disabled={!canUndo} title="Ctrl+Z">
						Undo
					</Button>
					<Button onClick={() => actions.redo()} disabled={!canRedo} title="Ctrl+Shift+Z">
						Redo
					</Button>
					<Button onClick={() => fileRef.current?.click()}>Import</Button>
					<Button variant="primary" onClick={onExport} disabled={!state.original}>
						Download skin
					</Button>
					<input
						ref={fileRef}
						type="file"
						accept="image/png"
						className="hidden"
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) void loadFile(file);
							e.target.value = '';
						}}
					/>
				</div>
			</header>

			{error ? (
				<p role="alert" className="border-b border-red-800 bg-red-950/60 px-3 py-2 text-red-200">
					{error}
				</p>
			) : null}
			{exportProblems.length > 0 ? (
				<div role="alert" className="border-b border-red-800 bg-red-950/60 px-3 py-2 text-red-200">
					<p className="font-medium">Export blocked — the skin did not read back correctly:</p>
					<ul className="ml-4 list-disc">
						{exportProblems.map((p) => (
							<li key={p}>{p}</li>
						))}
					</ul>
				</div>
			) : null}

			<main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_1fr_320px]">
				<aside className="min-h-0 border-edge lg:border-r">
					<ConfigPanel
						features={state.features}
						slim={state.slim}
						overlays={state.overlays}
						onPatch={actions.patch}
						onSlim={actions.setSlim}
						onToggleOverlay={actions.toggleOverlay}
						onReset={actions.resetEars}
						hasWing={state.alfalfa.entries.has('wing')}
						hasCape={state.alfalfa.entries.has('cape')}
					/>
				</aside>
				{/* stacked on narrow screens, where the grid gives it no height of its own */}
				<div className="min-h-[420px] bg-surface lg:min-h-0">
					<PreviewPanel derived={derived} slim={state.slim} overlays={state.overlays} />
				</div>
				<aside className="min-h-0 border-edge lg:border-l">
					<InspectorPanel
						derived={derived}
						features={state.features}
						alfalfa={state.alfalfa}
						notices={state.notices}
					/>
				</aside>
			</main>
		</div>
	);
}

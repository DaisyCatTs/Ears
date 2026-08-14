import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ConfigPanel } from './components/ConfigPanel.js';
import { InspectorPanel } from './components/InspectorPanel.js';
import { PreviewPanel } from './components/PreviewPanel.js';
import { Button } from './components/ui.js';
import { derive } from './lib/derive.js';
import { detectSlim } from './lib/profile.js';
import { buildSample } from './lib/sample.js';
import { decodeSkin, download, exportSkin } from './lib/skin.js';
import { prepareCape, prepareWing, withEntry, withoutEntry } from './lib/textures.js';
import { useEditor } from './state/editor.js';

export function App() {
	const { state, actions, canUndo, canRedo, onKeyDown } = useEditor();
	const [error, setError] = useState<string | null>(null);
	const [exportProblems, setExportProblems] = useState<string[]>([]);
	const [textureNotice, setTextureNotice] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [username, setUsername] = useState('');
	const [looking, setLooking] = useState(false);
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

	const onUploadTexture = useCallback(
		async (kind: 'wing' | 'cape', file: File) => {
			try {
				const bytes = new Uint8Array(await file.arrayBuffer());
				const { entry, notice } = kind === 'wing' ? prepareWing(bytes) : prepareCape(bytes);
				actions.setAlfalfa(withEntry(state.alfalfa, kind, entry));
				// uploading a texture is a statement of intent; turn the feature on with it
				if (kind === 'wing' && state.features.wingMode === 'NONE') {
					actions.patch({ wingMode: 'SYMMETRIC_DUAL' });
				}
				if (kind === 'cape' && !state.features.capeEnabled) actions.patch({ capeEnabled: true });
				setError(null);
				setTextureNotice(notice ?? null);
			} catch (e) {
				setError(e instanceof Error ? e.message : String(e));
			}
		},
		[actions, state.alfalfa, state.features.wingMode, state.features.capeEnabled],
	);

	const onRemoveTexture = useCallback(
		(kind: 'wing' | 'cape') => {
			actions.setAlfalfa(withoutEntry(state.alfalfa, kind));
			if (kind === 'wing') actions.patch({ wingMode: 'NONE' });
			else actions.patch({ capeEnabled: false });
			setTextureNotice(null);
		},
		[actions, state.alfalfa],
	);

	const onLookup = async () => {
		const name = username.trim();
		if (!name) return;
		if (!/^[A-Za-z0-9_]{1,16}$/.test(name)) {
			setError('Minecraft usernames are up to 16 letters, digits or underscores.');
			return;
		}
		setLooking(true);
		try {
			// crafthead.net, not Mojang: Mojang's API sends no CORS headers, so a browser cannot
			// call it, and it answers 403 to datacenter traffic so a proxy of our own does not help
			// either. This is the one part of the editor that talks to anyone — it sends the
			// username and nothing else, and never touches the skin you are editing.
			const res = await fetch(`https://crafthead.net/skin/${encodeURIComponent(name)}`);
			if (res.status === 404) {
				setError(`No player called "${name}".`);
				return;
			}
			if (!res.ok) {
				setError(`Could not load a skin for "${name}".`);
				return;
			}
			loadBytes(new Uint8Array(await res.arrayBuffer()));
			void detectSlim(name).then((slim) => {
				if (slim) actions.setSlim(true);
			});
		} catch {
			setError('Could not reach the skin lookup service.');
		} finally {
			setLooking(false);
		}
	};

	const onCopy = async () => {
		if (!state.original) return;
		const result = exportSkin(state.original, state.features, state.alfalfa);
		if (result.problems.length > 0) {
			setExportProblems(result.problems);
			return;
		}
		try {
			const blob = new Blob([result.bytes as unknown as BlobPart], { type: 'image/png' });
			await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			setError('Your browser would not let the page write to the clipboard.');
		}
	};

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
					<span className="flex items-center gap-1">
						<input
							type="text"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') void onLookup();
							}}
							placeholder="username"
							aria-label="Load a player's skin by username"
							className="w-28 rounded border border-edge bg-surface px-2 py-1 text-ink placeholder:text-muted"
						/>
						<Button onClick={() => void onLookup()} disabled={!username.trim() || looking}>
							{looking ? '…' : 'Load'}
						</Button>
					</span>
					<Button onClick={() => actions.load(decodeSkin(buildSample().bytes))} title="load a generated example">
						Sample
					</Button>
					<Button onClick={() => fileRef.current?.click()}>Import</Button>
					<Button onClick={() => void onCopy()} disabled={!state.original}>
						{copied ? 'Copied' : 'Copy'}
					</Button>
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

			{textureNotice ? (
				<p className="border-b border-edge bg-panel px-3 py-2 text-muted">{textureNotice}</p>
			) : null}
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
						wingTexture={derived?.wing ?? null}
						capeTexture={derived?.cape ?? null}
						onUploadTexture={(kind, file) => void onUploadTexture(kind, file)}
						onRemoveTexture={onRemoveTexture}
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

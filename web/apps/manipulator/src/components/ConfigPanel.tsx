import { EAR_ANCHORS, EAR_MODES, TAIL_MODES, WING_MODES, type PartialFeatures } from '@ears/protocol';

import { PRESETS, type Preset } from '../lib/presets.js';
import { TexturePanel } from './TexturePanel.js';
import { Button, Field, Section, Select, Slider, Toggle } from './ui.js';

export function ConfigPanel({
	features,
	slim,
	overlays,
	onPatch,
	onSlim,
	onToggleOverlay,
	onReset,
	hasWing,
	hasCape,
	wingTexture,
	capeTexture,
	onUploadTexture,
	onRemoveTexture,
	onPreset,
	onFluffier,
}: {
	features: PartialFeatures;
	slim: boolean;
	overlays: Record<string, boolean>;
	onPatch: (patch: Partial<PartialFeatures>) => void;
	onSlim: (slim: boolean) => void;
	onToggleOverlay: (part: string) => void;
	onReset: () => void;
	hasWing: boolean;
	hasCape: boolean;
	wingTexture: ImageData | null;
	capeTexture: ImageData | null;
	onUploadTexture: (kind: 'wing' | 'cape', file: File) => void;
	onRemoveTexture: (kind: 'wing' | 'cape') => void;
	onPreset: (preset: Preset) => void;
	onFluffier: () => void;
}) {
	const earsOn = features.earMode !== 'NONE';
	const tailOn = features.tailMode !== 'NONE';
	const snoutOn = features.snoutWidth > 0;

	return (
		<div className="flex flex-col lg:h-full lg:overflow-y-auto">
			<Section title="Presets">
				<div className="grid grid-cols-3 gap-1">
					{PRESETS.map((preset) => (
						<Button key={preset.name} onClick={() => onPreset(preset)} title={preset.description}>
							{preset.name}
						</Button>
					))}
				</div>
				<div className="flex items-center justify-between gap-2">
					<p className="text-[11px] text-muted">A starting point — all of it stays editable.</p>
					<Button onClick={onFluffier} title="crossed planes instead of flat ones, and a longer tail">
						Fluffier
					</Button>
				</div>
			</Section>

			<Section title="Model">
				<Field label="Slim arms" hint="Alex-style 3px arms">
					<Toggle checked={slim} onChange={onSlim} label="Slim arms" />
				</Field>
				<Field label="Second layer">
					<span className="flex gap-1">
						{['head', 'torso', 'left_arm', 'left_leg'].map((part) => (
							<Button
								key={part}
								variant={overlays[part] === false ? 'ghost' : 'default'}
								onClick={() => onToggleOverlay(part)}
								title={part}
							>
								{part === 'head' ? 'Hat' : part === 'torso' ? 'Jacket' : part === 'left_arm' ? 'Arms' : 'Legs'}
							</Button>
						))}
					</span>
				</Field>
			</Section>

			<Section title="Ears">
				<Field label="Mode">
					<Select value={features.earMode} options={EAR_MODES} onChange={(earMode) => onPatch({ earMode })} />
				</Field>
				<Field label="Anchor" hint={features.earMode === 'BEHIND' ? 'ignored for Behind' : undefined}>
					<Select
						value={features.earAnchor ?? 'CENTER'}
						options={EAR_ANCHORS}
						disabled={!earsOn || features.earMode === 'BEHIND'}
						onChange={(earAnchor) => onPatch({ earAnchor })}
					/>
				</Field>
				<Field label="Claws">
					<Toggle checked={features.claws} onChange={(claws) => onPatch({ claws })} label="Claws" />
				</Field>
				<Field label="Horn">
					<Toggle checked={features.horn} onChange={(horn) => onPatch({ horn })} label="Horn" />
				</Field>
			</Section>

			<Section title="Tail">
				<Field label="Mode">
					<Select value={features.tailMode} options={TAIL_MODES} onChange={(tailMode) => onPatch({ tailMode })} />
				</Field>
				<Field label="Segments">
					<Slider
						value={features.tailSegments}
						min={1}
						max={4}
						disabled={!tailOn}
						onChange={(tailSegments) => onPatch({ tailSegments })}
					/>
				</Field>
				{([0, 1, 2, 3] as const).map((i) => {
					const key = `tailBend${i}` as 'tailBend0' | 'tailBend1' | 'tailBend2' | 'tailBend3';
					return (
						<Field key={key} label={`Bend ${i}`}>
							<Slider
								value={features[key]}
								min={-90}
								max={90}
								step={1}
								disabled={!tailOn || features.tailSegments <= i}
								onChange={(v) => onPatch({ [key]: v } as Partial<PartialFeatures>)}
								format={(v) => `${Math.round(v)}°`}
							/>
						</Field>
					);
				})}
			</Section>

			<Section title="Snout">
				<Field label="Width" hint="0 turns the snout off">
					<Slider value={features.snoutWidth} min={0} max={7} onChange={(snoutWidth) => onPatch({ snoutWidth })} />
				</Field>
				<Field label="Height">
					<Slider
						value={features.snoutHeight}
						min={1}
						max={4}
						disabled={!snoutOn}
						onChange={(snoutHeight) => onPatch({ snoutHeight })}
					/>
				</Field>
				<Field label="Depth">
					<Slider
						value={features.snoutDepth}
						min={1}
						max={8}
						disabled={!snoutOn}
						onChange={(snoutDepth) => onPatch({ snoutDepth })}
					/>
				</Field>
				<Field label="Offset" hint="higher number sits higher on the face">
					<Slider
						value={features.snoutOffset}
						min={0}
						max={Math.max(0, 8 - features.snoutHeight)}
						disabled={!snoutOn}
						onChange={(snoutOffset) => onPatch({ snoutOffset })}
					/>
				</Field>
			</Section>

			<Section title="Wings">
				<Field label="Mode" hint={hasWing ? undefined : 'needs a wing texture'}>
					<Select value={features.wingMode} options={WING_MODES} onChange={(wingMode) => onPatch({ wingMode })} />
				</Field>
				<Field label="Animate">
					<Toggle
						checked={features.animateWings}
						disabled={features.wingMode === 'NONE'}
						onChange={(animateWings) => onPatch({ animateWings })}
						label="Animate wings"
					/>
				</Field>
				<TexturePanel
					label="wing texture"
					data={wingTexture}
					accept="image/png"
					hint="20x16, or a legacy 12x12"
					onUpload={(file) => onUploadTexture('wing', file)}
					onRemove={() => onRemoveTexture('wing')}
				/>
			</Section>

			<Section title="Other">
				<Field label="Chest" hint="the size of the chest bump">
					<Slider
						value={features.chestSize}
						min={0}
						max={1}
						step={1 / 31}
						onChange={(chestSize) => onPatch({ chestSize })}
						format={(v) => `${Math.round(v * 100)}%`}
					/>
				</Field>
				<Field label="Cape" hint={hasCape ? undefined : 'needs a cape texture'}>
					<Toggle
						checked={features.capeEnabled}
						onChange={(capeEnabled) => onPatch({ capeEnabled })}
						label="Cape"
					/>
				</Field>
				<TexturePanel
					label="cape texture"
					data={capeTexture}
					accept="image/png"
					hint="20x16, or a 64x32 Minecraft cape"
					onUpload={(file) => onUploadTexture('cape', file)}
					onRemove={() => onRemoveTexture('cape')}
				/>
				<Field label="Emissive" hint="glowing pixels, keyed by a palette at (52,32)">
					<Toggle checked={features.emissive} onChange={(emissive) => onPatch({ emissive })} label="Emissive" />
				</Field>
			</Section>

			<div className="p-3">
				<Button onClick={onReset}>Reset Ears data</Button>
			</div>
		</div>
	);
}

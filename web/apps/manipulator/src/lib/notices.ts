import type { PartialFeatures } from '@ears/protocol';

/**
 * Which Ears version each feature needs, and which older versions render it wrongly.
 *
 * The old manipulator did this as a 130-line if-chain that its own author labelled "a huge mess";
 * it is a table here so adding a feature means adding a row.
 */

export interface Compatibility {
	/** The version that added the feature, or fixed the bug. */
	version: string;
	kind: 'requires' | 'fixed';
	/** What happens on older clients. */
	consequence: string;
	applies: (f: PartialFeatures) => boolean;
}

export const COMPATIBILITY: Compatibility[] = [
	{
		version: '1.2.1',
		kind: 'requires',
		consequence: 'Cross ears will not render',
		applies: (f) => f.earMode === 'CROSS',
	},
	{
		version: '1.2.2',
		kind: 'requires',
		consequence: 'the first tail bend will be ignored',
		applies: (f) => f.tailMode !== 'NONE' && f.tailBend0 !== 0,
	},
	{
		version: '1.2.2',
		kind: 'fixed',
		consequence: 'Sides, Floppy and Behind ears had their back face texture swapped',
		applies: (f) => f.earMode === 'SIDES' || f.earMode === 'FLOPPY' || f.earMode === 'BEHIND',
	},
	{
		version: '1.2.3',
		kind: 'requires',
		consequence: 'Out ears will not render',
		applies: (f) => f.earMode === 'OUT',
	},
	{
		version: '1.2.3',
		kind: 'fixed',
		consequence: 'claws rendered a pixel off on the left arm of slim models',
		applies: (f) => f.claws,
	},
	{
		version: '1.2.4',
		kind: 'requires',
		consequence: 'Vertical tails will not render',
		applies: (f) => f.tailMode === 'VERTICAL',
	},
	{
		version: '1.3.0',
		kind: 'requires',
		consequence: 'snouts and chests will not render',
		applies: (f) => f.snoutWidth > 0 || f.chestSize > 0,
	},
	{
		version: '1.4.0',
		kind: 'requires',
		consequence: 'wings will not render',
		applies: (f) => f.wingMode !== 'NONE',
	},
	{
		version: '1.4.0',
		kind: 'fixed',
		consequence: 'chests rendered through chestplates, and feet claws through boots',
		applies: (f) => f.chestSize > 0 || f.claws,
	},
	{
		version: '1.4.1',
		kind: 'requires',
		consequence: 'Tall ears will not render, and wings always animate',
		applies: (f) => f.earMode === 'TALL' || f.earMode === 'TALL_CROSS' || !f.animateWings,
	},
	{
		version: '1.4.5',
		kind: 'requires',
		consequence: 'capes will not render',
		applies: (f) => f.capeEnabled,
	},
	{
		version: '1.4.7',
		kind: 'requires',
		consequence: 'Cross and Star tails, and Asymmetric Dual and Flat wings, will not render',
		applies: (f) =>
			f.tailMode === 'CROSS' ||
			f.tailMode === 'CROSS_OVERLAP' ||
			f.tailMode === 'STAR' ||
			f.tailMode === 'STAR_OVERLAP' ||
			f.wingMode === 'ASYMMETRIC_DUAL' ||
			f.wingMode === 'FLAT',
	},
];

export interface NoticeGroup {
	version: string;
	kind: 'requires' | 'fixed';
	consequences: string[];
}

/** Groups the matching rows by version, newest first. */
export function compatibilityFor(features: PartialFeatures): NoticeGroup[] {
	const groups = new Map<string, NoticeGroup>();
	for (const rule of COMPATIBILITY) {
		if (!rule.applies(features)) continue;
		const key = `${rule.version}:${rule.kind}`;
		const existing = groups.get(key);
		if (existing) existing.consequences.push(rule.consequence);
		else groups.set(key, { version: rule.version, kind: rule.kind, consequences: [rule.consequence] });
	}
	return [...groups.values()].sort((a, b) => compareVersions(b.version, a.version));
}

function compareVersions(a: string, b: string): number {
	const pa = a.split('.').map(Number);
	const pb = b.split('.').map(Number);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const d = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (d !== 0) return d;
	}
	return 0;
}

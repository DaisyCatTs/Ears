import type { AlfalfaData, PartialFeatures, SkinImage } from '@ears/protocol';
import { useCallback, useMemo, useReducer } from 'react';

import type { LoadedSkin, Notice } from '../lib/skin.js';

/**
 * Editor state.
 *
 * Configuration is treated as immutable, so undo/redo is a stack of snapshots rather than a pile of
 * inverse operations — cheap here, since the whole configuration is a couple of dozen fields.
 */

export interface EditorState {
	/** The skin being edited, with previous Ears data still in it. */
	image: SkinImage | null;
	/** The skin as imported, before emissive extraction — what export writes into. */
	original: SkinImage | null;
	features: PartialFeatures;
	alfalfa: AlfalfaData;
	slim: boolean;
	overlays: Record<string, boolean>;
	notices: Notice[];
	past: Snapshot[];
	future: Snapshot[];
}

interface Snapshot {
	features: PartialFeatures;
	alfalfa: AlfalfaData;
}

export const EMPTY_FEATURES: PartialFeatures = {
	earMode: 'NONE',
	earAnchor: 'CENTER',
	claws: false,
	horn: false,
	tailMode: 'NONE',
	tailSegments: 1,
	tailBend0: 0,
	tailBend1: 0,
	tailBend2: 0,
	tailBend3: 0,
	snoutOffset: 0,
	snoutWidth: 0,
	snoutHeight: 0,
	snoutDepth: 0,
	chestSize: 0,
	wingMode: 'NONE',
	animateWings: true,
	capeEnabled: false,
	emissive: false,
};

const EMPTY_ALFALFA: AlfalfaData = { version: 0, entries: new Map() };

export const INITIAL_STATE: EditorState = {
	image: null,
	original: null,
	features: EMPTY_FEATURES,
	alfalfa: EMPTY_ALFALFA,
	slim: false,
	overlays: { head: true, torso: true, right_arm: true, left_arm: true, right_leg: true, left_leg: true },
	notices: [],
	past: [],
	future: [],
};

type Action =
	| { type: 'load'; skin: LoadedSkin }
	| { type: 'patch'; patch: Partial<PartialFeatures> }
	| { type: 'setAlfalfa'; alfalfa: AlfalfaData }
	| { type: 'setSlim'; slim: boolean }
	| { type: 'toggleOverlay'; part: string }
	| { type: 'resetEars' }
	| { type: 'undo' }
	| { type: 'redo' };

function snapshot(state: EditorState): Snapshot {
	return { features: state.features, alfalfa: state.alfalfa };
}

function reducer(state: EditorState, action: Action): EditorState {
	switch (action.type) {
		case 'load': {
			const { features, alfalfa } = action.skin;
			const { enabled: _e, emissiveSkin: _s, emissiveWing: _w, alfalfa: _a, ...rest } = features;
			return {
				...state,
				image: action.skin.image,
				original: action.skin.original,
				features: features.enabled ? { ...rest, earAnchor: rest.earAnchor ?? 'CENTER' } : EMPTY_FEATURES,
				alfalfa,
				notices: action.skin.notices,
				past: [],
				future: [],
			};
		}
		case 'patch':
			return {
				...state,
				features: { ...state.features, ...action.patch },
				past: [...state.past, snapshot(state)].slice(-100),
				future: [],
			};
		case 'setAlfalfa':
			return {
				...state,
				alfalfa: action.alfalfa,
				past: [...state.past, snapshot(state)].slice(-100),
				future: [],
			};
		case 'setSlim':
			return { ...state, slim: action.slim };
		case 'toggleOverlay':
			return {
				...state,
				overlays: { ...state.overlays, [action.part]: !state.overlays[action.part] },
			};
		case 'resetEars':
			return {
				...state,
				features: EMPTY_FEATURES,
				alfalfa: EMPTY_ALFALFA,
				past: [...state.past, snapshot(state)].slice(-100),
				future: [],
			};
		case 'undo': {
			const prev = state.past.at(-1);
			if (!prev) return state;
			return {
				...state,
				...prev,
				past: state.past.slice(0, -1),
				future: [snapshot(state), ...state.future].slice(0, 100),
			};
		}
		case 'redo': {
			const next = state.future[0];
			if (!next) return state;
			return {
				...state,
				...next,
				past: [...state.past, snapshot(state)].slice(-100),
				future: state.future.slice(1),
			};
		}
	}
}

export function useEditor() {
	const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

	const actions = useMemo(
		() => ({
			load: (skin: LoadedSkin) => dispatch({ type: 'load', skin }),
			patch: (patch: Partial<PartialFeatures>) => dispatch({ type: 'patch', patch }),
			setAlfalfa: (alfalfa: AlfalfaData) => dispatch({ type: 'setAlfalfa', alfalfa }),
			setSlim: (slim: boolean) => dispatch({ type: 'setSlim', slim }),
			toggleOverlay: (part: string) => dispatch({ type: 'toggleOverlay', part }),
			resetEars: () => dispatch({ type: 'resetEars' }),
			undo: () => dispatch({ type: 'undo' }),
			redo: () => dispatch({ type: 'redo' }),
		}),
		[],
	);

	const canUndo = state.past.length > 0;
	const canRedo = state.future.length > 0;

	const onKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (!(e.ctrlKey || e.metaKey)) return;
			if (e.key.toLowerCase() !== 'z') return;
			e.preventDefault();
			if (e.shiftKey) actions.redo();
			else actions.undo();
		},
		[actions],
	);

	return { state, actions, canUndo, canRedo, onKeyDown };
}

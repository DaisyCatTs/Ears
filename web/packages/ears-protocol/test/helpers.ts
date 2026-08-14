import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** web/packages/ears-protocol/test -> repo root */
export const REPO_ROOT = join(here, '..', '..', '..', '..');
export const FIXTURES_DIR = join(REPO_ROOT, 'tests', 'fixtures');

export interface FixtureEntry {
	name: string;
	format: 'v1' | 'v0' | 'raw';
	hasConfig: boolean;
	quads: number;
	reencode: 'stable' | 'known-unstable' | 'n/a';
	/** Whether Java re-encoding its own decode reproduces the original config block byte for byte. */
	reencodeBytes: 'stable' | 'differs' | 'n/a';
	reencodeNote?: string;
}

export interface FixtureIndex {
	generator: string;
	earsVersion: string;
	fixtures: FixtureEntry[];
}

export function loadFixtureIndex(): FixtureIndex {
	return JSON.parse(readFileSync(join(FIXTURES_DIR, 'index.json'), 'utf8')) as FixtureIndex;
}

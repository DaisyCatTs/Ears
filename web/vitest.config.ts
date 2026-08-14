import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// apps/ too: leaving it out meant the editor's own logic — presets, auto-texturing — had no
		// tests at all and nobody noticed, because the suite still reported green
		include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'],
		environment: 'node',
	},
});

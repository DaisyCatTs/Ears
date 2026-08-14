/**
 * End-to-end smoke test: load the app, import a real fixture skin, check the preview and inspector
 * come up, and export.
 *
 * Run against a dev server:  bun run dev   (in another terminal)
 *                            node apps/manipulator/e2e/smoke.mjs
 *
 * Deliberately plain Playwright rather than a test runner — it is the one check that needs a real
 * browser, and it doubles as the screenshot tool while the UI is being built.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..', '..');
const outDir = join(here, 'screenshots');
const url = process.env.APP_URL ?? 'http://localhost:5273/';
const fixture = process.env.FIXTURE ?? join(repoRoot, 'tests', 'fixtures', 'everything', 'skin.png');

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on('console', (msg) => {
	if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));

let failed = false;
const check = (ok, what) => {
	console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}`);
	if (!ok) failed = true;
};

await page.goto(url, { waitUntil: 'networkidle' });
await page.screenshot({ path: join(outDir, '1-empty.png') });

check(await page.getByRole('heading', { name: 'Ears Manipulator' }).isVisible(), 'app shell renders');
check(await page.getByText('Drop a skin here').isVisible(), 'empty state shown');

// import a skin the Java oracle produced, so the preview is showing real data
await page.setInputFiles('input[type=file]', fixture);
await page.waitForTimeout(700);
await page.screenshot({ path: join(outDir, '2-loaded.png') });

const inspector = page.locator('aside').last();
check(await inspector.getByText('Ears data detected', { exact: false }).isVisible(), 'ears data detected');
check(await inspector.getByText('Alfalfa v1', { exact: false }).isVisible(), 'alfalfa reported');

// the config panel should reflect what was in the skin
const earMode = page.locator('select').first();
check((await earMode.inputValue()) === 'AROUND', `ear mode read back (got ${await earMode.inputValue()})`);

// change something and confirm the preview rebuilds without errors
await earMode.selectOption('TALL');
await page.waitForTimeout(400);
await page.screenshot({ path: join(outDir, '3-edited.png') });
check((await earMode.inputValue()) === 'TALL', 'ear mode edit applied');

// undo should put it back
await page.getByRole('button', { name: 'Undo' }).click();
await page.waitForTimeout(300);
check((await earMode.inputValue()) === 'AROUND', 'undo restores previous value');

// export
const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
await page.getByRole('button', { name: 'Download skin' }).click();
const download = await downloadPromise;
check(download !== null, 'export produces a download');

check(errors.length === 0, `no console errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);

await browser.close();
console.log(failed ? '\nSMOKE FAILED' : '\nSMOKE PASSED');
process.exit(failed ? 1 : 0);

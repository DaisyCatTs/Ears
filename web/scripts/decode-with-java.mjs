/**
 * Runs the Java decoder over the TypeScript-encoded fixtures.
 *
 * Separate from the Gradle build because the web side is what invokes it; the wrapper lives in
 * common/, which is its own Gradle build.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const commonDir = join(here, '..', '..', 'common');
// an absolute path, because a bare `gradlew.bat` is not resolved from cwd on Windows
const wrapper = join(commonDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');

const result = spawnSync(wrapper, ['decodeTsFixtures', '-q'], {
	cwd: commonDir,
	stdio: 'inherit',
	shell: process.platform === 'win32',
});

if (result.error) {
	console.error(`Could not run ${wrapper} in ${commonDir}:`, result.error.message);
	process.exit(1);
}
process.exit(result.status ?? 1);

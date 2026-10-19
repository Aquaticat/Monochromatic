import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

//region Original SDK cancellation must finish without observation shutdown errors.
/**
 Bound captured child output while retaining complete cancellation diagnostics.
 */
const maximumOutputBytes = 8_388_608;
/**
 Resolve this fixture's package rather than the caller's working directory.
 */
const cwd = fileURLToPath(new URL('..', import.meta.url));

for (const mode of ['stop', 'cancel']) {
  const result = spawnSync(process.execPath, [
    '--import', './dist/native/loader.mjs',
    'src/native-decision-fallback.test.mjs', mode,
  ], {cwd, encoding: 'utf8', maxBuffer: maximumOutputBytes});
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.signal, null);
  const lines = result.stdout.trim().split('\n');
  const summary = JSON.parse(lines.at(-1));
  assert.equal(summary.complete, true);
  assert.equal(summary.mode, mode);
  assert.equal(summary.executions, 0);
  assert.equal(summary.selections, 1);
  assert.equal(result.stderr, '', `Original SDK ${mode} must not emit shutdown errors`);
  console.log(JSON.stringify({mode, complete: true, cleanStderr: true}));
}
//endregion Original SDK cancellation behavior and complete stderr are both asserted.

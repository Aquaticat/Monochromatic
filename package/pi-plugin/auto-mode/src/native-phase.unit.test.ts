/** Verify real native session receipts and their complete lifecycle stderr. @module */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { describe, it } from '@monochromatic-dev/module-test/ts';

//region A bounded child owns each disposable native session and every issued subprocess.
/** Native fixture execution retains output until the entire process, including cleanup, exits. */
const run = promisify(execFile);
/** Built modules and the maintained consumer fixture share the package root. */
const root = dirname(import.meta.dirname);
/** These modes cover native phase branches and distinguish custom data from changed instructions. */
const modes = [
  'parallel', 'sequential', 'implicit-sequential', 'invalid', 'before-block', 'tool-error',
  'deny', 'cancel', 'notification-context', 'notification-turn', 'notification-followup',
  'notification-primary', 'notification-primary-turn', 'notification-primary-followup',
  'steer-user', 'steer-primary', 'policy-change', 'policy-primary',
  'child-normal', 'child-before-block', 'child-unsealed', 'child-cancel',
] as const;
/** A focused task selects the same maintained suite without a second fixture implementation. */
const requested = process.argv[2];
if (requested !== undefined && !modes.some(mode => mode === requested))
  throw new Error(`Unknown native phase fixture mode: ${requested}`);

await describe({
  name: 'native group lifecycle',
  concurrency: 1,
  children: modes.filter(mode => requested === undefined || mode === requested).map(function nativeMode(mode) {
    return it({ name: mode, timeout: 125_000, fn: async function lifecycle() {
      /** The child limit bounds an implementation that hangs during native cleanup. */
      const result = await run(process.execPath, [
        '--max-old-space-size=512', '--import', join(root, 'dist/native/loader.mjs'),
        ...(mode.startsWith('child-')
          ? [join(root, 'src/native-child-phase.test.mjs'), 'permission', '--require-resolution', '--sdk-stream',
            '--http-transport', '--operating-policy', `--child-phase=${mode.slice('child-'.length)}`]
          : [join(root, 'src/native-phase.test.mjs'), mode]),
      ], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 120_000 });
      assert.equal(result.stderr.includes('context canceled'), false, result.stderr);
      assert.equal(result.stderr.includes('context cancelled'), false, result.stderr);
      /** Native errors are tested inside the child; the receipt follows all behavioral assertions. */
      const receipts = result.stdout.split('\n').filter(line => line.startsWith('{"complete":true,"mode":'));
      assert.equal(receipts.length, 1, result.stdout);
      /** Parsing retained output tests the actual consumer rather than a shadow implementation. */
      const receipt: unknown = JSON.parse(receipts[0] ?? 'null');
      assert.ok(typeof receipt === 'object' && receipt !== null && 'mode' in receipt && 'complete' in receipt);
      assert.equal(receipt.mode, mode);
      assert.equal(receipt.complete, true);
    } });
  }),
});
//endregion

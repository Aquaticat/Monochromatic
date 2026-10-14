/**
 Verify the built native CLI fixture retains its network blocker across Pi dispatcher setup.

 @module
 */
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';
import spawn, { SubprocessError } from 'nano-spawn';

//region Separate child processes isolate dispatcher globals from the test harness.

/** Bound a child that does not reach its terminal assertion. */
const CHILD_DEADLINE_MS = 10_000;

/** Resolve the maintained native fixture from the package's built artifact. */
const guard = new URL('../dist/native/contract/integration/native-host/process-network-guard.ts', import.meta.url);

/** Exercise the exact dispatcher imported by the built CLI. */
const dispatcher = new URL('../dist/native/pi/coding-agent/dist/core/http-dispatcher.js', import.meta.url);

/** Run from the package independently of the task caller's working directory. */
const cwd = fileURLToPath(new URL('..', import.meta.url));

/**
 The identity assertion runs before fetch; the data URL cannot contact an external service even without the blocker.
 */
const dispatcherProbe = `
import assert from 'node:assert/strict';
const guardedFetch = globalThis.fetch;
const { configureHttpDispatcher } = await import(${JSON.stringify(dispatcher.href)});
configureHttpDispatcher();
assert.equal(globalThis.fetch, guardedFetch, 'Pi replaced the CLI fixture network blocker');
configureHttpDispatcher();
assert.equal(globalThis.fetch, guardedFetch, 'Pi replaced the blocker during reconfiguration');
let rejection;
try { await fetch('data:text/plain,network-guard-control'); }
catch (error) { rejection = error; }
assert.ok(rejection instanceof Error);
assert.equal(rejection.message, 'External fetch is disabled in the native CLI process fixture');
console.log('native fixture network blocker retained');
`;

//endregion

await describe({
  name: '',
  children: [
    it({
      name: 'retains the fixture blocker through initial and repeated native dispatcher configuration',
      fn: async function retainsFixtureBlocker() {
        const result = await spawn(process.execPath, [
          '--import', guard.href, '--input-type=module', '--eval', dispatcherProbe,
        ], {
          cwd,
          env: { PI_AUTO_MODE_CLI_FIXTURE_CHILD: '1' },
          signal: AbortSignal.timeout(CHILD_DEADLINE_MS),
        });
        expect(result.stdout).toBe('native fixture network blocker retained');
        expect(result.stderr).toBe('');
      },
    }),
    it({
      name: 'refuses to install the fixture blocker outside its isolated child',
      fn: async function rejectsNonFixtureChild() {
        let failure: unknown;
        try {
          await spawn(process.execPath, [
            '--import', guard.href, '--input-type=module', '--eval', 'throw new Error("Unexpected fixture entry");',
          ], {
            cwd,
            env: { PI_AUTO_MODE_CLI_FIXTURE_CHILD: '0' },
            signal: AbortSignal.timeout(CHILD_DEADLINE_MS),
          });
        }
        catch (error) {
          failure = error;
        }
        expect(failure).toBeInstanceOf(SubprocessError);
        if (!(failure instanceof SubprocessError)) throw failure;
        expect(failure.stderr).toContain('Native CLI fixture network guard requires its isolated child process');
        expect(failure.stderr).not.toContain('Unexpected fixture entry');
      },
    }),
  ],
});

/**
 Verify the built native CLI fixture retains its network blocker across Pi dispatcher setup.

 @module
 */
import { fail } from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
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
        /** Private agent scratch root beneath the runtime home directory. */
        const scratch = join(homedir(), 'temp/agent');
        await mkdir(scratch, { recursive: true, mode: 0o700 });
        await chmod(scratch, 0o700);
        /** Disposable directory holding the guard's private request receipt. */
        const receiptDir = await mkdtemp(join(scratch, 'native-cli-network-guard-'));
        await using _receiptCleanup = {
          async [Symbol.asyncDispose]() {
            await rm(receiptDir, { recursive: true, force: true });
          }
        };
        const result = await spawn(process.execPath, [
          '--import', guard.href, '--input-type=module', '--eval', dispatcherProbe,
        ], {
          cwd,
          env: {
            PI_AUTO_MODE_CLI_FIXTURE_CHILD: '1',
            PI_AUTO_MODE_CLI_FIXTURE_REQUESTS: join(receiptDir, 'requests.jsonl'),
          },
          signal: AbortSignal.timeout(CHILD_DEADLINE_MS),
        });
        expect(result.stdout).toBe('native fixture network blocker retained');
        expect(result.stderr).toBe('');
      },
    }),
    it({
      name: 'refuses to install the fixture blocker outside its isolated child',
      fn: async function rejectsNonFixtureChild() {
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
          expect(error).toBeInstanceOf(SubprocessError);
          if (!(error instanceof SubprocessError)) throw error;
          expect(error.stderr).toContain('Native CLI fixture network guard requires its isolated child process');
          expect(error.stderr).not.toContain('Unexpected fixture entry');
          return;
        }
        fail('The native CLI fixture guard accepted an unmarked process');
      },
    }),
    it({
      name: 'refuses to install the fixture blocker without its disposable request receipt path',
      fn: async function rejectsMissingReceiptPath() {
        /**
         Assert the guard stops at setup for a child run with the supplied fixture environment.

         @param specificEnvironment - fixture overrides defining the refused setup boundary
         */
        async function expectReceiptPathRejection(specificEnvironment: Record<string, string>) {
          try {
            await spawn(process.execPath, [
              '--import', guard.href, '--input-type=module', '--eval', 'throw new Error("Unexpected fixture entry");',
            ], {
              cwd,
              env: {
                PI_AUTO_MODE_CLI_FIXTURE_REQUESTS: undefined,
                ...specificEnvironment
              },
              signal: AbortSignal.timeout(CHILD_DEADLINE_MS),
            });
          }
          catch (error) {
            expect(error).toBeInstanceOf(SubprocessError);
            if (!(error instanceof SubprocessError)) throw error;
            expect(error.stderr).toContain('Native CLI fixture requires its disposable request receipt path');
            expect(error.stderr).not.toContain('Unexpected fixture entry');
            return;
          }
          fail('The native CLI fixture guard accepted a child without its request receipt path');
        }
        await expectReceiptPathRejection({ PI_AUTO_MODE_CLI_FIXTURE_CHILD: '1' });
        await expectReceiptPathRejection({
          PI_AUTO_MODE_CLI_FIXTURE_CHILD: '1',
          PI_AUTO_MODE_CLI_FIXTURE_REQUESTS: ''
        });
      },
    }),
  ],
});

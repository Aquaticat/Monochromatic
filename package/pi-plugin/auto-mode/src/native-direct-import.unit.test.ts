/**
 Fresh processes exercise generated entry points without a policy preload.

 @module
 */
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';
import spawn from 'nano-spawn';

//region Each import order starts with an empty native module cache.

/** Package directory fixes loader resolution independently of the invoking task. */
const cwd = fileURLToPath(new URL('..', import.meta.url));
/** Loader selects the same generated graph used by the installed native command. */
const loader = new URL('../dist/native/loader.mjs', import.meta.url);

await describe({
  name: '',
  concurrency: 1,
  children: ['session-manager.mjs', 'sdk.mjs'].map(function firstEntry(filename) {
    return it({
      name: `imports ${filename} before policy and constructs an original in-memory manager`,
      fn: async function importGeneratedEntry() {
        /** Literal encoding prevents the selected file URL from changing executable syntax. */
        const entry = new URL(`../dist/native/contract/integration/native-batch/generated/${filename}`, import.meta.url);
        /** The first import must finish before the host or another generated entry is requested. */
        const probe = `
import assert from 'node:assert/strict';
const first = await import(${JSON.stringify(entry.href)});
assert.equal(typeof first.${filename === 'sdk.mjs' ? 'createAgentSession' : 'SessionManager'}, 'function');
const { ownedManagers } = await import('./dist/native/contract/integration/native-host/bootstrap.ts');
const manager = ownedManagers.inMemory(process.cwd());
assert.equal(manager.getCwd(), process.cwd());
assert.deepEqual(manager.getEntries(), []);
assert.equal(manager.isPersisted(), false);
console.log('direct native import and owned manager construction completed');
`;
        /** Child completion proves initialization and construction, while stderr detects shutdown noise. */
        const result = await spawn(process.execPath, [
          '--max-old-space-size=512', '--import', loader.href,
          '--input-type=module', '--eval', probe,
        ], { cwd, signal: AbortSignal.timeout(30_000) });
        expect(result.stdout).toBe('direct native import and owned manager construction completed');
        expect(result.stderr).toBe('');
      },
      timeout: 35_000,
    });
  }),
});

//endregion

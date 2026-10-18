/** Verify immutable file reuse across actual mount boundaries. @module */
import { strict as assert } from 'node:assert';
import { cp, link, mkdir, mkdtemp, readFile, readdir, realpath, stat, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import spawn from 'nano-spawn';
import { describe, it } from '@monochromatic-dev/module-test/ts';

//region The shipped build command receives disposable installations on distinct mounts.
/**
 Invoke the actual command and retain complete output beside the fixture.

 @param packageRoot - disposable installation owning generated release paths

 @returns complete build report

 @example
 ```ts
 const report = await buildRelease(packageRoot);
 ```
 */
async function buildRelease(packageRoot: string): Promise<string> {
  /** Generation and CLI loading share the package task's bounded heap. */
  const result = await spawn(process.execPath, [join(packageRoot, 'native/build.ts'), '--owned'], {
    cwd: packageRoot,
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' },
  });
  await writeFile(join(packageRoot, 'last-build.stdout'), result.stdout);
  await writeFile(join(packageRoot, 'last-build.stderr'), result.stderr);
  return result.stdout;
}

/** Previous-file mount owned exclusively by the outer platform fixture. */
const [, , previousMount, outputMount] = process.argv;
assert.equal(typeof previousMount, 'string');
assert.equal(typeof outputMount, 'string');
assert.notEqual(previousMount, undefined);
assert.notEqual(outputMount, undefined);
/** Previous fixture remains outside the output mount even when device identifiers agree. */
const previous = await mkdtemp(join(previousMount, 'reuse-prior-'));
/** New fixture never replaces a real installation or another session's files. */
const packageRoot = await mkdtemp(join(outputMount, 'reuse-package-'));
/** Maintained command and emitted graph supply the real build inputs. */
const original = dirname(import.meta.dirname);
await cp(join(original, 'native'), join(packageRoot, 'native'), { recursive: true });
await cp(join(original, 'package.json'), join(packageRoot, 'package.json'));
await mkdir(join(packageRoot, 'dist'), { recursive: true });
await cp(join(original, 'dist/final'), join(packageRoot, 'dist/final'), { recursive: true });
await cp(await realpath(join(original, 'dist/native')), previous, { recursive: true });
await symlink(join(original, 'node_modules'), join(packageRoot, 'node_modules'), 'dir');
await symlink(join(original, '../../../node_modules'), join(outputMount, 'node_modules'), 'dir');
await symlink(previous, join(packageRoot, 'dist/native'), 'dir');

await describe({
  name: 'native build reuse across actual mounts',
  children: [
    it({
      name: 'publishes intact output across equal-device EXDEV and shares same-mount files',
      timeout: 120_000,
      fn: async function publishAcrossMounts() {
        /** Unchanged license bytes establish an eligible sharing candidate. */
        const license = await readFile(join(previous, 'PI-LICENSE.txt'));
        /** Direct control proves this fixture reaches the refused-link boundary. */
        const control = join(packageRoot, 'cross-mount-control');
        await writeFile(control, license);
        assert.equal((await stat(control)).dev, (await stat(join(previous, 'PI-LICENSE.txt'))).dev);
        await assert.rejects(link(join(previous, 'PI-LICENSE.txt'), join(packageRoot, 'refused-link')), { code: 'EXDEV' });
        /** Actual CLI verification must finish despite unavailable storage sharing. */
        const firstReport = await buildRelease(packageRoot);
        assert.ok(firstReport.includes('"reused":{"files":0,"bytes":0}'));
        /** Publication owns a new graph instead of mutating the previous mounted release. */
        const first = await realpath(join(packageRoot, 'dist/native'));
        assert.notEqual(first, previous);
        assert.deepEqual(await readFile(join(first, 'PI-LICENSE.txt')), license);
        assert.deepEqual(await readFile(join(previous, 'PI-LICENSE.txt')), license);
        assert.notEqual((await stat(join(first, 'PI-LICENSE.txt'))).ino, (await stat(join(previous, 'PI-LICENSE.txt'))).ino);
        assert.equal((await readdir(first, { recursive: true })).some(path => path.endsWith('.shared')), false);
        await buildRelease(packageRoot);
        /** Successive releases on one mount must still share eligible immutable storage. */
        const second = await realpath(join(packageRoot, 'dist/native'));
        assert.notEqual(second, first);
        assert.equal((await stat(join(second, 'PI-LICENSE.txt'))).ino, (await stat(join(first, 'PI-LICENSE.txt'))).ino);
        assert.deepEqual(await readFile(join(previous, 'PI-LICENSE.txt')), license);
      },
    }),
  ],
});
//endregion Actual mount-boundary and successful-sharing controls

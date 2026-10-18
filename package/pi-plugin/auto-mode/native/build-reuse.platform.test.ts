/** Verify immutable file reuse across actual mount boundaries. @module */
import { strict as assert } from 'node:assert';
import { chmod, cp, link, lstat, mkdir, mkdtemp, open, readFile, readdir, readlink, realpath, stat, symlink, writeFile } from 'node:fs/promises';
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
  /** Every invocation retains its complete bytes, including a failed child's final newline. */
  const output = await mkdtemp(join(packageRoot, 'build-output-'));
  /** File descriptors receive bytes directly before the subprocess can exit or throw. */
  await using stdout = await open(join(output, 'stdout'), 'wx', 0o600);
  /** Independent stderr remains available after failures and subsequent builds. */
  await using stderr = await open(join(output, 'stderr'), 'wx', 0o600);
  /** Generation and CLI loading share the package task's bounded heap. */
  await spawn(process.execPath, [join(packageRoot, 'native/build.ts'), '--owned'], {
    cwd: packageRoot,
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' },
    stdout: stdout.fd,
    stderr: stderr.fd,
  });
  return await readFile(join(output, 'stdout'), 'utf8');
}

/**
 Require the outer platform fixture's exact mount argument before touching the filesystem.

 @param value - original process argument candidate
 */
function assertMountArgument(value: unknown): asserts value is string {
  assert.equal(typeof value, 'string');
  assert.notEqual(value, undefined);
}

/** Process invocation keeps node and script identity out of the mount arguments. */
const [, ...invocation] = process.argv;
/** Previous-file mount owned exclusively by the outer platform fixture. */
const [, previousMount, outputMount] = invocation;
assertMountArgument(previousMount);
assertMountArgument(outputMount);
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
      name: 'publishes across EXDEV, shares same-mount files and leaves external directory symlinks unread',
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
        /** Borrowed directory contents are not owned build inputs or sharing candidates. */
        const external = await mkdtemp(join(previousMount, 'reuse-external-'));
        await writeFile(join(external, 'private.txt'), 'External contents must remain unread');
        /** The maintained command copies this opaque link alongside its ordinary contract files. */
        const relativeLink = 'contract/reuse-external-symlink';
        await symlink(external, join(packageRoot, 'native', relativeLink), 'dir');
        /** Restore only this disposable directory's permissions even when the child rejects. */
        await using permissionRestoration = {
          async [Symbol.asyncDispose]() {
            await chmod(external, 0o700);
          },
        };
        await chmod(external, 0o000);
        /** Positive control proves that following this link would fail instead of passing silently. */
        await assert.rejects(readdir(external), { code: 'EACCES' });
        await buildRelease(packageRoot);
        /** Publication retains the opaque link while ordinary same-mount storage sharing still works. */
        const third = await realpath(join(packageRoot, 'dist/native'));
        assert.equal((await lstat(join(third, relativeLink))).isSymbolicLink(), true);
        assert.equal(await readlink(join(third, relativeLink)), external);
        assert.equal((await stat(join(third, 'PI-LICENSE.txt'))).ino, (await stat(join(second, 'PI-LICENSE.txt'))).ino);
      },
    }),
  ],
});
//endregion Actual mount-boundary and successful-sharing controls

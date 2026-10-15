/** Verify the build command against a disposable installation. @module */
import { cp, mkdir, mkdtemp, readFile, realpath, symlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import spawn from 'nano-spawn';
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';

//region Failed generation or loading must preserve the consumer's previous command.
/** Native build scripts are invoked exactly as the package task invokes them. */
async function build(packageRoot: string): Promise<void> {
  await spawn(process.execPath, [join(packageRoot, 'native/build.ts'), '--owned'], {
    cwd: packageRoot,
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' },
  });
}

/** Failed child output remains available for an exact diagnostic assertion. */
async function rejectedBuild(packageRoot: string): Promise<string> {
  try {
    await build(packageRoot);
  }
  catch (error) {
    return String(error);
  }
  throw new Error('The deliberately invalid native release was activated');
}

/** The CLI loads the generated graph before reporting its version. */
async function version(packageRoot: string): Promise<string> {
  const result = await spawn(process.execPath, [join(packageRoot, 'dist/native/cli.mjs'), '--version'], {
    cwd: packageRoot,
  });
  return result.stdout.trim();
}

await describe({ name: 'native release publication', children: [it({
  name: 'preserves directory and link installations after generation or loading fails',
  timeout: 120_000,
  fn: async function publishedRelease() {
    const original = dirname(import.meta.dirname);
    const scratch = join(homedir(), 'temp/agent');
    await mkdir(scratch, { recursive: true, mode: 0o700 });
    const fixture = await mkdtemp(join(scratch, 'pi-native-build-'));
    const packageRoot = join(fixture, 'package');
    await mkdir(join(packageRoot, 'dist/final'), { recursive: true });
    await cp(join(original, 'native'), join(packageRoot, 'native'), { recursive: true });
    await cp(join(original, 'package.json'), join(packageRoot, 'package.json'));
    await cp(await realpath(join(original, 'dist/native')), join(packageRoot, 'dist/native'), { recursive: true });
    await cp(join(original, 'dist/final/node'), join(packageRoot, 'dist/final/node'), { recursive: true });
    await symlink(join(original, 'node_modules'), join(packageRoot, 'node_modules'), 'dir');
    await symlink(join(original, '../../../node_modules'), join(fixture, 'node_modules'), 'dir');
    const active = join(packageRoot, 'dist/native');
    // Generated imports name their release directory, so qualify the copied fixture at its new location.
    await spawn(process.execPath, [
      '--import', join(active, 'loader.mjs'),
      join(active, 'contract/integration/native-batch/prepare.ts'),
    ], { cwd: packageRoot, env: { ...process.env, PI_AUTO_MODE_NATIVE_BUILD: '1' } });
    const initial = await realpath(active);
    const expectedVersion = await version(packageRoot);
    const preparePath = join(packageRoot, 'native/contract/integration/native-batch/prepare.ts');
    const prepare = await readFile(preparePath, 'utf8');
    await writeFile(preparePath, `${prepare}\nthrow new Error('fixture generation failure');\n`);
    expect(await rejectedBuild(packageRoot)).toContain('fixture generation failure');
    expect(await realpath(active)).toBe(initial);
    expect(await version(packageRoot)).toBe(expectedVersion);
    await writeFile(preparePath, prepare);
    await build(packageRoot);
    const published = await realpath(active);
    expect(published).not.toBe(initial);
    expect(await version(packageRoot)).toBe(expectedVersion);
    const cliPath = join(packageRoot, 'native/cli.mjs');
    const cli = await readFile(cliPath, 'utf8');
    await writeFile(cliPath, cli.replace('\n', "\nthrow new Error('fixture CLI loading failure');\n"));
    expect(await rejectedBuild(packageRoot)).toContain('fixture CLI loading failure');
    expect(await realpath(active)).toBe(published);
    expect(await version(packageRoot)).toBe(expectedVersion);
    await writeFile(cliPath, cli);
    await build(packageRoot);
    expect(await realpath(active)).not.toBe(published);
    expect(await version(packageRoot)).toBe(expectedVersion);
    expect(await readFile(join(published, 'cli.mjs'), 'utf8')).toBe(cli);
  },
})] });
//endregion Failed release publication

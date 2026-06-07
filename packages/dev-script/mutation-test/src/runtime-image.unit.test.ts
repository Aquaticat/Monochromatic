import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  mkdir,
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  buildRuntimeImageArgs,
  platformTag,
  runtimeInputHash,
  runtimeImage,
  sha256Hex,
} from '../dist/final/node/index.mjs';

/**
 * Writes minimal runtime image inputs needed by hashing tests.
 *
 * @param options - Repository root and runtime source content.
 *
 * @returns Runtime package root.
 *
 * @example
 * ```ts
 * await writeRuntimeFixture({ repoRoot: '/tmp/repo', source: 'export {};' });
 * ```
 */
async function writeRuntimeFixture(options: {
  readonly repoRoot: string;
  readonly source: string;
},): Promise<string> {
  /**
   * Runtime package root inside temporary repository.
   */
  const packageRoot = join(
    options.repoRoot,
    'packages',
    'dev-script',
    'mutation-test',
  );
  /**
   * Runtime package source directory.
   */
  const sourceRoot = join(
    packageRoot,
    'src',
  );
  /**
   * Runtime package image directory.
   */
  const runtimeRoot = join(
    packageRoot,
    'runtime',
  );
  /**
   * Deprecated workspace root included by pnpm workspace globs.
   */
  const deprecatedRoot = join(
    options.repoRoot,
    'packages-deprecated',
  );
  /**
   * Workspace directory that is not a package and lacks package.json.
   */
  const nonPackageRoot = join(
    options.repoRoot,
    'packages',
    'claude-code-plugins',
    'research-agent',
  );

  await Promise.all([
    mkdir(
      sourceRoot,
      { recursive: true, },
    ),
    mkdir(
      runtimeRoot,
      { recursive: true, },
    ),
    mkdir(
      deprecatedRoot,
      { recursive: true, },
    ),
    mkdir(
      nonPackageRoot,
      { recursive: true, },
    ),
  ],);
  await Promise.all([
    writeFile(
      join(options.repoRoot, 'mise.toml',),
      'node = "latest"\n',
    ),
    writeFile(
      join(options.repoRoot, 'package.json',),
      '{"name":"fixture"}\n',
    ),
    writeFile(
      join(options.repoRoot, '.pnpmfile.mjs',),
      'export const hooks = {};\n',
    ),
    writeFile(
      join(options.repoRoot, '.pnpmfile.policies.json',),
      '{}\n',
    ),
    writeFile(
      join(options.repoRoot, 'pnpm-workspace.yaml',),
      'packages:\n  - "packages/*/*"\n  - "packages-deprecated/*/*"\n',
    ),
    writeFile(
      join(options.repoRoot, 'pnpm-lock.yaml',),
      'lockfileVersion: 9.0\n',
    ),
    writeFile(
      join(packageRoot, 'package.json',),
      '{"name":"@monochromatic-dev/dev-script-mutation-test"}\n',
    ),
    writeFile(
      join(runtimeRoot, 'Containerfile',),
      'FROM fedora:latest\n',
    ),
    writeFile(
      join(sourceRoot, 'in-container.ts',),
      options.source,
    ),
  ],);

  return packageRoot;
}

await describe({
  name: sha256Hex.name,
  children: [
    it({
      name: 'computes stable SHA-256 hex',
      fn: async () => {
        expect(
          sha256Hex(Buffer.from('x',),),
        ).toBe('2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881',);
      },
    },),
  ],
},);

await describe({
  name: platformTag.name,
  children: [
    it({
      name: 'sanitizes platform overrides for image tags',
      fn: async () => {
        expect(platformTag('linux/arm64',),).toBe('linux-arm64',);
      },
    },),
  ],
},);

await describe({
  name: buildRuntimeImageArgs.name,
  children: [
    it({
      name: 'pulls a missing Fedora base while keeping runtime images local',
      fn: async () => {
        const args = buildRuntimeImageArgs({
          contextRoot: '/tmp/mutation-runtime-context',
          packageRoot: '/tmp/mutation-runtime-context/packages/dev-script/mutation-test',
          image: 'localhost/example:tag',
        },);

        expect(args,).toEqual([
          'build',
          '--pull=missing',
          '--tag',
          'localhost/example:tag',
          '--file',
          '/tmp/mutation-runtime-context/packages/dev-script/mutation-test/runtime/Containerfile',
          '/tmp/mutation-runtime-context',
        ],);
      },
    },),
  ],
},);

await describe({
  name: runtimeInputHash.name,
  children: [
    it({
      name: 'changes when baked runtime source changes',
      fn: async () => {
        const repoRoot = await mkdtemp(join(tmpdir(), 'mutation-runtime-inputs-',),);
        const packageRoot = await writeRuntimeFixture({
          repoRoot,
          source: 'export const value = 1;\n',
        },);
        const firstHash = await runtimeInputHash({
          repoRoot,
          packageRoot,
        },);

        await writeFile(
          join(packageRoot, 'src', 'in-container.ts',),
          'export const value = 2;\n',
        );

        expect(await runtimeInputHash({
          repoRoot,
          packageRoot,
        },),).not.toBe(firstHash,);
      },
    },),
  ],
},);

await describe({
  name: runtimeImage.name,
  children: [
    it({
      name: 'uses lockfile content and platform in local image reference',
      fn: async () => {
        const repoRoot = await mkdtemp(join(tmpdir(), 'mutation-runtime-image-',),);
        const packageRoot = await writeRuntimeFixture({
          repoRoot,
          source: 'export const value = 1;\n',
        },);
        await writeFile(join(repoRoot, 'pnpm-lock.yaml',), 'lock-content\n',);
        const image = await runtimeImage({
          repoRoot,
          packageRoot,
          nodeTag: 'node-latest',
          platformOverride: 'linux/arm64',
        },);

        expect(image.reference,).toContain('localhost/monochromatic-mutation-runtime:node-latest-',);
        expect(image.reference,).toContain('-linux-arm64',);
        expect(image.lockHash,).toBe(
          sha256Hex(Buffer.from('lock-content\n',),),
        );
        expect(image.runtimeHash,).toBe(
          await runtimeInputHash({
            repoRoot,
            packageRoot,
          },),
        );
      },
    },),
  ],
},);

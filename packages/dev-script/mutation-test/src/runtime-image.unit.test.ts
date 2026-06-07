import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  platformTag,
  runtimeImage,
  sha256Hex,
} from '../dist/final/node/index.mjs';

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
  name: runtimeImage.name,
  children: [
    it({
      name: 'uses lockfile content and platform in local image reference',
      fn: async () => {
        const repoRoot = await mkdtemp(join(tmpdir(), 'mutation-runtime-image-',),);
        await writeFile(join(repoRoot, 'pnpm-lock.yaml',), 'lock-content\n',);
        const image = await runtimeImage({
          repoRoot,
          packageRoot: join(repoRoot, 'packages', 'dev-script', 'mutation-test',),
          nodeTag: 'node-latest',
          platformOverride: 'linux/arm64',
        },);

        expect(image.reference,).toContain('localhost/monochromatic-mutation-runtime:node-latest-',);
        expect(image.reference,).toContain('-linux-arm64',);
        expect(image.lockHash,).toBe(
          sha256Hex(Buffer.from('lock-content\n',),),
        );
      },
    },),
  ],
},);

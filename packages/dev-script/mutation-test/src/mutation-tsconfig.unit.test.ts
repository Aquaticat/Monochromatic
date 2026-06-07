import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  mkdtemp,
  readFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  MUTATION_TSCONFIG_NAME,
  buildMutationTsconfig,
  writeMutationTsconfig,
} from '../dist/final/node/index.mjs';

await describe({
  name: buildMutationTsconfig.name,
  children: [
    it({
      name: 'keeps Node-native TypeScript options without extends indirection',
      fn: async () => {
        const config = buildMutationTsconfig();

        expect(config,).not.toHaveProperty('extends',);
        expect(config.compilerOptions.allowImportingTsExtensions,).toBe(true,);
        expect(config.compilerOptions.moduleResolution,).toBe('bundler',);
        expect(config.compilerOptions.types,).toEqual(['bun',],);
        expect(config.compilerOptions.lib,).toEqual([
          'ESNext',
          'DOM',
          'WebWorker',
        ],);
      },
    },),
  ],
},);

await describe({
  name: writeMutationTsconfig.name,
  children: [
    it({
      name: 'writes package-relative checker config',
      fn: async () => {
        const packageCwd = await mkdtemp(join(
          tmpdir(),
          'mutation-tsconfig-',
        ),);
        const relativeConfig = await writeMutationTsconfig({ packageCwd, },);
        const written = JSON.parse(await readFile(
          join(
            packageCwd,
            MUTATION_TSCONFIG_NAME,
          ),
          'utf8',
        ),) as ReturnType<typeof buildMutationTsconfig>;

        expect(relativeConfig,).toBe(MUTATION_TSCONFIG_NAME,);
        expect(written,).toEqual(buildMutationTsconfig(),);
      },
    },),
  ],
},);

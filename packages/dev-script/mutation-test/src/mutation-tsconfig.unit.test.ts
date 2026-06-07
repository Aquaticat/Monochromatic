import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  MUTATION_TSCONFIG_NAME,
  mutationTsconfig,
  writeMutationTsconfig,
} from '../dist/final/node/index.mjs';

await describe({
  name: mutationTsconfig.name,
  children: [
    it({
      name: 'narrows showConfig to current mutate file',
      fn: async () => {
        const config = mutationTsconfig({
          shownConfig: {
            include: ['src/**/*.ts',],
            compilerOptions: {},
          },
          mutateFile: 'src/a.ts',
        },);

        expect(config,).not.toHaveProperty('include',);
        expect(config.files,).toEqual(['src/a.ts',],);
      },
    },),
  ],
},);

await describe({
  name: writeMutationTsconfig.name,
  children: [
    it({
      name: 'writes TypeScript showConfig output',
      fn: async () => {
        const packageCwd = await mkdtemp(join(
          tmpdir(),
          'mutation-tsconfig-',
        ),);
        await mkdir(
          join(
            packageCwd,
            'src',
          ),
          { recursive: true, },
        );
        await writeFile(
          join(
            packageCwd,
            'src',
            'index.ts',
          ),
          'export const value = 1;\n',
          'utf8',
        );
        await writeFile(
          join(
            packageCwd,
            'tsconfig.json',
          ),
          JSON.stringify({
            compilerOptions: {
              allowImportingTsExtensions: true,
              module: 'preserve',
              moduleResolution: 'bundler',
              noEmit: true,
              types: [],
            },
            include: ['src/**/*.ts',],
          },),
          'utf8',
        );
        const relativeConfig = await writeMutationTsconfig({
          packageCwd,
          mutateFile: 'src/index.ts',
        },);
        const written = JSON.parse(await readFile(
          join(
            packageCwd,
            MUTATION_TSCONFIG_NAME,
          ),
          'utf8',
        ),) as {
          readonly compilerOptions: {
            readonly allowImportingTsExtensions: boolean;
            readonly moduleResolution: string;
          };
          readonly files: readonly string[];
        };

        expect(relativeConfig,).toBe(MUTATION_TSCONFIG_NAME,);
        expect(written,).not.toHaveProperty('extends',);
        expect(written,).not.toHaveProperty('include',);
        expect(written.files,).toEqual(['src/index.ts',],);
        expect(written.compilerOptions.allowImportingTsExtensions,).toBe(true,);
        expect(written.compilerOptions.moduleResolution,).toBe('bundler',);
      },
    },),
  ],
},);

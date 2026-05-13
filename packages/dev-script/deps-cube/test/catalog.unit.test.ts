/**
 * Tests for the catalog parser.
 *
 * Each test writes a fixture `pnpm-workspace.yaml` under a fresh
 * temp directory and calls `readCatalog({ startDir })` so the
 * `findUp` search is constrained to that temp tree.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

import { outdent, } from '@cspotcode/outdent';

import {
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  decodeAlias,
  readCatalog,
} from '../src/catalog.ts';

/**
 * Allocates a fresh temp directory and returns it with an
 * async-disposable that recursively removes it on scope exit.
 *
 * @returns Tuple of root path and an async-disposable cleanup.
 */
async function tempWorkspace(): Promise<{
  dir: string;
  [Symbol.asyncDispose]: () => Promise<void>;
}> {
  const dir = await mkdtemp(join(tmpdir(), 'deps-cube-catalog-',),);
  return {
    dir,
    [Symbol.asyncDispose]: async function dispose() {
      await rm(dir, { recursive: true, force: true, },);
    },
  };
}

await describe({
  name: 'catalog',
  children: [
    //region decodeAlias
    it({
      name: 'decodeAlias passes through plain ranges',
      fn: async () => {
        expect(decodeAlias({ key: 'preact', value: '^10.26.0', },),).toEqual({
          npmName: 'preact',
          range: '^10.26.0',
        },);
      },
    },),

    it({
      name: 'decodeAlias resolves npm: alias with explicit @range',
      fn: async () => {
        expect(decodeAlias({ key: '@cspotcode/outdent', value: 'npm:outdent@0.8.0', },),).toEqual({
          npmName: 'outdent',
          range: '0.8.0',
        },);
      },
    },),

    it({
      name: 'decodeAlias resolves scoped npm: alias keeping the @scope prefix',
      fn: async () => {
        expect(decodeAlias({ key: 'alias', value: 'npm:@scope/name@1.0.0', },),).toEqual({
          npmName: '@scope/name',
          range: '1.0.0',
        },);
      },
    },),

    it({
      name: 'decodeAlias falls back to range "*" when no @range trails',
      fn: async () => {
        expect(decodeAlias({ key: 'alias', value: 'npm:somepkg', },),).toEqual({
          npmName: 'somepkg',
          range: '*',
        },);
      },
    },),
    //endregion decodeAlias

    //region readCatalog
    it({
      name: 'readCatalog reads the default catalog: block',
      fn: async () => {
        await using temp = await tempWorkspace();
        await writeFile(
          join(temp.dir, 'pnpm-workspace.yaml',),
          outdent`
            packages:
              - 'packages/*'
            catalog:
              preact: ^10.26.0
              react: ^19.0.0
          `,
          'utf8',
        );
        const entries = await readCatalog({ startDir: temp.dir, },);
        expect(entries.length,).toBe(2,);
        expect(entries[0],).toMatchObject({
          catalogKey: 'preact',
          npmName: 'preact',
          range: '^10.26.0',
          catalogName: undefined,
        },);
        expect(entries[1],).toMatchObject({
          catalogKey: 'react',
          npmName: 'react',
          range: '^19.0.0',
          catalogName: undefined,
        },);
      },
    },),

    it({
      name: 'readCatalog reads named catalogs: blocks alongside the default',
      fn: async () => {
        await using temp = await tempWorkspace();
        await writeFile(
          join(temp.dir, 'pnpm-workspace.yaml',),
          outdent`
            catalog:
              preact: ^10.26.0
            catalogs:
              react18:
                react: ^18.0.0
              react19:
                react: ^19.0.0
          `,
          'utf8',
        );
        const entries = await readCatalog({ startDir: temp.dir, },);
        expect(entries.length,).toBe(3,);
        const named = entries.filter(function named(e,) {
          return e.catalogName !== undefined;
        },);
        const namedCatalogs = named
          .map(function pluck(e,) {
            return e.catalogName;
          },)
          .filter(function present(name,): name is string {
            return name !== undefined;
          },)
          .toSorted(function alphabetical(a, b,) {
            return a.localeCompare(b,);
          },);
        expect(namedCatalogs,).toEqual(['react18', 'react19',],);
      },
    },),

    it({
      name: 'readCatalog decodes npm: aliases inside catalog entries',
      fn: async () => {
        await using temp = await tempWorkspace();
        await writeFile(
          join(temp.dir, 'pnpm-workspace.yaml',),
          outdent`
            catalog:
              '@cspotcode/outdent': 'npm:outdent@0.8.0'
          `,
          'utf8',
        );
        const entries = await readCatalog({ startDir: temp.dir, },);
        expect(entries.length,).toBe(1,);
        expect(entries[0],).toMatchObject({
          catalogKey: '@cspotcode/outdent',
          npmName: 'outdent',
          range: '0.8.0',
        },);
      },
    },),

    it({
      name: 'readCatalog throws when pnpm-workspace.yaml is absent up the tree',
      fn: async () => {
        await using temp = await tempWorkspace();
        const caught = await (async function captureError() {
          try {
            await readCatalog({ startDir: temp.dir, },);
            return null;
          } catch (err) {
            return err;
          }
        })();
        expect(caught,).toBeInstanceOf(Error,);
        expect(String(caught,),).toMatch(/pnpm-workspace\.yaml|locate/i,);
      },
    },),

    it({
      name: 'readCatalog throws when both catalog blocks are empty',
      fn: async () => {
        await using temp = await tempWorkspace();
        await writeFile(
          join(temp.dir, 'pnpm-workspace.yaml',),
          outdent`
            packages:
              - 'packages/*'
          `,
          'utf8',
        );
        const caught = await (async function captureError() {
          try {
            await readCatalog({ startDir: temp.dir, },);
            return null;
          } catch (err) {
            return err;
          }
        })();
        expect(caught,).toBeInstanceOf(Error,);
        expect(String(caught,),).toMatch(/catalog/i,);
      },
    },),
    //endregion readCatalog
  ],
},);

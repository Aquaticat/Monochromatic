/**
 * Cornerstone round-trip: every `*-input.toml` fixture from `toml-eslint-parser`'s
 * parser suite either round-trips byte-for-byte in splice mode (valid fixtures)
 * or throws `TomlEditError` on parse (invalid fixtures, marked by `invalid` in
 * the filename).
 *
 * @module
 */
/* oxlint-disable typescript-eslint/no-unsafe-call, typescript-eslint/no-unsafe-assignment, typescript-eslint/no-unsafe-member-access, typescript-eslint/no-unsafe-return, typescript-eslint/no-unsafe-type-assertion -- oxlint type-aware inference doesn't follow node:fs/promises types through the module-test harness; the calls are sound at the type level. */

import {
  readFile,
  readdir,
} from 'node:fs/promises';
import { dirname, join, } from 'node:path';
import { fileURLToPath, } from 'node:url';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

import {
  parseTomlEdit,
  TomlEditError,
  tomlStringify,
} from '../src/index.ts';

const here = dirname(fileURLToPath(import.meta.url,),);
const fixturesDir = join(here, 'fixtures',);

const fixtureFiles = (await readdir(fixturesDir,))
  .filter(function isInput(name,) {
    return name.endsWith('-input.toml',);
  },)
  .sort();

await describe({
  name: 'fixtures round-trip',
  children: fixtureFiles.map(function makeCase(filename,) {
    return it({
      name: filename,
      fn: async () => {
        const source = await readFile(join(fixturesDir, filename,), 'utf-8',);
        const result = (function attemptParse() {
          try {
            return {
              ok: true as const,
              edit: parseTomlEdit({ source, },),
            };
          } catch (e: unknown) {
            return { ok: false as const, error: e, };
          }
        })();
        if (!result.ok) {
          expect(result.error,).toBeInstanceOf(TomlEditError,);
          return;
        }
        const text = tomlStringify({ edit: result.edit, },);
        expect(text,).toBe(source,);
      },
    },);
  },),
},);

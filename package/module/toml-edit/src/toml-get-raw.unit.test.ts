/**
 * Tests for `tomlGetRaw`.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { emptyTomlEdit, } from './empty-toml-edit.ts';
import {
  TomlPathNotFoundError,
  TomlSpliceUnavailableError,
} from './errors.ts';
import { parseTomlEdit, } from './parse-toml-edit.ts';
import { tomlGetRaw, } from './toml-get-raw.ts';

await describe({
  name: tomlGetRaw.name,
  children: [
    it({
      name: 'returns the source slice for an existing keyvalue',
      fn: async () => {
        const edit = parseTomlEdit({ source: "key = 'literal'\n", },);
        expect(tomlGetRaw({ edit, path: ['key',], },),).toBe("'literal'",);
      },
    },),

    it({
      name: 'preserves integer raw spelling (hex)',
      fn: async () => {
        const edit = parseTomlEdit({ source: 'count = 0x10\n', },);
        expect(tomlGetRaw({ edit, path: ['count',], },),).toBe('0x10',);
      },
    },),

    it({
      name: 'throws TomlPathNotFoundError for missing path',
      fn: async () => {
        const edit = parseTomlEdit({ source: 'foo = 1\n', },);
        expect(function lookup() {
          tomlGetRaw({ edit, path: ['missing',], },);
        },)
          .toThrow(TomlPathNotFoundError,);
      },
    },),

    it({
      name: 'throws TomlSpliceUnavailableError in canonical mode',
      fn: async () => {
        const edit = emptyTomlEdit();
        expect(function lookup() {
          tomlGetRaw({ edit, path: ['foo',], },);
        },)
          .toThrow(TomlSpliceUnavailableError,);
      },
    },),

    it({
      name: 'throws for an edited path (no clean source slice after tomlSet)',
      fn: async () => {
        const e0 = parseTomlEdit({ source: "key = 'literal'\nother = 1\n", },);
        const { tomlSet, } = await import('./toml-set.ts');
        const e1 = tomlSet({ edit: e0, path: ['key',], value: 'new', },);
        // The edited value is synthetic, so no original bytes back it.
        expect(function lookup() {
          tomlGetRaw({ edit: e1, path: ['key',], },);
        },)
          .toThrow(TomlPathNotFoundError,);
        // An unedited sibling still returns its parse-time bytes.
        expect(tomlGetRaw({ edit: e1, path: ['other',], },),).toBe('1',);
      },
    },),
  ],
},);

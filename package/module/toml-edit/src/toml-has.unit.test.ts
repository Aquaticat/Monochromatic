/**
 * Tests for `tomlHas`.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { parseTomlEdit, } from './parse-toml-edit.ts';
import { tomlDelete, } from './toml-delete.ts';
import { tomlHas, } from './toml-has.ts';
import { tomlSet, } from './toml-set.ts';

await describe({
  name: tomlHas.name,
  children: [
    it({
      name: 'true for an existing top-level key',
      fn: async () => {
        const edit = parseTomlEdit({ source: 'foo = 1\n', },);
        expect(tomlHas({ edit, path: ['foo',], },),).toBe(true,);
      },
    },),

    it({
      name: 'false for a missing path',
      fn: async () => {
        const edit = parseTomlEdit({ source: 'foo = 1\n', },);
        expect(tomlHas({ edit, path: ['bar',], },),).toBe(false,);
      },
    },),

    it({
      name: 'false after delete',
      fn: async () => {
        const e1 = tomlDelete({
          edit: parseTomlEdit({ source: 'foo = 1\n', },),
          path: ['foo',],
        },);
        expect(tomlHas({ edit: e1, path: ['foo',], },),).toBe(false,);
      },
    },),

    it({
      name: 'true after path-create set',
      fn: async () => {
        const e1 = tomlSet({
          edit: parseTomlEdit({ source: '', },),
          path: ['new',],
          value: 1,
        },);
        expect(tomlHas({ edit: e1, path: ['new',], },),).toBe(true,);
      },
    },),

    it({
      name: 'true for a nested table path',
      fn: async () => {
        const edit = parseTomlEdit({ source: '[a]\nb = 1\n', },);
        expect(tomlHas({ edit, path: ['a', 'b',], },),).toBe(true,);
      },
    },),
  ],
},);

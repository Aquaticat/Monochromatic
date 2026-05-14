/**
 * Tests for `tomlGetNode`.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

import { TomlPathNotFoundError, } from './errors.ts';
import { parseTomlEdit, } from './parse-toml-edit.ts';
import { tomlGetNode, } from './toml-get-node.ts';

await describe({
  name: 'tomlGetNode',
  children: [
    it({
      name: 'returns the value AST node for an existing keyvalue',
      fn: async () => {
        const edit = parseTomlEdit({ source: 'foo = "bar"\n', },);
        const node = tomlGetNode({ edit, path: ['foo',], },);
        if (Array.isArray(node,)) throw new Error('expected single node',);
        if ('type' in node && node.type === 'TOMLValue')
          expect(node.kind,).toBe('string',);
        else
          throw new Error('expected TOMLValue',);
      },
    },),

    it({
      name: 'throws TomlPathNotFoundError for missing path',
      fn: async () => {
        const edit = parseTomlEdit({ source: 'foo = 1\n', },);
        expect(function lookup() {
          tomlGetNode({ edit, path: ['missing',], },);
        },).toThrow(TomlPathNotFoundError,);
      },
    },),

    it({
      name: 'returns the parse-time AST node even after a pending tomlSet',
      fn: async () => {
        const e0 = parseTomlEdit({ source: 'foo = "old"\n', },);
        const tomlSet = (await import('./toml-set.ts',)).tomlSet;
        const e1 = tomlSet({ edit: e0, path: ['foo',], value: 'new', },);
        const node = tomlGetNode({ edit: e1, path: ['foo',], },);
        if (Array.isArray(node,)) throw new Error('expected single node',);
        if (!('type' in node) || node.type !== 'TOMLValue') throw new Error('expected TOMLValue',);
        if (node.kind !== 'string') throw new Error('expected string kind',);
        expect(node.value,).toBe('old',);
      },
    },),
  ],
},);

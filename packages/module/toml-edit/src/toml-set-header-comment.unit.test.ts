/**
 * Tests for `tomlSetHeaderComment`.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { emptyTomlEdit, } from './empty-toml-edit.ts';
import { tomlSetHeaderComment, } from './toml-set-header-comment.ts';
import { tomlSet, } from './toml-set.ts';
import { tomlStringify, } from './toml-stringify.ts';

await describe({
  name: tomlSetHeaderComment.name,
  children: [
    it({
      name: 'string comment lands above the body in canonical mode',
      fn: async () => {
        const e0 = emptyTomlEdit();
        const e1 = tomlSetHeaderComment({ edit: e0, comment: 'Generated', },);
        const e2 = tomlSet({ edit: e1, path: ['title',], value: 'Demo', },);
        const out = tomlStringify({ edit: e2, },);
        expect(out.startsWith('# Generated',),).toBe(true,);
      },
    },),

    it({
      name: 'array of lines emits one comment line each',
      fn: async () => {
        const e0 = emptyTomlEdit();
        const e1 = tomlSetHeaderComment({ edit: e0, comment: ['one', 'two',], },);
        const e2 = tomlSet({ edit: e1, path: ['title',], value: 'Demo', },);
        const out = tomlStringify({ edit: e2, },);
        expect(out,).toContain('# one\n',);
        expect(out,).toContain('# two\n',);
      },
    },),

    it({
      name: 'omitting comment clears the header comment',
      fn: async () => {
        const e0 = emptyTomlEdit();
        const e1 = tomlSetHeaderComment({ edit: e0, comment: 'X', },);
        const e2 = tomlSetHeaderComment({ edit: e1, },);
        const e3 = tomlSet({ edit: e2, path: ['title',], value: 'Demo', },);
        const out = tomlStringify({ edit: e3, },);
        expect(out.includes('# X',),).toBe(false,);
      },
    },),
  ],
},);

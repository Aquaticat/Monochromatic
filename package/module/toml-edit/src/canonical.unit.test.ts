/**
 Tests for canonical-mode emission via `emptyTomlEdit` plus setters.
 
 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  emptyTomlEdit,
  parseTomlEdit,
  tomlSet,
  tomlSetHeaderComment,
  tomlStringify,
} from '@monochromatic-dev/module-toml-edit';

await describe({
  name: 'canonical emission via emptyTomlEdit',
  children: [
    it({
      name: 'emits valid TOML that re-parses without error',
      fn: async () => {
        const e0 = emptyTomlEdit();
        const e1 = tomlSet({ edit: e0, path: ['title',], value: 'Demo', },);
        const out = tomlStringify({ edit: e1, },);
        expect(function reparse() {
          parseTomlEdit({ source: out, },);
        },)
          .not
          .toThrow();
      },
    },),

    it({
      name: 'canonical overrides retain an empty source',
      fn: async () => {
        const edit = emptyTomlEdit({ canonical: { indent: 4, }, },);
        expect(edit.source,).toBe('',);
        expect(edit.mode,).toBe('canonical',);
        expect(edit.canonical.indent,).toBe(4,);
      },
    },),

    it({
      name: 'multiple sets accumulate in the output',
      fn: async () => {
        const e0 = emptyTomlEdit();
        const e1 = tomlSet({ edit: e0, path: ['title',], value: 'Demo', },);
        const e2 = tomlSet({ edit: e1, path: ['version',], value: '1.0', },);
        const out = tomlStringify({ edit: e2, },);
        expect(out,).toContain('title = "Demo"',);
        expect(out,).toContain('version = "1.0"',);
      },
    },),

    it({
      name: 'header comment lands above the body',
      fn: async () => {
        const e0 = emptyTomlEdit();
        const e1 = tomlSetHeaderComment({ edit: e0, comment: 'Generated', },);
        const e2 = tomlSet({ edit: e1, path: ['title',], value: 'Demo', },);
        const out = tomlStringify({ edit: e2, },);
        expect(out.indexOf('# Generated',),).toBeLessThan(out.indexOf('title',),);
      },
    },),
  ],
},);

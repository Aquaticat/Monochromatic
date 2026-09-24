import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  _jsValueToTomlText,
  emptyTomlEdit,
  parseTomlEdit,
  tomlGetNode,
  TomlTypeError,
} from '@monochromatic-dev/module-toml-edit';

/**
 Canonical options for direct built-artifact encoder calls.
 */
const OPTIONS = emptyTomlEdit().canonical;

await describe({
  name: _jsValueToTomlText.name,
  children: [
    it({
      name: 'emits both boolean values and nonfinite bare numbers',
      fn: async () => {
        expect(_jsValueToTomlText({ input: true, options: OPTIONS, },),).toBe('true',);
        expect(_jsValueToTomlText({ input: false, options: OPTIONS, },),).toBe('false',);
        expect(_jsValueToTomlText({ input: Number.NaN, options: OPTIONS, },),).toBe('nan',);
        expect(_jsValueToTomlText({ input: Infinity, options: OPTIONS, },),).toBe('inf',);
        expect(_jsValueToTomlText({ input: -Infinity, options: OPTIONS, },),).toBe('-inf',);
      },
    },),
    it({
      name: 'formats empty and inline arrays and inline tables',
      fn: async () => {
        expect(_jsValueToTomlText({ input: [], options: OPTIONS, },),).toBe('[ ]',);
        expect(_jsValueToTomlText({ input: [1, 2,], options: OPTIONS, },),).toBe('[ 1, 2, ]',);
        expect(_jsValueToTomlText({ input: {}, options: OPTIONS, },),).toBe('{ }',);
        expect(_jsValueToTomlText({ input: { a: 1, b: 2, }, options: OPTIONS, },),)
          .toBe('{ a = 1, b = 2, }',);
      },
    },),
    it({
      name: 'uses inclusive array layout thresholds and nested indentation',
      fn: async () => {
        const inline = { ...OPTIONS, arrayInlineThreshold: 2, arrayInlineMaxColumns: 9, };
        const multiline = { ...OPTIONS, arrayInlineThreshold: 1, arrayInlineMaxColumns: 9, };
        expect(_jsValueToTomlText({ input: [1, 2,], options: inline, },),)
          .toBe('[ 1, 2, ]',);
        expect(_jsValueToTomlText({ input: [1, 2,], options: multiline, },),)
          .toBe('[\n  1,\n  2,\n]',);
        expect(_jsValueToTomlText({ input: { xs: [1, 2,], }, options: multiline, },),)
          .toBe('{ xs = [\n    1,\n    2,\n  ], }',);
      },
    },),
    it({
      name: 'preserves parse-time numeric spelling inside an equal array',
      fn: async () => {
        const edit = parseTomlEdit({ source: 'arr = [0x10, 0x20]\n', },);
        const node = tomlGetNode({ edit, path: ['arr',], },);
        if ((!('type' in node)) || (node.type !== 'TOMLArray'))
          throw new Error('Expected parsed array node',);
        expect(_jsValueToTomlText({
          input: [16, 32,],
          options: OPTIONS,
          existing: { node, },
        },),).toBe('[ 0x10, 0x20, ]',);
      },
    },),
    it({
      name: 'rejects unsupported JS inputs with a named type error',
      fn: async () => {
        expect(() => _jsValueToTomlText({ input: Symbol('no'), options: OPTIONS, },),)
          .toThrow(TomlTypeError,);
        expect(() => _jsValueToTomlText({ input: Symbol('no'), options: OPTIONS, },),)
          .toThrow('Cannot encode symbol as TOML',);
      },
    },),
  ],
},);

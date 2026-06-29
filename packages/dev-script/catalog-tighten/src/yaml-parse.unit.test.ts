/**
 * Tests for the yaml-library catalog reader.
 *
 * Covers the YAML shapes the prior hand-rolled scanner mis-handled: single
 * quotes (#258), comment lines inside the block, and named `catalogs:` that
 * must be ignored. Also pins the issue #195 guard: crafted keys are dropped
 * and the result map carries no prototype, so `__proto__` cannot pollute.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  parseCatalogFromYaml,
} from './yaml-parse.ts';

await describe({
  name: 'yaml-parse',
  children: [
    //region catalog shapes
    it({
      name: 'reads single-quoted keys and values (the pnpm-workspace.yaml shape, #258)',
      fn: async () => {
        /** Fixture using the single-quoted shape that broke the prior parser. */
        const content = [
          'catalog:',
          '  \'oxlint\': \'>=1.71.0\'',
          '  \'@types/node\': \'>=24.0.0\'',
        ].join('\n',);
        expect(parseCatalogFromYaml(content,),).toEqual({
          'oxlint': '>=1.71.0',
          '@types/node': '>=24.0.0',
        },);
      },
    },),

    it({
      name: 'reads double-quoted and bare values (>= must be quoted; bare > is a YAML block scalar)',
      fn: async () => {
        /** Fixture mixing a double-quoted range and a bare exact version (a valid YAML plain scalar). */
        const content = [
          'catalog:',
          '  foo: ">=1.2.3"',
          '  bar: 1.0.0',
        ].join('\n',);
        expect(parseCatalogFromYaml(content,),).toEqual({
          foo: '>=1.2.3',
          bar: '1.0.0',
        },);
      },
    },),

    it({
      name: 'skips comment lines inside the catalog block',
      fn: async () => {
        /** Fixture with a comment line between entries, as the real file has. */
        const content = [
          'catalog:',
          '  # pinned exact, see note',
          '  foo: \'>=1.2.3\'',
        ].join('\n',);
        expect(parseCatalogFromYaml(content,),).toEqual({ foo: '>=1.2.3', },);
      },
    },),

    it({
      name: 'ignores named catalogs: and reads only the default catalog:',
      fn: async () => {
        /** Fixture with both a default catalog and a named catalog block. */
        const content = [
          'catalog:',
          '  foo: \'>=1.2.3\'',
          'catalogs:',
          '  classic:',
          '    bar: \'>=2.0.0\'',
        ].join('\n',);
        expect(parseCatalogFromYaml(content,),).toEqual({ foo: '>=1.2.3', },);
      },
    },),

    it({
      name: 'returns empty when there is no catalog: block',
      fn: async () => {
        /** Fixture declaring only packages:, no catalog. */
        const content = [
          'packages:',
          '  - \'packages/*\'',
        ].join('\n',);
        expect(parseCatalogFromYaml(content,),).toEqual({},);
      },
    },),
    //endregion catalog shapes

    //region issue #195 guard
    it({
      name: 'drops a crafted __proto__ key and never pollutes the prototype',
      fn: async () => {
        /** Fixture with a crafted prototype-pollution key alongside a real entry. */
        const content = [
          'catalog:',
          '  \'__proto__\': \'>=9.9.9\'',
          '  foo: \'>=1.2.3\'',
        ].join('\n',);
        /** Parsed result; the crafted key must not survive as a usable entry. */
        const result = parseCatalogFromYaml(content,);
        expect(result.foo,).toBe('>=1.2.3',);
        expect(Object.getPrototypeOf(result,),).toBe(null,);
        // Object.prototype must be untouched by the crafted key.
        expect(({} as Record<string, unknown>).polluted,).toBe(undefined,);
      },
    },),

    it({
      name: 'result map has a null prototype so even name-shaped keys are inert',
      fn: async () => {
        /** Fixture whose only entry is the name-shaped reserved word `constructor`. */
        const content = [
          'catalog:',
          '  constructor: \'>=1.0.0\'',
        ].join('\n',);
        /** Parsed result; `constructor` is a plain own property on a prototype-less map. */
        const result = parseCatalogFromYaml(content,);
        expect(Object.getPrototypeOf(result,),).toBe(null,);
        expect(Object.keys(result,),).toEqual(['constructor',],);
      },
    },),
    //endregion issue #195 guard
  ],
},);

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import {
  dedup,
  getProperty,
} from './transform.ts';

await describe({
  name: '',
  children: [
    //region dedup

    describe({
      name: dedup.name,
      children: [
        it({
          name: 'removes duplicate lines preserving first occurrence order',
          fn: async () => {
            expect(dedup('a\nb\na\nc\nb',),).toBe('a\nb\nc',);
          },
        }),
        it({
          name: 'returns empty string unchanged',
          fn: async () => {
            expect(dedup('',),).toBe('',);
          },
        }),
        it({
          name: 'returns single line unchanged',
          fn: async () => {
            expect(dedup('only-line',),).toBe('only-line',);
          },
        }),
        it({
          name: 'preserves all lines when none are duplicated',
          fn: async () => {
            expect(dedup('alpha\nbeta\ngamma',),).toBe('alpha\nbeta\ngamma',);
          },
        }),
        it({
          name: 'handles consecutive duplicate lines',
          fn: async () => {
            expect(dedup('x\nx\nx\ny',),).toBe('x\ny',);
          },
        }),
        it({
          name: 'treats lines with different whitespace as distinct',
          fn: async () => {
            expect(dedup('  a\na\n a',),).toBe('  a\na\n a',);
          },
        }),
        it({
          name: 'preserves blank lines but deduplicates them',
          fn: async () => {
            expect(dedup('a\n\nb\n\nc',),).toBe('a\n\nb\nc',);
          },
        }),
      ],
    }),

    //endregion dedup

    //region getProperty

    describe({
      name: getProperty.name,
      children: [
        it({
          name: 'extracts a top-level string property',
          fn: async () => {
            /** JSON with a simple string value */
            const json = JSON.stringify({ name: 'Alice', },);
            expect(getProperty('.name', json,),).toBe('Alice',);
          },
        }),
        it({
          name: 'extracts a nested property via dot-path',
          fn: async () => {
            /** JSON with nested structure */
            const json = JSON.stringify({ settings: { theme: 'dark', }, },);
            expect(getProperty('.settings.theme', json,),).toBe('dark',);
          },
        }),
        it({
          name: 'stringifies non-string values (number)',
          fn: async () => {
            /** JSON with a numeric value that should be stringified */
            const json = JSON.stringify({ count: 42, },);
            expect(getProperty('.count', json,),).toBe('42',);
          },
        }),
        it({
          name: 'stringifies array values with pretty printing',
          fn: async () => {
            /** JSON with an array value */
            const json = JSON.stringify({ items: [1, 2, 3,], },);
            expect(getProperty('.items', json,),).toBe(JSON.stringify([1, 2, 3,], null, 2,),);
          },
        }),
        it({
          name: 'stringifies object values with pretty printing',
          fn: async () => {
            /** JSON with a nested object to extract */
            const json = JSON.stringify({ nested: { a: 1, b: 2, }, },);
            expect(getProperty('.nested', json,),).toBe(
              JSON.stringify({ a: 1, b: 2, }, null, 2,),
            );
          },
        }),
        it({
          name: 'returns undefined for missing paths',
          fn: async () => {
            /** JSON where the requested path does not exist */
            const json = JSON.stringify({ exists: true, },);
            // dot-prop returns undefined for missing keys; getProperty passes it through
            expect(getProperty('.missing', json,),).toBeUndefined();
          },
        }),
        it({
          name: 'throws on invalid JSON input',
          fn: async () => {
            expect(() => getProperty('.key', 'not-json',)).toThrow();
          },
        }),
        it({
          name: 'handles boolean values',
          fn: async () => {
            /** JSON with a boolean value */
            const json = JSON.stringify({ active: true, },);
            expect(getProperty('.active', json,),).toBe('true',);
          },
        }),
        it({
          name: 'handles null values',
          fn: async () => {
            /** JSON with an explicit null */
            const json = JSON.stringify({ value: null, },);
            expect(getProperty('.value', json,),).toBe('null',);
          },
        }),
        it({
          name: 'handles deeply nested paths',
          fn: async () => {
            /** JSON with three levels of nesting */
            const json = JSON.stringify({ a: { b: { c: 'deep', }, }, },);
            expect(getProperty('.a.b.c', json,),).toBe('deep',);
          },
        }),
      ],
    }),

    //endregion getProperty
  ],
},);

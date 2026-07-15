import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { applyMixins, } from '@monochromatic-dev/build-tool-css';

await describe({
  name: applyMixins.name,
  concurrency: 1,
  children: [
    it({
      name: 'expands a referenced mixin into consumer CSS',
      fn: async () => {
        const result = applyMixins({
          cssText: '.card { @apply --surface; }',
          mixinCssText: '@mixin --surface { padding: 1rem; }',
        },);

        expect(result,).toContain('padding: 1rem',);
        expect(result,).not.toContain('@apply',);
        expect(result,).not.toContain('@mixin',);
      },
    },),
    it({
      name: 'throws when consumer CSS references an unknown mixin',
      fn: async () => {
        /**
         * Invokes mixin expansion with an unresolved reference.
         *
         * @returns Nothing because expansion throws
         *
         * @throws For unresolved `--missing` mixin
         *
         * @example
         * ```ts
         * invokeApplyMixins();
         * ```
         */
        function invokeApplyMixins(): void {
          applyMixins({
            cssText: '.card { @apply --missing; }',
            mixinCssText: '@mixin --surface { padding: 1rem; }',
          },);
        }

        expect(invokeApplyMixins,).toThrow('Unknown mixin: --missing',);
      },
    },),
  ],
},);

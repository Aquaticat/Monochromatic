import { readFile, } from 'node:fs/promises';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

/**
 * Production guard command source.
 */
const GUARD_COMMAND_SOURCE = new URL(
  'guard-command.ts',
  import.meta.url,
);

await describe({
  name: 'static guard context import',
  children: [
    it({
      name: 'loads context helper through static declaration',
      fn: async () => {
        /**
         * Authored guard command source text.
         */
        const source = await readFile(
          GUARD_COMMAND_SOURCE,
          'utf8',
        );
        expect(source.includes("import { getTrustDirectives, } from './context.ts';",),).toBe(true,);
        expect(source.includes('import(',),).toBe(false,);
      },
    },),
  ],
},);

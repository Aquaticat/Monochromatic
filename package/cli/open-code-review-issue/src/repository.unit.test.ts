import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  RepositorySelectionError,
  parseRepositoryUrl,
} from '../dist/final/node/index.mjs';

await describe({
  name: parseRepositoryUrl.name,
  children: [
    it({
      name: 'accepts only canonical GitHub HTTPS repository URL',
      fn: async () => {
        expect(parseRepositoryUrl('https://github.com/Aquaticat/issues-api',),).toStrictEqual({
          owner: 'Aquaticat',
          name: 'issues-api',
          url: 'https://github.com/Aquaticat/issues-api',
        },);
      },
    },),
    it({
      name: 'rejects shorthand suffixes credentials and non-GitHub hosts',
      fn: async () => {
        /**
         * Non-canonical repository selectors.
         */
        const values = [
          'Aquaticat/issues-api',
          'https://github.com/Aquaticat/issues-api/',
          'https://github.com/Aquaticat/issues-api.git',
          'https://github.com/Aquaticat/issues-api?tab=issues',
          'https://user@github.com/Aquaticat/issues-api',
          'https://example.com/Aquaticat/issues-api',
        ];
        for (const value of values) {
          /**
           * Captured repository validation failure.
           */
          let caught: unknown;
          try {
            parseRepositoryUrl(value,);
          }
          catch (error: unknown) {
            caught = error;
          }
          expect(caught,).toBeInstanceOf(RepositorySelectionError,);
        }
      },
    },),
  ],
},);

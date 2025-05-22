// Have to import the source ts file here because we don't want to run Vitest twice to test both default and node.
import { posix } from 'node:path';
import {
  describe,
  expect,
  test,
} from 'vitest';
import { pathParse } from './fs.pathParse.default.ts';

describe(pathParse, () => {
  // Define test cases covering various scenarios
  test.for([
    // Empty arguments
    { s: '' },
    { s: '/' },
    { s: 'foo' },
    { s: 'foo/bar' },
    { s: '/foo' },
    { s: 'foo//bar' },
    { s: 'foo/./bar' },
    { s: 'foo/../bar' },
  ] as const)('%$ -- $s', ({ s }) => {
    expect(pathParse(s)).toStrictEqual(posix.parse(s));
  });
});

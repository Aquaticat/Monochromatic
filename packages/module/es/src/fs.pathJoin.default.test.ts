// Have to import the source ts file here because we don't want to run Vitest twice to test both default and node.
import { posix } from 'node:path';
import {
  describe,
  expect,
  test,
} from 'vitest';
import {
  pathJoin,
  trimPathTrailingSlash,
} from './fs.pathJoin.default.ts';

describe(pathJoin, () => {
  // Define test cases covering various scenarios
  test.for([
    // Empty arguments
    { s: [] },
    { s: [''] },
    { s: ['/'] },
    { s: ['foo'] },
    { s: ['foo/bar'] },
    { s: ['/foo'] },
    { s: ['foo//bar'] },
    { s: ['foo/./bar'] },
    { s: ['foo/../bar'] },

    // Basic joining
    { s: ['foo', 'bar'] },
    { s: ['foo', '/bar'] },
    { s: ['foo/', '/bar'] },
    { s: ['foo', '..'] },
    { s: ['foo', '..', '..'] },
    { s: ['foo/bar', 'baz'] },
    { s: ['/foo', 'bar'] },

    // Empty segments
    { s: ['', 'foo'] },
    { s: ['foo', ''] },
    { s: ['foo', '', 'bar'] },

    // Absolute paths
    { s: ['/foo', 'bar'] },
    { s: ['foo', '/bar'] },
    { s: ['/foo', '/bar'] },

    // Relative navigation
    { s: ['foo', './bar'] },
    { s: ['foo/bar', '../baz'] },
    { s: ['foo', '..', 'bar'] },
    { s: ['foo', '..', '..', 'bar'] },
    { s: ['.', 'foo'] },
    { s: ['..', 'foo'] },

    // Edge cases
    { s: ['foo', '..'] },
    { s: ['foo/bar', '..'] },
    { s: ['/foo/bar', '../..'] },

    // Trailing slashes
    { s: ['foo/', 'bar'] },
    { s: ['foo', 'bar/'] },

    // Multiple slashes
    { s: ['foo//bar'] },
    { s: ['foo', '//bar'] },

    // Complex paths
    { s: ['a/b/c', '../../d'] },
    { s: ['a/b/你', '../../d'] },
    { s: ['a/b/c.d', '../../d'] },
    { s: ['a/b/你.好', '../../d'] },
    { s: ['a/b/c.', '../../d'] },
    { s: ['a/b/你.', '../../d'] },
    { s: ['a/b/.c', '../../d'] },
    { s: ['a/b/.好', '../../d'] },
    { s: ['/a/b/c', './d/e/f', '../../../g/h'] },
  ] as const)('%$ -- $s', ({ s }) => {
    expect(pathJoin(...s)).toBe(trimPathTrailingSlash(posix.join(...s)));
  });
});

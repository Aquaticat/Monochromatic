import {
  describe,
  expect,
  test,
} from 'bun:test';

import {
  IGNORED_EXTENSIONS,
  shouldIgnoreFile,
} from './tsdoc-utils.ts';

describe('shouldIgnoreFile', () => {
  test.each([...IGNORED_EXTENSIONS,],)('returns true for %s extension', ext => {
    expect(shouldIgnoreFile(`/some/path/file${String(ext,)}`,),).toBe(true,);
  },);

  test('returns false for plain .ts files', () => {
    expect(shouldIgnoreFile('/some/path/file.ts',),).toBe(false,);
  });

  test('returns false for .tsx files', () => {
    expect(shouldIgnoreFile('/some/path/component.tsx',),).toBe(false,);
  });

  test('returns false for empty string', () => {
    expect(shouldIgnoreFile('',),).toBe(false,);
  });

  test('checks suffix, not substring', () => {
    // A file named "test.ts.bak" should not be ignored
    expect(shouldIgnoreFile('/path/file.test.ts.bak',),).toBe(false,);
  });
});

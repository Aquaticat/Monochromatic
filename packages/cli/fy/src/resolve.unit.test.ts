import { describe, expect, test } from 'bun:test';

import { resolveSpecifier } from './resolve.ts';

describe('resolveSpecifier', () => {
  //region Node built-in resolution

  test('resolves node: prefixed built-in modules', async () => {
    const result = await resolveSpecifier({ specifier: 'node:path' });
    expect(result).toBe('node:path');
  });

  test('resolves bare built-in module names', async () => {
    const result = await resolveSpecifier({ specifier: 'path' });
    expect(result).toBe('path');
  });

  //endregion Node built-in resolution

  //region Installed package resolution

  test('resolves a package installed in the workspace', async () => {
    const result = await resolveSpecifier({ specifier: 'nano-spawn' });
    expect(result).toContain('nano-spawn');
  });

  //endregion Installed package resolution

  //region Error cases

  test('throws for a specifier that does not exist anywhere', async () => {
    /* oxlint-disable-next-line typescript-eslint/await-thenable, typescript-eslint/no-confusing-void-expression -- bun:test .rejects.toThrow() pattern */
    await expect(resolveSpecifier({ specifier: 'this-package-definitely-does-not-exist-anywhere-12345' }))
      .rejects.toThrow('Cannot resolve');
  });

  test('includes search locations in error message', async () => {
    /* oxlint-disable-next-line typescript-eslint/await-thenable, typescript-eslint/no-confusing-void-expression -- bun:test .rejects.toThrow() pattern */
    await expect(resolveSpecifier({ specifier: 'nonexistent-pkg-98765' }))
      .rejects.toThrow('CWD');
  });

  //endregion Error cases
});

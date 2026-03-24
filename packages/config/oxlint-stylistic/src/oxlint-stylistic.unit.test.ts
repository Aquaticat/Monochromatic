import {
  copyFileSync,
  readFileSync,
  unlinkSync,
} from 'node:fs';
import { resolve, } from 'node:path';

import {
  afterEach,
  describe,
  expect,
  test,
} from 'bun:test';
import spawn from 'nano-spawn';

//region Types

/** Single diagnostic from oxlint JSON output. */
type OxlintDiagnostic = {
  /** Human-readable error message. */
  readonly message: string;
  /** Rule identifier in `plugin(rule-name)` format. */
  readonly code: string;
  /** `"error"` or `"warning"`. */
  readonly severity: string;
  /** Source file path relative to cwd. */
  readonly filename: string;
};

/** Top-level oxlint `--format json` output. */
type OxlintOutput = {
  /** All reported diagnostics. */
  readonly diagnostics: readonly OxlintDiagnostic[];
};

//endregion Types

//region Helpers

/** Workspace root. */
const ROOT = resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
);

/** Fixture package root. */
const FIXTURE_PKG = resolve(
  ROOT,
  'packages',
  'test-fixture',
  'oxlint-stylistic',
);

/** Fixture source root. */
const FIXTURES = resolve(
  FIXTURE_PKG,
  'src',
);

/**
 * Fixture-specific oxlint config with all stylistic rules enabled and no
 * ignorePatterns that would skip test-fixture or invalid paths.
 */
const FIXTURE_CONFIG = resolve(
  FIXTURE_PKG,
  '.oxlintrc.fixture.json',
);

/**
 * Runs oxlint with the fixture config against a fixture path and returns
 * parsed diagnostics.
 *
 * @param fixturePath - path relative to fixture `src/` root
 *
 * @returns array of diagnostics from stylistic rules only
 */
async function lint(fixturePath: string,): Promise<readonly OxlintDiagnostic[]> {
  const target = resolve(
    FIXTURES,
    fixturePath,
  );

  // oxlint exits non-zero when violations are found -- capture stdout from the error
  let stdout: string;
  try {
    const result = await spawn(
      'oxlint',
      [
        '--format',
        'json',
        '-c',
        FIXTURE_CONFIG,
        target,
      ],
      { cwd: ROOT, },
    );
    ({ stdout, } = result);
  }
  catch (error: unknown) {
    ({ stdout, } = error as { stdout: string; });
  }

  // oxlint-disable-next-line typescript/no-unsafe-assignment -- JSON.parse returns any
  const output: OxlintOutput = JSON.parse(stdout,);

  return output.diagnostics.filter(function isStylisticRule(diagnostic,): boolean {
    return diagnostic.code.startsWith('stylistic(',);
  },);
}

/**
 * Extracts unique rule codes from a set of diagnostics.
 *
 * @param diagnostics - array of oxlint diagnostics
 *
 * @returns sorted array of unique `stylistic(rule-name)` codes
 */
function uniqueRules(diagnostics: readonly OxlintDiagnostic[],): readonly string[] {
  const codes = diagnostics.map(function getCode(d,): string {
    return d.code;
  },);
  const deduped: string[] = [...new Set<string>(codes,),];
  deduped.sort();
  return deduped;
}

//endregion Helpers

//region Valid fixtures -- expect zero stylistic violations

describe(
  'valid fixtures',
  () => {
  test('already-per-line constructs produce no violations', async () => {
    const diagnostics = await lint('valid/already-per-line.ts',);
    expect(diagnostics,).toEqual([],);
  });

  test('single-item constructs produce no violations', async () => {
    const diagnostics = await lint('valid/single-item.ts',);
    expect(diagnostics,).toEqual([],);
  });

  test('empty constructs produce no violations', async () => {
    const diagnostics = await lint('valid/empty-constructs.ts',);
    expect(diagnostics,).toEqual([],);
  });
}
);

//endregion Valid fixtures

//region Invalid fixtures -- expect specific violations

describe(
  'param-per-line',
  () => {
  test('reports params on the same line', async () => {
    const diagnostics = await lint('invalid/param-per-line.ts',);
    const rules = uniqueRules(diagnostics,);
    expect(rules,).toContain('stylistic(param-per-line)',);
  });
}
);

describe(
  'argument-per-line',
  () => {
  test('reports arguments on the same line', async () => {
    const diagnostics = await lint('invalid/argument-per-line.ts',);
    const rules = uniqueRules(diagnostics,);
    expect(rules,).toContain('stylistic(argument-per-line)',);
  });
}
);

describe(
  'array-element-per-line',
  () => {
  test('reports array elements on the same line', async () => {
    const diagnostics = await lint('invalid/array-element-per-line.ts',);
    const rules = uniqueRules(diagnostics,);
    expect(rules,).toContain('stylistic(array-element-per-line)',);
  });
}
);

describe(
  'object-property-per-line',
  () => {
  test('reports object properties on the same line', async () => {
    const diagnostics = await lint('invalid/object-property-per-line.ts',);
    const rules = uniqueRules(diagnostics,);
    expect(rules,).toContain('stylistic(object-property-per-line)',);
  });
}
);

describe(
  'import-per-line',
  () => {
  test('reports import specifiers on the same line', async () => {
    const diagnostics = await lint('invalid/import-per-line.ts',);
    const rules = uniqueRules(diagnostics,);
    expect(rules,).toContain('stylistic(import-per-line)',);
  });
}
);

describe(
  'export-per-line',
  () => {
  test('reports export specifiers on the same line', async () => {
    const diagnostics = await lint('invalid/export-per-line.ts',);
    const rules = uniqueRules(diagnostics,);
    expect(rules,).toContain('stylistic(export-per-line)',);
  });
}
);

describe(
  'type-property-per-line',
  () => {
  test('reports type members on the same line', async () => {
    const diagnostics = await lint('invalid/type-property-per-line.ts',);
    const rules = uniqueRules(diagnostics,);
    expect(rules,).toContain('stylistic(type-property-per-line)',);
  });
}
);

describe(
  'tuple-per-line',
  () => {
  test('reports tuple elements on the same line', async () => {
    const diagnostics = await lint('invalid/tuple-per-line.ts',);
    const rules = uniqueRules(diagnostics,);
    expect(rules,).toContain('stylistic(tuple-per-line)',);
  });
}
);

describe(
  'destructure-per-line',
  () => {
  test('reports destructured properties on the same line', async () => {
    const diagnostics = await lint('invalid/destructure-per-line.ts',);
    const rules = uniqueRules(diagnostics,);
    expect(rules,).toContain('stylistic(destructure-per-line)',);
  });
}
);

//endregion Invalid fixtures

//region Autofix tests

describe(
  'autofix',
  () => {
  /** Temporary copy of fixable.ts that gets modified by --fix. */
  const fixableSrc = resolve(
    FIXTURES,
    'invalid',
    'fixable.ts',
  );
  const fixableCopy = resolve(
    FIXTURES,
    'invalid',
    'fixable.copy.ts',
  );

  afterEach(() => {
    try {
      unlinkSync(fixableCopy,);
    }
    catch {
      // file may not exist if test failed before creating it
    }
  });

  test('--fix produces zero violations', async () => {
    // Copy the fixable fixture so --fix doesn't modify the original
    copyFileSync(fixableSrc, fixableCopy,);

    // Run --fix on the copy
    try {
      await spawn(
        'oxlint',
        [
          '--fix',
          '-c',
          FIXTURE_CONFIG,
          fixableCopy,
        ],
        { cwd: ROOT, },
      );
    }
    catch {
      // --fix may still exit non-zero if unfixable issues remain
    }

    // Re-lint the fixed copy
    const diagnostics = await lint('invalid/fixable.copy.ts',);
    const stylisticDiags = diagnostics.filter(
      function isStylistic(d,): boolean {
        return d.code.startsWith('stylistic(',);
      },
    );
    expect(stylisticDiags,).toEqual([],);
  });

  test('--fix preserves trailing commas', async () => {
    const trailingSrc = resolve(
      FIXTURES,
      'invalid',
      'fixable-trailing-comma.ts',
    );
    const trailingCopy = resolve(
      FIXTURES,
      'invalid',
      'fixable-trailing-comma.copy.ts',
    );
    copyFileSync(trailingSrc, trailingCopy,);

    try {
      await spawn(
        'oxlint',
        [
          '--fix',
          '-c',
          FIXTURE_CONFIG,
          trailingCopy,
        ],
        { cwd: ROOT, },
      );
    }
    catch {
      // --fix may still exit non-zero
    }

    const fixedContent = readFileSync(trailingCopy, 'utf8',);

    // Trailing commas should be preserved on all items including the last
    expect(fixedContent,).toContain('  name: string,',);
    expect(fixedContent,).toContain('  age: number,',);
    expect(fixedContent,).toMatch(/\s+3,\n/,);
    expect(fixedContent,).toContain('  port: 3000,',);
    expect(fixedContent,).toContain('  port,',);

    try {
      unlinkSync(trailingCopy,);
    }
    catch {
      // cleanup best-effort
    }
  });

  test('--fix places each item on its own line', async () => {
    copyFileSync(fixableSrc, fixableCopy,);

    try {
      await spawn(
        'oxlint',
        [
          '--fix',
          '-c',
          FIXTURE_CONFIG,
          fixableCopy,
        ],
        { cwd: ROOT, },
      );
    }
    catch {
      // --fix may still exit non-zero
    }

    const fixedContent = readFileSync(fixableCopy, 'utf8',);

    // After fix, multi-param function should have params on separate lines.
    // No trailing comma since the original had none.
    expect(fixedContent,).toContain('  name: string,',);
    expect(fixedContent,).toMatch(/\s+age: number\n/,);

    // Array elements should be on separate lines
    expect(fixedContent,).toMatch(/\[\n\s+1,\n\s+2,\n\s+3,?\n/,);

    // Object properties should be on separate lines
    expect(fixedContent,).toContain("  host: 'localhost',",);
    expect(fixedContent,).toMatch(/\s+port: 3000\n/,);
  });
}
);

//endregion Autofix tests

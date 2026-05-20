import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir, } from 'node:os';
import {
  isAbsolute,
  join,
  resolve,
} from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import spawn from 'nano-spawn';

//region Types

/** Single diagnostic from oxlint JSON output. */
type OxlintDiagnostic = {
  /** Human-readable error message. */
  readonly message: string;
  /** Rule identifier in `plugin(rule-name)` format. Absent for runner-level errors. */
  readonly code?: string;
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

/** Disposable temp copy of a fixture file. */
type TempFixtureFile = {
  /** Absolute path to copied fixture file. */
  readonly filePath: string;
  /** Removes temp directory that contains fixture copy. */
  [Symbol.dispose](): void;
};

/** Options for creating a disposable fixture copy. */
type TempFixtureFileOptions = {
  /** Basename for copied temp file. */
  readonly fileName: string;
  /** Source fixture path to copy into temp directory. */
  readonly sourcePath: string;
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
 * @param fixturePath - path relative to fixture `src/` root, or absolute path
 *   to a temp fixture
 *
 * @returns array of diagnostics from stylistic rules only
 */
async function lint(fixturePath: string,): Promise<readonly OxlintDiagnostic[]> {
  /** Resolved lint target; temp fixtures already arrive as absolute paths. */
  const target = isAbsolute(fixturePath,)
    ? fixturePath
    : resolve(
      FIXTURES,
      fixturePath,
    );

  // oxlint exits non-zero when violations are found: capture stdout from the error
  async function captureStdout(): Promise<string> {
    try {
      const { stdout, } = await spawn(
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
      return stdout;
    }
    catch (error: unknown) {
      return (error as { stdout: string; }).stdout;
    }
  }
  const stdout = await captureStdout();

  // oxlint-disable-next-line typescript/no-unsafe-assignment -- JSON.parse returns any
  const output: OxlintOutput = JSON.parse(stdout,);

  return output.diagnostics.filter(function isStylisticRule(diagnostic,): boolean {
    // Defensive: some runner-level error diagnostics omit `code` entirely.
    return ((typeof diagnostic.code) === 'string')
      && diagnostic.code.startsWith('stylistic(',);
  },);
}

/**
 * Creates a temp fixture copy with disposal-backed directory cleanup.
 *
 * @param options - fixture source and temp basename
 *
 * @returns copied temp fixture file handle
 */
function createTempFixtureFile(
  {
    fileName,
    sourcePath,
  }: TempFixtureFileOptions,
): TempFixtureFile {
  /** Unique temp directory owning this fixture copy. */
  const dirPath = mkdtempSync(
    join(
      tmpdir(),
      'oxlint-stylistic-autofix-',
    ),
  );
  /** Absolute path to temp fixture copy. */
  const filePath = resolve(
    dirPath,
    fileName,
  );
  copyFileSync(sourcePath, filePath,);

  return {
    filePath,
    [Symbol.dispose]: function cleanup(): void {
      rmSync(
        dirPath,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 * Extracts unique rule codes from a set of diagnostics.
 *
 * @param diagnostics - array of oxlint diagnostics
 *
 * @returns sorted array of unique `stylistic(rule-name)` codes
 */
function uniqueRules(diagnostics: readonly OxlintDiagnostic[],): readonly string[] {
  const codes = diagnostics.flatMap(function getCode(d,): string[] {
    return d.code === undefined ? [] : [d.code,];
  },);
  const deduped: string[] = [...new Set<string>(codes,),];
  deduped.sort();
  return deduped;
}

//endregion Helpers

await describe({
  name: '',
  children: [
    //region Valid fixtures: expect zero stylistic violations

    describe({
      name: 'valid fixtures',
      children: [
        it({
          name: 'already-per-line constructs produce no violations',
          fn: async () => {
            const diagnostics = await lint('valid/already-per-line.ts',);
            expect(diagnostics,).toEqual([],);
          },
        },),
        it({
          name: 'single-item constructs produce no violations',
          fn: async () => {
            const diagnostics = await lint('valid/single-item.ts',);
            expect(diagnostics,).toEqual([],);
          },
        },),
        it({
          name: 'empty constructs produce no violations',
          fn: async () => {
            const diagnostics = await lint('valid/empty-constructs.ts',);
            expect(diagnostics,).toEqual([],);
          },
        },),
        it({
          name: 'no-mixed-operators valid cases produce no violations',
          fn: async () => {
            const diagnostics = await lint('valid/no-mixed-operators.ts',);
            expect(diagnostics,).toEqual([],);
          },
        },),
        it({
          name: 'chain-per-line valid cases produce no violations',
          fn: async () => {
            const diagnostics = await lint('valid/chain-per-line.ts',);
            expect(diagnostics,).toEqual([],);
          },
        },),
      ],
    },),

    //endregion Valid fixtures

    //region Invalid fixtures: expect specific violations

    describe({
      name: 'param-per-line',
      children: [
        it({
          name: 'reports params on the same line',
          fn: async () => {
            const diagnostics = await lint('invalid/param-per-line.ts',);
            const rules = uniqueRules(diagnostics,);
            expect(rules,).toContain('stylistic(param-per-line)',);
          },
        },),
      ],
    },),
    describe({
      name: 'argument-per-line',
      children: [
        it({
          name: 'reports arguments on the same line',
          fn: async () => {
            const diagnostics = await lint('invalid/argument-per-line.ts',);
            const rules = uniqueRules(diagnostics,);
            expect(rules,).toContain('stylistic(argument-per-line)',);
          },
        },),
      ],
    },),
    describe({
      name: 'array-element-per-line',
      children: [
        it({
          name: 'reports array elements on the same line',
          fn: async () => {
            const diagnostics = await lint('invalid/array-element-per-line.ts',);
            const rules = uniqueRules(diagnostics,);
            expect(rules,).toContain('stylistic(array-element-per-line)',);
          },
        },),
      ],
    },),
    describe({
      name: 'object-property-per-line',
      children: [
        it({
          name: 'reports object properties on the same line',
          fn: async () => {
            const diagnostics = await lint('invalid/object-property-per-line.ts',);
            const rules = uniqueRules(diagnostics,);
            expect(rules,).toContain('stylistic(object-property-per-line)',);
          },
        },),
      ],
    },),
    describe({
      name: 'import-per-line',
      children: [
        it({
          name: 'reports import specifiers on the same line',
          fn: async () => {
            const diagnostics = await lint('invalid/import-per-line.ts',);
            const rules = uniqueRules(diagnostics,);
            expect(rules,).toContain('stylistic(import-per-line)',);
          },
        },),
      ],
    },),
    describe({
      name: 'export-per-line',
      children: [
        it({
          name: 'reports export specifiers on the same line',
          fn: async () => {
            const diagnostics = await lint('invalid/export-per-line.ts',);
            const rules = uniqueRules(diagnostics,);
            expect(rules,).toContain('stylistic(export-per-line)',);
          },
        },),
      ],
    },),
    describe({
      name: 'type-property-per-line',
      children: [
        it({
          name: 'reports type members on the same line',
          fn: async () => {
            const diagnostics = await lint('invalid/type-property-per-line.ts',);
            const rules = uniqueRules(diagnostics,);
            expect(rules,).toContain('stylistic(type-property-per-line)',);
          },
        },),
      ],
    },),
    describe({
      name: 'tuple-per-line',
      children: [
        it({
          name: 'reports tuple elements on the same line',
          fn: async () => {
            const diagnostics = await lint('invalid/tuple-per-line.ts',);
            const rules = uniqueRules(diagnostics,);
            expect(rules,).toContain('stylistic(tuple-per-line)',);
          },
        },),
      ],
    },),
    describe({
      name: 'destructure-per-line',
      children: [
        it({
          name: 'reports destructured properties on the same line',
          fn: async () => {
            const diagnostics = await lint('invalid/destructure-per-line.ts',);
            const rules = uniqueRules(diagnostics,);
            expect(rules,).toContain('stylistic(destructure-per-line)',);
          },
        },),
      ],
    },),
    describe({
      name: 'no-mixed-operators',
      children: [
        it({
          name: 'reports nested mixed-operator expressions without parens',
          fn: async () => {
            const diagnostics = await lint('invalid/no-mixed-operators.ts',);
            const rules = uniqueRules(diagnostics,);
            expect(rules,).toContain('stylistic(no-mixed-operators)',);
          },
        },),
      ],
    },),
    describe({
      name: 'chain-per-line',
      children: [
        it({
          name: 'reports chained expressions whose boundaries share a line',
          fn: async () => {
            const diagnostics = await lint('invalid/chain-per-line.ts',);
            const rules = uniqueRules(diagnostics,);
            expect(rules,).toContain('stylistic(chain-per-line)',);
          },
        },),
        it({
          name:
            'reports both chain-per-line and no-mixed-operators on a combined fixture',
          fn: async () => {
            const diagnostics = await lint(
              'invalid/chain-and-mixed-operators.ts',
            );
            const rules = uniqueRules(diagnostics,);
            expect(rules,).toContain('stylistic(chain-per-line)',);
            expect(rules,).toContain('stylistic(no-mixed-operators)',);
          },
        },),
      ],
    },),
    describe({
      name: 'one-var-declaration-per-line',
      children: [
        it({
          name: 'reports multi-declarator declarations on the same line',
          fn: async () => {
            const diagnostics = await lint('invalid/one-var-declaration-per-line.ts',);
            const rules = uniqueRules(diagnostics,);
            expect(rules,).toContain('stylistic(one-var-declaration-per-line)',);
          },
        },),
      ],
    },),
    describe({
      name: 'max-statements-per-line',
      children: [
        it({
          name: 'reports multiple statements on the same line',
          fn: async () => {
            const diagnostics = await lint('invalid/max-statements-per-line.ts',);
            const rules = uniqueRules(diagnostics,);
            expect(rules,).toContain('stylistic(max-statements-per-line)',);
          },
        },),
      ],
    },),

    //endregion Invalid fixtures

    //region Autofix tests

    describe({
      name: 'autofix',
      children: [
        it({
          name: '--fix produces zero violations',
          fn: async () => {
            /** Source fixture copied so --fix never mutates original fixture. */
            const fixableSrc = resolve(
              FIXTURES,
              'invalid',
              'fixable.ts',
            );
            /** Temp fixture copy isolated from parallel autofix tests. */
            using fixableCopy = createTempFixtureFile({
              fileName: 'fixable.ts',
              sourcePath: fixableSrc,
            },);

            // Run --fix on the copy
            try {
              await spawn(
                'oxlint',
                [
                  '--fix',
                  '-c',
                  FIXTURE_CONFIG,
                  fixableCopy.filePath,
                ],
                { cwd: ROOT, },
              );
            }
            catch {
              // --fix may still exit non-zero if unfixable issues remain
            }

            // Re-lint the fixed copy
            const diagnostics = await lint(fixableCopy.filePath,);
            const stylisticDiags = diagnostics.filter(
              function isStylistic(d,): boolean {
                return ((typeof d.code) === 'string')
                  && d.code.startsWith('stylistic(',);
              },
            );
            expect(stylisticDiags,).toEqual([],);
          },
        },),
        it({
          name: '--fix preserves trailing commas',
          fn: async () => {
            /** Source fixture copied so --fix never mutates original fixture. */
            const trailingSrc = resolve(
              FIXTURES,
              'invalid',
              'fixable-trailing-comma.ts',
            );
            /** Temp fixture copy isolated from parallel autofix tests. */
            using trailingCopy = createTempFixtureFile({
              fileName: 'fixable-trailing-comma.ts',
              sourcePath: trailingSrc,
            },);

            try {
              await spawn(
                'oxlint',
                [
                  '--fix',
                  '-c',
                  FIXTURE_CONFIG,
                  trailingCopy.filePath,
                ],
                { cwd: ROOT, },
              );
            }
            catch {
              // --fix may still exit non-zero
            }

            const fixedContent = readFileSync(trailingCopy.filePath, 'utf8',);

            // Trailing commas should be preserved on all items including the last
            expect(fixedContent,).toContain('  name: string,',);
            expect(fixedContent,).toContain('  age: number,',);
            expect(fixedContent,).toContain('  3,\n',);
            expect(fixedContent,).toContain('  port: 3000,',);
            expect(fixedContent,).toContain('  port,',);
          },
        },),
        it({
          name: '--fix converges on a chain-per-line fixture (idempotent)',
          fn: async () => {
            /** Source fixture copied so --fix never mutates original fixture. */
            const chainSrc = resolve(
              FIXTURES,
              'invalid',
              'chain-per-line.ts',
            );
            /** Temp fixture copy isolated from parallel autofix tests. */
            using chainCopy = createTempFixtureFile({
              fileName: 'chain-per-line.ts',
              sourcePath: chainSrc,
            },);

            try {
              await spawn(
                'oxlint',
                [
                  '--fix',
                  '-c',
                  FIXTURE_CONFIG,
                  chainCopy.filePath,
                ],
                { cwd: ROOT, },
              );
            }
            catch {
              // --fix may exit non-zero when unfixable issues remain
            }

            const diagnostics = await lint(chainCopy.filePath,);
            const stylisticDiags = diagnostics.filter(
              function isStylistic(d,): boolean {
                return ((typeof d.code) === 'string')
                  && d.code.startsWith('stylistic(',);
              },
            );
            expect(stylisticDiags,).toEqual([],);
          },
        },),
        it({
          name:
            '--fix converges when chain-per-line and no-mixed-operators apply together',
          fn: async () => {
            /** Source fixture copied so --fix never mutates original fixture. */
            const combinedSrc = resolve(
              FIXTURES,
              'invalid',
              'chain-and-mixed-operators.ts',
            );
            /** Temp fixture copy isolated from parallel autofix tests. */
            using combinedCopy = createTempFixtureFile({
              fileName: 'chain-and-mixed-operators.ts',
              sourcePath: combinedSrc,
            },);

            // Two passes: oxlint applies one fix per overlapping byte region per
            // pass, so when no-mixed-operators wraps a region containing the
            // chain-per-line target, chain-per-line waits until the next pass.
            // Two passes are sufficient for this fixture's rule interaction.
            for (const _pass of [
              0,
              1,
            ]) {
              try {
                // oxlint-disable-next-line eslint/no-await-in-loop -- second pass must read the first pass's output from disk
                await spawn(
                  'oxlint',
                  [
                    '--fix',
                    '-c',
                    FIXTURE_CONFIG,
                    combinedCopy.filePath,
                  ],
                  { cwd: ROOT, },
                );
              }
              catch {
                // --fix may exit non-zero when unfixable issues remain
              }
            }

            const diagnostics = await lint(combinedCopy.filePath,);
            const stylisticDiags = diagnostics.filter(
              function isStylistic(d,): boolean {
                return ((typeof d.code) === 'string')
                  && d.code.startsWith('stylistic(',);
              },
            );
            expect(stylisticDiags,).toEqual([],);
          },
        },),
        it({
          name: '--fix places each item on its own line',
          fn: async () => {
            /** Source fixture copied so --fix never mutates original fixture. */
            const fixableSrc = resolve(
              FIXTURES,
              'invalid',
              'fixable.ts',
            );
            /** Temp fixture copy isolated from parallel autofix tests. */
            using fixableCopy = createTempFixtureFile({
              fileName: 'fixable.ts',
              sourcePath: fixableSrc,
            },);

            try {
              await spawn(
                'oxlint',
                [
                  '--fix',
                  '-c',
                  FIXTURE_CONFIG,
                  fixableCopy.filePath,
                ],
                { cwd: ROOT, },
              );
            }
            catch {
              // --fix may still exit non-zero
            }

            const fixedContent = readFileSync(fixableCopy.filePath, 'utf8',);

            // After fix, multi-param function should have params on separate lines.
            // No trailing comma since the original had none.
            expect(fixedContent,).toContain('  name: string,',);
            expect(fixedContent,).toContain('  age: number\n',);

            // Array elements should be on separate lines
            expect(fixedContent,).toContain('[\n  1,\n  2,\n  3',);

            // Object properties should be on separate lines
            expect(fixedContent,).toContain("  host: 'localhost',",);
            expect(fixedContent,).toContain('  port: 3000\n',);

            // Multi-declarator declaration should be split across lines.
            expect(fixedContent,).toContain('const m = 1,\n  n = 2;',);

            // Two statements on a line should be split across lines.
            expect(fixedContent,).toContain('const p = 10;\nconst q = 20;',);
          },
        },),
      ],
    },),
    //endregion Autofix tests
  ],
},);

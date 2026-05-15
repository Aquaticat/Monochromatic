import { resolve, } from 'node:path';

import { findMonorepoRoot, } from '@monochromatic-dev/module-fs-path/find-monorepo-root';
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
const ROOT = await findMonorepoRoot({ cwd: import.meta.dirname, },);

/** Fixture package root. */
const FIXTURE_PKG = resolve(ROOT, 'packages', 'test-fixture', 'oxlint-tsdoc',);

/** Fixture source root. */
const FIXTURES = resolve(FIXTURE_PKG, 'src',);

/**
 * Fixture-specific oxlint config with all tsdoc rules enabled and no ignorePatterns
 * that would skip test-fixture or invalid paths.
 */
const FIXTURE_CONFIG = resolve(FIXTURE_PKG, '.oxlintrc.fixture.json',);

/**
 * Runs oxlint with the project config against a fixture path and returns parsed diagnostics.
 *
 * @param fixturePath - path relative to fixture root
 *
 * @returns array of diagnostics from tsdoc rules only
 */
async function lint(fixturePath: string,): Promise<readonly OxlintDiagnostic[]> {
  const target = resolve(FIXTURES, fixturePath,);

  // oxlint exits non-zero when violations are found: capture stdout from the error
  async function captureStdout(): Promise<string> {
    try {
      const { stdout, } = await spawn('oxlint', ['--format', 'json', '-c', FIXTURE_CONFIG,
        target,], {
        cwd: ROOT,
      },);
      return stdout;
    }
    catch (error: unknown) {
      return (error as { stdout: string; }).stdout;
    }
  }
  const stdout = await captureStdout();

  // oxlint-disable-next-line typescript/no-unsafe-assignment -- JSON.parse returns any
  const output: OxlintOutput = JSON.parse(stdout,);

  // Filter to only tsdoc plugin diagnostics so built-in rules don't interfere
  return output.diagnostics.filter(function isTsdocRule(diagnostic,): boolean {
    return diagnostic.code.startsWith('tsdoc(',);
  },);
}

/**
 * Extracts unique rule codes from a set of diagnostics.
 *
 * @param diagnostics - array of oxlint diagnostics
 *
 * @returns sorted array of unique `tsdoc(rule-name)` codes
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

await describe({
  name: '',
  children: [
    //region Valid fixtures: expect zero tsdoc violations

    describe({
      name: 'valid fixtures',
      children: [
        it({
          name: 'fully documented declarations produce no violations',
          fn: async () => {
            const diagnostics = await lint('valid/documented-declarations.ts',);
            expect(diagnostics,).toEqual([],);
          },
        },),
        it({
          name: 'complete TSDoc with params, returns, yields produce no violations',
          fn: async () => {
            const diagnostics = await lint('valid/complete-tsdoc.ts',);
            expect(diagnostics,).toEqual([],);
          },
        },),
        it({
          name: '.test.ts files are ignored by tsdoc rules',
          fn: async () => {
            const diagnostics = await lint('valid/ignored-extensions.test.ts',);
            expect(diagnostics,).toEqual([],);
          },
        },),
        it({
          name: 'documented local declarations produce no violations',
          fn: async () => {
            const diagnostics = await lint('valid/documented-locals.ts',);
            expect(diagnostics,).toEqual([],);
          },
        },),
      ],
    },),

    //endregion Valid fixtures

    //region Invalid fixtures: expect specific violations

    describe({
      name: 'require-tsdoc',
      children: [
        it({
          name: 'reports missing TSDoc on undocumented declarations',
          fn: async () => {
            const diagnostics = await lint('invalid/missing-tsdoc.ts',);
            const rules = uniqueRules(diagnostics,);
            expect(rules,).toContain('tsdoc(require-tsdoc)',);

            // Every diagnostic should be require-tsdoc since file has no TSDoc at all
            const requireTsdocCount = diagnostics
              .filter(
                function isRequireTsdoc(d,): boolean {
                  return d.code === 'tsdoc(require-tsdoc)';
                },
              )
              .length;
            // function, arrow, class, type, interface, enum, const = at least 7
            expect(requireTsdocCount,).toBeGreaterThanOrEqual(7,);
          },
        },),
        it({
          name:
            'reports missing TSDoc on undocumented locals while exempting for-loop bindings',
          fn: async () => {
            const diagnostics = await lint('invalid/missing-tsdoc-locals.ts',);
            const requireTsdocDiags = diagnostics.filter(
              function isRequireTsdoc(d,): boolean {
                return d.code === 'tsdoc(require-tsdoc)';
              },
            );
            // out, count, next, empty: four locals; for-loop `const v` is exempt; outer fn has TSDoc.
            const EXPECTED_LOCAL_VIOLATIONS = 4;
            expect(requireTsdocDiags.length,).toBe(EXPECTED_LOCAL_VIOLATIONS,);
          },
        },),
      ],
    },),
    describe({
      name: 'structural rules',
      children: [
        it({
          name: 'reports structural formatting issues',
          fn: async () => {
            const diagnostics = await lint('invalid/structural-issues.ts',);
            const rules = uniqueRules(diagnostics,);

            expect(rules,).toContain('tsdoc(multiline-blocks)',);
            expect(rules,).toContain('tsdoc(no-multi-asterisks)',);
            expect(rules,).toContain('tsdoc(tag-lines)',);
            expect(rules,).toContain('tsdoc(empty-tags)',);
          },
        },),
      ],
    },),
    describe({
      name: 'tag validation rules',
      children: [
        it({
          name: 'reports invalid tag names and type annotations',
          fn: async () => {
            const diagnostics = await lint('invalid/tag-validation-issues.ts',);
            const rules = uniqueRules(diagnostics,);

            expect(rules,).toContain('tsdoc(check-tag-names)',);
            expect(rules,).toContain('tsdoc(check-access)',);
            expect(rules,).toContain('tsdoc(no-types)',);
          },
        },),
        it({
          name: 'reports specific JSDoc-only tags',
          fn: async () => {
            const diagnostics = await lint('invalid/tag-validation-issues.ts',);
            const tagNameDiags = diagnostics.filter(
              function isCheckTagNames(d,): boolean {
                return d.code === 'tsdoc(check-tag-names)';
              },
            );

            const messages = tagNameDiags.map(function getMsg(d,): string {
              return d.message;
            },);
            // @type, @typedef, @return, @foobar should all be flagged
            expect(messages.some(function hasType(m,): boolean {
              return m.includes('@type',);
            },),)
              .toBe(true,);
            expect(messages.some(function hasTypedef(m,): boolean {
              return m.includes('@typedef',);
            },),)
              .toBe(true,);
            expect(messages.some(function hasReturn(m,): boolean {
              return m.includes('@return',);
            },),)
              .toBe(true,);
            expect(messages.some(function hasFoobar(m,): boolean {
              return m.includes('@foobar',);
            },),)
              .toBe(true,);
          },
        },),
      ],
    },),
    describe({
      name: 'param rules',
      children: [
        it({
          name: 'reports parameter documentation issues',
          fn: async () => {
            const diagnostics = await lint('invalid/param-issues.ts',);
            const rules = uniqueRules(diagnostics,);

            expect(rules,).toContain('tsdoc(check-param-names)',);
            expect(rules,).toContain('tsdoc(require-param)',);
            expect(rules,).toContain('tsdoc(require-param-description)',);
          },
        },),
      ],
    },),
    describe({
      name: 'returns rules',
      children: [
        it({
          name: 'reports return documentation issues',
          fn: async () => {
            const diagnostics = await lint('invalid/returns-issues.ts',);
            const rules = uniqueRules(diagnostics,);

            expect(rules,).toContain('tsdoc(require-returns)',);
            expect(rules,).toContain('tsdoc(require-returns-check)',);
            expect(rules,).toContain('tsdoc(require-returns-description)',);
          },
        },),
      ],
    },),
    describe({
      name: 'yields rules',
      children: [
        it({
          name: 'reports yield documentation issues',
          fn: async () => {
            const diagnostics = await lint('invalid/yields-issues.ts',);
            const rules = uniqueRules(diagnostics,);

            expect(rules,).toContain('tsdoc(require-yields)',);
            expect(rules,).toContain('tsdoc(require-yields-check)',);
          },
        },),
      ],
    },),

    describe({
      name: 'require-example',
      children: [
        it({
          name: 'reports missing @example on exported functions',
          fn: async () => {
            const diagnostics = await lint('invalid/require-example-issues.ts',);
            const rules = uniqueRules(diagnostics,);

            expect(rules,).toContain('tsdoc(require-example)',);

            const requireExampleDiags = diagnostics.filter(
              function isRequireExample(d,): boolean {
                return d.code === 'tsdoc(require-example)';
              },
            );
            // add (direct), greet (specifier), negate (default), double (const direct), shout (const specifier)
            expect(requireExampleDiags.length,).toBeGreaterThanOrEqual(5,);
          },
        },),
        it({
          name: 'does not report on functions with @example or exempt tags',
          fn: async () => {
            const diagnostics = await lint('valid/require-example-valid.ts',);
            const requireExampleDiags = diagnostics.filter(
              function isRequireExample(d,): boolean {
                return d.code === 'tsdoc(require-example)';
              },
            );
            expect(requireExampleDiags,).toEqual([],);
          },
        },),
      ],
    },),
    //endregion Invalid fixtures
  ],
},);

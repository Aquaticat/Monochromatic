import { resolve, } from 'node:path';

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
  'oxlint-no-restricted-syntax',
);

/** Fixture source root. */
const FIXTURES = resolve(
  FIXTURE_PKG,
  'src',
);

/**
 * Fixture-specific oxlint config with all no-restricted-syntax rules enabled
 * and no ignorePatterns that would skip test-fixture or invalid paths.
 */
const FIXTURE_CONFIG = resolve(
  FIXTURE_PKG,
  '.oxlintrc.fixture.json',
);

/**
 * Runs oxlint with the fixture config against a fixture path and returns
 * parsed diagnostics filtered to the no-restricted-syntax plugin.
 *
 * @example
 * ```ts
 * const diags = await lint('invalid/no-switch.ts');
 * ```
 */
async function lint(fixturePath: string,): Promise<readonly OxlintDiagnostic[]> {
  const target = resolve(
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

  return output.diagnostics.filter(
    function isNoRestrictedSyntax(diagnostic,): boolean {
      return diagnostic.code.startsWith('no-restricted-syntax(',);
    },
  );
}

/**
 * Extracts unique rule codes from a set of diagnostics.
 *
 * @example
 * ```ts
 * uniqueRules(diags); // → ['no-restricted-syntax(no-switch)']
 * ```
 */
function uniqueRules(
  diagnostics: readonly OxlintDiagnostic[],
): readonly string[] {
  return [
    ...new Set(diagnostics.map(
      function pickCode(d,): string {
        return d.code;
      },
    ),),
  ]
    .toSorted();
}

/**
 * Names of the substantive syntax rules; each has a fixture in `invalid/`
 * that triggers the rule.
 */
const SUBSTANTIVE_RULES = [
  'no-arrow-function',
  'no-class',
  'no-enum',
  'no-for-in',
  'no-function-root-let',
  'no-hasownproperty',
  'no-module-root-let',
  'no-promise-catch',
  'no-promise-finally',
  'no-rest-params',
  'no-switch',
  'no-trim-left-right',
  'no-try-finally',
  'no-variable-function-expression',
  'prefer-describe-function-ref-name',
  'require-destructured-params',
  'require-queryselector-generic',
  'require-regex-justification',
] as const;

/**
 * Names of the ban-disable rules; each has a fixture in `invalid/`
 * containing an `oxlint-disable` comment for the targeted rule.
 */
const BAN_DISABLE_RULES = [
  'no-disable-max-lines',
  'no-disable-no-arrow-function',
  'no-disable-no-enum',
  'no-disable-no-for-in',
  'no-disable-no-hasownproperty',
  'no-disable-no-misused-promises',
  'no-disable-no-non-null-assertion',
  'no-disable-no-promise-catch',
  'no-disable-no-promise-finally',
  'no-disable-no-rest-params',
  'no-disable-no-switch',
  'no-disable-no-trim-left-right',
  'no-disable-no-try-finally',
  'no-disable-no-useless-return',
  'no-disable-no-variable-function-expression',
  'no-disable-prefer-regexp-exec',
  'no-disable-require-destructured-params',
  'no-disable-require-returns',
  'no-disable-require-tsdoc',
] as const;

//endregion Helpers

await describe({
  name: 'oxlint-no-restricted-syntax',
  children: [
    describe({
      name: 'substantive rules',
      children: SUBSTANTIVE_RULES.map(function mapRule(rule,) {
        return it({
          name: `reports ${rule} when violated`,
          fn: async () => {
            const diagnostics = await lint(`invalid/${rule}.ts`,);
            const rules = uniqueRules(diagnostics,);
            expect(rules,).toContain(`no-restricted-syntax(${rule})`,);
          },
        },);
      },),
    },),
    describe({
      name: 'ban-disable rules',
      children: BAN_DISABLE_RULES.map(function mapRule(rule,) {
        return it({
          name: `reports ${rule} when oxlint-disable for the targeted rule is present`,
          fn: async () => {
            const diagnostics = await lint(`invalid/${rule}.ts`,);
            const rules = uniqueRules(diagnostics,);
            expect(rules,).toContain(`no-restricted-syntax(${rule})`,);
          },
        },);
      },),
    },),
    describe({
      name: 'valid fixtures',
      children: [
        it({
          name: 'all-rules-passing fixture produces no violations',
          fn: async () => {
            const diagnostics = await lint('valid/all-rules-passing.ts',);
            expect(diagnostics,).toEqual([],);
          },
        },),
        it({
          name: 'prefer-describe-function-ref-name skips non-callable bindings',
          fn: async () => {
            const diagnostics = await lint(
              'valid/prefer-describe-function-ref-name-constants.ts',
            );
            expect(diagnostics,).toEqual([],);
          },
        },),
        it({
          name: 'require-regex-justification accepts scoped disable justifications',
          fn: async () => {
            const diagnostics = await lint(
              'valid/require-regex-justification.ts',
            );
            expect(diagnostics,).toEqual([],);
          },
        },),
      ],
    },),
    describe({
      name: 'diagnostic messages',
      children: [
        it({
          name:
            'require-regex-justification reports each regex form with specific guidance',
          fn: async () => {
            const diagnostics = await lint('invalid/require-regex-justification.ts',);
            expect(diagnostics.map(function message(diagnostic,): string {
              return diagnostic.message;
            },),)
              .toEqual([
                'Regex literal requires a scoped disable with justification. Prefer an index scan, parser, or string API; if regex is still right, add `oxlint-disable-next-line no-restricted-syntax/require-regex-justification -- <why regex, input bounds, backtracking safety>`.',
                'RegExp constructor requires a scoped disable with justification. Explain why dynamic regex compilation is needed, what bounds the pattern/input, and why matching stays safe.',
                'RegExp constructor requires a scoped disable with justification. Explain why dynamic regex compilation is needed, what bounds the pattern/input, and why matching stays safe.',
                'String#match() with an inline regex requires a scoped disable with justification. Explain why regex is clearer than a string API or parser, and what bounds matching cost.',
                'String#matchAll() with an inline regex requires a scoped disable with justification. Explain why regex is clearer than a string API or parser, and what bounds matching cost.',
                'String#replace() with an inline regex requires a scoped disable with justification. Explain why regex is clearer than a string API or parser, and what bounds matching cost.',
                'String#replaceAll() with an inline regex requires a scoped disable with justification. Explain why regex is clearer than a string API or parser, and what bounds matching cost.',
                'String#search() with an inline regex requires a scoped disable with justification. Explain why regex is clearer than a string API or parser, and what bounds matching cost.',
                'String#split() with an inline regex requires a scoped disable with justification. Explain why regex is clearer than a string API or parser, and what bounds matching cost.',
              ],);
          },
        },),
      ],
    },),
  ],
},);

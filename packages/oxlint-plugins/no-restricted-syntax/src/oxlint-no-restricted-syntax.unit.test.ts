import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir, } from 'node:os';
import {
  join,
  resolve,
} from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import spawn from 'nano-spawn';

import {
  fixtureConfigPath,
  fixturePackageRoot,
  fixtureSourceRoot,
  type OxlintRuleDiagnostic as OxlintDiagnostic,
  OXLINT_PLUGIN_TEST_ROOT as ROOT,
  resolveFixtureTarget,
  runOxlintFixture,
  uniqueRuleCodes as uniqueRules,
} from '@monochromatic-dev/config-oxlint-test-support/ts';

//region Helpers

/** Fixture package root. */
const FIXTURE_PKG = fixturePackageRoot({
  fixturePackageName: 'oxlint-no-restricted-syntax',
},);

/** Fixture source root. */
const FIXTURES = fixtureSourceRoot({
  fixturePackageName: 'oxlint-no-restricted-syntax',
},);

/** Calibration data root holding the labeled `.txt` description files. */
const DATA = resolve(
  FIXTURE_PKG,
  'data',
);

/**
 * Fixture-specific oxlint config with all no-restricted-syntax rules enabled
 * and no ignorePatterns that would skip test-fixture or invalid paths.
 */
const FIXTURE_CONFIG = fixtureConfigPath({
  fixturePackageName: 'oxlint-no-restricted-syntax',
  fileName: '.oxlintrc.fixture.json',
},);

/** Fixture config enabling only semantic readonly-effect rule. */
const READONLY_FIXTURE_CONFIG = fixtureConfigPath({
  fixturePackageName: 'oxlint-no-restricted-syntax',
  fileName: '.oxlintrc.readonly.fixture.json',
},);

/**
 * Runs oxlint with the fixture config against a fixture path and returns
 * parsed diagnostics filtered to the no-restricted-syntax plugin.
 *
 * @example
 * ```ts
 * const diags = await lint('invalid/no-switch.ts');
 * ```
 */
async function runOxlint(target: string,): Promise<readonly OxlintDiagnostic[]> {
  return runOxlintFixture({
    codePrefix: 'no-restricted-syntax(',
    configFlag: '-c',
    fixtureConfig: FIXTURE_CONFIG,
    target,
  },);
}

/**
 * Runs oxlint against a fixture file under the fixture `src/` root.
 *
 * @example
 * ```ts
 * const diags = await lint('invalid/no-switch.ts');
 * ```
 */
async function lint(fixturePath: string,): Promise<readonly OxlintDiagnostic[]> {
  return runOxlint(resolveFixtureTarget({
    fixtureSourceRoot: FIXTURES,
    fixturePath,
  },),);
}

/**
 * Runs semantic readonly-effect rule against dedicated fixture source.
 *
 * @param fixturePath - Relative fixture path under source root.
 *
 * @returns readonly-rule diagnostics.
 */
async function lintReadonly(fixturePath: string,): Promise<readonly OxlintDiagnostic[]> {
  return runOxlintFixture({
    codePrefix: 'no-restricted-syntax(',
    configFlag: '-c',
    fixtureConfig: READONLY_FIXTURE_CONFIG,
    target: resolveFixtureTarget({
      fixtureSourceRoot: FIXTURES,
      fixturePath,
    },),
    threads: 1,
  },);
}

/** Bare rule name for the low-information Symbol description rule. */
const LOW_INFO_RULE = 'no-low-information-symbol-description';

/** Diagnostic `code` emitted by the low-information Symbol description rule. */
const LOW_INFO_RULE_CODE = `no-restricted-syntax(${LOW_INFO_RULE})`;

/** User-facing hint every low-information Symbol diagnostic must carry. */
const LOW_INFO_IMMEDIATE_UNDERSTANDABILITY_HINT = 'Every Symbol description must explain the Symbol in plain language by itself: someone seeing only this string, with no repo, code, variable name, or comments, should understand what the Symbol represents and when it appears.';

/** Disposable temp TypeScript source generated from calibration rows. */
type GeneratedSource = {
  /** Absolute path to the generated source file. */
  readonly filePath: string;
  /** Removes the temp directory holding the generated source. */
  readonly [Symbol.dispose]: () => void;
};

/**
 * Reads non-empty rows from a calibration `.txt` data file, preserving exact
 * description text.
 *
 * @example
 * ```ts
 * readDataRows({ fileName: 'no-low-information-symbol-description.pass.txt' });
 * ```
 */
function readDataRows({ fileName, }: { readonly fileName: string; },): readonly string[] {
  return readFileSync(
    resolve(
      DATA,
      fileName,
    ),
    'utf8',
  )
    .split('\n',)
    .filter(function nonEmpty(line,): boolean {
      return line.length > 0;
    },);
}

/**
 * Builds TypeScript source with one `Symbol(<json string>)` statement per row,
 * so each row maps to exactly one Symbol call the rule can classify.
 *
 * @example
 * ```ts
 * symbolCallsSource({ rows: ['meow'] }); // 'Symbol("meow");\n'
 * ```
 */
function symbolCallsSource({ rows, }: { readonly rows: readonly string[]; },): string {
  return `${rows
    .map(function toCall(row,): string {
      return `Symbol(${JSON.stringify(row,)});`;
    },)
    .join('\n',)}\n`;
}

/**
 * Writes generated source into a unique temp directory with disposal-backed
 * cleanup, so the file is linted in isolation from the fixture tree.
 *
 * @example
 * ```ts
 * using fixture = createGeneratedSource({ fileName: 'pass.ts', source });
 * ```
 */
function createGeneratedSource(
  { fileName, source, }: { readonly fileName: string; readonly source: string; },
): GeneratedSource {
  const dirPath = mkdtempSync(join(
    tmpdir(),
    'oxlint-low-info-symbol-',
  ),);
  const filePath = resolve(
    dirPath,
    fileName,
  );
  writeFileSync(filePath, source,);
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
 * Runs oxlint --fix against disposable generated source and returns fixed text.
 *
 * @param source - Source text to write to a temp fixture.
 *
 * @param fixSuggestions - Whether to also apply suggestion-level fixes.
 *
 * @returns Source text after oxlint fixers run.
 *
 * @example
 * ```ts
 * const fixed = await fixGeneratedSource({ source: 'value instanceof Error;' });
 * ```
 */
async function fixGeneratedSource(
  {
    source,
    fixSuggestions = false,
  }: {
    readonly source: string;
    readonly fixSuggestions?: boolean;
  },
): Promise<string> {
  using fixture = createGeneratedSource({
    fileName: 'prefer-error-is-error.fix.ts',
    source,
  },);
  /**
   * Fix flags passed to oxlint.
   */
  const fixFlags = fixSuggestions ? [
    '--fix',
    '--fix-suggestions',
  ] : ['--fix',];
  try {
    await spawn(
      'oxlint',
      [
        ...fixFlags,
        '--format',
        'json',
        '-c',
        FIXTURE_CONFIG,
        fixture.filePath,
      ],
      { cwd: ROOT, },
    );
  }
  catch (error: unknown) {
    if ((!((typeof error) === 'object')) || (error === null) || (!('stdout' in error)))
      throw error;
  }
  return readFileSync(
    fixture.filePath,
    'utf8',
  );
}

/**
 * Applies readonly semantic fixes to disposable source inside fixture project.
 *
 * @param source - Source text to lint and optionally suggest-fix.
 *
 * @param fixSuggestions - Whether suggestion channel is enabled.
 *
 * @returns resulting source text.
 */
async function fixReadonlyGeneratedSource({
  source,
  fixSuggestions,
}: {
  readonly source: string;
  readonly fixSuggestions: boolean;
},): Promise<string> {
  /** Disposable in-project directory discoverable by fixture tsconfig. */
  const dirPath = mkdtempSync(join(FIXTURES, 'readonly-fix-',),);
  /** Disposable source path inside configured project. */
  const filePath = resolve(dirPath, 'stale-contract.ts',);
  writeFileSync(filePath, source,);
  using fixture: GeneratedSource = {
    filePath,
    [Symbol.dispose]: function cleanup(): void {
      rmSync(dirPath, { recursive: true, force: true, },);
    },
  };
  /** Fix flags preserving suggestion opt-in boundary. */
  const fixFlags = fixSuggestions
    ? ['--fix', '--fix-suggestions',]
    : ['--fix',];
  try {
    await spawn(
      'oxlint',
      [
        '--threads',
        '1',
        ...fixFlags,
        '--format',
        'json',
        '-c',
        READONLY_FIXTURE_CONFIG,
        fixture.filePath,
      ],
      { cwd: ROOT, },
    );
  }
  catch (error: unknown) {
    if ((!((typeof error) === 'object')) || (error === null) || (!('stdout' in error)))
      throw error;
  }
  return readFileSync(fixture.filePath, 'utf8',);
}

/**
 * Names of the substantive syntax rules; each has a fixture in `invalid/`
 * that triggers the rule.
 */
const SUBSTANTIVE_RULES = [
  'no-arrow-function',
  'no-array-callback-reference',
  'no-class',
  'no-enum',
  'no-for-in',
  'no-function-root-let',
  'no-hasownproperty',
  'no-immediate-mutation',
  'no-low-information-symbol-description',
  'no-module-root-let',
  'no-nullish-union',
  'catch-binding',
  'no-optional-escape',
  'no-promise-catch',
  'no-promise-finally',
  'no-regex',
  'no-rest-params',
  'no-switch',
  'no-sync',
  'no-trim-left-right',
  'no-try-finally',
  'no-variable-function-expression',
  'prefer-describe-function-ref-name',
  'prefer-error-is-error',
  'require-destructured-params',
  'require-queryselector-generic',
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
  'no-disable-prefer-readonly-parameter-types',
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
      name: 'no-disable-prefer-readonly-parameter-types forms',
      children: [
        it({
          name: 'reports line, block, and mixed-list directives',
          fn: async () => {
            const diagnostics = await lint(
              'invalid/no-disable-prefer-readonly-parameter-types.ts',
            );
            const readonlyDisableDiagnostics = diagnostics.filter(
              function readonlyDisable(diagnostic,): boolean {
                return diagnostic.code
                  === 'no-restricted-syntax(no-disable-prefer-readonly-parameter-types)';
              },
            );
            expect(readonlyDisableDiagnostics.length,).toBe(3,);
          },
        },),
      ],
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
          name: 'no-regex accepts scoped disable justifications',
          fn: async () => {
            const diagnostics = await lint(
              'valid/no-regex.ts',
            );
            expect(diagnostics,).toEqual([],);
          },
        },),
        it({
          name: 'no-nullish-union accepts ?:, plain T, and Symbol sentinels',
          fn: async () => {
            const diagnostics = await lint(
              'valid/no-nullish-union.ts',
            );
            expect(diagnostics,).toEqual([],);
          },
        },),
        it({
          name: 'no-sync accepts non-Node Sync-named APIs',
          fn: async () => {
            const diagnostics = await lint(
              'valid/no-sync.ts',
            );
            expect(diagnostics,).toEqual([],);
          },
        },),
        it({
          name: 'no-array-callback-reference accepts known unary callbacks and arity wrappers',
          fn: async () => {
            const diagnostics = await lint(
              'valid/no-array-callback-reference.ts',
            );
            expect(diagnostics,).toEqual([],);
          },
        },),
        it({
          name: 'no-immediate-mutation accepts Set and Map clone-plus-mutate patterns',
          fn: async () => {
            const diagnostics = await lint(
              'valid/no-immediate-mutation.ts',
            );
            expect(diagnostics,).toEqual([],);
          },
        },),
        it({
          name: 'prefer-error-is-error accepts Error.isError and non-Node lookalikes',
          fn: async () => {
            const diagnostics = await lint(
              'valid/prefer-error-is-error.ts',
            );
            expect(diagnostics,).toEqual([],);
          },
        },),
        it({
          name:
            'no-optional-escape accepts void returns, real tuples, Symbol sentinels, literal domains, and Required',
          fn: async () => {
            const diagnostics = await lint(
              'valid/no-optional-escape.ts',
            );
            expect(diagnostics,).toEqual([],);
          },
        },),
      ],
    },),
    describe({
      name: 'prefer-readonly-parameter-types diagnostics',
      concurrency: 1,
      children: [
        it({
          name: 'accepts honest readonly, declared mutation, capability reads, and bodyless contracts',
          fn: async () => {
            expect(await lintReadonly('readonly-valid.ts',),).toEqual([],);
          },
        },),
        it({
          name: 'reports readonly, mutation, stale, dishonest, and opaque failures',
          fn: async () => {
            const diagnostics = await lintReadonly('readonly-invalid.ts',);
            expect(diagnostics.length,).toBe(7,);
            const messages = diagnostics.map(function diagnosticMessage(diagnostic,): string {
              return diagnostic.message;
            },);
            expect(messages.some(function shouldReadonly(message,): boolean {
              return message.includes('should be readonly',);
            },),).toBe(true,);
            expect(messages.some(function missingContract(message,): boolean {
              return message.includes('lacks @mutates contract',);
            },),).toBe(true,);
            expect(messages.some(function staleContract(message,): boolean {
              return message.includes('stale @mutates contract',);
            },),).toBe(true,);
            expect(messages.some(function dishonest(message,): boolean {
              return message.includes('claims readonly semantics dishonestly',);
            },),).toBe(true,);
            /** Plain-language uncertainty diagnostic for unsafe JSON serialization. */
            const opaqueMessage = messages.find(function unsafeJson(message,): boolean {
              return message.startsWith(
                'The function input named "state" is used by these calls: JSON.stringify.',
              );
            },);
            if (opaqueMessage === undefined)
              throw new Error('Expected JSON.stringify uncertainty diagnostic.',);
            expect(opaqueMessage,).toBe(
              'The function input named "state" is used by these calls: JSON.stringify.'
                + '\n\nThis rule cannot inspect enough of those calls to know what they might change. They could change the input itself, change an object stored inside it, call a function stored inside it, or arrange for one of those changes to happen later.'
                + '\n\nMove these calls into a function in this repository. For each input that the calls might change, add its own @mutates line to that function\'s /** ... */ comment:'
                + '\n@mutates inputName - explain what may change and name the call responsible'
                + '\nReplace inputName with that function\'s actual input name. Then call that function here.',
            );
            expect(messages.some(function destructuredInput(message,): boolean {
              return message.startsWith(
                'The function inputs named "state" and "label" are used by these calls: JSON.stringify.',
              );
            },),).toBe(true,);
          },
        },),
        it({
          name: 'reports overload contracts whose union differs from implementation effects',
          fn: async () => {
            const diagnostics = await lintReadonly('readonly-overload-invalid.ts',);
            expect(diagnostics.length,).toBe(1,);
            expect(diagnostics[0]?.message,).toBe(
              'Mutation contracts disagree across callable signatures.',
            );
          },
        },),
        it({
          name: 'suggests readonly arrays only through explicit suggestion fixes',
          fn: async () => {
            /** Source with deeply projectable primitive array parameter. */
            const source = `/**\n * Reads values.\n *\n * @param values - Values read without mutation.\n */\nexport function countValues(values: string[],): number {\n  return values.length;\n}\n`;
            const ordinarilyFixed = await fixReadonlyGeneratedSource({
              source,
              fixSuggestions: false,
            },);
            expect(ordinarilyFixed.includes('values: string[]',),).toBe(true,);
            const suggestionFixed = await fixReadonlyGeneratedSource({
              source,
              fixSuggestions: true,
            },);
            expect(suggestionFixed.includes('values: readonly string[]',),).toBe(true,);
          },
        },),
        it({
          name: 'suggests standard ReadonlyArray owner for readonly reachable types',
          fn: async () => {
            /** Source with standard mutable Array type reference. */
            const source = '/** Reads array. @param values - Values. */\nexport function read(values: Array<string>,): number { return values.length; }\n';
            const ordinarilyFixed = await fixReadonlyGeneratedSource({
              source,
              fixSuggestions: false,
            },);
            expect(ordinarilyFixed.includes('Array<string>',),).toBe(true,);
            const suggestionFixed = await fixReadonlyGeneratedSource({
              source,
              fixSuggestions: true,
            },);
            expect(suggestionFixed.includes('ReadonlyArray<string>',),).toBe(true,);
          },
        },),
        it({
          name: 'suggests imported type-fest ReadonlyDeep for structural data only explicitly',
          fn: async () => {
            /** Source with mutable nested data and aliased type-fest import. */
            const source = `import type { ReadonlyDeep as DeepReadonly, } from 'type-fest';

/**
 * Reads nested state.
 *
 * @param state - Nested state read without mutation.
 */
export function readNested(state: { nested: { value: string; }; },): string {
  return state.nested.value;
}
`;
            const ordinarilyFixed = await fixReadonlyGeneratedSource({
              source,
              fixSuggestions: false,
            },);
            expect(ordinarilyFixed.includes('state: { nested:',),).toBe(true,);
            const suggestionFixed = await fixReadonlyGeneratedSource({
              source,
              fixSuggestions: true,
            },);
            expect(suggestionFixed.includes('state: DeepReadonly<{ nested:',),).toBe(true,);
          },
        },),
        it({
          name: 'keeps stale contracts under ordinary fix and removes them through suggestions',
          fn: async () => {
            /** Source with one semantically stale mutation block. */
            const source = `/**\n * Reads signal.\n *\n * @param controller - Capability read only.\n *\n * @mutates controller - Claims absent transition.\n */\nexport function readSignal(controller: AbortController,): AbortSignal {\n  return controller.signal;\n}\n`;
            const ordinarilyFixed = await fixReadonlyGeneratedSource({
              source,
              fixSuggestions: false,
            },);
            expect(ordinarilyFixed.includes('@mutates controller',),).toBe(true,);
            const suggestionFixed = await fixReadonlyGeneratedSource({
              source,
              fixSuggestions: true,
            },);
            expect(suggestionFixed.includes('@mutates controller',),).toBe(false,);
          },
        },),
      ],
    },),
    describe({
      name: 'no-array-callback-reference forms',
      children: [
        it({
          name: 'reports direct references and unknown wrapper call expressions',
          fn: async () => {
            const diagnostics = await lint('invalid/no-array-callback-reference.ts',);
            const arrayCallbackReference = diagnostics.filter(
              function isArrayCallbackReference(diagnostic,): boolean {
                return diagnostic.code === 'no-restricted-syntax(no-array-callback-reference)';
              },
            );
            expect(arrayCallbackReference.length,).toBe(3,);
          },
        },),
      ],
    },),
    describe({
      name: 'no-immediate-mutation forms',
      children: [
        it({
          name: 'reports each initializer kind except Set and Map clone exceptions',
          fn: async () => {
            const diagnostics = await lint('invalid/no-immediate-mutation.ts',);
            const immediateMutation = diagnostics.filter(
              function isImmediateMutation(diagnostic,): boolean {
                return diagnostic.code === 'no-restricted-syntax(no-immediate-mutation)';
              },
            );
            expect(immediateMutation.length,).toBe(6,);
          },
        },),
      ],
    },),
    describe({
      name: 'no-nullish-union forms',
      children: [
        it({
          name: 'catches every distinct nullish-union form in the fixture',
          fn: async () => {
            const diagnostics = await lint('invalid/no-nullish-union.ts',);
            const nullishUnion = diagnostics.filter(
              function isNullishUnion(diagnostic,): boolean {
                return diagnostic.code === 'no-restricted-syntax(no-nullish-union)';
              },
            );
            // Ten distinct union sites in the fixture: seven `undefined`
            // variants (T | undefined, undefined | T, optional property, return
            // type, parameter, Promise<T | undefined>, Array<T | undefined>)
            // plus three `null` variants (T | null, null | T,
            // Promise<T | null>).
            expect(nullishUnion.length,).toBe(10,);
          },
        },),
      ],
    },),
    describe({
      name: 'no-optional-escape forms',
      children: [
        it({
          name: 'catches every distinct fake-optional encoding in the fixture',
          fn: async () => {
            const diagnostics = await lint('invalid/no-optional-escape.ts',);
            const optionalEscape = diagnostics.filter(
              function isOptionalEscape(diagnostic,): boolean {
                return diagnostic.code === 'no-restricted-syntax(no-optional-escape)';
              },
            );
            // Eighteen distinct banned forms, one site each: `| void`,
            // `| never`, `| unknown`, `| any`, `| ''`, empty template, `| 0`,
            // `| -1`, `| false`, `| {}`, empty tuple, optional tuple element,
            // optional named tuple member, rest-only tuple, `Partial<T>`,
            // `Record<K, never>`, `Pick<T, never>`, and an added-optionality
            // mapped type.
            expect(optionalEscape.length,).toBe(18,);
          },
        },),
        it({
          name: 'maps each banned form to its own diagnostic message',
          fn: async () => {
            const diagnostics = await lint('invalid/no-optional-escape.ts',);
            const messages = diagnostics
              .filter(function isOptionalEscape(diagnostic,): boolean {
                return diagnostic.code === 'no-restricted-syntax(no-optional-escape)';
              },)
              .map(function pickMessage(diagnostic,): string {
                return diagnostic.message;
              },);
            // Distinctive leading phrase of each form's message, with its
            // expected occurrence count: `unknown`/`any` share wideningUnion,
            // `""`/empty-template share emptyStringUnion, `0`/`-1` share
            // falsyNumberUnion, and Record/Pick share emptyUtilityObject, so
            // four prefixes appear twice and the rest once (18 total).
            const expectedCounts: Readonly<Record<string, number>> = {
              '`T | void` widens': 1,
              '`T | never` collapses': 1,
              '`T | unknown` and `T | any`': 2,
              'An empty-string literal': 2,
              'A zero or negative numeric': 2,
              '`T | false` uses': 1,
              'An empty object type in a union': 1,
              'An empty tuple type': 1,
              'An optional tuple element': 1,
              'An optional named tuple member': 1,
              'A rest-only tuple': 1,
              '`Partial<T>` makes': 1,
              'A utility type producing': 2,
              'A mapped type that adds optionality': 1,
            };
            const actualCounts: Record<string, number> = Object.fromEntries(
              Object.keys(expectedCounts,).map(
                function countMatches(prefix,): readonly [string, number,] {
                  const matches = messages.filter(
                    function hasPrefix(message,): boolean {
                      return message.startsWith(prefix,);
                    },
                  );
                  return [prefix, matches.length,];
                },
              ),
            );
            expect(actualCounts,).toEqual(expectedCounts,);
          },
        },),
      ],
    },),
    describe({
      name: 'prefer-error-is-error forms',
      children: [
        it({
          name: 'reports every legacy Error detector in the fixture',
          fn: async () => {
            const diagnostics = await lint('invalid/prefer-error-is-error.ts',);
            const preferErrorIsError = diagnostics.filter(
              function isPreferErrorIsError(diagnostic,): boolean {
                return diagnostic.code === 'no-restricted-syntax(prefer-error-is-error)';
              },
            );
            expect(preferErrorIsError.length,).toBe(13,);
          },
        },),
        it({
          name: 'autofixes safe legacy Error detectors to Error.isError',
          fn: async () => {
            const source = [
              "import util from 'node:util';",
              "import { types, } from 'node:util';",
              "import * as utilTypes from 'node:util/types';",
              "import { isNativeError, } from 'node:util/types';",
              '',
              'function detections(error: unknown,): readonly boolean[] {',
              '  return [',
              '    error instanceof Error,',
              '    error instanceof globalThis.Error,',
              "    Object.prototype.toString.call(error,) === '[object Error]',",
              "    '[object Error]' !== Object.prototype.toString.call(error,),",
              "    Object.prototype.toString.call(error,).slice(8, -1,) === 'Error',",
              "    'Error' !== Object.prototype.toString.call(error,).slice(8, -1,),",
              "    Object.prototype.toString.call(error,).endsWith(' Error]',),",
              '    error.constructor === Error,',
              '    Error === error.constructor,',
              '    util.types.isNativeError(error,),',
              '    types.isNativeError(error,),',
              '    utilTypes.isNativeError(error,),',
              '    isNativeError(error,),',
              '  ];',
              '}',
              '',
            ].join('\n',);
            const fixed = await fixGeneratedSource({ source, },);
            expect(fixed,).toBe([
              "import util from 'node:util';",
              "import { types, } from 'node:util';",
              "import * as utilTypes from 'node:util/types';",
              "import { isNativeError, } from 'node:util/types';",
              '',
              'function detections(error: unknown,): readonly boolean[] {',
              '  return [',
              '    Error.isError(error,),',
              '    Error.isError(error,),',
              '    Error.isError(error,),',
              '    !Error.isError(error,),',
              '    Error.isError(error,),',
              '    !Error.isError(error,),',
              '    Error.isError(error,),',
              '    error.constructor === Error,',
              '    Error === error.constructor,',
              '    Error.isError(error,),',
              '    Error.isError(error,),',
              '    Error.isError(error,),',
              '    Error.isError(error,),',
              '  ];',
              '}',
              '',
            ].join('\n',),);
          },
        },),
        it({
          name: 'applies constructor comparisons as suggestion-level fixes',
          fn: async () => {
            const source = [
              'function detections(error: unknown,): readonly boolean[] {',
              '  return [',
              '    error.constructor === Error,',
              '    Error !== error.constructor,',
              '  ];',
              '}',
              '',
            ].join('\n',);
            const fixed = await fixGeneratedSource({
              source,
              fixSuggestions: true,
            },);
            expect(fixed,).toBe([
              'function detections(error: unknown,): readonly boolean[] {',
              '  return [',
              '    Error.isError(error,),',
              '    !Error.isError(error,),',
              '  ];',
              '}',
              '',
            ].join('\n',),);
          },
        },),
      ],
    },),
    describe({
      name: 'diagnostic messages',
      children: [
        it({
          name:
            'require-destructured-params explains allowed named and positional params',
          fn: async () => {
            const diagnostics = await lint('invalid/require-destructured-params.ts',);
            const messages = diagnostics
              .filter(function isRequireDestructuredParams(diagnostic,): boolean {
                return diagnostic.code === 'no-restricted-syntax(require-destructured-params)';
              },)
              .map(function pickMessage(diagnostic,): string {
                return diagnostic.message;
              },);
            expect(messages,).toEqual([
              [
                'For function declarations with 2 or more inputs, use one destructured object parameter, ',
                'for example `function createUser({ name, age }) { ... }`. ',
                'Allowed positional parameters: single-parameter declarations, ',
                'and callback function expressions whose API supplies the argument list, ',
                'such as `items.toSorted(function byName(left, right) { ... })`.',
              ].join('',),
            ],);
          },
        },),
        it({
          name:
            'no-regex reports each regex form with specific guidance',
          fn: async () => {
            const diagnostics = await lint('invalid/no-regex.ts',);
            expect(diagnostics.map(function message(diagnostic,): string {
              return diagnostic.message;
            },),)
              .toEqual([
                'Regex literal requires a scoped disable with justification. Prefer an index scan, parser, or string API; if regex is still right, add `oxlint-disable-next-line no-restricted-syntax/no-regex -- <why regex, input bounds, backtracking safety>`.',
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
    describe({
      name: 'no-low-information-symbol-description data',
      children: [
        it({
          name: 'passes every labeled pass-data description',
          fn: async () => {
            const rows = readDataRows({
              fileName: 'no-low-information-symbol-description.pass.txt',
            },);
            using fixture = createGeneratedSource({
              fileName: 'pass-rows.ts',
              source: symbolCallsSource({ rows, },),
            },);
            const reported = (await runOxlint(fixture.filePath,)).filter(
              function isLowInfo(diagnostic,): boolean {
                return diagnostic.code === LOW_INFO_RULE_CODE;
              },
            );
            expect(reported,).toEqual([],);
          },
        },),
        it({
          name: 'fails every labeled fail-data description exactly once',
          fn: async () => {
            const rows = readDataRows({
              fileName: 'no-low-information-symbol-description.fail.txt',
            },);
            using fixture = createGeneratedSource({
              fileName: 'fail-rows.ts',
              source: symbolCallsSource({ rows, },),
            },);
            const reported = (await runOxlint(fixture.filePath,)).filter(
              function isLowInfo(diagnostic,): boolean {
                return diagnostic.code === LOW_INFO_RULE_CODE;
              },
            );
            expect(reported.length,).toBe(rows.length,);
          },
        },),
        it({
          name: 'reports a distinct message for every failure branch',
          fn: async () => {
            // One representative description per failure branch, in classifier order.
            const branchRows = [
              'meow',
              'STATE IS UNKNOWN',
              'runWithContext',
              'token token value status result',
              'tsdoc/no-tag',
              'no nested script',
              'not-a-data-row',
              'plain old value',
            ];
            const expectedPrefixes = [
              'Symbol description has fewer than 3 distinct words',
              'Symbol description is entirely uppercase words',
              'Symbol description is a bare camelCase or PascalCase identifier',
              'Symbol description repeats a meaningful word',
              'Symbol description has a namespace prefix but a tail shorter',
              'Symbol description starts with "no" but has no specificity marker',
              'Symbol description starts with "not" but has no specificity marker',
              'Symbol description is a 3-word phrase with no specificity marker',
            ];
            using fixture = createGeneratedSource({
              fileName: 'branches.ts',
              source: symbolCallsSource({ rows: branchRows, },),
            },);
            const messages = (await runOxlint(fixture.filePath,))
              .filter(function isLowInfo(diagnostic,): boolean {
                return diagnostic.code === LOW_INFO_RULE_CODE;
              },)
              .map(function pickMessage(diagnostic,): string {
                return diagnostic.message;
              },);
            const missing = expectedPrefixes.filter(function unmatched(prefix,): boolean {
              return !messages.some(function hasPrefix(message,): boolean {
                return message.startsWith(prefix,);
              },);
            },);
            expect(missing,).toEqual([],);
            /**
             * Messages emitted by a failure branch without the reader-context hint.
             */
            const missingHint = messages.filter(function lacksHint(message,): boolean {
              return !message.includes(LOW_INFO_IMMEDIATE_UNDERSTANDABILITY_HINT,);
            },);
            expect(missingHint,).toEqual([],);
          },
        },),
        it({
          name: 'keeps borderline rows out of pass and fail data',
          fn: async () => {
            const borderline = readDataRows({
              fileName: 'no-low-information-symbol-description.borderline.txt',
            },);
            const passRows = new Set(readDataRows({
              fileName: 'no-low-information-symbol-description.pass.txt',
            },),);
            const failRows = new Set(readDataRows({
              fileName: 'no-low-information-symbol-description.fail.txt',
            },),);
            const leaked = borderline.filter(function isLeaked(row,): boolean {
              return passRows.has(row,) || failRows.has(row,);
            },);
            expect(leaked,).toEqual([],);
          },
        },),
      ],
    },),
  ],
},);

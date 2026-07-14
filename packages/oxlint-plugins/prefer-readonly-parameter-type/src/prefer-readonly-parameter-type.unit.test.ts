import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { resolve, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import spawn from 'nano-spawn';

import {
  fixtureConfigPath,
  fixtureSourceRoot,
  type OxlintRuleDiagnostic as OxlintDiagnostic,
  OXLINT_PLUGIN_TEST_ROOT as ROOT,
  resolveFixtureTarget,
  runOxlintFixture,
} from '@monochromatic-dev/config-oxlint-test-support/ts';

/** Fixture source root. */
const FIXTURES = fixtureSourceRoot({
  fixturePackageName: 'oxlint-no-restricted-syntax',
},);

/** Fixture config enabling only semantic readonly-effect rule. */
const READONLY_FIXTURE_CONFIG = fixtureConfigPath({
  fixturePackageName: 'oxlint-no-restricted-syntax',
  fileName: '.oxlintrc.readonly.fixture.json',
},);

/** Disposable in-project TypeScript source. */
type GeneratedSource = {
  readonly filePath: string;
  readonly [Symbol.dispose]: () => void;
};

/**
 * Runs semantic readonly-effect rule against dedicated fixture source.
 *
 * @param fixturePath - Relative fixture path under source root.
 *
 * @returns readonly-rule diagnostics.
 */
async function lintReadonly(fixturePath: string,): Promise<readonly OxlintDiagnostic[]> {
  return runOxlintFixture({
    codePrefix: 'prefer-readonly-parameter-type(',
    configFlag: '-c',
    fixtureConfig: READONLY_FIXTURE_CONFIG,
    target: resolveFixtureTarget({
      fixtureSourceRoot: FIXTURES,
      fixturePath,
    },),
    threads: 1,
  },);
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
  const dirPath = mkdtempSync(resolve(FIXTURES, 'readonly-fix-',),);
  /** Disposable source path inside configured project. */
  const filePath = resolve(dirPath, 'stale-contract.ts',);
  writeFileSync(filePath, source,);
  using fixture: GeneratedSource = {
    filePath,
    [Symbol.dispose]: function cleanup(): void {
      rmSync(dirPath, { recursive: true, force: true, },);
    },
  };
  /** Fix flags preserving suggestion opt-in seam. */
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

await describe({
name: 'prefer-readonly-parameter-types diagnostics',
concurrency: 1,
children: [
  it({
    name: 'accepts readonly inputs, proven effects without contracts, documented uncertainty, and bodyless contracts',
    fn: async () => {
      expect(await lintReadonly('readonly-valid.ts',),).toEqual([],);
    },
  },),
  it({
    name: 'keeps owned call paths separate from propagated foreign provenance',
    fn: async () => {
      const diagnostics = await lintReadonly('readonly-foreign-provenance-invalid.ts',);
      expect(diagnostics.length,).toBe(4,);
      const messages = diagnostics.map(function diagnosticMessage(diagnostic,): string {
        return diagnostic.message;
      },);
      expect(messages.some(function helperRemainsOwned(message,): boolean {
        return message.startsWith('Parameter "child" should be readonly',);
      },),).toBe(true,);
      expect(messages.some(function boundaryRemainsOwned(message,): boolean {
        return message.startsWith('Parameter "tree" should be readonly',);
      },),).toBe(true,);
      expect(messages.some(function replacementRemainsOwned(message,): boolean {
        return message.startsWith('Parameter "replacement" should be readonly',);
      },),).toBe(true,);
      expect(messages.some(function mixedResultRemainsOwned(message,): boolean {
        return message.startsWith('Parameter "child" should be readonly',);
      },),).toBe(true,);
    },
  },),
  it({
    name: 'reports readonly preference, stale contracts, dishonest types, and undocumented uncertainty',
    fn: async () => {
      const diagnostics = await lintReadonly('readonly-invalid.ts',);
      expect(diagnostics.length,).toBe(11,);
      const messages = diagnostics.map(function diagnosticMessage(diagnostic,): string {
        return diagnostic.message;
      },);
      expect(messages.some(function shouldReadonly(message,): boolean {
        return message.includes('should be readonly',);
      },),).toBe(true,);
      expect(messages.some(function missingUncertaintyContract(message,): boolean {
        return message.startsWith(
          'Parameter "state" has documented uncertainty propagated from JSON.stringify but lacks its own @mutates contract.',
        );
      },),).toBe(true,);
      expect(messages.some(function staleContract(message,): boolean {
        return message.includes('stale @mutates contract',);
      },),).toBe(true,);
      expect(messages.some(function dishonest(message,): boolean {
        return message.includes('claims readonly semantics dishonestly',);
      },),).toBe(true,);
      expect(messages.some(function uncertainReadonly(message,): boolean {
        return message.startsWith(
          'Parameter "state" cannot be verified as readonly because its documented possible effects come from: JSON.stringify.',
        );
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
          + '\n\nChoose the remediation that matches the call:'
          + '\n1. Remove the call or rewrite the code so this input is not given to code the rule cannot inspect.'
          + '\n2. If the called code is in this repository but missing from its TypeScript project, update the nearest tsconfig.json so the rule can inspect that source.'
          + '\n3. If the exact external function or method has been audited, add an entry with evidence and tests to the rule\'s audited-call catalogue. Package calls belong in package-effect-catalog.ts; JavaScript, DOM, and Node calls belong in their matching platform catalogue. The entry must record every input or object the call can change; an empty list is allowed only when the audit proves it changes no state that code outside this function can observe.'
          + '\n4. Otherwise, document the possible change here or in a dedicated function that contains the calls. For each input that might be changed, add its own line to the function\'s /** ... */ comment:'
          + '\n@mutates inputName - explain what may change and name every listed call responsible'
          + '\nReplace inputName with that function\'s actual input name.',
      );
      expect(messages.some(function destructuredInput(message,): boolean {
        return message.startsWith(
          'The function inputs named "state" and "label" are used by these calls: JSON.stringify.',
        );
      },),).toBe(true,);
      /** Method-specific diagnostic explaining state changes without assignment. */
      const methodMessage = messages.find(function unknownMethod(message,): boolean {
        return message.startsWith(
          'The function input named "service" is used as the object for these method calls: service.write.',
        );
      },);
      if (methodMessage === undefined)
        throw new Error('Expected unknown method diagnostic.',);
      expect(methodMessage.includes(
        'A method can change data stored inside its object or in the system that object controls, even when this code never assigns a new value to the input.',
      ),).toBe(true,);
      /** Exact global String diagnostic naming coercion hooks and every remedy. */
      const stringMessage = messages.find(function stringCoercion(message,): boolean {
        return message.startsWith(
          'The function input named "error" is passed to global String while it may be an object.',
        );
      },);
      if (stringMessage === undefined)
        throw new Error('Expected global String object coercion diagnostic.',);
      expect(stringMessage,).toBe(
        'The function input named "error" is passed to global String while it may be an object. String does not reassign the input. Object conversion reads input[Symbol.toPrimitive], input.toString, and input.valueOf; those reads can run getters or proxy traps, and callable values are then invoked. That caller-owned code can change the input, reachable state, or another system. This rule does not report String conversion when the input is provably primitive.'
          + '\n\nChoose the remediation that preserves the intended output:'
          + '\n1. Narrow the input to string, number, bigint, boolean, symbol, null, or undefined before calling String. Primitive conversion cannot run caller-owned hooks.'
          + '\n2. Read a known primitive field and convert that field instead of converting its containing object.'
          + '\n3. For error or logging fallbacks, return known strings directly and describe other values by a noncoercing fact such as typeof value.'
          + '\n4. Remove the conversion when its text is not required.'
          + '\n5. If invoking object coercion hooks is intentional, document every affected input with its own line in the function\'s /** ... */ comment. An object type alone cannot prove that runtime hooks are absent:'
          + '\n@mutates inputName - String may invoke getters, proxy traps, Symbol.toPrimitive, toString, or valueOf on this input'
          + '\nReplace inputName with that function\'s actual input name.',
      );
      expect(messages.some(function incompleteStringContract(message,): boolean {
        return message.startsWith(
          'The function input named "incomplete" is passed to global String while it may be an object.',
        );
      },),).toBe(true,);
    },
  },),
  it({
    name: 'does not identify same-named external callable as global String',
    fn: async () => {
      const diagnostics = await lintReadonly('readonly-string-lookalike-invalid.ts',);
      expect(diagnostics.length,).toBe(1,);
      expect(diagnostics[0]?.message.startsWith(
        'The function input named "value" is used by these calls: String.',
      ),).toBe(true,);
      expect(diagnostics[0]?.message.includes(
        'passed to global String',
      ),).toBe(false,);
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
},);

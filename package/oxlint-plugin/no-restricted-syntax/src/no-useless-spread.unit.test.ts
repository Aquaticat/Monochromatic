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
import {
  fixtureConfigPath,
  fixtureSourceRoot,
  type OxlintRuleDiagnostic,
  OXLINT_PLUGIN_TEST_ROOT as ROOT,
  resolveFixtureTarget,
  runOxlintFixture,
} from '@monochromatic-dev/oxlint-plugin-test-support/ts';
import spawn from 'nano-spawn';

//region Helpers

/** Fixture source root. */
const FIXTURES = fixtureSourceRoot({
  fixturePackageName: 'oxlint-no-restricted-syntax',
},);

/**
 Isolated config enabling only this rule, so no native fixer (notably upstream
 `unicorn/no-useless-spread`) rewrites sources during `--fix` runs.
 */
const FIXTURE_CONFIG = fixtureConfigPath({
  fixturePackageName: 'oxlint-no-restricted-syntax',
  fileName: '.oxlintrc.no-useless-spread.fixture.json',
},);

/** Diagnostic code of the rule under test. */
const RULE_CODE = 'no-restricted-syntax(no-useless-spread)';

/** Message prefix identifying each diagnostic kind. */
const KIND_PREFIXES: Readonly<Record<string, string>> = {
  spreadArrayInArray: 'Spreading an array literal into another array',
  spreadArrayInArguments: 'Spreading an array literal into an argument list',
  spreadObjectInObject: 'Spreading an object literal into another object',
  iterableToArray: 'accepts any iterable',
  iterableInForOf: '`for…of` iterates any iterable',
  iterableInYieldStar: '`yield*` delegates to any iterable',
  cloneArray: 'already returns a new array',
  cloneObject: 'already returns a new object',
  ambiguousConversion: 'No type information is available here',
};

/**
 Names the diagnostic kind by its message.

 @example
 ```ts
 kindOf(diagnostic); // 'cloneArray'
 ```
 */
function kindOf(diagnostic: OxlintRuleDiagnostic,): string {
  /** Matching kind entry. */
  const entry = Object.entries(KIND_PREFIXES,).find(function matches([, prefix,],): boolean {
    return diagnostic.message.includes(prefix,);
  },);
  if (entry === undefined)
    throw new Error(`unrecognized no-useless-spread message: ${diagnostic.message}`,);
  return entry[0];
}

/**
 Lints a target and returns the sorted kinds this rule reported.

 @example
 ```ts
 await reportedKinds(target);
 ```
 */
async function reportedKinds(target: string,): Promise<readonly string[]> {
  /** Plugin diagnostics for the target. */
  const diagnostics = await runOxlintFixture({
    codePrefix: 'no-restricted-syntax(',
    configFlag: '-c',
    fixtureConfig: FIXTURE_CONFIG,
    target,
  },);
  return diagnostics
    .filter(function ownRule(diagnostic,): boolean {
      return diagnostic.code === RULE_CODE;
    },)
    .map(kindOf,)
    .toSorted();
}

/** Disposable source file in a temp directory, optionally inside its own TypeScript project. */
type ScratchSource = {
  /** Absolute path to the source file. */
  readonly filePath: string;
  /** Removes the temp directory. */
  readonly [Symbol.dispose]: () => void;
};

/**
 Writes source into a fresh temp directory; `typed` adds a tsconfig so the
 semantic bridge resolves it, otherwise the file sits outside every project.

 @example
 ```ts
 using scratch = scratchSource({ source, typed: true });
 ```
 */
function scratchSource(
  {
    source,
    typed,
  }: {
    readonly source: string;
    readonly typed: boolean;
  },
): ScratchSource {
  /** Unique temp directory. */
  const dirPath = mkdtempSync(join(
    tmpdir(),
    'oxlint-no-useless-spread-',
  ),);
  /** Source file path. */
  const filePath = resolve(
    dirPath,
    'case.ts',
  );
  writeFileSync(filePath, source,);
  if (typed) {
    writeFileSync(
      resolve(
        dirPath,
        'tsconfig.json',
      ),
      JSON.stringify({
        compilerOptions: {
          lib: ['ESNext',],
          target: 'esnext',
          module: 'preserve',
          strict: true,
          noEmit: true,
          types: [],
        },
        files: ['case.ts',],
      },),
    );
  }
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
 Runs `oxlint --fix` on scratch source and returns the fixed text.

 @example
 ```ts
 await fixedSource({ source, typed: true });
 ```
 */
async function fixedSource(
  {
    source,
    typed,
  }: {
    readonly source: string;
    readonly typed: boolean;
  },
): Promise<string> {
  using scratch = scratchSource({
    source,
    typed,
  },);
  try {
    await spawn(
      'oxlint',
      [
        '--fix',
        '--format',
        'json',
        '-c',
        FIXTURE_CONFIG,
        scratch.filePath,
      ],
      { cwd: ROOT, },
    );
  }
  catch (error: unknown) {
    if ((!((typeof error) === 'object')) || (error === null) || (!('stdout' in error)))
      throw error;
  }
  return readFileSync(
    scratch.filePath,
    'utf8',
  );
}

/** Smoothie-order declarations shared by scratch sources. */
const ORDER_DECLARATIONS = [
  'type Order = {',
  '  readonly toppings: readonly string[];',
  '  readonly scoopGrams: Uint8Array;',
  '  readonly menuCode: string;',
  '};',
  'declare const order: Order;',
];

/** Spreads that are a copy on arrays and a conversion on typed arrays and strings. */
const AMBIGUOUS_SPREADS = [
  'export const firstTwo = [...order.toppings.slice(0, 2,),];',
  'export const doubled = [...order.scoopGrams.map(Number,),];',
  'export const codes = [...order.menuCode.slice(0, 2,),];',
];

/** Issue 563 reproduction: a code-point spread of a string slice. */
const ISSUE_563_SOURCE = [
  'export function hasA({ text, }: { readonly text: string; },): boolean {',
  '  return [...text.slice(0, 3,),].some(function isA(character,): boolean {',
  "    return character === 'a';",
  '  },);',
  '}',
  '',
]
  .join('\n',);

//endregion Helpers

await describe({
  name: 'no-useless-spread',
  children: [
    it({
      name: 'reports every invalid form in a typed project',
      fn: async () => {
        expect(
          await reportedKinds(resolveFixtureTarget({
          fixtureSourceRoot: FIXTURES,
          fixturePath: 'invalid/no-useless-spread.ts',
        },),),
        )
          .toEqual([
            'ambiguousConversion',
            'cloneArray',
            'cloneArray',
            'cloneArray',
            'cloneArray',
            'cloneObject',
            'iterableInForOf',
            'iterableInYieldStar',
            'iterableToArray',
            'iterableToArray',
            'iterableToArray',
            'spreadArrayInArguments',
            'spreadArrayInArray',
            'spreadObjectInObject',
          ],);
      },
    },),
    it({
      name: 'accepts typed conversions, Object.create, and shadowed globals',
      fn: async () => {
        expect(
          await reportedKinds(resolveFixtureTarget({
          fixtureSourceRoot: FIXTURES,
          fixturePath: 'valid/no-useless-spread.ts',
        },),),
        )
          .toEqual([],);
      },
    },),
    it({
      name: 'reports ambiguous spreads without a fix when no type is available',
      fn: async () => {
        using scratch = scratchSource({
          source: [...ORDER_DECLARATIONS, ...AMBIGUOUS_SPREADS, '',].join('\n',),
          typed: false,
        },);
        expect(await reportedKinds(scratch.filePath,),)
          .toEqual(['ambiguousConversion', 'ambiguousConversion', 'ambiguousConversion',],);
      },
    },),
    it({
      name: 'fixes only the proven array copy when types are available',
      fn: async () => {
        /** Scratch source before fixing. */
        const source = [...ORDER_DECLARATIONS, ...AMBIGUOUS_SPREADS, '',].join('\n',);
        expect(await fixedSource({
          source,
          typed: true,
        },),)
          .toBe(source.replace(
            '[...order.toppings.slice(0, 2,),]',
            'order.toppings.slice(0, 2,)',
          ),);
      },
    },),
    it({
      name: 'leaves the issue 563 string spread untouched with or without types',
      fn: async () => {
        expect(await fixedSource({
          source: ISSUE_563_SOURCE,
          typed: false,
        },),)
          .toBe(ISSUE_563_SOURCE,);
        expect(await fixedSource({
          source: ISSUE_563_SOURCE,
          typed: true,
        },),)
          .toBe(ISSUE_563_SOURCE,);
      },
    },),
    it({
      name: 'fixes certain copies, literal spreads, and iterable consumers',
      fn: async () => {
        /** Source whose every spread is provably removable. */
        const source = [
          'declare const source: Iterable<number>;',
          'export const fromArray = [...Array.from(source,),];',
          'export const sized = [...new Array(3,),];',
          'export const literal = [1, ...[2, 3,], 4,];',
          'export const empty = [1, ...[], 2,];',
          'export const set = new Set([...source,],);',
          "export const entries = { ...Object.fromEntries([['a', 1,],],), };",
          '',
        ]
          .join('\n',);
        expect(await fixedSource({
          source,
          typed: false,
        },),)
          .toBe([
            'declare const source: Iterable<number>;',
            'export const fromArray = Array.from(source,);',
            'export const sized = new Array(3,).fill();',
            'export const literal = [1, 2, 3, 4,];',
            'export const empty = [1,  2,];',
            'export const set = new Set(source,);',
            "export const entries = Object.fromEntries([['a', 1,],],);",
            '',
          ]
            .join('\n',),);
      },
    },),
  ],
},);

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

import type { Context, } from '@oxlint/plugins';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import spawn from 'nano-spawn';

import type { ChainNode, } from './utility/chain.ts';
import { chainBreakOffsets, } from './utility/chain-flatten.ts';

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

/** Minimal token stub the chain walk reads: a value to classify and a start offset. */
type TokenStub = {
  /** Token text, classified against `.`/`(`/`)`/operator by the walk. */
  readonly value: string;
  /** Byte offset of the token's start. */
  readonly start: number;
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
 * Casts a structural stub to a `ChainNode` for synthetic-AST construction.
 *
 * The chain walk reads only `type`, the receiver links, `start`/`end`, and a
 * member's `property`/`computed`; a hand-built stub supplies exactly those, so
 * one assertion at the boundary keeps the builders free of per-field casts.
 *
 * @param stub - object carrying the chain-walk fields for one node
 *
 * @returns stub viewed as a `ChainNode`
 */
function asChainNode(stub: object,): ChainNode {
  return stub as unknown as ChainNode;
}

/**
 * Builds a mock rule context whose token lookups satisfy the chain walk for
 * synthetic nodes, so the flatten can run on chains far deeper than oxlint feeds
 * a plugin in practice (where its own deep-AST handling fails first).
 *
 * `getTokenBefore` returns the dot punctuator for a property stub (no `type`)
 * and a non-`(` neighbour for a node; `getTokenAfter` returns the `+` operator
 * when a filter is supplied (the operator-token lookup) and a non-`)` neighbour
 * otherwise (the grouping-paren probe). No node is ever treated as grouped.
 *
 * @returns context stub exposing the two token accessors the walk uses
 */
function mockChainContext(): Context {
  /**
   * @param target - node or property whose preceding token is wanted
   *
   * @returns dot for a property stub, a non-`(` marker for a node
   */
  function getTokenBefore(target: {
    readonly type?: string;
    readonly start: number;
  },): TokenStub {
    return (target.type === undefined)
      ? {
        value: '.',
        start: target.start - 1,
      }
      : {
        value: 'x',
        start: target.start - 1,
      };
  }
  /**
   * @param target - left operand or node whose following token is wanted
   * @param options - present for the operator-token lookup, absent for the paren probe
   *
   * @returns `+` operator token when filtered, a non-`)` marker otherwise
   */
  function getTokenAfter(
    target: { readonly end: number; },
    options?: { readonly filter: (token: TokenStub,) => boolean; },
  ): TokenStub {
    return (options === undefined)
      ? {
        value: 'x',
        start: target.end,
      }
      : {
        value: '+',
        start: target.end + 1,
      };
  }
  return asChainContext({
    sourceCode: {
      getTokenBefore,
      getTokenAfter,
    },
  },);
}

/**
 * Casts a token-accessor stub to a `Context` for the synthetic chain walk.
 *
 * @param stub - object carrying the two `sourceCode` token accessors
 *
 * @returns stub viewed as a `Context`
 */
function asChainContext(stub: object,): Context {
  return stub as unknown as Context;
}

/**
 * Builds a synthetic member chain `x.a.a...` of the given step count.
 *
 * @param steps - number of `.a` member steps past the leaf
 *
 * @returns outermost `MemberExpression` node of the chain
 */
function buildMemberChain(steps: number,): ChainNode {
  /** Leaf identifier `x` at the head of the chain. */
  const leaf = asChainNode({
    type: 'Identifier',
    start: 0,
    end: 1,
  },);
  return Array.from({ length: steps, },).reduce(
    function addStep(object: ChainNode, _step, index,): ChainNode {
      /** Byte offset of this step's dot punctuator. */
      const dotStart = 1 + (index * 2);
      return asChainNode({
        type: 'MemberExpression',
        object,
        computed: false,
        property: {
          start: dotStart + 1,
          end: dotStart + 2,
        },
        start: 0,
        end: dotStart + 2,
      },);
    },
    leaf,
  );
}

/**
 * Builds a synthetic left-associative operator chain `a + a + ...`.
 *
 * @param operators - number of `+` operators in the chain
 *
 * @returns outermost `BinaryExpression` node of the chain
 */
function buildOperatorChain(operators: number,): ChainNode {
  /** Leftmost operand `a`. */
  const leaf = asChainNode({
    type: 'Identifier',
    start: 0,
    end: 1,
  },);
  return Array.from({ length: operators, },).reduce(
    function addOperator(left: ChainNode, _operator, index,): ChainNode {
      /** Byte offset of this operand's `a`, four columns per `+ a` step. */
      const operandStart = 4 * (index + 1);
      return asChainNode({
        type: 'BinaryExpression',
        operator: '+',
        left,
        right: asChainNode({
          type: 'Identifier',
          start: operandStart,
          end: operandStart + 1,
        },),
        start: 0,
        end: operandStart + 1,
      },);
    },
    leaf,
  );
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
          name: 'reports each non-canonical chain exactly once and nothing else',
          fn: async () => {
            const diagnostics = await lint('invalid/chain-per-line.ts',);
            /** chain-per-line diagnostics isolated from any unrelated fixture violations. */
            const chainDiagnostics = diagnostics.filter(function isChain(diagnostic,): boolean {
              return diagnostic.code === 'stylistic(chain-per-line)';
            },);
            // The fixture has ten non-canonical chains (b1..b10); each root fires once.
            expect(chainDiagnostics.length,).toBe(10,);
            // Declarations are `any`-typed, so chain-per-line is the only rule that fires.
            expect(uniqueRules(diagnostics,),).toEqual(['stylistic(chain-per-line)',],);
            expect(chainDiagnostics[0]?.message,).toBe(
              'Put each operator, member, or method step in this chain on its own line.',
            );
          },
        },),
        it({
          name: 'reports a chain with an interior comment without dropping other rules',
          fn: async () => {
            const diagnostics = await lint('invalid/chain-comment.ts',);
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
        it({
          name: 'flattens a very long chain without stack overflow',
          fn: async () => {
            // docs/audit/chain-flatten-skewed-tree.md: the prior recursive flatteners
            // overflowed near member n=12000 and binary n=8000 because a member or
            // left-associative operator chain is a left-nested spine whose depth equals
            // its length. The iterative walk has O(1) extra stack depth, so flattening a
            // chain far past those thresholds returns instead of throwing RangeError.
            // Exercised directly on the flatten because oxlint's own deep-AST handling
            // fails first end-to-end (drops the rule near n=4000, then crashes), so a
            // reintroduced recursion would not be caught through a real lint run.
            /** Step count well past both audited overflow thresholds and the JS stack. */
            const steps = 50_000;
            /** Shared mock context; the synthetic nodes carry their own offsets. */
            const context = mockChainContext();
            /** Break offsets of a `steps`-deep member spine. */
            const memberBreaks = chainBreakOffsets({
              context,
              node: buildMemberChain(steps,),
            },);
            /** Break offsets of a `steps`-operator left-associative spine. */
            const operatorBreaks = chainBreakOffsets({
              context,
              node: buildOperatorChain(steps,),
            },);
            // A member chain breaks every step past the head's two segments; an operator
            // chain breaks every operator past the source-first one. Both reaching the
            // expected count proves the flatten ran to completion without overflowing.
            expect(memberBreaks.length,).toBe(steps
              - 1,);
            expect(operatorBreaks.length,).toBe(steps
              - 1,);
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
          name: '--fix renders each chain in canonical layout, idempotently and without trailing whitespace',
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
            /** File content after the first --fix pass. */
            const fixedOnce = readFileSync(chainCopy.filePath, 'utf8',);

            /** Exact canonical layout expected for each chain in the fixture. */
            const expectedLayouts = [
              'const b1 = obj.foo\n  .bar;',
              'const b2 = ctx.sc\n  .getText();',
              'const b3 = obj.b\n  .c\n  .d;',
              'const b4 = foo()\n  .bar()[0];',
              'const b5 = items.map(a)\n  .filter(b)\n  .filter(c);',
              'const b6 = a + b\n  + c\n  + d;',
              'const b7 = x && y\n  && z;',
              'const b8 = aa.b()\n  .c()\n  + dd.e()\n  .f();',
              'const b9 = obj.b\n  .c\n  .d\n  .toString()\n  .trim();',
              'const b10 = obj.a\n  .b\n  > c;',
            ];
            expectedLayouts.forEach(function assertLayout(layout,): void {
              expect(fixedOnce,).toContain(layout,);
            },);

            /** Lines of the fixed output, for whitespace-shape regression checks. */
            const lines = fixedOnce.split('\n',);
            expect(
              lines.some(function endsInWhitespace(line,): boolean {
                /** Last character of the line, or `undefined` when the line is empty. */
                const last = line.at(-1,);
                return (last === ' ') || (last === '\t');
              },),
            ).toBe(false,);
            expect(
              lines.some(function isWhitespaceOnly(line,): boolean {
                return (line.length > 0) && (line.trim() === '');
              },),
            ).toBe(false,);

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
              // --fix may exit non-zero
            }
            // Second pass changes nothing: the fix is idempotent.
            expect(readFileSync(chainCopy.filePath, 'utf8',),).toBe(fixedOnce,);

            const diagnostics = await lint(chainCopy.filePath,);
            expect(
              diagnostics.filter(function isChain(d,): boolean {
                return d.code === 'stylistic(chain-per-line)';
              },),
            ).toEqual([],);
          },
        },),
        it({
          name: '--fix preserves a chain whose interior comment suppresses the fix',
          fn: async () => {
            /** Source fixture copied so --fix never mutates original fixture. */
            const commentSrc = resolve(
              FIXTURES,
              'invalid',
              'chain-comment.ts',
            );
            /** Temp fixture copy isolated from parallel autofix tests. */
            using commentCopy = createTempFixtureFile({
              fileName: 'chain-comment.ts',
              sourcePath: commentSrc,
            },);
            /** Original content; the suppressed fix must leave it byte-for-byte. */
            const before = readFileSync(commentCopy.filePath, 'utf8',);

            try {
              await spawn(
                'oxlint',
                [
                  '--fix',
                  '-c',
                  FIXTURE_CONFIG,
                  commentCopy.filePath,
                ],
                { cwd: ROOT, },
              );
            }
            catch {
              // --fix may exit non-zero when unfixable issues remain
            }
            expect(readFileSync(commentCopy.filePath, 'utf8',),).toBe(before,);
          },
        },),
        it({
          name: '--fix applies to a chain whose comment sits in trailing call args',
          fn: async () => {
            /** Source fixture copied so --fix never mutates the original fixture. */
            const argsSrc = resolve(
              FIXTURES,
              'invalid',
              'chain-comment-in-args.ts',
            );
            /** Temp fixture copy isolated from parallel autofix tests. */
            using argsCopy = createTempFixtureFile({
              fileName: 'chain-comment-in-args.ts',
              sourcePath: argsSrc,
            },);
            /** Original content; unlike the head-comment case, the fix must rewrite it. */
            const before = readFileSync(argsCopy.filePath, 'utf8',);

            try {
              await spawn(
                'oxlint',
                [
                  '--fix',
                  '-c',
                  FIXTURE_CONFIG,
                  argsCopy.filePath,
                ],
                { cwd: ROOT, },
              );
            }
            catch {
              // --fix may exit non-zero when unfixable issues remain
            }
            /** Content after the fix: the chain broke at the member step. */
            const after = readFileSync(argsCopy.filePath, 'utf8',);
            // The fix applied rather than being suppressed by the interior comment.
            expect(after,).not.toBe(before,);
            // The continuation-slice comment survived verbatim, never relocated or dropped.
            expect(after.includes('// keep this note inside the call',),).toBe(true,);
            // The member axis broke `obj.a` onto the head line.
            expect(after.includes('obj.a\n',),).toBe(true,);
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

            // oxlint applies at most one fix per overlapping byte region per pass, so
            // chain-per-line and the no-mixed-operators paren wrap settle over several
            // passes: pass 1 breaks the chain, pass 2 wraps the mixed operands, pass 3
            // re-indents the now-nested inner chain. Run --fix until the file stops
            // changing (capped well above the need) rather than hard-coding a count.
            for (
              let pass = 0;
              pass < 8;
              pass += 1
            ) {
              /** File content before this pass; an unchanged result after it means convergence. */
              const before = readFileSync(combinedCopy.filePath, 'utf8',);
              try {
                // oxlint-disable-next-line eslint/no-await-in-loop -- each pass must read the previous pass's output from disk
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
              if (readFileSync(combinedCopy.filePath, 'utf8',)
                === before) {
                break;
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

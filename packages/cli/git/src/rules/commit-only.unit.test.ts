import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

import { commitOnly, } from './commit-only.ts';

/** Commit argv forms that git permits without positional pathspecs in only mode. */
const PATHLESS_ALLOWED_CASES: readonly {
  /** Human-readable case name shown in test output. */
  readonly name: string;
  /** Git argv passed to commit-only rule. */
  readonly args: readonly string[];
  /** Expected argv after commit-only injection. */
  readonly expected: readonly string[];
}[] = [
  {
    name: '--amend',
    args: [
      'commit',
      '--amend',
      '-m',
      'message',
    ],
    expected: [
      'commit',
      '-o',
      '--amend',
      '-m',
      'message',
    ],
  },
  {
    name: '--allow-empty',
    args: [
      'commit',
      '--allow-empty',
      '-m',
      'message',
    ],
    expected: [
      'commit',
      '-o',
      '--allow-empty',
      '-m',
      'message',
    ],
  },
  {
    name: '--pathspec-from-file separated value',
    args: [
      'commit',
      '--pathspec-from-file',
      'paths.txt',
      '-m',
      'message',
    ],
    expected: [
      'commit',
      '-o',
      '--pathspec-from-file',
      'paths.txt',
      '-m',
      'message',
    ],
  },
  {
    name: '--pathspec-from-file inline value',
    args: [
      'commit',
      '--pathspec-from-file=paths.txt',
      '-m',
      'message',
    ],
    expected: [
      'commit',
      '-o',
      '--pathspec-from-file=paths.txt',
      '-m',
      'message',
    ],
  },
];

/** Commit argv forms that should be rejected before git emits opaque errors. */
const REJECTED_CASES: readonly {
  /** Human-readable case name shown in test output. */
  readonly name: string;
  /** Git argv passed to commit-only rule. */
  readonly args: readonly string[];
  /** Message fragment expected on thrown error. */
  readonly message: string;
}[] = [
  {
    name: 'pathless normal commit',
    args: [
      'commit',
      '-m',
      'message',
    ],
    message: 'requires an explicit pathspec',
  },
  {
    name: 'short all flag',
    args: [
      'commit',
      '-a',
      '-m',
      'message',
    ],
    message: 'rejects -a/--all',
  },
  {
    name: 'long all flag',
    args: [
      'commit',
      '--all',
      '-m',
      'message',
    ],
    message: 'rejects -a/--all',
  },
  {
    name: 'clustered all and message flags',
    args: [
      'commit',
      '-am',
      'message',
    ],
    message: 'rejects -a/--all',
  },
];

/**
 * Captures synchronous error from commit-only invocation.
 *
 * @param args - Git argv to pass through commit-only rule.
 *
 * @returns Error thrown by rule, or `undefined` when rule passes.
 *
 * @example
 * ```ts
 * const caught = catchCommitOnlyError(['commit', '-m', 'message']);
 * expect(caught).toBeInstanceOf(Error);
 * ```
 */
function catchCommitOnlyError(args: readonly string[],): unknown {
  try {
    commitOnly(args,);
  }
  catch (error) {
    return error;
  }
  return undefined;
}

await describe({
  name: commitOnly.name,
  children: [
    it({
      name: 'passes non-commit commands through unchanged',
      fn: async function testNonCommitCommand(): Promise<void> {
        /** Non-commit argv that should not be transformed. */
        const args = [
          'status',
          '--short',
        ] as const;

        expect(commitOnly(args,),).toBe(args,);
      },
    },),
    it({
      name: 'injects -o immediately after commit when pathspec is present',
      fn: async function testInjectsOnly(): Promise<void> {
        expect(commitOnly([
          'commit',
          '-m',
          'message',
          'file.ts',
        ],),)
          .toEqual([
            'commit',
            '-o',
            '-m',
            'message',
            'file.ts',
          ],);
      },
    },),
    it({
      name: 'preserves global options before commit',
      fn: async function testGlobalOptions(): Promise<void> {
        expect(commitOnly([
          '-C',
          '/tmp/repo',
          'commit',
          '-m',
          'message',
          'file.ts',
        ],),)
          .toEqual([
            '-C',
            '/tmp/repo',
            'commit',
            '-o',
            '-m',
            'message',
            'file.ts',
          ],);
      },
    },),
    it({
      name: 'strips escape hatch and skips validation',
      fn: async function testEscapeHatch(): Promise<void> {
        expect(commitOnly([
          'commit',
          '--no-enforce-only',
          '-am',
          'message',
        ],),)
          .toEqual([
            'commit',
            '-am',
            'message',
          ],);
      },
    },),
    it({
      name: 'skips injection when explicit -o is present',
      fn: async function testExplicitOnly(): Promise<void> {
        /** Commit argv with user-supplied only flag. */
        const args = [
          'commit',
          '-o',
          '-m',
          'message',
          'file.ts',
        ] as const;

        expect(commitOnly(args,),).toBe(args,);
      },
    },),
    it({
      name: 'skips injection when clustered -o is present',
      fn: async function testClusteredExplicitOnly(): Promise<void> {
        /** Commit argv with user-supplied only flag inside short cluster. */
        const args = [
          'commit',
          '-om',
          'message',
          'file.ts',
        ] as const;

        expect(commitOnly(args,),).toBe(args,);
      },
    },),
    it({
      name: 'allows --no-only as explicit opt-out without pathspec',
      fn: async function testNoOnlyOptOut(): Promise<void> {
        /** Commit argv with user-supplied no-only flag. */
        const args = [
          'commit',
          '--no-only',
          '-m',
          'message',
        ] as const;

        expect(commitOnly(args,),).toBe(args,);
      },
    },),
    it({
      name: 'does not mistake message text for -a flag',
      fn: async function testMessageLooksLikeAllFlag(): Promise<void> {
        expect(commitOnly([
          'commit',
          '-m',
          '-a',
          'file.ts',
        ],),)
          .toEqual([
            'commit',
            '-o',
            '-m',
            '-a',
            'file.ts',
          ],);
      },
    },),
    it({
      name: 'treats dash-leading tokens after -- as pathspecs',
      fn: async function testDashLeadingPathspec(): Promise<void> {
        expect(commitOnly([
          'commit',
          '-m',
          'message',
          '--',
          '-dash-file',
        ],),)
          .toEqual([
            'commit',
            '-o',
            '-m',
            'message',
            '--',
            '-dash-file',
          ],);
      },
    },),
    ...PATHLESS_ALLOWED_CASES.map(function mapPathlessAllowedCase(pathlessCase,) {
      return it({
        name: `allows pathless ${pathlessCase.name}`,
        fn: async function testPathlessAllowedCase(): Promise<void> {
          expect(commitOnly(pathlessCase.args,),).toEqual(pathlessCase.expected,);
        },
      },);
    },),
    ...REJECTED_CASES.map(function mapRejectedCase(rejectedCase,) {
      return it({
        name: `rejects ${rejectedCase.name}`,
        fn: async function testRejectedCase(): Promise<void> {
          /** Error thrown for this rejected commit argv. */
          const caught = catchCommitOnlyError(rejectedCase.args,);

          expect(caught,).toBeInstanceOf(Error,);
          expect((caught as Error).message,).toContain(rejectedCase.message,);
        },
      },);
    },),
  ],
},);

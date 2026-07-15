import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import type { IndexVsHeadState, } from './commit-index-check.ts';
import type { SequencerState, } from './commit-sequencer-check.ts';
import {
  commitOnly,
  type CommitOnlyRule,
  makeCommitOnly,
} from './commit-only.ts';

/**
 * Index checker stub reporting staged changes (index differs from HEAD).
 *
 * @returns `'differs'` always.
 *
 * @example
 * ```ts
 * await dirtyIndexChecker();
 * // => 'differs'
 * ```
 */
async function dirtyIndexChecker(): Promise<IndexVsHeadState> {
  return 'differs';
}

/**
 * Index checker stub reporting an index matching HEAD.
 *
 * @returns `'matches'` always.
 *
 * @example
 * ```ts
 * await cleanIndexChecker();
 * // => 'matches'
 * ```
 */
async function cleanIndexChecker(): Promise<IndexVsHeadState> {
  return 'matches';
}

/**
 * Index checker stub reporting git could not answer (e.g. unborn HEAD).
 *
 * @returns `'unknown'` always.
 *
 * @example
 * ```ts
 * await unknownIndexChecker();
 * // => 'unknown'
 * ```
 */
async function unknownIndexChecker(): Promise<IndexVsHeadState> {
  return 'unknown';
}

/**
 * Index checker stub that fails the test when consulted.
 *
 * @returns Never resolves.
 *
 * @throws Always, so argv shapes decided without repository state fail loudly when they consult the checker.
 *
 * @example
 * ```ts
 * await forbiddenIndexChecker();
 * // throws
 * ```
 */
async function forbiddenIndexChecker(): Promise<IndexVsHeadState> {
  throw new Error('index checker must not be consulted for this argv',);
}

/**
 * Sequencer checker stub reporting a merge/cherry-pick/revert awaiting its
 * concluding commit.
 *
 * @returns `'in-progress'` always.
 *
 * @example
 * ```ts
 * await sequencerActiveChecker();
 * // => 'in-progress'
 * ```
 */
async function sequencerActiveChecker(): Promise<SequencerState> {
  return 'in-progress';
}

/**
 * Sequencer checker stub reporting no merge/cherry-pick/revert in progress.
 *
 * @returns `'none'` always.
 *
 * @example
 * ```ts
 * await sequencerNoneChecker();
 * // => 'none'
 * ```
 */
async function sequencerNoneChecker(): Promise<SequencerState> {
  return 'none';
}

/**
 * Sequencer checker stub that fails the test when consulted.
 *
 * @returns Never resolves.
 *
 * @throws Always, so argv shapes decided without repository state fail loudly when they consult the checker.
 *
 * @example
 * ```ts
 * await forbiddenSequencerChecker();
 * // throws
 * ```
 */
async function forbiddenSequencerChecker(): Promise<SequencerState> {
  throw new Error('sequencer checker must not be consulted for this argv',);
}

/** Rule whose decision must come from argv alone, never repository state. */
const commitOnlyStateless = makeCommitOnly({
  checkIndexDiffersFromHead: forbiddenIndexChecker,
  checkSequencerInProgress: forbiddenSequencerChecker,
},);

/** Rule for pathless argv outside any merge/cherry-pick/revert; index checker stays forbidden. */
const commitOnlyNoSequencer = makeCommitOnly({
  checkIndexDiffersFromHead: forbiddenIndexChecker,
  checkSequencerInProgress: sequencerNoneChecker,
},);

/** Rule observing a merge/cherry-pick/revert awaiting conclusion. */
const commitOnlySequencerActive = makeCommitOnly({
  checkIndexDiffersFromHead: forbiddenIndexChecker,
  checkSequencerInProgress: sequencerActiveChecker,
},);

/** Rule observing staged changes. */
const commitOnlyDirtyIndex = makeCommitOnly({
  checkIndexDiffersFromHead: dirtyIndexChecker,
  checkSequencerInProgress: forbiddenSequencerChecker,
},);

/** Rule observing an index matching HEAD. */
const commitOnlyCleanIndex = makeCommitOnly({
  checkIndexDiffersFromHead: cleanIndexChecker,
  checkSequencerInProgress: forbiddenSequencerChecker,
},);

/** Rule whose index checker cannot determine state. */
const commitOnlyUnknownIndex = makeCommitOnly({
  checkIndexDiffersFromHead: unknownIndexChecker,
  checkSequencerInProgress: forbiddenSequencerChecker,
},);

/** Commit argv forms that git permits without positional pathspecs in only mode. */
const PATHLESS_ALLOWED_CASES: readonly {
  /** Human-readable case name shown in test output. */
  readonly name: string;
  /** Rule variant exercising this case; pathless amend/allow-empty consult the index checker, pathspec-file forms must not. */
  readonly rule: CommitOnlyRule;
  /** Git argv passed to commit-only rule. */
  readonly args: readonly string[];
  /** Expected argv after commit-only injection. */
  readonly expected: readonly string[];
}[] = [
  {
    name: '--amend',
    rule: commitOnlyCleanIndex,
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
    rule: commitOnlyCleanIndex,
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
    rule: commitOnlyStateless,
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
    rule: commitOnlyStateless,
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

/** Commit argv forms where no-value options appear before positional pathspecs. */
const NO_VALUE_FLAG_PATHSPEC_CASES: readonly {
  /** Human-readable case name shown in test output. */
  readonly name: string;
  /** Git argv passed to commit-only rule. */
  readonly args: readonly string[];
  /** Expected argv after commit-only injection. */
  readonly expected: readonly string[];
}[] = [
  {
    name: '-q before pathspec',
    args: [
      'commit',
      '-q',
      'file.ts',
      '-F',
      'message.txt',
    ],
    expected: [
      'commit',
      '-o',
      '-q',
      'file.ts',
      '-F',
      'message.txt',
    ],
  },
  {
    name: '-v before pathspec',
    args: [
      'commit',
      '-v',
      'file.ts',
      '-m',
      'message',
    ],
    expected: [
      'commit',
      '-o',
      '-v',
      'file.ts',
      '-m',
      'message',
    ],
  },
  {
    name: '-n before pathspec',
    args: [
      'commit',
      '-n',
      'file.ts',
      '-m',
      'message',
    ],
    expected: [
      'commit',
      '-o',
      '-n',
      'file.ts',
      '-m',
      'message',
    ],
  },
  {
    name: '--no-verify before pathspec',
    args: [
      'commit',
      '--no-verify',
      'file.ts',
      '-m',
      'message',
    ],
    expected: [
      'commit',
      '-o',
      '--no-verify',
      'file.ts',
      '-m',
      'message',
    ],
  },
  {
    name: '--dry-run before pathspec',
    args: [
      'commit',
      '--dry-run',
      'file.ts',
      '-m',
      'message',
    ],
    expected: [
      'commit',
      '-o',
      '--dry-run',
      'file.ts',
      '-m',
      'message',
    ],
  },
];

/** Commit argv forms where separated-value options appear before positional pathspecs. */
const VALUE_OPTION_PATHSPEC_CASES: readonly {
  /** Human-readable case name shown in test output. */
  readonly name: string;
  /** Git argv passed to commit-only rule. */
  readonly args: readonly string[];
  /** Expected argv after commit-only injection. */
  readonly expected: readonly string[];
}[] = [
  {
    name: '--author before pathspec',
    args: [
      'commit',
      '--author',
      'Author <author@example.invalid>',
      'file.ts',
      '-m',
      'message',
    ],
    expected: [
      'commit',
      '-o',
      '--author',
      'Author <author@example.invalid>',
      'file.ts',
      '-m',
      'message',
    ],
  },
  {
    name: '--cleanup before pathspec',
    args: [
      'commit',
      '--cleanup',
      'strip',
      'file.ts',
      '-m',
      'message',
    ],
    expected: [
      'commit',
      '-o',
      '--cleanup',
      'strip',
      'file.ts',
      '-m',
      'message',
    ],
  },
  {
    name: '--trailer before pathspec',
    args: [
      'commit',
      '--trailer',
      'Reviewed-by: Author <author@example.invalid>',
      'file.ts',
      '-m',
      'message',
    ],
    expected: [
      'commit',
      '-o',
      '--trailer',
      'Reviewed-by: Author <author@example.invalid>',
      'file.ts',
      '-m',
      'message',
    ],
  },
  {
    name: '--fixup before pathspec',
    args: [
      'commit',
      '--fixup',
      'HEAD',
      'file.ts',
    ],
    expected: [
      'commit',
      '-o',
      '--fixup',
      'HEAD',
      'file.ts',
    ],
  },
];

/** Commit argv forms that should be rejected before git emits opaque errors. */
const REJECTED_CASES: readonly {
  /** Human-readable case name shown in test output. */
  readonly name: string;
  /** Rule variant exercising this case; pathless rejections consult the sequencer checker, `-a` rejections must not. */
  readonly rule: CommitOnlyRule;
  /** Git argv passed to commit-only rule. */
  readonly args: readonly string[];
  /** Message fragment expected on thrown error. */
  readonly message: string;
}[] = [
  {
    name: 'pathless normal commit',
    rule: commitOnlyNoSequencer,
    args: [
      'commit',
      '-m',
      'message',
    ],
    message: 'requires an explicit pathspec',
  },
  {
    name: 'short all flag',
    rule: commitOnlyStateless,
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
    rule: commitOnlyStateless,
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
    rule: commitOnlyStateless,
    args: [
      'commit',
      '-am',
      'message',
    ],
    message: 'rejects -a/--all',
  },
  {
    name: 'pathless separated author option',
    rule: commitOnlyNoSequencer,
    args: [
      'commit',
      '--author',
      'Author <author@example.invalid>',
      '-m',
      'message',
    ],
    message: 'requires an explicit pathspec',
  },
];

/**
 * Captures error from commit-only invocation.
 *
 * @param options - Rule variant and git argv to pass through it.
 *
 * @returns Error thrown by rule, or `undefined` when rule passes.
 *
 * @example
 * ```ts
 * const caught = await catchCommitOnlyError({
 *   rule: commitOnlyStateless,
 *   args: ['commit', '-m', 'message'],
 * });
 * expect(caught).toBeInstanceOf(Error);
 * ```
 */
async function catchCommitOnlyError({
  rule,
  args,
}: {
  /** Commit-only rule variant under test. */
  readonly rule: CommitOnlyRule;
  /** Git argv to pass through commit-only rule. */
  readonly args: readonly string[];
},): Promise<unknown> {
  try {
    await rule(args,);
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

        expect(await commitOnly(args,),).toBe(args,);
      },
    },),
    it({
      name: 'injects -o immediately after commit when pathspec is present',
      fn: async function testInjectsOnly(): Promise<void> {
        expect(await commitOnlyStateless([
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
        expect(await commitOnlyStateless([
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
        expect(await commitOnlyStateless([
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

        expect(await commitOnlyStateless(args,),).toBe(args,);
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

        expect(await commitOnlyStateless(args,),).toBe(args,);
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

        expect(await commitOnlyStateless(args,),).toBe(args,);
      },
    },),
    it({
      name: 'does not mistake message text for -a flag',
      fn: async function testMessageLooksLikeAllFlag(): Promise<void> {
        expect(await commitOnlyStateless([
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
        expect(await commitOnlyStateless([
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
    it({
      name: 'treats lone dash before -- as pathspec',
      fn: async function testLoneDashPathspec(): Promise<void> {
        expect(await commitOnlyStateless([
          'commit',
          '-m',
          'message',
          '-',
        ],),)
          .toEqual([
            'commit',
            '-o',
            '-m',
            'message',
            '-',
          ],);
      },
    },),

    //region Pathless amend/allow-empty dirty-index guard

    it({
      name: 'rejects pathless --amend when index differs from HEAD',
      fn: async function testPathlessAmendDirtyIndex(): Promise<void> {
        /** Error thrown for the exact argv shape from the observed silent no-op incident. */
        const caught = await catchCommitOnlyError({
          rule: commitOnlyDirtyIndex,
          args: [
            'commit',
            '--amend',
            '--no-edit',
          ],
        },);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain(
          'git commit --amend without pathspecs would silently ignore your staged changes',
        );
        expect((caught as Error).message,).toContain('--no-only',);
      },
    },),
    it({
      name: 'rejects pathless --allow-empty when index differs from HEAD',
      fn: async function testPathlessAllowEmptyDirtyIndex(): Promise<void> {
        /** Error thrown for pathless allow-empty commit over a dirty index. */
        const caught = await catchCommitOnlyError({
          rule: commitOnlyDirtyIndex,
          args: [
            'commit',
            '--allow-empty',
            '-m',
            'message',
          ],
        },);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain(
          'git commit --allow-empty without pathspecs would silently ignore your staged changes',
        );
      },
    },),
    it({
      name: 'injects -o for pathless --amend when index state is undeterminable',
      fn: async function testPathlessAmendUnknownIndex(): Promise<void> {
        expect(await commitOnlyUnknownIndex([
          'commit',
          '--amend',
          '-m',
          'message',
        ],),)
          .toEqual([
            'commit',
            '-o',
            '--amend',
            '-m',
            'message',
          ],);
      },
    },),
    it({
      name: 'skips index check when --amend has pathspec',
      fn: async function testAmendWithPathspec(): Promise<void> {
        expect(await commitOnlyStateless([
          'commit',
          '--amend',
          '--no-edit',
          'file.ts',
        ],),)
          .toEqual([
            'commit',
            '-o',
            '--amend',
            '--no-edit',
            'file.ts',
          ],);
      },
    },),
    it({
      name: 'skips index check when --amend pairs with --pathspec-from-file',
      fn: async function testAmendWithPathspecFromFile(): Promise<void> {
        expect(await commitOnlyStateless([
          'commit',
          '--amend',
          '--pathspec-from-file',
          'paths.txt',
          '-m',
          'message',
        ],),)
          .toEqual([
            'commit',
            '-o',
            '--amend',
            '--pathspec-from-file',
            'paths.txt',
            '-m',
            'message',
          ],);
      },
    },),
    it({
      name: 'skips index check for pathless --amend --no-only',
      fn: async function testAmendNoOnly(): Promise<void> {
        /** Commit argv where user explicitly chose to commit the whole index. */
        const args = [
          'commit',
          '--amend',
          '--no-only',
          '-m',
          'message',
        ] as const;

        expect(await commitOnlyStateless(args,),).toBe(args,);
      },
    },),
    it({
      name: 'skips index check for pathless --amend with explicit -o',
      fn: async function testAmendExplicitOnly(): Promise<void> {
        /** Commit argv where user explicitly chose only mode for amend. */
        const args = [
          'commit',
          '-o',
          '--amend',
          '-m',
          'message',
        ] as const;

        expect(await commitOnlyStateless(args,),).toBe(args,);
      },
    },),

    //endregion Pathless amend/allow-empty dirty-index guard

    //region Include mode skips injection (git forbids -i with --only)

    it({
      name: 'skips injection when short include flag is present',
      fn: async function testShortIncludeFlag(): Promise<void> {
        /** Commit argv where user chose include mode with -i. */
        const args = [
          'commit',
          '-i',
          '-m',
          'message',
          'file.ts',
        ] as const;

        expect(await commitOnlyStateless(args,),).toBe(args,);
      },
    },),
    it({
      name: 'skips injection when long include flag is present',
      fn: async function testLongIncludeFlag(): Promise<void> {
        /** Commit argv where user chose include mode with --include. */
        const args = [
          'commit',
          '--include',
          '-m',
          'message',
          'file.ts',
        ] as const;

        expect(await commitOnlyStateless(args,),).toBe(args,);
      },
    },),
    it({
      name: 'skips injection when abbreviated include flag is present',
      fn: async function testAbbreviatedIncludeFlag(): Promise<void> {
        /** Commit argv using git's accepted --inc abbreviation of --include. */
        const args = [
          'commit',
          '--inc',
          '-m',
          'message',
          'file.ts',
        ] as const;

        expect(await commitOnlyStateless(args,),).toBe(args,);
      },
    },),
    it({
      name: 'skips injection when include flag leads a short cluster',
      fn: async function testClusteredIncludeFlag(): Promise<void> {
        /** Commit argv with include and message flags clustered. */
        const args = [
          'commit',
          '-im',
          'message',
          'file.ts',
        ] as const;

        expect(await commitOnlyStateless(args,),).toBe(args,);
      },
    },),

    //endregion Include mode skips injection

    //region Merge/cherry-pick/revert conclusion passthrough

    it({
      name: 'passes pathless commit through unchanged during sequencer conclusion',
      fn: async function testSequencerConclusionPassthrough(): Promise<void> {
        /** Pathless commit argv that concludes a merge/cherry-pick/revert. */
        const args = [
          'commit',
          '-m',
          'merge main into feature',
        ] as const;

        expect(await commitOnlySequencerActive(args,),).toBe(args,);
      },
    },),
    it({
      name: 'still rejects -a during sequencer conclusion',
      fn: async function testAllFlagDuringSequencer(): Promise<void> {
        /** Error thrown before the sequencer checker could be consulted. */
        const caught = await catchCommitOnlyError({
          rule: commitOnlySequencerActive,
          args: [
            'commit',
            '-am',
            'message',
          ],
        },);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain('rejects -a/--all',);
      },
    },),
    it({
      name: 'pathless rejection names --no-only as an explicit choice',
      fn: async function testPathlessRejectionNamesNoOnly(): Promise<void> {
        /** Error thrown for a pathless commit outside any sequencer state. */
        const caught = await catchCommitOnlyError({
          rule: commitOnlyNoSequencer,
          args: [
            'commit',
            '-m',
            'message',
          ],
        },);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain('--no-only',);
      },
    },),

    //endregion Merge/cherry-pick/revert conclusion passthrough

    ...NO_VALUE_FLAG_PATHSPEC_CASES.map(function mapNoValueFlagPathspecCase(pathspecCase,) {
      return it({
        name: `detects pathspec after no-value flag ${pathspecCase.name}`,
        fn: async function testNoValueFlagPathspecCase(): Promise<void> {
          expect(await commitOnlyStateless(pathspecCase.args,),).toEqual(pathspecCase.expected,);
        },
      },);
    },),
    ...VALUE_OPTION_PATHSPEC_CASES.map(function mapValueOptionPathspecCase(pathspecCase,) {
      return it({
        name: `detects pathspec after value option ${pathspecCase.name}`,
        fn: async function testValueOptionPathspecCase(): Promise<void> {
          expect(await commitOnlyStateless(pathspecCase.args,),).toEqual(pathspecCase.expected,);
        },
      },);
    },),
    ...PATHLESS_ALLOWED_CASES.map(function mapPathlessAllowedCase(pathlessCase,) {
      return it({
        name: `allows pathless ${pathlessCase.name}`,
        fn: async function testPathlessAllowedCase(): Promise<void> {
          expect(await pathlessCase.rule(pathlessCase.args,),).toEqual(pathlessCase.expected,);
        },
      },);
    },),
    ...REJECTED_CASES.map(function mapRejectedCase(rejectedCase,) {
      return it({
        name: `rejects ${rejectedCase.name}`,
        fn: async function testRejectedCase(): Promise<void> {
          /** Error thrown for this rejected commit argv. */
          const caught = await catchCommitOnlyError({
            rule: rejectedCase.rule,
            args: rejectedCase.args,
          },);

          expect(caught,).toBeInstanceOf(Error,);
          expect((caught as Error).message,).toContain(rejectedCase.message,);
        },
      },);
    },),
  ],
},);

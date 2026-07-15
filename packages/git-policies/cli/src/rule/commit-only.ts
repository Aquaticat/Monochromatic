import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { parseGlobalOptions, } from '../parse-global-options.ts';
import {
  COMMIT_ESCAPE_HATCH,
  parseCommitRegion,
} from '../parser/commit.ts';
import {
  type CheckIndexDiffersFromHead,
  indexDiffersFromHead,
} from './commit-index-check.ts';
import {
  type CheckSequencerInProgress,
  sequencerInProgress,
} from './commit-sequencer-check.ts';

/**
 * Logger root for cli-git after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l, },);
 * ```
 */
const l = tagged({ tag: 'cli-git', },);

//region Commit-only rule

/**
 * Wrapper-only flag that suppresses `-o` injection for one invocation.
 */
const ESCAPE_HATCH = COMMIT_ESCAPE_HATCH;

/**
 * Diagnostic emitted when commit-only enforcement sees no pathspec source and
 * no git mode that permits pathless only-mode commits.
 */
const NO_PATHSPEC_MESSAGE =
  'cli-git: git commit requires an explicit pathspec when commit-only enforcement is active. '
  + 'Name the paths in the commit command (for example, git commit -m <msg> <path>), '
    + 'pass --pathspec-from-file, pass --no-only to commit the entire index, '
    + 'or pass --no-enforce-only to bypass for this invocation.';

/**
 * Diagnostic emitted when commit-only enforcement sees `-a`/`--all`, which
 * stages tracked modifications implicitly before committing.
 */
const ALL_FLAG_MESSAGE =
  'cli-git: git commit rejects -a/--all because it stages every tracked modification before committing. '
  + 'Stage paths explicitly and commit with git commit -m <msg> <path>, '
    + 'or pass --no-enforce-only to bypass for this invocation.';

/**
 * Stable expected commit-only rejection codes.
 */
export type CommitOnlyViolationCode =
  | 'all-flag'
  | 'pathspec-required'
  | 'staged-changes-ignored';

/**
 * Expected non-configurable commit-only rejection.
 */
export class CommitOnlyViolationError extends Error {
  /**
   * Stable core finding code.
   */
  public readonly code: CommitOnlyViolationCode;

  /**
   * Creates expected fixed-transform rejection.
   *
   * @param code - stable rejection code
   *
   * @param message - user-facing explanation
   *
   * @example
   * ```ts
   * throw new CommitOnlyViolationError('pathspec-required', 'Name a path.');
   * ```
   */
  public constructor(
    code: CommitOnlyViolationCode,
    message: string,
  ) {
    super(message,);
    this.name = 'CommitOnlyViolationError';
    this.code = code;
  }
}

/**
 * Builds the diagnostic for pathless `--amend`/`--allow-empty` commits where
 * injected `--only` would make git commit from HEAD's existing tree,
 * silently ignoring whatever is staged.
 *
 * @param flagText - Pathless-allowed flag(s) present on commit argv, echoed
 *   so the message names the exact form that was rejected.
 *
 * @returns Diagnostic naming every explicit way forward.
 *
 * @example
 * ```ts
 * ignoredIndexMessage('--amend');
 * // => 'cli-git: git commit --amend without pathspecs would silently ignore ...'
 * ```
 */
function ignoredIndexMessage(flagText: string,): string {
  return `cli-git: git commit ${flagText} without pathspecs would silently ignore your staged changes. `
    + 'Commit-only enforcement injects --only, and a pathless --only commit reuses HEAD\'s existing tree, '
    + 'leaving staged changes staged with no warning; the index currently differs from HEAD. '
    + 'Choose explicitly: name the paths to include them (git commit --amend <path>), '
    + 'pass --only to proceed without them, '
    + 'or pass --no-only to commit the entire index.';
}

/**
 * Reports whether current commit argv contains wrapper escape in option position.
 *
 * @param args - command arguments to inspect
 *
 * @returns whether commit-only is escaped for this invocation
 *
 * @example
 * ```ts
 * hasCommitOnlyEscapeHatch(['commit', '--no-enforce-only', '-m', 'message']);
 * ```
 */
export function hasCommitOnlyEscapeHatch(args: readonly string[],): boolean {
  /**
   * Located command after global options.
   */
  const { subcommandIndex, } = parseGlobalOptions(args,);
  if (args[subcommandIndex] !== 'commit')
    return false;
  return parseCommitRegion(args.slice(subcommandIndex + 1,),)
    .hasEscapeHatch;
}

/**
 * Commit-only rule signature consumed by the cli-git rule pipeline.
 */
export type CommitOnlyRule = (
  args: readonly string[],
) => Promise<readonly string[]>;

/**
 * Dependencies of the commit-only rule.
 */
type CommitOnlyDependencies = {
  /**
   * Reports whether staged content differs from HEAD in the repository the
   * commit targets; `'unknown'` means git could not answer and the rule
   * defers to real git.
   */
  readonly checkIndexDiffersFromHead: CheckIndexDiffersFromHead;
  /**
   * Reports whether a merge/cherry-pick/revert awaits its concluding commit
   * in the repository the commit targets; `'none'` also covers query
   * failures, restoring normal enforcement.
   */
  readonly checkSequencerInProgress: CheckSequencerInProgress;
};

/**
 * Builds the commit-only rule with an injectable index-vs-HEAD checker so
 * unit tests can exercise the pathless `--amend`/`--allow-empty` guard
 * without spawning git. Production wiring is the {@link commitOnly} export.
 *
 * The rule injects `-o` (a.k.a. `--only`) into `git commit` commands when
 * not already specified, forcing every commit to name the paths it includes
 * rather than silently picking up whatever happens to be staged. The
 * injection slots in immediately after the `commit` token, so
 * pre-subcommand global options (`git -C /repo commit`, `git -c key=val
 * commit`) are preserved and the rule still fires.
 *
 * Skipped when `-o`, `--only`, or `--no-only` is already present in the
 * post-subcommand region (the user made an explicit choice). The
 * wrapper-only flag `--no-enforce-only` is the escape hatch: it is stripped
 * from args before forwarding, and injection is also skipped for that
 * invocation. The post-subcommand region is parsed by an optique-based
 * parser so option arity is respected and inline short-cluster values
 * (`-mhello`, `-amhello`) are interpreted as real git interprets them.
 *
 * Pathless `--amend`/`--allow-empty` commits get one more check before
 * injection: per git's documented semantics, `git commit --only` with no
 * pathspec commits from HEAD's existing tree and ignores the index, so an
 * injected `-o` would turn `git commit --amend --no-edit` after `git add
 * <path>` into a silent no-op (new hash, old tree, change left staged).
 * When the index differs from HEAD the rule therefore rejects the command
 * with a diagnostic naming the explicit choices (pathspec, `--only`,
 * `--no-only`); when the index matches HEAD, or git cannot answer (for
 * example before the first commit), injection proceeds as before.
 *
 * Injection is also skipped when `-i`/`--include` (any accepted
 * abbreviation) is present, because git forbids combining include mode with
 * `--only`; the user already chose how paths combine with the index.
 *
 * Pathless commits during a merge, cherry-pick, or revert conclusion pass
 * through without injection: git forbids partial commits in those states,
 * so the pathless form is the documented way to record the resolution and
 * the rule's usual advice (name the paths) would dead-end on git's
 * `cannot do a partial commit during a merge` fatal.
 *
 * @param checkIndexDiffersFromHead - Index-vs-HEAD checker the returned rule consults.
 *
 * @param checkSequencerInProgress - Merge/cherry-pick/revert state checker
 *   consulted before rejecting pathless commits.
 *
 * @returns Commit-only rule bound to given checkers.
 *
 * @example
 * ```ts
 * const rule = makeCommitOnly({
 *   checkIndexDiffersFromHead: async function fakeIndex() { return 'matches'; },
 *   checkSequencerInProgress: async function fakeSequencer() { return 'none'; },
 * });
 * await rule(['commit', '-m', 'msg', 'file.ts']);
 * // => ['commit', '-o', '-m', 'msg', 'file.ts']
 * ```
 */
export function makeCommitOnly({
  checkIndexDiffersFromHead,
  checkSequencerInProgress,
}: CommitOnlyDependencies,): CommitOnlyRule {
  /**
   * Applies commit-only enforcement to one git argv. Locates the subcommand
   * with {@link parseGlobalOptions} and parses the post-subcommand region
   * with {@link parseCommitRegion} before deciding.
   *
   * @param args - Raw git arguments (global options + subcommand + flags).
   *
   * @returns Modified args with `-o` injected after `commit`, with
   *   `--no-enforce-only` stripped, or unmodified args when the user has
   *   already chosen.
   *
   * @throws When argv is pathless without a pathless-allowed mode (outside a
   *   merge/cherry-pick/revert conclusion), uses `-a`/`--all`, or is a
   *   pathless `--amend`/`--allow-empty` commit whose injected `--only`
   *   would ignore a dirty index.
   *
   * @example
   * ```ts
   * await commitOnly(['commit', '-m', 'msg', 'file.ts']);
   * // => ['commit', '-o', '-m', 'msg', 'file.ts']
   *
   * await commitOnly(['-C', '/repo', 'commit', '-m', 'msg', 'file.ts']);
   * // => ['-C', '/repo', 'commit', '-o', '-m', 'msg', 'file.ts']
   *
   * await commitOnly(['commit', '--no-enforce-only', '-m', 'msg']);
   * // => ['commit', '-m', 'msg']
   *
   * await commitOnly(['commit', '--only', 'file.ts']);
   * // => ['commit', '--only', 'file.ts']
   * ```
   */
  return async function commitOnly(args: readonly string[],): Promise<readonly string[]> {
    /**
     * Position of the `commit` (or other) subcommand within args.
     */
    const { subcommandIndex, } = parseGlobalOptions(args,);

    if (args[subcommandIndex]
      !== 'commit')
      return args;

    /**
     * Tagged logger for the commit-only rule.
     */
    const rl = tagged({
      tag: commitOnly.name,
      l,
    },);

    /**
     * Slice of args strictly after the `commit` token; the place where commit flags live.
     */
    const postSubcommandArgs = args.slice(subcommandIndex + 1,);
    /**
     * Commit region facts parsed by optique.
     */
    const region = parseCommitRegion(postSubcommandArgs,);

    if (region.hasEscapeHatch) {
      rl.debug(`${ESCAPE_HATCH} present, stripping and skipping injection`,);
      /**
       * Pre-subcommand region kept verbatim so global options survive the strip.
       */
      const preAndSubcommand = args.slice(
        0,
        subcommandIndex + 1,
      );
      return [
        ...preAndSubcommand,
        ...postSubcommandArgs.filter(function isNotEscapeHatch(arg,) {
          return arg !== ESCAPE_HATCH;
        },),
      ];
    }

    if (!region.hasNoOnlyFlag) {
      if (region.hasAllFlag)
        throw new CommitOnlyViolationError(
          'all-flag',
          ALL_FLAG_MESSAGE,
        );

      /**
       * True when pathspecs are supplied positionally, through a pathspec file, or by a git mode that permits pathless only commits.
       */
      const hasPathspecSource = region.hasPathspec
        || region
        .hasPathspecFromFile
        || region
        .hasPathlessAllowedFlag
        || region.hasInteractiveFlag
        || region.hasPatchFlag;

      if (!hasPathspecSource) {
        /**
         * Sequencer state consulted before rejecting: pathless commit is the
         * documented conclusion of a merge/cherry-pick/revert, where git
         * forbids partial commits entirely.
         */
        const sequencerState = await checkSequencerInProgress({
          preSubcommandArgs: args.slice(
            0,
            subcommandIndex,
          ),
        },);

        if (sequencerState === 'in-progress') {
          rl.debug(
            'merge/cherry-pick/revert awaiting conclusion; passing pathless commit through without -o',
          );
          return args;
        }

        throw new CommitOnlyViolationError(
          'pathspec-required',
          NO_PATHSPEC_MESSAGE,
        );
      }
    }

    if (region.hasExplicitOnlyFlag) {
      rl.debug('-o, --only, or --no-only already present, skipping injection',);
      return args;
    }

    if (region.hasIncludeFlag || region.hasInteractiveFlag
      || region.hasPatchFlag) {
      rl.debug(
        'interactive/include selection present; git forbids or owns only semantics, skipping injection',
      );
      return args;
    }

    /**
     * True when injecting `-o` would make git ignore the index: a pathless
     * `--amend`/`--allow-empty` commit in only mode reuses HEAD's tree.
     */
    const injectionIgnoresIndex = (region.hasAmendFlag
      || region
        .hasAllowEmptyFlag)
      && (!region.hasPathspec)
      && (!region.hasPathspecFromFile);

    if (injectionIgnoresIndex) {
      rl.debug('pathless amend/allow-empty commit, checking index against HEAD',);
      /**
       * Comparison of staged content against HEAD; `'unknown'` defers to real git.
       */
      const indexState = await checkIndexDiffersFromHead({
        preSubcommandArgs: args.slice(
          0,
          subcommandIndex,
        ),
      },);

      if (indexState === 'differs') {
        /**
         * Pathless-allowed flags present on argv, echoed in the diagnostic.
         */
        const flagText = [
          ...(region.hasAmendFlag ? ['--amend',] : []),
          ...(region.hasAllowEmptyFlag ? ['--allow-empty',] : []),
        ].join(' ',);
        throw new CommitOnlyViolationError(
          'staged-changes-ignored',
          ignoredIndexMessage(flagText,),
        );
      }

      rl.debug('index matches HEAD or is undeterminable, proceeding with injection',);
    }

    rl.debug('injecting -o into commit',);
    return [
      ...args.slice(
        0,
        subcommandIndex + 1,
      ),
      '-o',
      ...postSubcommandArgs,
    ];
  };
}

/**
 * Commit-only rule wired to the real git index-vs-HEAD and sequencer-state
 * checkers; the variant the rule pipeline runs. Behavior is documented on
 * {@link makeCommitOnly}.
 */
export const commitOnly: CommitOnlyRule = makeCommitOnly({
  checkIndexDiffersFromHead: indexDiffersFromHead,
  checkSequencerInProgress: sequencerInProgress,
},);

//endregion Commit-only rule

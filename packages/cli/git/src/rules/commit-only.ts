import {
  l,
  tagged,
} from '../log.ts';
import { parseGlobalOptions, } from '../parse-global-options.ts';
import { analyzeCommitArgs, } from './commit-args.ts';

/**
 * Wrapper-only escape hatch that suppresses `-o` injection for one invocation.
 * Stripped before forwarding to real git, which would otherwise reject it.
 */
const ESCAPE_HATCH = '--no-enforce-only';

/**
 * Diagnostic emitted when commit-only enforcement sees no pathspec source and
 * no git mode that permits pathless only-mode commits.
 */
const NO_PATHSPEC_MESSAGE = 'cli-git: git commit requires an explicit pathspec when commit-only enforcement is active. '
  + 'Name the paths in the commit command (for example, git commit -m <msg> <path>), '
  + 'pass --pathspec-from-file, or pass --no-enforce-only to bypass for this invocation.';

/**
 * Diagnostic emitted when commit-only enforcement sees `-a`/`--all`, which
 * stages tracked modifications implicitly before committing.
 */
const ALL_FLAG_MESSAGE = 'cli-git: git commit rejects -a/--all because it stages every tracked modification before committing. '
  + 'Stage paths explicitly and commit with git commit -m <msg> <path>, '
  + 'or pass --no-enforce-only to bypass for this invocation.';

/**
 * Injects `-o` (a.k.a. `--only`) into `git commit` commands when not already
 * specified, forcing every commit to name the paths it includes rather than
 * silently picking up whatever happens to be staged. The injection slots in
 * immediately after the `commit` token, so pre-subcommand global options
 * (`git -C /repo commit`, `git -c key=val commit`) are preserved and the
 * rule still fires.
 *
 * Skipped when `-o`, `--only`, or `--no-only` is already present in the
 * post-subcommand region (the user made an explicit choice). The wrapper-only
 * flag `--no-enforce-only` is the escape hatch: it is stripped from args
 * before forwarding, and injection is also skipped for that invocation.
 *
 * @param args - Raw git arguments (global options + subcommand + flags).
 *
 * @returns Modified args with `-o` injected after `commit`, with
 *   `--no-enforce-only` stripped, or unmodified args when the user has
 *   already chosen.
 *
 * @example
 * ```ts
 * commitOnly(['commit', '-m', 'msg', 'file.ts']);
 * // => ['commit', '-o', '-m', 'msg', 'file.ts']
 *
 * commitOnly(['-C', '/repo', 'commit', '-m', 'msg', 'file.ts']);
 * // => ['-C', '/repo', 'commit', '-o', '-m', 'msg', 'file.ts']
 *
 * commitOnly(['commit', '--no-enforce-only', '-m', 'msg']);
 * // => ['commit', '-m', 'msg'] (escape hatch consumed)
 *
 * commitOnly(['commit', '--only', 'file.ts']);
 * // => ['commit', '--only', 'file.ts'] (unchanged)
 * ```
 */
export function commitOnly(args: readonly string[],): readonly string[] {
  /** Position of the `commit` (or other) subcommand within args. */
  const { subcommandIndex, } = parseGlobalOptions(args,);

  if (args[subcommandIndex] !== 'commit')
    return args;

  /** Tagged logger for the commit-only rule. */
  const rl = tagged({
    tag: commitOnly.name,
    l,
  },);

  /** Slice of args strictly after the `commit` token; the place where commit flags live. */
  const postSubcommandArgs = args.slice(subcommandIndex + 1,);

  /** True when the wrapper-only escape hatch appears after the subcommand. */
  const hasEscapeHatch = postSubcommandArgs.includes(ESCAPE_HATCH,);

  if (hasEscapeHatch) {
    rl.debug(`${ESCAPE_HATCH} present, stripping and skipping injection`,);
    /** Pre-subcommand region kept verbatim so global options survive the strip. */
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

  /** Commit argv facts used to reject policy violations before git emits opaque errors. */
  const analysis = analyzeCommitArgs(postSubcommandArgs,);

  if (!analysis.hasNoOnlyFlag) {
    if (analysis.hasAllFlag)
      throw new Error(ALL_FLAG_MESSAGE,);

    /** True when pathspecs are supplied positionally, through a pathspec file, or by a git mode that permits pathless only commits. */
    const hasPathspecSource = analysis.hasPathspec
      || analysis.hasPathspecFromFile
      || analysis.hasPathlessAllowedFlag;

    if (!hasPathspecSource)
      throw new Error(NO_PATHSPEC_MESSAGE,);
  }

  if (analysis.hasExplicitOnlyFlag) {
    rl.debug('-o, --only, or --no-only already present, skipping injection',);
    return args;
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
}

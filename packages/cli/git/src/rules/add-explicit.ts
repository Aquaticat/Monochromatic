import {
  l,
  tagged,
} from '../log.ts';
import { parseGlobalOptions, } from '../parse-global-options.ts';

/**
 * Wrapper-only escape hatch that suppresses the bulk-add check for one
 * invocation. Stripped before forwarding to real git, which would otherwise
 * reject it.
 */
const ESCAPE_HATCH = '--no-enforce-bulk-add';

/**
 * Argv tokens that match every changed path under the effective cwd (or the
 * whole repo), staging untargeted files alongside whatever the caller meant
 * to stage. Each is rejected unless the escape hatch is also present.
 *
 * `.` and `./` walk the current directory recursively. `*` is the literal
 * pathspec form (the shell-glob case usually expands before reaching the
 * wrapper, but a quoted or non-matching glob can survive). `:/` is git's
 * pathspec for the repository root. `-A`/`--all` and `-u`/`--update` are
 * flag forms that bulk-stage even with no positional paths.
 */
const BULK_ADD_PATTERNS: ReadonlySet<string> = new Set([
  '.',
  './',
  '*',
  ':/',
  '-A',
  '--all',
  '-u',
  '--update',
],);

/**
 * Rejects `git add` invocations that use bulk-staging patterns, which sweep
 * up changed paths the caller did not intend to stage and leave the index in
 * a state that does not match a single logical change. Specifying paths
 * explicitly (or a single bounded directory) is required by default; the
 * wrapper-only flag `--no-enforce-bulk-add` is the escape hatch for legitimate
 * bulk operations and is stripped before forwarding to real git.
 *
 * The rule walks pre-subcommand global options (`git -C /repo add .`,
 * `git -c key=val add -A`) so it still fires for those forms.
 *
 * @param args - Raw git arguments (global options + subcommand + flags).
 *
 * @returns Unmodified args when no bulk pattern is present, or args with
 *   `--no-enforce-bulk-add` stripped when the escape hatch is in use.
 *
 * @throws When a bulk-add pattern is present without the escape hatch.
 *
 * @example
 * ```ts
 * addExplicit(['add', 'file.ts']);
 * // => ['add', 'file.ts'] (specific path, unchanged)
 *
 * addExplicit(['add', '.']);
 * // throws: bulk-staging pattern '.' rejected
 *
 * addExplicit(['add', '.', '--no-enforce-bulk-add']);
 * // => ['add', '.'] (escape hatch consumed)
 *
 * addExplicit(['-C', '/repo', 'add', '-A']);
 * // throws: bulk-staging pattern '-A' rejected
 * ```
 */
export function addExplicit(args: readonly string[],): readonly string[] {
  /** Position of the `add` (or other) subcommand within args. */
  const { subcommandIndex, } = parseGlobalOptions(args,);

  if (args[subcommandIndex] !== 'add')
    return args;

  /** Tagged logger for the add-explicit rule. */
  const rl = tagged({
    tag: addExplicit.name,
    l,
  },);

  /** Slice of args strictly after the `add` token; the place where pathspecs and flags live. */
  const postSubcommandArgs = args.slice(subcommandIndex + 1,);

  /** True when the wrapper-only escape hatch appears after the subcommand. */
  const hasEscapeHatch = postSubcommandArgs.includes(ESCAPE_HATCH,);

  if (hasEscapeHatch) {
    rl.debug(`${ESCAPE_HATCH} present, stripping and skipping check`,);
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

  /** Bulk-add tokens detected in the post-subcommand region. */
  const matched = postSubcommandArgs.filter(function isBulkPattern(arg,) {
    return BULK_ADD_PATTERNS.has(arg,);
  },);

  if (matched.length > 0) {
    throw new Error(
      `cli-git: git add rejects bulk-staging patterns (${matched.join(', ',)}) `
        + `because they sweep up paths the caller did not intend to stage, `
        + `leaving the index in a state that does not match a single logical change. `
        + `Name the paths explicitly, or pass ${ESCAPE_HATCH} to bypass for this invocation.`,
    );
  }

  rl.debug('no bulk pattern, passing through',);
  return args;
}

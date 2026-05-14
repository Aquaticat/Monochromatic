import {
  l,
  tagged,
} from '../log.ts';
import { parseGlobalOptions, } from '../parse-global-options.ts';

/**
 * Wrapper-only escape hatch that suppresses `-o` injection for one invocation.
 * Stripped before forwarding to real git, which would otherwise reject it.
 */
const ESCAPE_HATCH = '--no-enforce-only';

/**
 * Flags that indicate the user already made an explicit choice about `--only`
 * mode (either form, positive or negative). Presence of any of these skips
 * injection without stripping anything.
 */
const EXPLICIT_ONLY_FLAGS: ReadonlySet<string> = new Set([
  '-o',
  '--only',
  '--no-only',
],);

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

  /** True when args already carry `-o`, `--only`, or `--no-only` after the subcommand. */
  const hasExplicitFlag = postSubcommandArgs.some(function isExplicitFlag(arg,) {
    return EXPLICIT_ONLY_FLAGS.has(arg,);
  },);

  if (hasExplicitFlag) {
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

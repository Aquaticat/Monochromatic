import {
  l,
  tagged,
} from '../log.ts';

/**
 * Wrapper-only escape hatch that suppresses `-o` injection for one invocation.
 * Stripped before forwarding to real git, which would otherwise reject it.
 */
const ESCAPE_HATCH = '--not-only';

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
 * silently picking up whatever happens to be staged.
 *
 * Skipped when `-o`, `--only`, or `--no-only` is already present (the user
 * made an explicit choice). The wrapper-only flag `--not-only` is the escape
 * hatch: it is stripped from args before forwarding, and injection is also
 * skipped for that invocation.
 *
 * @param args - Raw git arguments (subcommand + flags).
 *
 * @returns Modified args with `-o` injected after `commit`, with `--not-only`
 *   stripped, or unmodified args when the user has already chosen.
 *
 * @example
 * ```ts
 * commitOnly(['commit', '-m', 'msg', 'file.ts']);
 * // => ['commit', '-o', '-m', 'msg', 'file.ts']
 *
 * commitOnly(['commit', '--not-only', '-m', 'msg']);
 * // => ['commit', '-m', 'msg'] (escape hatch consumed)
 *
 * commitOnly(['commit', '--only', 'file.ts']);
 * // => ['commit', '--only', 'file.ts'] (unchanged)
 * ```
 */
export function commitOnly(args: readonly string[],): readonly string[] {
  if (args[0] !== 'commit')
    return args;

  /** Tagged logger for the commit-only rule. */
  const rl = tagged({
    tag: commitOnly.name,
    l,
  },);

  /** True when the wrapper-only escape hatch appears anywhere in args. */
  const hasEscapeHatch = args.includes(ESCAPE_HATCH,);

  if (hasEscapeHatch) {
    rl.debug(`${ESCAPE_HATCH} present, stripping and skipping injection`,);
    return args.filter(function isNotEscapeHatch(arg,) {
      return arg !== ESCAPE_HATCH;
    },);
  }

  /** True when args already carry `-o`, `--only`, or `--no-only`. */
  const hasExplicitFlag = args.some(function isExplicitFlag(arg,) {
    return EXPLICIT_ONLY_FLAGS.has(arg,);
  },);

  if (hasExplicitFlag) {
    rl.debug('-o, --only, or --no-only already present, skipping injection',);
    return args;
  }

  rl.debug('injecting -o into commit',);
  /** Split into the `commit` token and remaining args so `-o` can slot between them. */
  const [subcommand, ...rest] = args;
  return [
    subcommand,
    '-o',
    ...rest,
  ];
}

/**
 * Exact Git inspection command proof used by read-only Bash classifier.
 *
 * @module
 */

/**
 * Find Git subcommand index after supported read-only global options.
 *
 * Only `-C <path>` and `--no-pager` are accepted before subcommand.
 *
 * @param args - arguments after `git`
 *
 * @returns subcommand index, or negative sentinel for unsupported globals
 *
 * @example
 * ```typescript
 * gitSubcommandIndex(['-C', '/repo', 'tag']);
 * ```
 */
function gitSubcommandIndex(
  args: readonly string[],
): number {
  /** Linear cursor wrapped for const-root mutation discipline. */
  const state = { index: 0, };
  while (state.index < args.length) {
    /** Current possible global option or subcommand. */
    const argument = args[state.index];
    if (argument === '-C') {
      if (args[state.index + 1] === undefined)
        return -1;
      state.index += 2;
      continue;
    }
    if (argument === '--no-pager') {
      state.index += 1;
      continue;
    }
    return state.index;
  }
  return -1;
}

/**
 * Prove exact Git tag points-at listing form.
 *
 * @param args - arguments after `git`
 *
 * @returns whether invocation only reads tag refs
 *
 * @example
 * ```typescript
 * gitIsReadOnly(['-C', '/repo', 'tag', '--points-at', 'HEAD']);
 * ```
 */
function gitIsReadOnly(
  args: readonly string[],
): boolean {
  /** Subcommand position after supported global options. */
  const subcommandIndex = gitSubcommandIndex(args,);
  if (subcommandIndex < 0)
    return false;
  if (args[subcommandIndex] !== 'tag')
    return false;
  /** Arguments that select tag listing mode. */
  const tagArgs = args.slice(subcommandIndex + 1,);
  if (tagArgs.length === 2) {
    return (tagArgs[0] === '--points-at')
      && (tagArgs[1] !== '');
  }
  if (tagArgs.length !== 1)
    return false;
  /** Inline points-at object after option assignment. */
  const [inlinePointsAt = '',] = tagArgs;
  return inlinePointsAt.startsWith('--points-at=',)
    && (inlinePointsAt.length > '--points-at='.length);
}

export { gitIsReadOnly, };

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { parseGlobalOptions, } from '../parse-global-options.ts';
import { parseStatusPreRegion, } from '../parser/status.ts';

/**
 * Logger root for cli-git after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l, },);
 * ```
 */
const l = tagged({ tag: 'cli-git', },);

//region Status hints-off rule

/**
 * Argv tokens injected into `git status` so git itself does not print its
 * stock hints. The hints (`use "git add <file>..."`, `use "git commit -a"`)
 * suggest patterns that the wrapper rejects (`add-explicit` bans bulk
 * staging; `commit-only` injects `-o`, which conflicts with `-a`). A cli-git
 * note is printed in the entry point after the spawn so the user sees
 * accurate guidance instead.
 */
const QUIET_INJECTION: readonly string[] = [
  '-c',
  'advice.statusHints=false',
];

/**
 * Whether the caller has already configured `advice.statusHints` via a
 * pre-subcommand `-c <key>=<value>` pair. Used both by the rule (skip
 * injection) and by the entry point (skip the post-spawn cli-git note); when
 * the user explicitly opts in to git's hints, the wrapper does not override
 * the choice and does not add its own commentary.
 *
 * Operates on raw args before any rule has run, so the wrapper's own injected
 * `-c advice.statusHints=false` (post-rule) does not register as a user
 * override. Locates the subcommand with {@link parseGlobalOptions} and
 * inspects the pre-subcommand region with {@link parseStatusPreRegion}.
 *
 * @param args - Raw git arguments (pre-rule pipeline).
 *
 * @returns `true` when a pre-subcommand `-c advice.statusHints=...` is present.
 *
 * @example
 * ```ts
 * hasExplicitStatusHintsOverride(['-c', 'advice.statusHints=true', 'status']);
 * // => true
 *
 * hasExplicitStatusHintsOverride(['status']);
 * // => false
 * ```
 */
export function hasExplicitStatusHintsOverride(args: readonly string[],): boolean {
  /**
   * Position of the subcommand within args; everything before it is the global-option region scanned for `-c`.
   */
  const { subcommandIndex, } = parseGlobalOptions(args,);
  /**
   * Slice of args strictly before the subcommand; where pre-subcommand global options live.
   */
  const preSubcommandArgs = args.slice(
    0,
    subcommandIndex,
  );

  return parseStatusPreRegion(preSubcommandArgs,)
    .hasStatusHintsOverride;
}

/**
 * Injects the {@link QUIET_INJECTION} tokens before `git status` so git
 * suppresses its stock hints, which suggest patterns the wrapper rejects.
 * The subcommand is located with {@link parseGlobalOptions}, and the
 * injection slots into the pre-subcommand region, so any user-supplied
 * global options are preserved.
 *
 * Skipped when {@link hasExplicitStatusHintsOverride} reports the user has
 * already set `advice.statusHints=<anything>` via `-c` in the pre-subcommand
 * region, so an explicit `git -c advice.statusHints=true status` continues to
 * print git's hints.
 *
 * @param args - Raw git arguments (global options + subcommand + flags).
 *
 * @returns Modified args with `-c advice.statusHints=false` injected before
 *   the `status` token, or unmodified args.
 *
 * @example
 * ```ts
 * statusHintsOff(['status']);
 * // => ['-c', 'advice.statusHints=false', 'status']
 *
 * statusHintsOff(['-C', '/repo', 'status', 'packages/x']);
 * // => ['-C', '/repo', '-c', 'advice.statusHints=false', 'status', 'packages/x']
 *
 * statusHintsOff(['-c', 'advice.statusHints=true', 'status']);
 * // => ['-c', 'advice.statusHints=true', 'status']
 *
 * statusHintsOff(['commit', '-m', 'x']);
 * // => ['commit', '-m', 'x']
 * ```
 */
export function statusHintsOff(args: readonly string[],): readonly string[] {
  /**
   * Position of the `status` (or other) subcommand within args.
   */
  const { subcommandIndex, } = parseGlobalOptions(args,);

  if (args[subcommandIndex]
    !== 'status')
    return args;

  /**
   * Tagged logger for the status-hints-off rule.
   */
  const rl = tagged({
    tag: statusHintsOff.name,
    l,
  },);

  if (hasExplicitStatusHintsOverride(args,)) {
    rl.debug('user has set advice.statusHints via -c, skipping injection',);
    return args;
  }

  rl.debug('injecting -c advice.statusHints=false before status',);
  return [
    ...args.slice(
      0,
      subcommandIndex,
    ),
    ...QUIET_INJECTION,
    ...args.slice(subcommandIndex,),
  ];
}

//endregion Status hints-off rule

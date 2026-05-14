import {
  l,
  tagged,
} from '../log.ts';
import { parseGlobalOptions, } from '../parse-global-options.ts';

/**
 * Config key prefix the user can set via `-c <key>=<value>` to override the
 * default git advice. Honoured by skipping the wrapper's injection so the
 * user's choice wins.
 */
const ADVICE_KEY_PREFIX = 'advice.statusHints=';

/**
 * Argv tokens injected into `git status` so git itself does not print its
 * stock hints. The hints (`use "git add <file>..."`, `use "git commit -a"`)
 * suggest patterns that the wrapper rejects (`add-explicit` bans bulk
 * staging; `commit-only` injects `-o`, which conflicts with `-a`). A
 * cli-git note is printed in the entry point after the spawn so the user
 * sees accurate guidance instead.
 */
const QUIET_INJECTION: readonly string[] = [
  '-c',
  `${ADVICE_KEY_PREFIX}false`,
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
 * override.
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
  /** Position of the subcommand within args; everything before it is the global-option region scanned for `-c`. */
  const { subcommandIndex, } = parseGlobalOptions(args,);
  /** Slice of args strictly before the subcommand; where pre-subcommand global options live. */
  const preSubcommandArgs = args.slice(
    0,
    subcommandIndex,
  );

  return preSubcommandArgs.some(function isExplicitOverride(
    arg,
    idx,
  ) {
    if (arg !== '-c')
      return false;
    /** Value paired with this `-c`; `undefined` if `-c` is the final pre-subcommand token. */
    const value = preSubcommandArgs[idx + 1];
    return value?.startsWith(ADVICE_KEY_PREFIX,) ?? false;
  },);
}

/**
 * Injects `-c advice.statusHints=false` before `git status` so git suppresses
 * its stock hints, which suggest patterns the wrapper rejects. The injection
 * slots into the pre-subcommand region, so any user-supplied global options
 * are preserved.
 *
 * Skipped when the user has already set `advice.statusHints=<anything>` via
 * `-c` in the pre-subcommand region, so an explicit
 * `git -c advice.statusHints=true status` continues to print git's hints.
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
 * // => ['-c', 'advice.statusHints=true', 'status'] (user override honoured)
 *
 * statusHintsOff(['commit', '-m', 'x']);
 * // => ['commit', '-m', 'x'] (not a status invocation)
 * ```
 */
export function statusHintsOff(args: readonly string[],): readonly string[] {
  /** Position of the `status` (or other) subcommand within args. */
  const { subcommandIndex, } = parseGlobalOptions(args,);

  if (args[subcommandIndex] !== 'status')
    return args;

  /** Tagged logger for the status-hints-off rule. */
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

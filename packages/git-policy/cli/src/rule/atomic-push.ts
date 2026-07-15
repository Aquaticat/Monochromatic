import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { parseGlobalOptions, } from '../parse-global-options.ts';
import { parsePushRegion, } from '../parser/push.ts';

/**
 * Logger root for cli-git after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l, },);
 * ```
 */
const l = tagged({ tag: 'cli-git', },);

//region Atomic push rule

/**
 * Injects `--atomic` into `git push` commands when not already specified.
 * Skipped when `--atomic` or `--no-atomic` is already present in the
 * post-subcommand region. The injection slots in immediately after the
 * `push` token, so pre-subcommand global options (`git -C /repo push`,
 * `git -c key=val push`) are preserved and the rule still fires.
 *
 * Atomic push ensures that either all refs are updated on the remote or
 * none are, preventing partial push failures. The subcommand is located with
 * {@link parseGlobalOptions} and the post-subcommand region is parsed by
 * {@link parsePushRegion}'s optique-based parser so the wrapper detects
 * existing `--atomic`/`--no-atomic` choices uniformly across argv shapes.
 *
 * @param args - Raw git arguments (global options + subcommand + flags).
 *
 * @returns Modified args with `--atomic` injected after `push`, or unmodified
 *   args when the caller has already chosen.
 *
 * @example
 * ```ts
 * atomicPush(['push', 'origin', 'main']);
 * // => ['push', '--atomic', 'origin', 'main']
 *
 * atomicPush(['-C', '/repo', 'push', 'origin', 'main']);
 * // => ['-C', '/repo', 'push', '--atomic', 'origin', 'main']
 *
 * atomicPush(['push', '--no-atomic', 'origin', 'main']);
 * // => ['push', '--no-atomic', 'origin', 'main']
 * ```
 */
export function atomicPush(args: readonly string[],): readonly string[] {
  /**
   * Position of the `push` (or other) subcommand within args.
   */
  const { subcommandIndex, } = parseGlobalOptions(args,);

  if (args[subcommandIndex]
    !== 'push')
    return args;

  /**
   * Tagged logger for the atomic-push rule.
   */
  const rl = tagged({
    tag: atomicPush.name,
    l,
  },);

  /**
   * Slice of args strictly after the `push` token; the place where push flags live.
   */
  const postSubcommandArgs = args.slice(subcommandIndex + 1,);
  /**
   * Push region facts parsed by optique.
   */
  const region = parsePushRegion(postSubcommandArgs,);

  if (region.hasAtomicChoice) {
    rl.debug('--atomic or --no-atomic already present, skipping injection',);
    return args;
  }

  rl.debug('injecting --atomic into push',);
  return [
    ...args.slice(
      0,
      subcommandIndex + 1,
    ),
    '--atomic',
    ...postSubcommandArgs,
  ];
}

//endregion Atomic push rule

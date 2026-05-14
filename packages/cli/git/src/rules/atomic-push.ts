import {
  l,
  tagged,
} from '../log.ts';

/**
 * Injects `--atomic` into `git push` commands when not already specified.
 * Skipped when `--atomic` or `--no-atomic` is already present in the args.
 *
 * Atomic push ensures that either all refs are updated on the remote
 * or none are, preventing partial push failures.
 *
 * @param args - Raw git arguments (subcommand + flags).
 *
 * @returns Modified args with `--atomic` injected after `push`, or unmodified args.
 *
 * @example
 * ```ts
 * atomicPush(['push', 'origin', 'main']);
 * // => ['push', '--atomic', 'origin', 'main']
 *
 * atomicPush(['push', '--no-atomic', 'origin', 'main']);
 * // => ['push', '--no-atomic', 'origin', 'main'] (unchanged)
 * ```
 */
export function atomicPush(args: readonly string[],): readonly string[] {
  if (args[0] !== 'push')
    return args;

  /** Tagged logger for the atomic-push rule. */
  const rl = tagged({
    tag: atomicPush.name,
    l,
  },);

  /** True when args already carry `--atomic` or `--no-atomic`, so no injection should occur. */
  const hasAtomicFlag = args.some(function isAtomicFlag(arg,) {
    return arg === '--atomic' || arg === '--no-atomic';
  },);

  if (hasAtomicFlag) {
    rl.debug('--atomic or --no-atomic already present, skipping injection',);
    return args;
  }

  rl.debug('injecting --atomic into push',);
  /** Split into the `push` token and remaining args so `--atomic` can slot between them. */
  const [subcommand, ...rest] = args;
  return [
    subcommand,
    '--atomic',
    ...rest,
  ];
}

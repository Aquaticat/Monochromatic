import { object, } from '@optique/core/constructs';
import { multiple, } from '@optique/core/modifiers';
import { parseSync, } from '@optique/core/parser';
import {
  argument,
  flag,
  passThrough,
} from '@optique/core/primitives';
import { string, } from '@optique/core/valueparser';

//region Push post-subcommand optique parser

/**
 * Optique parser for the post-`push` argv region.
 *
 * Models the user-toggled atomicity flags so the wrapper can inject
 * `--atomic` only when the caller has not chosen explicitly. Pathspecs and
 * other tokens are captured generically; the wrapper does not transform
 * them.
 */
const pushRegionParser = object({
  atomicFlags: multiple(flag(
    '--atomic',
    '--no-atomic',
  ),),
  positionals: multiple(
    argument(string(),),
  ),
  unknownOptions: passThrough({ format: 'nextToken', },),
},);

//endregion Push post-subcommand optique parser

//region Push region facts

/** Facts about the post-`push` argv region used by atomic-push policy. */
export type PushRegion = {
  /** True when caller has chosen atomic or non-atomic mode explicitly. */
  readonly hasAtomicChoice: boolean;
};

/**
 * Parses the post-`push` argv region into a structured fact set used by the
 * atomic-push rule. The rule only needs to know whether the caller already
 * made an explicit choice between atomic and non-atomic.
 *
 * @param postSubcommandArgs - Arguments strictly after `push` subcommand.
 *
 * @returns Fact record consumed by atomic-push policy.
 *
 * @example
 * ```ts
 * parsePushRegion(['origin', 'main']).hasAtomicChoice;
 * // => false (no explicit choice; wrapper will inject --atomic)
 * ```
 */
export function parsePushRegion(
  postSubcommandArgs: readonly string[],
): PushRegion {
  /** Optique parse result over the post-subcommand region. */
  const parseResult = parseSync(
    pushRegionParser,
    postSubcommandArgs,
  );

  if (!parseResult.success)
    return { hasAtomicChoice: false, };

  return {
    hasAtomicChoice: parseResult.value
      .atomicFlags
      .length
      > 0,
  };
}

//endregion Push region facts

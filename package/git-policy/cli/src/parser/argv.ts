/**
 * Git-argv region parser replacing `@optique/core` option parsing.
 *
 * Optique rebuilds a "did you mean" message, including a Levenshtein scan over
 * every declared option name, each time a token fails to match an option
 * (`primitives.js` lines 588 and 596). For these parsers a non-matching token is
 * ordinary control flow, since every pathspec reaches every option parser, so
 * the message is computed and discarded once per pathspec. It cannot be turned
 * off: the `errors.noMatch` escape hatch runs the same scan before calling the
 * caller's formatter. A commit naming a thousand paths spent 2.56s of 4.24s
 * there.
 *
 * Two readings from optique are corrected here. A value option missing its
 * value was demoted to an unknown option; it now throws {@link ArgvParseError},
 * since a stated option with no value is a decidable mistake and Git rejects it
 * too. An undeclared `--name=value` token became a positional, reaching the
 * commit-only rule as a pathspec; it is now an undeclared option. That one
 * cannot throw: these specs declare a subset of what Git accepts, so ordinary
 * spellings like `--untracked-files=no` are undeclared here and must keep
 * working.
 *
 * @module
 */
import * as v from 'valibot';

/**
 * Token introducing no option: bare `-` is a positional in Git argv.
 */
const LONE_DASH = '-';
/**
 * Token after which every remaining token is positional.
 */
const OPTION_TERMINATOR = '--';
/**
 * No declared group owns the inspected spelling.
 */
const GROUP_ABSENT: unique symbol = Symbol('Git argv spelling matched no declared flag or option group',);
/**
 * Git argv region was refused, and its facts must not be guessed.
 */
export const ARGV_REFUSED: unique symbol = Symbol('Git argv region was refused and yielded no facts',);

/**
 * One declared option group and its accepted spellings.
 */
export type ArgvOptionGroup = Readonly<{
  /**
   * Exact accepted spellings, including every alias.
   */
  names: readonly string[];
}>;

/**
 * Declared option surface of one argv region.
 */
export type ArgvSpec = Readonly<{
  /**
   * Value-free groups, keyed by result key.
   */
  flags: Readonly<Record<string, ArgvOptionGroup>>;
  /**
   * Groups consuming a following token, keyed by result key.
   */
  valueOptions: Readonly<Record<string, ArgvOptionGroup>>;
}>;

/**
 * Parsed argv region facts.
 */
export type ArgvParse = Readonly<{
  /**
   * Occurrence count per declared flag group.
   */
  flagCounts: Readonly<Record<string, number>>;
  /**
   * Values in encounter order per declared value-option group.
   */
  optionValues: Readonly<Record<string, readonly string[]>>;
  /**
   * Positional tokens in encounter order.
   */
  positionals: readonly string[];
  /**
   * Undeclared option tokens, each followed by any token it consumed.
   */
  unknownOptions: readonly string[];
}>;

/**
 * Region names a token this parser refuses to reinterpret.
 */
export class ArgvParseError extends Error {
  /**
   * Exact offending token.
   */
  public readonly token: string;
  /**
   * Zero-based token position within inspected region.
   */
  public readonly index: number;
  /**
   * Exact inspected region.
   */
  public readonly region: readonly string[];

  /**
   * Creates region failure naming exact offending token.
   *
   * @param message - safe explanation of refusal
   *
   * @param token - exact offending token
   *
   * @param index - zero-based token position
   *
   * @param region - exact inspected region
   */
  public constructor({
    message,
    token,
    index,
    region,
  }: Readonly<{
    message: string;
    token: string;
    index: number;
    region: readonly string[];
  }>,) {
    super(`${message}\n  token ${String(index,)} of ${String(region.length,)}: ${token}\n  region: ${region.join(' ',)}`,);
    this.name = 'ArgvParseError';
    this.token = token;
    this.index = index;
    this.region = region;
  }
}

/**
 * Schema rejecting option spellings that cannot introduce an option.
 */
const OPTION_NAME_SCHEMA = v.pipe(
  v.string(),
  v.minLength(2,),
  v.check(
    function startsWithDash(name: string,): boolean {
      return name.startsWith(LONE_DASH,);
    },
    'Declared option name must start with a dash.',
  ),
);

/**
 * Reports whether token introduces an option rather than a positional.
 *
 * @param token - exact argv token
 *
 * @returns whether token is dash-led and not bare `-`
 */
function isOptionToken(token: string,): boolean {
  return token.startsWith(LONE_DASH,)
    && (token !== LONE_DASH);
}

/**
 * Resolves declared group key owning one exact option spelling.
 *
 * @param groups - declared groups keyed by result key
 *
 * @param name - exact option spelling
 *
 * @returns owning result key, or absence sentinel when undeclared
 */
function groupKeyFor({
  groups,
  name,
}: Readonly<{
  groups: Readonly<Record<string, ArgvOptionGroup>>;
  name: string;
}>,): string | typeof GROUP_ABSENT {
  /**
   * Declared entry accepting exact spelling.
   */
  const entry = Object.entries(groups,)
    .find(function declaresName([, group,],): boolean {
      return group.names
        .includes(name,);
    },);
  return entry === undefined
    ? GROUP_ABSENT
    : entry[0];
}

/**
 * Validates declared option spellings before parsing.
 *
 * @param spec - declared option surface
 *
 * @throws ValiError when a declared spelling cannot introduce an option
 */
function assertSpec(spec: ArgvSpec,): void {
  Object.values({
    ...spec.flags,
    ...spec.valueOptions,
  },)
    .forEach(function checkGroup(group,): void {
      group.names
        .forEach(function checkName(name,): void {
          v.parse(
            OPTION_NAME_SCHEMA,
            name,
          );
        },);
    },);
}

/**
 * Parses one Git argv region against a declared option surface.
 *
 * Undeclared options keep Git's own ambiguity: their arity is unknowable, so an
 * undeclared option consumes a following token only when that token is not
 * itself dash-led. Callers needing the real answer scan arity separately. An
 * undeclared `--name=value` token carries its own value and consumes nothing. A
 * declared value option takes its next token even when dash-led, and every
 * token after `--` is positional, both matching Git.
 *
 * @param args - exact argv region
 *
 * @param spec - declared option surface
 *
 * @returns parsed region facts
 *
 * @throws ArgvParseError when region names a token this parser refuses to reinterpret
 *
 * @throws ValiError when a declared spelling cannot introduce an option
 *
 * @example
 * ```ts
 * parseArgv({ args: ['-m', 'hi', 'a.txt'], spec: { flags: {}, valueOptions: { message: { names: ['-m'] } } } });
 * // => { flagCounts: {}, optionValues: { message: ['hi'] }, positionals: ['a.txt'], unknownOptions: [] }
 * ```
 */
export function parseArgv({
  args,
  spec,
}: Readonly<{
  args: readonly string[];
  spec: ArgvSpec;
}>,): ArgvParse {
  assertSpec(spec,);
  return (function scanRegion(): ArgvParse {
    /**
     * Occurrence count per declared flag group.
     */
    const flagCounts: Record<string, number> = {};
    /**
     * Values per declared value-option group.
     */
    const optionValues: Record<string, string[]> = {};
    /**
     * Positional tokens in encounter order.
     */
    const positionals: string[] = [];
    /**
     * Undeclared option tokens with any token each consumed.
     */
    const unknownOptions: string[] = [];
    /**
     * Whether `--` already ended option parsing.
     */
    let terminated = false;
    /**
     * Current token cursor, advanced past consumed values.
     */
    let cursor = 0;
    while (cursor < args.length) {
      /**
       * Exact token under inspection.
       */
      const token = args[cursor] ?? '';
      /**
       * Position of token under inspection, retained for refusals.
       */
      const index = cursor;
      cursor += 1;
      if (terminated) {
        positionals.push(token,);
        continue;
      }
      if (token === OPTION_TERMINATOR) {
        terminated = true;
        continue;
      }
      if (!isOptionToken(token,)) {
        positionals.push(token,);
        continue;
      }
      /**
       * Joined-value boundary within token.
       */
      const equals = token.indexOf('=',);
      if (equals > 0) {
        /**
         * Option spelling before joined value.
         */
        const joinedName = token.slice(
          0,
          equals,
        );
        /**
         * Declared value-option group owning joined spelling.
         */
        const joinedKey = groupKeyFor({
          groups: spec.valueOptions,
          name: joinedName,
        },);
        if ((typeof joinedKey) === 'symbol') {
          // An undeclared joined token is an undeclared option carrying its own
          // value, never a positional. Git accepts far more options here than
          // these specs declare, so `--untracked-files=no` is ordinary usage;
          // reading it as a path would hand it to the commit-only rule as a
          // pathspec, which is the reading this parser exists to prevent.
          unknownOptions.push(token,);
          continue;
        }
        (optionValues[joinedKey] ??= []).push(token.slice(equals + 1,),);
        continue;
      }
      /**
       * Declared flag group owning token.
       */
      const flagKey = groupKeyFor({
        groups: spec.flags,
        name: token,
      },);
      if ((typeof flagKey) !== 'symbol') {
        flagCounts[flagKey] = (flagCounts[flagKey] ?? 0) + 1;
        continue;
      }
      /**
       * Declared value-option group owning token.
       */
      const optionKey = groupKeyFor({
        groups: spec.valueOptions,
        name: token,
      },);
      /**
       * Token following current option, absent at end of region.
       */
      const next = args[cursor];
      if ((typeof optionKey) !== 'symbol') {
        if (next === undefined)
          throw new ArgvParseError({
            message: `Option ${token} takes a value, but the region ends here.`,
            token,
            index,
            region: args,
          },);
        (optionValues[optionKey] ??= []).push(next,);
        cursor += 1;
        continue;
      }
      unknownOptions.push(token,);
      if ((next !== undefined) && (!isOptionToken(next,))) {
        unknownOptions.push(next,);
        cursor += 1;
      }
    }
    return {
      flagCounts,
      optionValues,
      positionals,
      unknownOptions,
    };
  })();
}

/**
 * Parses one region, reporting refusal instead of raising.
 *
 * For callers whose rule already defaults to the safe answer when a region
 * cannot be read: they turn {@link ARGV_REFUSED} into their own
 * fail-closed fact rather than propagating a failure their policy has no way
 * to report.
 *
 * @param args - exact argv region
 *
 * @param spec - declared option surface
 *
 * @returns parsed region facts, or refusal sentinel
 *
 * @throws ValiError when a declared spelling cannot introduce an option
 *
 * @example
 * ```ts
 * tryParseArgv({ args: ['-m'], spec: { flags: {}, valueOptions: { message: { names: ['-m'] } } } });
 * // => ARGV_REFUSED
 * ```
 */
export function tryParseArgv({
  args,
  spec,
}: Readonly<{
  args: readonly string[];
  spec: ArgvSpec;
}>,): ArgvParse | typeof ARGV_REFUSED {
  try {
    return parseArgv({
      args,
      spec,
    },);
  }
  catch (error: unknown) {
    if (error instanceof ArgvParseError)
      return ARGV_REFUSED;
    throw error;
  }
}

/**
 * Pathspec separator after which git treats every remaining token as a path,
 * even when token starts with a dash.
 */
const PATHSPEC_SEPARATOR = '--';

/** Prefix used by git long options, distinct from pathspecs and short clusters. */
const LONG_OPTION_PREFIX = '--';

/** Prefix used by git short options and short-option clusters. */
const SHORT_OPTION_PREFIX = '-';

/** Short `git commit -a` flag letter, used inside short-option clusters. */
const ALL_SHORT_OPTION = 'a';

/** Short `git commit -o` flag letter, used inside short-option clusters. */
const ONLY_SHORT_OPTION = 'o';

/** Long flag that asks `git commit` to stage every tracked change before committing. */
const ALL_LONG_OPTION = '--all';

/** Long flag that explicitly enables commit-only mode. */
const ONLY_LONG_OPTION = '--only';

/** Long flag that explicitly disables commit-only mode. */
const NO_ONLY_LONG_OPTION = '--no-only';

/** Long option that asks git to read pathspecs from a file instead of argv. */
const PATHSPEC_FROM_FILE_OPTION = '--pathspec-from-file';

/** Inline-value form of `--pathspec-from-file`, which also supplies pathspecs. */
const PATHSPEC_FROM_FILE_PREFIX = `${PATHSPEC_FROM_FILE_OPTION}=`;

/** Flags that let git create a commit without positional pathspecs in only mode. */
const PATHLESS_ALLOWED_OPTIONS: ReadonlySet<string> = new Set([
  '--amend',
  '--allow-empty',
],);

/** Long or exact short tokens that explicitly choose an only-mode setting. */
const EXACT_EXPLICIT_ONLY_OPTIONS: ReadonlySet<string> = new Set([
  '-o',
  ONLY_LONG_OPTION,
  NO_ONLY_LONG_OPTION,
],);

/** Commit options whose separated form consumes the next argv token as a value. */
const SEPARATE_VALUE_OPTIONS: ReadonlySet<string> = new Set([
  '-m',
  '--message',
  '-F',
  '--file',
  '-C',
  '--reuse-message',
  '-c',
  '--reedit-message',
  '--squash',
  '--fixup',
  '--author',
  '--date',
  '--cleanup',
  '--trailer',
  '-t',
  '--template',
  '-U',
  '--unified',
  '--inter-hunk-context',
  PATHSPEC_FROM_FILE_OPTION,
],);

/** Short options whose clustered form can consume the rest of the token or the next token. */
const SHORT_VALUE_TAKING_OPTIONS: ReadonlySet<string> = new Set([
  'm',
  'F',
  'C',
  'c',
  't',
  'U',
],);

/**
 * Commit argv facts needed by the commit-only rule.
 */
export type CommitArgsAnalysis = {
  /** Whether argv asks git to stage every tracked modification before committing. */
  readonly hasAllFlag: boolean;
  /** Whether argv explicitly enables or disables only mode. */
  readonly hasExplicitOnlyFlag: boolean;
  /** Whether argv explicitly disables only mode, which acts as a user opt-out. */
  readonly hasNoOnlyFlag: boolean;
  /** Whether argv includes a mode where git permits no positional pathspec. */
  readonly hasPathlessAllowedFlag: boolean;
  /** Whether argv asks git to read pathspecs from file or stdin. */
  readonly hasPathspecFromFile: boolean;
  /** Whether argv includes at least one positional pathspec. */
  readonly hasPathspec: boolean;
};

/**
 * Commit argv split around `--` after option values have been removed.
 */
type PathspecSplit = {
  /** Option region before `--`; flags are still meaningful here. */
  readonly beforeSeparator: readonly string[];
  /** Pathspec region after `--`; every token is a pathspec here. */
  readonly afterSeparator: readonly string[];
};

/**
 * Checks whether token is a short option or short-option cluster.
 *
 * @param arg - Argv token to classify.
 *
 * @returns Whether token starts with one dash but not two.
 *
 * @example
 * ```ts
 * isShortOptionToken('-am'); // true
 * isShortOptionToken('--all'); // false
 * ```
 */
function isShortOptionToken(arg: string,): boolean {
  /** Whether token has short-option prefix. */
  const hasShortPrefix = arg.startsWith(SHORT_OPTION_PREFIX,);
  /** Whether token has long-option prefix and therefore is not a short cluster. */
  const hasLongPrefix = arg.startsWith(LONG_OPTION_PREFIX,);
  /** Whether token has at least one character after short-option prefix. */
  const hasOptionName = arg.length > SHORT_OPTION_PREFIX.length;

  return hasShortPrefix && (!hasLongPrefix) && hasOptionName;
}

/**
 * Finds earliest value-taking short option inside a short-option cluster.
 *
 * @param arg - Short option token to scan.
 *
 * @returns Index inside cluster, or `undefined` when cluster has no value-taking option.
 *
 * @example
 * ```ts
 * findFirstShortValueOptionIndex('-am'); // 1
 * findFirstShortValueOptionIndex('-a'); // undefined
 * ```
 */
function findFirstShortValueOptionIndex(arg: string,): number | undefined {
  /** Short-option letters after leading dash. */
  const optionCluster = arg.slice(SHORT_OPTION_PREFIX.length,);
  /** Indexes of value-taking options present inside cluster. */
  const valueOptionIndexes = [...SHORT_VALUE_TAKING_OPTIONS,]
    .map(function mapValueOptionIndex(shortOption,) {
      return optionCluster.indexOf(shortOption,);
    },)
    .filter(function isPresentIndex(index,) {
      return index >= 0;
    },);

  if (valueOptionIndexes.length === 0)
    return undefined;

  return Math.min(...valueOptionIndexes,);
}

/**
 * Checks whether short-option cluster contains flag before any value payload begins.
 *
 * @param arg - Token to scan.
 *
 * @param flag - Short flag letter to scan.
 *
 * @returns Whether flag appears as an option, not inside value text.
 *
 * @example
 * ```ts
 * shortOptionContainsFlag({ arg: '-am', flag: 'a' }); // true
 * shortOptionContainsFlag({ arg: '-mabc', flag: 'a' }); // false
 * ```
 */
function shortOptionContainsFlag({
  arg,
  flag,
}: {
  readonly arg: string;
  readonly flag: string;
},): boolean {
  if (!isShortOptionToken(arg,))
    return false;

  /** Short-option letters and possible inline value after leading dash. */
  const optionCluster = arg.slice(SHORT_OPTION_PREFIX.length,);
  /** Position where requested flag appears in cluster, or -1 when absent. */
  const flagIndex = optionCluster.indexOf(flag,);

  if (flagIndex === (-1))
    return false;

  /** First value-taking option; characters from this index onward are value text. */
  const firstValueOptionIndex = findFirstShortValueOptionIndex(arg,);

  return (firstValueOptionIndex === undefined) || (flagIndex < firstValueOptionIndex);
}

/**
 * Checks whether short-option token consumes following argv token as value.
 *
 * @param arg - Short option token to scan.
 *
 * @returns Whether caller should skip next argv token while looking for pathspecs.
 *
 * @example
 * ```ts
 * shortOptionConsumesNextValue('-am'); // true
 * shortOptionConsumesNextValue('-amhello'); // false
 * ```
 */
function shortOptionConsumesNextValue(arg: string,): boolean {
  if (!isShortOptionToken(arg,))
    return false;

  /** Short-option letters and possible inline value after leading dash. */
  const optionCluster = arg.slice(SHORT_OPTION_PREFIX.length,);
  /** First value-taking option; absent when token has only boolean short flags. */
  const firstValueOptionIndex = findFirstShortValueOptionIndex(arg,);
  /** Final index in the short-option cluster. */
  const finalOptionIndex = optionCluster.length - 1;

  return firstValueOptionIndex === finalOptionIndex;
}

/**
 * Checks whether option token consumes following argv token as value.
 *
 * @param arg - Option token to classify.
 *
 * @returns Whether next argv token is option value rather than pathspec or flag.
 *
 * @example
 * ```ts
 * consumesSeparateValue('-m'); // true
 * consumesSeparateValue('--message=hi'); // false
 * ```
 */
function consumesSeparateValue(arg: string,): boolean {
  return SEPARATE_VALUE_OPTIONS.has(arg,) || shortOptionConsumesNextValue(arg,);
}

/**
 * Removes separated option values so later scans do not mistake messages,
 * authors, or templates for flags and pathspecs.
 *
 * @param args - Post-`commit` argv tokens.
 *
 * @returns Argv tokens with separated values omitted.
 *
 * @example
 * ```ts
 * stripCommitOptionValues(['-m', 'message', 'file.ts']); // ['-m', 'file.ts']
 * ```
 */
function stripCommitOptionValues(args: readonly string[],): readonly string[] {
  /** Current token inspected by recursive strip. */
  const [arg,] = args;

  if (arg === undefined)
    return [];

  if (arg === PATHSPEC_SEPARATOR)
    return args;

  /** Tokens after current token. */
  const remainingArgs = args.slice(1,);

  if (consumesSeparateValue(arg,)) {
    return [
      arg,
      ...stripCommitOptionValues(remainingArgs.slice(1,),),
    ];
  }

  return [
    arg,
    ...stripCommitOptionValues(remainingArgs,),
  ];
}

/**
 * Splits argv around pathspec separator.
 *
 * @param args - Argv tokens after option values have been removed.
 *
 * @returns Option tokens before separator and pathspec tokens after separator.
 *
 * @example
 * ```ts
 * splitPathspecSeparator(['-m', '--', '-dash']);
 * // { beforeSeparator: ['-m'], afterSeparator: ['-dash'] }
 * ```
 */
function splitPathspecSeparator(args: readonly string[],): PathspecSplit {
  /** Index of `--`, or -1 when invocation has no explicit pathspec separator. */
  const separatorIndex = args.indexOf(PATHSPEC_SEPARATOR,);

  if (separatorIndex === (-1)) {
    return {
      beforeSeparator: args,
      afterSeparator: [],
    };
  }

  return {
    beforeSeparator: args.slice(
      0,
      separatorIndex,
    ),
    afterSeparator: args.slice(separatorIndex + 1,),
  };
}

/**
 * Checks whether token is a positional pathspec before `--`.
 *
 * @param arg - Token from option region.
 *
 * @returns Whether token is not option-shaped and therefore names a pathspec.
 *
 * @example
 * ```ts
 * isPlainPathspec('file.ts'); // true
 * isPlainPathspec('-m'); // false
 * ```
 */
function isPlainPathspec(arg: string,): boolean {
  return !arg.startsWith(SHORT_OPTION_PREFIX,);
}

/**
 * Checks whether option token supplies pathspecs from file or stdin.
 *
 * @param arg - Token from option region.
 *
 * @returns Whether token is `--pathspec-from-file` or its inline-value form.
 *
 * @example
 * ```ts
 * isPathspecFromFileOption('--pathspec-from-file=paths.txt'); // true
 * ```
 */
function isPathspecFromFileOption(arg: string,): boolean {
  return (arg === PATHSPEC_FROM_FILE_OPTION)
    || arg.startsWith(PATHSPEC_FROM_FILE_PREFIX,);
}

/**
 * Checks whether option token asks git to stage all tracked modifications.
 *
 * @param arg - Token from option region.
 *
 * @returns Whether token contains `-a` or `--all` as an option.
 *
 * @example
 * ```ts
 * isAllOption('-am'); // true
 * isAllOption('-mabc'); // false
 * ```
 */
function isAllOption(arg: string,): boolean {
  return (arg === ALL_LONG_OPTION)
    || shortOptionContainsFlag({
      arg,
      flag: ALL_SHORT_OPTION,
    },);
}

/**
 * Checks whether option token explicitly chooses only-mode behavior.
 *
 * @param arg - Token from option region.
 *
 * @returns Whether token contains `-o`, `--only`, or `--no-only` as an option.
 *
 * @example
 * ```ts
 * isExplicitOnlyOption('-om'); // true
 * isExplicitOnlyOption('--no-only'); // true
 * ```
 */
function isExplicitOnlyOption(arg: string,): boolean {
  return EXACT_EXPLICIT_ONLY_OPTIONS.has(arg,)
    || shortOptionContainsFlag({
      arg,
      flag: ONLY_SHORT_OPTION,
    },);
}

/**
 * Analyzes post-`commit` argv tokens for commit-only enforcement.
 *
 * @param args - Tokens after `git commit` subcommand.
 *
 * @returns Commit argv facts needed by policy checks.
 *
 * @example
 * ```ts
 * analyzeCommitArgs(['-m', 'message', 'file.ts']).hasPathspec; // true
 * analyzeCommitArgs(['-am', 'message']).hasAllFlag; // true
 * ```
 */
export function analyzeCommitArgs(args: readonly string[],): CommitArgsAnalysis {
  /** Args with separated option values removed before flag/pathspec detection. */
  const argsWithoutOptionValues = stripCommitOptionValues(args,);
  /** Option and pathspec regions split at explicit `--`. */
  const splitArgs = splitPathspecSeparator(argsWithoutOptionValues,);
  /** Region where tokens can still be parsed as git commit options. */
  const optionArgs = splitArgs.beforeSeparator;
  /** Whether explicit `--` is followed by any pathspec token, including dash-leading paths. */
  const hasSeparatedPathspec = splitArgs.afterSeparator.length > 0;
  /** Whether pre-`--` region contains a non-option token naming a pathspec. */
  const hasPlainPathspec = optionArgs.some(function isPlainPathspecToken(arg,) {
    return isPlainPathspec(arg,);
  },);

  return {
    hasAllFlag: optionArgs.some(function isAllFlagOption(arg,) {
      return isAllOption(arg,);
    },),
    hasExplicitOnlyFlag: optionArgs.some(function isExplicitOnlyFlagOption(arg,) {
      return isExplicitOnlyOption(arg,);
    },),
    hasNoOnlyFlag: optionArgs.includes(NO_ONLY_LONG_OPTION,),
    hasPathlessAllowedFlag: optionArgs.some(function isPathlessAllowedOption(arg,) {
      return PATHLESS_ALLOWED_OPTIONS.has(arg,);
    },),
    hasPathspecFromFile: optionArgs.some(function isPathspecFromFileFlag(arg,) {
      return isPathspecFromFileOption(arg,);
    },),
    hasPathspec: hasSeparatedPathspec || hasPlainPathspec,
  };
}

import {
  DRY_RUN_ALIAS_SET,
  EXCLUDE_ALIAS_SET,
  INTERACTIVE_ALIAS_SET,
  NO_DRY_RUN_ALIAS_SET,
  NO_INTERACTIVE_ALIAS_SET,
} from './clean-options.ts';

//region Ordered clean option state

/**
 * Ordered state of clean mode flags that affect filesystem deletion.
 */
export type CleanOptionState = {
  /**
   * Final dry-run state after scanned options so far.
   */
  readonly dryRunActive: boolean;
  /**
   * Final interactive state after scanned options so far.
   */
  readonly interactiveActive: boolean;
};

/**
 * Default clean mode before explicit dry-run or interactive options appear.
 */
const INITIAL_CLEAN_OPTION_STATE = {
  dryRunActive: false,
  interactiveActive: false,
} as const satisfies CleanOptionState;

//endregion Ordered clean option state

//region Long option matching

/**
 * Options for matching long option aliases.
 */
type LongOptionAliasMatchOptions = {
  /**
   * Raw argv token to test.
   */
  readonly arg: string;
  /**
   * Accepted exact long-option spellings and abbreviations.
   */
  readonly aliases: ReadonlySet<string>;
};

/**
 * Checks whether an argv token exactly matches one accepted long-option alias.
 *
 * @param arg - Raw argv token to test.
 *
 * @param aliases - Accepted exact long-option spellings and abbreviations.
 *
 * @returns `true` when token is one of the aliases.
 *
 * @example
 * ```ts
 * isLongOptionAlias({ arg: '--dry-run', aliases: DRY_RUN_ALIAS_SET });
 * // => true
 * ```
 */
function isLongOptionAlias({
  arg,
  aliases,
}: LongOptionAliasMatchOptions,): boolean {
  return aliases.has(arg,);
}

/**
 * Checks whether an argv token uses the `--option=value` form for an alias.
 *
 * @param arg - Raw argv token to test.
 *
 * @param aliases - Accepted exact long-option spellings and abbreviations.
 *
 * @returns `true` when token starts with an accepted alias plus `=`.
 *
 * @example
 * ```ts
 * hasInlineLongOptionValue({
 *   arg: '--exclude=dist',
 *   aliases: EXCLUDE_ALIAS_SET,
 * });
 * // => true
 * ```
 */
function hasInlineLongOptionValue({
  arg,
  aliases,
}: LongOptionAliasMatchOptions,): boolean {
  return [...aliases,].some(function aliasHasInlineValue(alias,): boolean {
    return arg.startsWith(`${alias}=`,);
  },);
}

//endregion Long option matching

//region Long clean mode application

/**
 * Options for applying an ordered long clean flag.
 */
type ApplyLongCleanOptionOptions = {
  /**
   * Raw argv token to apply.
   */
  readonly arg: string;
  /**
   * State before this token is applied.
   */
  readonly state: CleanOptionState;
};

/**
 * Applies one exact long clean mode option to the accumulated ordered state.
 * Tests each alias set with {@link isLongOptionAlias}.
 *
 * @param arg - Raw argv token to apply.
 *
 * @param state - State before this token is applied.
 *
 * @returns Updated state after applying matching dry-run or interactive option.
 *
 * @example
 * ```ts
 * applyLongCleanOption({
 *   arg: '--no-dry-run',
 *   state: INITIAL_CLEAN_OPTION_STATE,
 * });
 * // => { dryRunActive: false, interactiveActive: false }
 * ```
 */
function applyLongCleanOption({
  arg,
  state,
}: ApplyLongCleanOptionOptions,): CleanOptionState {
  if (isLongOptionAlias({
    arg,
    aliases: DRY_RUN_ALIAS_SET,
  },)) {
    return {
      ...state,
      dryRunActive: true,
    };
  }

  if (isLongOptionAlias({
    arg,
    aliases: NO_DRY_RUN_ALIAS_SET,
  },)) {
    return {
      ...state,
      dryRunActive: false,
    };
  }

  if (isLongOptionAlias({
    arg,
    aliases: INTERACTIVE_ALIAS_SET,
  },)) {
    return {
      ...state,
      interactiveActive: true,
    };
  }

  if (isLongOptionAlias({
    arg,
    aliases: NO_INTERACTIVE_ALIAS_SET,
  },)) {
    return {
      ...state,
      interactiveActive: false,
    };
  }

  return state;
}

//endregion Long clean mode application

//region Short clean option cluster scanning

/**
 * Options for scanning a short-option cluster.
 */
type ScanShortCleanOptionClusterOptions = {
  /**
   * Short-option characters without the leading `-`.
   */
  readonly cluster: string;
  /**
   * Character index where scanning resumes.
   */
  readonly index: number;
  /**
   * State before this cluster segment is applied.
   */
  readonly state: CleanOptionState;
};

/**
 * Result of scanning a short-option cluster.
 */
type ScanShortCleanOptionClusterResult = {
  /**
   * State after applying dry-run and interactive flags in the cluster.
   */
  readonly state: CleanOptionState;
  /**
   * True when `-e` has no inline value and consumes the next argv token.
   */
  readonly consumesNextToken: boolean;
};

/**
 * Scans short clean option clusters left-to-right, stopping when `-e` begins an
 * exclude pattern value because remaining characters or the next argv token are
 * pattern text, not flags.
 *
 * @param cluster - Short-option characters without the leading `-`.
 *
 * @param index - Character index where scanning resumes.
 *
 * @param state - State before this cluster segment is applied.
 *
 * @returns Updated state plus whether the cluster consumes the next argv token.
 *
 * @example
 * ```ts
 * scanShortCleanOptionCluster({
 *   cluster: 'ni',
 *   index: 0,
 *   state: INITIAL_CLEAN_OPTION_STATE,
 * });
 * // => { state: { dryRunActive: true, interactiveActive: true }, consumesNextToken: false }
 * ```
 */
function scanShortCleanOptionCluster({
  cluster,
  index,
  state,
}: ScanShortCleanOptionClusterOptions,): ScanShortCleanOptionClusterResult {
  /**
   * Short option character at scan position.
   */
  const option = cluster[index];

  if (option === undefined) {
    return {
      state,
      consumesNextToken: false,
    };
  }

  if (option === 'e') {
    return {
      state,
      consumesNextToken: index === (cluster.length
        - 1),
    };
  }

  if (option === 'n') {
    return scanShortCleanOptionCluster({
      cluster,
      index: index + 1,
      state: {
        ...state,
        dryRunActive: true,
      },
    },);
  }

  if (option === 'i') {
    return scanShortCleanOptionCluster({
      cluster,
      index: index + 1,
      state: {
        ...state,
        interactiveActive: true,
      },
    },);
  }

  return scanShortCleanOptionCluster({
    cluster,
    index: index + 1,
    state,
  },);
}

//endregion Short clean option cluster scanning

//region Ordered clean option scan

/**
 * Options for scanning clean options in argv order.
 */
type ScanCleanOptionTokensOptions = {
  /**
   * Option-region argv tokens, excluding pathspecs after `--`.
   */
  readonly region: readonly string[];
  /**
   * Token index where scanning resumes.
   */
  readonly index: number;
  /**
   * State accumulated before this token.
   */
  readonly state: CleanOptionState;
};

/**
 * Scans clean option tokens in argv order and applies Git's last-option-wins
 * semantics for dry-run/no-dry-run and interactive/no-interactive flags.
 * Skips `--exclude` values detected by {@link hasInlineLongOptionValue} and
 * {@link isLongOptionAlias}, applies long options through
 * {@link applyLongCleanOption}, and applies short-option clusters through
 * {@link scanShortCleanOptionCluster}.
 *
 * @param region - Option-region argv tokens, excluding pathspecs after `--`.
 *
 * @param index - Token index where scanning resumes.
 *
 * @param state - State accumulated before this token.
 *
 * @returns Final clean mode state after all relevant options are applied.
 *
 * @example
 * ```ts
 * scanCleanOptionTokens({
 *   region: ['--dry-run', '--no-dry-run'],
 *   index: 0,
 *   state: INITIAL_CLEAN_OPTION_STATE,
 * });
 * // => { dryRunActive: false, interactiveActive: false }
 * ```
 */
function scanCleanOptionTokens({
  region,
  index,
  state,
}: ScanCleanOptionTokensOptions,): CleanOptionState {
  /**
   * Current argv token at scan position.
   */
  const arg = region[index];

  if (arg === undefined)
    return state;

  if (hasInlineLongOptionValue({
    arg,
    aliases: EXCLUDE_ALIAS_SET,
  },)) {
    return scanCleanOptionTokens({
      region,
      index: index + 1,
      state,
    },);
  }

  if (isLongOptionAlias({
    arg,
    aliases: EXCLUDE_ALIAS_SET,
  },)) {
    return scanCleanOptionTokens({
      region,
      index: index + 2,
      state,
    },);
  }

  if (arg.startsWith('--',)) {
    return scanCleanOptionTokens({
      region,
      index: index + 1,
      state: applyLongCleanOption({
        arg,
        state,
      },),
    },);
  }

  if ((arg.startsWith('-',))
    && (arg !== '-')) {
    /**
     * Ordered state after scanning this short-option cluster.
     */
    const clusterResult = scanShortCleanOptionCluster({
      cluster: arg.slice(1,),
      index: 0,
      state,
    },);

    return scanCleanOptionTokens({
      region,
      index: index + (clusterResult.consumesNextToken ? 2 : 1),
      state: clusterResult.state,
    },);
  }

  return scanCleanOptionTokens({
    region,
    index: index + 1,
    state,
  },);
}

/**
 * Scans clean options in argv order and returns final dry-run/interactive
 * state, via {@link scanCleanOptionTokens}.
 *
 * @param region - Option-region argv tokens, excluding pathspecs after `--`.
 *
 * @returns Final clean mode state after Git-style last-option-wins ordering.
 *
 * @example
 * ```ts
 * scanCleanOptionOrder(['--dry-run', '--no-dry-run']);
 * // => { dryRunActive: false, interactiveActive: false }
 * ```
 */
export function scanCleanOptionOrder(region: readonly string[],): CleanOptionState {
  return scanCleanOptionTokens({
    region,
    index: 0,
    state: INITIAL_CLEAN_OPTION_STATE,
  },);
}

//endregion Ordered clean option scan

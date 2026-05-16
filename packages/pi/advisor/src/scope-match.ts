/**
 * Model matching helpers for Advisor scope pattern resolution.
 *
 * @module
 */

import type {
  Api,
  Model,
} from '@earendil-works/pi-ai';
import { canonicalSlug, } from './model-slug.ts';
import { findExactModelReferenceMatch, } from './scope-exact.ts';
import type {
  ScopedAdvisorModel,
  ScopedThinkingLevel,
} from './types.ts';

//region Types and constants

/** Result of parsing a single model scope pattern. */
export type PatternResolution = {
  /** Matched model, or `undefined` when no model matched. */
  model?: Model<Api>;
  /** Thinking level suffix, when present. */
  thinkingLevel?: ScopedThinkingLevel;
};

/** Valid pi thinking-level suffixes. */
const THINKING_LEVELS = [
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
] as const satisfies readonly ScopedThinkingLevel[];

/** Valid pi thinking-level suffixes as strings for runtime checks. */
const THINKING_LEVEL_SET: ReadonlySet<string> = new Set(THINKING_LEVELS,);

/** Digits in pi model date suffixes. */
const DATE_SUFFIX_DIGITS = 8;

/** Total characters in pi model date suffix including leading hyphen. */
const DATE_SUFFIX_TOTAL_LENGTH = DATE_SUFFIX_DIGITS + 1;

/** ASCII digit characters accepted in pi model date suffixes. */
const ASCII_DIGITS: ReadonlySet<string> = new Set([
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
],);

//endregion Types and constants

//region Public helpers

/**
 * Parse exact or fuzzy pi model pattern.
 *
 * @param pattern - pi model pattern
 *
 * @param availableModels - models with configured auth
 *
 * @returns matched model and optional thinking level
 *
 * @example
 * ```typescript
 * parseModelPattern({ pattern: 'sonnet:high', availableModels });
 * ```
 */
export function parseModelPattern(
  {
    pattern,
    availableModels,
  }: {
    pattern: string;
    availableModels: readonly Model<Api>[];
  },
): PatternResolution {
  /** Exact match with full pattern. */
  const exactMatch = tryMatchModel({
    pattern,
    availableModels,
  },);
  if (exactMatch !== undefined)
    return { model: exactMatch, };

  /** Last colon, used for optional thinking suffix parsing. */
  const lastColonIndex = pattern.lastIndexOf(':',);
  if (lastColonIndex === (-1))
    return {};

  /** Pattern before possible suffix. */
  const prefix = pattern.slice(
    0,
    lastColonIndex,
  );
  /** Candidate thinking suffix. */
  const suffix = pattern.slice(lastColonIndex + 1,);
  if (!isThinkingLevel(suffix,)) {
    return parseModelPattern({
      pattern: prefix,
      availableModels,
    },);
  }

  /** Recursive match for pattern body. */
  const nested = parseModelPattern({
    pattern: prefix,
    availableModels,
  },);
  return nested.model === undefined
    ? {}
    : {
      model: nested.model,
      thinkingLevel: suffix,
    };
}

/**
 * Split a glob pattern from optional thinking suffix.
 *
 * @param pattern - glob pattern
 *
 * @returns pattern body and optional thinking level
 *
 * @example
 * ```typescript
 * splitThinkingSuffix('anthropic/*:high');
 * ```
 */
export function splitThinkingSuffix(
  pattern: string,
): {
  pattern: string;
  thinkingLevel?: ScopedThinkingLevel;
} {
  /** Last colon, used for optional suffix parsing. */
  const colonIndex = pattern.lastIndexOf(':',);
  if (colonIndex === (-1))
    return { pattern, };

  /** Candidate suffix after last colon. */
  const suffix = pattern.slice(colonIndex + 1,);
  return isThinkingLevel(suffix,)
    ? {
      pattern: pattern.slice(
        0,
        colonIndex,
      ),
      thinkingLevel: suffix,
    }
    : { pattern, };
}

/**
 * Check whether a string contains glob syntax.
 *
 * @param pattern - model pattern
 *
 * @returns whether pattern contains glob syntax
 *
 * @example
 * ```typescript
 * patternHasGlob('anthropic/*');
 * ```
 */
export function patternHasGlob(
  pattern: string,
): boolean {
  return [
    '*',
    '?',
    '[',
  ]
    .some(function patternIncludes(token,) {
      return pattern.includes(token,);
    },);
}

/**
 * Convert model to scoped model entry.
 *
 * @param model - pi model object
 *
 * @param thinkingLevel - optional thinking level from scope pattern
 *
 * @returns scoped Advisor model
 *
 * @example
 * ```typescript
 * scopedModelFromModel({ model });
 * ```
 */
export function scopedModelFromModel(
  {
    model,
    thinkingLevel,
  }: {
    model: Model<Api>;
    thinkingLevel?: ScopedThinkingLevel;
  },
): ScopedAdvisorModel {
  return {
    model,
    canonicalSlug: canonicalSlug(model,),
    ...(thinkingLevel === undefined ? {} : { thinkingLevel, }),
  };
}

//endregion Public helpers

//region Internal helpers

/**
 * Try exact and fuzzy model matching.
 *
 * @param pattern - pi model pattern
 *
 * @param availableModels - models with configured auth
 *
 * @returns matched model, if any
 */
function tryMatchModel(
  {
    pattern,
    availableModels,
  }: {
    pattern: string;
    availableModels: readonly Model<Api>[];
  },
): Model<Api> | undefined {
  /** Exact match by canonical slug or bare id. */
  const exact = findExactModelReferenceMatch({
    modelReference: pattern,
    availableModels,
  },);
  if (exact !== undefined)
    return exact;

  /** Lowercase pattern for fuzzy id and name matching. */
  const normalizedPattern = pattern.toLowerCase();
  /** Fuzzy matches by model id or display name. */
  const matches = availableModels.filter(function fuzzyMatches(model,) {
    return model.id.toLowerCase().includes(normalizedPattern,)
      || model.name.toLowerCase().includes(normalizedPattern,);
  },);
  if (matches.length === 0)
    return undefined;

  /** Alias matches, preferred over dated versions. */
  const aliases = matches.filter(function keepAlias(model,) {
    return isAlias(model.id,);
  },);
  /** Candidate list before sorting. */
  const candidates = aliases.length > 0 ? aliases : matches;
  /** Candidate list sorted by pi's descending id tie-break. */
  const sortedCandidates = candidates.toSorted(function compareByIdDesc(
    left,
    right,
  ) {
    return right.id.localeCompare(left.id,);
  },);
  /** First candidate after sorting. */
  const [firstCandidate,] = sortedCandidates;
  return firstCandidate;
}

/**
 * Check whether a suffix is a valid thinking level.
 *
 * @param value - candidate suffix
 *
 * @returns whether suffix is a valid thinking level
 */
function isThinkingLevel(
  value: string,
): value is ScopedThinkingLevel {
  return THINKING_LEVEL_SET.has(value,);
}

/**
 * Check whether a model id is treated as an alias by pi.
 *
 * @param id - model id
 *
 * @returns whether model id is an alias
 */
function isAlias(
  id: string,
): boolean {
  return (id.endsWith('-latest',)) || (!hasDateSuffix(id,));
}

/**
 * Check whether a model id ends with pi's date suffix shape.
 *
 * @param id - model id
 *
 * @returns whether id ends with hyphen followed by eight ASCII digits
 */
function hasDateSuffix(
  id: string,
): boolean {
  if (id.length < DATE_SUFFIX_TOTAL_LENGTH)
    return false;

  /** Index of leading hyphen for suffix candidate. */
  const suffixHyphenIndex = id.length - DATE_SUFFIX_TOTAL_LENGTH;
  if (id.at(suffixHyphenIndex,) !== '-')
    return false;

  /** Candidate date suffix without leading hyphen. */
  const dateSuffix = id.slice(suffixHyphenIndex + 1,);
  return isAsciiDigitString(dateSuffix,);
}

/**
 * Check whether bounded string contains only ASCII digits.
 *
 * @param value - candidate digit string
 *
 * @returns whether every character is an ASCII digit
 */
function isAsciiDigitString(
  value: string,
): boolean {
  if (value === '')
    return true;

  return isAsciiDigit(value.at(0,) ?? '',) && isAsciiDigitString(value.slice(1,),);
}

/**
 * Check whether one character is an ASCII digit.
 *
 * @param character - single-character string
 *
 * @returns whether character is between zero and nine inclusive
 */
function isAsciiDigit(
  character: string,
): boolean {
  return ASCII_DIGITS.has(character,);
}

//endregion Internal helpers

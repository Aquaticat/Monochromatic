/**
 * Pi-style model scope pattern resolution for Advisor.
 *
 * @module
 */

import {
  type Api,
  type Model,
  modelsAreEqual,
} from '@earendil-works/pi-ai';
import { minimatch, } from 'minimatch';
import { canonicalSlug, } from './model-slug.ts';
import {
  parseModelPattern,
  patternHasGlob,
  scopedModelFromModel,
  splitThinkingSuffix,
} from './scope-match.ts';
import type {
  AdvisorReadonlyModel,
  ScopedAdvisorModel,
} from './types.ts';

//region Public API

/**
 * Resolve pi-style model scope patterns against available models.
 *
 * @param patterns - pi model scope patterns
 *
 * @param availableModels - models with configured auth
 *
 * @returns deduplicated scoped models in pattern order
 *
 * @example
 * ```typescript
 * resolveModelPatterns({ patterns: ['anthropic/*'], availableModels });
 * ```
 */
export function resolveModelPatterns(
  {
    patterns,
    availableModels,
  }: {
    readonly patterns: readonly string[];
    readonly availableModels: readonly AdvisorReadonlyModel[];
  },
): ScopedAdvisorModel[] {
  /** Accumulated unique matches across patterns. */
  const accumulator: ScopedAdvisorModel[] = [];
  for (const pattern of patterns) {
    /** Models matched by this pattern. */
    const matches = patternHasGlob(pattern,)
      ? resolveGlobPattern({
        pattern,
        availableModels,
      },)
      : resolveLiteralPattern({
        pattern,
        availableModels,
      },);
    /** Updated accumulator with new unique matches appended. */
    const next = appendUniqueMatches({
      accumulator,
      matches,
    },);
    accumulator.length = 0;
    accumulator.push(...next,);
  }
  return accumulator;
}

//endregion Public API

//region Pattern resolution

/**
 * Resolve a glob model pattern.
 *
 * @param pattern - pi glob pattern
 *
 * @param availableModels - models with configured auth
 *
 * @returns matching scoped models
 */
function resolveGlobPattern(
  {
    pattern,
    availableModels,
  }: {
    readonly pattern: string;
    readonly availableModels: readonly AdvisorReadonlyModel[];
  },
): ScopedAdvisorModel[] {
  /** Pattern split into glob body and optional thinking suffix. */
  const parsed = splitThinkingSuffix(pattern,);
  return availableModels
    .filter(function matchesModel(model,) {
      /** Canonical model reference. */
      const fullId = canonicalSlug(model,);
      return minimatch(
        fullId,
        parsed.pattern,
        { nocase: true, },
      ) || minimatch(
        model.id,
        parsed.pattern,
        { nocase: true, },
      );
    },)
    .map(function mapMatch(model,) {
      return scopedModelFromModel({
        model,
        ...(parsed.thinkingLevel === undefined
          ? {}
          : { thinkingLevel: parsed.thinkingLevel, }),
      },);
    },);
}

/**
 * Resolve a non-glob model pattern.
 *
 * @param pattern - pi literal or fuzzy pattern
 *
 * @param availableModels - models with configured auth
 *
 * @returns matching scoped model when found
 */
function resolveLiteralPattern(
  {
    pattern,
    availableModels,
  }: {
    readonly pattern: string;
    readonly availableModels: readonly AdvisorReadonlyModel[];
  },
): ScopedAdvisorModel[] {
  /** Parsed model pattern. */
  const resolution = parseModelPattern({
    pattern,
    availableModels,
  },);
  return resolution.model === undefined
    ? []
    : [scopedModelFromModel({
      model: resolution.model,
      ...(resolution.thinkingLevel === undefined
        ? {}
        : { thinkingLevel: resolution.thinkingLevel, }),
    },),];
}

/**
 * Append matches that have not appeared earlier in scope order.
 *
 * @param accumulator - scoped model accumulator
 *
 * @param matches - matches from current pattern
 *
 * @returns same accumulator with new unique matches appended
 */
function appendUniqueMatches(
  {
    accumulator,
    matches,
  }: {
    readonly accumulator: readonly ScopedAdvisorModel[];
    readonly matches: readonly ScopedAdvisorModel[];
  },
): ScopedAdvisorModel[] {
  /** Fresh accumulator seeded from input to avoid mutating the caller's array. */
  const result: ScopedAdvisorModel[] = [...accumulator,];
  for (const match of matches) {
    if (result.some(function alreadyAdded(entry,) {
      /* oxlint-disable typescript/no-unsafe-type-assertion -- pi-ai `modelsAreEqual` accepts mutable `Model<Api>`; prefer-readonly-parameter-types requires our entry.model to be deep-readonly. */
      /** Mutable view of entry model for external pi-ai API. */
      const entryModel = entry.model as Model<Api>;
      /** Mutable view of match model for external pi-ai API. */
      const matchModel = match.model as Model<Api>;
      /* oxlint-enable typescript/no-unsafe-type-assertion */
      return modelsAreEqual(
        entryModel,
        matchModel,
      );
    },))
      continue;
    result.push(match,);
  }
  return result;
}

//endregion Pattern resolution

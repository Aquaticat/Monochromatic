/**
 * Pi-style model scope pattern resolution for Advisor.
 *
 * @module
 */

import {
  modelsAreEqual,
  type Api,
  type Model,
} from '@earendil-works/pi-ai';
import { minimatch, } from 'minimatch';
import { canonicalSlug, } from './model-slug.ts';
import {
  parseModelPattern,
  patternHasGlob,
  scopedModelFromModel,
  splitThinkingSuffix,
} from './scope-match.ts';
import type { ScopedAdvisorModel, } from './types.ts';

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
    patterns: readonly string[];
    availableModels: readonly Model<Api>[];
  },
): ScopedAdvisorModel[] {
  return patterns.reduce(
    function collectPattern(
      accumulator: ScopedAdvisorModel[],
      pattern,
    ) {
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
      return appendUniqueMatches({
        accumulator,
        matches,
      },);
    },
    [],
  );
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
    pattern: string;
    availableModels: readonly Model<Api>[];
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
        ...(parsed.thinkingLevel === undefined ? {} : { thinkingLevel: parsed.thinkingLevel, }),
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
    pattern: string;
    availableModels: readonly Model<Api>[];
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
    accumulator: ScopedAdvisorModel[];
    matches: readonly ScopedAdvisorModel[];
  },
): ScopedAdvisorModel[] {
  for (const match of matches) {
    if (!accumulator.some(function alreadyAdded(entry,) {
      return modelsAreEqual(
        entry.model,
        match.model,
      );
    },)) {
      accumulator.push(match,);
    }
  }
  return accumulator;
}

//endregion Pattern resolution

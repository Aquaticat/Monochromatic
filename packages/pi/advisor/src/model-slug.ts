/**
 * Advisor model slug helpers and validation.
 *
 * @module
 */

import type {
  Api,
  Model,
} from '@earendil-works/pi-ai';
import type { ModelRegistry, } from '@earendil-works/pi-coding-agent';
import type { ReadonlyDeep, } from 'type-fest';
import type {
  AdvisorModelSelection,
  AdvisorReadonlyModel,
  EffectiveModelScope,
  ScopedAdvisorModel,
} from './types.ts';

//region Public API

/** Options for resolving an explicit model slug. */
export type ResolveRequestedModelOptions = {
  /** Effective scoped model set. */
  readonly scope: EffectiveModelScope;
  /** User supplied slug. */
  readonly requestedSlug: string;
  /** Global model registry used to distinguish out-of-scope slugs. */
  readonly modelRegistry: ReadonlyDeep<ModelRegistry>;
};

/**
 * Return canonical Advisor slug for a model.
 *
 * @param model - pi model object
 *
 * @returns canonical `provider/modelId` slug
 *
 * @example
 * ```typescript
 * canonicalSlug(model);
 * ```
 */
export function canonicalSlug(
  model: AdvisorReadonlyModel,
): string {
  return `${model.provider}/${model.id}`;
}

/**
 * Resolve an explicit Advisor model slug inside the effective scoped model set.
 *
 * @param options - scope, slug, and global registry
 *
 * @returns selected scoped model
 *
 * @throws when slug is absent, ambiguous, unknown, or outside scope
 *
 * @example
 * ```typescript
 * resolveRequestedModel({ scope, requestedSlug: 'anthropic/claude-sonnet', modelRegistry });
 * ```
 */
export function resolveRequestedModel(
  options: ResolveRequestedModelOptions,
): AdvisorModelSelection {
  /** Trimmed requested model slug. */
  const requestedSlug = options.requestedSlug
    .trim();
  if (requestedSlug === '')
    throw new Error('advisor: model slug must not be empty',);

  /** Matching scoped model candidates. */
  const scopedMatches = findScopedSlugMatches({
    scope: options.scope,
    requestedSlug,
  },);
  if (scopedMatches.length
    === 1) {
    /** Only scoped match after length guard. */
    const [selected,] = scopedMatches;
    if (selected === undefined)
      throw new Error('advisor: internal slug resolution failed',);
    return {
      selected,
      requestedSlug,
    };
  }
  if (scopedMatches.length
    > 1) {
    throw new Error(
      `advisor: model slug "${requestedSlug}" is ambiguous in scoped models. Matching scoped slugs: ${
        scopedMatches
          .map(function mapMatch(match,) {
            return match.canonicalSlug;
          },)
          .join(', ',)
      }`,
    );
  }

  if (slugExistsGlobally({
    requestedSlug,
    models: options.modelRegistry
      .getAll(),
  },)) {
    throw new Error(
      `advisor: model slug "${requestedSlug}" is not in scoped models. Allowed scoped slugs: ${
        allowedSlugs(
          options.scope,
        )
      }`,
    );
  }

  throw new Error(
    `advisor: model slug "${requestedSlug}" was not found in scoped models. Allowed scoped slugs: ${
      allowedSlugs(
        options.scope,
      )
    }`,
  );
}

/**
 * Format allowed canonical slugs for errors and status output.
 *
 * @param scope - effective model scope
 *
 * @returns comma-separated canonical slugs or `none`
 *
 * @example
 * ```typescript
 * allowedSlugs(scope);
 * ```
 */
export function allowedSlugs(
  scope: EffectiveModelScope,
): string {
  return scope.entries
    .length
    === 0
    ? 'none'
    : scope
      .entries
      .map(function mapEntry(entry,) {
        return entry.canonicalSlug;
      },)
      .join(', ',);
}

//endregion Public API

//region Matching

/**
 * Find scoped matches for canonical, bare id, or unique model name slug forms.
 *
 * @param scope - effective model scope
 *
 * @param requestedSlug - requested model slug
 *
 * @returns matching scoped models
 */
function findScopedSlugMatches(
  {
    scope,
    requestedSlug,
  }: {
    readonly scope: EffectiveModelScope;
    readonly requestedSlug: string;
  },
): ScopedAdvisorModel[] {
  if (requestedSlug.includes('/',)) {
    return scope.entries
      .filter(function matchCanonical(entry,) {
      return entry.canonicalSlug
        === requestedSlug;
    },);
  }

  /** Bare id matches inside scope. */
  const idMatches = scope.entries
    .filter(function matchId(entry,) {
    return entry.model
      .id
      === requestedSlug;
  },);
  /** Model display-name matches inside scope. */
  const nameMatches = scope.entries
    .filter(function matchName(entry,) {
    return entry.model
      .name
      === requestedSlug;
  },);
  /** Unique matches across both bare forms. */
  const uniqueMatches = uniqueScopedModels([
    ...idMatches,
    ...nameMatches,
  ],);
  return uniqueMatches;
}

/**
 * Check whether a slug exists anywhere in the global registry.
 *
 * @param requestedSlug - requested model slug
 *
 * @param models - global model registry entries
 *
 * @returns whether slug exists globally
 */
function slugExistsGlobally(
  {
    requestedSlug,
    models,
  }: {
    readonly requestedSlug: string;
    readonly models: readonly AdvisorReadonlyModel[];
  },
): boolean {
  if (requestedSlug.includes('/',)) {
    return models.some(function matchesCanonical(model,) {
      return canonicalSlug(model,)
        === requestedSlug;
    },);
  }

  return models.some(function matchesBareModel(model,) {
    return (model.id
      === requestedSlug) || (model.name
        === requestedSlug);
  },);
}

/**
 * Deduplicate scoped model matches by canonical slug.
 *
 * @param models - scoped models to deduplicate
 *
 * @returns unique scoped models
 */
function uniqueScopedModels(
  models: readonly ScopedAdvisorModel[],
): ScopedAdvisorModel[] {
  /** Locally-owned accumulator built without mutating the input. */
  const result: ScopedAdvisorModel[] = [];
  for (const model of models) {
    if (result.some(function alreadyAdded(entry,) {
      return entry.canonicalSlug
        === model
        .canonicalSlug;
    },))
      continue;
    result.push(model,);
  }
  return result;
}

//endregion Matching

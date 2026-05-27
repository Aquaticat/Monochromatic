/**
 * Exact model reference matching for scope reconstruction.
 *
 * @module
 */

import {
  ABSENT,
  type Maybe,
} from './maybe.ts';
import { canonicalSlug, } from './model-id.ts';
import type { ModelIdentity, } from './types.ts';

//region Public API

/**
 * Find an exact canonical or bare model reference match.
 *
 * @param modelReference - user or config model reference
 *
 * @param availableModels - models with configured auth
 *
 * @returns matched model, if unambiguous
 *
 * @example
 * ```typescript
 * findExactModelReferenceMatch({ modelReference: 'anthropic/claude', availableModels });
 * ```
 */
export function findExactModelReferenceMatch<TModel extends ModelIdentity,>(
  {
    modelReference,
    availableModels,
  }: {
    readonly modelReference: string;
    readonly availableModels: readonly TModel[];
  },
): Maybe<TModel> {
  /** Trimmed user reference. */
  const trimmedReference = modelReference.trim();
  if (trimmedReference === '')
    return ABSENT;

  /** Lowercase reference for pi-compatible exact matching. */
  const normalizedReference = trimmedReference.toLowerCase();
  /** Canonical slug matches. */
  const canonicalMatches = availableModels.filter(function matchesCanonical(model,) {
    return canonicalSlug(model,)
      .toLowerCase()
      === normalizedReference;
  },);
  if (canonicalMatches.length
    === 1)
    return canonicalMatches[0] ?? ABSENT;
  if (canonicalMatches.length
    > 1)
    return ABSENT;

  /** Match provider/model form before bare id. */
  const providerMatch = matchProviderModelReference({
    trimmedReference,
    availableModels,
  },);
  if (providerMatch !== ABSENT)
    return providerMatch;

  /** Bare id matches. */
  const idMatches = availableModels.filter(function matchesId(model,) {
    return model.id
      .toLowerCase()
      === normalizedReference;
  },);
  return idMatches.length
    === 1 ? (idMatches[0] ?? ABSENT) : ABSENT;
}

//endregion Public API

//region Internal helpers

/**
 * Match provider/model exact references.
 *
 * @param trimmedReference - trimmed model reference
 *
 * @param availableModels - models with configured auth
 *
 * @returns matched model, if unambiguous
 */
function matchProviderModelReference<TModel extends ModelIdentity,>(
  {
    trimmedReference,
    availableModels,
  }: {
    readonly trimmedReference: string;
    readonly availableModels: readonly TModel[];
  },
): Maybe<TModel> {
  /** Slash index used to parse provider/model references. */
  const slashIndex = trimmedReference.indexOf('/',);
  if (slashIndex === (-1))
    return ABSENT;

  /** Provider segment from a canonical reference. */
  const provider = trimmedReference
    .slice(
      0,
      slashIndex,
    )
    .trim();
  /** Model id segment from a canonical reference. */
  const modelId = trimmedReference
    .slice(slashIndex + 1,)
    .trim();
  if ((provider === '') || (modelId === ''))
    return ABSENT;

  /** Exact provider and model id matches. */
  const providerMatches = availableModels.filter(function matchesProvider(model,) {
    return (model.provider
      .toLowerCase()
      === provider
      .toLowerCase())
      && (model.id
        .toLowerCase()
        === modelId
        .toLowerCase());
  },);
  if (providerMatches.length
    === 1)
    return providerMatches[0] ?? ABSENT;
  return ABSENT;
}

//endregion Internal helpers

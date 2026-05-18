/**
 * Exact model reference matching for Advisor scope reconstruction.
 *
 * @module
 */

import { canonicalSlug, } from './model-slug.ts';
import type { AdvisorReadonlyModel, } from './types.ts';

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
export function findExactModelReferenceMatch(
  {
    modelReference,
    availableModels,
  }: {
    readonly modelReference: string;
    readonly availableModels: readonly AdvisorReadonlyModel[];
  },
): AdvisorReadonlyModel | undefined {
  /** Trimmed user reference. */
  const trimmedReference = modelReference.trim();
  if (trimmedReference === '')
    return undefined;

  /** Lowercase reference for pi-compatible exact matching. */
  const normalizedReference = trimmedReference.toLowerCase();
  /** Canonical slug matches. */
  const canonicalMatches = availableModels.filter(function matchesCanonical(model,) {
    return canonicalSlug(model,).toLowerCase() === normalizedReference;
  },);
  if (canonicalMatches.length === 1)
    return canonicalMatches[0];
  if (canonicalMatches.length > 1)
    return undefined;

  /** Match provider/model form before bare id. */
  const providerMatch = matchProviderModelReference({
    trimmedReference,
    availableModels,
  },);
  if (providerMatch !== undefined)
    return providerMatch;

  /** Bare id matches. */
  const idMatches = availableModels.filter(function matchesId(model,) {
    return model.id.toLowerCase() === normalizedReference;
  },);
  return idMatches.length === 1 ? idMatches[0] : undefined;
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
function matchProviderModelReference(
  {
    trimmedReference,
    availableModels,
  }: {
    readonly trimmedReference: string;
    readonly availableModels: readonly AdvisorReadonlyModel[];
  },
): AdvisorReadonlyModel | undefined {
  /** Slash index used to parse provider/model references. */
  const slashIndex = trimmedReference.indexOf('/',);
  if (slashIndex === (-1))
    return undefined;

  /** Provider segment from a canonical reference. */
  const provider = trimmedReference
    .slice(
      0,
      slashIndex,
    )
    .trim();
  /** Model id segment from a canonical reference. */
  const modelId = trimmedReference.slice(slashIndex + 1,).trim();
  if ((provider === '') || (modelId === ''))
    return undefined;

  /** Exact provider and model id matches. */
  const providerMatches = availableModels.filter(function matchesProvider(model,) {
    return (model.provider.toLowerCase() === provider.toLowerCase())
      && (model.id.toLowerCase() === modelId.toLowerCase());
  },);
  if (providerMatches.length === 1)
    return providerMatches[0];
  return undefined;
}

//endregion Internal helpers

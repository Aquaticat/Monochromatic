/**
 Index of retired catalog identities, shared by both filtering mechanisms.

 Keyed by provider so a wrapper or a plan can test membership in one lookup, and keyed
 by API inside a provider because three ids in pi's bundled catalog are served under two
 APIs by the same provider and must not retire each other.

 @module
 */

import type { Retirement, } from './retirement-rule.ts';

//region Constants

/**
 Separator joining the API and the model id in an index key.

 A control character, so no provider, API, or model id can produce a collision.
 */
const IDENTITY_SEPARATOR = '\u0000';

//endregion Constants

//region Types

/**
 Retired identities grouped by provider.
 */
export type RetiredIndex = ReadonlyMap<string, ReadonlySet<string>>;

//endregion Types

//region Index

/**
 Build the identity key the index stores and queries.

 @param api - API type the entry is served under

 @param modelId - model id exactly as the catalog carries it

 @returns key unique to one API and model id inside a provider

 @example
 ```typescript
 identityKey({ api: 'openai-completions', modelId: 'glm-5.2' });
 ```
 */
export function identityKey(
  {
    api,
    modelId,
  }: {
    readonly api: string;
    readonly modelId: string;
  },
): string {
  return `${api}${IDENTITY_SEPARATOR}${modelId}`;
}

/**
 Group retirements into a per-provider identity index.

 @param retirements - every retirement one rule pass decided

 @returns index mapping a provider to the identities it lost

 @example
 ```typescript
 buildRetiredIndex({ retirements: decision.retirements });
 ```
 */
export function buildRetiredIndex(
  {
    retirements,
  }: {
    readonly retirements: readonly Retirement[];
  },
): RetiredIndex {
  /**
   Index accumulated across the retirements.
   */
  const index = new Map<string, Set<string>>();
  for (const retirement of retirements) {
    /**
     Identities retired on this provider so far.
     */
    const retired = index.get(retirement.provider,) ?? new Set<string>();
    retired.add(identityKey({
      api: retirement.api,
      modelId: retirement.retiredId,
    },),);
    index.set(
      retirement.provider,
      retired,
    );
  }
  return index;
}

/**
 Test whether one catalog identity was retired.

 @param index - index built by {@link buildRetiredIndex}

 @param provider - provider owning the entry

 @param api - API type the entry is served under

 @param modelId - model id to test

 @returns whether the entry should no longer be offered

 @example
 ```typescript
 isRetired({ index, provider: 'hyper', api: 'openai-completions', modelId: 'glm-5.2' }); // true
 ```
 */
export function isRetired(
  {
    index,
    provider,
    api,
    modelId,
  }: {
    readonly index: RetiredIndex;
    readonly provider: string;
    readonly api: string;
    readonly modelId: string;
  },
): boolean {
  /**
   Identities retired on this provider, when it lost any.
   */
  const retired = index.get(provider,);
  if (retired === undefined)
    return false;
  return retired.has(identityKey({
    api,
    modelId,
  },),);
}

//endregion Index

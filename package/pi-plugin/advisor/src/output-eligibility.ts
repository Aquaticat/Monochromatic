/**
 * Advisor model eligibility derived from configured output requirements.
 *
 * @module
 */

import type { ReadonlyDeep, } from 'type-fest';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type {
  EffectiveModelScope,
  ScopedAdvisorModel,
} from './types.ts';

//region Public API

/**
 * Keep scoped models whose endpoint advertises enough output capacity.
 *
 * @param scope - authenticated effective model scope
 *
 * @param maxAdvisorOutputTokens - configured minimum advertised output capacity
 *
 * @returns scope containing only output-eligible models
 *
 * @example
 * ```typescript
 * const eligible = filterAdvisorScopeByOutputCapacity({
 *   scope,
 *   maxAdvisorOutputTokens: 32_000,
 * });
 * ```
 */
export function filterAdvisorScopeByOutputCapacity(
  {
    scope,
    maxAdvisorOutputTokens,
  }: ForeignBorrowed<Readonly<{
    scope: ReadonlyDeep<EffectiveModelScope>;
    maxAdvisorOutputTokens: number;
  }>>,
): EffectiveModelScope {
  return {
    ...scope,
    entries: scope
      .entries
      .filter(function supportsConfiguredOutputCapacity(
        entry: ReadonlyDeep<ScopedAdvisorModel>,
      ): boolean {
        return entry
          .model
          .maxTokens
          >= maxAdvisorOutputTokens;
      },),
  };
}

/**
 * Require at least one scoped model whose endpoint advertises configured output capacity.
 *
 * @param scope - authenticated effective model scope
 *
 * @param maxAdvisorOutputTokens - configured minimum advertised output capacity
 *
 * @returns output-eligible effective scope
 *
 * @throws when every scoped model advertises less than configured requirement
 *
 * @example
 * ```typescript
 * const eligible = requireAdvisorScopeWithOutputCapacity({
 *   scope,
 *   maxAdvisorOutputTokens: 32_000,
 * });
 * ```
 */
export function requireAdvisorScopeWithOutputCapacity(
  {
    scope,
    maxAdvisorOutputTokens,
  }: ForeignBorrowed<Readonly<{
    scope: ReadonlyDeep<EffectiveModelScope>;
    maxAdvisorOutputTokens: number;
  }>>,
): EffectiveModelScope {
  /**
   * Scoped models satisfying configured output requirement.
   */
  const eligibleScope = filterAdvisorScopeByOutputCapacity({
    scope,
    maxAdvisorOutputTokens,
  },);
  if (eligibleScope
    .entries
    .length
    > 0)
    return eligibleScope;

  /**
   * Advertised capacities retained for actionable diagnostics.
   */
  const advertisedCapacities = scope
    .entries
    .map(function formatAdvertisedCapacity(
      entry: ReadonlyDeep<ScopedAdvisorModel>,
    ): string {
      /**
       * Output capacity advertised by current scoped endpoint.
       */
      const advertisedOutputTokens = entry
        .model
        .maxTokens;
      return `${entry.canonicalSlug}=${String(advertisedOutputTokens,)}`;
    },)
    .join(', ',);
  throw new Error(
    `advisor: no scoped models advertise at least ${String(maxAdvisorOutputTokens,)} output tokens. Scoped model capacities: ${advertisedCapacities === '' ? 'none' : advertisedCapacities}`,
  );
}

/**
 * Refuse Advisor endpoint whose advertised output capacity is insufficient.
 *
 * @param endpointSlug - canonical provider and model endpoint identity
 *
 * @param advertisedOutputTokens - endpoint's advertised maximum output
 *
 * @param maxAdvisorOutputTokens - configured minimum advertised output capacity
 *
 * @throws when endpoint advertises less than configured requirement
 *
 * @example
 * ```typescript
 * assertAdvisorEndpointOutputCapacity({
 *   endpointSlug: 'provider/model',
 *   advertisedOutputTokens: 16_000,
 *   maxAdvisorOutputTokens: 32_000,
 * });
 * ```
 */
export function assertAdvisorEndpointOutputCapacity(
  {
    endpointSlug,
    advertisedOutputTokens,
    maxAdvisorOutputTokens,
  }: ForeignBorrowed<Readonly<{
    endpointSlug: string;
    advertisedOutputTokens: number;
    maxAdvisorOutputTokens: number;
  }>>,
): void {
  if (advertisedOutputTokens >= maxAdvisorOutputTokens)
    return;

  throw new Error(
    `advisor: requested model "${endpointSlug}" is ineligible because Advisor requires ${String(maxAdvisorOutputTokens,)} output tokens but its endpoint advertises ${String(advertisedOutputTokens,)} output tokens`,
  );
}

//endregion Public API

/**
 * Advisor model eligibility derived from configured output requirements.
 *
 * @module
 */

import type { ReadonlyDeep, } from 'type-fest';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type {
  AdvisorModelSelection,
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
  if (eligibleScope.entries.length > 0)
    return eligibleScope;

  /**
   * Advertised capacities retained for actionable diagnostics.
   */
  const advertisedCapacities = scope
    .entries
    .map(function formatAdvertisedCapacity(
      entry: ReadonlyDeep<ScopedAdvisorModel>,
    ): string {
      return `${entry.canonicalSlug}=${String(entry.model.maxTokens,)}`;
    },)
    .join(', ',);
  throw new Error(
    `advisor: no scoped models advertise at least ${String(maxAdvisorOutputTokens,)} output tokens. Scoped model capacities: ${advertisedCapacities === '' ? 'none' : advertisedCapacities}`,
  );
}

/**
 * Refuse explicit Advisor selection whose endpoint advertises insufficient output capacity.
 *
 * @param selection - explicit scoped Advisor selection
 *
 * @param maxAdvisorOutputTokens - configured minimum advertised output capacity
 *
 * @throws when selected endpoint advertises less than configured requirement
 *
 * @example
 * ```typescript
 * assertAdvisorModelOutputCapacity({
 *   selection,
 *   maxAdvisorOutputTokens: 32_000,
 * });
 * ```
 */
export function assertAdvisorModelOutputCapacity(
  {
    selection,
    maxAdvisorOutputTokens,
  }: ForeignBorrowed<Readonly<{
    selection: AdvisorModelSelection;
    maxAdvisorOutputTokens: number;
  }>>,
): void {
  /**
   * Output capacity advertised by selected model endpoint.
   */
  const advertisedOutputTokens = selection
    .selected
    .model
    .maxTokens;
  if (advertisedOutputTokens >= maxAdvisorOutputTokens)
    return;

  throw new Error(
    `advisor: requested model "${selection.selected.canonicalSlug}" requires ${String(maxAdvisorOutputTokens,)} output tokens but advertises ${String(advertisedOutputTokens,)} output tokens`,
  );
}

//endregion Public API

import type { RosterModelId, } from './synthetic-catalog.ts';
import type { PreparationOccurrenceExpectation, } from './preparation-occurrence-model.ts';

//region Definition-only evidence without placement authority

/**
 * Ordered definition-node inventory independently registered for the current parent occurrence.
 * The owning journal derives current identities from its frozen scope and allowed target transition.
 *
 * @example
 * ```ts
 * const domain: PreparationDefinitionDomain = { sourceIds: ['block/1'], targetIds: ['block/2'] };
 * ```
 */
export type PreparationDefinitionDomain = {
  /**
   * Complete current source definition inventory within the registered parent.
   */
  readonly sourceIds: readonly string[];
  /**
   * Complete current target definition inventory, not newly chosen after reading ballots.
   */
  readonly targetIds: readonly string[];
};

/**
 * Independently registered occurrence and its complete definition inventory, never inferred from a receipt.
 *
 * @example
 * ```ts
 * const registration: PreparationDefinitionRegistration = { occurrence: expected, domain };
 * ```
 */
export type PreparationDefinitionRegistration = {
  /**
   * Full document, parent, attempt, receipt and request-configuration expectations.
   */
  readonly occurrence: PreparationOccurrenceExpectation;
  /**
   * Current definition-node inventory derived from the frozen scope and permitted target transition.
   */
  readonly domain: PreparationDefinitionDomain;
};

/**
 * Parser-owned endpoint whose label can participate in the deterministic footnote operation only.
 *
 * @example
 * ```ts
 * const endpoint: PreparationDefinitionEndpoint = { nodeId: 'block/1', blockIndex: 1, label: '2' };
 * ```
 */
export type PreparationDefinitionEndpoint = {
  /**
   * Current parser identity, not an initial coordinate reused after a rewrite.
   */
  readonly nodeId: string;
  /**
   * Index local to the exact retained block question.
   */
  readonly blockIndex: number;
  /**
   * Existing parser-readable footnote label, without alias or factual-authority inference.
   */
  readonly label: string;
};

/**
 * Independently endorsed relation restricted to current registered definition endpoints.
 *
 * @example
 * ```ts
 * const relation: PreparationDefinitionRelation = { source, target, authority: 'independent-endorsement' };
 * ```
 */
export type PreparationDefinitionRelation = {
  /**
   * Current source definition.
   */
  readonly source: PreparationDefinitionEndpoint;
  /**
   * Current target definition paired by independent model identities.
   */
  readonly target: PreparationDefinitionEndpoint;
  /**
   * This projection never widens a relation through deterministic media placement.
   */
  readonly authority: 'independent-endorsement';
};

/**
 * Usable current evidence projected to footnotes, not a whole-parent qualification or acquisition certificate.
 * Empty relations mean no endorsed definition correspondence and grant no implicit identity mapping.
 *
 * @example
 * ```ts
 * if (evidence.scope === 'footnote-definitions') useOnlyForFootnoteRelabel(evidence.definitionRelations);
 * ```
 */
export type PreparationDefinitionEvidence = {
  /**
   * Pairing evidence is not factual correctness, officiality or final writer admission.
   */
  readonly qualification: 'pairing-only';
  /**
   * No body pairing, media claim, target decline or archive-prose authority is returned.
   */
  readonly scope: 'footnote-definitions';
  /**
   * Exact owned occurrence binding, not merely a matching local question or node-ID array.
   */
  readonly occurrence: PreparationOccurrenceExpectation;
  /**
   * Historical question key checked against current bytes, not complete receipt identity.
   */
  readonly questionKey: string;
  /**
   * Owned ordered electorate used for replay.
   */
  readonly modelIds: readonly RosterModelId[];
  /**
   * Quorum derived from the configured electorate.
   */
  readonly requiredUsable: number;
  /**
   * Replayed usable replies, not merely heard voices.
   */
  readonly usable: number;
  /**
   * Owned exact current definition inventory independently supplied by the journal.
   */
  readonly domain: PreparationDefinitionDomain;
  /**
   * Only relations retained by native independent agreement with both endpoints in the definition domain.
   */
  readonly definitionRelations: readonly PreparationDefinitionRelation[];
};

//endregion Definition-only evidence without placement authority

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type {
  ArchiveReferenceKind,
  ArchiveUseKind,
  InitialArchiveUse,
} from './archive-naming-model.ts';
import { rosterQuorumSize, } from './roster-quorum-size.ts';

//region Independent occurrence-use evidence
// The original configured electorate decides quorum; pair agreement is unrelated.

/**
 * Occurrence corroboration logger.
 */
const l = tagged({ tag: 'archive-use-corroborate', },);
/**
 * Closed use vocabulary; unknown auxiliary output never acquires authority.
 */
const USE_KINDS: readonly ArchiveUseKind[] = [
  'person-reference-name',
  'group-reference-name',
  'place-reference-name',
  'creative-work-title',
  'mentioned-form',
  'ordinary-prose',
  'unresolved',
];
/**
 * Eligible reference uses, excluding titles and discussed forms.
 */
const REFERENCE_KINDS: readonly ArchiveReferenceKind[] = [
  'person-reference-name',
  'group-reference-name',
  'place-reference-name',
];

/**
 * Initial observation whose independent reading supports one reference use.
 *
 * @example
 * ```ts
 * const { use, kind } = reference;
 * ```
 */
export type CorroboratedArchiveReference = {
  /**
   * Exact observation and unmodified electorate/ballots for audit.
   */
  readonly use: InitialArchiveUse;
  /**
   * Sole quorum-backed kind.
   */
  readonly kind: ArchiveReferenceKind;
};

/**
 * Finds the sole quorum-backed kind while treating malformed readers as abstentions.
 *
 * @param use - one immutable occurrence's configured electorate and observations
 *
 * @param findings - owned output for unavailable or malformed evidence
 *
 * @returns Eligible reference kind, or no naming evidence
 *
 * @example
 * ```ts
 * const kind = referenceKind({ use, findings });
 * ```
 */
function referenceKind({
  use,
  findings,
}: {
  readonly use: InitialArchiveUse;
  readonly findings: string[];
},): ArchiveReferenceKind | undefined {
  /**
   * Configured electorate, including voices that never returned metadata.
   */
  const configured = new Set(use.configuredModelIds,);
  if ((configured.size === 0) || (configured.size
    !== use.configuredModelIds
    .length)
    || configured.has('',)) {
    findings.push(`archive-use-withheld (${use.anchor
      .nodeId}: invalid electorate)`,);
    return undefined;
  }
  /**
   * Repeated reader identities abstain rather than manufacture independent support.
   */
  const multiplicity = new Map<string, number>();
  for (const ballot of use.ballots)
    multiplicity.set(
      ballot.modelId,
      (multiplicity.get(ballot.modelId,) ?? 0) + 1,
    );
  /**
   * Valid unique readings; missing/unknown/duplicate output is not ordinary prose.
   */
  const eligible = use.ballots
    .filter(function eligibleBallot(ballot,): boolean {
    return configured.has(ballot.modelId,) && (multiplicity.get(ballot.modelId,) === 1)
      && USE_KINDS.includes(ballot.kind,);
  },);
  if (eligible.length
    !== use.ballots
    .length)
    findings.push(`archive-use-abstentions (${use.anchor
      .nodeId}: malformed or repeated reader metadata)`,);
  /**
   * Required independent support from the original configured roster.
   */
  const quorum = rosterQuorumSize({ rosterSize: configured.size, },);
  /**
   * Every kind reaching quorum; an even-roster conflict is not silently resolved.
   */
  const corroborated = USE_KINDS.filter(function supportedKind(kind,): boolean {
    return eligible.filter(function sameKind(ballot,): boolean {
      return ballot.kind === kind;
    },)
      .length
      >= quorum;
  },);
  if (corroborated.length !== 1) {
    findings.push(`archive-use-withheld (${use.anchor
      .nodeId}: ${corroborated.length === 0
      ? 'no quorum-backed kind' : 'conflicting quorum-backed kinds'})`,);
    return undefined;
  }
  /**
   * Reference-specific narrowing is the boundary to naming-revision evidence.
   */
  const reference = REFERENCE_KINDS.find(function matchingKind(kind,): boolean {
    return kind === corroborated[0];
  },);
  if (reference === undefined)
    findings.push(`archive-use-withheld (${use.anchor
      .nodeId}: non-reference use ${corroborated[0] ?? 'unresolved'})`,);
  return reference;
}

/**
 * Corroborates initial uses without promoting source identity or naming correctness.
 *
 * @param uses - shell-anchored observations, never generated archive candidates
 *
 * @returns Reference observations and names-only withholding findings
 *
 * @example
 * ```ts
 * const { references, findings } = corroboratedArchiveReferences({ uses });
 * ```
 */
export function corroboratedArchiveReferences({ uses, }: {
  readonly uses: readonly InitialArchiveUse[];
},): {
  readonly references: readonly CorroboratedArchiveReference[];
  readonly findings: readonly string[];
} {
  /**
   * Function-scoped logging without model prose.
   */
  const rl = tagged({
    tag: corroboratedArchiveReferences.name,
    l,
  },);
  /**
   * Owned audit findings retain malformed metadata and withholding reasons.
   */
  const findings: string[] = [];
  /**
   * Only references with one independently corroborated use proceed.
   */
  const references = uses.flatMap(function corroborate(use,): readonly CorroboratedArchiveReference[] {
    /**
     * Naming-eligible kind, absent when classification supplies no authority.
     */
    const kind = referenceKind({
      use,
      findings,
    },);
    return kind === undefined ? [] : [{
      use,
      kind,
    }];
  },);
  rl.debug(`corroborated ${String(references.length,)} of ${String(uses.length,)} initial occurrences`,);
  return {
    references,
    findings,
  };
}

//endregion Independent occurrence-use evidence

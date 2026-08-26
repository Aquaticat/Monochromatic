//region Stage silence
// THE ONE SPELLING of the finding a stage leaves when it heard nobody, and the
// question every cache asks before it keeps or resumes a settlement.
//
// `#238`: the quorum gather never throws on shortfall; it returns
// `stage-quorum-unmet (...)` as a finding, and every silent stage downstream
// lands on an ordinary "unchanged" exit with `heardCritics > 0`, so a slice
// settled during a provider outage was persisted and memoised as "examined and
// found nothing to change", then resumed by every later run. The finding
// travelled with the record; nothing read it. The producer builds the finding
// here and the consumers read it here, so the two cannot drift apart.

/**
 * Opening every quorum-unmet finding carries, followed by the shortfall.
 *
 * @example
 * ```ts
 * const silent = finding.startsWith(STAGE_QUORUM_UNMET_PREFIX,);
 * ```
 */
export const STAGE_QUORUM_UNMET_PREFIX = 'stage-quorum-unmet (';

/**
 * Builds the finding a stage records when fewer voices than quorum answered.
 *
 * @param shortfall - stage and count, such as `critic 2/6`
 *
 * @returns Finding text in the one spelling the caches read
 *
 * @example
 * ```ts
 * findings.push(stageQuorumUnmetFinding({ shortfall: 'critic 2/6', },),);
 * ```
 */
export function stageQuorumUnmetFinding(
  { shortfall, }: { readonly shortfall: string; },
): string {
  return `${STAGE_QUORUM_UNMET_PREFIX}${shortfall})`;
}

/**
 * Findings among the given ones that say a stage heard fewer than quorum.
 *
 * @param findings - findings a settlement carries
 *
 * @returns The quorum-unmet findings, in order, empty when every stage was heard
 *
 * @example
 * ```ts
 * const silent = silentStagesOf({ findings: outcome.findings, },);
 * ```
 */
export function silentStagesOf(
  { findings, }: { readonly findings: readonly string[]; },
): readonly string[] {
  return findings.filter(function saysQuorumUnmet(finding,): boolean {
    return finding.startsWith(STAGE_QUORUM_UNMET_PREFIX,);
  },);
}

/**
 * Whether a settlement was reached with every stage at or above quorum, which
 * is what a cache may keep and a resumed run may trust.
 *
 * A stage that lost some voices but kept quorum still counts as heard; the
 * `stage-voice-lost` findings it leaves are a different number and are not
 * read here.
 *
 * @param findings - findings a settlement carries
 *
 * @returns Whether no stage fell short of quorum
 *
 * @example
 * ```ts
 * if (everyStageHeard({ findings: outcome.findings, },)) await cache.persist(...);
 * ```
 */
export function everyStageHeard(
  { findings, }: { readonly findings: readonly string[]; },
): boolean {
  /**
   * Findings that say a stage fell short.
   */
  const silent = silentStagesOf({ findings, },);
  return silent.length === 0;
}

//endregion Stage silence

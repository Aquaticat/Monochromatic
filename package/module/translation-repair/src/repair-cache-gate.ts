import type { ChunkRepairOutcome, } from './repair-contract.ts';
import { silentStagesOf, } from './stage-silence.ts';

//region Repair cache gate
// WHY A SETTLED SLICE MAY NOT BE CACHED, said as reasons rather than as a
// boolean, so the driver's warn line names what happened.
//
// Two reasons, one old and one from `#238`. No critic heard was always
// refused; a stage that fell short of quorum was not, because it settles on
// an ordinary "unchanged" exit with critics heard and only a finding says
// otherwise. Cached, that finding travelled with a record every later run
// resumed as "examined and found nothing to change".

/**
 * Reasons a settled slice must not be cached, empty when it may be.
 *
 * @param outcome - settlement the driver is about to persist
 *
 * @returns Reasons in the words the warn line prints
 *
 * @example
 * ```ts
 * const refusals = cacheRefusalsOf({ outcome, },);
 * if (refusals.length === 0) await cache.persist(...);
 * ```
 */
export function cacheRefusalsOf(
  { outcome, }: { readonly outcome: ChunkRepairOutcome; },
): readonly string[] {
  if (outcome.heardCritics === 0)
    return ['no critic was heard',];
  return silentStagesOf({ findings: outcome.findings, },)
    .map(function toReason(finding,): string {
      return `a stage heard fewer than quorum (${finding})`;
    },);
}

//endregion Repair cache gate

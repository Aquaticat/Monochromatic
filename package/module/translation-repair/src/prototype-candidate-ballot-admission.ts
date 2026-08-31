// PROTOTYPE ONLY: Candidate I one-candidate ballot admission.

import { assertCandidateBallotBinding, } from './prototype-candidate-ballot-author.ts';
import {
  CandidateBallotAdmissionError,
  assertCandidateBallotEvidence,
} from './prototype-candidate-ballot-evidence.ts';
import { diagnoseCandidateBallotResponse, } from './prototype-candidate-ballot-guard.ts';
import { assertCandidateBallotManifest, } from './prototype-candidate-ballot-manifest.ts';
import type {
  CandidateBallotAuthorSettlement,
  CandidateBallotResponse,
  CandidateBallotManifest,
  CandidateBallotStatusRow,
  CandidateScopedBallot,
} from './prototype-candidate-ballot-model.ts';
import { candidatesFromCandidateBallotSettlement, } from './prototype-candidate-ballot-settlement.ts';
import type { RealizationObligationLedger, } from './prototype-realization-model.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';
import type { RosterModelId, } from './roster-id.ts';

/**
 * Expands one compact string into durable manifest-indexed rows.
 *
 * @returns Rows in status-string order
 */
function expandStatuses({
  statuses,
  scope,
  cleanCode,
}: {
  readonly statuses: string;
  readonly scope: CandidateBallotStatusRow['scope'];
  readonly cleanCode: 'c' | 'p';
}): readonly CandidateBallotStatusRow[] {
  return (function expand(): readonly CandidateBallotStatusRow[] {
    /**
     * Runtime-owned rows.
     */
    const rows: CandidateBallotStatusRow[] = [];
    /**
     * UTF-16 cursor is exact because status alphabet is ASCII.
     */
    let manifestIndex = 0;
    while (manifestIndex < statuses.length) {
      /**
       * Current compact status.
       */
      const status = statuses[manifestIndex];
      if ((status !== cleanCode) && (status !== 'd'))
        throw new Error('candidate ballot admitted status alphabet differs');
      rows.push({
        scope,
        manifestIndex,
        status,
      },);
      manifestIndex += 1;
    }
    return rows;
  })();
}

/**
 * Admits one complete candidate-scoped verifier response or throws.
 *
 * @returns Runtime-bound ballot after structural and semantic admission
 *
 * @example
 * ```ts
 * const ballot = admitCandidateBallotResponse({
 *   response,
 *   ledger,
 *   authorSettlement,
 *   candidateOrdinal,
 *   verifierOrdinal,
 *   verifierModelId,
 *   manifest,
 *   expectedManifestDigest,
 *   shell,
 *   sourceText,
 *   archiveText,
 *   sourcePictures,
 * });
 * ```
 */
export function admitCandidateBallotResponse({
  response,
  ledger,
  authorSettlement,
  candidateOrdinal,
  verifierOrdinal,
  verifierModelId,
  manifest,
  expectedManifestDigest,
  shell,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly response: CandidateBallotResponse;
  readonly ledger: RealizationObligationLedger;
  readonly authorSettlement: CandidateBallotAuthorSettlement;
  readonly candidateOrdinal: number;
  readonly verifierOrdinal: number;
  readonly verifierModelId: RosterModelId;
  readonly manifest: CandidateBallotManifest;
  readonly expectedManifestDigest: string;
  readonly shell: ImmutableShell;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): CandidateScopedBallot {
  assertCandidateBallotManifest({
    manifest,
    ledger,
    shell,
    archiveBody: archiveText,
    expectedManifestDigest,
  },);
  /**
   * Manifest verifier plan at exact ordinal.
   */
  const verifierPlan = manifest.verifierPlan[verifierOrdinal];
  if ((verifierPlan === undefined) || (verifierPlan.modelId !== verifierModelId))
    throw new CandidateBallotAdmissionError({
      failureCategory: 'candidate-binding',
      message: 'candidate ballot verifier identity differs',
    },);
  /**
   * Candidate selected only from total author settlement.
   */
  const candidate = candidatesFromCandidateBallotSettlement({
    settlement: authorSettlement,
    manifest,
  },)
    .find(function ordinal(value,) {
    return value.candidateOrdinal === candidateOrdinal;
  },);
  if (candidate === undefined)
    throw new CandidateBallotAdmissionError({
      failureCategory: 'candidate-binding',
      message: 'candidate ballot author ordinal is unavailable',
    },);
  /**
   * First privacy-safe structural failure category.
   */
  const diagnosis = diagnoseCandidateBallotResponse({
    value: response,
    ledger,
    candidate,
  },);
  if (diagnosis.kind === 'rejected')
    throw new CandidateBallotAdmissionError({
      failureCategory: diagnosis.failure,
      message: 'candidate ballot response shape differs',
    },);
  assertCandidateBallotBinding({
    candidate,
    manifest,
    shell,
    sourceText,
    archiveText,
    sourcePictures,
  },);
  assertCandidateBallotEvidence({
    response,
    candidate,
    ledger,
  });
  return {
    verifierModelId,
    candidateOrdinal,
    manifestDigest: manifest.manifestDigest,
    response,
    statusRows: [
      ...expandStatuses({
        statuses: response.obligationStatuses,
        scope: 'o',
        cleanCode: 'p',
      },),
      ...expandStatuses({
        statuses: response.globalStatuses,
        scope: 'g',
        cleanCode: 'c',
      },),
    ],
  };
}

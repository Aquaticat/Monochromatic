// PROTOTYPE ONLY: Candidate G bounded schema wire witnesses.

import { CONDITIONAL_DEFECT_CLASSES, } from './prototype-conditional-audit-model.ts';
import { realizationAuthorResponseFormat, } from './prototype-realization-author.ts';
import {
  MAX_REALIZATION_FINDING_ANCHORS,
  MAX_REALIZATION_FINDINGS,
  MAX_REALIZATION_TARGET_ANCHORS,
  REALIZATION_GLOBAL_CRITERIA,
  type RealizationAuthorResponse,
  type RealizationObligationLedger,
  type RealizationTargetAnchor,
  type RealizationVerifierResponse,
  type RealizedCandidate,
} from './prototype-realization-model.ts';
import { realizationVerifierResponseFormat, } from './prototype-realization-verifier-schema.ts';
import {
  MAX_SLOT_CHARACTERS,
  type ImmutableShell,
} from './prototype-slot-model.ts';

/**
 * Compact lower and upper stress wire witnesses for one fixed schema shape.
 */
export type RealizationEnvelopeWires = {
  readonly authorLowerWitnessText: string;
  readonly authorUpperStressWitnessText: string;
  readonly verifierLowerWitnessText: string;
  readonly verifierUpperStressWitnessText: string;
  readonly authorSchemaText: string;
  readonly verifierSchemaText: string;
};

/**
 * Longest observed slot key and upper numeric fields accepted by anchor schema.
 */
function stressAnchor({ shell, }: { readonly shell: ImmutableShell; }): RealizationTargetAnchor {
  const slot = shell.slots
    .toSorted(function longest(
      left,
      right,
    ) {
    return right.key
      .length
      - left.key
      .length;
  },)[0];
  if (slot === undefined)
    throw new Error('realization envelope shell has no slot');
  return {
    slotKey: slot.key,
    startOffset: MAX_SLOT_CHARACTERS - 1,
    endOffset: MAX_SLOT_CHARACTERS,
    digest: 'f'.repeat(64,),
  };
}

/**
 * Compact lower author witness accepted by response JSON schema only.
 */
function lowerAuthorResponse({
  shell,
  ledger,
}: {
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
}): RealizationAuthorResponse {
  return {
    slots: shell.slots
      .map(function slot(row,) { return {
        slotKey: row.key,
        text: 'x',
      }; }),
    realization: ledger.obligations
      .map(function claim(obligation,) {
      return {
        obligationId: obligation.id,
        targetAnchors: [],
      };
    },),
  };
}

/**
 * Compact upper author stress witness accepted by response JSON schema only.
 */
function upperStressAuthorResponse({
  shell,
  ledger,
  anchor,
}: {
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly anchor: RealizationTargetAnchor;
}): RealizationAuthorResponse {
  return {
    slots: shell.slots
      .map(function slot(row,) {
      return {
        slotKey: row.key,
        text: '\u0000'.repeat(MAX_SLOT_CHARACTERS,),
      };
    },),
    realization: ledger.obligations
      .map(function claim(obligation,) {
      return {
        obligationId: obligation.id,
        targetAnchors: Array.from(
          { length: MAX_REALIZATION_TARGET_ANCHORS, },
          function target() {
          return anchor;
        },
        ),
      };
    },),
  };
}

/**
 * Anonymous candidate bindings used to instantiate four-candidate verifier schema.
 */
function envelopeCandidates(): readonly RealizedCandidate[] {
  return Array.from(
    { length: 4, },
    function candidate(
      _value,
      index,
    ) {
    return {
      candidateId: `candidate-${String(index,)
        .padStart(
          16,
          '0',
        )}`,
      candidateOrdinal: index,
      manifestDigest: 'a'.repeat(64,),
      modelId: 'hf:Qwen/Qwen3.8-27B',
      priority: index,
      document: '',
      documentDigest: 'b'.repeat(64,),
      slotDigest: 'c'.repeat(64,),
      realizationDigest: 'd'.repeat(64,),
      candidateDigest: String(index,)
        .repeat(64,),
      slots: {},
      realization: {},
    };
  },
  );
}

/**
 * One lower or upper-stress verifier candidate matrix.
 */
function verifierCandidate({
  candidate,
  ledger,
  anchor,
  upperStress,
}: {
  readonly candidate: RealizedCandidate;
  readonly ledger: RealizationObligationLedger;
  readonly anchor: RealizationTargetAnchor;
  readonly upperStress: boolean;
}): RealizationVerifierResponse['candidates'][number] {
  return {
    candidateId: candidate.candidateId,
    candidateDigest: candidate.candidateDigest,
    obligations: ledger.obligations
      .map(function status(obligation,) {
      return {
        obligationId: obligation.id,
        obligationEvidenceDigest: obligation.evidenceDigest,
        status: upperStress ? 'preserved' as const : 'defect' as const,
        verifiedTargetAnchors: upperStress
          ? Array.from(
            { length: MAX_REALIZATION_TARGET_ANCHORS, },
            function target() { return anchor; }
          )
          : [],
      };
    },),
    globalChecks: REALIZATION_GLOBAL_CRITERIA.map(function status(criterion,) {
      return {
        criterion,
        status: upperStress ? 'clean' as const : 'defect' as const,
      };
    },),
    findings: upperStress
      ? Array.from(
        { length: MAX_REALIZATION_FINDINGS, },
        function finding() {
        return {
          scope: 'global' as const,
          criterion: REALIZATION_GLOBAL_CRITERIA.at(-1,) ?? 'register',
          defectClass: CONDITIONAL_DEFECT_CLASSES.at(-1,) ?? 'register',
          targetAnchors: Array.from(
            { length: MAX_REALIZATION_FINDING_ANCHORS, },
            function target() {
            return anchor;
          },
          ),
        };
      },
      )
      : [],
  };
}

/**
 * Serializes bounded compact schema witnesses without optional JSON whitespace.
 */
export function realizationEnvelopeWires({
  shell,
  ledger,
}: {
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
}): RealizationEnvelopeWires {
  const anchor = stressAnchor({ shell, });
  const candidates = envelopeCandidates();
  return {
    authorLowerWitnessText: JSON.stringify(lowerAuthorResponse({
      shell,
      ledger,
    }),),
    authorUpperStressWitnessText: JSON.stringify(upperStressAuthorResponse({
      shell,
      ledger,
      anchor,
    }),),
    verifierLowerWitnessText: JSON.stringify({
      candidates: candidates.map(function candidate(value,) {
        return verifierCandidate({
          candidate: value,
          ledger,
          anchor,
          upperStress: false,
        });
      },),
    },),
    verifierUpperStressWitnessText: JSON.stringify({
      candidates: candidates.map(function candidate(value,) {
        return verifierCandidate({
          candidate: value,
          ledger,
          anchor,
          upperStress: true,
        });
      },),
    },),
    authorSchemaText: JSON.stringify(realizationAuthorResponseFormat({
      shell,
      ledger,
    }),),
    verifierSchemaText: JSON.stringify(realizationVerifierResponseFormat({
      ledger,
      candidates,
    }),),
  };
}

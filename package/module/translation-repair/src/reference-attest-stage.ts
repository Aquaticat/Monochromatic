import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import {
  buildReferenceAttestConfirmMessages,
  confirmedDetails,
  isReferenceAttestConfirmWire,
  REFERENCE_ATTEST_CONFIRM_RESPONSE_FORMAT,
  type ReferenceAttestConfirmWire,
} from './reference-attest-confirm-wire.ts';
import {
  type AttestedDetail,
  attestedDetailLines,
  mergedAttestations,
  type VerifiedAttestation,
  verifiedAttestations,
} from './reference-attest-match.ts';
import {
  buildReferenceAttestMessages,
  isReferenceAttestWire,
  REFERENCE_ATTEST_RESPONSE_FORMAT,
  type ReferenceAttestWire,
} from './reference-attest-wire.ts';
import { rosterQuorumSize, } from './roster-quorum-size.ts';
import { gatherStageVoices, } from './stage-quorum.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Reference attestation stage
// Asks the bench once per entry which archive details a cited reference
// states, checks every quote word for word, and keeps the details enough
// voices gave (class thirty-seven, 2026-09-16). What comes out is both the
// ATTESTED lines every sheet carries under the references and the list the
// repair lane screens addition claims against before the panel.

/**
 What the attestation produced.

 @example
 ```ts
 const { details, lines, findings, } = await attestCitedReferences({ ... },);
 ```
 */
export type ReferenceAttestation = {
  /**
   Details attested by enough voices, in archive order.
   */
  readonly details: readonly AttestedDetail[];
  /**
   Lines the sheets carry for them, one each.
   */
  readonly lines: readonly string[];
  /**
   Quorum and verification findings in scorecard-stable wording.
   */
  readonly findings: readonly string[];
};

/**
 Puts every verified detail to the bench as a yes-or-no candidate and keeps
 those enough voices confirm.
 
 EXTRACTION PROPOSES, CONFIRMATION DISPOSES. A voice that answered the open
 question with an empty list never said the detail is false; it said it
 found none, which on Mio26 four of five voices did in a handful of tokens.
 Shown the quote pair, the same voice reads it. When nothing was extracted
 there is nothing to ask, and when nobody answers the confirmation the
 extraction's own quorum stands, so a silent hour cannot lose a detail the
 open question already carried.
 
 @param client - provider client
 
 @param modelIds - bench asked, the extraction's
 
 @param sourceText - the original document
 
 @param archiveText - the archive rendering as inherited
 
 @param referenceContext - reference lines, one per page
 
 @param candidates - verified details from any voice, numbered in this order
 
 @param extracted - details the extraction quorum alone kept, the fallback
 
 @param signal - the entry's abort
 
 @param exchangeTimeoutMs - per-call timeout
 
 @param l - stage logger
 
 @returns Details to attest and the findings of the round
 
 @example
 ```ts
 const { details, confirmFindings, } = await confirmCandidates({ client, modelIds, sourceText, archiveText, referenceContext, candidates, extracted, signal, exchangeTimeoutMs, l, },);
 ```
 
 @internal
 */
async function confirmCandidates(
  {
    client,
    modelIds,
    sourceText,
    archiveText,
    referenceContext,
    candidates,
    extracted,
    signal,
    exchangeTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly modelIds: readonly RosterModelId[];
    readonly sourceText: string;
    readonly archiveText: string;
    readonly referenceContext: string;
    readonly candidates: readonly AttestedDetail[];
    readonly extracted: readonly AttestedDetail[];
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<{
  readonly details: readonly AttestedDetail[];
  readonly confirmFindings: readonly string[];
}> {
  if (candidates.length === 0) {
    return {
      details: extracted,
      confirmFindings: [],
    };
  }
  /**
   Quorum-bounded confirmation replies.
   */
  const gather = await gatherStageVoices<ReferenceAttestConfirmWire>({
    client,
    modelIds,
    messages: buildReferenceAttestConfirmMessages({
      sourceText,
      archiveText,
      referenceContext,
      candidates,
    },),
    signal,
    exchangeTimeoutMs,
    responseFormat: REFERENCE_ATTEST_CONFIRM_RESPONSE_FORMAT,
    validate: isReferenceAttestConfirmWire,
    stage: 'reference-attest-confirm',
    l,
  },);
  /**
   Voices heard on the confirmation.
   */
  const heard = gather.voices
    .length;
  if (heard === 0) {
    l.warn(
      `ATTESTED CONFIRM heard=0 candidates=${String(candidates.length,)}: nobody answered, the extraction quorum stands`,
    );
    return {
      details: extracted,
      confirmFindings: [
        ...gather.findings,
        'reference attestation confirmation heard nobody; the extraction quorum stands',
      ],
    };
  }
  /**
   Distinct confirming voices a candidate needs: half the heard bench,
   rounded up.
   */
  const needed = rosterQuorumSize({ rosterSize: heard, },);
  /**
   Candidates confirmed by enough voices.
   */
  const details = confirmedDetails({
    candidates,
    ballots: gather.voices
      .map(function toBallot(voice,) {
        return {
          modelId: voice.modelId,
          confirmed: voice.value
            .confirmed,
        };
      },),
    needed,
  },);
  l.info(
    `ATTESTED CONFIRM heard=${String(heard,)} candidates=${String(candidates.length,)} needed=${
      String(needed,)
    } confirmed=${String(details.length,)}`,
  );
  return {
    details,
    confirmFindings: [
      ...gather.findings,
      `reference attestation confirmed ${String(details.length,)} of ${String(candidates.length,)} candidates by ${
        String(heard,)
      } voices`,
    ],
  };
}

/**
 Asks the bench which archive details a cited reference states and keeps the
 ones enough voices attested with quotes that verify.

 @param client - provider client

 @param modelIds - bench asked

 @param sourceText - the original document

 @param archiveText - the archive rendering as inherited

 @param referenceContext - reference lines, one per page

 @param signal - the entry's abort

 @param exchangeTimeoutMs - per-call timeout

 @param l - entry logger

 @returns Attested details, their sheet lines and findings

 @example
 ```ts
 const attestation = await attestCitedReferences({ client, modelIds, sourceText, archiveText, referenceContext, signal, exchangeTimeoutMs, l, },);
 ```
 */
export async function attestCitedReferences(
  {
    client,
    modelIds,
    sourceText,
    archiveText,
    referenceContext,
    signal,
    exchangeTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly modelIds: readonly RosterModelId[];
    readonly sourceText: string;
    readonly archiveText: string;
    readonly referenceContext: string;
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<ReferenceAttestation> {
  /**
   Logger pre-tagged with this function's name.
   */
  const al = tagged({
    tag: attestCitedReferences.name,
    l,
  },);
  /**
   Quorum-bounded replies.
   */
  const gather = await gatherStageVoices<ReferenceAttestWire>({
    client,
    modelIds,
    messages: buildReferenceAttestMessages({
      sourceText,
      archiveText,
      referenceContext,
    },),
    signal,
    exchangeTimeoutMs,
    responseFormat: REFERENCE_ATTEST_RESPONSE_FORMAT,
    validate: isReferenceAttestWire,
    stage: 'reference-attest',
    l: al,
  },);
  /**
   Voices heard.
   */
  const heard = gather.voices
    .length;
  /**
   Items whose quotes verify, from every voice.
   */
  const verified: readonly VerifiedAttestation[] = gather.voices
    .flatMap(function verifiedOf(voice,): readonly VerifiedAttestation[] {
      return verifiedAttestations({
        modelId: voice.modelId,
        items: voice.value
          .attested,
        archiveText,
        referenceContext,
      },);
    },);
  for (const entry of verified) {
    /**
     Item this voice gave.
     */
    const { item, } = entry;
    al.info(
      `ATTESTED item ${entry.modelId}: "${item.archiveQuote}" is stated by reference ${
        String(item.reference,)
      } ("${item.referenceQuote}")`,
    );
  }
  /**
   Items answered in all, verified or not.
   */
  const answered = gather.voices
    .map(function countOf(voice,): number {
      return voice.value
        .attested
        .length;
    },)
    .reduce(
      function sum(
        total,
        count,
      ): number {
        return total + count;
      },
      0,
    );
  /**
   Distinct voices a detail needs: half the heard bench, rounded up.
   */
  const needed = rosterQuorumSize({ rosterSize: heard, },);
  /**
   Details enough voices gave to the open question alone.
   */
  const extracted = mergedAttestations({
    verified,
    archiveText,
    heard,
    needed,
  },);
  /**
   Every verified detail, one voice or more, as a candidate for the
   confirmation round (class forty-three).
   */
  const candidates = mergedAttestations({
    verified,
    archiveText,
    heard,
    needed: 1,
  },);
  /**
   Details after the confirmation round, or the extraction's own when there
   is nothing to confirm or nobody answers.
   */
  const {
    details,
    confirmFindings,
  } = await confirmCandidates({
    client,
    modelIds,
    sourceText,
    archiveText,
    referenceContext,
    candidates,
    extracted,
    signal,
    exchangeTimeoutMs,
    l: al,
  },);
  /**
   Lines the sheets carry.
   */
  const lines = attestedDetailLines({ details, },);
  al.info(
    `ATTESTED heard=${String(heard,)} answered=${String(answered,)} verified=${String(verified.length,)} needed=${
      String(needed,)
    } details=${String(details.length,)}`,
  );
  for (const line of lines)
    al.info(line,);
  return {
    details,
    lines,
    findings: [
      ...gather.findings,
      ...confirmFindings,
      ...((answered === verified.length)
        ? []
        : [`reference attestation discarded ${String(answered - verified.length,)} of ${
          String(answered,)
        } items whose quotes were not found word for word`,]),
    ],
  };
}

//endregion Reference attestation stage

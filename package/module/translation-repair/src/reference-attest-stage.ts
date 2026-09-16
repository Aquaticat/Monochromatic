import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
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
   Details enough voices gave.
   */
  const details = mergedAttestations({
    verified,
    archiveText,
    heard,
    needed,
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
      ...((answered === verified.length)
        ? []
        : [`reference attestation discarded ${String(answered - verified.length,)} of ${
          String(answered,)
        } items whose quotes were not found word for word`,]),
    ],
  };
}

//endregion Reference attestation stage

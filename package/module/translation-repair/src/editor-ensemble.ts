import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  applyPatchOperations,
  type PreservationMode,
  type PatchOperation,
  type PatchOutcome,
} from './apply-patch.ts';
import {
  type Candidate,
  describeProducer,
  producerModelIds,
} from './candidate-select-model.ts';
import { selectBestCandidate, } from './candidate-select.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import type { EditableEnvelope, } from './patch-model.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Editor ensemble
// Several editors rewrite the same chunk, and judges that wrote none of the
// candidates choose what ships. The editor was previously the ONE stage where a
// single model decided alone, which the user ruled out: no single model should
// control any part of the pipeline.
//
// Selection runs at BOTH granularities, by user decision, because each catches
// what the other misses:
//
// - Per envelope, the best fix for each individual issue can win even when the
//   model that wrote it botched the rest of the chunk.
// - Per chunk, whole candidates compete, which is the only level at which
//   coherence across envelopes is visible at all.
//
// The per-envelope winners are assembled into a COMPOSITE candidate that then
// competes at chunk level against the whole-chunk candidates. That is what keeps
// best-of-breed assembly honest: a composite stitched from several models is
// text no model wrote or read as a whole, so it has to win on its merits against
// candidates that were written coherently, rather than being adopted by
// construction.
//
// Proposals are read from each candidate's APPLIED operations, not from what its
// model proposed. The deterministic gate rejects stale hashes, drifted
// envelopes, and no-op replacements, so judging pre-gate text would spend model
// calls choosing between operations that cannot ship.

/**
 * Characters of translation shown on each side of an envelope so judges can
 * assess register and tense against real neighbouring prose.
 */
const ENVELOPE_CONTEXT_CHARS = 400;

/**
 * Renders the translation around one envelope, with the region under
 * replacement marked rather than removed.
 *
 * Judges are asked whether a replacement fits its surroundings in register and
 * tense. Handed only the replacement text and the Chinese source, that
 * criterion is unanswerable: the surroundings are exactly what is missing. The
 * window is bounded because whole chunks run to thousands of characters and
 * every judge pays for them on every envelope.
 *
 * @param targetText - translation chunk text
 *
 * @param envelope - region being replaced
 *
 * @returns Bounded window with the replaced region marked
 *
 * @example
 * ```ts
 * const context = envelopeContext({ targetText, envelope, },);
 * ```
 */
function envelopeContext(
  {
    targetText,
    envelope,
  }: {
    readonly targetText: string;
    readonly envelope: EditableEnvelope;
  },
): string {
  /**
   * Translation before the envelope, bounded to the context window.
   */
  const before = targetText.slice(
    Math.max(
      0,
      envelope.startOffset - ENVELOPE_CONTEXT_CHARS,
    ),
    envelope.startOffset,
  );

  /**
   * Translation after the envelope, bounded to the context window.
   */
  const after = targetText.slice(
    envelope.endOffset,
    envelope.endOffset + ENVELOPE_CONTEXT_CHARS,
  );
  return `${before}[[PASSAGE BEING REPLACED]]${after}`;
}

/**
 * One editor's proposal for a chunk.
 *
 * @example
 * ```ts
 * const candidate: EditorCandidate = { modelId, patch, };
 * ```
 */
export type EditorCandidate = {
  /**
   * Model that produced this proposal.
   */
  readonly modelId: SyntheticModelId;

  /**
   * Apply-gate outcome of the operations it proposed.
   */
  readonly patch: PatchOutcome;
};

/**
 * What per-envelope selection assembled, with the counts that say how much of
 * the composite was actually voted on.
 *
 * @example
 * ```ts
 * const { operations, contributors, } = await selectPerEnvelope({ ... },);
 * ```
 */
export type EnvelopeSelection = {
  /**
   * Winning operation per envelope, in envelope order.
   */
  readonly operations: readonly PatchOperation[];

  /**
   * Models whose operations the composite carries, in first-win order.
   */
  readonly contributors: readonly SyntheticModelId[];

  /**
   * Envelopes adopted without a vote because only one editor proposed for
   * them, counting envelopes where every proposal was identical.
   */
  readonly soleCount: number;

  /**
   * Envelopes decided by a judged vote.
   */
  readonly judgedCount: number;

  /**
   * Envelopes left unedited because judges declined every proposal.
   */
  readonly declinedCount: number;

  /**
   * Degradation findings from every judge fan-out this pass ran.
   *
   * Carried up rather than logged because the caller writes findings into the
   * per-entry artifact, and a log line only exists if something captured it.
   * The counts above say how many envelopes were decided which way; they do
   * not say which judge went silent, and that identity is what every
   * voice-loss diagnosis has turned on.
   */
  readonly findings: readonly string[];
};

/**
 * Chooses one replacement text per envelope by judging the distinct proposals
 * models made for it, then assembles the winners into one operation set.
 *
 * An envelope only one model proposed for needs no vote: there is nothing to
 * compare it against, and it still faces the chunk-level judges afterwards.
 *
 * @param client - injected model client
 *
 * @param candidates - editor proposals, in roster order
 *
 * @param envelopes - envelopes of this chunk
 *
 * @param judgeModelIds - whole roster; producers are removed downstream
 *
 * @param sourceText - original chunk text, evidence for judges
 *
 * @param targetText - translation chunk text, for the surrounding context each
 * replacement has to fit
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - pipeline logger
 *
 * @returns Composite operation set built from per-envelope winners
 *
 * @example
 * ```ts
 * const composite = await selectPerEnvelope({ client, candidates, envelopes, ... },);
 * ```
 */
export async function selectPerEnvelope(
  {
    client,
    candidates,
    envelopes,
    judgeModelIds,
    sourceText,
    targetText,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly candidates: readonly EditorCandidate[];
    readonly envelopes: readonly EditableEnvelope[];
    readonly judgeModelIds: readonly SyntheticModelId[];
    readonly sourceText: string;
    readonly targetText: string;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<EnvelopeSelection> {
  /**
   * Logger tagged with this selection pass.
   */
  const el = tagged({
    tag: selectPerEnvelope.name,
    l,
  },);

  /**
   * Winning operation per envelope, filled in envelope order.
   */
  const winners: PatchOperation[] = [];

  /**
   * Contributing models in first-win order, deduplicated by `seen`.
   */
  const contributors: SyntheticModelId[] = [];

  /**
   * Models already credited as contributors.
   */
  const seen = new Set<SyntheticModelId>();

  /**
   * Degradation findings gathered from every envelope's judge fan-out.
   */
  const selectionFindings: string[] = [];

  /**
   * How each envelope was decided.
   */
  const counters = {
    sole: 0,
    judged: 0,
    declined: 0,
  };
  for (const envelope of envelopes) {
    /**
     * Every distinct APPLIED proposal for this envelope, first proposer
     * winning ties on identical text so the set stays deduplicated.
     */
    const proposals: Candidate<PatchOperation>[] = [];
    for (const candidate of candidates) {
      /**
       * This model's applied operation for this envelope, when it has one.
       */
      const operation = candidate.patch
        .applied
        .find(function forEnvelope(op,) {
          return op.envelopeId === envelope.envelopeId;
        },);
      if (operation === undefined)
        continue;
      if (proposals.some(function sameText(existing,) {
        return existing.value
          .newText
          === operation.newText;
      },))
        continue;
      proposals.push({
        producer: {
          kind: 'model',
          modelId: candidate.modelId,
        },
        value: operation,
        rendered: operation.newText,
      },);
    }

    if (proposals.length === 0)
      continue;

    /**
     * Sole distinct proposal, adopted without a vote because there is nothing
     * to compare it against; chunk-level judging still sees it.
     */
    const [sole,] = proposals;
    if ((proposals.length === 1) && (sole !== undefined)) {
      counters.sole += 1;
      winners.push(sole.value,);
      for (const modelId of producerModelIds(sole.producer,)) {
        if (seen.has(modelId,))
          continue;
        seen.add(modelId,);
        contributors.push(modelId,);
      }
      continue;
    }

    /**
     * Judges verdict over the distinct proposals for this envelope.
     */
    /* oxlint-disable-next-line no-await-in-loop -- envelopes are judged sequentially so per-model concurrency stays at one, which the measured provider serialization requires */
    const outcome = await selectBestCandidate({
      client,
      candidates: proposals,
      judgeModelIds,
      task:
        'Each candidate replaces the SAME passage of an English translation of the Chinese ORIGINAL below.',
      criteria: [
        'Faithfulness to the ORIGINAL: no content added, dropped, or altered in meaning.',
        'Natural, idiomatic English that carries the ORIGINAL\'s feeling.',
        'Fits the surrounding text in register and tense.',
      ],
      evidence: [
        {
          label: 'ORIGINAL (Chinese)',
          text: sourceText,
        },
        {
          label: 'PASSAGE BEING REPLACED (current English)',
          text: envelope.baseText,
        },
        {
          label: 'SURROUNDING ENGLISH, for register and tense only',
          text: envelopeContext({
            targetText,
            envelope,
          },),
        },
      ],
      signal,
      perCallTimeoutMs,
      l,
    },);
    selectionFindings.push(...outcome.findings,);
    if (outcome.kind === 'declined') {
      counters.declined += 1;
      el.info(
        `envelope ${envelope.envelopeId}: ${outcome.reason}; leaving it unedited in the composite`,
      );
      continue;
    }
    counters.judged += 1;
    winners.push(outcome.value,);
    for (const modelId of producerModelIds(outcome.producer,)) {
      if (seen.has(modelId,))
        continue;
      seen.add(modelId,);
      contributors.push(modelId,);
    }
  }
  return {
    operations: winners,
    contributors,
    soleCount: counters.sole,
    judgedCount: counters.judged,
    declinedCount: counters.declined,
    findings: selectionFindings,
  };
}

/**
 * Patch that ships, with the findings from judging it.
 *
 * Wrapped rather than widening `PatchOutcome`, which is shared across the apply
 * path: putting a telemetry field there would attach it to every operation
 * result in the pipeline. The wrapper keeps the reporting local to the stage
 * that produced it.
 *
 * @example
 * ```ts
 * const { patch, findings, } = await selectChunkPatch({ client, candidates, ... },);
 * ```
 */
export type ChunkPatchSelection = {
  /**
   * Winning patch, or the fallback when judges decline.
   */
  readonly patch: PatchOutcome;

  /**
   * Degradation findings from the judge fan-out, empty when no vote was held.
   */
  readonly findings: readonly string[];
};

/**
 * Judges whole-chunk candidates and returns the patch that ships.
 *
 * @param client - injected model client
 *
 * @param candidates - whole-chunk proposals including the composite
 *
 * @param judgeModelIds - whole roster; producers are removed downstream
 *
 * @param sourceText - original chunk text, evidence for judges
 *
 * @param indecisionFallback - patch adopted when judges answered but failed to
 * converge; callers must pass a patch that actually repairs something
 *
 * @param rejectionFallback - patch adopted when judges affirmatively found no
 * candidate acceptable; normally the untouched translation
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - pipeline logger
 *
 * @returns Winning patch, or the fallback when judges decline, plus the
 * judge fan-out findings for the caller to carry into the artifact
 *
 * @example
 * ```ts
 * const patch = await selectChunkPatch({ client, candidates, fallback, ... },);
 * ```
 */
export async function selectChunkPatch(
  {
    client,
    candidates,
    judgeModelIds,
    sourceText,
    indecisionFallback,
    rejectionFallback,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly candidates: readonly Candidate<PatchOutcome>[];
    readonly judgeModelIds: readonly SyntheticModelId[];
    readonly sourceText: string;
    readonly indecisionFallback: PatchOutcome;
    readonly rejectionFallback: PatchOutcome;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<ChunkPatchSelection> {
  /**
   * Logger tagged with this selection pass.
   */
  const cl = tagged({
    tag: selectChunkPatch.name,
    l,
  },);

  /**
   * Sole candidate, which needs no vote.
   *
   * Callers deduplicate by rendered text before calling, so one candidate here
   * means every editor and the composite agreed on the same text. That is
   * unanimity rather than an unexamined survivor, and the text still faces the
   * resolution checkers and the unchanged-versus-repaired selection after this.
   */
  const [sole,] = candidates;
  if ((candidates.length === 1) && (sole !== undefined)) {
    cl.info(`every proposal was identical; shipping ${describeProducer(sole.producer,)} unjudged`,);
    // No judges were asked, so there is no fan-out to report on.
    return {
      patch: sole.value,
      findings: [],
    };
  }

  /**
   * Judges verdict over the whole-chunk candidates.
   */
  const outcome = await selectBestCandidate({
    client,
    candidates,
    judgeModelIds,
    task:
      'Each candidate is a full English translation of the Chinese ORIGINAL below, after repairs were applied.',
    criteria: [
      'Faithfulness to the ORIGINAL: no content added, dropped, or altered in meaning.',
      'Natural, idiomatic English reading as one coherent passage, not as stitched fragments.',
      'Consistent voice, tense, and terminology across the whole passage.',
    ],
    evidence: [
      {
        label: 'ORIGINAL (Chinese)',
        text: sourceText,
      },
    ],
    signal,
    perCallTimeoutMs,
    l,
  },);
  if (outcome.kind === 'declined') {
    // Judges failing to RANK the candidates says nothing against any of them,
    // and dropping every repair over that would turn a disagreement about
    // wording into a recall loss. The repair is not unexamined either: the
    // checkers and then `selectRepairCandidate` still make it beat the
    // untouched text on measurements before it can ship.
    //
    // Judges REJECTING every candidate is the opposite: a substantive verdict
    // that none of this is good enough. Shipping a repair over that would
    // overrule the panel rather than route around its silence.
    if (outcome.disposition === 'indecision') {
      cl.info(`${outcome.reason}; shipping the strongest repair anyway`,);
      return {
        patch: indecisionFallback,
        findings: outcome.findings,
      };
    }
    cl.info(`${outcome.reason}; shipping no repair for this chunk`,);
    return {
      patch: rejectionFallback,
      findings: outcome.findings,
    };
  }
  cl.info(
    `chunk patch from ${describeProducer(outcome.producer,)} won ${String(outcome.votes,)} of ${
      String(outcome.tally
        .ballots,)
    } ballots`,
  );
  return {
    patch: outcome.value,
    findings: outcome.findings,
  };
}

/**
 * Applies one candidate's operations, so a composite can be scored the same way
 * a model's own proposal is.
 *
 * @param targetText - translation chunk text
 *
 * @param envelopes - envelopes of this chunk
 *
 * @param operations - operations to apply
 *
 * @returns Apply-gate outcome
 *
 * @example
 * ```ts
 * const patch = applyCandidate({ targetText, envelopes, operations, },);
 * ```
 */
export function applyCandidate(
  {
    targetText,
    envelopes,
    operations,
    preservation,
  }: {
    readonly targetText: string;
    readonly envelopes: readonly EditableEnvelope[];
    readonly operations: readonly PatchOperation[];
    readonly preservation: PreservationMode;
  },
): PatchOutcome {
  return applyPatchOperations({
    targetText,
    envelopes,
    operations,
    preservation,
  },);
}

//endregion Editor ensemble

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import { hashContent, } from './document-node.ts';
import { restoreTypography, } from './restore-typography.ts';
import type { EditableEnvelope, } from './patch-model.ts';

//region Patch application
// The deterministic gate between editor output and the candidate text.
// Every operation must name a known envelope, echo its base hash, and
// actually change the region; anything else is a rejection recorded as
// data. Overlapping envelopes are a construction bug upstream, never editor
// weather, so they throw instead of rejecting.

/**
 * One edit an editor proposes: replace one envelope's content wholesale.
 * Replacing a zero-width envelope inserts; an empty replacement deletes.
 *
 * @example
 * ```ts
 * const operation: PatchOperation = {
 *   envelopeId: 'envelope/abc',
 *   baseHash: envelope.baseHash,
 *   newText: 'The cat naps on the warm windowsill.',
 * };
 * ```
 */
export type PatchOperation = {
  /**
   * Envelope the edit targets.
   */
  readonly envelopeId: string;

  /**
   * Echo of the envelope's base hash, proving the editor wrote against
   * the text it replaces.
   */
  readonly baseHash: string;

  /**
   * Replacement for the whole envelope content.
   */
  readonly newText: string;
};

/**
 * One rejected operation with its scorecard-stable reason.
 *
 * @example
 * ```ts
 * const rejection: PatchRejection = { operation, reason: 'stale-base-hash', };
 * ```
 */
export type PatchRejection = {
  /**
   * Operation as proposed.
   */
  readonly operation: PatchOperation;

  /**
   * Which gate refused and why, in scorecard-stable wording.
   */
  readonly reason: string;
};

/**
 * Everything patch application decided.
 *
 * @example
 * ```ts
 * const outcome: PatchOutcome = applyPatchOperations({ targetText, envelopes, operations, },);
 * ```
 */
export type PatchOutcome = {
  /**
   * Translation with every accepted operation applied.
   */
  readonly patchedText: string;

  /**
   * Operations that passed every gate, in input order.
   */
  readonly applied: readonly PatchOperation[];

  /**
   * Operations refused, each with its reason, in input order.
   */
  readonly rejected: readonly PatchRejection[];
};

/**
 * Thrown when envelopes overlap: derivation guarantees disjoint envelopes,
 * so an overlap is a construction bug the caller must fix, not editor
 * output to tolerate.
 *
 * @example
 * ```ts
 * throw new EnvelopeOverlapError({ leftId: 'envelope/a', rightId: 'envelope/b', },);
 * ```
 */
export class EnvelopeOverlapError extends Error {
  /**
   * Builds the overlap report from the two colliding envelope ids.
   *
   * @param leftId - envelope earlier in document order
   *
   * @param rightId - envelope overlapping it
   */
  constructor(
    {
      leftId,
      rightId,
    }: {
      readonly leftId: string;
      readonly rightId: string;
    },
  ) {
    super(`editable envelopes overlap: ${leftId} and ${rightId}`,);
    this.name = 'EnvelopeOverlapError';
  }
}

/**
 * Applies editor operations to the translation through every deterministic
 * gate. Gates per operation, in order: the envelope must exist, only one
 * operation may claim it, the echoed base hash must match, the document
 * region must still equal the envelope base, and the replacement must
 * actually change the region. Accepted operations apply in descending
 * document order so earlier offsets stay valid.
 *
 * @param targetText - full translation the envelopes were derived from
 *
 * @param envelopes - non-overlapping envelopes in any order
 *
 * @param operations - editor proposals in wire order
 *
 * @returns Patched text plus applied and rejected operations as data
 *
 * @throws {@link EnvelopeOverlapError} when two envelopes overlap
 *
 * @example
 * ```ts
 * const { patchedText, rejected, } = applyPatchOperations({ targetText, envelopes, operations, },);
 * ```
 */
export function applyPatchOperations(
  {
    targetText,
    envelopes,
    operations,
  }: {
    readonly targetText: string;
    readonly envelopes: readonly EditableEnvelope[];
    readonly operations: readonly PatchOperation[];
  },
): PatchOutcome {
  /**
   * Envelopes in document order for the overlap check.
   */
  const ordered = [...envelopes,].toSorted(function byStart(
    left,
    right,
  ) {
    return left.startOffset - right.startOffset;
  },);
  for (const [index, envelope,] of ordered.entries()) {
    /**
     * Envelope following this one in document order, when present.
     */
    const next = ordered[index + 1];
    if ((next !== undefined) && (next.startOffset < envelope.endOffset)) {
      throw new EnvelopeOverlapError({
        leftId: envelope.envelopeId,
        rightId: next.envelopeId,
      },);
    }
  }

  /**
   * Envelopes keyed by id for operation lookup.
   */
  const byId = new Map(envelopes.map(function toEntry(envelope,) {
    return [
      envelope.envelopeId,
      envelope,
    ] as const;
  },),);

  /**
   * Operations that passed every gate, in input order.
   */
  const applied: PatchOperation[] = [];

  /**
   * Refusals in input order.
   */
  const rejected: PatchRejection[] = [];

  /**
   * Envelope ids already claimed by an accepted operation.
   */
  const claimed = new Set<string>();
  for (const operation of operations) {
    /**
     * Envelope the operation targets, when known.
     */
    const envelope = byId.get(operation.envelopeId,);
    if (envelope === undefined) {
      rejected.push({
        operation,
        reason: 'unknown-envelope',
      },);
      continue;
    }
    if (claimed.has(operation.envelopeId,)) {
      rejected.push({
        operation,
        reason: 'duplicate-operation',
      },);
      continue;
    }
    if (operation.baseHash !== envelope.baseHash) {
      rejected.push({
        operation,
        reason: 'stale-base-hash',
      },);
      continue;
    }

    /**
     * Text currently occupying the envelope region in the document.
     */
    const current = targetText.slice(
      envelope.startOffset,
      envelope.endOffset,
    );
    if ((current !== envelope.baseText)
      || (hashContent({ content: current, },) !== envelope.baseHash))
    {
      rejected.push({
        operation,
        reason: 'envelope-drift',
      },);
      continue;
    }
    if (operation.newText === envelope.baseText) {
      rejected.push({
        operation,
        reason: 'unchanged-region',
      },);
      continue;
    }
    claimed.add(operation.envelopeId,);
    // Quote style is restored deterministically before the operation is
    // recorded as applied. Editors flatten curly quotes to straight ones often
    // enough that a repaired paragraph ends up reading differently from every
    // paragraph around it, and the difference accumulates with each edit.
    // Recording the restored text rather than what the editor wrote keeps the
    // region's record equal to what shipped.
    //
    // The convention comes from the WHOLE text, not the replaced region alone.
    // Regions run to a median of 75 characters, so most carry no quote to learn
    // from, and a region-scoped rule stays silent exactly when an editor writes
    // a fresh contraction into a curly-quoted document.
    applied.push({
      ...operation,
      newText: restoreTypography({
        replacement: operation.newText,
        replaced: envelope.baseText,
        convention: targetText,
      },),
    },);
  }

  /**
   * Accepted operations in descending document order,
   * so applying one never shifts the offsets of those still pending.
   */
  const applyOrder = [...applied,].toSorted(function byStartDescending(
    left,
    right,
  ) {
    /**
     * Envelope of the left operation, present because acceptance proved it.
     */
    const leftEnvelope = nonNullishOrThrow(byId.get(left.envelopeId,),);

    /**
     * Envelope of the right operation, present because acceptance proved it.
     */
    const rightEnvelope = nonNullishOrThrow(byId.get(right.envelopeId,),);
    return rightEnvelope.startOffset - leftEnvelope.startOffset;
  },);

  /**
   * Translation rebuilt envelope by envelope.
   */
  const patchedText = applyOrder.reduce(
    function applyOne(
      text: string,
      operation,
    ): string {
      /**
       * Envelope of this accepted operation, present by acceptance.
       */
      const envelope = nonNullishOrThrow(byId.get(operation.envelopeId,),);
      return text.slice(
        0,
        envelope.startOffset,
      )
        + operation.newText
        + text.slice(envelope.endOffset,);
    },
    targetText,
  );

  return {
    patchedText,
    applied,
    rejected,
  };
}

//endregion Patch application

//region Preparation receipt and occurrence refusals

/**
 * Closed failures of receipt binding or current occurrence reconstruction.
 *
 * @example
 * ```ts
 * const kind: PreparationReceiptFailure = 'question';
 * ```
 */
export type PreparationReceiptFailure = 'state' | 'binding' | 'question' | 'outcomes' | 'documents' | 'parent';

/**
 * Fixed messages never quote receipt values, document text or model responses.
 */
const RECEIPT_MESSAGES: Readonly<Record<PreparationReceiptFailure, string>> = {
  state: 'Preparation receipt is not a complete supported question record. Retain incomplete evidence for audit, but do not reuse it or promote a historical cache record.',
  binding: 'Preparation receipt does not match the independently supplied acquisition plan, attempt, receipt reference or configuration. Reopen the intended journal and verify its registered binding before any provider call.',
  question: 'Preparation receipt answers different numbered blocks, messages or response schema. Use only an authorized matching current-attempt receipt or a separately reviewed registered acquisition slot.',
  outcomes: 'Preparation receipt does not contain valid final asked-seat records for its configured electorate. Rebuild from the exact retained outcomes; do not invent missing ballots or trust aggregate counts.',
  documents: 'Current preparation documents do not match their independently supplied hashes. Rebuild from the frozen corpus and allowed deterministic target transition before reading receipt evidence.',
  parent: 'Current preparation parent does not match its registered indexes or requires no model question. Rebuild the frozen occurrence; do not substitute another parent or manufacture a question receipt for structural dispatch.',
};

/**
 * Privacy-safe refusal that prevents receipt data from choosing its own authority.
 *
 * @example
 * ```ts
 * throw new PreparationReceiptError({ kind: 'binding', });
 * ```
 */
export class PreparationReceiptError extends Error {
  /**
   * Messages consist only of authored operation and recovery guidance.
   */
  public readonly messageNamesOnly: true = true;
  /**
   * Failed binding family, without private document or reply content.
   */
  public readonly kind: PreparationReceiptFailure;

  /**
   * Builds the fixed diagnostic for one failed journal invariant.
   *
   * @param kind - failed receipt or occurrence condition
   *
   * @example
   * ```ts
   * new PreparationReceiptError({ kind: 'documents', });
   * ```
   */
  public constructor({ kind, }: { readonly kind: PreparationReceiptFailure; },) {
    super(RECEIPT_MESSAGES[kind],);
    this.name = 'PreparationReceiptError';
    this.kind = kind;
  }
}

//endregion Preparation receipt and occurrence refusals

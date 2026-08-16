import type { SliceDeliveryRecord, } from './slice-delivery.ts';

//region Delivery coherence
// The rule tying one row's DELIVERY to the rest of the row, for readers that
// did not build it.
//
// `buildSliceDelivery` decides these four cases and can only produce coherent
// ones. It is not the only way a row reaches a consumer: the type is exported,
// the lane comparison takes ledgers from a caller, and an artifact reader takes
// them from disk. At each of those the builder's guarantee is somebody else's
// assumption, and a row that contradicts itself is individually well formed in
// every field.
//
// So the four cases are stated once here as a rule, and every boundary that
// accepts a row rather than building one asserts it.

/**
 * Raised when a row's delivery contradicts the wording beside it.
 *
 * @example
 * ```ts
 * throw new DeliveryCoherenceError({ message: 'slice 4 ships wording it never decided', },);
 * ```
 */
export class DeliveryCoherenceError extends Error {
  /**
   * Builds the refusal naming the slice and the contradiction.
   *
   * @param message - what the row claims that cannot all be true
   *
   * @example
   * ```ts
   * throw new DeliveryCoherenceError({ message: 'slice 4 ships wording it never decided', },);
   * ```
   */
  constructor({ message, }: { readonly message: string; },) {
    super(message,);
    this.name = 'DeliveryCoherenceError';
  }
}

/**
 * Refuses a shipped or withdrawn row whose decision cannot support it.
 *
 * Both cases need the same two things and differ only in which text the
 * document ends up with, so they are checked together rather than twice.
 *
 * @param record - row being checked
 *
 * @param at - slice name for the message
 *
 * @param carries - which text this delivery leaves the document with
 *
 * @throws {@link DeliveryCoherenceError} when the row decided nothing, decided
 * the archive's own wording, or carries text the delivery does not allow
 *
 * @example
 * ```ts
 * assertReplacementRow({ record, at, carries: 'incumbent', },);
 * ```
 */
function assertReplacementRow(
  {
    record,
    at,
    carries,
  }: {
    readonly record: SliceDeliveryRecord;
    readonly at: string;
    readonly carries: 'accepted' | 'incumbent';
  },
): void {
  if (record.outcome
    .kind
    !== 'decided') {
    throw new DeliveryCoherenceError({
      message: `${at} reports a replacement and an outcome of ${
        record.outcome
          .kind
      }, so there is no decision for the delivery to describe`,
    },);
  }
  if (record.outcome
    .acceptedText
    === record.incumbentText) {
    throw new DeliveryCoherenceError({
      message: `${at} reports a replacement whose wording is the archive's own, so nothing was replaced`,
    },);
  }
  /**
   * Text this delivery leaves the document with, which the check above proves
   * the decision can supply.
   */
  const expected = (carries === 'accepted')
    ? record.outcome
      .acceptedText
    : record.incumbentText;
  if (record.shippedText !== expected) {
    throw new DeliveryCoherenceError({
      message: `${at} reports a delivery whose text is not the one that delivery carries`,
    },);
  }
}

/**
 * Refuses a row that keeps the archive while hiding a decision to change it.
 *
 * @param record - row being checked
 *
 * @param at - slice name for the message
 *
 * @throws {@link DeliveryCoherenceError} when a changed decision sits behind an
 * unchanged document with nothing saying what took it back
 *
 * @example
 * ```ts
 * assertNothingHidden({ record, at, },);
 * ```
 */
function assertNothingHidden(
  {
    record,
    at,
  }: {
    readonly record: SliceDeliveryRecord;
    readonly at: string;
  },
): void {
  /**
   * What the lane decided here, if anything.
   */
  const { outcome, } = record;
  if ((outcome.kind === 'decided') && (outcome.acceptedText !== record.incumbentText)) {
    throw new DeliveryCoherenceError({
      message: `${at} decided wording of its own and reports the document unchanged, with nothing `
        + 'saying what took the decision back',
    },);
  }
}

/**
 * Refuses a delivery row whose four fields cannot describe one slice.
 *
 * @param record - one row of a delivery ledger, from wherever it came
 *
 * @throws {@link DeliveryCoherenceError} when the delivery, the outcome, the
 * archive state and the shipped text cannot all be true at once
 *
 * @example
 * ```ts
 * assertDeliveryCoherent({ record, },);
 * ```
 */
export function assertDeliveryCoherent(
  { record, }: { readonly record: SliceDeliveryRecord; },
): void {
  /**
   * Slice being checked, named in every message so a failure points at a row.
   */
  const at = `slice ${String(record.chunkIndex,)}`;

  /**
   * What the document ended up with here.
   */
  const { delivery, } = record;
  if (delivery.kind === 'replacement-shipped') {
    assertReplacementRow({
      record,
      at,
      carries: 'accepted',
    },);
    return;
  }
  if (delivery.kind === 'replacement-withdrawn') {
    assertReplacementRow({
      record,
      at,
      carries: 'incumbent',
    },);
    return;
  }
  if (delivery.kind === 'incumbent-retained') {
    if (record.incumbentKind === 'absent') {
      throw new DeliveryCoherenceError({
        message: `${at} reports the archive's wording retained where the archive holds none`,
      },);
    }
    if (record.shippedText !== record.incumbentText) {
      throw new DeliveryCoherenceError({
        message: `${at} reports the archive's wording retained and carries different text`,
      },);
    }
    assertNothingHidden({
      record,
      at,
    },);
    return;
  }
  if (record.incumbentKind === 'present') {
    throw new DeliveryCoherenceError({
      message: `${at} reports a gap where the archive holds wording`,
    },);
  }
  if ((record.incumbentText !== '') || (record.shippedText !== '')) {
    throw new DeliveryCoherenceError({
      message: `${at} reports a gap and carries wording anyway`,
    },);
  }
  assertNothingHidden({
    record,
    at,
  },);
}

//endregion Delivery coherence

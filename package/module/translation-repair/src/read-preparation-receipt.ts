import { isDeepStrictEqual, } from 'node:util';
import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import { isJsonRecord, } from './json-guard.ts';
import { assertPairingSeats, } from './pair-blocks-evidence-identity.ts';
import {
  type BlockPairingWire,
  isBlockPairingWire,
} from './pair-blocks-wire.ts';
import { PreparationReceiptError, } from './preparation-receipt-error.ts';
import type {
  PreparationReceiptBinding,
  PreparationReceiptQuestion,
} from './preparation-receipt-model.ts';
import type { RoundOutcome, } from './stage-round.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Terminal receipt reading
// This checks declared data against independent expectations. Journal origin and transport provenance belong to its owner.

/**
 * Checks the whole own-key inventory, including keys JSON serialization would silently discard.
 *
 * @param value - record whose schema has already been identified
 *
 * @param keys - exact fields supported by this data version
 *
 * @returns Whether the record contains precisely the supported own fields
 *
 * @example
 * ```ts
 * const exact = receiptKeys({ value, keys: ['modelId', 'voice'], });
 * ```
 */
function receiptKeys({
  value,
  keys,
}: {
  readonly value: Record<string, unknown>;
  readonly keys: readonly string[]
},): boolean {
  /**
   * Whole own inventory, not just enumerable string keys.
   */
  const actual = Reflect.ownKeys(value,);
  return (Object.getPrototypeOf(value,) === Object.prototype)
    && (actual.length === keys.length)
    && actual.every(function known(key,): boolean { return ((typeof key) === 'string') && keys.includes(key,); },);
}

/**
 * Reads one final voice without interpreting range validity or silently dropping unknown voice fields.
 *
 * @param value - unknown persisted seat record
 *
 * @param modelIds - independently configured electorate
 *
 * @returns Owned seat record retaining heard-invalid semantic wire for the existing pairing reader
 *
 * @throws PreparationReceiptError when a seat does not have the supported runtime shape
 *
 * @example
 * ```ts
 * const seat = receiptOutcome({ value, modelIds, });
 * ```
 */
function receiptOutcome({
  value,
  modelIds,
}: {
  readonly value: unknown;
  readonly modelIds: readonly RosterModelId[]
},): RoundOutcome<BlockPairingWire> {
  if ((!isJsonRecord(value,)) || (!receiptKeys({
    value,
    keys: [
      'modelId',
      'voice'
    ],
  },)))
    throw new PreparationReceiptError({ kind: 'outcomes', },);
  /**
   * Only an identity already registered by the caller can be reconstructed.
   */
  const modelId = modelIds.find(function registered(candidate,): boolean {
    return candidate === value.modelId;
  },);
  if (modelId === undefined)
    throw new PreparationReceiptError({ kind: 'outcomes', },);
  /**
   * Voice discriminant and fields remain unknown until both branches have been checked.
   */
  const {voice} = value;
  if (!isJsonRecord(voice,))
    throw new PreparationReceiptError({ kind: 'outcomes', },);
  if (voice.heard === true) {
    if ((!receiptKeys({
      value: voice,
      keys: [
        'heard',
        'value'
      ],
    },)) || (!isBlockPairingWire(voice.value,)))
      throw new PreparationReceiptError({ kind: 'outcomes', },);
    return {
      modelId,
      voice: {
        heard: true,
        value: structuredClone(voice.value,),
      },
    };
  }
  if ((voice.heard !== false)
    || (!receiptKeys({
      value: voice,
      keys: [
        'heard',
        'answered',
        'unreachable'
      ],
    },))
    || ((typeof voice.answered) !== 'boolean')
    || ((typeof voice.unreachable) !== 'boolean'))
    throw new PreparationReceiptError({ kind: 'outcomes', },);
  return {
    modelId,
    voice: {
      heard: false,
      answered: voice.answered,
      unreachable: voice.unreachable,
    },
  };
}

/**
 * Reads raw final outcomes only after namespace, configuration and current question match independent expectations.
 * Neither this operation nor its returned outcomes certify transmission, usable quorum or final writer scope.
 *
 * @param value - parsed journal receipt, never a historical pairing cache record
 *
 * @param binding - authorized receipt reference and actual configuration supplied by the owning plan
 *
 * @param question - exact question reconstructed from current parser-owned parent blocks
 *
 * @param l - caller logger retaining the registered occurrence scope
 *
 * @returns Owned final outcomes in the actual recorded asked order
 *
 * @throws PreparationReceiptError when record state, binding, question or seat shapes disagree
 *
 * @throws PairingEvidenceError when configured or asked identities do not form an independent ordered electorate
 *
 * @example
 * ```ts
 * const outcomes = readPreparationReceipt({ value, binding, question, l, });
 * ```
 */
export function readPreparationReceipt({
  value,
  binding,
  question,
  l,
}: {
  readonly value: unknown;
  readonly binding: PreparationReceiptBinding;
  readonly question: PreparationReceiptQuestion;
  readonly l: Logger;
},): readonly RoundOutcome<BlockPairingWire>[] {
  /**
   * Retained occurrence scope around metadata and electorate verification.
   */
  const pl = tagged({
    tag: readPreparationReceipt.name,
    l,
  },);
  pl.debug('checking terminal receipt namespace, question and final seat records',);
  assertPairingSeats({
    modelIds: binding.modelIds,
    l: pl,
  },);
  /**
   * Empty namespace labels cannot authenticate one another by equality.
   */
  const labels = [
    binding.acquisitionPlanDigest,
    binding.attemptId,
    binding.receiptId,
    binding.pipelineDigest,
    binding.requestConfigurationDigest
  ];
  if (labels.some(function missing(label,): boolean {
    return ((typeof label) !== 'string') || (label.trim().length === 0);
  },))
    throw new PreparationReceiptError({ kind: 'binding', },);
  if ((!isJsonRecord(value,))
    || (!receiptKeys({
      value,
      keys: [
        'version',
        'state',
        'binding',
        'question',
        'outcomes'
      ],
    },))
    || (value.version !== 1)
    || (value.state !== 'complete'))
    throw new PreparationReceiptError({ kind: 'state', },);
  if (!isDeepStrictEqual(
    value.binding,
    binding,
  ))
    throw new PreparationReceiptError({ kind: 'binding', },);
  if (!isDeepStrictEqual(
    value.question,
    question,
  ))
    throw new PreparationReceiptError({ kind: 'question', },);
  if ((!Array.isArray(value.outcomes,)) || (value.outcomes
    .length
    === 0)
    || (value.outcomes
      .length
      > binding.modelIds
      .length))
    throw new PreparationReceiptError({ kind: 'outcomes', },);
  /**
   * Reconstructed voices cannot carry aggregate fields or invent missing seats.
   */
  const outcomes = value.outcomes
    .map(function read(seat: unknown,): RoundOutcome<BlockPairingWire> {
    return receiptOutcome({
      value: seat,
      modelIds: binding.modelIds,
    },);
  },);
  assertPairingSeats({
    modelIds: binding.modelIds,
    askedModelIds: outcomes.map(function asked(outcome,): RosterModelId { return outcome.modelId; },),
    l: pl,
  },);
  pl.debug(`read ${String(outcomes.length,)} final seat records without inferring qualification`,);
  return outcomes;
}

//endregion Terminal receipt reading

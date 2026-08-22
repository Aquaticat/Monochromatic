import type {
  ConsolidationSettlement,
  ConsolidationTerminal,
} from '../consolidate-settle.ts';
import {
  type GateBallot,
  isGateChoice,
} from '../consolidate-gate-wire.ts';
import type { SliceCache, } from '../slice-cache.ts';
import { isJsonRecord, } from '../json-guard.ts';
import {
  CONSOLIDATE_NAMESPACE,
  openNamespacedCache,
} from './slice-cache-namespace.ts';

//region Consolidate cache store
// Resuming a settlement an earlier run already bought for a contested slice.
//
// SEPARATE FROM THE CONTEST STORE, for the reason that store gives about the
// lanes: a settlement is not a contest, it is bought after one has already
// decided what stands, over the two lanes and the standing text together. It
// shares the entry directory and retires with the entry.
//
// THE SHAPE IS CHECKED DOWN TO THE BALLOT, following the contest store, and
// here it matters more than there. A settlement carries `text` that SHIPS: the
// record built from it hands that text to the assembly whenever the terminal
// says a consolidation won. So this store is the one path on which bytes read
// off disk become corpus text in an artifact, and a file that was corrupted,
// hand-edited, or written by a different schema would carry them there with
// nothing else in the way. Refusing it costs one re-asked slice.

/**
 * Ways a settlement can leave the stage, as the terminal names them.
 *
 * SPELLED OUT RATHER THAN INFERRED, because this is a stored value: a union
 * gaining a member should make an older cache file readable, not silently
 * widen what this accepts to whatever the current source happens to say.
 */
const SETTLEMENT_TERMINALS: readonly ConsolidationTerminal[] = [
  'incumbent-only',
  'no-standing-text',
  'slate-kept-standing',
  'gate-kept-standing',
  'wrap-erased-difference',
  'consolidated',
];

/**
 * Whether a value is one judge`s gate ballot as this schema writes it.
 *
 * @param value - parsed cache entry
 *
 * @returns Whether it is a readable ballot
 *
 * @example
 * ```ts
 * const readable = isGateBallot(parsed,);
 * ```
 */
function isGateBallot(value: unknown,): value is GateBallot {
  if (!isJsonRecord(value,))
    return false;

  /**
   * Renderings this judge called unsupported, before any is known to name one.
   */
  const { unsupported, } = value;

  /**
   * Renderings this judge called incomplete, before any is known to name one.
   */
  const { dropped, } = value;
  return isGateChoice(value.choice,)
    && Array.isArray(unsupported,)
    && unsupported.every(function namesRendering(one,): boolean {
      return isGateChoice(one,);
    },)
    && Array.isArray(value.unsupportedRaw,)
    && Array.isArray(dropped,)
    && dropped.every(function namesRendering(one,): boolean {
      return isGateChoice(one,);
    },)
    && Array.isArray(value.droppedRaw,)
    && ((typeof value.reason) === 'string');
}

/**
 * Whether a value is one proposal`s structural verdict.
 *
 * @param value - parsed cache entry
 *
 * @returns Whether it is a readable verdict
 *
 * @example
 * ```ts
 * const readable = isProposalVerdict(parsed,);
 * ```
 */
function isProposalVerdict(value: unknown,): boolean {
  return isJsonRecord(value,)
    && ((typeof value.modelId) === 'string')
    && ((value.kind === 'valid') || (value.kind === 'invalid'))
    && Array.isArray(value.findings,);
}

/**
 * Whether a value is what the validity floor made of a slate.
 *
 * @param value - parsed cache entry
 *
 * @returns Whether it is a readable floor
 *
 * @example
 * ```ts
 * const readable = isSlateFloor(parsed,);
 * ```
 */
function isSlateFloor(value: unknown,): boolean {
  if (!isJsonRecord(value,))
    return false;
  if (value.kind === 'proposals')
    return Array.isArray(value.validModelIds,);
  return (value.kind === 'incumbent-only') && Array.isArray(value.refusedModelIds,);
}

/**
 * Whether a value is what the gate settled, or nothing at all.
 *
 * ABSENT IS VALID and is not the same as empty. A slice the floor stopped never
 * reached the gate, so its settlement carries no gate; a gate that ran and
 * heard nobody carries one with no ballots. The terminal tells them apart, and
 * a store that required the key would refuse every floored slice.
 *
 * @param value - parsed cache entry
 *
 * @returns Whether it is a readable gate outcome or absent
 *
 * @example
 * ```ts
 * const readable = isGateOutcomeOrAbsent(parsed.gate,);
 * ```
 */
function isGateOutcomeOrAbsent(value: unknown,): boolean {
  if (value === undefined)
    return true;
  if (!isJsonRecord(value,))
    return false;

  /**
   * Ballots the file carries, before any of them is known to be one.
   */
  const { ballots, } = value;
  return isGateChoice(value.choice,)
    && ((value.ships === 'consolidated') || (value.ships === 'standing'))
    && Array.isArray(ballots,)
    && ballots.every(isGateBallot,)
    && ((typeof value.usable) === 'number')
    && (value.usable === ballots.length)
    && Array.isArray(value.findings,);
}

/**
 * Whether a value is a settlement as this schema writes it.
 *
 * `decided` IS NOT CHECKED BEYOND BEING A RECORD. It is the translate stage`s
 * own result, checked by that stage when it was produced, and nothing this
 * store feeds reads more than its `decision`. Re-deriving its whole shape here
 * would duplicate a contract that lives elsewhere and would refuse valid files
 * whenever that contract gained a field.
 *
 * @param value - parsed cache entry
 *
 * @returns Whether it is this schema`s settlement
 *
 * @example
 * ```ts
 * if (isConsolidationSettlement(parsed,)) resumed.set(key, parsed,);
 * ```
 */
function isConsolidationSettlement(value: unknown,): value is ConsolidationSettlement {
  if (!isJsonRecord(value,))
    return false;

  /**
   * Judged round the file carries, absent where no slate reached the judges.
   */
  const { decided, } = value;

  /**
   * Verdicts the file carries, before any of them is known to be one.
   */
  const { verdicts, } = value;

  /**
   * Terminal the file names, before it is known to be one this schema writes.
   */
  const { terminal, } = value;

  /**
   * Whether that terminal is a way this stage can actually leave.
   */
  const named = SETTLEMENT_TERMINALS.some(function matches(known,): boolean {
    return known === terminal;
  },);
  return named
    && ((typeof value.text) === 'string')
    && isSlateFloor(value.floor,)
    && Array.isArray(verdicts,)
    && verdicts.every(isProposalVerdict,)
    && ((decided === undefined) || isJsonRecord(decided,))
    && isGateOutcomeOrAbsent(value.gate,)
    && ((typeof value.rewrapped) === 'boolean')
    && ((typeof value.demoted) === 'boolean');
}

/**
 * Opens the per-entry store of settlements already bought.
 *
 * @param dir - per-entry slice-cache directory
 *
 * @param generation - pipeline this run belongs to
 *
 * @returns Cache of settlements, keyed by slice hash
 *
 * @example
 * ```ts
 * const cache = await openConsolidateCache({ dir: entryCacheDir, generation: pipelineDigest, },);
 * ```
 */
export async function openConsolidateCache(
  {
    dir,
    generation,
  }: {
    readonly dir: string;
    readonly generation: string;
  },
): Promise<SliceCache<ConsolidationSettlement>> {
  return await openNamespacedCache({
    dir,
    generation,
    namespace: CONSOLIDATE_NAMESPACE,
    isValue: isConsolidationSettlement,
  },);
}

//endregion Consolidate cache store

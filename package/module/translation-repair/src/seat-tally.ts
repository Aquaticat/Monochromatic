import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type {
  ChatJsonOutcome,
  ChatJsonRequest,
  ChatTextReply,
  ChatTextRequest,
  SyntheticClient,
} from './chat-contract.ts';
import type { RosterModelId, } from './roster-id.ts';

//region Seat tally
// WHAT EVERY SEAT WAS ASKED AND WHAT IT GAVE BACK, counted at the client seam
// and said out loud once, when the command ends.
//
// `#235` ran a four-slice calibration in which five of ten seats failed every
// call they made, 25 of 25 each, and the command exited 0. Quorum is five of
// ten and was met on the nose by the other five. The calibration's closing
// coverage sentence did name the five seats, but as "wrote nothing at all",
// which is also what a seat that was outvoted every round looks like from
// there, and the pass and the other thirty-six commands print nothing of the
// kind. A per-call `warn` and a per-round `5/10 heard` were both correct and
// both invisible to a reader who was not grepping.
//
// THIS IS THE ONE PLACE EVERY CALL PASSES. The client every corpus-run command
// uses is built by one factory, so wrapping it here reaches all of them at
// once, and the report is printed by the refusal boundary they all share. A
// seat is DARK when it was asked at least once and never once produced a usable
// answer, which is the signature of a provider that cannot serve it, a key that
// was never injected, or a model that answers nothing readable; a seat that
// simply lost some rounds is not dark and is not reported here.
//
// PROCESS-SCOPED, LIKE `process.exitCode`. A calibration builds one client per
// slice, so a tally held by a client would end with the slice; the fact being
// counted is about the whole command, and the singleton is what a whole-command
// fact looks like. Tests that need isolation pass their own tally.

/**
 * What one call to a seat came back as.
 *
 * `usable` is text returned or a JSON outcome of kind `ok`; `unusable` is a
 * JSON outcome the guard rejected (refusal-shaped or off-schema); `threw` is a
 * call that never returned an outcome at all.
 *
 * @example
 * ```ts
 * const outcome: SeatOutcome = 'threw';
 * ```
 */
export type SeatOutcome = 'usable' | 'unusable' | 'threw';

/**
 * Counts for one seat over the life of the tally.
 *
 * @example
 * ```ts
 * const dark = counts.filter(function isDark(count,) { return count.usable === 0; },);
 * ```
 */
export type SeatCount = {
  /**
   * Seat these counts describe.
   */
  readonly modelId: RosterModelId;

  /**
   * Calls made, whatever came back.
   */
  readonly asked: number;

  /**
   * Calls that returned text or an `ok` outcome.
   */
  readonly usable: number;

  /**
   * Calls that returned an outcome the guard rejected.
   */
  readonly unusable: number;

  /**
   * Calls that threw instead of returning.
   */
  readonly threw: number;
};

/**
 * Running counts per seat, with the two readings the report needs.
 *
 * @example
 * ```ts
 * const tally = createSeatTally();
 * tally.record({ modelId: 'minimax-m3', outcome: 'threw', },);
 * ```
 */
export type SeatTally = {
  /**
   * Counts one settled call.
   */
  readonly record: (args: {
    readonly modelId: RosterModelId;
    readonly outcome: SeatOutcome;
  },) => void;

  /**
   * Every seat asked at least once, in first-asked order.
   */
  readonly counts: () => readonly SeatCount[];

  /**
   * Seats asked at least once that never produced a usable answer.
   */
  readonly dark: () => readonly SeatCount[];

  /**
   * Forgets every count, for a new command in the same process.
   */
  readonly reset: () => void;
};

/**
 * Mutable counts behind one seat.
 */
type SeatCounter = {
  asked: number;
  usable: number;
  unusable: number;
  threw: number;
};

/**
 * Builds an empty tally.
 *
 * @returns Tally counting from zero
 *
 * @example
 * ```ts
 * const tally = createSeatTally();
 * ```
 */
export function createSeatTally(): SeatTally {
  /**
   * Counter per seat, keyed by model id, in first-asked order.
   */
  const counters = new Map<RosterModelId, SeatCounter>();

  /**
   * Returns the seat's counter, creating it on first use.
   *
   * @param modelId - seat being counted
   *
   * @returns Counter to increment
   *
   * @example
   * ```ts
   * counterFor('minimax-m3',).asked += 1;
   * ```
   */
  function counterFor(modelId: RosterModelId,): SeatCounter {
    /**
     * Existing counter when this seat was asked before.
     */
    const existing = counters.get(modelId,);
    if (existing !== undefined)
      return existing;

    /**
     * Fresh counter for a seat's first call.
     */
    const created: SeatCounter = {
      asked: 0,
      usable: 0,
      unusable: 0,
      threw: 0,
    };
    counters.set(
      modelId,
      created,
    );
    return created;
  }

  /**
   * Snapshot of every counter as immutable counts.
   *
   * @returns Counts in first-asked order
   *
   * @example
   * ```ts
   * const all = snapshot();
   * ```
   */
  function snapshot(): readonly SeatCount[] {
    return [...counters.entries(),].map(function toCount([modelId, counter,],): SeatCount {
      return {
        modelId,
        asked: counter.asked,
        usable: counter.usable,
        unusable: counter.unusable,
        threw: counter.threw,
      };
    },);
  }

  return {
    record({
      modelId,
      outcome,
    },): void {
      /**
       * Counter for the seat this call went to.
       */
      const counter = counterFor(modelId,);
      counter.asked += 1;
      if (outcome === 'usable')
        counter.usable += 1;
      else if (outcome === 'unusable')
        counter.unusable += 1;
      else
        counter.threw += 1;
    },
    counts: snapshot,
    dark(): readonly SeatCount[] {
      return snapshot()
        .filter(function producedNothingUsable(count,): boolean {
          return (count.asked > 0) && (count.usable === 0);
        },);
    },
    reset(): void {
      counters.clear();
    },
  };
}

/**
 * Tally shared by every client the corpus-run factory builds in this process.
 *
 * @example
 * ```ts
 * const darkSeats = RUN_SEATS.dark();
 * ```
 */
export const RUN_SEATS: SeatTally = createSeatTally();

/**
 * Wraps a client so every call it makes is counted against its seat.
 *
 * COUNTS AFTER THE CALL SETTLES, never before, so a call still in flight when
 * the process ends is not counted as anything. The wrapped client is otherwise
 * untouched: the same reply, the same outcome, the same throw.
 *
 * @param inner - client whose calls are counted
 *
 * @param tally - where the counts go
 *
 * @returns Client with the same surface, counting into `tally`
 *
 * @example
 * ```ts
 * const counted = seatTallyClient({ inner: client, tally: RUN_SEATS, },);
 * ```
 */
export function seatTallyClient(
  {
    inner,
    tally,
  }: {
    readonly inner: SyntheticClient;
    readonly tally: SeatTally;
  },
): SyntheticClient {
  return {
    async chatText(request: ForeignBorrowed<ChatTextRequest>,): Promise<ChatTextReply> {
      try {
        /**
         * Reply from the wrapped client.
         */
        const reply = await inner.chatText(request,);
        tally.record({
          modelId: request.modelId,
          outcome: 'usable',
        },);
        return reply;
      }
      catch (error) {
        tally.record({
          modelId: request.modelId,
          outcome: 'threw',
        },);
        throw error;
      }
    },
    async chatJson<ValueT,>(
      request: ForeignBorrowed<ChatJsonRequest<ValueT>>,
    ): Promise<ChatJsonOutcome<ValueT>> {
      try {
        /**
         * Outcome from the wrapped client, usable only when `ok`.
         */
        const outcome = await inner.chatJson(request,);
        tally.record({
          modelId: request.modelId,
          outcome: (outcome.kind === 'ok') ? 'usable' : 'unusable',
        },);
        return outcome;
      }
      catch (error) {
        tally.record({
          modelId: request.modelId,
          outcome: 'threw',
        },);
        throw error;
      }
    },
    quotas: inner.quotas,
  };
}

/**
 * Renders the tally as the lines a command prints when it ends.
 *
 * ONE LINE PER SEAT, then one line naming the dark seats when there are any.
 * Nothing at all when no seat was asked, so a command that never built a
 * client prints nothing extra. Model ids and numbers only.
 *
 * @param tally - counts to render
 *
 * @returns Lines in print order, empty when nothing was asked
 *
 * @example
 * ```ts
 * for (const line of seatReportLines({ tally: RUN_SEATS, },)) console.error(line,);
 * ```
 */
export function seatReportLines(
  { tally, }: { readonly tally: SeatTally; },
): readonly string[] {
  /**
   * Every seat asked this run.
   */
  const counts = tally.counts();
  if (counts.length === 0)
    return [];

  /**
   * Seats that never produced a usable answer.
   */
  const dark = tally.dark();

  /**
   * One line per seat, whatever it produced.
   */
  const perSeat = counts.map(function toLine(count,): string {
    return `SEAT ${count.modelId} asked=${String(count.asked,)} usable=${String(count.usable,)} `
      + `unusable=${String(count.unusable,)} threw=${String(count.threw,)}`;
  },);

  if (dark.length === 0)
    return perSeat;

  /**
   * Dark seats with the counts that make them dark.
   */
  const named = dark
    .map(function describe(count,): string {
      return `${count.modelId} (asked ${String(count.asked,)}, unusable ${
        String(count.unusable,)
      }, threw ${String(count.threw,)})`;
    },)
    .join('; ',);

  /**
   * The one line a reader who is not grepping must see.
   */
  const darkLine = `SEATS DARK: ${String(dark.length,)} of ${String(counts.length,)} seats asked `
    + `produced nothing usable this run: ${named}. A seat that fails every call is a provider that `
    + 'cannot serve it, a key that was never injected, or a model that answers nothing readable; '
    + 'the run log names which. Do not read this run as a comparison of the roster.';

  return [
    ...perSeat,
    darkLine,
  ];
}

//endregion Seat tally

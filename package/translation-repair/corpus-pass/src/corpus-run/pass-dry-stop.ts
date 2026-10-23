import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  durationWordsOf,
  EveryProviderDryError,
  type ModelClient,
} from '@monochromatic-dev/translation-repair-provider/ts';
import { monotonicMs, } from '@monochromatic-dev/translation-repair-markup/ts';
import { refusalText, } from '@monochromatic-dev/translation-repair-document-structure/ts';
import { contextRoot, } from '@monochromatic-dev/translation-repair-typography/ts';

//region Pass dry stop
// THE RUN-LEVEL STOP FOR EVERY PROVIDER DRY. The owner ruled that the router's `EveryProviderDryError` "ENDS THE RUN"
// and that a run always ships what it has. XingZ6018 (2026-10-22) instead lost that error as one seat's voice in
// every round for 77 s, until the bench floor stopped it mid-entry with `status=ERROR`.
//
// THE STOP IS THE SPEND CEILING'S, NOT THE BENCH FLOOR'S. The queue asks `stopBeforeNext` before each attempt
// (`runAttemptQueue`), so a run stopped here starts no further entry, queues no second attempt, and the pages of
// every entry already settled stay shipped. The bench floor ends an entry from the inside as an error, which the
// queue then re-attempts or stalls on.
//
// THE MECHANISM IS AN ABORT. The pass hands every entry a signal that this gate aborts with the refusal as the
// reason, so every call in flight under it ends at once and each layer's "abort wins" rule carries the refusal out
// as it does a user's stop, none of them mistaking it for a timeout or a lost voice. The queue's seam then reads
// the gate and prints the one stop line.
//
// TWO WAYS IN, ONE TRIP. A guarded call that meets the dry router trips it before the refusal propagates. An entry
// the refusal reached some other way (the seat reading finds every provider dry before any chat call is made, or a
// layer re-raises it past the signal) hands it over at the entry's own catch (`trip`), so the pass stops however the
// refusal arrived. Either way the gate logs one line when it trips and hands out its stop note once.
//
// A REFUSAL THAT NAMES A RETURN THE PASS CAN USE PARKS THE PASS INSTEAD OF STOPPING IT (the review of 2026-10-22, M2,
// open to the owner's veto). The router bounds its own wait at 300 s because a call carries a 360 s deadline, so a
// NeuralWatt day starting again 301 s away ended the call with a refusal that states the distance
// (`neuralwattReturnsInMs`). When that return lies inside what the pass has left, ending the run would throw away the
// energy that is about to come back, so the gate parks: the shared signal aborts so the entry in flight ends, the queue
// puts that entry back at the front with no verdict (`runAttemptQueue`'s `interrupted`), waits out the return before
// asking whether the pass goes on (`beforeNext`, which is `awaitPark`), and the attempt that follows starts on a live
// signal. The wait sits between entries, outside every exchange, so no call deadline cuts it. A refusal that names no
// return, or one past what the pass has left, trips as before and states the time. A refusal that arrives within a
// minute of a park's end trips, since the account has then not shown the energy it should: parking again would wait a
// day in a loop.

/**
 Logger root for the gate, naming the entry whose call tripped it.
 */
const passDryStopLog = contextRoot({ tag: 'pass-dry-stop', },);

/**
 What a pass has left when it bounds nothing: no limit.

 @returns Infinity

 @example
 ```ts
 const left = unboundedPass();
 ```
 */
function unboundedPass(): number {
  return Number.POSITIVE_INFINITY;
}

/**
 Waits out a park.

 @param ms - milliseconds to wait

 @example
 ```ts
 await waitOutPark({ ms: 301_000, },);
 ```
 */
async function waitOutPark({ ms, }: { readonly ms: number; },): Promise<void> {
  await wait(ms,);
}

/**
 How long after a park ends a dry refusal trips the gate instead of parking again: the budgets' freshness window
 (`BUDGET_FRESH_MS`, 60 s in the provider package), within which a reading can still be the one taken before the return.
 */
export const PARK_SETTLE_MS = 60_000;

/**
 Gate that turns the first every-provider-dry refusal into a stop of the whole pass, or a park until the energy returns.

 @example
 ```ts
 const dryStop: PassDryStop = createPassDryStop();
 ```
 */
export type PassDryStop = {
  /**
   Aborted with the first refusal as its reason, which every entry's call deadline forwards; a fresh signal once a park
   has ended, so read it when an entry starts and not before.
   */
  readonly signal: AbortSignal;

  /**
   Wraps a client so a dry refusal from any of its calls trips this gate before the refusal propagates.
   */
  readonly guard: <ClientT extends ModelClient,>(args: { readonly client: ClientT; },) => ClientT;

  /**
   Hands the gate a failure that ended an entry, which trips it (or parks it) when the failure is the dry refusal and
   does nothing for any other; for a refusal that reached the entry without passing a guarded call.
   */
  readonly trip: (args: { readonly error: unknown; },) => void;

  /**
   Whether the dry router has been met and the pass stops, so it starts no further entry.
   */
  readonly tripped: () => boolean;

  /**
   Whether a dry refusal parked the pass and the park has not been waited out, so the entry in flight was cut short and
   goes back to the front of the queue.
   */
  readonly parked: () => boolean;

  /**
   Waits until the return the park is for, logging the end, and gives the gate a live signal again; nothing where the
   pass is not parked.
   */
  readonly awaitPark: () => Promise<void>;

  /**
   The one line saying why the pass starts no further entry, the first time it is asked after the trip; none before
   the trip and none once it has been handed out, so the stop is announced exactly once.
   */
  readonly takeStopNotes: () => readonly string[];
};

/**
 The return a park waits for.
 */
type DryPark = {
  /**
   Milliseconds to wait, the distance the refusal named.
   */
  readonly returnsInMs: number;

  /**
   The time of day the return falls at, with its zone.
   */
  readonly returnsAt: string;
};

/**
 What the gate remembers of its trip and its parks.
 */
type DryStopState = {
  /**
   Owner of the abort every entry's calls forward, replaced once a park has ended.
   */
  controller: AbortController;

  /**
   The first refusal that tripped the gate, whose cause stays the reason.
   */
  cause?: EveryProviderDryError;

  /**
   Whether the stop note has been handed out.
   */
  noted: boolean;

  /**
   The sentence stating the return time that the stop note adds, empty where the refusal named none.
   */
  stopNote: string;

  /**
   The park in force: empty, or the one return the pass waits for.
   */
  readonly parks: DryPark[];

  /**
   When the last park ended on the gate's clock, absent before the first.
   */
  parkEndedAt?: number;
};

/**
 Runs one call of a guarded client and hands any failure to the gate before it propagates.

 @param call - the client's own call

 @param trip - what the gate does with a failure

 @returns What the call returned

 @throws Whatever the call raised, unchanged

 @example
 ```ts
 return await tripping({ call: async () => await client.chatText(request,), trip, },);
 ```
 */
async function tripping<ResultT,>(
  {
    call,
    trip,
  }: {
    readonly call: () => Promise<ResultT>;
    readonly trip: (args: { readonly error: unknown; },) => void;
  },
): Promise<ResultT> {
  try {
    return await call();
  }
  catch (error) {
    trip({ error, },);
    throw error;
  }
}

/**
 States the return time of NeuralWatt's energy and why the pass did not wait for it, for the stop line.

 @param returnsInMs - milliseconds until the return, absent where the refusal named none

 @param returnsAt - the time of day the return falls at, with its zone

 @param passLeftMs - milliseconds the pass has left

 @returns A sentence, empty where the refusal named no return

 @example
 ```ts
 const note = returnNoteOf({ returnsInMs: 301_000, returnsAt: '19:15:08 UTC', passLeftMs: 300_000, },);
 ```
 */
function returnNoteOf(
  {
    returnsInMs,
    returnsAt,
    passLeftMs,
  }: {
    readonly returnsInMs?: number;
    readonly returnsAt?: string;
    readonly passLeftMs: number;
  },
): string {
  if ((returnsInMs === undefined) || (returnsAt === undefined))
    return '';
  return ` NeuralWatt's energy returns at ${returnsAt}, in ${durationWordsOf({ ms: returnsInMs, },)}, which is past the ${
    durationWordsOf({ ms: passLeftMs, },)
  } this pass has left.`;
}

/**
 Parks the pass for the return a refusal names, or trips the gate on it.

 @param error - what a guarded call raised, or what ended an entry

 @param state - what the gate remembers of its trip and its parks

 @param l - logger the line is written on

 @param passLeftMs - milliseconds the pass has left before its soft budget or hard cap

 @param now - the gate's clock

 @mutates state - holds the cause, or the park, and aborts the controller, the first time only

 @example
 ```ts
 refuseOn({ error, state, l, passLeftMs, now, },);
 ```
 */
function refuseOn(
  {
    error,
    state,
    l,
    passLeftMs,
    now,
  }: {
    readonly error: unknown;
    readonly state: DryStopState;
    readonly l: Logger;
    readonly passLeftMs: () => number;
    readonly now: () => number;
  },
): void {
  // A PARK OR A TRIP IS MADE ONCE: calls of the same entry that meet the dry router after the first are the same event.
  if ((!(error instanceof EveryProviderDryError)) || (state.cause !== undefined)
    || (state.parks
      .length
      > 0))
    return;

  /**
   Milliseconds the pass has left.
   */
  const left = passLeftMs();
  /**
   Whether the refusal names a return the pass can wait for, and no park ended just before it.
   */
  const parkable = (error.neuralwattReturnsInMs !== undefined) && (error.neuralwattReturnsAt !== undefined)
    && (error.neuralwattReturnsInMs <= left)
    && ((state.parkEndedAt === undefined) || ((now() - state.parkEndedAt) >= PARK_SETTLE_MS));
  /**
   Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: refuseOn.name,
    l,
  },);
  if (parkable) {
    state.parks
      .push({
        returnsInMs: nonNullishOrThrow(error.neuralwattReturnsInMs,),
        returnsAt: nonNullishOrThrow(error.neuralwattReturnsAt,),
      },);
    rl.warn(
      'every provider is out of budget, so the pass is parked until NeuralWatt\'s energy returns at '
        + `${nonNullishOrThrow(error.neuralwattReturnsAt,)} (in ${durationWordsOf({ ms: nonNullishOrThrow(error.neuralwattReturnsInMs,), },)}); `
        + `the entry in flight is left resumable and the pass resumes then (cause: ${refusalText({ error, },)})`,
    );
    state.controller
      .abort(error,);
    return;
  }
  state.cause = error;
  state.stopNote = returnNoteOf({
    ...((error.neuralwattReturnsInMs === undefined) ? {} : { returnsInMs: error.neuralwattReturnsInMs, }),
    ...((error.neuralwattReturnsAt === undefined) ? {} : { returnsAt: error.neuralwattReturnsAt, }),
    passLeftMs: left,
  },);
  rl.error(`every provider is out of budget, so the pass stops starting entries (cause: ${refusalText({ error, },)})`,);
  state.controller
    .abort(error,);
}

/**
 Builds the gate one pass shares across its entries.

 @param l - logger the trip is written on; the gate's own, naming the entry in flight, when absent

 @param passLeftMs - milliseconds the pass has left before its soft budget or hard cap, which a park must fit inside;
 unbounded when absent

 @param waitMs - waits out a park, injectable so a test does not wait; `wait` by default

 @param now - the gate's clock, on which a refusal right after a park is told from a later one; `monotonicMs` by default

 @returns Gate whose signal aborts on the first every-provider-dry refusal a guarded client meets

 @example
 ```ts
 const dryStop = createPassDryStop();
 const client = dryStop.guard({ client: input.newClient({ promptPayloadDir, }), },);
 ```
 */
export function createPassDryStop(
  {
    l = passDryStopLog,
    passLeftMs = unboundedPass,
    waitMs = waitOutPark,
    now = monotonicMs,
  }: {
    readonly l?: Logger;
    readonly passLeftMs?: () => number;
    readonly waitMs?: (args: { readonly ms: number; },) => Promise<void>;
    readonly now?: () => number;
  } = {},
): PassDryStop {
  /**
   What the gate remembers of its trip and its parks.
   */
  const state: DryStopState = {
    controller: new AbortController(),
    noted: false,
    stopNote: '',
    parks: [],
  };

  /**
   Hands a failure of a guarded call to the gate.

   @param error - what the call raised
   */
  function trip({ error, }: { readonly error: unknown; },): void {
    refuseOn({
      error,
      state,
      l,
      passLeftMs,
      now,
    },);
  }

  return {
    /**
     The live signal, which a park replaces.
     */
    get signal(): AbortSignal {
      return state.controller
        .signal;
    },

    trip,

    guard: function guard<ClientT extends ModelClient,>(
      { client, }: { readonly client: ClientT; },
    ): ClientT {
      /**
       The chat calls, each failing through the gate.
       */
      const chat: Pick<ModelClient, 'chatJson' | 'chatText'> = {
        chatText: async function guardedText(request,) {
          return await tripping({
            call: async function ask() {
              return await client.chatText(request,);
            },
            trip,
          },);
        },
        chatJson: async function guardedJson(request,) {
          return await tripping({
            call: async function ask() {
              return await client.chatJson(request,);
            },
            trip,
          },);
        },
      };

      /**
       The typed-decision call, present only where the client carries one.
       */
      const decisions: Pick<ModelClient, 'decide'> = (client.decide === undefined)
        ? {}
        : {
          decide: async function guardedDecide(request,) {
            return await tripping({
              call: async function ask() {
                return await nonNullishOrThrow(client.decide,)(request,);
              },
              trip,
            },);
          },
        };
      return {
        ...client,
        ...chat,
        ...decisions,
      };
    },

    tripped: function tripped(): boolean {
      return state.cause !== undefined;
    },

    parked: function parked(): boolean {
      return state.parks
        .length
        > 0;
    },

    awaitPark: async function awaitPark(): Promise<void> {
      /**
       The return the park waits for, none where the pass is not parked.
       */
      const [park,] = state.parks;
      if (park === undefined)
        return;
      await waitMs({ ms: park.returnsInMs, },);
      state.parks
        .splice(0,);
      state.parkEndedAt = now();
      state.controller = new AbortController();
      tagged({
        tag: createPassDryStop.name,
        l,
      },)
        .info(`the pass resumes: NeuralWatt's energy was due at ${park.returnsAt} and the park of ${durationWordsOf({ ms: park.returnsInMs, },)} has ended`,);
    },

    takeStopNotes: function takeStopNotes(): readonly string[] {
      if ((state.cause === undefined) || state.noted)
        return [];
      state.noted = true;
      return [
        'STOP every provider is out of budget, so no further entry starts; the entries already settled keep '
          + `their pages and the entry in flight is left resumable. Cause: ${state.cause
            .message}${state.stopNote}`,
      ];
    },
  };
}

//endregion Pass dry stop

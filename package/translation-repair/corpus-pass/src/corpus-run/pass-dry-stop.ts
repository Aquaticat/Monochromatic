import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  EveryProviderDryError,
  type ModelClient,
} from '@monochromatic-dev/translation-repair-provider/ts';

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

/**
 Gate that turns the first every-provider-dry refusal into a stop of the whole pass.

 @example
 ```ts
 const dryStop: PassDryStop = createPassDryStop();
 ```
 */
export type PassDryStop = {
  /**
   Aborted with the first refusal as its reason, which every entry's call deadline forwards.
   */
  readonly signal: AbortSignal;

  /**
   Wraps a client so a dry refusal from any of its calls trips this gate before the refusal propagates.
   */
  readonly guard: <ClientT extends ModelClient,>(args: { readonly client: ClientT; },) => ClientT;

  /**
   Whether a guarded call has met the dry router, so the pass starts no further entry.
   */
  readonly tripped: () => boolean;

  /**
   The one line saying why the pass starts no further entry; only asked once `tripped` reads true.
   */
  readonly stopNote: () => string;
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
 Trips the gate on a dry refusal, once.

 @param error - what a guarded call raised

 @param causes - the refusals that tripped the gate so far

 @param controller - owner of the abort every entry's calls forward

 @mutates causes - holds the refusal, the first time only

 @mutates controller - aborts with the refusal as the reason, the first time only

 @example
 ```ts
 tripOn({ error, causes, controller, },);
 ```
 */
function tripOn(
  {
    error,
    causes,
    controller,
  }: {
    readonly error: unknown;
    readonly causes: EveryProviderDryError[];
    readonly controller: AbortController;
  },
): void {
  if ((error instanceof EveryProviderDryError) && (causes.length === 0)) {
    causes.push(error,);
    controller.abort(error,);
  }
}

/**
 Builds the gate one pass shares across its entries.

 @returns Gate whose signal aborts on the first every-provider-dry refusal a guarded client meets

 @example
 ```ts
 const dryStop = createPassDryStop();
 const client = dryStop.guard({ client: input.newClient({ promptPayloadDir, }), },);
 ```
 */
export function createPassDryStop(): PassDryStop {
  /**
   Owns the abort every entry's calls forward.
   */
  const controller = new AbortController();

  /**
   The refusals that tripped the gate: at most one, the first, whose cause stays the reason.
   */
  const causes: EveryProviderDryError[] = [];

  /**
   Hands a failure of a guarded call to the gate.

   @param error - what the call raised
   */
  function trip({ error, }: { readonly error: unknown; },): void {
    tripOn({
      error,
      causes,
      controller,
    },);
  }

  return {
    signal: controller.signal,

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
      return causes.length > 0;
    },

    stopNote: function stopNote(): string {
      return 'STOP every provider is out of budget, so no further entry starts; the entries already settled keep '
        + `their pages and the entry in flight is left resumable. Cause: ${nonNullishOrThrow(causes[0],)
          .message}`;
    },
  };
}

//endregion Pass dry stop

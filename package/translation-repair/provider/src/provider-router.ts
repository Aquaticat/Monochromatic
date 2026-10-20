import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { contextRoot, } from '@monochromatic-dev/translation-repair-typography/ts';
import {
  monotonicMs,
  NoProviderForModelError,
} from '@monochromatic-dev/translation-repair-markup/ts';
import {
  HOLD_POLL_MS,
  NOBODY_REFUSED,
  readBudgetsPastHolds,
} from './budget-hold-wait.ts';
import {
  type ModelReach,
  routeProviderFor,
} from './budget-routing.ts';
import {
  createCredentialHolds,
  holdOnCredentialRefusal,
  reachPastCredentialHolds,
} from './credential-hold.ts';
import { routedDecide, } from './provider-router-decide.ts';
import { reachPastHoldsOrRefusal, } from './reach-past-holds.ts';
import type {
  Decider,
  DecisionReply,
  DecisionRequest,
} from './decision-contract.ts';
import {
  carriesPicture,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type ChatTextReply,
  type ChatTextRequest,
  type ModelCaller,
} from './chat-contract.ts';
import {
  isBudgetRefusal,
  isCallSizedRefusal,
  isCredentialRefusal,
  isPaymentRefusal,
  isUpstreamModelRefusal,
  statedWaitMsOf,
} from './provider-budget-refusal.ts';
import type { ProviderBudgets, } from './provider-budget.ts';
import {
  createSlotLedger,
  PROVIDER_ORDER,
  type ProviderName,
  type SlotLimits,
} from '@monochromatic-dev/translation-repair-shared-contract/ts';
import {
  type RoutedCore,
  routedJson,
  routedTextElsewhere,
} from './provider-router-reask.ts';
import type { RoutedReply, } from './provider-router-reply.ts';
import { NEURALWATT_PER_MODEL_CONCURRENCY, } from './neuralwatt-client.ts';
import type { ProviderCallers, } from './provider-callers.ts';
import { SYNTHETIC_PER_MODEL_CONCURRENCY, } from './synthetic-client.ts';
import { isStreamBoundCut, } from './stream-bound.ts';
import { createStreamBoundHolds, } from './stream-bound-hold.ts';
import {
  logWindowOverflow,
  paceWaitsOf,
  type ProviderPaces,
  withFullWindows,
} from './pace-saturation.ts';
import {
  createUpstreamModelHolds,
  UPSTREAM_MODEL_HOLD_MS,
} from './upstream-model-hold.ts';
import {
  reachOf,
  visionReachOf,
} from './roster-reach.ts';

//region Provider router
// ONE CLIENT OVER EVERY PROVIDER. A stage names a panelist; this decides where
// to buy the call, and a stage never learns which provider served it.
//
// THE POLICY IS THE OWNER'S, and `budget-routing.ts` holds the arithmetic: the
// providers are walked in `PROVIDER_ORDER`, the first with budget and a free
// slot takes the call, and a dry provider passes the call down the order.
// Nothing here re-decides that; this file supplies the facts the policy reads
// and performs whatever it returns.
//
// A REFUSED CALL IS RE-ROUTED, NOT LOST. That is the whole reason routing
// exists: a pass exhausted one provider's weekly credit and 866 of 875 lost
// voices carried a single HTTP 429. Retrying an exhausted provider never
// succeeds and refusing to settle turns a budget problem into holes in the
// deliverable, so a budget refusal marks that provider and asks the next.
//
// IT DELEGATES ONLY `chatText`. The schema ladder is provider-neutral and
// already lives in `chat-json-outcome.ts`, so a routed `chatJson` reads the
// text this file fetched rather than calling a provider's own. That keeps one
// ladder for every provider and makes the parameters narrow enough to state:
// each caller is `Pick<..., 'chatText'>` and nothing more.
//
// RE-ROUTED AT MOST ONCE PER PROVIDER. Each refusal marks its provider and
// asks the budgets again through `readBudgetsPastHolds`, which waits out a
// refusal hold before calling every provider dry, so a refuser can come back
// for a later re-route once its hold has ended, or at once when it was held
// out for no time and nobody else has budget; an all-dry
// reading no hold explains raises, and the call ends there. The loop is
// bounded by the number of providers, so a wall of refusals is an answer
// rather than an invitation to keep going.

/**
 Logger root for the routing layer, which a router built with none writes to.
 */
const routerRoot = contextRoot({ tag: 'translation-repair', },);

// The refusal lives in its own module so the re-ask can raise it without an
// import cycle; it is re-exported here, where every importer found it.

/**
 Per-model slots the providers grant by default: no ceiling on any of them.
 Synthetic had a measured five until 2026-10-19, when its rate-limit page stopped
 naming a concurrency limit; the entry still reads the client's own default, so
 the router's count and the client's limiter cannot drift apart.
 */
const DEFAULT_SLOT_LIMITS: SlotLimits = {
  // NeuralWatt publishes no per-model ceiling that was found (2026-10-20); the
  // energy ledger's in-flight hold is what bounds what is risked at once.
  neuralwatt: NEURALWATT_PER_MODEL_CONCURRENCY,
  synthetic: SYNTHETIC_PER_MODEL_CONCURRENCY,
  hyper: Number.POSITIVE_INFINITY,
  bedrock: Number.POSITIVE_INFINITY,
  openrouter: Number.POSITIVE_INFINITY,
};

/**
 Providers that can serve one call, narrowed to vision where it carries a
 picture.

 @param request - call whose reach is read

 @returns Reach for the policy, or for a re-ask, to decide on

 @example
 ```ts
 const reach = reachOfRequest({ request, },);
 ```
 */
function reachOfRequest(
  { request, }: { readonly request: ForeignBorrowed<ChatTextRequest>; },
): ModelReach {
  if (carriesPicture({ messages: request.messages, },))
    return visionReachOf({ modelId: request.modelId, },);
  return reachOf({ modelId: request.modelId, },);
}

/**
 Builds the client that routes each call to whichever provider can serve it.

 @param callers - each configured provider's text call, which is all this
 delegates; a provider with no caller has no key, its meter reads dry
 (`UNCONFIGURED_METER`), and the route never picks it

 @param budgets - shared budget view every call is routed by

 @param slotLimits - concurrent calls each limiting provider's client grants
 one model, which decides when it counts as saturated; must match the
 `perModelConcurrency` that client was built with

 @param holdPollMs - how often a call waiting out a hold checks for abort;
 injectable so a test waits milliseconds rather than a second

 @param decider - client of OpenRouter's decisions endpoint, when the run
 has the OpenRouter key; a decision seat is served by that one meter

 @param modelHoldMs - how long a model whose upstream endpoint rate-limited
 it is held out before it is asked again (class sixty-four)

 @param now - clock the model holds are read by, injectable for tests;
 `monotonicMs` by default, since a hold read on the system clock lasted an
 hour longer when it was set back (ledger B78)

 @param paces - request windows of the providers that pace their calls; a
 provider whose window would make the call wait reads saturated, so the call
 overflows to a usable provider behind it (class one hundred forty-nine)

 @param l - logger the router writes its warns to; the package's root logger by default

 @returns Client surface a stage calls without naming a provider

 @example
 ```ts
 const client = createRoutingClient({ callers: { synthetic, hyper, openrouter, }, budgets, },);
 ```
 */
export function createRoutingClient(
  {
    callers,
    budgets,
    slotLimits = DEFAULT_SLOT_LIMITS,
    holdPollMs = HOLD_POLL_MS,
    decider,
    modelHoldMs = UPSTREAM_MODEL_HOLD_MS,
    now = monotonicMs,
    paces = {},
    l = routerRoot,
  }: {
    readonly callers: ProviderCallers;
    readonly budgets: ProviderBudgets;
    readonly slotLimits?: SlotLimits;
    readonly holdPollMs?: number;
    readonly decider?: Decider;
    readonly modelHoldMs?: number;
    readonly now?: () => number;
    readonly paces?: ProviderPaces;
    readonly l?: Logger;
  },
): ModelCaller {
  /**
   In-flight slots on the providers that limit them.
   */
  const ledger = createSlotLedger({ limits: slotLimits, },);

  /**
   Models held out because their upstream endpoint rate-limited them.
   */
  const modelHolds = createUpstreamModelHolds({
    holdMs: modelHoldMs,
    now,
  },);

  /**
   Providers held out for one model after a call there ran past the card's
   stream bound (class one hundred forty-eight), for the same backoff.
   */
  const boundHolds = createStreamBoundHolds({
    holdMs: modelHoldMs,
    now,
  },);

  /**
   Providers whose credential a call has found refused, held out of every
   model for the rest of the run (zheermao19, 2026-10-20).
   */
  const credentialHolds = createCredentialHolds();

  /**
   Providers that can serve one call, narrowed to vision where it carries a
   picture, less any whose credential was refused.

   @param request - call whose reach is read

   @returns Reach for the policy, or for a re-ask, to decide on

   @example
   ```ts
   const reach = reachFor({ request, },);
   ```
   */
  function reachFor(
    { request, }: { readonly request: ForeignBorrowed<ChatTextRequest>; },
  ): ModelReach {
    /**
     Reach of the call less the providers whose credential was refused.
     */
    const { reach, } = reachPastCredentialHolds({
      reach: reachOfRequest({ request, },),
      holds: credentialHolds,
    },);
    return reach;
  }

  /**
   Reads which providers may take one call once the credential holds and the
   stream bound holds are taken out, refusing where the holds leave nobody.

   ASKED IN TWO PLACES, so a call ends with one reason whichever of them
   finds every serving provider held: before each attempt, and after the last
   one a call has.

   @param request - call being routed, read for its model and its pictures

   @returns Providers serving the model that hold nothing against it

   @throws {@link NoProviderForModelError} when every provider serving the
   model has its credential refused, or holds the model out on its stream bound

   @example
   ```ts
   const reach = reachPastBoundHoldsOrRefusal({ request, },);
   ```
   */
  function reachPastBoundHoldsOrRefusal(
    { request, }: { readonly request: ForeignBorrowed<ChatTextRequest>; },
  ): ModelReach {
    return reachPastHoldsOrRefusal({
      reach: reachOfRequest({ request, },),
      modelId: request.modelId,
      credentialHolds,
      boundHolds,
    },);
  }

  /**
   Decides which provider takes one call, given what is known right now.

   @param request - call being routed, read for its model and its pictures

   @param refused - provider that has just refused us, or nobody

   @returns Provider to ask

   @throws {@link NoProviderForModelError} when nowhere can take it

   @throws {@link import('./budget-routing.ts').EveryProviderDryError} when
   every provider is out of budget with no refusal hold left to wait out

   @example
   ```ts
   const provider = await chooseProvider({ request, refused: NOBODY_REFUSED, },);
   ```
   */
  async function chooseProvider(
    {
      request,
      refused,
    }: {
      readonly request: ForeignBorrowed<ChatTextRequest>;
      readonly refused: ProviderName | typeof NOBODY_REFUSED;
    },
  ): Promise<ProviderName> {
    /**
     Providers that can serve this model and hold nothing against it.
     */
    const reach = reachPastBoundHoldsOrRefusal({ request, },);

    /**
     What each provider's budget looks like right now, the refusal that
     routed here folded in and any hold every provider was under waited out.
     */
    const dry = await readBudgetsPastHolds({
      budgets,
      modelId: request.modelId,
      signal: request.signal,
      refused,
      pollMs: holdPollMs,
    },);

    /**
     How long each pacing provider's window would make this call wait.
     */
    const waits = paceWaitsOf({ paces, },);

    /**
     Where the owner's policy sends this call: a provider whose slots are all
     taken, or whose request window would make the call wait, overflows to a
     usable provider behind it and still takes the call when nobody stands
     there (class one hundred forty-nine).
     */
    const choice = routeProviderFor({
      reach,
      dry,
      saturated: withFullWindows({
        saturated: ledger.saturated({ modelId: request.modelId, },),
        waits,
      },),
    },);

    logWindowOverflow({
      modelId: request.modelId,
      reach,
      dry,
      waits,
      chosen: choice.kind,
    },);

    if (choice.kind === 'unreachable')
      throw new NoProviderForModelError({
        modelId: request.modelId,
        reason: choice.reason,
      },);

    // THE SLOT IS TAKEN HERE, NOT AT DISPATCH, and there must be no `await`
    // between reading `ledger.saturated` and this line. Two calls choosing at
    // once both resume from the budget read before either has been sent, so a
    // count that only rose at dispatch showed both of them a free slot and put
    // both on the same provider. Counting at the decision closes that, because
    // nothing else runs between the read and the increment.
    ledger.take({
      provider: choice.kind,
      modelId: request.modelId,
    },);
    return choice.kind;
  }

  /**
   Performs one call on the named provider, releasing its slot afterwards.

   PAIRED WITH THE TAKE IN `chooseProvider` AND IN THE RE-ASK: every decision
   takes one slot on a limiting provider and reaches exactly one call here.

   @param provider - provider to ask, as {@link chooseProvider} decided

   @param request - call to perform

   @mutates request - the delegated client serializes messages and response format; see its contract

   @returns Whatever that provider answered

   @example
   ```ts
   const reply = await callOn({ provider: 'hyper', request, },);
   ```
   */
  async function callOn(
    {
      provider,
      request,
    }: {
      readonly provider: ProviderName;
      readonly request: ForeignBorrowed<ChatTextRequest>;
    },
  ): Promise<ChatTextReply> {
    /**
     Slot this call holds until it returns or raises; a no-op on a provider
     that grants no limit.
     */
    using slot = ledger.held({
      provider,
      modelId: request.modelId,
    },);

    // Named so the handle is bound rather than discarded; `using` is what
    // makes it do its work, and reading it here keeps that legible.
    void slot;

    /**
     The provider's own client, which is all this delegates to. Present for
     every provider a route can name: one with no caller has no key, reads
     dry, and is never chosen (ledger T8).
     */
    const caller = nonNullishOrThrow(callers[provider],);
    return await caller.chatText(request,);
  }

  /**
   Free-text chat exchange, routed and re-routed on budget refusals, at most
   once per provider.

   @param request - exchange to perform

   @mutates request - the delegated client serializes messages and response format; see its contract

   @returns Content text and usage when reported, and who answered

   @throws {@link NoProviderForModelError} when nowhere can take it

   @example
   ```ts
   const { provider, reply, } = await routedText({ modelId, messages, signal, },);
   ```
   */
  async function routedText(
    request: ForeignBorrowed<ChatTextRequest>,
  ): Promise<RoutedReply> {
    /**
     Logger pre-tagged with this function's name.
     */
    const rl = tagged({
      tag: routedText.name,
      l,
    },);

    /**
     Provider that refused the previous attempt, folded into the next
     decision; nobody before the first.

     A RECORD RATHER THAN A ROOT `let`, so the one thing that changes
     between attempts is named and scoped to the loop that changes it.
     */
    const last: { refused: ProviderName | typeof NOBODY_REFUSED; } = { refused: NOBODY_REFUSED, };

    /**
     What is left of this model's own hold, zero when it is free.
     */
    const heldMs = modelHolds.remainingMs({ modelId: request.modelId, },);
    if (heldMs > 0) {
      // REFUSED WITHOUT A CALL, so a round counts the seat unreachable and
      // neither asks nor waits for it (class sixty-four).
      throw new NoProviderForModelError({
        modelId: request.modelId,
        reason: `its upstream endpoint rate-limited this model; held out for another ${String(heldMs,)}ms`,
      },);
    }

    /**
     Which providers serve this call at all. COUNTED OVER THE REACH RATHER
     THAN THE ORDER since 2026-09-07, when a fourth provider that serves
     few of the roster's models joined: a loop bounded by the order would
     ask once more after the last serving provider refused and end on a
     no-provider error instead of the refusal itself.
     */
    const reach = reachFor({ request, },);

    /**
     How many of them serve this call.
     */
    const serving = PROVIDER_ORDER
      .filter(function serves(candidate,): boolean {
        return reach[candidate];
      },)
      .length;

    // ONE ATTEMPT PER SERVING PROVIDER AT MOST. The loop cannot be a `map`: each
    // decision depends on the refusal before it, and the last refusal is the
    // answer. BOUNDED BY THE PROVIDERS THAT SERVE THE CALL, NOT BY THE ORDER
    // (2026-10-20): with a fifth provider in the order, a model four providers
    // serve got a fifth decision after its fourth attempt, and that decision
    // named a budget where the attempts had been cut at a stream bound. At least
    // one pass runs, so a model nobody serves still gets the decision that says so.
    /**
     Attempt budget: one per serving provider, and at least one.
     */
    const attempts = Math.max(
      serving,
      1,
    );
    for (const attempt of Array.from({ length: attempts, },)
      .keys()) {
      /* oxlint-disable no-await-in-loop -- each choice depends on the refusal before it */
      /**
       Provider the policy picked on what is known before this attempt.
       */
      const provider = await chooseProvider({
        request,
        refused: last.refused,
      },);
      /* oxlint-enable no-await-in-loop */

      try {
        return {
          provider,
          // oxlint-disable-next-line no-await-in-loop -- the call IS the attempt
          reply: await callOn({
            provider,
            request,
          },),
        };
      } catch (error) {
        if (isStreamBoundCut({ error, },)) {
          boundHolds.hold({
            provider,
            modelId: request.modelId,
          },);
          rl.warn(
            `${request.modelId}: ${provider} ran past the card's stream bound; `
              + `${provider} is held out for this model for ${String(modelHoldMs,)}ms `
              + 'and the call goes to the next provider serving it, if any',
          );
          continue;
        }
        if (isCredentialRefusal({ error, },)) {
          // HELD OUT FOR THE RUN, FOR EVERY MODEL: the credential is the
          // provider's and does not renew, so the call goes on to the next
          // provider serving the model, and the seat is withheld only when
          // none is left (the loop ends, and `reachPastBoundHoldsOrRefusal` reads the holds).
          holdOnCredentialRefusal({
            rl,
            provider,
            modelId: request.modelId,
            error,
            reach: reachOfRequest({ request, },),
            holds: credentialHolds,
            boundHolds,
          },);
          continue;
        }
        if (isUpstreamModelRefusal({ error, },)) {
          modelHolds.hold({ modelId: request.modelId, },);
          rl.warn(
            `${request.modelId}: ${provider} passed on its upstream endpoint's rate limit for this model; `
              + `the seat is lost this round, the model is held out for ${String(modelHoldMs,)}ms `
              + 'and the provider stays where its meter puts it',
          );
          throw error;
        }
        if (!isBudgetRefusal({ error, },))
          throw error;

        if (!isCallSizedRefusal({ error, },)) {
          // oxlint-disable-next-line no-await-in-loop -- the hold must start before the next decision reads the budgets
          await budgets.markRefused({
            provider,
            signal: request.signal,
            statedWaitMs: statedWaitMsOf({ error, },),
            paymentRequired: isPaymentRefusal({ error, },),
          },);
        }
        if (attempt >= (serving - 1))
          throw error;
        rl.warn(`${request.modelId}: ${provider} refused us, asking the next provider`,);
        last.refused = provider;
      }
    }

    // THE ONE WAY OUT OF THE LOOP WITHOUT A REPLY OR A RETHROWN REFUSAL is a call
    // cut at its stream bound on the last attempt the loop has: the cut
    // `continue`s, and the next decision, which would read the holds and name
    // them, is one the loop has no attempt left for. That takes any model, on
    // its last serving provider. The holds are read here in that decision's
    // place, so every serving provider cut in turn ends with the reason one
    // fewer would.
    reachPastBoundHoldsOrRefusal({ request, },);

    // NOT EVERY ONE WAS CUT, then: a provider before the last refused the call
    // on its budget, which sends the call on without a stream bound hold, and
    // the last one ran past its bound.
    throw new NoProviderForModelError({
      modelId: request.modelId,
      reason: 'every provider serving this model refused this call or ran past its stream bound on it',
    },);
  }

  /**
   What the re-ask borrows from this router.
   */
  const core: RoutedCore = {
    reachFor,
    budgets,
    ledger,
    callOn,
    routedText,
  };

  /**
   Free-text chat exchange, routed and re-routed on budget refusals.

   @param request - exchange to perform

   @mutates request - the delegated client serializes messages and response format; see its contract

   @returns Content text and usage when reported

   @throws {@link NoProviderForModelError} when nowhere can take it

   @example
   ```ts
   const reply = await client.chatText({ modelId, messages, signal, },);
   ```
   */
  async function chatText(request: ForeignBorrowed<ChatTextRequest>,): Promise<ChatTextReply> {
    /**
     The exchange and who served it: on the provider the policy picks, or,
     for a re-ask hinted away from one, on another (ledger P9).
     */
    const routed = (request.otherThan === undefined)
      ? await routedText(request,)
      : await routedTextElsewhere({
        core,
        request,
        otherThan: request.otherThan,
      },);

    // TAGGED WITH ITS PROVIDER, so a reply that could not be used can be
    // re-asked elsewhere by the caller that reads it.
    return {
      ...routed.reply,
      servedBy: routed.provider,
    };
  }

  /**
   Schema-validated chat exchange over whichever provider served the text.

   @param request - exchange plus content guard

   @mutates request - the delegated client serializes messages and response format; see its contract

   @returns Outcome as data: ok, refusal-shaped, or schema-mismatch

   @example
   ```ts
   const outcome = await client.chatJson({ modelId, messages, signal, validate: isVerdict, },);
   ```
   */
  async function chatJson<ValueT,>(
    request: ForeignBorrowed<ChatJsonRequest<ValueT>>,
  ): Promise<ChatJsonOutcome<ValueT>> {
    return await routedJson({
      core,
      request,
    },);
  }

  /**
   Typed-decision exchange, served by OpenRouter alone: refused when the
   OpenRouter meter reads dry, and a budget refusal marks that meter as a
   chat refusal would.

   @param request - state and questions to decide

   @returns Answers as the endpoint gave them

   @throws {@link NoProviderForModelError} when no decisions client is
   configured or the OpenRouter meter reads dry

   @example
   ```ts
   const reply = await client.decide({ modelId, state, questions, signal, },);
   ```
   */
  async function decide(request: ForeignBorrowed<DecisionRequest>,): Promise<DecisionReply> {
    return await routedDecide({
      request,
      ...((decider === undefined) ? {} : { decider, }),
      budgets,
      credentialHolds,
      l,
    },);
  }

  return {
    chatText,
    chatJson,
    decide,
  };
}

//endregion Provider router

import { StatedRefusalError, } from '@monochromatic-dev/translation-repair-glossary/ts';
import type {
  ChatTextReply,
  ModelClient,
} from '@monochromatic-dev/translation-repair-provider/ts';
import type { AnthropicPrices, } from '@monochromatic-dev/translation-repair-shared-contract/ts';
import {
  callCeilingUsd,
  messageChars,
  PER_MILLION,
  pricesOf,
  tierFor,
  usdText,
} from './editor-fidelity-ceiling.ts';

//region Editor fidelity spend guard
// WHAT HOLDS AN ARM TO `--max-usd`, call by call, on what the replies cost and not on what the arm might cost.
//
// A POOL OF FORTY TRIALS PRICES PAST ANY AMOUNT, because the ceiling takes the whole completion cap on every ask
// (`editor-fidelity-ceiling.ts`). Refusing to start on that total would refuse every arm of the pool, so the guard asks
// the question at each call instead: would the spend measured so far, plus the most this call can cost, pass the amount?
// If it would, the call is refused and the arm ends there, with the rows it finished already in their files.
//
// SPEND IS READ FROM THE REPLIES. A reply reports the tokens it used, thinking counted in the completion, and the card's
// prices turn them into dollars. The report folds the prompt's cached tokens into one prompt count, so the prompt is
// priced at the higher of the card's input and cache-write rates: the figure never falls under the bill, and an overcount
// only stops the arm sooner. A reply that reports no usage has an unknown cost and is counted at its call's ceiling, since
// an unknown cost may not be assumed small. A call that throws delivered no reply to measure and counts nothing; the
// attempts a client retries inside a call are its own to report, and are invisible here.
//
// THE REFUSAL ENDS THE ARM, NOT ONE VOICE OF IT. The stage turns a call that throws into a lost voice and asks again, but
// rethrows once the arm's signal has aborted. The guard aborts that signal with the refusal as its reason before it
// throws, so every layer between the call and the probe carries the refusal out, and every later call is refused with the
// same one without reaching the client.

/**
 What a reply reports about the tokens it used.
 */
type ReportedUsage = NonNullable<ChatTextReply['usage']>;

/**
 US dollars a reply cost, from the tokens it reported.

 @param prices - the card's prices, whose tier the prompt size picks

 @param usage - the tokens the reply reported, thinking counted in the completion

 @returns Cost in US dollars, the prompt priced at the higher of the input and cache-write rates

 @example
 ```ts
 const usd = measuredUsd({ prices, usage: { prompt_tokens: 1_000, completion_tokens: 3_000, }, },);
 ```
 */
export function measuredUsd(
  {
    prices,
    usage,
  }: {
    readonly prices: AnthropicPrices;
    readonly usage: ReportedUsage;
  },
): number {
  /**
   Rates of the tier that prices the whole call.
   */
  const tier = tierFor({
    prices,
    promptTokens: usage.prompt_tokens,
  },);
  return ((usage.prompt_tokens * Math.max(
    tier.inputUsdPerMillion,
    tier.cacheWriteUsdPerMillion,
  )) + (usage.completion_tokens * tier.outputUsdPerMillion)) / PER_MILLION;
}

/**
 The line that says what holds the arm to its amount.

 @param maxUsd - amount from `--max-usd`

 @returns The line, without a newline

 @example
 ```ts
 log.info(guardLine({ maxUsd: 2, },),);
 ```
 */
export function guardLine({ maxUsd, }: { readonly maxUsd: number; },): string {
  return 'spend guard: each call is refused, and the arm ends, when the spend measured from the replies so far plus '
    + `that call's ceiling would pass --max-usd ${usdText({ usd: maxUsd, },)}`;
}

/**
 Wraps a client so no call is made that could take the arm past its amount.

 @param inner - client to wrap

 @param maxUsd - most the arm may spend, from `--max-usd`

 @param controller - the arm's own, aborted with the refusal as its reason when a call is refused

 @returns A client with every member of the inner one, at run time, its exchanges refused once the measured spend plus
 the call's ceiling would pass the amount

 @throws StatedRefusalError from an exchange whose ceiling plus the spend measured so far passes the amount, before the
 inner client is reached, and from every exchange after it

 @throws StatedRefusalError from an exchange naming a model with no price table

 @example
 ```ts
 const client = spendGuardedClient({ inner, maxUsd: 2, controller, },);
 ```
 */
export function spendGuardedClient(
  {
    inner,
    maxUsd,
    controller,
  }: {
    readonly inner: ModelClient;
    readonly maxUsd: number;
    readonly controller: AbortController;
  },
): ModelClient {
  /**
   Dollars measured from the replies so far.
   */
  const spent = { usd: 0, };
  /**
   The refusal the arm ended with, at most one.
   */
  const refusals: StatedRefusalError[] = [];

  /**
   Lets a call through, or ends the arm.

   @param modelId - model the call names

   @param messages - what the call sends

   @returns The most this call can cost, which an unreported reply is counted at

   @throws StatedRefusalError when the call could take the arm past its amount, or an earlier one did

   @example
   ```ts
   const ceilingUsd = admit({ modelId, messages, },);
   ```
   */
  function admit(
    {
      modelId,
      messages,
    }: {
      readonly modelId: Parameters<typeof pricesOf>[0]['cardId'];
      readonly messages: Parameters<typeof messageChars>[0]['messages'];
    },
  ): number {
    /**
     The refusal an earlier call ended the arm with, absent while none has.
     */
    const [standing,] = refusals;
    if (standing !== undefined)
      throw standing;
    /**
     The most this call can cost.
     */
    const ceilingUsd = callCeilingUsd({
      prices: pricesOf({ cardId: modelId, },),
      promptTokens: messageChars({ messages, },),
    },);
    /**
     What the arm would have spent if this call cost its most.
     */
    const worstTotalUsd = spent.usd + ceilingUsd;
    if (worstTotalUsd > maxUsd) {
      /**
       The refusal that ends the arm.
       */
      const refusal = new StatedRefusalError({
        says: `the editor fidelity probe will not ask ${modelId}: the replies so far cost ${
          usdText({ usd: spent.usd, },)
        } USD as measured, this call can cost ${usdText({ usd: ceilingUsd, },)} USD at most, and together they pass `
          + `--max-usd ${usdText({ usd: maxUsd, },)}; the arm ends here, and the rows it finished stay in their files`,
      },);
      refusals.push(refusal,);
      controller.abort(refusal,);
      throw refusal;
    }
    return ceilingUsd;
  }

  /**
   Adds what a reply cost to the spend.

   @param modelId - model that answered

   @param ceilingUsd - the most the call could cost, counted when the reply reports no usage

   @param reply - what the inner client answered, whose usage is absent when it reported none

   @example
   ```ts
   settle({ modelId, ceilingUsd, reply, },);
   ```
   */
  function settle(
    {
      modelId,
      ceilingUsd,
      reply,
    }: {
      readonly modelId: Parameters<typeof pricesOf>[0]['cardId'];
      readonly ceilingUsd: number;
      readonly reply: { readonly usage?: ReportedUsage; };
    },
  ): void {
    /**
     The tokens the reply reported, absent when it reported none.
     */
    const { usage, } = reply;
    spent.usd += (usage === undefined)
      ? ceilingUsd
      : measuredUsd({
        prices: pricesOf({ cardId: modelId, },),
        usage,
      },);
  }

  return {
    ...inner,
    chatText: async function guardedText(request,) {
      /**
       The most this call can cost.
       */
      const ceilingUsd = admit({
        modelId: request.modelId,
        messages: request.messages,
      },);
      /**
       What the inner client answered.
       */
      const reply = await inner.chatText(request,);
      settle({
        modelId: request.modelId,
        ceilingUsd,
        reply,
      },);
      return reply;
    },
    chatJson: async function guardedJson(request,) {
      /**
       The most this call can cost.
       */
      const ceilingUsd = admit({
        modelId: request.modelId,
        messages: request.messages,
      },);
      /**
       What the inner client answered.
       */
      const outcome = await inner.chatJson(request,);
      settle({
        modelId: request.modelId,
        ceilingUsd,
        reply: outcome,
      },);
      return outcome;
    },
  };
}

//endregion Editor fidelity spend guard

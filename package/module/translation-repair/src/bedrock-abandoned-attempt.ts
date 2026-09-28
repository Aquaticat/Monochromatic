import type { BedrockServedId, } from './bedrock-catalog.ts';
import { bedrockAttemptBound, } from './bedrock-cost.ts';
import type { BedrockLedger, } from './bedrock-ledger.ts';
import { reportSpend, } from './spend-line.ts';

//region Bedrock abandoned attempt
// AN ATTEMPT BEDROCK ACCEPTED IS SPEND WHETHER OR NOT IT FINISHED (ledger P1,
// 2026-09-28). The ledger is the only guard on the owner's card, and it noted
// completed calls only: 873 Bedrock streams across the logs ended cut or
// overrun and none reached it. The retry ladder now tells the client of every
// attempt that delivered something and failed, retried ones included, and
// this writes each at its bound, on the SPEND line and in the ledger, before
// the ladder decides anything else about the failure.

/**
 Writes one abandoned attempt at the most it could have been billed.

 @param servedId - model the attempt went to

 @param requestBodyBytes - size of the body the attempt sent

 @param maxTokens - `max_tokens` the body carried

 @param ledger - the spend record the meter is read off

 @example
 ```ts
 await ledgerAbandonedAttempt({ servedId, requestBodyBytes, maxTokens, ledger, },);
 ```
 */
export async function ledgerAbandonedAttempt(
  {
    servedId,
    requestBodyBytes,
    maxTokens,
    ledger,
  }: {
    readonly servedId: BedrockServedId;
    readonly requestBodyBytes: number;
    readonly maxTokens: number;
    readonly ledger: BedrockLedger;
  },
): Promise<void> {
  /**
   The most the attempt could have been billed.
   */
  const bound = bedrockAttemptBound({
    servedId,
    requestBodyBytes,
    maxTokens,
  },);
  reportSpend({
    provider: 'bedrock',
    label: servedId,
    extracted: {
      text: '',
      usage: {
        prompt_tokens: bound.promptTokens,
        completion_tokens: bound.completionTokens,
      },
    },
    costUsd: bound.usd,
    estimated: 'abandoned-bound',
  },);
  await ledger.note({
    at: new Date().toISOString(),
    model: servedId,
    usd: bound.usd,
    promptTokens: bound.promptTokens,
    completionTokens: bound.completionTokens,
    estimated: 'abandoned-bound',
  },);
}

//endregion Bedrock abandoned attempt

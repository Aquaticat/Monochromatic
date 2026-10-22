import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  contextRoot,
  wordForCount,
} from '@monochromatic-dev/translation-repair-typography/ts';
import {
  completionCapFor,
  perModelLimiter,
} from '@monochromatic-dev/translation-repair-shared-contract/ts';
import { isSuccessStatus, } from '@monochromatic-dev/translation-repair-markup/ts';
import {
  formatUsageNote,
  type ModelTransport,
  type TransportReply,
} from '@monochromatic-dev/translation-repair-provider-stream/ts';
import { extractAnthropicCompletion, } from './anthropic-completion.ts';
import { requireWholeAnthropicMessage, } from './anthropic-whole-message.ts';
import { armCallDeadline, } from './call-deadline.ts';
import type {
  ChatTextReply,
  ChatTextRequest,
  ModelCaller,
} from './chat-contract.ts';
import { chatJsonThrough, } from './chat-json-through.ts';
import { buildClaudeBody, } from './claude-body.ts';
import {
  CLAUDE_API_VERSION,
  CLAUDE_AUTH_HEADER,
  CLAUDE_BASE_URL,
  CLAUDE_VERSION_HEADER,
  claudeMessagesUrlFor,
} from './claude-catalog.ts';
import { RETRY_AFTER_HEADER, } from './retry-after-header.ts';
import { failureForReply, } from './request-size-refusal.ts';
import { reportSpend, } from './spend-line.ts';
import {
  DEFAULT_RETRY_POLICY,
  exchangeWithRetry,
  type RetryPolicy,
} from './transient-retry.ts';
import { withoutRefusedKeyBody, } from './direct-client.ts';

//region Claude client
// THE CLIENT OF ANTHROPIC'S OWN API, on the owner's Claude key, for TWO MODELS: Sonnet 5.5 and Haiku 5.5.
//
// THE OWNER, 2026-10-22: "I've added TRANSLATION_REPAIR_CLAUDE_API_KEY . You may use latest Haiku and latest Sonnet
// with this key. This key would have $200 every month so be careful what you use." The key is not model-scoped (it
// lists Opus, Fable and older models), so the lock is in this file: a roster model that is not one of the eight Claude
// cards is refused before any request is built.
//
// A STREAMED MESSAGES CALL over the transport seam, read by the Messages reader Hyper's client uses
// (`anthropic-completion.ts`): `text_delta` is the answer and `thinking_delta` is dropped.

/**
 Logger root for this package's model-facing shell.
 */
const l = contextRoot({ tag: 'translation-repair', },);

/**
 Client surface of the Claude route: the shared one every route has.

 @example
 ```ts
 const client: ClaudeClient = createClaudeClient({ apiKey, transport, },);
 ```
 */
export type ClaudeClient = ModelCaller;

/**
 Builds one client over injected transport, speaking the Messages protocol to Anthropic.

 @param apiKey - key sent as `x-api-key`; never logged

 @param transport - HTTP the client calls over: `fetchTransport` in a run, a recorded one in a test. REQUIRED, since a
 test that left it out would reach the provider

 @param baseUrl - API base address, overridable for tests

 @param perModelConcurrency - bound on concurrent calls to one model; unbounded by default, since the account states
 request and token rates and no concurrency

 @param retryPolicy - transient-retry pacing; tests pass tiny backoffs

 @returns Client surface with chatText and chatJson

 @example
 ```ts
 const client = createClaudeClient({ apiKey: process.env['TRANSLATION_REPAIR_CLAUDE_API_KEY'] ?? '', transport: fetchTransport, },);
 ```
 */
export function createClaudeClient(
  {
    apiKey,
    transport,
    baseUrl = CLAUDE_BASE_URL,
    perModelConcurrency = Number.POSITIVE_INFINITY,
    retryPolicy = DEFAULT_RETRY_POLICY,
  }: {
    readonly apiKey: string;
    readonly transport: ModelTransport;
    readonly baseUrl?: string;
    readonly perModelConcurrency?: number;
    readonly retryPolicy?: RetryPolicy;
  },
): ClaudeClient {
  /**
   Transport that gives a refused key's 401 back without the provider's words.
   */
  const guardedTransport = withoutRefusedKeyBody({ transport, },);

  /**
   Per-model limiter, created lazily for each model.
   */
  const limiterFor = perModelLimiter({ perModelConcurrency, },);

  /**
   Headers shared by every exchange, auth included.
   */
  const headers: Readonly<Record<string, string>> = {
    [CLAUDE_AUTH_HEADER]: apiKey,
    [CLAUDE_VERSION_HEADER]: CLAUDE_API_VERSION,
    'content-type': 'application/json',
  };

  /**
   Refuses a success reply whose event stream stopped before its terminator or reported an error.

   @param attemptReply - one attempt's reply, read before the ladder returns it

   @example
   ```ts
   const reply = await exchangeWithRetry({ provider: 'anthropic', transport, exchange, policy, verify: wholeMessage, },);
   ```
   */
  function wholeMessage(attemptReply: TransportReply,): void {
    if (isSuccessStatus({ status: attemptReply.status, },))
      requireWholeAnthropicMessage({
        provider: 'anthropic',
        bodyText: attemptReply.bodyText,
      },);
  }

  /**
   Free-text chat exchange.

   @param request - exchange to perform

   @mutates request - `JSON.stringify` may invoke toJSON methods or getters while serializing messages and response
   format

   @returns Content text and usage when reported

   @throws {@link ProviderHttpError} on non-success status

   @throws {@link MalformedCompletionError} on a stream that never ended

   @example
   ```ts
   const reply = await client.chatText({ modelId, messages, signal, },);
   ```
   */
  async function chatText(request: ForeignBorrowed<ChatTextRequest>,): Promise<ChatTextReply> {
    /**
     Logger pre-tagged with this function's name.
     */
    const rl = tagged({
      tag: chatText.name,
      l,
    },);

    /**
     Model id as the caller spelled it.
     */
    const servedId = String(request.modelId,);

    return await limiterFor(request.modelId,)(async function performExchange() {
      rl.debug(`-> ${servedId}: ${String(request.messages.length,)} ${
        wordForCount({
          count: request.messages.length,
          one: 'message',
          many: 'messages',
        },)
      }`,);

      /**
       Exactly what goes on the wire, hoisted so its size can be measured.
       */
      const bodyJson = JSON.stringify(buildClaudeBody({
        modelId: servedId,
        messages: request.messages,
        // Conditional spread keeps the member absent instead of undefined.
        ...(request.responseFormat === undefined ? {} : { responseFormat: request.responseFormat, }),
        maxTokens: completionCapFor({
          modelId: request.modelId,
          // Conditional spread keeps the knob absent instead of undefined.
          ...(request.maxTokens === undefined ? {} : { requested: request.maxTokens, }),
        },),
        request,
      },),);

      /**
       Per-exchange deadline armed inside the slot, absent when the caller set none.
       */
      using deadline = request.exchangeTimeoutMs === undefined
        ? undefined
        : armCallDeadline({
          signal: request.signal,
          timeoutMs: request.exchangeTimeoutMs,
          label: servedId,
        },);

      /**
       Raw reply from the transport seam, retried on transient statuses.
       */
      const reply = await exchangeWithRetry({
        provider: 'anthropic',
        transport: guardedTransport,
        exchange: {
          url: claudeMessagesUrlFor({ baseUrl, },),
          label: servedId,
          method: 'POST',
          headers,
          bodyJson,
          signal: (deadline === undefined) ? request.signal : deadline.callSignal,
          wireFormat: 'anthropic',
          captureHeaders: [RETRY_AFTER_HEADER,],
          // Conditional spread keeps the knob absent instead of undefined.
          ...(request.maxAnswerChars === undefined ? {} : { maxAnswerChars: request.maxAnswerChars, }),
        },
        policy: retryPolicy,
        verify: wholeMessage,
      },);
      if (!isSuccessStatus({ status: reply.status, },)) {
        rl.warn(`<- ${servedId}: HTTP ${String(reply.status,)}`,);

        // BYTES RATHER THAN CHARACTERS: this corpus is Chinese.
        throw failureForReply({
          provider: 'anthropic',
          status: reply.status,
          bodyText: reply.bodyText,
          requestBodyBytes: Buffer.byteLength(bodyJson,),
        },);
      }

      /**
       Answer and usage reassembled from the drained event stream.
       */
      const extracted = extractAnthropicCompletion({
        provider: 'anthropic',
        bodyText: reply.bodyText,
      },);

      /**
       Answer length for the completion log line.
       */
      const textLength = extracted.text.length;
      rl.debug(`<- ${servedId}: ${String(textLength,)} ${
        wordForCount({
          count: textLength,
          one: 'char',
          many: 'chars',
        },)
      }${formatUsageNote({ extracted, },)}`,);
      reportSpend({
        provider: 'anthropic',
        label: servedId,
        extracted,
      },);
      return extracted;
    },);
  }

  return {
    chatText,
    chatJson: chatJsonThrough({ chatText, },),
  };
}

//endregion Claude client

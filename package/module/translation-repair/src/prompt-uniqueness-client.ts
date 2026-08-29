import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { readJsonOutcome, } from './chat-json-outcome.ts';
import { MalformedCompletionError, } from './completion-shape.ts';
import type {
  ChatJsonOutcome,
  ChatJsonRequest,
  ChatTextReply,
  ChatTextRequest,
  SyntheticClient,
} from './chat-contract.ts';
import { hashContent, } from './document-node.ts';
import {
  PROMPT_PAYLOAD_MISSING,
  type PromptPayloadStore,
  PromptPayloadStoreError,
} from './prompt-payload-store.ts';

//region Model-prompt uniqueness boundary

/**
 * Logger root for privacy-safe payload reuse telemetry.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 * Serializes JSON-like prompt value with stable object-key order.
 *
 * Arrays preserve semantic order while object construction order does not affect identity.
 *
 * @param value - message value composed from protocol primitives
 *
 * @returns Stable structural serialization
 *
 * @example
 * ```ts
 * const serialized = canonicalPromptValue({ role: 'user', content: 'Hello' });
 * ```
 */
function canonicalPromptValue(value: unknown,): string {
  if (value === null)
    return 'null';
  if ((typeof value) === 'string')
    return JSON.stringify(value,);
  if ((typeof value) === 'number')
    return JSON.stringify(value,);
  if ((typeof value) === 'boolean')
    return JSON.stringify(value,);
  if (Array.isArray(value,)) {
    /**
     * Canonically serialized array items in semantic order.
     */
    const items = value.map(function serializeItem(item,): string {
      return canonicalPromptValue(item,);
    },);
    return `[${items.join(',',)}]`;
  }
  if ((typeof value) === 'object') {
    return `{${Object.entries(value,)
      .toSorted(function byKey(
        [left,],
        [right,],
      ): number {
        return left.localeCompare(right,);
      },)
      .map(function serializeEntry([key, entryValue,],): string {
        return `${JSON.stringify(key,)}:${canonicalPromptValue(entryValue,)}`;
      },)
      .join(',')}}`;
  }
  return JSON.stringify(typeof value,);
}

/**
 * Canonical model and ordered-message identity shared by text and JSON calls.
 *
 * Request metadata is deliberately excluded.
 * Changing response schema,
 * timeout,
 * or output cap does not turn same substantive conversation into independent evidence.
 *
 * @param request - model request whose exact message bytes form prompt
 *
 * @returns Privacy-safe digest used only for duplicate accounting
 *
 * @example
 * ```ts
 * const digest = modelPromptDigest({ request, });
 * ```
 */
export function modelPromptDigest(
  { request, }: ForeignBorrowed<{ readonly request: ChatTextRequest; }>,
): string {
  /**
   * Ordered messages reduced to destination-relevant role and content.
   */
  const messages = request.messages
    .map(function canonicalMessage(message,) {
      return {
        role: message.role,
        content: message.content,
      };
    },);
  return hashContent({
    content: canonicalPromptValue({
      modelId: request.modelId,
      messages,
    },),
  },);
}

/**
 * Prevents one model and one completed prompt from being sampled twice.
 *
 * Concurrent and completed duplicates reuse first payload before second provider call.
 * Provider-level delivery retries remain inside wrapped call;
 * when wrapped call throws without outcome,
 * identity is released so operational recovery may retry it.
 * Any returned outcome claims identity permanently for client lifetime,
 * including schema mismatch or refusal.
 *
 * @param inner - routed provider client performing first unique call
 *
 * @param store - optional durable raw-payload checkpoint across invocations
 *
 * @returns Client enforcing model-prompt uniqueness by reuse
 *
 * @example
 * ```ts
 * const client = promptUniqueClient({ inner, });
 * ```
 */
export function promptUniqueClient(
  {
    inner,
    store,
  }: ForeignBorrowed<{
    readonly inner: SyntheticClient;
    readonly store?: PromptPayloadStore;
  }>,
): SyntheticClient {
  /**
   * Prompt identities mapped to first in-flight or completed provider payload.
   */
  const claimed = new Map<string, Promise<ChatTextReply>>();

  return {
    chatText: async function uniqueText(
      request: ChatTextRequest,
    ): Promise<ChatTextReply> {
      /**
       * Canonical model and prompt identity.
       */
      const promptDigest = modelPromptDigest({ request, },);
      /**
       * Earlier in-flight or completed payload for same identity.
       */
      const existing = claimed.get(promptDigest,);
      if (existing !== undefined) {
        /**
         * Reused payload after owner call completed successfully.
         */
        const reply = await existing;
        l.info(`PROMPT-REUSE source=memory model=${request.modelId} digest=${promptDigest}`,);
        return reply;
      }
      /**
       * Durable payload replay or first provider exchange,
       * claimed synchronously before any await.
       */
      const pending = (async function buyOrResumeText(): Promise<ChatTextReply> {
        /**
         * Durable payload or explicit absence when store is configured.
         */
        const stored = await store?.read({ promptDigest, },)
          ?? PROMPT_PAYLOAD_MISSING;
        if ((typeof stored) !== 'symbol') {
          l.info(`PROMPT-REUSE source=disk model=${request.modelId} digest=${promptDigest}`,);
          return stored;
        }
        /**
         * First provider payload for this prompt identity.
         */
        const reply = await inner.chatText(request,);
        await store?.write({
          promptDigest,
          reply,
        },);
        return reply;
      })();
      claimed.set(
        promptDigest,
        pending,
      );
      try {
        return await pending;
      }
      catch (error) {
        /**
         * Whether provider completed payload or durable store failed after claim.
         */
        const retainsClaim = (error instanceof MalformedCompletionError)
          || (error instanceof PromptPayloadStoreError);
        if (!retainsClaim)
          claimed.delete(promptDigest,);
        throw error;
      }
    },
    chatJson: async function uniqueJson<ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> {
      /**
       * Canonical model and prompt identity.
       */
      const promptDigest = modelPromptDigest({ request, },);
      /**
       * Earlier in-flight or completed payload for same identity.
       */
      const existing = claimed.get(promptDigest,);
      if (existing !== undefined) {
        /**
         * Reused payload after owner call completed successfully.
         */
        const reply = await existing;
        l.info(`PROMPT-REUSE source=memory model=${request.modelId} digest=${promptDigest}`,);
        return readJsonOutcome({
          modelId: request.modelId,
          reply,
          validate: request.validate,
        },);
      }
      /**
       * Durable payload replay or first provider exchange,
       * claimed synchronously before any await.
       */
      const pending = (async function buyOrResumeJson(): Promise<ChatTextReply> {
        /**
         * Durable payload or explicit absence when store is configured.
         */
        const stored = await store?.read({ promptDigest, },)
          ?? PROMPT_PAYLOAD_MISSING;
        if ((typeof stored) !== 'symbol') {
          l.info(`PROMPT-REUSE source=disk model=${request.modelId} digest=${promptDigest}`,);
          return stored;
        }
        /**
         * First provider payload for this prompt identity.
         */
        const reply = await inner.chatText(request,);
        await store?.write({
          promptDigest,
          reply,
        },);
        return reply;
      })();
      claimed.set(
        promptDigest,
        pending,
      );
      try {
        return readJsonOutcome({
          modelId: request.modelId,
          reply: await pending,
          validate: request.validate,
        },);
      }
      catch (error) {
        /**
         * Whether provider completed payload or durable store failed after claim.
         */
        const retainsClaim = (error instanceof MalformedCompletionError)
          || (error instanceof PromptPayloadStoreError);
        if (!retainsClaim)
          claimed.delete(promptDigest,);
        throw error;
      }
    },
    quotas: inner.quotas,
  };
}

//endregion Model-prompt uniqueness boundary

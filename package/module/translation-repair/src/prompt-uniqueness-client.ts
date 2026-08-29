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

//region Model-prompt uniqueness boundary

/**
 * Raised before duplicate model and substantive prompt reaches provider.
 *
 * @example
 * ```ts
 * throw new DuplicateModelPromptError({ modelId: 'hf:moonshotai/Kimi-K3', promptDigest: 'sha256:abc', });
 * ```
 */
export class DuplicateModelPromptError extends Error {
  /**
   * Declares message safe to forward because it carries model id and digest only.
   */
  readonly messageNamesOnly: true = true;

  /**
   * Constructs privacy-safe duplicate identity diagnostic.
   *
   * @param modelId - exact roster identity duplicate would call
   *
   * @param promptDigest - digest of canonical ordered message content
   *
   * @example
   * ```ts
   * new DuplicateModelPromptError({ modelId, promptDigest, });
   * ```
   */
  public constructor(
    {
      modelId,
      promptDigest,
    }: {
      readonly modelId: ChatTextRequest['modelId'];
      readonly promptDigest: string;
    },
  ) {
    super(`model ${modelId} already received prompt ${promptDigest}`,);
    this.name = 'DuplicateModelPromptError';
  }
}

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
 * @returns Client enforcing process-local model-prompt uniqueness by reuse
 *
 * @example
 * ```ts
 * const client = promptUniqueClient({ inner, });
 * ```
 */
export function promptUniqueClient(
  { inner, }: ForeignBorrowed<{ readonly inner: SyntheticClient; }>,
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
      if (existing !== undefined)
        return await existing;
      /**
       * First provider exchange claimed synchronously before any await.
       */
      const pending = inner.chatText(request,);
      claimed.set(
        promptDigest,
        pending,
      );
      try {
        return await pending;
      }
      catch (error) {
        if (!(error instanceof MalformedCompletionError))
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
        return readJsonOutcome({
          modelId: request.modelId,
          reply: await existing,
          validate: request.validate,
        },);
      }
      /**
       * First provider exchange claimed synchronously before any await.
       */
      const pending = inner.chatText(request,);
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
        if (!(error instanceof MalformedCompletionError))
          claimed.delete(promptDigest,);
        throw error;
      }
    },
    quotas: inner.quotas,
  };
}

//endregion Model-prompt uniqueness boundary

import {
  mkdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import type { ChatTextReply, } from './chat-contract.ts';
import { isJsonRecord, } from './json-guard.ts';
import { writeFileAtomic, } from './corpus-run/atomic-write.ts';

//region Durable model-prompt payload store

/**
 * On-disk payload format generation.
 */
const PROMPT_PAYLOAD_VERSION = 1;

/**
 * Domain absence sentinel for prompt without durable payload.
 */
export const PROMPT_PAYLOAD_MISSING: unique symbol = Symbol('prompt-payload-missing',);

/**
 * Raised when durable prompt payload cannot be trusted or written.
 *
 * @example
 * ```ts
 * throw new PromptPayloadStoreError({ promptDigest: 'abc', operation: 'read', });
 * ```
 */
export class PromptPayloadStoreError extends Error {
  /**
   * Declares message safe because it carries digest and operation only.
   */
  readonly messageNamesOnly: true = true;

  /**
   * Constructs privacy-safe durable payload failure.
   *
   * @param promptDigest - model-plus-message digest naming record
   *
   * @param operation - failed store boundary
   *
   * @param cause - underlying filesystem or parse failure
   *
   * @example
   * ```ts
   * new PromptPayloadStoreError({ promptDigest, operation: 'write', cause: error, });
   * ```
   */
  public constructor(
    {
      promptDigest,
      operation,
      cause,
    }: {
      readonly promptDigest: string;
      readonly operation: 'read' | 'write';
      readonly cause?: unknown;
    },
  ) {
    super(
      `prompt payload ${operation} failed for ${promptDigest}`,
      ...(cause === undefined ? [] : [{ cause, },]),
    );
    this.name = 'PromptPayloadStoreError';
  }
}

/**
 * Durable raw payload operations used by prompt memoization.
 */
export type PromptPayloadStore = {
  /**
   * Reads first completed payload for prompt identity.
   */
  readonly read: (args: { readonly promptDigest: string; },) => Promise<
    ChatTextReply | typeof PROMPT_PAYLOAD_MISSING
  >;

  /**
   * Persists first completed payload before exposing it to caller.
   */
  readonly write: (args: {
    readonly promptDigest: string;
    readonly reply: ChatTextReply;
  },) => Promise<void>;
};

/**
 * Whether caught filesystem error reports absent file.
 *
 * @param error - caught read failure
 *
 * @returns Whether record simply does not exist
 *
 * @example
 * ```ts
 * if (isMissingFile({ error, })) return PROMPT_PAYLOAD_MISSING;
 * ```
 */
function isMissingFile({ error, }: { readonly error: unknown; },): boolean {
  return isJsonRecord(error,) && (error.code === 'ENOENT');
}

/**
 * Reads payload text or domain absence sentinel.
 *
 * @param path - digest-derived payload path
 *
 * @param promptDigest - identity used in diagnostics
 *
 * @returns Stored text or missing sentinel
 *
 * @example
 * ```ts
 * const text = await readPayloadText({ path, promptDigest, });
 * ```
 */
async function readPayloadText(
  {
    path,
    promptDigest,
  }: {
    readonly path: string;
    readonly promptDigest: string;
  },
): Promise<string | typeof PROMPT_PAYLOAD_MISSING> {
  try {
    return await readFile(
      path,
      'utf8',
    );
  }
  catch (error) {
    if (isMissingFile({ error, }))
      return PROMPT_PAYLOAD_MISSING;
    throw new PromptPayloadStoreError({
      promptDigest,
      operation: 'read',
      cause: error,
    },);
  }
}

/**
 * Throws standard invalid-record diagnostic.
 *
 * @param promptDigest - record identity
 *
 * @throws {@link PromptPayloadStoreError} always
 *
 * @example
 * ```ts
 * invalidStoredPayload({ promptDigest, });
 * ```
 */
function invalidStoredPayload(
  { promptDigest, }: { readonly promptDigest: string; },
): never {
  throw new PromptPayloadStoreError({
    promptDigest,
    operation: 'read',
  },);
}

/**
 * Validates stored raw reply without admitting arbitrary disk bytes.
 *
 * @param value - parsed stored reply
 *
 * @returns Trusted raw chat reply
 *
 * @throws {@link PromptPayloadStoreError} through caller when invalid
 *
 * @example
 * ```ts
 * const reply = readStoredReply(parsed.reply);
 * ```
 */
function readStoredReply(
  {
    value,
    promptDigest,
  }: {
    readonly value: unknown;
    readonly promptDigest: string;
  },
): ChatTextReply {
  if (!isJsonRecord(value,))
    invalidStoredPayload({ promptDigest, },);
  /**
   * Stored reply fields before primitive validation.
   */
  const {
    text,
    refusal,
    finishReason,
    usage,
  } = value;
  if ((typeof text) !== 'string')
    invalidStoredPayload({ promptDigest, },);
  if ((refusal !== undefined) && ((typeof refusal) !== 'string'))
    invalidStoredPayload({ promptDigest, },);
  if ((finishReason !== undefined) && ((typeof finishReason) !== 'string'))
    invalidStoredPayload({ promptDigest, },);
  /**
   * Validated reply without optional usage.
   */
  const reply = {
    text,
    ...((refusal === undefined) ? {} : { refusal, }),
    ...((finishReason === undefined) ? {} : { finishReason, }),
  };
  if (usage === undefined)
    return reply;
  if (!isJsonRecord(usage,))
    invalidStoredPayload({ promptDigest, },);
  /**
   * Stored usage counts before numeric validation.
   */
  const {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
  } = usage;
  if ((typeof promptTokens) !== 'number')
    invalidStoredPayload({ promptDigest, },);
  if ((typeof completionTokens) !== 'number')
    invalidStoredPayload({ promptDigest, },);
  return {
    ...reply,
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
    },
  };
}

/**
 * Opens privacy-sensitive prompt payload store beneath disposable run root.
 *
 * @param dir - directory dedicated to prompt payload records
 *
 * @returns Durable store keyed by canonical prompt digest
 *
 * @example
 * ```ts
 * const store = promptPayloadStore({ dir: '/tmp/run/prompt-cache', });
 * ```
 */
export function promptPayloadStore(
  { dir, }: { readonly dir: string; },
): PromptPayloadStore {
  return {
    read: async function read(
      { promptDigest, },
    ): Promise<ChatTextReply | typeof PROMPT_PAYLOAD_MISSING> {
      /**
       * Digest-derived record path.
       */
      const path = join(
        dir,
        `${promptDigest}.json`,
      );
      /**
       * Stored JSON text or explicit absence.
       */
      const text = await readPayloadText({
        path,
        promptDigest,
      },);
      if ((typeof text) === 'symbol') {
        if (text === PROMPT_PAYLOAD_MISSING)
          return text;
        invalidStoredPayload({ promptDigest, },);
      }
      try {
        /**
         * Parsed durable payload envelope.
         */
        const parsed: unknown = JSON.parse(text,);
        if (!isJsonRecord(parsed,))
          invalidStoredPayload({ promptDigest, },);
        if (parsed.version !== PROMPT_PAYLOAD_VERSION)
          invalidStoredPayload({ promptDigest, },);
        return readStoredReply({
          value: parsed.reply,
          promptDigest,
        },);
      }
      catch (error) {
        if (error instanceof PromptPayloadStoreError)
          throw error;
        throw new PromptPayloadStoreError({
          promptDigest,
          operation: 'read',
          cause: error,
        },);
      }
    },
    write: async function write(
      {
        promptDigest,
        reply,
      },
    ): Promise<void> {
      try {
        await mkdir(
          dir,
          { recursive: true, },
        );
        await writeFileAtomic({
          path: join(
            dir,
            `${promptDigest}.json`,
          ),
          text: `${JSON.stringify({
            version: PROMPT_PAYLOAD_VERSION,
            reply,
          },)}\n`,
        },);
      }
      catch (error) {
        throw new PromptPayloadStoreError({
          promptDigest,
          operation: 'write',
          cause: error,
        },);
      }
    },
  };
}

//endregion Durable model-prompt payload store

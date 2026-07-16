/**
 * Structured-tool and direct-JSON stream collection.
 *
 * @module
 */

import type {
  AssistantMessageEvent,
  ToolCall,
} from '@earendil-works/pi-ai';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { extractStructuredJson, } from './json.ts';

/**
 * Shared package logger.
 */
const parentLogger = tagged({ tag: 'model-review', },);

/**
 * Stream-collection logger.
 */
const l = tagged({
  tag: 'stream-collection',
  l: parentLogger,
},);

/**
 * Sentinel for stream without tool call.
 */
const NO_TOOL_CALL: unique symbol = Symbol('structured review tool call absent',);

/**
 * Collected initial structured stream result.
 *
 * @example
 * ```ts
 * const result: CollectedStructuredStream = { kind: 'noToolCall', textContent: '' };
 * ```
 */
type CollectedStructuredStream =
  | {
    /**
     * Structured tool discriminant.
     */
    readonly kind: 'toolCall';
    /**
     * Unknown tool arguments retained for caller parser.
     */
    readonly arguments: unknown;
  }
  | {
    /**
     * Missing-tool discriminant.
     */
    readonly kind: 'noToolCall';
    /**
     * Concatenated finalized text blocks.
     */
    readonly textContent: string;
  };

/**
 * Error distinguishing empty direct JSON from malformed JSON.
 *
 * @example
 * ```ts
 * throw new EmptyStructuredReviewTextError();
 * ```
 */
class EmptyStructuredReviewTextError extends Error {
  /**
   * Create stable empty-output error.
   *
   * @example
   * ```ts
   * new EmptyStructuredReviewTextError();
   * ```
   */
  constructor() {
    super('Structured reviewer direct JSON returned no text',);
    this.name = 'EmptyStructuredReviewTextError';
  }
}

/**
 * Consume stream and collect expected tool arguments or finalized text.
 *
 * @param stream - reviewer event stream
 *
 * @param expectedToolName - exact structured tool name
 *
 * @returns structured arguments or missing-tool text
 *
 * @mutates stream - async iteration consumes supplied stream
 *
 * @throws when reviewer calls unexpected tool
 *
 * @example
 * ```ts
 * await collectStructuredStream({ stream, expectedToolName: 'submit_review' });
 * ```
 */
async function collectStructuredStream(
  {
    stream,
    expectedToolName,
  }: {
    readonly stream: ForeignBorrowed<AsyncIterable<AssistantMessageEvent>>;
    readonly expectedToolName: string;
  },
): Promise<CollectedStructuredStream> {
  /* oxlint-disable no-restricted-syntax/no-function-root-let -- Async stream fold updates one tool latch and concatenated finalized text. */
  /**
   * Last structured tool call or absent sentinel.
   */
  let toolCall: ToolCall | typeof NO_TOOL_CALL = NO_TOOL_CALL;
  /**
   * Finalized text emitted by stream.
   */
  let textContent = '';
  /* oxlint-enable no-restricted-syntax/no-function-root-let */

  for await (const event of stream) {
    if (event.type === 'toolcall_end') {
      /**
       * Complete tool call emitted by reviewer.
       */
      const { toolCall: emittedToolCall, } = event;
      if (emittedToolCall.name !== expectedToolName) {
        throw new Error(
          `Structured reviewer called unexpected tool "${emittedToolCall.name}" instead of "${expectedToolName}"`,
        );
      }
      toolCall = emittedToolCall;
    }
    if (event.type === 'text_end')
      textContent += event.content;
  }

  if (toolCall !== NO_TOOL_CALL) {
    return {
      kind: 'toolCall',
      arguments: toolCall.arguments,
    };
  }
  return {
    kind: 'noToolCall',
    textContent,
  };
}

/**
 * Collect direct JSON stream and parse unknown value.
 *
 * @param stream - direct JSON reviewer event stream
 *
 * @param expectedToolName - tolerated expected tool name
 *
 * @returns parsed unknown reviewer value
 *
 * @mutates stream - async iteration consumes supplied stream
 *
 * @throws {@link EmptyStructuredReviewTextError} for empty output
 *
 * @example
 * ```ts
 * await collectDirectJson({ stream, expectedToolName: 'submit_review' });
 * ```
 */
async function collectDirectJson(
  {
    stream,
    expectedToolName,
  }: {
    readonly stream: ForeignBorrowed<AsyncIterable<AssistantMessageEvent>>;
    readonly expectedToolName: string;
  },
): Promise<unknown> {
  /**
   * Collected retry stream.
   */
  const result = await collectStructuredStream({
    stream,
    expectedToolName,
  },);
  if (result.kind === 'toolCall')
    return result.arguments;
  if (result.textContent === '')
    throw new EmptyStructuredReviewTextError();
  return extractStructuredJson(result.textContent,);
}

/**
 * Collect forced tool response and run bounded direct-JSON retries when omitted.
 *
 * @param toolCallStream - initial forced-tool stream
 *
 * @param expectedToolName - exact structured tool name
 *
 * @param createJsonRetryStream - lazy direct-JSON stream factory
 *
 * @returns unknown structured data for caller parser
 *
 * @mutates toolCallStream - async iteration consumes initial stream
 *
 * @mutates createJsonRetryStream - retry factory may update captured transport state
 *
 * @example
 * ```ts
 * await collectStructuredReviewValue({ toolCallStream, expectedToolName, createJsonRetryStream });
 * ```
 */
async function collectStructuredReviewValue(
  {
    toolCallStream,
    expectedToolName,
    createJsonRetryStream,
  }: {
    readonly toolCallStream: ForeignBorrowed<AsyncIterable<AssistantMessageEvent>>;
    readonly expectedToolName: string;
    readonly createJsonRetryStream: ForeignBorrowed<(
      options: { readonly firstAttemptTextContent: string; },
    ) => AsyncIterable<AssistantMessageEvent>>;
  },
): Promise<unknown> {
  /**
   * Initial reviewer response.
   */
  const initialResult = await collectStructuredStream({
    stream: toolCallStream,
    expectedToolName,
  },);
  if (initialResult.kind === 'toolCall')
    return initialResult.arguments;

  /**
   * Per-call logger for transport fallback decisions.
   */
  const innerL = tagged({
    tag: collectStructuredReviewValue.name,
    l,
  },);
  innerL.warn(
    `reviewer omitted ${expectedToolName}; retrying with direct JSON`,
  );
  try {
    return await collectDirectJson({
      stream: createJsonRetryStream({
        firstAttemptTextContent: initialResult.textContent,
      },),
      expectedToolName,
    },);
  }
  catch (error) {
    if (!(error instanceof EmptyStructuredReviewTextError))
      throw error;
    innerL.warn('first direct JSON retry was empty; retrying direct JSON once more',);
    return collectDirectJson({
      stream: createJsonRetryStream({
        firstAttemptTextContent: initialResult.textContent,
      },),
      expectedToolName,
    },);
  }
}

export {
  collectStructuredReviewValue,
  EmptyStructuredReviewTextError,
};

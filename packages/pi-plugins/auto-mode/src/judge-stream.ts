/**
 * Stream collection helpers for judge tool-call and direct JSON responses.
 *
 * @module
 */

import type {
  AssistantMessageEvent,
  ToolCall,
} from '@earendil-works/pi-ai';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { extractJsonVerdict, } from './judge-json.ts';

/**
 * Logger root for auto-mode after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l: parentLogger, },);
 * ```
 */
const parentLogger = tagged({ tag: 'auto-mode', },);

/**
 * Tagged logger for judge stream collection.
 */
const l = tagged({
  tag: 'judge',
  l: parentLogger,
},);

/**
 * Result from consuming a judge stream before deciding whether to retry.
 *
 * Keeps a missing-tool response separate from parsed arguments so the
 * primary judge path can retry directly while the compatibility helper can
 * still parse first-pass text output.
 *
 * @example
 * ```typescript
 * const result: JudgeStreamResult = { kind: 'noToolCall', textContent: '' };
 * ```
 */
type JudgeStreamResult =
  | {
    /**
     * Discriminant for successful `render_verdict` tool extraction.
     */
    readonly kind: 'toolCall';
    /**
     * Parsed arguments from `render_verdict`.
     */
    readonly args: Record<string, string>;
  }
  | {
    /**
     * Discriminant for streams that ended without any tool call.
     */
    readonly kind: 'noToolCall';
    /**
     * Text blocks emitted by the model before the stream ended.
     */
    readonly textContent: string;
  };

/**
 * Lazy retry stream factory used only after the first judge response omits
 * `render_verdict`.
 *
 * @example
 * ```typescript
 * const createJsonRetryStream: JsonRetryStreamFactory = function create() {
 *   return mockStream;
 * };
 * ```
 */
type JsonRetryStreamFactory = (
  options: {
    /**
     * Text from the first response, useful for retry diagnostics.
     */
    readonly firstAttemptTextContent: string;
  },
) => AsyncIterable<AssistantMessageEvent>;

/**
 * Sentinel marking that no `toolcall_end` event has set a stream collector's
 * latch yet.
 *
 * @example
 * ```typescript
 * let toolCall: ToolCall | typeof NO_TOOL_CALL = NO_TOOL_CALL;
 * ```
 */
const NO_TOOL_CALL = Symbol('judge stream render verdict tool call absent',);

/**
 * Error text used when a direct JSON retry emits no content.
 *
 * @example
 * ```typescript
 * throw new Error(JUDGE_JSON_NO_TEXT_ERROR_MESSAGE);
 * ```
 */
const JUDGE_JSON_NO_TEXT_ERROR_MESSAGE =
  'Judge JSON returned no text to parse';

/**
 * Error raised when direct JSON retry transport returns no text blocks.
 *
 * @example
 * ```typescript
 * throw new JudgeJsonNoTextError();
 * ```
 */
class JudgeJsonNoTextError extends Error {
  /**
   * Create a no-text retry error with stable user-facing message text.
   *
   * @example
   * ```typescript
   * const error = new JudgeJsonNoTextError();
   * ```
   */
  constructor() {
    super(JUDGE_JSON_NO_TEXT_ERROR_MESSAGE,);
    this.name = 'JudgeJsonNoTextError';
  }
}

/**
 * Collect verdict arguments from the first tool-call stream via
 * {@link collectJudgeStream}, retrying with direct JSON via
 * {@link collectJsonVerdict} when the judge emits no tool call, then retrying
 * once more after a {@link JudgeJsonNoTextError}.
 *
 * @param toolCallStream - first stream created with `render_verdict` tools
 *
 * @param createJsonRetryStream - factory for a no-tool direct JSON retry stream
 *
 * @returns parsed verdict arguments from either path
 *
 * @mutates toolCallStream - `collectJudgeStream` consumes supplied async iterator state
 *
 * @mutates createJsonRetryStream - invokes retry-stream factory capability, which can change captured state
 *
 * @example
 * ```typescript
 * const args = await collectJudgeVerdictArgs({ toolCallStream, createJsonRetryStream });
 * ```
 */
async function collectJudgeVerdictArgs(
  {
    toolCallStream,
    createJsonRetryStream,
  }: {
    readonly toolCallStream: ForeignBorrowed<AsyncIterable<AssistantMessageEvent>>;
    readonly createJsonRetryStream: ForeignBorrowed<JsonRetryStreamFactory>;
  },
): Promise<Record<string, string>> {
  /**
   * First judge result, either tool arguments or a missing-tool marker.
   */
  const firstResult = await collectJudgeStream(toolCallStream,);
  if (firstResult.kind
    === 'toolCall')
    return firstResult.args;

  /**
   * Per-call sub-logger so the retry warning carries the function name as a tag.
   */
  const innerL = tagged({
    tag: collectJudgeVerdictArgs.name,
    l,
  },);
  innerL.error('judge did not call render_verdict; retrying with direct JSON output',);
  try {
    return await collectJsonVerdict(
      createJsonRetryStream({
        firstAttemptTextContent: firstResult.textContent,
      },),
    );
  }
  catch (error) {
    if (!(error instanceof JudgeJsonNoTextError))
      throw error;

    innerL.error('judge direct JSON retry returned no text; retrying direct JSON once more',);
    return collectJsonVerdict(
      createJsonRetryStream({
        firstAttemptTextContent: firstResult.textContent,
      },),
    );
  }
}

/**
 * Collect a judge stream into either tool arguments or missing-tool text.
 *
 * @param stream - model event stream
 *
 * @returns tool arguments when `render_verdict` was called, otherwise text content
 *
 * @throws when the model calls an unexpected tool
 *
 * @mutates stream - async iteration consumes supplied model stream state
 *
 * @example
 * ```typescript
 * const result = await collectJudgeStream(stream);
 * ```
 */
async function collectJudgeStream(
  stream: ForeignBorrowed<AsyncIterable<AssistantMessageEvent>>,
): Promise<JudgeStreamResult> {
  /* oxlint-disable no-restricted-syntax/no-function-root-let -- async-iteration accumulator latches: `toolCall` set on `toolcall_end`, `textContent` appended on each `text_end`; both are read after the loop terminates */
  /**
   * Last-seen tool call from the stream; the {@link NO_TOOL_CALL} sentinel
   * until a `toolcall_end` event sets it.
   */
  let toolCall: ToolCall | typeof NO_TOOL_CALL = NO_TOOL_CALL;
  /**
   * Cumulative text from `text_end` events, used only when the model never emitted a tool call.
   */
  let textContent = '';
  /* oxlint-enable no-restricted-syntax/no-function-root-let */

  for await (const event of stream) {
    if (event.type
      === 'toolcall_end')
      ({ toolCall, } = event);

    if (event.type
      === 'text_end')
      textContent += event.content;
  }

  if (toolCall !== NO_TOOL_CALL) {
    if (toolCall.name
      !== 'render_verdict') {
      throw new Error(
        `Judge called unexpected tool: "${toolCall.name}" instead of "render_verdict"`,
      );
    }
    return {
      kind: 'toolCall',
      args: toolCall.arguments as Record<string, string>,
    };
  }

  return {
    kind: 'noToolCall',
    textContent,
  };
}

/**
 * Collect direct JSON retry output via {@link collectJudgeStream} and parse
 * it into verdict arguments with {@link extractJsonVerdict}.
 *
 * @param stream - retry stream created without tools
 *
 * @returns parsed JSON verdict arguments
 *
 * @throws {@link JudgeJsonNoTextError} when the retry emits neither a `render_verdict` tool call nor text
 *
 * @mutates stream - `collectJudgeStream` consumes supplied retry stream state
 *
 * @example
 * ```typescript
 * const args = await collectJsonVerdict(stream);
 * ```
 */
async function collectJsonVerdict(
  stream: ForeignBorrowed<AsyncIterable<AssistantMessageEvent>>,
): Promise<Record<string, string>> {
  /**
   * Retry stream result, usually direct text JSON but tolerant of valid tool output.
   */
  const result = await collectJudgeStream(stream,);
  if (result.kind
    === 'toolCall')
    return result.args;

  if (result.textContent === '') {
    throw new JudgeJsonNoTextError();
  }

  return extractJsonVerdict(result.textContent,);
}

/**
 * Collect tool call arguments from a model stream.
 *
 * Uses the pi-ai event protocol: `toolcall_end` carries the complete
 * `ToolCall` with parsed `name` and `arguments`.
 *
 * Uses {@link collectJudgeStream} to read the stream, falling back to
 * {@link extractJsonVerdict} for parsing text content if no tool call was
 * emitted. This compatibility path is kept for direct helper usage;
 * `callJudge` retries direct JSON instead.
 *
 * @param stream - model event stream
 *
 * @returns parsed tool call arguments object
 *
 * @throws when the stream produces neither a `render_verdict` tool call nor parseable text content
 *
 * @mutates stream - `collectJudgeStream` consumes supplied model stream state
 *
 * @example
 * ```typescript
 * const args = await collectToolCall(stream);
 * ```
 */
async function collectToolCall(
  stream: ForeignBorrowed<AsyncIterable<AssistantMessageEvent>>,
): Promise<Record<string, string>> {
  /**
   * Stream result from the shared collector.
   */
  const result = await collectJudgeStream(stream,);

  if (result.kind
    === 'toolCall')
    return result.args;

  if (result.textContent !== '') {
    /**
     * Per-call sub-logger so the text-fallback warning carries the function name as a tag.
     */
    const innerL = tagged({
      tag: collectToolCall.name,
      l,
    },);
    innerL.error(
      'text-fallback fired (model returned text instead of calling render_verdict tool); '
        + 'this indicates the provider ignored toolChoice',
    );
    return extractJsonVerdict(result.textContent,);
  }

  throw new Error(
    'Judge did not call any tool (expected "render_verdict")',
  );
}

export type { JsonRetryStreamFactory, };
export {
  collectJudgeVerdictArgs,
  collectToolCall,
};

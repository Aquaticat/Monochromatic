import type { CompletionUsage, } from '@monochromatic-dev/module-llm-type/ts';

import {
  isJsonArray,
  isJsonRecord,
} from './json-guard.ts';

//region Completion shape
// Provider protocol parsing for chat-completion bodies. A 200 body that fails these
// expectations is a provider defect and throws; what the model wrote inside
// `message.content` is never judged here, that is chatJson's job and flows as data.

/**
 * Character count of the body excerpt embedded in thrown errors,
 * bounding log size while keeping enough context to diagnose.
 */
const BODY_EXCERPT_LIMIT = 600;

/**
 * Signals a non-success HTTP status from the Synthetic API.
 *
 * @example
 * ```ts
 * throw new SyntheticHttpError({ status: 429, bodyText: reply.bodyText, },);
 * ```
 */
export class SyntheticHttpError extends Error {
  /**
   * HTTP status the API returned; drivers branch on 429 for backoff.
   */
  public readonly status: number;

  /**
   * Opening of the response body for diagnosis.
   */
  public readonly bodyExcerpt: string;

  /**
   * Builds failure carrying status and body opening.
   *
   * @param status - non-success HTTP status
   *
   * @param bodyText - raw response body, excerpted for the message
   *
   * @example
   * ```ts
   * new SyntheticHttpError({ status: 500, bodyText: 'upstream exploded', },);
   * ```
   */
  public constructor(
    {
      status,
      bodyText,
    }: {
      readonly status: number;
      readonly bodyText: string;
    },
  ) {
    super(
      `Synthetic API returned HTTP ${String(status,)}: ${
        bodyText.slice(
          0,
          BODY_EXCERPT_LIMIT,
        )
      }`,
    );
    this.name = 'SyntheticHttpError';
    this.status = status;
    this.bodyExcerpt = bodyText.slice(
      0,
      BODY_EXCERPT_LIMIT,
    );
  }
}

/**
 * Signals a success-status completion body that violates the OpenAI-compatible
 * contract; always a provider defect, never a model-content defect.
 *
 * @example
 * ```ts
 * throw new MalformedCompletionError({ detail: 'choices is not an array', },);
 * ```
 */
export class MalformedCompletionError extends Error {
  /**
   * Builds failure naming the violated expectation.
   *
   * @param detail - which contract expectation the body violated
   *
   * @param cause - underlying parse error when JSON itself failed
   *
   * @example
   * ```ts
   * new MalformedCompletionError({ detail: 'body is not valid JSON', cause: error, },);
   * ```
   */
  public constructor(
    {
      detail,
      cause,
    }: {
      readonly detail: string;
      readonly cause?: unknown;
    },
  ) {
    super(
      `Synthetic completion body violated the OpenAI-compatible contract: ${detail}`,
      // Conditional spread keeps cause absent when none was supplied.
      ...(cause === undefined
        ? []
        : [{ cause, },]),
    );
    this.name = 'MalformedCompletionError';
  }
}

/**
 * Text and optional usage extracted from one completion body.
 *
 * @example
 * ```ts
 * const extracted: ExtractedCompletion = { text: '{"issues":[]}', };
 * ```
 */
export type ExtractedCompletion = {
  /**
   * Verbatim `message.content` of the first choice;
   * empty when the API refused and returned no content.
   * Reasoning arrives in a separate field, so content is the answer channel.
   * THAT FIELD'S NAME VARIES BY MODEL on this provider, `reasoning_content` on
   * some and `reasoning` on others, measured 2026-08-21; `stream-delta-scan.ts`
   * carries the per-model counts. Nothing here has to choose between them,
   * because this path reads the answer and never the thinking.
   */
  readonly text: string;

  /**
   * First-class refusal from the message `refusal` field;
   * a stronger signal than any heuristic over content.
   */
  readonly refusal?: string;

  /**
   * Token usage when the server reported it; feeds budget observability.
   * Completion counts include thinking tokens,
   * which dominate output on these models.
   */
  readonly usage?: CompletionUsage;

  /**
   * Why the model stopped, verbatim from `choices[0].finish_reason`.
   *
   * READ BECAUSE A COMPLETION THAT STOPPED EARLY IS INDISTINGUISHABLE FROM A
   * MALFORMED ONE WITHOUT IT. A model cut off mid-answer delivers a whole,
   * well-formed stream with no unreadable frames, and the only symptom
   * downstream is that its content does not parse. Reported as a schema
   * mismatch, that sends a reader to the prompt and the schema; reported as
   * `length`, it sends them to the token ceiling instead. Measured on a live
   * lane-contest round where one voice stopped mid-string at 287 characters.
   *
   * ABSENT RATHER THAN DEFAULTED when the provider omits it, since guessing
   * `stop` would assert the very thing this exists to establish.
   */
  readonly finishReason?: string;
};

/**
 * Reads why one choice stopped, when the provider said.
 *
 * @param choice - one entry of the choices array
 *
 * @returns Spreadable fragment carrying the reason, or nothing
 *
 * @example
 * ```ts
 * const fragment = readFinishReason({ choice, },);
 * ```
 */
export function readFinishReason(
  { choice, }: { readonly choice: Readonly<Record<string, unknown>>; },
): { readonly finishReason?: string; } {
  /**
   * Reason as delivered, which providers may omit or send as null.
   */
  const reason = choice.finish_reason;
  return (((typeof reason) === 'string') && (reason !== ''))
    ? { finishReason: reason, }
    : {};
}

/**
 * Reads optional usage block when both component counts are numbers.
 *
 * @param parsed - whole parsed completion body
 *
 * @returns Usage block, or nothing when absent or mistyped
 *
 * @example
 * ```ts
 * const usage = readUsage({ parsed, },);
 * ```
 */
export function readUsage({ parsed, }: { readonly parsed: Readonly<Record<string, unknown>>; },): {
  readonly usage?: CompletionUsage;
} {
  /**
   * Usage block as delivered, when any.
   */
  const { usage, } = parsed;
  if (!isJsonRecord(usage,))
    return {};

  /**
   * Component token counts pulled out for numeric validation.
   */
  const {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
  } = usage;
  if (((typeof promptTokens) !== 'number') || ((typeof completionTokens) !== 'number'))
    return {};

  return {
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
    },
  };
}

/**
 * Parses body text as JSON, converting parse failures into contract errors.
 *
 * @param bodyText - raw response body
 *
 * @returns Parsed JSON value
 *
 * @throws {@link MalformedCompletionError} when body is not valid JSON
 *
 * @example
 * ```ts
 * const parsed = parseCompletionJson({ bodyText, },);
 * ```
 */
function parseCompletionJson({ bodyText, }: { readonly bodyText: string; },): unknown {
  try {
    return JSON.parse(bodyText,);
  }
  catch (error) {
    throw new MalformedCompletionError({
      detail: 'body is not valid JSON',
      cause: error,
    },);
  }
}

/**
 * Parses and validates one success-status completion body,
 * returning content text and usage.
 *
 * @param bodyText - raw 2xx response body
 *
 * @returns Content of first choice plus usage when reported
 *
 * @throws {@link MalformedCompletionError} when body is not JSON or lacks `choices[0].message.content`
 *
 * @example
 * ```ts
 * const { text, usage, } = extractCompletion({ bodyText: reply.bodyText, },);
 * ```
 */
export function extractCompletion(
  { bodyText, }: { readonly bodyText: string; },
): ExtractedCompletion {
  /**
   * Whole parsed body, probed field by field.
   */
  const parsed = parseCompletionJson({ bodyText, },);
  if (!isJsonRecord(parsed,))
    throw new MalformedCompletionError({ detail: 'body is not a JSON object', },);

  /**
   * Choices array as delivered.
   */
  const { choices, } = parsed;
  if (!isJsonArray(choices,))
    throw new MalformedCompletionError({ detail: 'choices is not an array', },);

  /**
   * First choice; single-completion requests return exactly one.
   */
  const [first,] = choices;
  if (!isJsonRecord(first,))
    throw new MalformedCompletionError({ detail: 'choices[0] is missing', },);

  /**
   * Message block of first choice.
   */
  const { message, } = first;
  if (!isJsonRecord(message,))
    throw new MalformedCompletionError({ detail: 'choices[0].message is not an object', },);

  /**
   * Answer channel plus first-class refusal field as delivered.
   */
  const {
    content,
    refusal,
  } = message;

  /**
   * Non-empty refusal string when the API refused explicitly.
   */
  const refusalText = (((typeof refusal) === 'string') && (refusal !== ''))
    ? refusal
    : undefined;

  if ((typeof content) !== 'string') {
    // A refused completion may carry null content; that is a valid refusal
    // reply, not a contract violation.
    if (refusalText !== undefined) {
      return {
        text: '',
        refusal: refusalText,
        ...readUsage({ parsed, },),
      };
    }
    throw new MalformedCompletionError({ detail: 'choices[0].message.content is not a string', },);
  }

  return {
    text: content,
    // Conditional spread keeps refusal absent when the API did not refuse.
    ...(refusalText === undefined
      ? {}
      : { refusal: refusalText, }),
    ...readUsage({ parsed, },),
    ...readFinishReason({ choice: first, },),
  };
}

//endregion Completion shape

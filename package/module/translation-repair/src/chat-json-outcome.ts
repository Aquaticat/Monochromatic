import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { stripChannelMarker, } from './channel-marker.ts';
import type {
  ChatJsonOutcome,
  ChatTextReply,
} from './chat-contract.ts';
import {
  parseModelJson,
  stripCodeFence,
  stripThinkBlock,
} from './model-content.ts';
import { detectRefusalShape, } from './refusal.ts';

//region Chat json outcome
// HOW A REPLY BECOMES AN OUTCOME, for every provider rather than for one.
//
// Lifted out of `synthetic-client.ts` whole when the second provider arrived.
// Nothing in this ladder is provider-specific: it reads text a model wrote and
// decides whether that text is an answer, a refusal, or a mismatch. Copying it
// into the second client would have been the more obvious move and the worse
// one, because every fix this ladder has taken was a real defect found live,
// and a copy takes none of the next ones.
//
// WHAT IT HAS LEARNED, each step standing for a measured failure:
//
//   The API's own refusal field outranks every heuristic over content.
//
//   The thinking channel is split off before anything judges the text, because
//   deliberation harmlessly contains refusal-like phrasing and would otherwise
//   be read as a refusal.
//
//   Truncation inside thinking is its own outcome, since it sends a reader to
//   the token ceiling rather than to the prompt.
//
//   A channel marker is stripped AND logged, never silently dropped: the
//   2026-08-13 recurrence was diagnosable only because the raw opening had
//   been recorded.
//
//   The fence stripper runs twice, because it cannot see a fence hidden behind
//   a marker, and a reply of a marker then a fenced object would otherwise be
//   lost to the very defect just repaired.
//
//   Content that parses and passes the guard WINS even when it quotes
//   refusal-like phrasing; the refusal scan runs only on parse failure.

/**
 * Logger root for the provider-neutral reply reader.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 * Usage fragment carried onto every outcome, present only when reported.
 *
 * @param reply - reply whose usage is forwarded
 *
 * @returns Spreadable fragment carrying usage, or nothing
 *
 * @example
 * ```ts
 * const spread = usageSpreadOf({ reply, },);
 * ```
 */
function usageSpreadOf(
  { reply, }: { readonly reply: ChatTextReply; },
): Pick<ChatTextReply, 'usage'> {
  /**
   * Usage as the provider reported it, absent when it did not.
   */
  const { usage, } = reply;

  return (usage === undefined) ? {} : { usage, };
}

/**
 * Names why the model stopped, when the provider said, for a mismatch detail.
 *
 * A REPLY THAT STOPPED EARLY IS NOT A MALFORMED ONE, and the two need opposite
 * remediation: a schema mismatch sends a reader to the prompt and the guard,
 * while `length` sends them to the token ceiling. Both arrive here as content
 * that does not parse.
 *
 * @param reply - reply whose stop reason is named
 *
 * @returns Clause to append to a detail, empty when the provider said nothing
 *
 * @example
 * ```ts
 * const stopped = stoppedNote({ reply, },);
 * ```
 */
function stoppedNote(
  { reply, }: { readonly reply: ChatTextReply; },
): string {
  /**
   * Reason as the provider delivered it, absent when it omitted one.
   */
  const { finishReason, } = reply;

  if (finishReason === undefined)
    return '';
  return ` (model stopped with finish_reason=${finishReason})`;
}

/**
 * Reads one raw reply into the outcome a caller acts on.
 *
 * REFUSALS AND MISMATCHES ARE DATA, never exceptions: calling unreliable models
 * is what this pipeline does, so an answer it cannot use is an ordinary result
 * and only provider protocol failures throw. Nothing here throws at all.
 *
 * @param modelId - model that produced this reply, for the log lines only
 *
 * @param reply - raw text reply, whichever provider served it
 *
 * @param validate - caller's guard admitting parsed content
 *
 * @returns Outcome as data: ok, refusal-shaped, or schema-mismatch
 *
 * @example
 * ```ts
 * const outcome = readJsonOutcome({ modelId, reply, validate: isVerdict, },);
 * ```
 */
export function readJsonOutcome<ValueT,>(
  {
    modelId,
    reply,
    validate,
  }: {
    readonly modelId: string;
    readonly reply: ChatTextReply;
    readonly validate: (value: unknown,) => value is ValueT;
  },
): ChatJsonOutcome<ValueT> {
  /**
   * Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: readJsonOutcome.name,
    l,
  },);

  /**
   * Usage spread carried onto every outcome for budget observability.
   */
  const usageSpread = usageSpreadOf({ reply, },);

  // The API's own refusal field outranks every content heuristic.
  if (reply.refusal !== undefined) {
    rl.debug(`${modelId}: refusal-shaped (api-refusal-field)`,);
    return {
      kind: 'refusal-shaped',
      rawText: (reply.text === '') ? reply.refusal : reply.text,
      marker: 'api-refusal-field',
      ...usageSpread,
    };
  }

  /**
   * Answer channel with any embedded thinking block split off;
   * refusal scanning and parsing judge the answer,
   * never the deliberation.
   */
  const {
    answer,
    truncatedThinking,
  } = stripThinkBlock({ text: reply.text, },);

  if (truncatedThinking) {
    rl.debug(`${modelId}: schema-mismatch (truncated thinking)`,);
    return {
      kind: 'schema-mismatch',
      rawText: reply.text,
      detail: 'output was truncated inside its thinking block;'
        + ' raise or omit maxTokens (thinking tokens count against it)',
      ...usageSpread,
    };
  }

  /**
   * Fence-stripped answer, with any truncated channel marker removed and
   * reported rather than silently dropped.
   */
  const {
    content,
    marker,
  } = stripChannelMarker({ text: stripCodeFence({ text: answer, },), },);

  if (marker !== '')
    rl.info(`${modelId}: stripped channel marker ${JSON.stringify(marker,)} ahead of JSON`,);

  /**
   * Parse attempt over the unwrapped answer, fence-stripped a SECOND time
   * because the first pass was looking at the marker.
   */
  const attempt = parseModelJson({
    text: (marker === '') ? content : stripCodeFence({ text: content, },),
  },);

  if (!attempt.parsed) {
    /**
     * Refusal classification of the unparseable answer.
     */
    const scan = detectRefusalShape({ text: answer, },);

    if (scan.refusalShaped) {
      rl.debug(`${modelId}: refusal-shaped (${scan.marker})`,);
      return {
        kind: 'refusal-shaped',
        rawText: reply.text,
        marker: scan.marker,
        ...usageSpread,
      };
    }

    /**
     * Why the model stopped, when the provider said, named in the detail.
     */
    const stopped = stoppedNote({ reply, },);
    rl.debug(`${modelId}: schema-mismatch (unparseable)${stopped}`,);
    return {
      kind: 'schema-mismatch',
      rawText: reply.text,
      detail: `content is not valid JSON: ${attempt.detail}${stopped}`,
      ...usageSpread,
    };
  }

  /**
   * Parsed content awaiting the caller's guard.
   */
  const candidate = attempt.value;

  if (!validate(candidate,)) {
    rl.debug(`${modelId}: schema-mismatch (guard rejected)`,);
    return {
      kind: 'schema-mismatch',
      rawText: reply.text,
      detail: 'content parsed as JSON but failed the caller schema guard',
      ...usageSpread,
    };
  }

  return {
    kind: 'ok',
    value: candidate,
    rawText: reply.text,
    ...usageSpread,
  };
}

//endregion Chat json outcome

/**
 * Session context builder for the judge prompt.
 *
 * Walks the session branch from the last user message,
 * building a structured summary that the judge can use
 * to understand recent activity and detect circumvention.
 *
 * @module
 */

import type {
  ImageContent,
  TextContent,
} from '@earendil-works/pi-ai';
import type {
  ExtensionContext,
  SessionMessageEntry,
} from '@earendil-works/pi-coding-agent';
import {
  BASH_DETAIL_LEN,
  MAX_CONTEXT_TOOLS,
  USER_MSG_HEAD,
  USER_MSG_MAX,
  USER_MSG_TAIL,
} from './constants.ts';
import {
  isTrustEntry,
  isVerdictEntry,
  type VerdictData,
} from './types.ts';

/**
 * Get active trust directives from the session.
 *
 * A `null` data value acts as a reset sentinel (clears all prior directives).
 *
 * @param ctx - extension context with session access
 *
 * @returns array of active trust directive strings
 *
 * @example
 * ```typescript
 * const directives = getTrustDirectives(ctx);
 * ```
 */
function getTrustDirectives(
  ctx: ExtensionContext,
): string[] {
  /** Accumulator for currently-active trust directives. */
  const directives: string[] = [];
  for (const entry of ctx.sessionManager
    .getBranch()) {
    if (isTrustEntry(entry,)) {
      if (entry.data
        === null)
        directives.length = 0;
      else
        directives.push(entry.data,);
    }
  }
  return directives;
}

/**
 * Build a context summary for the LLM judge.
 *
 * Scoped from the last user message, capped at recent tools.
 * Includes verdict outcomes for denied/asked actions so the
 * judge can detect circumvention.
 *
 * @param ctx - extension context with session access
 *
 * @returns formatted context summary string
 *
 * @example
 * ```typescript
 * const context = buildContext(ctx);
 * ```
 */
function buildContext(
  ctx: ExtensionContext,
): string {
  /** Full session branch snapshot, scanned forward and backward below. */
  const branch = ctx.sessionManager
    .getBranch();

  /** Index of the most recent user message; -1 sentinel means none found. */
  const userIdx = branch.findLastIndex(
    function isUserMessage(item,) {
      return (item !== undefined)
        && (item.type
          === 'message')
        && ((item as SessionMessageEntry).message
          .role
          === 'user');
    },
  );

  /** Accumulator for tool-call summary lines. */
  const toolLines: string[] = [];
  /** Queue of in-flight tool calls awaiting their matching toolResult. */
  const pendingCalls: {
    name: string;
    summary: string;
  }[] = [];
  /* oxlint-disable no-restricted-syntax/no-function-root-let -- forward-scan state machine assembling userLine and tracking pendingVerdict across message-entry pairs */
  /** Formatted user-message line; empty when no user message was found. */
  let userLine = '';
  /** Verdict attached to the next tool call, or null when none is pending. */
  let pendingVerdict: VerdictData | null = null;
  /* oxlint-enable no-restricted-syntax/no-function-root-let */

  /** Fallback window size when no user message anchors the scan. */
  const TWENTY = 20;
  /** Tail-window start used when no user message is found in the branch. */
  const tailStart = Math.max(
    0,
    branch.length
      - TWENTY,
  );
  /** Index where the forward scan begins. */
  const start = (userIdx !== (-1)) ? userIdx : tailStart;

  for (let i = start; i < branch
    .length; i++) {
    /** Branch entry under inspection during the forward summary build. */
    const entry = branch[i];
    if (entry === undefined)
      continue;

    if (isVerdictEntry(entry,)) {
      pendingVerdict = entry.data;
      continue;
    }

    if (entry.type
      !== 'message')
      continue;
    /** Narrowed message payload after the entry-type guard. */
    const msg = (entry as SessionMessageEntry).message;

    if (msg.role
      === 'user') {
      /** Plain-text rendering of the user message used for the summary line. */
      const text = extractUserText(msg.content,);
      userLine = `[user] ${abbreviate(text,)}`;
      continue;
    }

    if (msg.role
      === 'assistant') {
      for (const block of msg.content) {
        if (block.type
          === 'toolCall') {
          pendingCalls.push({
            name: block.name,
            summary: summarizeToolCall({
              name: block.name,
              args: block.arguments,
            },),
          },);
        }
      }
      continue;
    }

    if (msg.role
      === 'toolResult') {
      /** Tool call paired with this result, removed from the pending queue. */
      const call = pendingCalls.shift();
      /** Display string for the call: stored summary, or fallback to tool name. */
      const callStr = call?.summary
        ?? msg
        .toolName;

      if ((pendingVerdict !== null) && (pendingVerdict.verdict
        !== 'approve')) {
        toolLines.push(
          `[tool] ${callStr} → ${pendingVerdict.verdict} (${pendingVerdict.reason})`,
        );
      }
      else {
        /** "error" / "ok" suffix derived from the result's error flag. */
        const outcome = msg.isError ? 'error' : 'ok';
        /** Optional bash-only detail suffix appended after the outcome. */
        const detail = msg.toolName
          === 'bash'
          ? bashDetail(msg.content,)
          : '';
        toolLines.push(`[tool] ${callStr} → ${outcome}${detail}`,);
      }
      pendingVerdict = null;
    }
  }

  /** Final summary lines assembled in display order. */
  const lines: string[] = [];
  if (userLine !== '')
    lines.push(userLine,);
  if (toolLines.length
    > MAX_CONTEXT_TOOLS) {
    /** Count of older tool lines elided to fit within the context cap. */
    const omitted = toolLines.length
      - MAX_CONTEXT_TOOLS;
    lines.push(`[${omitted} previous tool calls omitted]`,);
    lines.push(...toolLines.slice(-MAX_CONTEXT_TOOLS,),);
  }
  else {
    lines.push(...toolLines,);
  }

  return lines.join('\n',);
}

//region Internal helpers

/**
 * Extract text from user message content.
 *
 * @param content - the message content (string or array)
 *
 * @returns concatenated text content
 */
function extractUserText(
  content: string | (TextContent | ImageContent)[],
): string {
  if ((typeof content) === 'string')
    return content;
  return content
    .filter(
      function isText(c,): c is TextContent {
        return c.type
          === 'text';
      },
    )
    .map(
      function getText(c,) {
        return c.text;
      },
    )
    .join(' ',);
}

/**
 * Abbreviate a text string to the configured maximum length.
 *
 * @param text - the text to abbreviate
 *
 * @returns the abbreviated text
 */
function abbreviate(
  text: string,
): string {
  if (text.length
    <= USER_MSG_MAX)
    return text;
  return `${
    text.slice(
      0,
      USER_MSG_HEAD,
    )
  }…${text.slice(-USER_MSG_TAIL,)}`;
}

/**
 * Summarize a tool call for the judge context.
 *
 * @returns a one-line summary string
 *
 * @example
 * ```typescript
 * summarizeToolCall({ name: 'bash', args: { command: 'ls -la' } });
 * // => 'bash: ls -la'
 * ```
 */
function summarizeToolCall(
  {
    name,
    args,
  }: {
    name: string;
    args: Record<string, unknown>;
  },
): string {
  /* oxlint-disable typescript/no-unsafe-type-assertion -- untyped tool call arguments */
  if (name === 'bash')
    return `bash: ${(args.command as string | undefined)
      ?? ''}`;
  if ([
    'read',
    'write',
    'edit',
    'grep',
    'find',
    'ls',
  ]
    .includes(name,))
  {
    return `${name} ${(args.path as string | undefined)
      ?? ''}`;
  }
  /* oxlint-enable typescript/no-unsafe-type-assertion */
  return name;
}

/**
 * Extract a brief detail from bash tool result content.
 *
 * @param content - the tool result content blocks
 *
 * @returns a detail suffix, or empty string
 */
function bashDetail(
  content: {
    type: string;
    text?: string;
  }[],
): string {
  /** Flattened text content from all text blocks, used to derive the last line. */
  const text = content
    .filter(
      function hasText(c,) {
        return c.type
          === 'text';
      },
    )
    .map(
      function getText(c,) {
        return c.text
          ?? '';
      },
    )
    .join('',);
  /** Last non-empty trimmed line of bash output, the most informative suffix. */
  const lastLine = text.trim()
    .split('\n',)
    .pop()
    ?.trim()
    ?? '';
  if (lastLine === '')
    return '';
  /** Last line truncated to the configured cap from the right (preserves tail). */
  const trimmed = lastLine.length
    > BASH_DETAIL_LEN
    ? lastLine.slice(-BASH_DETAIL_LEN,)
    : lastLine;
  return ` | ${trimmed}`;
}

//endregion

export {
  buildContext,
  getTrustDirectives,
};

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
  ExtensionContext,
  SessionMessageEntry,
} from '@earendil-works/pi-coding-agent';
import { MAX_CONTEXT_ACTIVITIES, } from './constants.ts';
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
 * Sentinel marking that no verdict entry is awaiting its tool call during the
 * {@link buildContext} scan.
 */
const NO_PENDING_VERDICT = Symbol('no-pending-verdict',);

/**
 * Build a context summary for the LLM judge.
 *
 * Scoped from the last user message, capped at recent activities.
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

  /** Accumulator for activity lines in chronological order. */
  const activityLines: string[] = [];
  /** Queue of in-flight tool calls awaiting their matching toolResult. */
  const pendingCalls: {
    name: string;
    summary: string;
  }[] = [];
  /* oxlint-disable no-restricted-syntax/no-function-root-let -- forward-scan state machine tracking pendingVerdict across message-entry pairs */
  /**
   * Verdict attached to the next tool call; the {@link NO_PENDING_VERDICT}
   * sentinel when none is pending.
   */
  let pendingVerdict: VerdictData | typeof NO_PENDING_VERDICT = NO_PENDING_VERDICT;
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
      /** Plain-text rendering of the user message used for the activity line. */
      const text = extractUserText(msg.content,);
      activityLines.push(`[user] ${text}`,);
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

      if ((pendingVerdict !== NO_PENDING_VERDICT) && (pendingVerdict.verdict
        !== 'approve')) {
        activityLines.push(
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
        activityLines.push(`[tool] ${callStr} → ${outcome}${detail}`,);
      }
      pendingVerdict = NO_PENDING_VERDICT;
    }
  }

  /** Final activity lines capped to the newest entries in the scoped window. */
  return activityLines
    .slice(-MAX_CONTEXT_ACTIVITIES,)
    .join('\n',);
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
  content: string | readonly {
    readonly type: string;
    readonly text?: string;
  }[],
): string {
  if ((typeof content) === 'string')
    return content;
  return content
    .filter(
      function isText(c,) {
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
    .join(' ',);
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
    readonly name: string;
    readonly args: Readonly<Record<string, unknown>>;
  },
): string {
  if (name === 'bash') {
    return `bash: ${
      (typeof args.command) === 'string'
        ? args.command
        : ''
    }`;
  }
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
    return `${name} ${
      (typeof args.path) === 'string'
        ? args.path
        : ''
    }`;
  }
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
  content: readonly {
    readonly type: string;
    readonly text?: string;
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
  return ` | ${lastLine}`;
}

//endregion

export {
  buildContext,
  getTrustDirectives,
};

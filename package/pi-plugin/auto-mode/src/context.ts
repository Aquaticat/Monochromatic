/**
 * Session context builder for the judge prompt.
 *
 * Walks the session branch and selects the larger of the latest user-message
 * activity span and the recent-activity floor, building a structured summary
 * that the judge can use to understand recent activity and detect
 * circumvention.
 *
 * @module
 */

import type {
  ExtensionContext,
  SessionMessageEntry,
} from '@earendil-works/pi-coding-agent';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { CONTEXT_ACTIVITY_FLOOR, } from './constants.ts';
import {
  isTrustEntry,
  isVerdictEntry,
  type VerdictData,
} from './types.ts';

/**
 * Reusable approval lookup result.
 *
 * Uses a positive discriminant so callers must handle missing or superseded
 * approvals explicitly.
 *
 * @example
 * ```typescript
 * const approval: ReusableApproval = { reusable: false };
 * ```
 */
type ReusableApproval =
  | {
    /**
     * Whether session history contains reusable approval.
     */
    readonly reusable: true;
    /**
     * Prior approval reason to surface in audit logs and widgets.
     */
    readonly reason: string;
    /**
     * Approval source used to distinguish judge and user approvals.
     */
    readonly source: 'approve' | 'user-approve';
  }
  | {
    /**
     * Whether session history contains reusable approval.
     */
    readonly reusable: false;
  };

/**
 * Get active trust directives from the session.
 *
 * Walks the branch looking for entries matched by {@link isTrustEntry}.
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
  ctx: ForeignBorrowed<ExtensionContext>,
): string[] {
  /**
   * Accumulator for currently-active trust directives.
   */
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
 * Find reusable approval for an action in current session history.
 *
 * Scans the active branch backward for entries matched by
 * {@link isVerdictEntry} and only reuses approval when latest verdict
 * for the exact action and approval fingerprint is an approval. A later denial
 * for same action and fingerprint disables reuse, so stale approvals cannot
 * override newer user or judge decisions.
 *
 * @param ctx - extension context with session access
 *
 * @param action - exact action description produced by {@link describeAction}
 *
 * @param approvalFingerprint - exact guarded tool-call fingerprint
 *
 * @returns reusable approval metadata, or a negative result
 *
 * @example
 * ```typescript
 * const approval = getReusableApproval({
 *   ctx,
 *   action: 'read .env',
 *   approvalFingerprint: 'abc123',
 * });
 * if (approval.reusable) console.log(approval.reason);
 * ```
 */
function getReusableApproval(
  {
    ctx,
    action,
    approvalFingerprint,
  }: {
    readonly ctx: ForeignBorrowed<ExtensionContext>;
    readonly action: string;
    readonly approvalFingerprint: string;
  },
): ReusableApproval {
  /**
   * Current branch snapshot; entries before forks outside this branch are intentionally ignored.
   */
  const branch = ctx.sessionManager
    .getBranch();

  for (let loopIndex = branch.length
    - 1; loopIndex >= 0; loopIndex--) {
    /**
     * Branch entry inspected while walking newest to oldest.
     */
    const entry = branch[loopIndex];
    if (entry === undefined)
      continue;
    if (!isVerdictEntry(entry,))
      continue;
    /**
     * Verdict payload from matching custom entry.
     */
    const {
      action: verdictAction,
      approvalFingerprint: verdictApprovalFingerprint,
      reason,
      reusedFromVerdict,
      verdict,
    } = entry.data;
    if (verdictAction
      !== action)
      continue;
    if (verdictApprovalFingerprint === undefined)
      return { reusable: false, };
    if (verdictApprovalFingerprint
      !== approvalFingerprint)
      continue;

    if ((verdict
      === 'approve') || (verdict
      === 'user-approve')) {
      return {
        reusable: true,
        reason,
        source: reusedFromVerdict
          ?? verdict,
      };
    }

    return { reusable: false, };
  }

  return { reusable: false, };
}

/**
 * Sentinel marking that no verdict entry is awaiting its tool call during the
 * {@link buildContext} scan.
 */
const NO_PENDING_VERDICT = Symbol('pending verdict entry absent from context',);

/**
 * Build a context summary for the LLM judge.
 *
 * Includes the larger of the latest user-message activity span and the
 * recent-activity floor, selected by {@link selectContextActivityLines}.
 * Renders user lines with {@link extractUserText}, tool-call lines with
 * {@link summarizeToolCall}, and a bash-only detail suffix with
 * {@link bashDetail}.
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
  ctx: ForeignBorrowed<ExtensionContext>,
): string {
  /**
   * Full session branch snapshot, scanned forward below.
   */
  const branch = ctx.sessionManager
    .getBranch();

  /**
   * Accumulator for activity lines in chronological order.
   */
  const activityLines: string[] = [];
  /**
   * Queue of in-flight tool calls awaiting their matching toolResult.
   */
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

  for (const entry of branch) {
    // Branch entry under inspection during the forward summary build.
    if (entry === undefined)
      continue;

    if (isVerdictEntry(entry,)) {
      pendingVerdict = entry.data;
      continue;
    }

    if (entry.type
      !== 'message')
      continue;
    /**
     * Narrowed message payload after the entry-type guard.
     */
    const msg = (entry as SessionMessageEntry).message;

    if (msg.role
      === 'user') {
      /**
       * Plain-text rendering of the user message used for the activity line.
       */
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
      /**
       * Tool call paired with this result, removed from the pending queue.
       */
      const call = pendingCalls.shift();
      /**
       * Display string for the call: stored summary, or fallback to tool name.
       */
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
        /**
         * "error" / "ok" suffix derived from the result's error flag.
         */
        const outcome = msg.isError ? 'error' : 'ok';
        /**
         * Optional bash-only detail suffix appended after the outcome.
         */
        const detail = msg.toolName
          === 'bash'
          ? bashDetail(msg.content,)
          : '';
        activityLines.push(`[tool] ${callStr} → ${outcome}${detail}`,);
      }
      pendingVerdict = NO_PENDING_VERDICT;
    }
  }

  /**
   * Final activity lines selected by max(latest-user span, recent floor).
   */
  return selectContextActivityLines(activityLines,)
    .join('\n',);
}

//region Internal helpers

/**
 * Select judge-context activity lines.
 *
 * Keeps the larger of:
 * - the activity span from latest user message through now
 * - the newest fixed floor of activity lines
 *
 * @param activityLines - chronological activity lines built from session branch
 *
 * @returns selected chronological activity lines for judge context
 *
 * @example
 * ```typescript
 * selectContextActivityLines(['[tool] one', '[user] run', '[tool] two']);
 * ```
 */
function selectContextActivityLines(
  activityLines: readonly string[],
): readonly string[] {
  /**
   * Activity-line index of latest user message, or -1 when none exists.
   */
  const lastUserActivityIndex = activityLines.findLastIndex(
    function isUserActivityLine(activityLine,) {
      return activityLine.startsWith('[user] ',);
    },
  );
  /**
   * Earliest line included by the recent-activity floor.
   */
  const recentFloorStart = Math.max(
    0,
    activityLines.length
      - CONTEXT_ACTIVITY_FLOOR,
  );
  /**
   * Start line for max(latest-user span, recent floor).
   */
  const selectedStart = lastUserActivityIndex === (-1)
    ? recentFloorStart
    : Math.min(
      lastUserActivityIndex,
      recentFloorStart,
    );
  return activityLines.slice(selectedStart,);
}

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
  /**
   * Flattened text content from all text blocks, used to derive the last line.
   */
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
  /**
   * Last non-empty trimmed line of bash output, the most informative suffix.
   */
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
  getReusableApproval,
  getTrustDirectives,
};

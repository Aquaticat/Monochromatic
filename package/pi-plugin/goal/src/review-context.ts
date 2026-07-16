/**
 * Active-branch post-start evidence serialization for completion reviewers.
 *
 * @module
 */

import type {
  ImageContent,
  TextContent,
  ThinkingContent,
  ToolCall,
} from '@earendil-works/pi-ai';
import type {
  SessionEntry,
  SessionMessageEntry,
} from '@earendil-works/pi-coding-agent';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  GOAL_MESSAGE_TYPE,
  GOAL_STATE_ENTRY_TYPE,
} from './constants.ts';
import type {
  GoalReviewEvidence,
  ValidGoalCompletionRequest,
} from './completion-types.ts';
import { isGoalEvent, } from './events.ts';

/**
 * Sentinel for branch entries intentionally excluded from reviewer evidence.
 */
const EVIDENCE_ENTRY_OMITTED: unique symbol = Symbol('goal/evidence-entry-omitted',);

/**
 * Convert text, image, or tool-call blocks to bounded textual evidence.
 *
 * @param content - finalized message content block
 *
 * @returns reviewer-visible text
 *
 * @example
 * ```ts
 * contentBlockText({ type: 'text', text: 'done' });
 * ```
 */
function contentBlockText(
  content: Readonly<TextContent | ImageContent | ToolCall | ThinkingContent>,
): string {
  if (content.type === 'text')
    return content.text;
  if (content.type === 'image')
    return `[image evidence omitted: ${content.mimeType}]`;
  if (content.type === 'thinking')
    return '[private reasoning omitted]';
  return `tool call ${content.name}`;
}

/**
 * Convert string or block-array message content to reviewer text.
 *
 * @param content - finalized message content
 *
 * @returns joined textual evidence
 *
 * @example
 * ```ts
 * messageContentText('done');
 * ```
 */
function messageContentText(
  content: string | readonly (TextContent | ImageContent | ToolCall | ThinkingContent)[],
): string {
  if ((typeof content) === 'string')
    return content;
  return content
    .map(contentBlockText,)
    .join('\n',);
}

/**
 * Detect pending completion call in assistant message excluded from evidence.
 *
 * @param message - finalized assistant message
 *
 * @param toolCallId - pending completion call identity
 *
 * @returns whether assistant message contains pending completion claim
 *
 * @example
 * ```ts
 * assistantContainsToolCall({ message, toolCallId: 'call-1' });
 * ```
 */
function assistantContainsToolCall(
  {
    message,
    toolCallId,
  }: {
    readonly message: ForeignBorrowed<SessionMessageEntry['message']>;
    readonly toolCallId: string;
  },
): boolean {
  if (message.role !== 'assistant')
    return false;
  return message.content
    .some(function matchesToolCall(content,) {
    return (content.type === 'toolCall') && (content.id === toolCallId);
  },);
}

/**
 * Validate visible current-generation goal-message provenance.
 *
 * @param details - unknown custom-message details
 *
 * @param runId - active run identity
 *
 * @param generationId - active generation identity
 *
 * @returns whether details identify visible kickoff or continuation
 *
 * @example
 * ```ts
 * isCurrentGoalMessageDetails({ details, runId: 'run-1', generationId: 'generation-1' });
 * ```
 */
function isCurrentGoalMessageDetails(
  {
    details,
    runId,
    generationId,
  }: {
    readonly details: unknown;
    readonly runId: string;
    readonly generationId: string;
  },
): boolean {
  if ((details === null) || ((typeof details) !== 'object'))
    return false;
  if (!(('runId' in details)
    && ('generationId' in details)
    && ('continuationSequence' in details)
    && ('marker' in details)
    && ('kind' in details))) {
    return false;
  }
  return (details.runId === runId)
    && (details.generationId === generationId)
    && ((typeof details.continuationSequence) === 'number')
    && ((typeof details.marker) === 'string')
    && ((details.kind === 'kickoff') || (details.kind === 'continuation'));
}

/**
 * Serialize one eligible branch entry or return omission sentinel.
 *
 * @param entry - active-branch session entry
 *
 * @param toolCallId - pending completion call excluded from evidence
 *
 * @param runId - current active run identity
 *
 * @param generationId - current active generation identity
 *
 * @returns labeled evidence chunk or omission sentinel
 *
 * @example
 * ```ts
 * serializeEvidenceEntry({ entry, toolCallId: 'call-1' });
 * ```
 */
function serializeEvidenceEntry(
  {
    entry,
    toolCallId,
    runId,
    generationId,
  }: {
    readonly entry: ForeignBorrowed<SessionEntry>;
    readonly toolCallId: string;
    readonly runId: string;
    readonly generationId: string;
  },
): string | typeof EVIDENCE_ENTRY_OMITTED {
  if (entry.type === 'custom_message') {
    if ((entry.customType !== GOAL_MESSAGE_TYPE)
      || (!entry.display)
      || (!isCurrentGoalMessageDetails({
        details: entry.details,
        runId,
        generationId,
      },))) {
      return EVIDENCE_ENTRY_OMITTED;
    }
    return `Goal continuation:\n${messageContentText(entry.content,)}`;
  }
  if (entry.type !== 'message')
    return EVIDENCE_ENTRY_OMITTED;
  /**
   * Finalized agent message stored by selected branch.
   */
  const { message, } = entry;
  if (assistantContainsToolCall({
    message,
    toolCallId,
  },))
    return EVIDENCE_ENTRY_OMITTED;
  if (message.role === 'user')
    return `User:\n${messageContentText(message.content,)}`;
  if (message.role === 'assistant')
    return `Assistant:\n${messageContentText(message.content,)}`;
  if (message.role === 'toolResult')
    return `Finalized tool result ${message.toolName}:\n${messageContentText(message.content,)}`;
  if (message.role === 'bashExecution') {
    if (message.excludeFromContext === true)
      return EVIDENCE_ENTRY_OMITTED;
    return `Shell command ${message.command} (exit ${String(message.exitCode,)}):\n${message.output}`;
  }
  return EVIDENCE_ENTRY_OMITTED;
}

/**
 * Find matching run-start index on selected branch.
 *
 * @param branch - selected active branch
 *
 * @param runId - active run identity
 *
 * @returns matching entry index
 *
 * @throws when active run start is missing from branch
 *
 * @example
 * ```ts
 * findRunStartIndex({ branch, runId: 'run-1' });
 * ```
 */
function findRunStartIndex(
  {
    branch,
    runId,
  }: {
    readonly branch: readonly ForeignBorrowed<SessionEntry>[];
    readonly runId: string;
  },
): number {
  /**
   * Matching run-start entry position.
   */
  const index = branch.findIndex(function isMatchingRunStart(entry,) {
    if ((entry.type !== 'custom') || (entry.customType !== GOAL_STATE_ENTRY_TYPE))
      return false;
    if (!isGoalEvent(entry.data,))
      return false;
    return (entry.data
      .kind
      === 'run_started') && (entry.data
        .runId
        === runId);
  },);
  if (index === (-1))
    throw new Error(`Active goal run start is absent from selected branch: ${runId}`,);
  return index;
}

/**
 * Build reviewer evidence from selected branch after active run start.
 *
 * @param branch - `SessionManager.getBranch()` result
 *
 * @param request - locally validated completion request
 *
 * @returns objective, summary, and finalized post-start chunks
 *
 * @example
 * ```ts
 * buildGoalReviewEvidence({ branch, request });
 * ```
 */
function buildGoalReviewEvidence(
  {
    branch,
    request,
  }: {
    readonly branch: readonly ForeignBorrowed<SessionEntry>[];
    readonly request: ValidGoalCompletionRequest;
  },
): GoalReviewEvidence {
  /**
   * Matching run-start position defining transcript boundary.
   */
  const startIndex = findRunStartIndex({
    branch,
    runId: request.goal
      .runId,
  },);
  /**
   * Active run and generation identities filtering custom messages.
   */
  const {
    runId,
    generationId,
  } = request.goal;
  /**
   * Eligible serialized chunks after current run started.
   */
  const transcriptChunks = branch
    .slice(startIndex + 1,)
    .map(function serializeEntry(entry,) {
      return serializeEvidenceEntry({
        entry,
        toolCallId: request.toolCallId,
        runId,
        generationId,
      },);
    },)
    .filter(function keepEvidenceChunk(
      chunk,
    ): chunk is string {
      return (typeof chunk) === 'string';
    },);
  return {
    objective: request.goal
      .objective,
    summary: request.summary,
    transcriptChunks,
  };
}

export {
  buildGoalReviewEvidence,
  contentBlockText,
  findRunStartIndex,
  isCurrentGoalMessageDetails,
  messageContentText,
  serializeEvidenceEntry,
};

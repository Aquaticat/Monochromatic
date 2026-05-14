/**
 * Compress a session branch using the Morph Compact API.
 *
 * Unlike {@link attemptMorphCompaction} which operates on a
 * {@link SessionBeforeCompactEvent} during pi's automatic compaction hook,
 * this module works directly from branch entries, making it suitable for
 * the `/morph-compact` slash command which reads the session read-only.
 *
 * File tracking XML is intentionally omitted because `computeFileLists` /
 * `formatFileOperations` require `FileOperations` from the compaction event,
 * which is unavailable outside it. The new session starts fresh without it.
 */

import type {
  CompactionEntry,
  ContextUsage,
  SessionEntry,
  SessionMessageEntry,
} from '@earendil-works/pi-coding-agent';
import { chooseCompressionRatio, } from './compaction.ts';
import {
  buildMorphInput,
  extractLatestQuery,
  wrapMorphOutput,
} from './formatting.ts';
import { MorphCompactClient, } from './morph-client.ts';
import {
  convertToLlm,
  serializeConversation,
} from './pi-utils.ts';

//region Types

/**
 * Parameters for {@link compressBranch}.
 */
export type CompressBranchParams = {
  /** All entries on the current session branch. */
  branchEntries: SessionEntry[];
  /** Current context token usage and window size. May be undefined if not yet available. */
  contextUsage?: ContextUsage | undefined;
  /** Morph API key (from env or mcp.json fallback). */
  apiKey: string;
  /** Optional user-provided instructions for compression focus. */
  customInstructions?: string | undefined;
};

/**
 * Message type extracted from {@link SessionMessageEntry}.
 */
type BranchMessage = SessionMessageEntry['message'];

//endregion

//region Entry walking

/**
 * Walk branch entries to find the last compaction and collect
 * post-compaction messages.
 *
 * @param branchEntries - all entries on the current session branch
 *
 * @returns previous compaction summary (if any) and messages after it
 *
 * @example
 * ```typescript
 * const { previousSummary, messages } = walkBranch(entries);
 * ```
 */
function walkBranch(branchEntries: SessionEntry[],): {
  previousSummary: string | undefined;
  messages: BranchMessage[];
} {
  /** Index of the most recent compaction entry; -1 means none seen yet. */
  let lastCompactionIndex = -1;
  /** Summary text recovered from the last compaction entry, when present. */
  let previousSummary: string | undefined = undefined;

  for (
    let index = 0;
    index < branchEntries.length;
    index += 1
  ) {
    /** Branch entry under inspection in the forward pass. */
    const entry = branchEntries[index];
    if (entry === undefined)
      continue;
    if (entry.type === 'compaction') {
      lastCompactionIndex = index;
      previousSummary = (entry as CompactionEntry).summary;
    }
  }

  // Collect all messages from SessionMessageEntry entries
  // after the last compaction (or all messages if no compaction)
  /** First index past the last compaction; iteration anchor for collection. */
  const startIdx = lastCompactionIndex + 1;
  /** Post-compaction messages forwarded into the Morph payload. */
  const messages: BranchMessage[] = [];
  for (
    let index = startIdx;
    index < branchEntries.length;
    index += 1
  ) {
    /** Current entry inspected for message-type extraction. */
    const entry = branchEntries[index];
    if (entry === undefined)
      continue;
    if (entry.type !== 'message')
      continue;
    /** Narrowed alias exposing the message payload typed as BranchMessage. */
    const msgEntry = entry as SessionMessageEntry;
    messages.push(msgEntry.message,);
  }

  return {
    previousSummary,
    messages,
  };
}

//endregion

//region Compression

/**
 * Compress session branch entries using the Morph Compact API.
 *
 * Walks entries to find the last compaction summary and post-compaction
 * messages, serializes them, and calls the Morph Compact API to produce
 * a compressed text string.
 *
 * If there are no new messages but a previous summary exists, returns
 * the previous summary directly (skips the API call to save credits).
 *
 * @param params - compression parameters
 *
 * @returns the full compressed text string (wrapped with Morph XML tags)
 *
 * @throws when there is nothing to compress, the API call fails, or
 *   the compressed output is empty
 *
 * @example
 * ```typescript
 * const text = await compressBranch({
 *   branchEntries: ctx.sessionManager.getBranch(),
 *   contextUsage: ctx.getContextUsage(),
 *   apiKey,
 * });
 * // text contains the Morph-compressed conversation context
 * ```
 */
export async function compressBranch(
  params: CompressBranchParams,
): Promise<string> {
  /** Destructured caller params used in the compression body. */
  const {
    branchEntries,
    contextUsage,
    apiKey,
    customInstructions,
  } = params;

  /** Previous summary plus post-compaction messages recovered from the branch. */
  const {
    previousSummary,
    messages,
  } = walkBranch(branchEntries,);

  // Nothing to compress at all
  if (messages.length === 0 && previousSummary === undefined) {
    throw new Error(
      'Nothing to compress: session has no messages and no previous compaction',
    );
  }

  // No new messages since last compaction; return previous
  // summary directly to avoid wasting Morph credits
  if (messages.length === 0 && previousSummary !== undefined)
    return previousSummary;

  // Serialize messages for Morph input
  /** Plain-text rendering of post-compaction messages fed to Morph. */
  const conversationText = serializeConversation(
    convertToLlm(messages,),
  );
  /** Final prompt body combining prior summary tags and conversation. */
  const input = buildMorphInput(
    conversationText,
    previousSummary,
  );

  /** Latest-intent query forwarded for relevance ranking. */
  const query = extractLatestQuery(
    branchEntries,
    customInstructions,
  );
  /** Adaptive ratio derived from current context pressure. */
  const ratio = chooseCompressionRatio(contextUsage,);

  /** Per-call client constructed with the resolved API key. */
  const client = new MorphCompactClient({
    morphApiKey: apiKey,
  },);
  /** Network response payload from the compact endpoint. */
  const result = await client.compact({
    input,
    query,
    compressionRatio: ratio,
    preserveRecent: 0,
    includeMarkers: true,
    includeLineRanges: true,
  },);

  /** Trimmed compacted body; empty output is treated as failure. */
  const output = result.output?.trim();
  if (output === undefined || output === '') {
    throw new Error(
      'Morph Compact returned empty output: compression failed',
    );
  }

  return wrapMorphOutput(output,);
}

//endregion

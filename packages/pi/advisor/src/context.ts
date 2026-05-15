/**
 * Builds serialized conversation context for Advisor calls.
 *
 * @module
 */

import type { AssistantMessage, } from '@earendil-works/pi-ai';
import {
  convertToLlm,
  serializeConversation,
  type SessionEntry,
} from '@earendil-works/pi-coding-agent';
import {
  ADVISOR_MESSAGE_TYPE,
  ADVISOR_TOOL_NAME,
  CONTEXT_TRUNCATION_MARKER,
} from './constants.ts';
import { latestUserPromptExcerpt, } from './context-user.ts';
import { estimateAdvisorInputTokens, } from './model-cost.ts';
import type {
  AdvisorConfig,
  AdvisorContext,
} from './types.ts';

//region Public API

/** Agent message type accepted by pi's LLM conversion helper. */
type AdvisorAgentMessage = Parameters<typeof convertToLlm>[0][number];

/** Options for building Advisor context. */
export type BuildAdvisorContextOptions = {
  /** Session branch entries from pi. */
  branch: readonly SessionEntry[];
  /** Runtime Advisor configuration. */
  config: AdvisorConfig;
  /** Advisor-model system prompt used for token estimate. */
  advisorSystemPrompt: string;
  /** Current tool call id to omit from serialized context. */
  toolCallId?: string;
};

/**
 * Build deterministic serialized context for an Advisor call.
 *
 * @param options - branch, config, and current tool call metadata
 *
 * @returns serialized context and metadata
 *
 * @example
 * ```typescript
 * const context = buildAdvisorContext({ branch, config, advisorSystemPrompt });
 * ```
 */
export function buildAdvisorContext(
  options: BuildAdvisorContextOptions,
): AdvisorContext {
  /** Agent messages included in the secondary Advisor request. */
  const messages = options
    .branch
    .map(function mapEntry(entry,) {
      return entryToMessage({
        entry,
        includePriorAdvisorResults: options.config.includePriorAdvisorResults,
        ...(options.toolCallId === undefined
          ? {}
          : { currentToolCallId: options.toolCallId, }),
      },);
    },)
    .filter(function isIncludedMessage(message,): message is AdvisorAgentMessage {
      return message !== undefined;
    },);

  /** Serialized conversation produced by pi's compaction utility. */
  const serialized = serializeConversation(convertToLlm(messages,),);
  /** Truncated serialized conversation and metadata. */
  const truncation = truncateContext({
    text: serialized,
    maxChars: options.config.maxContextChars,
  },);
  /** Estimated request input tokens. */
  const estimatedInputTokens = estimateAdvisorInputTokens({
    systemPrompt: options.advisorSystemPrompt,
    contextText: truncation.text,
  },);

  /** Latest user prompt excerpt, omitted when no user prompt exists. */
  const latestExcerpt = latestUserPromptExcerpt(options.branch,);

  return {
    text: truncation.text,
    originalChars: serialized.length,
    finalChars: truncation.text.length,
    truncated: truncation.truncated,
    includedMessageCount: messages.length,
    estimatedInputTokens,
    ...(latestExcerpt === undefined ? {} : { latestUserPromptExcerpt: latestExcerpt, }),
  };
}

/**
 * Truncate context with stable head and tail preservation.
 *
 * @param text - text to truncate
 *
 * @param maxChars - maximum character budget
 *
 * @returns possibly truncated text and flag
 *
 * @example
 * ```typescript
 * truncateContext({ text: 'abcdef', maxChars: 5 });
 * ```
 */
export function truncateContext(
  {
    text,
    maxChars,
  }: {
    text: string;
    maxChars: number;
  },
): {
  text: string;
  truncated: boolean;
} {
  if (text.length <= maxChars) {
    return {
      text,
      truncated: false,
    };
  }

  /** Character budget left after the omission marker. */
  const remainingChars = Math.max(
    0,
    maxChars - CONTEXT_TRUNCATION_MARKER.length,
  );
  /** Head segment length. */
  const headChars = Math.ceil(remainingChars / 2,);
  /** Tail segment length. */
  const tailChars = remainingChars - headChars;

  /** Tail text, empty when no tail budget remains. */
  const tailText = tailChars === 0 ? '' : text.slice(-tailChars,);

  return {
    text: `${
      text.slice(
        0,
        headChars,
      )
    }${CONTEXT_TRUNCATION_MARKER}${tailText}`,
    truncated: true,
  };
}

//endregion Public API

//region Entry conversion

/**
 * Convert one session entry to an Advisor-visible agent message.
 *
 * @param entry - session entry to convert
 *
 * @param includePriorAdvisorResults - whether prior Advisor results should remain visible
 *
 * @param currentToolCallId - current Advisor tool call id to omit
 *
 * @returns Advisor-visible agent message, if entry should be included
 */
function entryToMessage(
  {
    entry,
    includePriorAdvisorResults,
    currentToolCallId,
  }: {
    entry: SessionEntry;
    includePriorAdvisorResults: boolean;
    currentToolCallId?: string;
  },
): AdvisorAgentMessage | undefined {
  if (entry.type === 'message') {
    return filterMessage({
      message: entry.message,
      includePriorAdvisorResults,
      ...(currentToolCallId === undefined ? {} : { currentToolCallId, }),
    },);
  }

  if (entry.type === 'compaction') {
    return {
      role: 'compactionSummary',
      summary: entry.summary,
      tokensBefore: entry.tokensBefore,
      timestamp: new Date(entry.timestamp,).getTime(),
    };
  }

  if (entry.type === 'branch_summary') {
    return {
      role: 'branchSummary',
      summary: entry.summary,
      fromId: entry.fromId,
      timestamp: new Date(entry.timestamp,).getTime(),
    };
  }

  if (entry.type === 'custom_message') {
    if ((!includePriorAdvisorResults) && (entry.customType === ADVISOR_MESSAGE_TYPE))
      return undefined;
    return {
      role: 'custom',
      customType: entry.customType,
      content: entry.content,
      display: entry.display,
      details: entry.details,
      timestamp: new Date(entry.timestamp,).getTime(),
    };
  }

  return undefined;
}

/**
 * Filter current or prior Advisor artifacts from one message when needed.
 *
 * @param message - agent message to filter
 *
 * @param includePriorAdvisorResults - whether prior Advisor results should remain visible
 *
 * @param currentToolCallId - current Advisor tool call id to omit
 *
 * @returns filtered message, if message should be included
 */
function filterMessage(
  {
    message,
    includePriorAdvisorResults,
    currentToolCallId,
  }: {
    message: AdvisorAgentMessage;
    includePriorAdvisorResults: boolean;
    currentToolCallId?: string;
  },
): AdvisorAgentMessage | undefined {
  if (message.role === 'toolResult') {
    if ((currentToolCallId !== undefined) && (message.toolCallId === currentToolCallId))
      return undefined;
    if ((!includePriorAdvisorResults) && (message.toolName === ADVISOR_TOOL_NAME))
      return undefined;
    return message;
  }

  if (message.role !== 'assistant')
    return message;

  /** Assistant content with current Advisor placeholder tool call omitted. */
  const content = message.content.filter(function keepContentBlock(block,) {
    return !(
      (block.type === 'toolCall')
      && (block.name === ADVISOR_TOOL_NAME)
      && (block.id === currentToolCallId)
    );
  },);
  if (content.length === 0)
    return undefined;
  return {
    ...message,
    content,
  } satisfies AssistantMessage;
}

//endregion Entry conversion

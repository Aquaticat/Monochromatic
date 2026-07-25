/**
 * Complete user-visible session-message projection for judge context.
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

import { CONTEXT_MESSAGE_FLOOR, } from './constants.ts';
import { serializeUntrustedDataForJudge, } from './tool-helpers.ts';
import {
  isVerdictEntry,
  type VerdictData,
} from './types.ts';

/**
 * Session message union supplied by Pi branch entries.
 */
type SessionAgentMessage = SessionMessageEntry['message'];

/**
 * JSON-compatible visible message projection.
 */
type VisibleMessage = Readonly<Record<string, unknown>>;

/**
 * Sentinel for session messages hidden from user transcript.
 */
const INVISIBLE_MESSAGE: unique symbol = Symbol('session message is hidden from user transcript',);

/**
 * Copy complete visible text or image block without provider-only signatures.
 *
 * @param block - Pi text or image content block.
 *
 * @returns isolated visible content data.
 */
function visibleTextOrImageContent(
  block: ForeignBorrowed<TextContent | ImageContent>,
): VisibleMessage {
  if (block.type === 'text') {
    return {
      type: block.type,
      text: block.text,
    };
  }
  return {
    type: block.type,
    data: block.data,
    mimeType: block.mimeType,
  };
}

/**
 * Copy complete visible assistant block without provider-only signatures.
 *
 * @param block - Pi assistant content block.
 *
 * @returns isolated visible content data.
 */
function visibleAssistantContent(
  block: ForeignBorrowed<TextContent | ThinkingContent | ToolCall>,
): VisibleMessage {
  if (block.type === 'text')
    return visibleTextOrImageContent(block,);
  if (block.type === 'thinking') {
    return {
      type: block.type,
      thinking: block.thinking,
    };
  }
  return {
    type: block.type,
    name: block.name,
    arguments: block.arguments,
  };
}

/**
 * Copy string or visible text/image content in source order.
 *
 * @param content - User, tool-result, or custom-message content.
 *
 * @returns complete visible content data.
 */
function visibleTextOrImageMessageContent(
  content: ForeignBorrowed<string | readonly (TextContent | ImageContent)[]>,
): string | readonly VisibleMessage[] {
  if ((typeof content) === 'string')
    return content;
  /**
   * Isolated visible blocks in source order.
   */
  const visibleContent: VisibleMessage[] = [];
  for (const block of content)
    visibleContent[visibleContent.length] = visibleTextOrImageContent(block,);
  return visibleContent;
}

/**
 * Project one Pi message to fields visible in interactive transcript.
 *
 * Provider signatures,
 * token usage,
 * timestamps,
 * provider identity,
 * and hidden custom messages are omitted because user does not see them.
 *
 * @param message - Pi session message.
 *
 * @returns visible message data or hidden-message sentinel.
 */
function visibleMessage(
  message: ForeignBorrowed<SessionAgentMessage>,
): VisibleMessage | typeof INVISIBLE_MESSAGE {
  if (message.role === 'user') {
    return {
      role: message.role,
      content: visibleTextOrImageMessageContent(message.content,),
    };
  }
  if (message.role === 'assistant') {
    /**
     * Complete visible assistant blocks in source order.
     */
    const content: VisibleMessage[] = [];
    for (const block of message.content)
      content[content.length] = visibleAssistantContent(block,);
    /**
     * Whether Pi renders stop condition as visible assistant error.
     */
    const showsStopReason = (message.stopReason === 'length')
      || (message.stopReason === 'aborted')
      || (message.stopReason === 'error');
    return {
      role: message.role,
      content,
      ...(showsStopReason ? { stopReason: message.stopReason, } : {}),
      ...((!showsStopReason) || (message.errorMessage === undefined)
        ? {}
        : { errorMessage: message.errorMessage, }),
    };
  }
  if (message.role === 'toolResult') {
    return {
      role: message.role,
      toolName: message.toolName,
      content: visibleTextOrImageMessageContent(message.content,),
      ...(message.details === undefined ? {} : { details: message.details, }),
      isError: message.isError,
    };
  }
  if (message.role === 'bashExecution') {
    return {
      role: message.role,
      command: message.command,
      output: message.output,
      exitCode: message.exitCode,
      cancelled: message.cancelled,
      truncated: message.truncated,
      ...(message.fullOutputPath === undefined ? {} : { fullOutputPath: message.fullOutputPath, }),
    };
  }
  if (message.role === 'custom') {
    if (!message.display)
      return INVISIBLE_MESSAGE;
    return {
      role: message.role,
      customType: message.customType,
      content: visibleTextOrImageMessageContent(message.content,),
      ...(message.details === undefined ? {} : { details: message.details, }),
    };
  }
  if (message.role === 'branchSummary') {
    return {
      role: message.role,
      summary: message.summary,
      fromId: message.fromId,
    };
  }
  if (message.role === 'compactionSummary') {
    return {
      role: message.role,
      summary: message.summary,
      tokensBefore: message.tokensBefore,
    };
  }
  throw new Error('Unsupported Pi session message role.',);
}

/**
 * Attach guard verdict that Pi stores beside corresponding tool result.
 *
 * @param message - Visible tool-result data.
 *
 * @param verdict - Guard decision preceding tool result.
 *
 * @returns visible data plus safety decision context.
 */
function withGuardVerdict({
  message,
  verdict,
}: {
  readonly message: VisibleMessage;
  readonly verdict: ForeignBorrowed<VerdictData>;
},): VisibleMessage {
  return {
    ...message,
    guardVerdict: {
      action: verdict.action,
      verdict: verdict.verdict,
      reason: verdict.reason,
    },
  };
}

/**
 * Sentinel when no guard verdict awaits tool result.
 */
const NO_PENDING_VERDICT: unique symbol = Symbol('guard verdict is not awaiting tool result',);

/**
 * Convert branch entries through same Pi projection used by transcript renderer.
 *
 * @param entries - Active Pi session branch.
 *
 * @returns complete visible messages in chronological order.
 */
function visibleMessages(
  entries: ForeignBorrowed<readonly SessionEntry[]>,
): readonly VisibleMessage[] {
  /**
   * Complete visible messages in chronological order.
   */
  const messages: VisibleMessage[] = [];
  /**
   * Guard verdict awaiting corresponding tool-result message.
   */
  const pendingVerdict: { current: VerdictData | typeof NO_PENDING_VERDICT; } = {
    current: NO_PENDING_VERDICT,
  };
  for (const entry of entries) {
    if (isVerdictEntry(entry,)) {
      pendingVerdict.current = entry.data;
      continue;
    }
    if (entry.type === 'message') {
      /**
       * User-visible fields from current persisted message.
       */
      const projectedVisibleMessage = visibleMessage(entry.message,);
      if (projectedVisibleMessage === INVISIBLE_MESSAGE)
        continue;
      /**
       * Persisted message role used to associate guard verdict.
       */
      const { role, } = entry.message;
      if ((role === 'toolResult')
        && (pendingVerdict.current !== NO_PENDING_VERDICT)) {
        messages[messages.length] = withGuardVerdict({
          message: projectedVisibleMessage,
          verdict: pendingVerdict.current,
        },);
        pendingVerdict.current = NO_PENDING_VERDICT;
        continue;
      }
      messages[messages.length] = projectedVisibleMessage;
      continue;
    }
    if (entry.type === 'custom_message') {
      if (entry.display) {
        messages[messages.length] = {
          role: 'custom',
          customType: entry.customType,
          content: visibleTextOrImageMessageContent(entry.content,),
          ...(entry.details === undefined ? {} : { details: entry.details, }),
        };
      }
      continue;
    }
    if ((entry.type === 'branch_summary') && (entry.summary !== '')) {
      messages[messages.length] = {
        role: 'branchSummary',
        summary: entry.summary,
        fromId: entry.fromId,
      };
      continue;
    }
    if (entry.type === 'compaction') {
      messages[messages.length] = {
        role: 'compactionSummary',
        summary: entry.summary,
        tokensBefore: entry.tokensBefore,
      };
    }
  }
  return messages;
}

/**
 * Locate latest user message in visible transcript.
 *
 * @param messages - Complete chronological visible messages.
 *
 * @returns latest user-message index or negative one.
 */
function latestUserMessageIndex(
  messages: readonly VisibleMessage[],
): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    /**
     * Candidate visible message.
     */
    const message = messages[index];
    if ((message !== undefined) && (message.role === 'user'))
      return index;
  }
  return -1;
}

/**
 * Select larger of newest message floor and span from latest user message.
 *
 * @param messages - Complete chronological visible messages.
 *
 * @returns selected complete message window.
 */
function visibleMessageWindow(
  messages: readonly VisibleMessage[],
): readonly VisibleMessage[] {
  /**
   * Latest visible user-message index.
   */
  const latestUserIndex = latestUserMessageIndex(messages,);
  /**
   * Earliest index retaining newest message floor.
   */
  const floorStart = Math.max(
    0,
    messages.length - CONTEXT_MESSAGE_FLOOR,
  );
  /**
   * Earlier start retains larger of both windows.
   */
  const start = latestUserIndex === (-1)
    ? floorStart
    : Math.min(
      latestUserIndex,
      floorStart,
    );
  /**
   * Isolated selected message references in source order.
   */
  const selected: VisibleMessage[] = [];
  for (let index = start; index < messages.length; index += 1) {
    /**
     * Selected visible message.
     */
    const message = messages[index];
    if (message !== undefined)
      selected[selected.length] = message;
  }
  return selected;
}

/**
 * Build canonical JSON for complete visible judge-context message window.
 *
 * @param entries - Active Pi session branch.
 *
 * @returns canonical request-only JSON transcript.
 *
 * @example
 * ```ts
 * buildVisibleContext(entries);
 * ```
 */
function buildVisibleContext(
  entries: ForeignBorrowed<readonly SessionEntry[]>,
): string {
  /**
   * Complete selected visible message window.
   */
  const selectedMessages = visibleMessageWindow(
    visibleMessages(entries,),
  );
  return selectedMessages.length === 0
    ? ''
    : serializeUntrustedDataForJudge(selectedMessages,);
}

export { buildVisibleContext, };

/**
 Per-role transcript visibility keeps earlier activity separate from executable proposals. @module
 */
import type {
  ImageContent,
  TextContent,
  ToolCall
} from '@earendil-works/pi-ai';
import type {sessionEntryToContextMessages} from '@earendil-works/pi-coding-agent';
import {tagged} from '@monochromatic-dev/module-logger/ts';
import type {ForeignBorrowed} from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import {projectHistoricalReviewInput} from './review-operation.ts';
import {projectProcessResultDetails} from './review-process-result.ts';
/**
 Role diagnostics identify visibility the installed host declarations cannot establish.
 */
const l=tagged({tag:'auto-mode-visible-message'});
/**
 Message union produced by Pi's session-entry projection.
 */
type SessionAgentMessage = ReturnType<typeof sessionEntryToContextMessages>[number];

/**
 JSON-compatible visible message projection.
 */
export type VisibleMessage = Readonly<Record<string, unknown>>;

/**
 Sentinel for session messages hidden from user transcript.
 */
export const INVISIBLE_MESSAGE: unique symbol = Symbol('session message is hidden from user transcript',);

/**
 Copy complete visible text or image block without provider-only signatures.
 
 @param block - Pi text or image content block.
 
 @returns isolated visible content data.
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
 Copy complete visible assistant block without provider-only signatures.
 
 @param block - Pi assistant content block.
 
 @returns isolated visible content data.
 */
function visibleAssistantContent(
  block: ForeignBorrowed<TextContent | ToolCall>,
): VisibleMessage {
  if (block.type === 'text')
    return visibleTextOrImageContent(block,);
  return {
    type: block.type,
    name: block.name,
    arguments: projectHistoricalReviewInput({
      name: block.name,
      input: block.arguments,
    }),
  };
}

/**
 Copy string or visible text/image content in source order.
 
 @param content - User, tool-result, or custom-message content.
 
 @returns complete visible content data.
 */
function visibleTextOrImageMessageContent(
  content: ForeignBorrowed<string | readonly (TextContent | ImageContent)[]>,
): string | readonly VisibleMessage[] {
  if ((typeof content) === 'string')
    return content;
  /**
   Isolated visible blocks in source order.
   */
  const visibleContent: VisibleMessage[] = [];
  for (const block of content)
    visibleContent[visibleContent.length] = visibleTextOrImageContent(block,);
  return visibleContent;
}

/**
 Omit message whose role this build does not project.

 Mirrors Pi's interactive renderer,
 which checks role exhaustiveness at compile time and draws nothing for unknown roles at runtime.
 Parameter type `never` makes `lint:types` fail once installed Pi declarations add a role,
 while a newer running Pi degrades to omission instead of failing every guarded tool call.
 Omission only removes judge context;
 it cannot fabricate user authorization.

 @param message - Pi message outside every role handled by {@link visibleMessage}.

 @returns hidden-message sentinel.

 @example
 ```ts
 omitUnknownRoleMessage(message);
 ```
 */
function omitUnknownRoleMessage(
  message: never,
): typeof INVISIBLE_MESSAGE {
  /**
   Role name reported by newer Pi runtime.
   */
  const { role, } = message as { readonly role?: unknown; };
  l.warn(
    `omitting Pi session message with role ${
      JSON.stringify(role,)
    } from judge context: auto-mode does not know which of its fields the transcript shows`,
  );
  return INVISIBLE_MESSAGE;
}

/**
 Project one Pi message to fields visible in interactive transcript.
 
 Provider signatures,
 token usage,
 timestamps,
 provider identity,
 system messages,
 and hidden custom messages are omitted because user does not see them.
 
 @param message - Pi session message.
 
 @returns visible message data or hidden-message sentinel.

 @example
 visibleMessage({role:'user',content:'Original received text',timestamp:0});
 */
export function visibleMessage(
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
     Complete visible assistant blocks in source order.
     */
    const content: VisibleMessage[] = [];
    for (const block of message.content) {
      if (block.type === 'thinking')
        continue;
      content[content.length] = visibleAssistantContent(block,);
    }
    /**
     Whether Pi renders stop condition as visible assistant error.
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
      ...(message.details === undefined ? {} : { details: projectProcessResultDetails({
        details:message.details,
        process:message.toolName==='process'
      }), }),
      isError: message.isError,
    };
  }
  if (message.role === 'bashExecution') {
    return {
      role: message.role,
      ...projectHistoricalReviewInput({
        name: 'bash',
        input: { command: message.command, },
      }),
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
      ...(message.details === undefined ? {} : { details: projectProcessResultDetails({
        details:message.details,
        process:message.customType==='ad-process:notification'
      }), }),
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
  // Pi 0.87 persists system prompt and tool loadout as system messages;
  // interactive transcript renderer draws nothing for them.
  if (message.role === 'system')
    return INVISIBLE_MESSAGE;
  return omitUnknownRoleMessage(message,);
}

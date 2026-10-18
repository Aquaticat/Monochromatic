/** Disposable transcript fixtures exercise maintained built projection. @module */
import {sessionEntryToContextMessages,type SessionEntry} from '@earendil-works/pi-coding-agent';
import {buildVisibleContext as buildContext,VERDICT_ENTRY_TYPE,type VerdictData} from '../dist/final/node/index.mjs';
import type {MockBranchEntry} from './visible-context-fixture-types.ts';

//region Test fixtures

/** Number of repeated tokens in long-message fixtures. */
export const LONG_TEXT_REPEAT_COUNT = 80;

/** Number of bash tool activities generated for window tests. */
export const BASH_ACTIVITY_COUNT = 6;

/** Minimum newest visible messages retained by context window. */
export const EXPECTED_MESSAGE_FLOOR = 5;



/** Bind the actual Pi projector to deliberately incomplete legacy and future session fixtures.
 @param branch - disposable nonstandard session entries
 @returns built projection input retaining original runtime conversion
 */
export function contextFromBranch({branch}:{readonly branch:readonly MockBranchEntry[]}):Parameters<typeof buildContext>[0]{
 // These fixtures intentionally include shapes absent from current Pi declarations.
 return {entries:branch as unknown as readonly SessionEntry[],project:sessionEntryToContextMessages};
}

/**
 Build user message entry.
 
 @param content - user text
 
 @returns session message entry
 
 @example
 ```typescript
 userMessage('run tests');
 ```
 */
export function userMessage(
  content: string,
): MockBranchEntry {
  return {
    type: 'message',
    message: {
      role: 'user',
      content,
    },
  };
}

/**
 Build assistant tool-call entry.
 
 @param name - tool name
 @param args - tool arguments
 
 @returns assistant message entry
 
 @example
 ```typescript
 assistantToolCall({ name: 'bash', args: { command: 'echo 1' } });
 ```
 */
export function assistantToolCall(
  {
    name,
    args,
  }: {
    readonly name: string;
    readonly args: Readonly<Record<string, unknown>>;
  },
): MockBranchEntry {
  return {
    type: 'message',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'toolCall',
          name,
          arguments: args,
        },
      ],
    },
  };
}

/**
 Build tool-result entry.
 
 @param toolName - tool name
 @param output - tool output text
 @param isError - whether tool execution errored
 @param details - renderer-visible tool details
 
 @returns tool-result message entry
 
 @example
 ```typescript
 toolResult({ toolName: 'bash', output: 'ok' });
 ```
 */
export function toolResult(
  {
    toolName,
    output,
    isError = false,
    details,
  }: {
    readonly toolName: string;
    readonly output: string;
    readonly isError?: boolean;
    readonly details?: unknown;
  },
): MockBranchEntry {
  return {
    type: 'message',
    message: {
      role: 'toolResult',
      toolName,
      isError,
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
      ...(details === undefined ? {} : { details, }),
    },
  };
}

/**
 Build bash tool-call and result entries.
 
 @param activityNumber - generated activity number
 
 @returns assistant/tool-result pair
 
 @example
 ```typescript
 bashActivity(1);
 ```
 */
export function bashActivity(
  activityNumber: number,
): readonly [MockBranchEntry, MockBranchEntry,] {
  return [
    assistantToolCall({
      name: 'bash',
      args: { command: `echo ${activityNumber}`, },
    },),
    toolResult({
      toolName: 'bash',
      output: `result ${activityNumber}`,
    },),
  ];
}

/**
 Build auto-mode verdict entry.
 
 @param data - verdict payload stored in session history
 
 @returns verdict branch entry
 
 @example
 ```typescript
 verdictEntry({
   action: 'read .env',
   verdict: 'user-approve',
   reason: 'Allowed',
 });
 ```
 */
export function verdictEntry(
  data: VerdictData,
): MockBranchEntry {
  return {
    type: 'custom',
    customType: VERDICT_ENTRY_TYPE,
    data,
  };
}

/**
 Minimal parsed visible-message shape used for window assertions.
 */
type ParsedVisibleMessage = {
  /** Message role discriminator. */
  readonly role: string;
};

/**
 Parse and validate canonical visible-message context.
 
 @param context - JSON context emitted by {@link buildContext}.
 
 @returns validated visible messages.
 */
export function parseVisibleMessages(
  context: string,
): readonly ParsedVisibleMessage[] {
  /** Parsed context at untrusted JSON boundary. */
  const parsed: unknown = JSON.parse(context,);
  if (!Array.isArray(parsed,))
    throw new Error('Expected judge context to contain JSON message array.',);
  /** Validated message entries. */
  const messages: ParsedVisibleMessage[] = [];
  for (const rawMessage of parsed) {
    /** Current untrusted array element. */
    const message: unknown = rawMessage;
    if (((typeof message) !== 'object')
      || (message === null)
      || (!('role' in message))
      || ((typeof message.role) !== 'string'))
      throw new Error('Expected judge context message with string role.',);
    messages[messages.length] = { role: message.role, };
  }
  return messages;
}

//endregion Test fixtures

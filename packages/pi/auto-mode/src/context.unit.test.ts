/**
 * Tests for judge context construction.
 *
 * Covers activity capping, user-message preservation, and untruncated text
 * emitted into the recent-activity prompt section.
 */

import type { ExtensionContext, } from '@earendil-works/pi-coding-agent';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import { MAX_CONTEXT_ACTIVITIES, } from './constants.ts';
import { buildContext, } from './context.ts';

//region Test fixtures

/** Number of repeated tokens in long-message fixtures. */
const LONG_TEXT_REPEAT_COUNT = 80;

/** Number of bash tool activities generated for cap tests. */
const BASH_ACTIVITY_COUNT = 6;

/** Text block shape consumed by {@link buildContext}. */
type MockTextBlock = {
  /** Message block discriminator. */
  readonly type: 'text';
  /** Text payload. */
  readonly text: string;
};

/** Tool-call block shape consumed by {@link buildContext}. */
type MockToolCallBlock = {
  /** Assistant block discriminator. */
  readonly type: 'toolCall';
  /** Tool name. */
  readonly name: string;
  /** Tool arguments. */
  readonly arguments: Readonly<Record<string, unknown>>;
};

/** Message shapes used by the context scanner. */
type MockMessage =
  | {
    /** User-message role. */
    readonly role: 'user';
    /** User content. */
    readonly content: string | readonly MockTextBlock[];
  }
  | {
    /** Assistant-message role. */
    readonly role: 'assistant';
    /** Assistant tool-call blocks. */
    readonly content: readonly MockToolCallBlock[];
  }
  | {
    /** Tool-result role. */
    readonly role: 'toolResult';
    /** Tool name reported by Pi. */
    readonly toolName: string;
    /** Whether tool execution errored. */
    readonly isError: boolean;
    /** Tool result content. */
    readonly content: readonly MockTextBlock[];
  };

/** Branch-entry shapes used by the context scanner. */
type MockBranchEntry =
  | {
    /** Session entry discriminator. */
    readonly type: 'message';
    /** Session message. */
    readonly message: MockMessage;
  }
  | {
    /** Verdict entry discriminator. */
    readonly type: 'auto-mode:verdict';
    /** Verdict data attached to next tool result. */
    readonly data: {
      /** Guarded action. */
      readonly action: string;
      /** Verdict value. */
      readonly verdict: 'deny';
      /** Verdict reason. */
      readonly reason: string;
    };
  };

/**
 * Build minimal extension context for context-scanner tests.
 *
 * @param branch - mock session branch entries
 *
 * @returns extension context with only session access populated
 *
 * @example
 * ```typescript
 * const ctx = contextFromBranch({ branch: [userMessage('hi')] });
 * ```
 */
function contextFromBranch(
  {
    branch,
  }: {
    readonly branch: readonly MockBranchEntry[];
  },
): ExtensionContext {
  return {
    sessionManager: {
      getBranch() {
        return branch;
      },
    },
  } as unknown as ExtensionContext;
}

/**
 * Build user message entry.
 *
 * @param content - user text
 *
 * @returns session message entry
 *
 * @example
 * ```typescript
 * userMessage('run tests');
 * ```
 */
function userMessage(
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
 * Build assistant tool-call entry.
 *
 * @param name - tool name
 * @param args - tool arguments
 *
 * @returns assistant message entry
 *
 * @example
 * ```typescript
 * assistantToolCall({ name: 'bash', args: { command: 'echo 1' } });
 * ```
 */
function assistantToolCall(
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
 * Build tool-result entry.
 *
 * @param toolName - tool name
 * @param output - tool output text
 * @param isError - whether tool execution errored
 *
 * @returns tool-result message entry
 *
 * @example
 * ```typescript
 * toolResult({ toolName: 'bash', output: 'ok' });
 * ```
 */
function toolResult(
  {
    toolName,
    output,
    isError = false,
  }: {
    readonly toolName: string;
    readonly output: string;
    readonly isError?: boolean;
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
    },
  };
}

/**
 * Build bash tool-call and result entries.
 *
 * @param activityNumber - generated activity number
 *
 * @returns assistant/tool-result pair
 *
 * @example
 * ```typescript
 * bashActivity(1);
 * ```
 */
function bashActivity(
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

//endregion Test fixtures

await describe({
  name: buildContext.name,
  children: [
    it({
      name: 'keeps full user message text',
      fn: async function testKeepsFullUserMessageText(): Promise<void> {
        /** Long user message that previously exceeded abbreviation limits. */
        const longUserText = `prefix ${'message '.repeat(LONG_TEXT_REPEAT_COUNT,)} suffix`;
        /** Context built from a branch containing only long user text. */
        const context = buildContext(
          contextFromBranch({ branch: [userMessage(longUserText,),], },),
        );

        expect(context,).toBe(`[user] ${longUserText}`);
        expect(context.includes('…',),).toBe(false,);
      },
    },),

    it({
      name: 'caps scoped activities at five while preserving user anchor',
      fn: async function testCapsScopedActivitiesAtFive(): Promise<void> {
        /** Generated activities after the latest user message. */
        const generatedActivities = Array.from(
          { length: BASH_ACTIVITY_COUNT, },
          function createActivity(_, activityIndex,) {
            return bashActivity(activityIndex + 1,);
          },
        )
          .flat();
        /** Context built from old activity, latest user request, and six tools. */
        const context = buildContext(
          contextFromBranch({
            branch: [
              userMessage('old request',),
              ...bashActivity(0,),
              userMessage('new request',),
              ...generatedActivities,
            ],
          },),
        );
        /** Activity lines sent to the judge. */
        const lines = context.split('\n',);

        expect(lines,).toHaveLength(MAX_CONTEXT_ACTIVITIES,);
        expect(lines[0],).toBe('[user] new request',);
        expect(context.includes('old request',),).toBe(false,);
        expect(context.includes('result 1',),).toBe(false,);
        expect(context.includes('result 2',),).toBe(false,);
        expect(context.includes('result 3',),).toBe(true,);
        expect(context.includes('result 6',),).toBe(true,);
      },
    },),

    it({
      name: 'keeps full bash detail line',
      fn: async function testKeepsFullBashDetailLine(): Promise<void> {
        /** Long final bash line that previously exceeded detail limits. */
        const finalLine = `final ${'detail '.repeat(LONG_TEXT_REPEAT_COUNT,)} suffix`;
        /** Context built from a bash result whose final line should remain complete. */
        const context = buildContext(
          contextFromBranch({
            branch: [
              userMessage('run command',),
              assistantToolCall({
                name: 'bash',
                args: { command: 'printf detail', },
              },),
              toolResult({
                toolName: 'bash',
                output: `first line\n${finalLine}`,
              },),
            ],
          },),
        );

        expect(context,).toContain(finalLine,);
        expect(context.endsWith(finalLine,),).toBe(true,);
      },
    },),
  ],
},);

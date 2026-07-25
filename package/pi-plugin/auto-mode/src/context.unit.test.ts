/**
 * Tests for judge context construction.
 *
 * Covers visible-message windows,
 * complete transcript data,
 * hidden provider metadata,
 * and reusable approvals.
 */

import type { ExtensionContext, } from '@earendil-works/pi-coding-agent';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  buildContext,
  getReusableApproval,
  VERDICT_ENTRY_TYPE,
  type VerdictData,
} from '../dist/final/node/index.mjs';

//region Test fixtures

/** Number of repeated tokens in long-message fixtures. */
const LONG_TEXT_REPEAT_COUNT = 80;

/** Number of bash tool activities generated for window tests. */
const BASH_ACTIVITY_COUNT = 6;

/** Minimum newest visible messages retained by context window. */
const EXPECTED_MESSAGE_FLOOR = 5;

/** Approval fingerprint for read .env fixtures. */
const READ_ENV_APPROVAL_FINGERPRINT = 'read-env-fingerprint';

/** Approval fingerprint for read .env.example fixtures. */
const READ_ENV_EXAMPLE_APPROVAL_FINGERPRINT = 'read-env-example-fingerprint';

/** Text block shape consumed by {@link buildContext}. */
type MockTextBlock = {
  /** Message block discriminator. */
  readonly type: 'text';
  /** Text payload. */
  readonly text: string;
};

/** Image block shape consumed by {@link buildContext}. */
type MockImageBlock = {
  /** Message block discriminator. */
  readonly type: 'image';
  /** Complete encoded image data. */
  readonly data: string;
  /** Image media type. */
  readonly mimeType: string;
};

/** Thinking block shape consumed by {@link buildContext}. */
type MockThinkingBlock = {
  /** Assistant block discriminator. */
  readonly type: 'thinking';
  /** Complete visible reasoning text. */
  readonly thinking: string;
  /** Provider-only signature that judge context must omit. */
  readonly thinkingSignature?: string;
};

/** Tool-call block shape consumed by {@link buildContext}. */
type MockToolCallBlock = {
  /** Assistant block discriminator. */
  readonly type: 'toolCall';
  /** Tool-call identifier. */
  readonly id?: string;
  /** Tool name. */
  readonly name: string;
  /** Tool arguments. */
  readonly arguments: Readonly<Record<string, unknown>>;
  /** Provider-only signature that judge context must omit. */
  readonly thoughtSignature?: string;
};

/** Message shapes used by the context scanner. */
type MockMessage =
  | {
    /** User-message role. */
    readonly role: 'user';
    /** User content. */
    readonly content: string | readonly (MockTextBlock | MockImageBlock)[];
  }
  | {
    /** Assistant-message role. */
    readonly role: 'assistant';
    /** Assistant visible blocks. */
    readonly content: readonly (MockTextBlock | MockThinkingBlock | MockToolCallBlock)[];
    /** Assistant stop reason. */
    readonly stopReason?: string;
    /** Visible assistant error text. */
    readonly errorMessage?: string;
  }
  | {
    /** Tool-result role. */
    readonly role: 'toolResult';
    /** Tool-call identifier. */
    readonly toolCallId?: string;
    /** Tool name reported by Pi. */
    readonly toolName: string;
    /** Whether tool execution errored. */
    readonly isError: boolean;
    /** Tool result content. */
    readonly content: readonly (MockTextBlock | MockImageBlock)[];
    /** Renderer-visible tool details. */
    readonly details?: unknown;
  }
  | {
    /** Direct Bash execution role. */
    readonly role: 'bashExecution';
    /** Executed command. */
    readonly command: string;
    /** Complete command output. */
    readonly output: string;
    /** Process exit status. */
    readonly exitCode?: number;
    /** Cancellation state. */
    readonly cancelled: boolean;
    /** Output truncation state. */
    readonly truncated: boolean;
    /** Full output path shown by Pi when output is truncated. */
    readonly fullOutputPath?: string;
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
    /** Session custom entry discriminator. */
    readonly type: 'custom';
    /** Extension custom entry discriminator. */
    readonly customType: typeof VERDICT_ENTRY_TYPE;
    /** Verdict data attached to next tool result. */
    readonly data: VerdictData;
  }
  | {
    /** Visible custom-message entry discriminator. */
    readonly type: 'custom_message';
    /** Custom renderer identity. */
    readonly customType: string;
    /** Complete custom content. */
    readonly content: string | readonly (MockTextBlock | MockImageBlock)[];
    /** Renderer-visible details. */
    readonly details?: unknown;
    /** Whether Pi displays message. */
    readonly display: boolean;
    /** Session timestamp consumed by Pi projection. */
    readonly timestamp: string;
  }
  | {
    /** Compaction entry discriminator. */
    readonly type: 'compaction';
    /** Complete compaction summary. */
    readonly summary: string;
    /** First retained session entry identifier. */
    readonly firstKeptEntryId: string;
    /** Token count represented by summary. */
    readonly tokensBefore: number;
    /** Session timestamp consumed by Pi projection. */
    readonly timestamp: string;
  }
  | {
    /** Branch-summary entry discriminator. */
    readonly type: 'branch_summary';
    /** Source branch entry identifier. */
    readonly fromId: string;
    /** Complete branch summary. */
    readonly summary: string;
    /** Session timestamp consumed by Pi projection. */
    readonly timestamp: string;
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
 * @param details - renderer-visible tool details
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

/**
 * Build auto-mode verdict entry.
 *
 * @param data - verdict payload stored in session history
 *
 * @returns verdict branch entry
 *
 * @example
 * ```typescript
 * verdictEntry({
 *   action: 'read .env',
 *   verdict: 'user-approve',
 *   reason: 'Allowed',
 * });
 * ```
 */
function verdictEntry(
  data: VerdictData,
): MockBranchEntry {
  return {
    type: 'custom',
    customType: VERDICT_ENTRY_TYPE,
    data,
  };
}

/**
 * Minimal parsed visible-message shape used for window assertions.
 */
type ParsedVisibleMessage = {
  /** Message role discriminator. */
  readonly role: string;
};

/**
 * Parse and validate canonical visible-message context.
 *
 * @param context - JSON context emitted by {@link buildContext}.
 *
 * @returns validated visible messages.
 */
function parseVisibleMessages(
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

        expect(context,).toBe(`[{"content":"${longUserText}","role":"user"}]`);
        expect(context.includes('…',),).toBe(false,);
      },
    },),

    it({
      name: 'keeps complete visible inputs and outputs from prior tool messages',
      fn: async function testKeepsCompleteVisibleToolMessages(): Promise<void> {
        /** Context containing unflagged write, observed Bash output, and pending flagged execution. */
        const context = buildContext(
          contextFromBranch({
            branch: [
              assistantToolCall({
                name: 'write',
                args: {
                  path: 'cat.txt',
                  content: 'meow',
                },
              },),
              toolResult({
                toolName: 'write',
                output: 'Wrote cat.txt',
              },),
              assistantToolCall({
                name: 'bash',
                args: { command: 'cat dog.txt', },
              },),
              toolResult({
                toolName: 'bash',
                output: 'observed output\nwoof',
                details: { source: 'complete tool details', },
              },),
              assistantToolCall({
                name: 'bash',
                args: { command: './cat.txt', },
              },),
            ],
          },),
        );

        expect(context,).toContain('meow',);
        expect(context,).toContain('cat dog.txt',);
        expect(context,).toContain(String.raw`observed output\nwoof`,);
        expect(context,).toContain('./cat.txt',);
        expect(context,).toContain('complete tool details',);
      },
    },),

    it({
      name: 'preserves visible assistant reasoning and image data without provider signatures',
      fn: async function testPreservesVisibleAssistantAndImages(): Promise<void> {
        /** Context containing every visible assistant block and user image. */
        const context = buildContext(
          contextFromBranch({
            branch: [
              {
                type: 'message',
                message: {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: 'Inspect image.',
                    },
                    {
                      type: 'image',
                      data: 'complete-image-data',
                      mimeType: 'image/png',
                    },
                  ],
                },
              },
              {
                type: 'message',
                message: {
                  role: 'assistant',
                  content: [
                    {
                      type: 'thinking',
                      thinking: 'complete visible reasoning',
                      thinkingSignature: 'hidden-thinking-signature',
                    },
                    {
                      type: 'text',
                      text: 'Complete assistant response.',
                    },
                    {
                      type: 'toolCall',
                      id: 'tool-call-id',
                      name: 'read',
                      arguments: { path: 'cat.txt', },
                      thoughtSignature: 'hidden-tool-signature',
                    },
                  ],
                  stopReason: 'toolUse',
                },
              },
              {
                type: 'message',
                message: {
                  role: 'assistant',
                  content: [],
                  stopReason: 'error',
                  errorMessage: 'complete visible assistant error',
                },
              },
            ],
          },),
        );

        expect(context,).toContain('complete-image-data',);
        expect(context,).toContain('complete visible reasoning',);
        expect(context,).toContain('Complete assistant response.',);
        expect(context,).toContain('cat.txt',);
        expect(context,).toContain('complete visible assistant error',);
        expect(context.includes('hidden-thinking-signature',),).toBe(false,);
        expect(context.includes('hidden-tool-signature',),).toBe(false,);
      },
    },),

    it({
      name: 'preserves direct Bash, visible custom, compaction, and branch summaries',
      fn: async function testPreservesOtherVisibleMessages(): Promise<void> {
        /** Context containing Pi-specific visible transcript message roles. */
        const context = buildContext(
          contextFromBranch({
            branch: [
              userMessage('retain complete visible span',),
              {
                type: 'message',
                message: {
                  role: 'bashExecution',
                  command: 'printf direct',
                  output: 'complete direct output',
                  exitCode: 0,
                  cancelled: false,
                  truncated: true,
                  fullOutputPath: '/tmp/full-output',
                },
              },
              {
                type: 'custom_message',
                customType: 'visible-note',
                content: 'complete custom content',
                details: { visibleDetail: 'complete detail', },
                display: true,
                timestamp: '2026-07-25T00:00:00.000Z',
              },
              {
                type: 'custom_message',
                customType: 'hidden-note',
                content: 'hidden custom content',
                display: false,
                timestamp: '2026-07-25T00:00:00.000Z',
              },
              {
                type: 'compaction',
                summary: 'complete compaction summary',
                firstKeptEntryId: 'kept',
                tokensBefore: 42,
                timestamp: '2026-07-25T00:00:00.000Z',
              },
              {
                type: 'branch_summary',
                fromId: 'branch-source',
                summary: 'complete branch summary',
                timestamp: '2026-07-25T00:00:00.000Z',
              },
            ],
          },),
        );

        expect(context,).toContain('printf direct',);
        expect(context,).toContain('complete direct output',);
        expect(context,).toContain('/tmp/full-output',);
        expect(context,).toContain('complete custom content',);
        expect(context,).toContain('complete detail',);
        expect(context,).toContain('complete compaction summary',);
        expect(context,).toContain('complete branch summary',);
        expect(context.includes('hidden custom content',),).toBe(false,);
      },
    },),

    it({
      name: 'keeps guard verdict beside complete corresponding tool result',
      fn: async function testKeepsGuardVerdictWithToolResult(): Promise<void> {
        /** Context containing complete tool data and preceding guard verdict. */
        const context = buildContext(
          contextFromBranch({
            branch: [
              userMessage('inspect guarded operation',),
              assistantToolCall({
                name: 'bash',
                args: { command: 'deploy production', },
              },),
              verdictEntry({
                action: 'bash: deploy production',
                verdict: 'user-deny',
                reason: 'Deployment not approved.',
              },),
              toolResult({
                toolName: 'bash',
                output: 'blocked result',
                isError: true,
              },),
            ],
          },),
        );

        expect(context,).toContain('deploy production',);
        expect(context,).toContain('blocked result',);
        expect(context,).toContain('user-deny',);
        expect(context,).toContain('Deployment not approved.',);
      },
    },),

    it({
      name: 'keeps entire latest-user span when it exceeds five messages',
      fn: async function testKeepsEntireLatestUserSpanWhenItExceedsFiveMessages(): Promise<void> {
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
        /** Complete messages sent to judge. */
        const messages = parseVisibleMessages(context,);

        expect(messages,).toHaveLength((BASH_ACTIVITY_COUNT * 2) + 1,);
        expect(context.includes('old request',),).toBe(false,);
        expect(context.includes('new request',),).toBe(true,);
        expect(context.includes('result 1',),).toBe(true,);
        expect(context.includes('result 6',),).toBe(true,);
      },
    },),

    it({
      name: 'backfills to five newest messages when latest-user span is shorter',
      fn: async function testBackfillsToFiveNewestMessagesWhenLatestUserSpanIsShorter(): Promise<void> {
        /** Generated activities before the latest user message. */
        const olderActivities = Array.from(
          { length: EXPECTED_MESSAGE_FLOOR, },
          function createActivity(_, activityIndex,) {
            return bashActivity(activityIndex + 1,);
          },
        )
          .flat();
        /** Context built from enough older activity to fill the minimum context budget. */
        const context = buildContext(
          contextFromBranch({
            branch: [
              userMessage('old request',),
              ...olderActivities,
              userMessage('new request',),
            ],
          },),
        );
        /** Complete messages sent to judge. */
        const messages = parseVisibleMessages(context,);

        expect(messages,).toHaveLength(EXPECTED_MESSAGE_FLOOR,);
        expect(context.includes('old request',),).toBe(false,);
        expect(context.includes('result 3',),).toBe(false,);
        expect(context.includes('result 4',),).toBe(true,);
        expect(context.includes('result 5',),).toBe(true,);
        expect(messages.at(-1,)?.role,).toBe('user',);
      },
    },),

    it({
      name: 'uses newest five messages when no user message exists',
      fn: async function testUsesNewestFiveMessagesWhenNoUserMessageExists(): Promise<void> {
        /** Generated activities without any user-message anchor. */
        const generatedActivities = Array.from(
          { length: BASH_ACTIVITY_COUNT, },
          function createActivity(_, activityIndex,) {
            return bashActivity(activityIndex + 1,);
          },
        )
          .flat();
        /** Context built from tool activity only. */
        const context = buildContext(
          contextFromBranch({ branch: generatedActivities, },),
        );
        /** Complete messages sent to judge. */
        const messages = parseVisibleMessages(context,);

        expect(messages,).toHaveLength(EXPECTED_MESSAGE_FLOOR,);
        expect(context.includes('result 3',),).toBe(false,);
        expect(context.includes('result 4',),).toBe(true,);
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

        expect(context,).toContain(`first line\\n${finalLine}`,);
        expect(context.includes('suffix',),).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: getReusableApproval.name,
  children: [
    it({
      name: 'reuses latest prior approval for exact action',
      fn: async function reusesLatestPriorApprovalForExactAction(): Promise<void> {
        /** Reusable approval found for exact action string. */
        const approval = getReusableApproval({
          ctx: contextFromBranch({
            branch: [
              verdictEntry({
                action: 'read .env',
                approvalFingerprint: READ_ENV_APPROVAL_FINGERPRINT,
                verdict: 'user-approve',
                reason: 'User allowed dotenv read.',
              },),
            ],
          },),
          action: 'read .env',
          approvalFingerprint: READ_ENV_APPROVAL_FINGERPRINT,
        },);

        expect(approval.reusable,).toBe(true,);
        if (!approval.reusable)
          throw new Error('Expected prior approval to be reusable.',);
        expect(approval.source,).toBe('user-approve',);
        expect(approval.reason,).toBe('User allowed dotenv read.',);
      },
    },),

    it({
      name: 'does not reuse approval superseded by later denial',
      fn: async function doesNotReuseSupersededApproval(): Promise<void> {
        /** Reusable approval lookup after a later denial for the same action. */
        const approval = getReusableApproval({
          ctx: contextFromBranch({
            branch: [
              verdictEntry({
                action: 'read .env',
                approvalFingerprint: READ_ENV_APPROVAL_FINGERPRINT,
                verdict: 'approve',
                reason: 'Judge allowed dotenv read.',
              },),
              verdictEntry({
                action: 'read .env',
                approvalFingerprint: READ_ENV_APPROVAL_FINGERPRINT,
                verdict: 'user-deny',
                reason: 'User denied later repeat.',
              },),
            ],
          },),
          action: 'read .env',
          approvalFingerprint: READ_ENV_APPROVAL_FINGERPRINT,
        },);

        expect(approval.reusable,).toBe(false,);
      },
    },),

    it({
      name: 'does not reuse approval for different action text',
      fn: async function doesNotReuseDifferentActionText(): Promise<void> {
        /** Reusable approval lookup for a related but non-identical action. */
        const approval = getReusableApproval({
          ctx: contextFromBranch({
            branch: [
              verdictEntry({
                action: 'read .env.example',
                approvalFingerprint: READ_ENV_EXAMPLE_APPROVAL_FINGERPRINT,
                verdict: 'approve',
                reason: 'Safe example file.',
              },),
            ],
          },),
          action: 'read .env',
          approvalFingerprint: READ_ENV_APPROVAL_FINGERPRINT,
        },);

        expect(approval.reusable,).toBe(false,);
      },
    },),

    it({
      name: 'does not reuse legacy approval without fingerprint',
      fn: async function doesNotReuseLegacyApprovalWithoutFingerprint(): Promise<void> {
        /** Reusable approval lookup for pre-fingerprint verdict entries. */
        const approval = getReusableApproval({
          ctx: contextFromBranch({
            branch: [
              verdictEntry({
                action: 'read .env',
                verdict: 'approve',
                reason: 'Legacy approval without fingerprint.',
              },),
            ],
          },),
          action: 'read .env',
          approvalFingerprint: READ_ENV_APPROVAL_FINGERPRINT,
        },);

        expect(approval.reusable,).toBe(false,);
      },
    },),

    it({
      name: 'does not reuse older approval after legacy verdict',
      fn: async function doesNotReuseOlderApprovalAfterLegacyVerdict(): Promise<void> {
        /** Reusable approval lookup after an unkeyed verdict for same action. */
        const approval = getReusableApproval({
          ctx: contextFromBranch({
            branch: [
              verdictEntry({
                action: 'read .env',
                approvalFingerprint: READ_ENV_APPROVAL_FINGERPRINT,
                verdict: 'approve',
                reason: 'Fingerprint approval.',
              },),
              verdictEntry({
                action: 'read .env',
                verdict: 'user-deny',
                reason: 'Legacy denial without fingerprint.',
              },),
            ],
          },),
          action: 'read .env',
          approvalFingerprint: READ_ENV_APPROVAL_FINGERPRINT,
        },);

        expect(approval.reusable,).toBe(false,);
      },
    },),

    it({
      name: 'preserves original source from reused approval entry',
      fn: async function preservesOriginalSourceFromReusedApproval(): Promise<void> {
        /** Reusable approval lookup for an entry produced by prior reuse. */
        const approval = getReusableApproval({
          ctx: contextFromBranch({
            branch: [
              verdictEntry({
                action: 'read .env',
                approvalFingerprint: READ_ENV_APPROVAL_FINGERPRINT,
                reusedFromVerdict: 'user-approve',
                verdict: 'approve',
                reason: 'User allowed dotenv read.',
              },),
            ],
          },),
          action: 'read .env',
          approvalFingerprint: READ_ENV_APPROVAL_FINGERPRINT,
        },);

        expect(approval.reusable,).toBe(true,);
        if (!approval.reusable)
          throw new Error('Expected reused approval entry to be reusable.',);
        expect(approval.source,).toBe('user-approve',);
      },
    },),
  ],
},);

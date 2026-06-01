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
} from '@monochromatic-dev/module-test/ts';
import { CONTEXT_ACTIVITY_FLOOR, } from './constants.ts';
import {
  buildContext,
  getReusableApproval,
} from './context.ts';
import {
  VERDICT_ENTRY_TYPE,
  type VerdictData,
} from './types.ts';

//region Test fixtures

/** Number of repeated tokens in long-message fixtures. */
const LONG_TEXT_REPEAT_COUNT = 80;

/** Number of bash tool activities generated for cap tests. */
const BASH_ACTIVITY_COUNT = 6;

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
    /** Session custom entry discriminator. */
    readonly type: 'custom';
    /** Extension custom entry discriminator. */
    readonly customType: typeof VERDICT_ENTRY_TYPE;
    /** Verdict data attached to next tool result. */
    readonly data: VerdictData;
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
      name: 'keeps entire latest-user span when it exceeds five lines',
      fn: async function testKeepsEntireLatestUserSpanWhenItExceedsFiveLines(): Promise<void> {
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

        expect(lines,).toHaveLength(BASH_ACTIVITY_COUNT + 1,);
        expect(context.includes('old request',),).toBe(false,);
        expect(context.includes('new request',),).toBe(true,);
        expect(context.includes('result 1',),).toBe(true,);
        expect(context.includes('result 6',),).toBe(true,);
      },
    },),

    it({
      name: 'backfills to five newest lines when latest-user span is shorter',
      fn: async function testBackfillsToFiveNewestLinesWhenLatestUserSpanIsShorter(): Promise<void> {
        /** Generated activities before the latest user message. */
        const olderActivities = Array.from(
          { length: CONTEXT_ACTIVITY_FLOOR, },
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
        /** Activity lines sent to the judge. */
        const lines = context.split('\n',);

        expect(lines,).toHaveLength(CONTEXT_ACTIVITY_FLOOR,);
        expect(context.includes('old request',),).toBe(false,);
        expect(context.includes('result 1',),).toBe(false,);
        expect(context.includes('result 2',),).toBe(true,);
        expect(context.includes('result 5',),).toBe(true,);
        expect(context.endsWith('[user] new request',),).toBe(true,);
      },
    },),

    it({
      name: 'uses newest five lines when no user message exists',
      fn: async function testUsesNewestFiveLinesWhenNoUserMessageExists(): Promise<void> {
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
        /** Activity lines sent to the judge. */
        const lines = context.split('\n',);

        expect(lines,).toHaveLength(CONTEXT_ACTIVITY_FLOOR,);
        expect(context.includes('result 1',),).toBe(false,);
        expect(context.includes('result 2',),).toBe(true,);
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

/**
 * Tests for evaluate verdict-to-decision helpers.
 *
 * @module
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { askUser, } from './ask-user.ts';
import {
  decisionForDenyVerdict,
  evaluate,
} from './evaluate.ts';
import {
  VERDICT_ENTRY_TYPE,
  type VerdictData,
} from './types.ts';

/** Minimal persisted-entry shape captured by mock extension API. */
type AppendedEntry = {
  /** Entry custom type passed to {@link ExtensionAPI.appendEntry}. */
  readonly customType: string;
  /** Entry payload passed to {@link ExtensionAPI.appendEntry}. */
  readonly data: unknown;
};

/** Minimal branch entry shape used by reusable-approval tests. */
type MockBranchEntry = {
  /** Session entry discriminator. */
  readonly type: string;
  /** Extension custom entry discriminator. */
  readonly customType?: string;
  /** Optional custom entry payload. */
  readonly data?: unknown;
};

/** Approval fingerprint for read .env fixtures. */
const READ_ENV_APPROVAL_FINGERPRINT = 'read-env-fingerprint';

/**
 * Create mock extension API that records appended entries.
 *
 * @param entries - array receiving persisted entries
 *
 * @returns mock extension API
 *
 * @example
 * ```typescript
 * const entries = [];
 * const api = createMockApi({ entries });
 * ```
 */
function createMockApi(
  {
    entries,
  }: {
    readonly entries: AppendedEntry[];
  },
): ExtensionAPI {
  return {
    appendEntry(
      customType: string,
      data: unknown,
    ): void {
      entries.push({
        customType,
        data,
      },);
    },
  } as unknown as ExtensionAPI;
}

/**
 * Create mock extension context with session branch access.
 *
 * @param branch - branch entries returned from session manager
 *
 * @returns mock extension context
 *
 * @example
 * ```typescript
 * const ctx = contextFromBranch({ branch: [] });
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
    cwd: '/repo',
    sessionManager: {
      getBranch() {
        return branch;
      },
    },
  } as unknown as ExtensionContext;
}

/**
 * Build persisted verdict entry.
 *
 * @param data - verdict data stored in session history
 *
 * @returns mock verdict branch entry
 *
 * @example
 * ```typescript
 * verdictEntry({
 *   action: 'read .env',
 *   verdict: 'approve',
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
 * Convert appended custom entries to mock branch entries.
 *
 * @param entries - custom entries captured from mock extension API
 *
 * @returns mock branch entries preserving custom type and payload
 *
 * @example
 * ```typescript
 * const branch = branchFromAppendedEntries({ entries });
 * ```
 */
function branchFromAppendedEntries(
  {
    entries,
  }: {
    readonly entries: readonly AppendedEntry[];
  },
): readonly MockBranchEntry[] {
  return entries.map(
    function toMockBranchEntry(
      entry: AppendedEntry,
    ): MockBranchEntry {
      return {
        type: 'custom',
        customType: entry.customType,
        data: entry.data,
      };
    },
  );
}

/**
 * Create mock extension context whose UI approves the prompt.
 *
 * @returns mock extension context for {@link askUser}
 *
 * @example
 * ```typescript
 * const ctx = approvingUiContext();
 * ```
 */
function approvingUiContext(): ExtensionContext {
  return {
    hasUI: true,
    ui: {
      async select(): Promise<string> {
        return 'Allow';
      },
    },
  } as unknown as ExtensionContext;
}

await describe({
  name: decisionForDenyVerdict.name,
  children: [
    it({
      name: 'returns judge reason and guidance in blocked decision',
      fn: async function returnsReasonAndGuidance() {
        /** Decision returned to the tool-call handler for a judge deny verdict. */
        const decision = decisionForDenyVerdict({
          verdict: {
            verdict: 'deny',
            reason: 'This command can delete user data.',
            guidance: 'Use a dry-run command first.',
          },
        },);

        expect(decision.block,).toBe(true,);
        if (!decision.block)
          throw new Error('Expected judge deny verdict to block the tool call.',);
        expect(decision.reason,).toContain(
          'Guardrail reason: This command can delete user data.',
        );
        expect(decision.reason,).toContain('Guidance: Use a dry-run command first.',);
      },
    },),
  ],
},);

await describe({
  name: evaluate.name,
  children: [
    it({
      name: 'reuses prior approval before resolving judge model',
      fn: async function reusesPriorApprovalBeforeResolvingJudgeModel(): Promise<void> {
        /** Entries appended while evaluating reusable approval. */
        const entries: AppendedEntry[] = [];
        /** Guard result produced without requiring model registry access. */
        const result = await evaluate({
          pi: createMockApi({ entries, },),
          ctx: contextFromBranch({
            branch: [
              verdictEntry({
                action: 'read .env',
                approvalFingerprint: READ_ENV_APPROVAL_FINGERPRINT,
                verdict: 'user-approve',
                reason: 'User approved dotenv read.',
              },),
            ],
          },),
          systemPrompt: 'judge prompt',
          action: 'read .env',
          actionInput: '{"path":".env"}',
          approvalFingerprint: READ_ENV_APPROVAL_FINGERPRINT,
          batchContext: [],
        },);

        expect(result.decision.block,).toBe(false,);
        expect(result.flowVerdict,).toEqual({
          action: 'read .env',
          verdict: 'approved',
          reason:
            'Previously approved in this session (user-approve): User approved dotenv read.',
        },);
        expect(entries,).toHaveLength(1,);
        expect(entries[0],).toEqual({
          customType: VERDICT_ENTRY_TYPE,
          data: {
            action: 'read .env',
            approvalFingerprint: READ_ENV_APPROVAL_FINGERPRINT,
            reusedFromVerdict: 'user-approve',
            verdict: 'approve',
            reason: 'User approved dotenv read.',
          },
        },);
      },
    },),

    it({
      name: 'reuses action that user approved from prompt',
      fn: async function reusesActionThatUserApprovedFromPrompt(): Promise<void> {
        /** Entries appended by the first manual approval prompt. */
        const approvalEntries: AppendedEntry[] = [];
        /** Explanation shown for the first prompt and preserved as approval reason. */
        const promptExplanation = 'Judge asked for explicit user approval.';
        /** Guard result produced by a user selecting Allow. */
        const approvalDecision = await askUser({
          pi: createMockApi({ entries: approvalEntries, },),
          ctx: approvingUiContext(),
          action: 'read .env',
          approvalFingerprint: READ_ENV_APPROVAL_FINGERPRINT,
          explanation: promptExplanation,
          reflectExplanationOnDeny: true,
          notificationInvoker: async function ignoreNotification() {},
        },);

        expect(approvalDecision.block,).toBe(false,);
        expect(approvalEntries,).toHaveLength(1,);
        expect(approvalEntries[0],).toEqual({
          customType: VERDICT_ENTRY_TYPE,
          data: {
            action: 'read .env',
            approvalFingerprint: READ_ENV_APPROVAL_FINGERPRINT,
            verdict: 'user-approve',
            reason: promptExplanation,
          },
        },);

        /** Entries appended by the later same-action reuse. */
        const reuseEntries: AppendedEntry[] = [];
        /** Guard result produced without requiring model registry access. */
        const result = await evaluate({
          pi: createMockApi({ entries: reuseEntries, },),
          ctx: contextFromBranch({
            branch: branchFromAppendedEntries({ entries: approvalEntries, },),
          },),
          systemPrompt: 'judge prompt',
          action: 'read .env',
          actionInput: '{"path":".env"}',
          approvalFingerprint: READ_ENV_APPROVAL_FINGERPRINT,
          batchContext: [],
        },);

        expect(result.decision.block,).toBe(false,);
        expect(result.flowVerdict,).toEqual({
          action: 'read .env',
          verdict: 'approved',
          reason:
            `Previously approved in this session (user-approve): ${promptExplanation}`,
        },);
        expect(reuseEntries,).toEqual([
          {
            customType: VERDICT_ENTRY_TYPE,
            data: {
              action: 'read .env',
              approvalFingerprint: READ_ENV_APPROVAL_FINGERPRINT,
              reusedFromVerdict: 'user-approve',
              verdict: 'approve',
              reason: promptExplanation,
            },
          },
        ],);
      },
    },),
  ],
},);

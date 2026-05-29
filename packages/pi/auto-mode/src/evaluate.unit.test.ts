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
import { JUDGE_MODEL_DEFAULTS, } from './constants.ts';
import {
  decisionForDenyVerdict,
  evaluate,
} from './evaluate.ts';
import type { MergedConfig, } from './signals.ts';
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
  /** Optional custom entry payload. */
  readonly data?: unknown;
};

/** Runtime config that is sufficient when evaluate short-circuits before judging. */
const TEST_CONFIG = {
  enabled: true,
  commands: [],
  patterns: [],
  judgeModel: JUDGE_MODEL_DEFAULTS,
  judgeTimeoutMs: 10_000,
} satisfies MergedConfig;

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
    type: VERDICT_ENTRY_TYPE,
    data,
  };
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
          config: TEST_CONFIG,
          systemPrompt: 'judge prompt',
          action: 'read .env',
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
  ],
},);

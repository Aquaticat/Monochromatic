/**
 * Tests for user approval prompt handling.
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
import {
  askUser,
  notifyAsk,
} from './ask-user.ts';
import { DEFAULT_DENY_GUIDANCE, } from './system-prompt.ts';
import { VERDICT_ENTRY_TYPE, } from './types.ts';

/** Approval fingerprint for ask-user tests. */
const READ_ENV_EXAMPLE_APPROVAL_FINGERPRINT = 'read-env-example-fingerprint';

/** Custom entry appended by the mock extension API. */
type AppendedEntry = {
  /** Entry custom type passed to {@link ExtensionAPI.appendEntry}. */
  readonly customType: string;
  /** Entry payload passed to {@link ExtensionAPI.appendEntry}. */
  readonly data: unknown;
};

/**
 * Create a minimal extension API that records appended entries.
 *
 * @param entries - captures persisted verdict entries for assertions
 *
 * @returns mock extension API sufficient for {@link askUser}
 *
 * @example
 * ```typescript
 * const entries = [];
 * const pi = createMockApi({ entries });
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
 * Create an interactive context whose approval dialog returns a fixed choice.
 *
 * @param choice - drives user approval branch under test
 *
 * @returns mock extension context sufficient for {@link askUser}
 *
 * @example
 * ```typescript
 * const ctx = createInteractiveContext({ choice: 'Deny' });
 * ```
 */
function createInteractiveContext(
  {
    choice,
  }: {
    readonly choice: string;
  },
): ExtensionContext {
  return {
    hasUI: true,
    ui: {
      async select(
        _title: string,
        _options: string[],
      ): Promise<string> {
        return choice;
      },
    },
  } as unknown as ExtensionContext;
}

/**
 * Create a non-interactive context that exercises fail-closed behavior.
 *
 * @returns mock extension context without UI
 *
 * @example
 * ```typescript
 * const ctx = createHeadlessContext();
 * ```
 */
function createHeadlessContext(): ExtensionContext {
  return {
    hasUI: false,
  } as unknown as ExtensionContext;
}

/**
 * Ignore external notification execution in approval-flow tests.
 *
 * @param _invocation - terminal command that production would execute
 *
 * @returns resolved promise after intentionally skipping the command
 *
 * @example
 * ```typescript
 * await ignoreNotification({ command: 'notify-send', args: [] });
 * ```
 */
async function ignoreNotification(
  _invocation: {
    readonly command: string;
    readonly args: readonly string[];
  },
): Promise<void> {}

await describe({
  name: notifyAsk.name,
  children: [
    it({
      name: 'invokes notify-send with the guarded action',
      fn: async function invokesNotifySendWithGuardedAction() {
        /** Terminal notification invocations captured by the test runner. */
        const invocations: {
          readonly command: string;
          readonly args: readonly string[];
        }[] = [];
        await notifyAsk({
          action: 'read .env',
          invoke: async function captureInvocation(invocation) {
            invocations.push(invocation,);
          },
        },);

        expect(invocations,).toEqual([
          {
            command: 'notify-send',
            args: [
              '--app-name=Pi',
              'Pi auto-mode approval required',
              'read .env',
            ],
          },
        ],);
      },
    },),

    it({
      name: 'does not block approval when notification fails',
      fn: async function doesNotBlockApprovalWhenNotificationFails() {
        await notifyAsk({
          action: 'read .env',
          invoke: async function failNotification() {
            throw new Error('notify-send unavailable',);
          },
        },);
      },
    },),
  ],
},);

await describe({
  name: askUser.name,
  children: [
    it({
      name: 'returns explanation in model-facing block reason when user denies',
      fn: async function returnsExplanationWhenUserDenies() {
        /** Entries appended while processing the denial. */
        const entries: AppendedEntry[] = [];
        /** Judge reason shown to the user and then reflected to the main model. */
        const explanation = 'This may expose secrets from .env.';
        /** Decision returned to the tool-call handler. */
        const decision = await askUser({
          pi: createMockApi({ entries, },),
          ctx: createInteractiveContext({ choice: 'Deny', },),
          action: 'read .env',
          notificationInvoker: ignoreNotification,
          explanation,
          reflectExplanationOnDeny: true,
        },);

        expect(decision.block,).toBe(true,);
        if (!decision.block)
          throw new Error('Expected user denial to block the tool call.',);
        expect(decision.reason,).toContain(`Guardrail reason: ${explanation}`,);
        expect(decision.reason,).toContain(`Guidance: ${DEFAULT_DENY_GUIDANCE}`,);
        expect(entries,).toHaveLength(1,);
        expect(entries[0],).toEqual({
          customType: VERDICT_ENTRY_TYPE,
          data: {
            action: 'read .env',
            verdict: 'user-deny',
            reason: explanation,
          },
        },);
      },
    },),

    it({
      name: 'returns default guidance when user denies without reflection opt-in',
      fn: async function returnsDefaultGuidanceWithoutOptIn() {
        /** Entries appended while processing the denial. */
        const entries: AppendedEntry[] = [];
        /** Fallback explanation that must stay out of the model-facing denial. */
        const explanation = 'Judge model is unavailable.';
        /** Decision returned to the tool-call handler. */
        const decision = await askUser({
          pi: createMockApi({ entries, },),
          ctx: createInteractiveContext({ choice: 'Deny', },),
          action: 'read .env',
          notificationInvoker: ignoreNotification,
          explanation,
        },);

        expect(decision.block,).toBe(true,);
        if (!decision.block)
          throw new Error('Expected user denial to block the tool call.',);
        expect(decision.reason,).toBe(DEFAULT_DENY_GUIDANCE,);
      },
    },),

    it({
      name: 'returns default guidance when UI is unavailable',
      fn: async function returnsDefaultGuidanceWithoutUi() {
        /** Entries appended while processing the fail-closed denial. */
        const entries: AppendedEntry[] = [];
        /** Guardrail explanation that stays out of the model-facing no-UI denial. */
        const explanation = 'Manual approval is required for this action.';
        /** Decision returned to the tool-call handler. */
        const decision = await askUser({
          pi: createMockApi({ entries, },),
          ctx: createHeadlessContext(),
          action: 'bash: deploy production',
          explanation,
        },);

        expect(decision.block,).toBe(true,);
        if (!decision.block)
          throw new Error('Expected missing UI to block the tool call.',);
        expect(decision.reason,).toBe(DEFAULT_DENY_GUIDANCE,);
      },
    },),

    it({
      name: 'does not block when user allows an ask verdict',
      fn: async function doesNotBlockWhenUserAllows() {
        /** Entries appended while processing the approval. */
        const entries: AppendedEntry[] = [];
        /** Decision returned to the tool-call handler. */
        const decision = await askUser({
          pi: createMockApi({ entries, },),
          ctx: createInteractiveContext({ choice: 'Allow', },),
          action: 'read .env.example',
          notificationInvoker: ignoreNotification,
          approvalFingerprint: READ_ENV_EXAMPLE_APPROVAL_FINGERPRINT,
          explanation: 'The user should decide whether this is safe.',
        },);

        expect(decision.block,).toBe(false,);
        expect(entries,).toHaveLength(1,);
        expect(entries[0],).toEqual({
          customType: VERDICT_ENTRY_TYPE,
          data: {
            action: 'read .env.example',
            approvalFingerprint: READ_ENV_EXAMPLE_APPROVAL_FINGERPRINT,
            verdict: 'user-approve',
            reason: 'The user should decide whether this is safe.',
          },
        },);
      },
    },),
  ],
},);

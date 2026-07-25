/**
 * User interaction and widget updates.
 *
 * Owns the UI side of the evaluate pipeline: prompts the user via the
 * extension's UI when the judge returns "ask", and renders the
 * accumulated denials in a widget for the active flow.
 *
 * @module
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import nanoSpawn from 'nano-spawn';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { formatModelBlockReason, } from './model-feedback.ts';
import { DEFAULT_DENY_GUIDANCE, } from './system-prompt.ts';
import {
  type GuardDecision,
  VERDICT_ENTRY_TYPE,
  type VerdictData,
} from './types.ts';

/**
 * Logger root for auto-mode after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l: parentLogger, },);
 * ```
 */
const parentLogger = tagged({ tag: 'auto-mode', },);

/**
 * Tagged logger for the ask-user module.
 */
const l = tagged({
  tag: 'ask-user',
  l: parentLogger,
},);

/**
 * Notification command used to alert the user that approval is waiting.
 */
const ASK_NOTIFICATION_COMMAND = 'notify-send';

/**
 * Maximum time allowed for a terminal notification subprocess.
 */
const ASK_NOTIFICATION_TIMEOUT_MS = 1_000;

/**
 * Invocation data passed to the terminal notification runner.
 */
type AskNotificationInvocation = {
  /**
   * Executable name resolved through the current PATH.
   */
  readonly command: string;
  /**
   * Argument vector passed without shell interpolation.
   */
  readonly args: readonly string[];
};

/**
 * Injectable terminal notification runner used by {@link notifyAsk} and tests.
 */
type AskNotificationInvoker = ForeignBorrowed<(
  invocation: AskNotificationInvocation,
) => Promise<void>>;

/**
 * Invoke the fixed terminal notification command.
 *
 * The argument vector avoids shell interpretation of action text. A missing
 * notification utility is handled by {@link notifyAsk}, so approval remains
 * available when the host does not provide `notify-send`.
 *
 * @param command - selects host notification utility without shell interpretation
 *
 * @param args - keeps notification payload outside shell grammar
 *
 * @example
 * ```typescript
 * await invokeTerminalNotification({
 *   command: 'notify-send',
 *   args: ['--app-name=Pi', 'Pi approval required', 'read .env'],
 * });
 * ```
 */
async function invokeTerminalNotification(
  {
    command,
    args,
  }: AskNotificationInvocation,
): Promise<void> {
  await nanoSpawn(
    command,
    [...args,],
    {
      stdin: 'ignore',
      stdout: 'ignore',
      stderr: 'ignore',
      timeout: ASK_NOTIFICATION_TIMEOUT_MS,
    },
  );
}

/**
 * Notify the user that auto-mode is waiting for approval.
 *
 * Notification failure is deliberately non-blocking for the approval flow:
 * terminal notification utilities are optional host capabilities.
 *
 * @param action - guarded action shown in the notification body
 *
 * @param invoke - notification runner, replaceable for deterministic tests
 *
 * @mutates invoke - invokes notification capability, which can change host or captured state
 *
 * @example
 * ```typescript
 * await notifyAsk({ action: 'read .env' });
 * ```
 */
async function notifyAsk(
  {
    action,
    invoke = invokeTerminalNotification,
  }: {
    readonly action: string;
    readonly invoke?: AskNotificationInvoker;
  },
): Promise<void> {
  /**
   * Per-call logger for terminal notification lifecycle and failure diagnostics.
   */
  const innerL = tagged({
    tag: notifyAsk.name,
    l,
  },);
  /**
   * Notification arguments passed as an argv vector so action text cannot become shell syntax.
   */
  const args = [
    '--app-name=Pi',
    'Pi auto-mode approval required',
    action,
  ];

  innerL.debug(`sending approval notification for action: ${action}`,);
  try {
    await invoke({
      command: ASK_NOTIFICATION_COMMAND,
      args,
    },);
    innerL.debug(`approval notification sent for action: ${action}`,);
  }
  catch (error) {
    innerL.warn(
      `approval notification unavailable: ${caughtValueText(error,)}`,
    );
  }
}

/**
 * Prompt the user to approve or deny an action.
 *
 * If no interactive UI is available, denies by default (fail-closed).
 * Verdict-ask callers opt into reflecting the explanation via
 * {@link formatModelBlockReason} when the user denies; fallback prompts keep
 * the generic {@link DEFAULT_DENY_GUIDANCE} block guidance.
 *
 * @returns block {@link GuardDecision} with guidance, or an allow decision
 *
 * @mutates pi - `pi.appendEntry` appends user-decision Pi session state
 *
 * @mutates ctx - UI selection and abort methods change active Pi host state
 *
 * @mutates notificationInvoker - `notifyAsk` invokes supplied notification capability when present
 *
 * @example
 * ```typescript
 * const result = await askUser({
 *   pi,
 *   ctx,
 *   action: "bash: sudo rm -rf /",
 *   approvalFingerprint: "abc123",
 *   explanation: "Destructive command",
 * });
 * ```
 */
async function askUser(
  {
    pi,
    ctx,
    action,
    approvalFingerprint,
    explanation,
    reflectExplanationOnDeny = false,
    notificationInvoker,
  }: {
    readonly pi: ForeignBorrowed<ExtensionAPI>;
    readonly ctx: ForeignBorrowed<ExtensionContext>;
    readonly action: string;
    readonly approvalFingerprint?: string;
    readonly explanation: string;
    readonly reflectExplanationOnDeny?: boolean;
    readonly notificationInvoker?: AskNotificationInvoker;
  },
): Promise<GuardDecision> {
  /**
   * Per-call sub-logger so log lines from this entry point carry the function name as a tag.
   */
  const innerL = tagged({
    tag: askUser.name,
    l,
  },);

  if (!ctx.hasUI) {
    innerL.warn(`no UI for action: ${action}; auto-denying (fail-closed)`,);
    pi.appendEntry(
      VERDICT_ENTRY_TYPE,
      {
        action,
        ...(approvalFingerprint !== undefined
          ? { approvalFingerprint, }
          : {}),
        verdict: 'user-deny',
        reason: 'no UI',
      } satisfies VerdictData,
    );
    return {
      block: true,
      reason: DEFAULT_DENY_GUIDANCE,
    };
  }

  await notifyAsk({
    action,
    ...(notificationInvoker !== undefined
      ? { invoke: notificationInvoker, }
      : {}),
  },);
  innerL.debug(`prompting user for action: ${action}`,);
  /**
   * Multi-line prompt body shown to the user; first line is a header, last is the literal action.
   */
  const lines = [
    "Command needs approval. Agent's explanation:",
    `> ${explanation}`,
    '',
    action,
  ];
  /**
   * Selected button label, used to dispatch between approve / deny / hard-stop branches below.
   */
  const choice = await ctx.ui
    .select(
    lines.join('\n',),
    [
      'Allow',
      'Deny',
      'Stop',
    ],
  );

  if (choice === 'Allow') {
    innerL.debug(`user-approve: ${action}`,);
    pi.appendEntry(
      VERDICT_ENTRY_TYPE,
      {
        action,
        ...(approvalFingerprint !== undefined
          ? { approvalFingerprint, }
          : {}),
        verdict: 'user-approve',
        reason: explanation,
      } satisfies VerdictData,
    );
    return { block: false, };
  }

  if (choice === 'Stop') {
    innerL.debug(`user-stop: ${action}`,);
    pi.appendEntry(
      VERDICT_ENTRY_TYPE,
      {
        action,
        ...(approvalFingerprint !== undefined
          ? { approvalFingerprint, }
          : {}),
        verdict: 'user-deny',
        reason: 'user stopped',
      } satisfies VerdictData,
    );
    ctx.abort();
    return {
      block: true,
      reason: 'The user stopped execution. Wait for their next instructions.',
    };
  }

  innerL.debug(`user-deny: ${action}`,);
  pi.appendEntry(
    VERDICT_ENTRY_TYPE,
    {
      action,
      ...(approvalFingerprint !== undefined
        ? { approvalFingerprint, }
        : {}),
      verdict: 'user-deny',
      reason: explanation,
    } satisfies VerdictData,
  );
  return {
    block: true,
    reason: reflectExplanationOnDeny
      ? formatModelBlockReason({
          guardrailReason: explanation,
        },)
      : DEFAULT_DENY_GUIDANCE,
  };
}

/**
 * Update the widget with accumulated denied verdict counts.
 *
 * Approved verdicts are intentionally omitted so routine auto-approvals do not
 * create visible widget noise.
 *
 * @mutates ctx - `ctx.ui.setWidget` changes displayed Pi widget state
 *
 * @example
 * ```typescript
 * updateWidget({ ctx, verdicts: flowVerdicts });
 * ```
 */
function updateWidget(
  {
    ctx,
    verdicts,
  }: {
    readonly ctx: ForeignBorrowed<ExtensionContext>;
    readonly verdicts: readonly {
      readonly action: string;
      readonly verdict: string;
      readonly reason: string;
    }[];
  },
): void {
  /**
   * Denied verdicts retained only to derive widget count.
   */
  const deniedVerdicts: typeof verdicts[number][] = [];
  for (const verdict of verdicts) {
    if (verdict.verdict === 'denied')
      deniedVerdicts[deniedVerdicts.length] = verdict;
  }
  /**
   * Count of `denied` verdicts surfaced in widget summary line.
   */
  const denied = deniedVerdicts.length;

  if (denied === 0) {
    ctx.ui
      .setWidget(
      'auto-mode',
      undefined,
    );
    return;
  }

  ctx.ui
    .setWidget(
    'auto-mode',
    [`${denied} denied`,],
  );
}

export {
  askUser,
  notifyAsk,
  updateWidget,
};
export type {
  AskNotificationInvocation,
  AskNotificationInvoker,
};

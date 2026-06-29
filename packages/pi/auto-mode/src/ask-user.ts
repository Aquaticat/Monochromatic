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
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { formatModelBlockReason, } from './model-feedback.ts';
import { DEFAULT_DENY_GUIDANCE, } from './system-prompt.ts';
import {
  type GuardDecision,
  VERDICT_ENTRY_TYPE,
  type VerdictData,
} from './types.ts';

/** Logger root for auto-mode after removing the package log shim. */
const parentLogger = tagged({ tag: 'auto-mode', },);

/**
 * Tagged logger for the ask-user module.
 */
const l = tagged({
  tag: 'ask-user',
  l: parentLogger,
},);

/**
 * Prompt the user to approve or deny an action.
 *
 * If no interactive UI is available, denies by default (fail-closed).
 * Verdict-ask callers opt into reflecting the explanation when the user denies;
 * fallback prompts keep the generic block guidance.
 *
 * @returns block decision with guidance, or an allow decision
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
  }: {
    readonly pi: ExtensionAPI;
    readonly ctx: ExtensionContext;
    readonly action: string;
    readonly approvalFingerprint?: string;
    readonly explanation: string;
    readonly reflectExplanationOnDeny?: boolean;
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
    readonly ctx: ExtensionContext;
    readonly verdicts: readonly {
      readonly action: string;
      readonly verdict: string;
      readonly reason: string;
    }[];
  },
): void {
  /**
   * Count of `denied` verdicts, surfaced in the widget summary line.
   */
  const denied = verdicts
    .filter(
      function isDenied(v,) {
        return v.verdict
          === 'denied';
      },
    )
    .length;

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
  updateWidget,
};

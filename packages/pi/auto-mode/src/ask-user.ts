/**
 * User interaction and widget updates.
 *
 * Owns the UI side of the evaluate pipeline: prompts the user via the
 * extension's UI when the judge returns "ask", and renders the
 * accumulated verdicts in a widget for the active flow.
 *
 * @module
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import { tagged, } from '@monochromatic-dev/module-logger/tagged';
import { l as parentLogger, } from './log.ts';
import { DEFAULT_DENY_GUIDANCE, } from './system-prompt.ts';
import {
  VERDICT_ENTRY_TYPE,
  type VerdictData,
} from './types.ts';

/** Tagged logger for the ask-user module. */
const l = tagged({
  tag: 'ask-user',
  l: parentLogger,
},);

/**
 * Prompt the user to approve or deny an action.
 *
 * If no interactive UI is available, denies by default (fail-closed).
 *
 * @param pi - the extension API
 *
 * @param ctx - the extension context
 *
 * @param action - description of the action
 *
 * @param explanation - why user approval is needed
 *
 * @returns a block result, or `undefined` if the user allows
 *
 * @example
 * ```typescript
 * const result = await askUser(pi, ctx, "bash: sudo rm -rf /", "Destructive command");
 * ```
 */
async function askUser(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  action: string,
  explanation: string,
): Promise<{
  block: true;
  reason: string;
} | undefined> {
  /** Per-call sub-logger so log lines from this entry point carry the function name as a tag. */
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
  /** Multi-line prompt body shown to the user; first line is a header, last is the literal action. */
  const lines = [
    "Command needs approval. Agent's explanation:",
    `> ${explanation}`,
    '',
    action,
  ];
  /** Selected button label, used to dispatch between approve / deny / hard-stop branches below. */
  const choice = await ctx.ui.select(
    lines.join('\n',),
    [
      'Allow',
      'Deny',
      'Stop',
    ],
  );

  if (choice === 'Allow') {
    innerL.info(`user-approve: ${action}`,);
    pi.appendEntry(
      VERDICT_ENTRY_TYPE,
      {
        action,
        verdict: 'user-approve',
        reason: explanation,
      } satisfies VerdictData,
    );
    return undefined;
  }

  if (choice === 'Stop') {
    innerL.info(`user-stop: ${action}`,);
    pi.appendEntry(
      VERDICT_ENTRY_TYPE,
      {
        action,
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

  innerL.info(`user-deny: ${action}`,);
  pi.appendEntry(
    VERDICT_ENTRY_TYPE,
    {
      action,
      verdict: 'user-deny',
      reason: explanation,
    } satisfies VerdictData,
  );
  return {
    block: true,
    reason: DEFAULT_DENY_GUIDANCE,
  };
}

/**
 * Update the widget with accumulated verdict counts.
 *
 * @param ctx - extension context
 *
 * @param verdicts - accumulated verdicts
 *
 * @example
 * ```typescript
 * updateWidget(ctx, flowVerdicts);
 * ```
 */
function updateWidget(
  ctx: ExtensionContext,
  verdicts: {
    action: string;
    verdict: string;
    reason: string;
  }[],
): void {
  /** Count of `approved` verdicts, surfaced in the widget summary line. */
  const approved = verdicts
    .filter(
      function isApproved(v,) {
        return v.verdict === 'approved';
      },
    )
    .length;
  /** Count of `denied` verdicts, surfaced in the widget summary line. */
  const denied = verdicts
    .filter(
      function isDenied(v,) {
        return v.verdict === 'denied';
      },
    )
    .length;
  /** Comma-joined summary fragments; empty when both counts are zero so the widget stays blank. */
  const parts: string[] = [];
  if (approved > 0)
    parts.push(`${approved} approved`,);
  if (denied > 0)
    parts.push(`${denied} denied`,);
  ctx.ui.setWidget(
    'auto-mode',
    [parts.join(', ',),],
  );
}

export {
  askUser,
  updateWidget,
};

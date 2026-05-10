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
} from "@earendil-works/pi-coding-agent";
import {
  type VerdictData,
  VERDICT_ENTRY_TYPE,
} from "./types.ts";
import { DEFAULT_DENY_GUIDANCE, } from "./system-prompt.ts";

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
  reason: string
} | undefined> {
  if (!ctx.hasUI) {
    pi.appendEntry(
      VERDICT_ENTRY_TYPE,
      {
        action,
        verdict: "user-deny",
        reason: "no UI",
      } satisfies VerdictData,
    );
    return {
      block: true,
      reason: DEFAULT_DENY_GUIDANCE
    };
  }

  const lines = [
    "Command needs approval. Agent's explanation:",
    `> ${explanation}`,
    "",
    action,
  ];
  const choice = await ctx.ui.select(
    lines.join("\n"),
    [
      "Allow",
      "Deny",
      "Stop"
    ],
  );

  if (choice === "Allow") {
    pi.appendEntry(
      VERDICT_ENTRY_TYPE,
      {
        action,
        verdict: "user-approve",
        reason: explanation,
      } satisfies VerdictData,
    );
    return undefined;
  }

  if (choice === "Stop") {
    pi.appendEntry(
      VERDICT_ENTRY_TYPE,
      {
        action,
        verdict: "user-deny",
        reason: "user stopped",
      } satisfies VerdictData,
    );
    ctx.abort();
    return {
      block: true,
      reason: "The user stopped execution. Wait for their next instructions.",
    };
  }

  pi.appendEntry(
    VERDICT_ENTRY_TYPE,
    {
      action,
      verdict: "user-deny",
      reason: explanation,
    } satisfies VerdictData,
  );
  return {
    block: true,
    reason: DEFAULT_DENY_GUIDANCE
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
    reason: string
  }[],
): void {
  const approved = verdicts.filter(
    function isApproved(v) { return v.verdict === "approved"; },
  ).length;
  const denied = verdicts.filter(
    function isDenied(v) { return v.verdict === "denied"; },
  ).length;
  const parts: string[] = [];
  if (approved > 0) parts.push(`${approved} approved`);
  if (denied > 0) parts.push(`${denied} denied`);
  ctx.ui.setWidget(
    "auto-mode",
    [parts.join(", ")],
  );
}

export {
  askUser,
  updateWidget,
};

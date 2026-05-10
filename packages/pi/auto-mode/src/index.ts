/**
 * Auto-mode pi extension entry point.
 *
 * LLM-as-judge guardrail that replaces pi-safeguard with:
 * - Fixed path handling (no /var/home false positives)
 * - Structured-output judge (tool-calling instead of free-text JSON)
 * - Inline budget model (no broken `getApiKey` dependency)
 *
 * @module
 */

import type {
  ExtensionAPI,
  ExtensionContext,
  ToolCallEvent,
  ToolCallEventResult,
} from "@earendil-works/pi-coding-agent";
import { tagged, } from "@monochromatic-dev/module-logger/tagged";
import { Type, } from "typebox";
import {
  loadMergedConfig,
} from "./config.ts";
import { buildSystemPrompt, } from "./system-prompt.ts";
import {
  type BatchEntry,
  type SignalContext,
  TRUST_ENTRY_TYPE,
  VERDICT_ENTRY_TYPE,
} from "./types.ts";
import {
  type MergedConfig,
  shouldFlag,
} from "./signals.ts";
import {
  describeAction,
  isRelevantTool,
} from "./tool-helpers.ts";
import { evaluate, } from "./evaluate.ts";
import { l as parentLogger, } from "./log.ts";

/** Tagged logger for the auto-mode entry point. */
const l = tagged({
  tag: "index",
  l: parentLogger,
},);

/**
 * Auto-mode pi extension.
 *
 * Subscribes to agent lifecycle events to implement the
 * flagger-judge-user pipeline.
 *
 * @param pi - the pi extension API
 *
 * @example
 * ```typescript
 * // In ~/.pi/agent/settings.json:
 * // { "packages": ["./packages/pi/auto-mode"] }
 * ```
 */
export default function autoMode(
  pi: ExtensionAPI,
): void {
  const innerL = tagged({
    tag: autoMode.name,
    l,
  },);
  const config = loadMergedConfig(process.cwd(),);

  if (!config.enabled) {
    innerL.debug("auto-mode disabled in config; not registering handlers",);
    return;
  }

  innerL.info("auto-mode active; registering handlers",);
  const systemPrompt = buildSystemPrompt(config,);

  //region /guard command

  pi.registerCommand(
    "guard",
    {
      description: "Manage auto-mode: /guard <trust directive> or /guard reset",
      async handler(
        args: string,
        ctx: ExtensionContext,
      ) {
        const { getTrustDirectives, } = await import("./context.ts");
        const trimmed = args.trim();
        if (trimmed === "") {
          const directives = getTrustDirectives(ctx);
          if (directives.length === 0) {
            ctx.ui.notify("No trust directives set for this session.");
          }
          else {
            ctx.ui.notify(
              `Trust directives:\n${directives.map(
                function formatDirective(
                  d,
                  i
                ) { return `  ${i + 1}. ${d}`; },
              ).join("\n")}`,
            );
          }
          return;
        }
        if (trimmed === "reset") {
          pi.appendEntry(
            TRUST_ENTRY_TYPE,
            null
          );
          ctx.ui.notify("Trust directives cleared for this session.");
          return;
        }
        pi.appendEntry(
          TRUST_ENTRY_TYPE,
          trimmed
        );
        ctx.ui.notify(`Trust directive added: ${trimmed}`);
      },
    },
  );

  //endregion

  //region propose_trust tool

  pi.registerTool({
    name: "propose_trust",
    label: "Propose Trust Rule",
    description:
      "Request permission for something the security guardrail blocked. Proposes a trust rule for the user to accept or reject. Accepted rules instruct the security judge for the remainder of the session, so propose broad rules covering your task rather than one-off approvals.",
    promptSnippet:
      "Request permission for something the security guardrail blocked (proposes a session-wide trust rule for the user to approve)",
    promptGuidelines: [
      "When blocked by the security guardrail, use propose_trust to request permission instead of asking the user to type /guard manually.",
      "Accepted rules last for the entire session, so propose rules that cover the task broadly rather than one-off approvals.",
      "Keep rules brief but explicit about what is allowed. Good: 'Allow .env file access', 'Allow terraform plan and apply'. Bad: 'Allow dangerous commands', 'Allow everything needed for this task'.",
      "The reason field is optional. Only include it if the rule isn't self-explanatory. Don't repeat information from the rule.",
    ],
    parameters: Type.Object({
      rule: Type.String({
        description:
          "Brief, explicit trust rule stating what is allowed (e.g. 'Allow .env file access', 'Allow terraform commands', 'Allow editing safeguard source')",
      }),
      // oxlint-disable-next-line new-cap -- typebox API naming convention
      reason: Type.Optional(
        Type.String({
          description: "Only if the rule isn't self-explanatory. Don't repeat the rule.",
        }),
      ),
    }),
    execute(
      _toolCallId: string,
      params: {
        rule: string;
        reason?: string
      },
      _signal: AbortSignal | undefined,
      _onUpdate: unknown,
      ctx: ExtensionContext,
    ) {
      if (!ctx.hasUI) {
        return Promise.resolve({
          content: [{
            type: "text",
            text: "Rejected: no interactive UI available."
          }],
          details: {},
        });
      }

      const lines = [
        "Trust rule proposed",
        "",
        params.rule
      ];
      if (params.reason !== undefined && params.reason !== "") {
        lines.push(
          "",
          params.reason
        );
      }
      lines.push("");

      return ctx.ui.select(
        lines.join("\n"),
        [
          "Accept",
          "Reject"
        ],
      ).then(
        function handleChoice(choice) {
          if (choice === "Accept") {
            pi.appendEntry(
              TRUST_ENTRY_TYPE,
              params.rule
            );
            return {
              content: [
                {
                  type: "text",
                  text: `Trust rule accepted for this session: "${params.rule}". You can now retry the blocked action.`,
                },
              ],
              details: {},
            };
          }

          return {
            content: [
              {
                type: "text",
                text: "Trust rule rejected by user. Try a different approach, or ask the user to run the command directly.",
              },
            ],
            details: {},
          };
        },
      );
    },
  });

  //endregion

  //region Turn-level tracking

  let currentTurnBatch: BatchEntry[] = [];
  let denialInCurrentTurn = false;
  let denialInPreviousTurn = false;

  let flowVerdicts: {
    action: string;
    verdict: string;
    reason: string
  }[] = [];

  //endregion

  //region Event handlers

  pi.on(
    "agent_start",
    function handleAgentStart(
      _event: unknown,
      ctx: ExtensionContext,
    ) {
      currentTurnBatch = [];
      denialInCurrentTurn = false;
      denialInPreviousTurn = false;
      flowVerdicts = [];
      ctx.ui.setWidget(
        "auto-mode",
        undefined
      );
    },
  );

  pi.on(
    "turn_start",
    function handleTurnStart() {
      denialInPreviousTurn = denialInCurrentTurn;
      denialInCurrentTurn = false;
      currentTurnBatch = [];
    },
  );

  pi.on(
    "agent_end",
    function handleAgentEnd(
      _event: unknown,
      ctx: ExtensionContext,
    ) {
      if (flowVerdicts.length > 0) {
        ctx.ui.setWidget(
          "auto-mode",
          undefined
        );
        flowVerdicts = [];
      }
    },
  );

  pi.on(
    "tool_call",
    function handleToolCall(
      event: ToolCallEvent,
      ctx: ExtensionContext,
    ): Promise<ToolCallEventResult | void> | ToolCallEventResult | void {
      const signalCtx: SignalContext = {
        cwd: ctx.cwd,
        home: process.env.HOME ?? "/home",
      };

      let flagged = shouldFlag(
        event,
        signalCtx,
        config,
      );

      if (!flagged && denialInPreviousTurn && isRelevantTool(event,)) {
        flagged = true;
      }

      if (!flagged) return undefined;

      const action = describeAction(event,);
      const batchContext = currentTurnBatch.length > 0
        ? [...currentTurnBatch]
        : undefined;

      return evaluate(
        pi,
        ctx,
        config,
        systemPrompt,
        action,
        batchContext,
        flowVerdicts,
      ).then(
        function handleResult(result) {
          const verdict = result !== undefined ? "deny" : "approve";
          currentTurnBatch.push({
            action,
            verdict,
          },);

          if (result !== undefined) {
            denialInCurrentTurn = true;
          }

          denialInPreviousTurn = false;

          return result;
        },
      );
    },
  );

  //endregion
}

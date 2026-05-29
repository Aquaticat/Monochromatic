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
} from '@earendil-works/pi-coding-agent';
import { tagged, } from '@monochromatic-dev/module-logger/tagged';
import { updateWidget, } from './ask-user.ts';
import { loadMergedConfig, } from './config.ts';
import { evaluate, } from './evaluate.ts';
import { linkedWorktreeReadAllowlistedDirs, } from './git-worktree-read-allowlist.ts';
import { l as parentLogger, } from './log.ts';
import { registerProposeTrust, } from './register-propose-trust.ts';
import {
  type MergedConfig,
  shouldFlag,
} from './signals.ts';
import { buildSystemPrompt, } from './system-prompt.ts';
import { agentTempReadAllowlistedDirs, } from './temp-read-allowlist.ts';
import {
  buildApprovalFingerprint,
  describeAction,
  isRelevantTool,
} from './tool-helpers.ts';
import {
  type BatchEntry,
  type SignalContext,
  TRUST_ENTRY_TYPE,
} from './types.ts';

/** Tagged logger for the auto-mode entry point. */
const l = tagged({
  tag: 'index',
  l: parentLogger,
},);

/**
 * Readonly event subset needed to collect skill read allowlist entries.
 *
 * @example
 * ```typescript
 * const event: SkillPromptEvent = {
 *   systemPromptOptions: { skills: [{ baseDir: "/skills/example" }] },
 * };
 * ```
 */
type SkillPromptEvent = {
  /** Structured prompt options containing loaded skill metadata. */
  readonly systemPromptOptions: {
    /** Skills visible to the model in the current prompt. */
    readonly skills?: readonly {
      /** Absolute skill root directory. */
      readonly baseDir: string;
    }[];
  };
};

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
  /** Per-call sub-logger so registration log lines carry the entry-point name as a tag. */
  const innerL = tagged({
    tag: autoMode.name,
    l,
  },);
  /** Resolved configuration; downstream handlers and the system prompt are derived from this. */
  const config = loadMergedConfig(process.cwd(),);

  if (!config.enabled) {
    innerL.debug('auto-mode disabled in config; not registering handlers',);
    return;
  }

  innerL.info('auto-mode active; registering handlers',);
  /** Static judge system prompt; recomputed at startup so config edits take effect on relaunch. */
  const systemPrompt = buildSystemPrompt(config,);

  //region /guard command

  pi.registerCommand(
    'guard',
    {
      description: 'Manage auto-mode: /guard <trust directive> or /guard reset',
      async handler(
        args: string,
        ctx: ExtensionContext,
      ) {
        /** Dynamically imported context helper; lazy to keep startup cost low when /guard is never used. */
        const { getTrustDirectives, } = await import('./context.ts');
        /** Trimmed argument string; empty string falls through to the "list directives" branch. */
        const trimmed = args.trim();
        if (trimmed === '') {
          /** Current trust directives for the session, listed back to the user when /guard is bare. */
          const directives = getTrustDirectives(ctx,);
          if (directives.length
            === 0)
            ctx.ui
              .notify('No trust directives set for this session.',);
          else {
            ctx.ui
              .notify(
              `Trust directives:\n${
                directives
                  .map(
                    function formatDirective(
                      d,
                      i,
                    ) {
                      return `  ${i + 1}. ${d}`;
                    },
                  )
                  .join('\n',)
              }`,
            );
          }
          return;
        }
        if (trimmed === 'reset') {
          pi.appendEntry(
            TRUST_ENTRY_TYPE,
            null,
          );
          ctx.ui
            .notify('Trust directives cleared for this session.',);
          return;
        }
        pi.appendEntry(
          TRUST_ENTRY_TYPE,
          trimmed,
        );
        ctx.ui
          .notify(`Trust directive added: ${trimmed}`,);
      },
    },
  );

  //endregion

  //region propose_trust tool

  registerProposeTrust(pi,);

  //endregion

  //region Turn-level tracking

  /* oxlint-disable no-restricted-syntax/no-function-root-let -- handler closure state for turn and skill latches */
  /** Batch siblings accumulated during the current agent turn; surfaced to the judge for context. */
  let currentTurnBatch: BatchEntry[] = [];
  /** True once any tool call in this turn is denied; latched until the next `turn_start`. */
  let denialInCurrentTurn = false;
  /** Copy of the previous turn's denial flag; raises sensitivity for the very next turn. */
  let denialInPreviousTurn = false;
  /** Per-flow verdict log surfaced in the widget; reset on `agent_start` and `agent_end`. */
  let flowVerdicts: {
    action: string;
    verdict: string;
    reason: string;
  }[] = [];
  /** Skill base directories visible in the current prompt; read-tool access bypasses path prompts. */
  let currentSkillReadDirs: readonly string[] = [];
  /* oxlint-enable no-restricted-syntax/no-function-root-let */

  //endregion

  //region Event handlers

  pi.on(
    'before_agent_start',
    function handleBeforeAgentStart(
      event: SkillPromptEvent,
    ) {
      /** Prompt options carrying the loaded skill catalog for this turn. */
      const { systemPromptOptions, } = event;
      /** Skills visible in the current system prompt; empty when no skills are loaded. */
      const skills = systemPromptOptions
        .skills
        ?? [];
      currentSkillReadDirs = skills
        .map(
          function skillBaseDir(skill,) {
            return skill.baseDir;
          },
        );
    },
  );

  pi.on(
    'agent_start',
    function handleAgentStart(
      _event: unknown,
      ctx: ExtensionContext,
    ) {
      currentTurnBatch = [];
      denialInCurrentTurn = false;
      denialInPreviousTurn = false;
      flowVerdicts = [];
      ctx.ui
        .setWidget(
        'auto-mode',
        undefined,
      );
    },
  );

  pi.on(
    'turn_start',
    function handleTurnStart() {
      denialInPreviousTurn = denialInCurrentTurn;
      denialInCurrentTurn = false;
      currentTurnBatch = [];
    },
  );

  pi.on(
    'agent_end',
    function handleAgentEnd(
      _event: unknown,
      ctx: ExtensionContext,
    ) {
      if (flowVerdicts.length
        > 0) {
        ctx.ui
          .setWidget(
          'auto-mode',
          undefined,
        );
        flowVerdicts = [];
      }
      currentSkillReadDirs = [];
    },
  );

  pi.on(
    'tool_call',
    function handleToolCall(
      event: ToolCallEvent,
      ctx: ExtensionContext,
    ) {
      /** Path resolution context handed to `shouldFlag`; mostly used to canonicalise `cwd` and `$HOME`. */
      const signalCtx: SignalContext = {
        cwd: ctx.cwd,
        home: process.env
          .HOME
          ?? '/home',
      };
      /** Read-only roots whose existing non-secret contents bypass location prompts. */
      const readAllowlistedDirs: readonly string[] = event.toolName === 'read'
        ? [
          ...agentTempReadAllowlistedDirs(),
          ...linkedWorktreeReadAllowlistedDirs({ cwd: ctx.cwd, },),
          ...currentSkillReadDirs,
        ]
        : [];

      /** True when the tool call trips a static rule, or when a previous-turn denial promotes a relevant follow-up. */
      const flagged = shouldFlag({
        event,
        ctx: signalCtx,
        config,
        readAllowlistedDirs,
      },)
        || (denialInPreviousTurn && isRelevantTool(event,));

      if (!flagged)
        return undefined;

      /** Human-readable rendering of the tool call shown to the judge and the user. */
      const action = describeAction(event,);
      /** Stable identity for exact same-session approval reuse. */
      const approvalFingerprint = buildApprovalFingerprint({
        event,
        cwd: ctx.cwd,
      },);
      /** Snapshot of this turn's siblings handed to the judge so it can reason about batch context; empty when this is the turn's first flagged call. */
      const batchContext = [...currentTurnBatch,];

      return evaluate({
        pi,
        ctx,
        config,
        systemPrompt,
        action,
        approvalFingerprint,
        batchContext,
      },)
        .then(
          function handleResult(result,) {
            /** Block-or-allow decision and the optional flow verdict the judge produced. */
            const {
              decision,
              flowVerdict,
            } = result;
            if (flowVerdict !== undefined) {
              flowVerdicts.push(flowVerdict,);
              updateWidget({
                ctx,
                verdicts: flowVerdicts,
              },);
            }

            currentTurnBatch.push({
              action,
              verdict: decision.block ? 'deny' : 'approve',
            },);

            if (decision.block)
              denialInCurrentTurn = true;

            denialInPreviousTurn = false;

            if (decision.block)
              return {
                block: true,
                reason: decision.reason,
              };
            return undefined;
          },
        );
    },
  );

  //endregion
}

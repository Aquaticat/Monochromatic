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

import { homedir, } from 'node:os';

import type {
  ExtensionAPI,
  ExtensionContext,
  ToolCallEvent,
} from '@earendil-works/pi-coding-agent';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { updateWidget, } from './ask-user.ts';
import {
  announceBypassToggle,
  appendBypassAllowEntry,
  appendBypassToggleEntry,
  BYPASS_SHORTCUT,
  findLatestBypassEnabled,
  updateBypassStatus,
} from './bypass.ts';
import { HISTORICAL_AGENT_TEMP_DIR, } from './constants.ts';
import { evaluate, } from './evaluate.ts';
import { linkedWorktreeReadAllowlistedDirs, } from './git-worktree-read-allowlist.ts';
import { registerGuardCommand, } from './guard-command.ts';
import { registerProposeTrust, } from './register-propose-trust.ts';
import { shouldFlag, } from './signals.ts';
import { JUDGE_SYSTEM_PROMPT, } from './system-prompt.ts';
import { agentTempAllowlistedDirs, } from './temp-allowlist.ts';
import {
  buildApprovalFingerprint,
  describeAction,
  isRelevantTool,
  serializeToolInputForJudge,
} from './tool-helpers.ts';
import type {
  BatchEntry,
  SignalContext,
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
 * Tagged logger for the auto-mode entry point.
 */
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
  /**
   * Structured prompt options containing loaded skill metadata.
   */
  readonly systemPromptOptions: {
    /**
     * Skills visible to the model in the current prompt.
     */
    readonly skills?: readonly {
      /**
       * Absolute skill root directory.
       */
      readonly baseDir: string;
    }[];
  };
};

/**
 * Auto-mode pi extension.
 *
 * Subscribes to agent lifecycle events to implement the
 * flagger-judge-user pipeline:
 * - {@link registerGuardCommand} and {@link registerProposeTrust} register the `/guard` command and `propose_trust` tool
 * - {@link findLatestBypassEnabled} and {@link updateBypassStatus} restore and surface bypass state
 * - {@link appendBypassToggleEntry} and {@link announceBypassToggle} record and announce bypass toggles
 * - {@link describeAction} and {@link appendBypassAllowEntry} log bypassed tool calls
 * - {@link agentTempAllowlistedDirs} and {@link linkedWorktreeReadAllowlistedDirs} build read allowlists
 * - {@link shouldFlag} and {@link isRelevantTool} decide whether a tool call needs evaluation
 * - {@link buildApprovalFingerprint} and {@link evaluate} run the judge pipeline
 * - {@link updateWidget} renders flow verdicts
 *
 * @param pi - the pi extension API
 *
 * @param home - current account home used to derive current agent scratch root
 *
 * @param historicalAgentTempDir - historical compatibility root used for isolated verification
 *
 * @mutates pi - registers Pi commands, tools, shortcuts, lifecycle handlers, and session entries
 *
 * @example
 * ```typescript
 * initializeAutoMode({ pi, home: '/account-home' });
 * ```
 */
function initializeAutoMode(
  {
    pi,
    home = homedir(),
    historicalAgentTempDir = HISTORICAL_AGENT_TEMP_DIR,
  }: {
    readonly pi: ForeignBorrowed<ExtensionAPI>;
    readonly home?: string;
    readonly historicalAgentTempDir?: string;
  },
): void {
  /**
   * Per-call sub-logger so registration log lines carry the entry-point name as a tag.
   */
  const innerL = tagged({
    tag: initializeAutoMode.name,
    l,
  },);
  innerL.debug('auto-mode active; registering handlers',);

  //region /guard command

  registerGuardCommand({ pi, },);

  //endregion

  //region propose_trust tool

  registerProposeTrust(pi,);

  //endregion

  //region Turn-level tracking

  /* oxlint-disable no-restricted-syntax/no-function-root-let -- handler closure state for turn, skill, and bypass latches */
  /**
   * Batch siblings accumulated during the current agent turn; surfaced to the judge for context.
   */
  let currentTurnBatch: BatchEntry[] = [];
  /**
   * True once any tool call in this turn is denied; latched until the next `turn_start`.
   */
  let denialInCurrentTurn = false;
  /**
   * Copy of the previous turn's denial flag; raises sensitivity for the very next turn.
   */
  let denialInPreviousTurn = false;
  /**
   * Per-flow verdict log surfaced in the widget; reset on `agent_start` and `agent_end`.
   */
  let flowVerdicts: {
    action: string;
    verdict: string;
    reason: string;
  }[] = [];
  /**
   * Skill base directories visible in the current prompt; read-tool access bypasses path prompts.
   */
  let currentSkillReadDirs: readonly string[] = [];
  /**
   * Runtime bypass state, restored from session entries and toggled by
   * {@link BYPASS_SHORTCUT}.
   */
  let bypassEnabled = false;
  /* oxlint-enable no-restricted-syntax/no-function-root-let */

  //endregion

  //region Bypass shortcut

  pi.registerShortcut(
    BYPASS_SHORTCUT,
    {
      description: 'Toggle auto-mode bypass',
      /**
       * Toggles bypass state from registered shortcut.
       *
       * @param ctx - Active Pi extension context.
       *
       * @returns Nothing.
       *
       * @mutates ctx - `announceBypassToggle` changes displayed Pi state.
       */
      handler(
        ctx: ForeignBorrowed<ExtensionContext>,
      ) {
        bypassEnabled = !bypassEnabled;
        innerL.warn(
          `bypass ${bypassEnabled ? 'enabled' : 'disabled'} by shortcut`,
        );
        appendBypassToggleEntry({
          pi,
          enabled: bypassEnabled,
        },);
        announceBypassToggle({
          ctx,
          enabled: bypassEnabled,
        },);
      },
    },
  );

  //endregion

  //region Event handlers

  pi.on(
    'session_start',
    /**
     * Restores bypass state for active session.
     *
     * @param _event - Unused Pi lifecycle payload.
     *
     * @param ctx - Active Pi extension context.
     *
     * @returns Nothing.
     *
     * @mutates ctx - `updateBypassStatus` changes displayed Pi status state.
     */
    function handleSessionStart(
      _event: unknown,
      ctx: ForeignBorrowed<ExtensionContext>,
    ) {
      bypassEnabled = findLatestBypassEnabled({ ctx, },);
      updateBypassStatus({
        ctx,
        enabled: bypassEnabled,
      },);
    },
  );

  pi.on(
    'session_tree',
    /**
     * Restores bypass state after session tree changes.
     *
     * @param _event - Unused Pi lifecycle payload.
     *
     * @param ctx - Active Pi extension context.
     *
     * @returns Nothing.
     *
     * @mutates ctx - `updateBypassStatus` changes displayed Pi status state.
     */
    function handleSessionTree(
      _event: unknown,
      ctx: ForeignBorrowed<ExtensionContext>,
    ) {
      bypassEnabled = findLatestBypassEnabled({ ctx, },);
      updateBypassStatus({
        ctx,
        enabled: bypassEnabled,
      },);
    },
  );

  pi.on(
    'before_agent_start',
    function handleBeforeAgentStart(
      event: SkillPromptEvent,
    ) {
      /**
       * Prompt options carrying the loaded skill catalog for this turn.
       */
      const { systemPromptOptions, } = event;
      /**
       * Skills visible in the current system prompt; empty when no skills are loaded.
       */
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
    /**
     * Resets per-agent flow state and clears displayed widget state.
     *
     * @param _event - Unused Pi lifecycle payload.
     *
     * @param ctx - Active Pi extension context.
     *
     * @returns Nothing.
     *
     * @mutates ctx - `ctx.ui.setWidget` clears displayed Pi widget state.
     */
    function handleAgentStart(
      _event: unknown,
      ctx: ForeignBorrowed<ExtensionContext>,
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
    /**
     * Clears completed flow and skill state.
     *
     * @param _event - Unused Pi lifecycle payload.
     *
     * @param ctx - Active Pi extension context.
     *
     * @returns Nothing.
     *
     * @mutates ctx - `ctx.ui.setWidget` clears displayed Pi widget state when needed.
     */
    function handleAgentEnd(
      _event: unknown,
      ctx: ForeignBorrowed<ExtensionContext>,
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
    /**
     * Evaluates one Pi tool call through bypass and judge policy.
     *
     * @param event - Pi tool-call payload inspected and fingerprinted.
     *
     * @param ctx - Active Pi extension context.
     *
     * @returns Optional Pi block decision.
     *
     * @mutates ctx - evaluation can invoke registry, session, and UI capabilities.
     */
    async function handleToolCall(
      event: ForeignBorrowed<ToolCallEvent>,
      ctx: ForeignBorrowed<ExtensionContext>,
    ) {
      if (bypassEnabled) {
        /**
         * Human-readable rendering of the tool call allowed without guardrail evaluation.
         */
        const action = describeAction(event,);
        innerL.warn(`bypass allow: ${action}`,);
        appendBypassAllowEntry({
          pi,
          action,
        },);
        return undefined;
      }

      /**
       * Path resolution context handed to `shouldFlag`; mostly used to canonicalise `cwd` and `$HOME`.
       */
      const signalCtx: SignalContext = {
        cwd: ctx.cwd,
        home,
      };
      /**
       * Whether tool supports trusted agent scratch paths.
       */
      const usesAgentTempTrust = (event.toolName === 'read')
        || (event.toolName === 'bash');
      /**
       * Private current and historical compatibility roots whose existing non-secret contents bypass prompts.
       */
      const trustedAgentTempDirs = usesAgentTempTrust
        ? await agentTempAllowlistedDirs({
          home: signalCtx.home,
          historicalAgentTempDir,
        },)
        : [];
      /**
       * Read-only roots whose existing non-secret contents bypass location prompts.
       */
      const readAllowlistedDirs: readonly string[] = event.toolName === 'read'
        ? [
          ...trustedAgentTempDirs,
          ...(await linkedWorktreeReadAllowlistedDirs({ cwd: ctx.cwd, },)),
          ...currentSkillReadDirs,
        ]
        : [];
      /**
       * Bash roots whose existing non-secret helper paths bypass location prompts.
       */
      const bashAllowlistedDirs: readonly string[] = event.toolName === 'bash'
        ? trustedAgentTempDirs
        : [];

      /**
       * True when the tool call trips a static rule, or when a previous-turn denial promotes a relevant follow-up.
       */
      const flagged = await shouldFlag({
        event,
        ctx: signalCtx,
        readAllowlistedDirs,
        bashAllowlistedDirs,
      },)
        || (denialInPreviousTurn && isRelevantTool(event,));

      if (!flagged)
        return undefined;

      /**
       * Human-readable rendering of the tool call shown to the judge and the user.
       */
      const action = describeAction(event,);
      /**
       * Complete JSON-encoded tool input passed only to judge request construction.
       */
      const actionInput = serializeToolInputForJudge(event.input,);
      /**
       * Stable identity for exact same-session approval reuse.
       */
      const approvalFingerprint = buildApprovalFingerprint({
        event,
        cwd: ctx.cwd,
      },);
      /**
       * Snapshot of this turn's siblings handed to the judge so it can reason about batch context; empty when this is the turn's first flagged call.
       */
      const batchContext = [...currentTurnBatch,];

      /**
       * Block-or-allow result after judge and any user decision complete.
       */
      const result = await evaluate({
        pi,
        ctx,
        systemPrompt: JUDGE_SYSTEM_PROMPT,
        action,
        actionInput,
        approvalFingerprint,
        batchContext,
      },);
      /**
       * Block-or-allow decision and optional flow verdict produced by judge.
       */
      const {
        decision,
        flowVerdict,
      } = result;
      if (flowVerdict !== undefined) {
        flowVerdicts[flowVerdicts.length] = flowVerdict;
        updateWidget({
          ctx,
          verdicts: flowVerdicts,
        },);
      }

      currentTurnBatch[currentTurnBatch.length] = {
        action,
        verdict: decision.block ? 'deny' : 'approve',
      };

      if (decision.block)
        denialInCurrentTurn = true;

      denialInPreviousTurn = false;

      if (decision.block) {
        return {
          block: true,
          reason: decision.reason,
        };
      }
      return undefined;
    },
  );

  //endregion
}

/**
 * Load auto-mode through Pi's extension factory boundary.
 *
 * Delegates to {@link initializeAutoMode} with runtime-derived current account paths.
 *
 * @param pi - Pi extension API supplied by extension loader
 *
 * @mutates pi - registers Pi commands, tools, shortcuts, lifecycle handlers, and session entries
 *
 * @example
 * ```typescript
 * // In ~/.pi/agent/settings.json:
 * // { "packages": ["./packages/pi-plugin/auto-mode"] }
 * ```
 */
export default function autoMode(
  pi: ForeignBorrowed<ExtensionAPI>,
): void {
  initializeAutoMode({ pi, },);
}

export { initializeAutoMode, };

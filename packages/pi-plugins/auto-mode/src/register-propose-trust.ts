/**
 * `propose_trust` tool registration for the auto-mode extension.
 *
 * Lets the agent request a session-wide trust rule when the guardrail blocks
 * it. Rules already trusted in active session history are accepted without a
 * prompt; new rules prompt the user to accept or reject. Accepted rules are
 * appended as trust-directive session entries that relax the judge for the rest
 * of the session.
 *
 * @module
 */

import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import { Type, } from 'typebox';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { getTrustDirectives, } from './context.ts';
import { TRUST_ENTRY_TYPE, } from './types.ts';

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
 * Tagged logger for propose_trust registration and execution.
 */
const l = tagged({
  tag: 'register-propose-trust',
  l: parentLogger,
},);

/**
 * Parameters accepted by propose_trust.
 */
type ProposeTrustParams = {
  /**
   * Session trust directive requested by agent.
   */
  readonly rule: string;
  /**
   * Optional rationale for why directive is needed.
   */
  readonly reason?: string;
};

/**
 * Tool result shape returned by propose_trust.
 *
 * Details are intentionally empty because all durable state is written through
 * trust-directive session entries.
 *
 * @example
 * ```typescript
 * const result: ProposeTrustResult = trustRuleRejectedResult();
 * ```
 */
type ProposeTrustResult = AgentToolResult<unknown>;

/**
 * Required trust-rule parameter schema.
 */
const trustRuleParameterSchema = Type.String({
  description:
    "Brief, explicit trust rule stating what is allowed (e.g. 'Allow .env file access', 'Allow terraform commands', 'Allow editing safeguard source')",
},);

/**
 * Optional trust-rule rationale parameter schema.
 */
const trustReasonParameterSchema = Type.Optional(
  Type.String({
    description: "Only if the rule isn't self-explanatory. Don't repeat the rule.",
  },),
);

/**
 * Register the `propose_trust` tool on the extension API.
 *
 * Auto-accepts rules already active via {@link isActiveTrustRule}, otherwise
 * prompts with {@link buildTrustRulePrompt} and records acceptance through the
 * {@link TRUST_ENTRY_TYPE} session entry, returning {@link trustRuleAcceptedResult}
 * or {@link trustRuleRejectedResult}.
 *
 * Split out of the entry point so `index.ts` stays within the per-file line
 * budget; the tool closes only over `pi`, so it needs no turn-level state.
 *
 * @param pi - pi extension API the tool is registered on
 *
 * @mutates pi - `pi.registerTool` changes registered tools; deferred `pi.appendEntry` calls append accepted trust state.
 *
 * @example
 * ```typescript
 * registerProposeTrust(pi);
 * ```
 */
function registerProposeTrust(
  pi: ExtensionAPI,
): void {
  pi.registerTool({
    name: 'propose_trust',
    label: 'Propose Trust Rule',
    description:
      'Request permission for something the security guardrail blocked. Proposes a trust rule for the user to accept or reject. Accepted rules instruct the security judge for the remainder of the session, so propose broad rules covering your task rather than one-off approvals.',
    promptSnippet:
      'Request permission for something the security guardrail blocked (proposes a session-wide trust rule for the user to approve)',
    promptGuidelines: [
      'When blocked by the security guardrail, use propose_trust to request permission instead of asking the user to type /guard manually.',
      'Accepted rules last for the entire session, so propose rules that cover the task broadly rather than one-off approvals.',
      "Keep rules brief but explicit about what is allowed. Good: 'Allow .env file access', 'Allow terraform plan and apply'. Bad: 'Allow dangerous commands', 'Allow everything needed for this task'.",
      "The reason field is optional. Only include it if the rule isn't self-explanatory. Don't repeat information from the rule.",
    ],
    parameters: Type.Object({
      rule: trustRuleParameterSchema,
      reason: trustReasonParameterSchema,
    },),
    async execute(
      _toolCallId: string,
      params: ProposeTrustParams,
      _signal: unknown,
      _onUpdate: unknown,
      ctx: ExtensionContext,
    ): Promise<ProposeTrustResult> {
      /**
       * Per-call sub-logger so branches are visible without logging rule text.
       */
      const innerL = tagged({
        tag: 'execute',
        l,
      },);

      if (isActiveTrustRule({
        ctx,
        rule: params.rule,
      },)) {
        innerL.debug('auto-accepting already-active trust rule proposal',);
        return trustRuleAcceptedResult({
          alreadyTrusted: true,
          rule: params.rule,
        },);
      }

      if (!ctx.hasUI) {
        innerL.warn('rejecting trust rule proposal because no interactive UI is available',);
        return {
          content: [{
            type: 'text',
            text: 'Rejected: no interactive UI available.',
          },],
          details: {},
        };
      }

      innerL.debug('prompting user for new trust rule proposal',);
      /**
       * Button label selected by user; undefined is treated as rejection.
       */
      const choice = await ctx.ui
        .select(
          buildTrustRulePrompt({ params, },),
          [
            'Accept',
            'Reject',
          ],
        );

      if (choice === 'Accept') {
        innerL.debug('user accepted trust rule proposal',);
        pi.appendEntry(
          TRUST_ENTRY_TYPE,
          params.rule,
        );
        return trustRuleAcceptedResult({
          alreadyTrusted: false,
          rule: params.rule,
        },);
      }

      innerL.debug('user rejected trust rule proposal',);
      return trustRuleRejectedResult();
    },
  },);
}

/**
 * Check whether proposed trust rule is already active in session history.
 *
 * Exact matching against {@link getTrustDirectives} keeps auto-approval
 * idempotent: reset entries and spelling changes still require user
 * interaction.
 *
 * @param ctx - extension context carrying session branch
 *
 * @param rule - proposed trust directive text
 *
 * @returns whether active directives already contain proposed rule
 *
 * @example
 * ```typescript
 * isActiveTrustRule({ ctx, rule: 'Allow .env file access' });
 * ```
 */
function isActiveTrustRule(
  {
    ctx,
    rule,
  }: {
    readonly ctx: ExtensionContext;
    readonly rule: string;
  },
): boolean {
  return getTrustDirectives(ctx,)
    .includes(rule,);
}

/**
 * Build prompt body for new trust-rule proposal.
 *
 * @param params - tool parameters containing rule and optional reason
 *
 * @returns multiline prompt text shown to user
 *
 * @example
 * ```typescript
 * buildTrustRulePrompt({ params: { rule: 'Allow terraform plan' } });
 * ```
 */
function buildTrustRulePrompt(
  {
    params,
  }: {
    readonly params: ProposeTrustParams;
  },
): string {
  /**
   * Per-line accumulator for prompt text; reason is appended when present.
   */
  const lines = [
    'Trust rule proposed',
    '',
    params.rule,
  ];
  if ((params.reason
    !== undefined) && (params.reason
      !== '')) {
    lines.push(
      '',
      params.reason,
    );
  }
  lines.push('',);
  return lines.join('\n',);
}

/**
 * Build accepted propose_trust tool result.
 *
 * @param alreadyTrusted - whether active session directives already contained rule
 *
 * @param rule - trust directive text accepted for session
 *
 * @returns tool result sent back to agent
 *
 * @example
 * ```typescript
 * trustRuleAcceptedResult({ alreadyTrusted: true, rule: 'Allow .env file access' });
 * ```
 */
function trustRuleAcceptedResult(
  {
    alreadyTrusted,
    rule,
  }: {
    readonly alreadyTrusted: boolean;
    readonly rule: string;
  },
): ProposeTrustResult {
  return {
    content: [
      {
        type: 'text',
        text: alreadyTrusted
          ? `Trust rule already trusted for this session: "${rule}". You can now retry the blocked action.`
          : `Trust rule accepted for this session: "${rule}". You can now retry the blocked action.`,
      },
    ],
    details: {},
  };
}

/**
 * Build rejected propose_trust tool result.
 *
 * @returns tool result sent back to agent
 *
 * @example
 * ```typescript
 * trustRuleRejectedResult();
 * ```
 */
function trustRuleRejectedResult(): ProposeTrustResult {
  return {
    content: [
      {
        type: 'text',
        text:
          'Trust rule rejected by user. Try a different approach, or ask the user to run the command directly.',
      },
    ],
    details: {},
  };
}

export { registerProposeTrust, };

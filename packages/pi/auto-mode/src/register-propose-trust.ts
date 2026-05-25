/**
 * `propose_trust` tool registration for the auto-mode extension.
 *
 * Lets the agent request a session-wide trust rule when the guardrail blocks
 * it, prompting the user to accept or reject. Accepted rules are appended as
 * trust-directive session entries that relax the judge for the rest of the
 * session.
 *
 * @module
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import { Type, } from 'typebox';
import { TRUST_ENTRY_TYPE, } from './types.ts';

/**
 * Register the `propose_trust` tool on the extension API.
 *
 * Split out of the entry point so `index.ts` stays within the per-file line
 * budget; the tool closes only over `pi`, so it needs no turn-level state.
 *
 * @param pi - pi extension API the tool is registered on
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
      rule: Type.String({
        description:
          "Brief, explicit trust rule stating what is allowed (e.g. 'Allow .env file access', 'Allow terraform commands', 'Allow editing safeguard source')",
      },),
      // oxlint-disable-next-line new-cap -- typebox API naming convention
      reason: Type.Optional(
        Type.String({
          description: "Only if the rule isn't self-explanatory. Don't repeat the rule.",
        },),
      ),
    },),
    execute(
      _toolCallId: string,
      params: {
        readonly rule: string;
        readonly reason?: string;
      },
      _signal: unknown,
      _onUpdate: unknown,
      ctx: ExtensionContext,
    ) {
      if (!ctx.hasUI) {
        return Promise.resolve({
          content: [{
            type: 'text',
            text: 'Rejected: no interactive UI available.',
          },],
          details: {},
        },);
      }

      /** Per-line accumulator for the proposed-rule prompt; reason is appended below when present. */
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

      return ctx
        .ui
        .select(
          lines.join('\n',),
          [
            'Accept',
            'Reject',
          ],
        )
        .then(
          function handleChoice(choice,) {
            if (choice === 'Accept') {
              pi.appendEntry(
                TRUST_ENTRY_TYPE,
                params.rule,
              );
              return {
                content: [
                  {
                    type: 'text',
                    text:
                      `Trust rule accepted for this session: "${params.rule}". You can now retry the blocked action.`,
                  },
                ],
                details: {},
              };
            }

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
          },
        );
    },
  },);
}

export { registerProposeTrust, };

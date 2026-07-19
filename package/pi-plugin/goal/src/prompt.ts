/**
 * Per-turn active-goal system prompt guidance.
 *
 * @module
 */

import type { ActiveGoalState, } from './types.ts';

/**
 * Build active generation guidance appended on every agent start.
 *
 * JSON string encoding preserves exact objective text without allowing it to break prompt delimiters.
 *
 * @param goal - exact reconstructed active goal
 *
 * @returns active-goal system prompt suffix
 *
 * @example
 * ```ts
 * const suffix = buildActiveGoalPrompt(goal);
 * ```
 */
function buildActiveGoalPrompt(goal: ActiveGoalState,): string {
  return [
    'Active repository-owned /goal stop hook:',
    `Objective (exact JSON string): ${JSON.stringify(goal.objective,)}`,
    `Current goal_id: ${goal.generationId}`,
    '',
    'Goal rules:',
    '- Continue until the objective is complete.',
    '- Do not redefine the objective into a smaller task.',
    '- Use current files, command output, tests, and external state as authority.',
    '- Do not stop at a plan or partial result.',
    '- Expect another stop-hook continuation while this exact goal remains active and no background process is live.',
    '- Do not poll solely because a background process is live; process notifications own later reaction turns.',
    '- Call goal_complete only as the final action after requirement-by-requirement verification.',
    '- Pass the exact current goal_id. It is only a stale-completion guard, not part of the objective.',
    '- Never reuse an identifier from a replaced, cleared, terminal, or restored generation.',
  ].join('\n',);
}

export { buildActiveGoalPrompt, };

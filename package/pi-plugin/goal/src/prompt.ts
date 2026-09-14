/**
 Per-turn task context for an active goal.
 
 @module
 */

import type { ActiveGoalState, } from './types.ts';

/**
 Build exact task context appended on every primary-model turn.
 
 JSON encoding preserves objective text without exposing harness lifecycle state.
 
 @param goal - exact reconstructed active goal
 
 @returns task-only system prompt suffix
 
 @example
 ```ts
 const suffix = buildActiveGoalPrompt(goal);
 ```
 */
function buildActiveGoalPrompt(goal: ActiveGoalState,): string {
  return `Current user objective (exact JSON string): ${JSON.stringify(goal.objective,)}`;
}

export { buildActiveGoalPrompt, };

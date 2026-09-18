//region Decision barrel
// The typed-decision transport and its contract (2026-09-18): OpenRouter's
// decisions endpoint, which fronts TypeSafe's System One models. Its own
// barrel because the provider barrel sits at its line budget.
export {
  createDecisionsClient,
  OPENROUTER_DECISIONS_URL,
} from './decisions-client.ts';
export {
  type Decider,
  type DecisionAnswer,
  type DecisionChoiceAnswer,
  type DecisionChoiceQuestion,
  type DecisionNoulAnswer,
  type DecisionNoulQuestion,
  type DecisionQuestion,
  type DecisionReply,
  DecisionReplyShapeError,
  type DecisionRequest,
  type DecisionScoreAnswer,
  type DecisionScoreQuestion,
  type DecisionState,
  isDecisionAnswer,
  readDecisionReplyBody,
} from './decision-contract.ts';

//endregion Decision barrel

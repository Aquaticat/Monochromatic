/**
 * Goal extension constants.
 *
 * @module
 */

/**
 * Custom entry type for immutable goal state events.
 */
const GOAL_STATE_ENTRY_TYPE = 'goal:state';

/**
 * Terminal diagnostic custom entry type for reviewer exhaustion.
 */
const GOAL_REVIEW_UNAVAILABLE_ENTRY_TYPE = 'goal:review-unavailable';

/**
 * Custom message type for visible kickoff and continuation context.
 */
const GOAL_MESSAGE_TYPE = 'goal';

/**
 * Footer status key owned by goal extension.
 */
const GOAL_STATUS_KEY = 'goal';

/**
 * Exact model-callable completion tool name.
 */
const GOAL_COMPLETE_TOOL_NAME = 'goal_complete';

/**
 * Maximum normalized objective length.
 */
const MAX_OBJECTIVE_LENGTH = 4_000;

/**
 * Maximum displayed objective graphemes in footer.
 */
const MAX_FOOTER_OBJECTIVE_GRAPHEMES = 10;

/**
 * Graphemes retained before truncation ellipsis.
 */
const TRUNCATED_FOOTER_OBJECTIVE_GRAPHEMES = 9;

/**
 * Direct reviewer timeout for one candidate attempt.
 */
const REVIEW_TIMEOUT_MS = 10_000;

/**
 * Output reserve used for reviewer ranking and request budgeting.
 */
const REVIEW_OUTPUT_TOKENS = 16_384;

/**
 * Framing token reserve excluded from serialized reviewer transcript.
 */
const REVIEW_FRAMING_TOKENS = 256;

/**
 * Character-per-token estimate used for reviewer context budgeting.
 */
const ESTIMATED_CHARACTERS_PER_TOKEN = 4;

/**
 * Stable direct usage diagnostic for rejected command forms.
 */
const GOAL_USAGE = 'Usage: /goal <objective> or /goal clear';

export {
  ESTIMATED_CHARACTERS_PER_TOKEN,
  GOAL_COMPLETE_TOOL_NAME,
  GOAL_MESSAGE_TYPE,
  GOAL_REVIEW_UNAVAILABLE_ENTRY_TYPE,
  GOAL_STATE_ENTRY_TYPE,
  GOAL_STATUS_KEY,
  GOAL_USAGE,
  MAX_FOOTER_OBJECTIVE_GRAPHEMES,
  MAX_OBJECTIVE_LENGTH,
  REVIEW_FRAMING_TOKENS,
  REVIEW_OUTPUT_TOKENS,
  REVIEW_TIMEOUT_MS,
  TRUNCATED_FOOTER_OBJECTIVE_GRAPHEMES,
};

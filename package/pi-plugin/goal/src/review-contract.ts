/**
 * Goal-specific reviewer rubric, prompt budgeting, and structured verdict contract.
 *
 * @module
 */

import type {
  Tool,
  TSchema,
} from '@earendil-works/pi-ai';
import type {
  StructuredReviewContract,
  StructuredReviewPrompt,
} from '@monochromatic-dev/pi-shared-model-review/ts';

import {
  ESTIMATED_CHARACTERS_PER_TOKEN,
  GOAL_COMPLETE_TOOL_NAME,
  REVIEW_FRAMING_TOKENS,
  REVIEW_OUTPUT_TOKENS,
} from './constants.ts';
import type {
  GoalReviewEvidence,
  GoalReviewVerdict,
} from './completion-types.ts';

/**
 * Forced reviewer tool name distinct from user-facing completion tool.
 */
const GOAL_REVIEW_TOOL_NAME = 'submit_goal_review';

/**
 * Separator between finalized evidence chunks.
 */
const EVIDENCE_SEPARATOR = '\n\n---\n\n';

/**
 * Explicit marker prepended when older post-start evidence is omitted.
 */
const TRUNCATION_MARKER = '[Older post-start evidence omitted to fit reviewer context.]';

/**
 * Marker preceding tail-clipped newest evidence entry.
 */
const PARTIAL_NEWEST_ENTRY_MARKER = '[Beginning of newest evidence entry omitted.]';

/**
 * Independent completion-review system rubric.
 */
const GOAL_REVIEW_SYSTEM_PROMPT: string = `You are an independent completion reviewer.
You have no work or investigation tools. You have exactly the required submit_goal_review verdict tool and must judge only the supplied objective, completion summary, and post-start active-branch evidence.
Approve only when every objective requirement visible in the evidence is complete, the summary is consistent with the evidence, claimed verification is supported by finalized output, and no failure, blocker, TODO, or required work remains.
Reject when evidence is incomplete, contradictory, unverified, or reports remaining work.
Feedback must state what remains when rejecting.
Submit exactly the required structured verdict. Do not call ${GOAL_COMPLETE_TOOL_NAME}.`;

/**
 * Reviewer tool returning strict approval and feedback fields.
 */
const GOAL_REVIEW_TOOL: Tool = {
  name: GOAL_REVIEW_TOOL_NAME,
  description: 'Submit independent decision on whether active goal is fully complete.',
  parameters: {
    type: 'object',
    properties: {
      approved: {
        type: 'boolean',
        description: 'True only when supplied evidence proves every objective requirement complete.',
      },
      feedback: {
        type: 'string',
        description: 'Concise independent assessment and actionable remaining work when denied.',
      },
    },
    required: [
      'approved',
      'feedback',
    ],
    additionalProperties: false,
  } as TSchema,
};

/**
 * Candidate reviewer lacks enough context for fixed framing and completion claim.
 *
 * @example
 * ```ts
 * throw new ReviewerContextTooLargeError('model context too small');
 * ```
 */
class ReviewerContextTooLargeError extends Error {
  /**
   * Create candidate-specific context-budget failure.
   *
   * @param message - context budget diagnostic
   */
  constructor(message: string,) {
    super(message,);
    this.name = 'ReviewerContextTooLargeError';
  }
}

/**
 * Candidate-specific reviewer prompt and budget metadata.
 */
type BudgetedGoalReviewPrompt = StructuredReviewPrompt & {
  readonly transcriptTruncated: boolean;
  readonly estimatedInputTokens: number;
};

/**
 * Strictly parse unknown reviewer value.
 *
 * @param value - structured tool arguments or direct JSON retry object
 *
 * @returns valid approval verdict
 *
 * @throws when required fields or exact object shape are invalid
 *
 * @example
 * ```ts
 * parseGoalReviewVerdict({ approved: false, feedback: 'Run tests.' });
 * ```
 */
function parseGoalReviewVerdict(value: unknown,): GoalReviewVerdict {
  if ((value === null) || ((typeof value) !== 'object'))
    throw new Error('Goal reviewer verdict must be an object',);
  /**
   * Exact verdict property names.
   */
  const keys = Object.keys(value,);
  if ((keys.length !== 2)
    || (!('approved' in value))
    || (!('feedback' in value))) {
    throw new Error('Goal reviewer verdict must contain only approved and feedback',);
  }
  /**
   * Unknown approved property after presence validation.
   */
  const { approved, } = value;
  if ((typeof approved) !== 'boolean')
    throw new Error('Goal reviewer approved must be boolean',);
  /**
   * Unknown feedback property after presence validation.
   */
  const { feedback: rawFeedback, } = value;
  if ((typeof rawFeedback) !== 'string')
    throw new Error('Goal reviewer feedback must be string',);
  /**
   * Normalized non-empty reviewer feedback.
   */
  const feedback = rawFeedback.trim();
  if (feedback === '')
    throw new Error('Goal reviewer feedback must be non-empty',);
  return {
    approved,
    feedback,
  };
}

/**
 * Tail-clip newest entry with explicit structural omission marker.
 *
 * @param chunks - ordered evidence chunks
 *
 * @param maximumCharacters - remaining transcript characters
 *
 * @returns marked partial newest evidence or empty text
 *
 * @example
 * ```ts
 * partialNewestEvidence({ chunks: ['long evidence'], maximumCharacters: 32 });
 * ```
 */
function partialNewestEvidence(
  {
    chunks,
    maximumCharacters,
  }: {
    readonly chunks: readonly string[];
    readonly maximumCharacters: number;
  },
): string {
  if (maximumCharacters <= PARTIAL_NEWEST_ENTRY_MARKER.length)
    return '';
  /**
   * Newest finalized evidence chunk.
   */
  const newest = chunks.at(-1,);
  if (newest === undefined)
    return '';
  /**
   * Tail characters available after explicit partial-entry marker.
   */
  const tailCharacters = maximumCharacters
    - PARTIAL_NEWEST_ENTRY_MARKER.length
    - 1;
  return `${PARTIAL_NEWEST_ENTRY_MARKER}\n${newest.slice(-tailCharacters,)}`;
}

/**
 * Retain newest transcript chunks within character budget.
 *
 * @param chunks - ordered post-start evidence chunks
 *
 * @param maximumCharacters - model-specific transcript budget
 *
 * @returns transcript and truncation marker status
 *
 * @throws when omission marker itself cannot fit
 *
 * @example
 * ```ts
 * truncateTranscript({ chunks: ['old', 'new'], maximumCharacters: 64 });
 * ```
 */
function truncateTranscript(
  {
    chunks,
    maximumCharacters,
  }: {
    readonly chunks: readonly string[];
    readonly maximumCharacters: number;
  },
): {
  readonly transcript: string;
  readonly truncated: boolean
} {
  /**
   * Complete transcript before model-specific truncation.
   */
  const complete = chunks.join(EVIDENCE_SEPARATOR,);
  if (complete.length <= maximumCharacters) {
    return {
      transcript: complete,
      truncated: false,
    };
  }
  if (maximumCharacters < TRUNCATION_MARKER.length) {
    throw new ReviewerContextTooLargeError(
      'Reviewer context cannot fit required transcript omission marker',
    );
  }
  /**
   * Characters available after mandatory omission marker and separator.
   */
  const retainedBudget = maximumCharacters
    - TRUNCATION_MARKER.length
    - EVIDENCE_SEPARATOR.length;
  /**
   * Newest complete chunks retained immutably from right to left.
   */
  const retained = chunks
    .toReversed()
    .reduce<{
      readonly characters: number;
      readonly chunks: readonly string[];
    }>(
      function retainNewest(
        state,
        chunk,
      ) {
        /**
         * Separator needed before already-retained newer chunks.
         */
        /**
         * Newer chunks already retained by reduction.
         */
        const { chunks: retainedChunks, } = state;
        /**
         * Separator characters needed before retained newer chunks.
         */
        const separatorCharacters = retainedChunks.length === 0
          ? 0
          : EVIDENCE_SEPARATOR.length;
        /**
         * Characters required for this complete older chunk.
         */
        const required = chunk.length + separatorCharacters;
        if ((state.characters + required) > retainedBudget)
          return state;
        return {
          characters: state.characters + required,
          chunks: [
            chunk,
            ...retainedChunks,
          ],
        };
      },
      {
        characters: 0,
        chunks: [],
      },
    );
  /**
   * Retained newest complete chunks.
   */
  const { chunks: retainedChunks, } = retained;
  /**
   * Retained newest evidence, with marked partial newest chunk fallback.
   */
  const retainedText = retainedChunks.length === 0
    ? partialNewestEvidence({
      chunks,
      maximumCharacters: retainedBudget,
    },)
    : retainedChunks.join(EVIDENCE_SEPARATOR,);
  return {
    transcript: retainedText === ''
      ? TRUNCATION_MARKER
      : `${TRUNCATION_MARKER}${EVIDENCE_SEPARATOR}${retainedText}`,
    truncated: true,
  };
}

/**
 * Build model-specific prompt within context and output reserves.
 *
 * @param evidence - objective, summary, and ordered transcript chunks
 *
 * @param contextWindow - candidate context window tokens
 *
 * @returns budgeted prompt and estimated token count
 *
 * @throws when fixed claim cannot fit candidate context
 *
 * @example
 * ```ts
 * buildBudgetedGoalReviewPrompt({ evidence, contextWindow: 128000 });
 * ```
 */
function buildBudgetedGoalReviewPrompt(
  {
    evidence,
    contextWindow,
  }: {
    readonly evidence: GoalReviewEvidence;
    readonly contextWindow: number;
  },
): BudgetedGoalReviewPrompt {
  /**
   * Candidate input tokens after fixed output and framing reserves.
   */
  const inputTokens = contextWindow
    - REVIEW_OUTPUT_TOKENS
    - REVIEW_FRAMING_TOKENS;
  if (inputTokens <= 0)
    throw new ReviewerContextTooLargeError('Reviewer context is smaller than fixed output and framing reserves',);
  /**
   * Maximum serialized request characters after fixed reserves.
   */
  const maximumCharacters = inputTokens * ESTIMATED_CHARACTERS_PER_TOKEN;
  /**
   * Non-truncatable objective and summary framing.
   */
  const claim = `Objective (exact JSON string): ${JSON.stringify(evidence.objective,)}\nCompletion summary (exact JSON string): ${JSON.stringify(evidence.summary,)}\nPost-start active-branch evidence:\n`;
  /**
   * Transcript characters remaining after system rubric and fixed claim.
   */
  const transcriptCharacters = maximumCharacters
    - GOAL_REVIEW_SYSTEM_PROMPT.length
    - claim.length;
  if (transcriptCharacters < 0)
    throw new ReviewerContextTooLargeError('Reviewer context cannot fit objective and completion summary',);
  /**
   * Model-specific newest-evidence retention.
   */
  const {
    transcript,
    truncated,
  } = truncateTranscript({
    chunks: evidence.transcriptChunks,
    maximumCharacters: transcriptCharacters,
  },);
  /**
   * Complete reviewer user content.
   */
  const userContent = `${claim}${transcript}`;
  return {
    systemPrompt: GOAL_REVIEW_SYSTEM_PROMPT,
    userContent,
    transcriptTruncated: truncated,
    estimatedInputTokens: Math.ceil(
      (GOAL_REVIEW_SYSTEM_PROMPT.length + userContent.length)
      / ESTIMATED_CHARACTERS_PER_TOKEN,
    ),
  };
}

/**
 * Goal verdict contract used by shared structured transport.
 */
const GOAL_REVIEW_CONTRACT: StructuredReviewContract<GoalReviewVerdict> = {
  toolName: GOAL_REVIEW_TOOL_NAME,
  tool: GOAL_REVIEW_TOOL,
  parse: parseGoalReviewVerdict,
  buildJsonRetryPrompt({
    initialPrompt,
    firstAttemptTextContent,
  },) {
    return {
      systemPrompt: initialPrompt.systemPrompt,
      userContent: `${initialPrompt.userContent}\n\nThe forced tool was omitted. Return only JSON with exactly {"approved": boolean, "feedback": string}. Prior text, if any: ${JSON.stringify(firstAttemptTextContent,)}`,
    };
  },
};

export {
  buildBudgetedGoalReviewPrompt,
  GOAL_REVIEW_CONTRACT,
  GOAL_REVIEW_SYSTEM_PROMPT,
  GOAL_REVIEW_TOOL,
  GOAL_REVIEW_TOOL_NAME,
  parseGoalReviewVerdict,
  ReviewerContextTooLargeError,
  truncateTranscript,
};
export type { BudgetedGoalReviewPrompt, };

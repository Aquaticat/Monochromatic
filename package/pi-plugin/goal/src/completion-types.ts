/**
 * Completion-review domain contracts.
 *
 * @module
 */

import type {
  Api,
  Model,
} from '@earendil-works/pi-ai';
import type {
  AgentToolResult,
  ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type { StructuredReviewAuth, } from '@monochromatic-dev/pi-shared-model-review/ts';

import type {
  ActiveGoalState,
  GoalRuntimeEpoch,
} from './types.ts';

/**
 * Strict secondary-review decision.
 */
type GoalReviewVerdict = {
  readonly approved: boolean;
  readonly feedback: string;
};

/**
 * Locally validated completion request and stale-result capture.
 */
type ValidGoalCompletionRequest = {
  readonly goal: ActiveGoalState;
  readonly goalId: string;
  readonly summary: string;
  readonly runtimeEpoch: GoalRuntimeEpoch;
  readonly branchLeafId: string;
  readonly toolCallId: string;
};

/**
 * Serialized post-start evidence independent of reviewer model budget.
 */
type GoalReviewEvidence = {
  readonly objective: string;
  readonly summary: string;
  readonly transcriptChunks: readonly string[];
};

/**
 * Authenticated distinct reviewer and candidate-specific prompt.
 */
type GoalReviewerCandidate = {
  readonly model: ForeignBorrowed<Model<Api>>;
  readonly auth: ForeignBorrowed<StructuredReviewAuth>;
  readonly systemPrompt: string;
  readonly userContent: string;
  readonly transcriptTruncated: boolean;
};

/**
 * Successful independent review with transport audit.
 */
type GoalCompletionReview = {
  readonly verdict: GoalReviewVerdict;
  readonly reviewerIdentity: string;
  readonly attemptedReviewerIdentities: readonly string[];
  readonly transcriptTruncated: boolean;
};

/**
 * Production completion reviewer capability.
 */
type GoalCompletionReviewer = (
  input: {
    readonly request: ValidGoalCompletionRequest;
    readonly context: ForeignBorrowed<ExtensionContext>;
    readonly signal?: AbortSignal;
  },
) => Promise<GoalCompletionReview>;

/**
 * Structured result details returned by `goal_complete`.
 */
type GoalCompletionDetails = {
  readonly outcome:
    | 'approved'
    | 'denied'
    | 'rejected'
    | 'stale'
    | 'review_unavailable';
  readonly reviewerIdentity?: string;
  readonly reviewerFeedback?: string;
  readonly attemptedReviewerIdentities?: readonly string[];
  readonly transcriptTruncated?: boolean;
};

/**
 * Complete Pi tool result for goal completion.
 */
type GoalCompletionResult = AgentToolResult<GoalCompletionDetails>;

export type {
  GoalCompletionDetails,
  GoalCompletionReview,
  GoalCompletionResult,
  GoalCompletionReviewer,
  GoalReviewEvidence,
  GoalReviewerCandidate,
  GoalReviewVerdict,
  ValidGoalCompletionRequest,
};

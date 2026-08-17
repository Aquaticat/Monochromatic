/**
 * Retry and reconciliation loop for one GitHub Issue creation.
 *
 * @module
 */

import {
  GitHubProcessError,
  GitHubProcessTimeoutError,
} from './github-process.ts';
import type {
  GitHubApiClient,
  GitHubRepository,
} from './github-model.ts';
import type { IncludedResponse, } from './github-response.ts';
import { isRecord, } from './json-record.ts';
import type { RenderedIssue, } from './issue-model.ts';
import { IssuePublicationError, } from './publication-error.ts';
import type {
  CreatedIssue,
  PublicationWait,
} from './publisher-model.ts';
import {
  readHighWater,
  reconcileCreate,
} from './reconcile.ts';

/**
 * Successful GitHub Issue creation status.
 */
const HTTP_CREATED = 201;

/**
 * Too-many-requests status.
 */
const HTTP_TOO_MANY_REQUESTS = 429;

/**
 * Forbidden status used by exhausted GitHub rate limit.
 */
const HTTP_FORBIDDEN = 403;

/**
 * Lowest server-error status.
 */
const HTTP_SERVER_ERROR_MINIMUM = 500;

/**
 * Highest server-error status.
 */
const HTTP_SERVER_ERROR_MAXIMUM = 599;

/**
 * Maximum retries after initial create request.
 */
const MAXIMUM_RETRIES = 3;

/**
 * Base network and server retry delay.
 */
const TRANSIENT_RETRY_BASE_MS = 1_000;

/**
 * Base rate retry delay when headers are absent.
 */
const RATE_RETRY_BASE_MS = 60_000;

/**
 * One create attempt response or process failure.
 */
type CreateAttempt =
  | {
    readonly kind: 'response';
    readonly response: IncludedResponse;
  }
  | {
    readonly kind: 'process-failure';
    readonly error: GitHubProcessError | GitHubProcessTimeoutError;
  };

/**
 * Creates one raw Issue request and captures retryable process failures.
 */
async function attemptCreate({
  repository,
  issue,
  api,
}: {
  readonly repository: GitHubRepository;
  readonly issue: RenderedIssue;
  readonly api: GitHubApiClient;
},): Promise<CreateAttempt> {
  try {
    return {
      kind: 'response',
      response: await api({
        method: 'POST',
        endpoint: `repos/${repository.owner}/${repository.name}/issues`,
        body: {
          title: issue.title,
          body: issue.body,
          labels: issue.labels,
        },
      },),
    };
  }
  catch (error: unknown) {
    if ((error instanceof GitHubProcessError)
      || (error instanceof GitHubProcessTimeoutError))
    {
      return {
        kind: 'process-failure',
        error,
      };
    }
    throw error;
  }
}

/**
 * Parses successful Issue create response.
 */
function parseCreatedIssue({
  issue,
  response,
}: {
  readonly issue: RenderedIssue;
  readonly response: IncludedResponse;
},): CreatedIssue {
  if ((response.status !== HTTP_CREATED)
    || (!isRecord(response.body,))
    || ((typeof response.body
      .number) !== 'number')
    || (!Number.isInteger(response.body
      .number,))
    || (response.body
      .number
      < 1)
    || ((typeof response.body
      .html_url) !== 'string'))
  {
    throw new IssuePublicationError(`Issue creation failed with HTTP ${String(response.status,)}`,);
  }
  return {
    position: issue.position,
    number: response.body
      .number,
    url: response.body
      .html_url,
  };
}

/**
 * Determines whether response represents rate-limit rejection.
 */
function isRateLimit(response: IncludedResponse,): boolean {
  return (response.status === HTTP_TOO_MANY_REQUESTS)
    || ((response.status === HTTP_FORBIDDEN)
      && ((response.headers['x-ratelimit-remaining'] === '0')
        || (response.headers['retry-after'] !== undefined)));
}

/**
 * Determines whether response is ambiguous server failure.
 */
function isServerError(response: IncludedResponse,): boolean {
  return (response.status >= HTTP_SERVER_ERROR_MINIMUM)
    && (response.status <= HTTP_SERVER_ERROR_MAXIMUM);
}

/**
 * Reads positive numeric header as milliseconds.
 */
function headerSeconds({
  value,
  multiplier,
}: {
  readonly value?: string;
  readonly multiplier: number;
},): number {
  if (value === undefined) {
    return 0;
  }
  /**
   * Numeric header candidate.
   */
  const parsed = Number(value,);
  return Number.isFinite(parsed,) && (parsed > 0) ? parsed * multiplier : 0;
}

/**
 * Calculates header-aware rate delay for one retry index.
 */
function rateDelay({
  response,
  retryIndex,
  now,
}: {
  readonly response: IncludedResponse;
  readonly retryIndex: number;
  readonly now: () => number;
},): number {
  /**
   * Retry-after delay converted from seconds.
   */
  const retryAfter = headerSeconds({
    value: response.headers['retry-after'],
    multiplier: 1_000,
  });
  if (retryAfter > 0) {
    return retryAfter;
  }
  /**
   * Absolute reset instant converted from seconds.
   */
  const reset = headerSeconds({
    value: response.headers['x-ratelimit-reset'],
    multiplier: 1_000,
  });
  if (reset > 0) {
    return Math.max(
      0,
      reset - now(),
    );
  }
  return RATE_RETRY_BASE_MS * (2 ** retryIndex);
}

/**
 * Creates one Issue with three bounded retries and ambiguity reconciliation.
 */
export async function createIssueWithRetry({
  repository,
  issue,
  api,
  wait,
  now,
}: {
  readonly repository: GitHubRepository;
  readonly issue: RenderedIssue;
  readonly api: GitHubApiClient;
  readonly wait: PublicationWait;
  readonly now: () => number;
},): Promise<CreatedIssue> {
  /**
   * Shared number boundary recorded before first create attempt.
   */
  const highWater = await readHighWater({
    repository,
    api,
  });
  for (let attemptIndex = 0; attemptIndex <= MAXIMUM_RETRIES; attemptIndex += 1) {
    /**
     * Current create response or process-level failure.
     */
    const attempt = await attemptCreate({
      repository,
      issue,
      api,
    });
    if ((attempt.kind === 'response') && (attempt.response
      .status
      === HTTP_CREATED)) {
      return parseCreatedIssue({
        issue,
        response: attempt.response,
      });
    }
    /**
     * Whether current failure may have created remote Issue.
     */
    const ambiguous = (attempt.kind === 'process-failure')
      || isServerError(attempt.response,);
    if (ambiguous) {
      /**
       * Exact post-failure reconciliation result.
       */
      const reconciliation = await reconcileCreate({
        repository,
        issue,
        highWater,
        api,
      },);
      if (reconciliation.kind === 'match') {
        return reconciliation.created;
      }
    }
    /**
     * Whether current response qualifies for rate-aware retry.
     */
    const rateLimited = (attempt.kind === 'response') && isRateLimit(attempt.response,);
    /**
     * Whether current failure belongs to settled retry classes.
     */
    const retryable = ambiguous || rateLimited;
    if ((!retryable) || (attemptIndex === MAXIMUM_RETRIES)) {
      const status = attempt.kind === 'response'
        ? `HTTP ${String(attempt.response
          .status,)}`
        : attempt.error
          .message;
      throw new IssuePublicationError(
        `Issue creation stopped after ${String(attemptIndex + 1,)} attempt(s): ${status}`,
      );
    }
    /**
     * Settled delay before next mutative retry.
     */
    const retryDelay = rateLimited && (attempt.kind === 'response')
      ? rateDelay({
        response: attempt.response,
        retryIndex: attemptIndex,
        now,
      })
      : TRANSIENT_RETRY_BASE_MS * (2 ** attemptIndex);
    await wait(Math.max(
      TRANSIENT_RETRY_BASE_MS,
      retryDelay,
    ),);
  }
  throw new IssuePublicationError('Issue creation retry loop reached an impossible state',);
}

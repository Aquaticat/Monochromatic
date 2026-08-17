/**
 * Serial paced GitHub Issue publication.
 *
 * @module
 */

import { setTimeout as delay, } from 'node:timers/promises';

import type {
  GitHubApiClient,
  GitHubRepository,
} from './github-model.ts';
import { isRecord, } from './json-record.ts';
import type { RenderedIssue, } from './issue-model.ts';
import type {
  CreatedIssue,
  PublicationResult,
  PublicationWait,
} from './publisher-model.ts';

/**
 * Successful GitHub read status.
 */
const HTTP_OK = 200;

/**
 * Successful GitHub Issue creation status.
 */
const HTTP_CREATED = 201;

/**
 * Minimum interval between mutative requests.
 */
const MUTATION_INTERVAL_MS = 1_000;

/**
 * Reports terminal publication response failure.
 */
export class IssuePublicationError extends Error {
  /**
   * Creates publication failure.
   *
   * @param message - Safe status or response-shape diagnostic.
   *
   * @example
   * ```ts
   * const error = new IssuePublicationError('Issue creation failed');
   * ```
   */
  public constructor(message: string,) {
    super(message,);
    this.name = 'IssuePublicationError';
  }
}

/**
 * Default abortable-independent delay implementation.
 *
 * @param milliseconds - Delay duration.
 *
 * @returns Completion after elapsed delay.
 *
 * @example
 * ```ts
 * await defaultWait(1000);
 * ```
 */
async function defaultWait(milliseconds: number,): Promise<void> {
  await delay(milliseconds,);
}

/**
 * Builds repository endpoint prefix.
 *
 * @param repository - Canonical destination identity.
 *
 * @returns REST owner/name prefix.
 *
 * @example
 * ```ts
 * repositoryEndpoint(repository); // 'repos/owner/name'
 * ```
 */
function repositoryEndpoint(repository: GitHubRepository,): string {
  return `repos/${repository.owner}/${repository.name}`;
}

/**
 * Reads greatest current shared Issue or pull-request number.
 *
 * @param repository - Canonical destination identity.
 *
 * @param api - Authenticated GitHub API client.
 *
 * @returns Current high-water number or zero for empty repository.
 *
 * @throws {@link IssuePublicationError} when response is not valid list.
 *
 * @example
 * ```ts
 * await readHighWater({ repository, api });
 * ```
 */
async function readHighWater({
  repository,
  api,
}: {
  readonly repository: GitHubRepository;
  readonly api: GitHubApiClient;
},): Promise<number> {
  /**
   * Most-recent Issue list response.
   */
  const response = await api({
    method: 'GET',
    endpoint: `${repositoryEndpoint(repository,)}/issues?state=all&sort=created&direction=desc&per_page=1`,
  },);
  if (response.status !== HTTP_OK || !Array.isArray(response.body,)) {
    throw new IssuePublicationError(
      `Issue high-water lookup failed with HTTP ${String(response.status,)}`,
    );
  }
  return response.body.reduce(function greatestNumber(greatest, item,): number {
    if (!isRecord(item,)
      || (typeof item.number) !== 'number'
      || !Number.isInteger(item.number,)
      || item.number < 1)
    {
      throw new IssuePublicationError('Issue high-water response contains invalid number',);
    }
    return Math.max(greatest, item.number,);
  }, 0,);
}

/**
 * Parses successful Issue create response.
 *
 * @param issue - Requested rendered Issue carrying input position.
 *
 * @param status - Create HTTP status.
 *
 * @param body - Untrusted response JSON.
 *
 * @returns Confirmed created Issue identity.
 *
 * @throws {@link IssuePublicationError} when status or body is invalid.
 *
 * @example
 * ```ts
 * parseCreatedIssue({ issue, status: 201, body: { number: 1, html_url: 'https://...' } });
 * ```
 */
function parseCreatedIssue({
  issue,
  status,
  body,
}: {
  readonly issue: RenderedIssue;
  readonly status: number;
  readonly body: unknown;
},): CreatedIssue {
  if (status !== HTTP_CREATED
    || !isRecord(body,)
    || (typeof body.number) !== 'number'
    || !Number.isInteger(body.number,)
    || body.number < 1
    || (typeof body.html_url) !== 'string')
  {
    throw new IssuePublicationError(`Issue creation failed with HTTP ${String(status,)}`,);
  }
  return {
    position: issue.position,
    number: body.number,
    url: body.html_url,
  };
}

/**
 * Creates one Issue after recording its high-water mark.
 *
 * @param repository - Canonical destination identity.
 *
 * @param issue - Complete rendered create request.
 *
 * @param api - Authenticated GitHub API client.
 *
 * @returns Confirmed created Issue identity.
 *
 * @example
 * ```ts
 * await createIssue({ repository, issue, api });
 * ```
 */
async function createIssue({
  repository,
  issue,
  api,
}: {
  readonly repository: GitHubRepository;
  readonly issue: RenderedIssue;
  readonly api: GitHubApiClient;
},): Promise<CreatedIssue> {
  await readHighWater({ repository, api, });
  /**
   * Issue create response.
   */
  const response = await api({
    method: 'POST',
    endpoint: `${repositoryEndpoint(repository,)}/issues`,
    body: {
      title: issue.title,
      body: issue.body,
      labels: issue.labels,
    },
  },);
  return parseCreatedIssue({
    issue,
    status: response.status,
    body: response.body,
  },);
}

/**
 * Creates rendered Issues serially with provider-aligned pacing.
 *
 * @param repository - Canonical destination identity.
 *
 * @param issues - Authorized rendered Issues in publication order.
 *
 * @param api - Authenticated GitHub API client.
 *
 * @param wait - Injectable delay implementation.
 *
 * @returns Complete successful creation identities.
 *
 * @example
 * ```ts
 * await publishIssues({ repository, issues, api });
 * ```
 */
export async function publishIssues({
  repository,
  issues,
  api,
  wait = defaultWait,
}: {
  readonly repository: GitHubRepository;
  readonly issues: readonly RenderedIssue[];
  readonly api: GitHubApiClient;
  readonly wait?: PublicationWait;
},): Promise<PublicationResult> {
  /**
   * Mutable result list scoped to this serial ownership boundary.
   */
  const created: CreatedIssue[] = [];
  for (const issue of issues) {
    if (created.length > 0) {
      await wait(MUTATION_INTERVAL_MS,);
    }
    created.push(await createIssue({ repository, issue, api, }),);
  }
  return { created, };
}

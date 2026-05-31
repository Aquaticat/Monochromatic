/**
 * Read/write helpers for PR reviews.
 *
 * `submitReviewWithEvent` writes the review row and a `review.submitted`
 * event in one transaction so the dispatcher can rebuild the affected
 * PR-detail and review-thread fragments.
 */

import db, {
  all,
  run,
} from '../db.ts';
import {
  insertEvent,
  nextSequence,
} from './event-log.ts';
import type { Review, } from './types.ts';

/**
 * Inserts a review row without an event-log entry.
 *
 * Used by the seed package; production callers should use
 * {@link submitReviewWithEvent} instead so the dispatcher gets notified.
 *
 * @param row - review fields
 *
 * @example
 * ```ts
 * await insertReview({
 *   id: 'rv1',
 *   prIssueId: 'i1',
 *   reviewerId: 'u2',
 *   state: 'approved',
 *   body: 'LGTM',
 *   createdAt: Date.now(),
 * });
 * ```
 */
export async function insertReview(row: {
  readonly id: string;
  readonly prIssueId: string;
  readonly reviewerId: string;
  readonly state: string;
  readonly body?: string;
  readonly createdAt: number;
},): Promise<void> {
  await run({
    sql:
      `INSERT OR IGNORE INTO reviews(id, pr_issue_id, reviewer_id, state, body, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    params: [
      row.id,
      row.prIssueId,
      row.reviewerId,
      row.state,
      row.body
        ?? '',
      row.createdAt,
    ],
  },);
}

/**
 * Atomically inserts a review and writes a `review.submitted` event,
 * advancing the PR's sequence.
 *
 * @param row - review fields
 *
 * @returns generated `events.id` for the `review.submitted` event
 *
 * @example
 * ```ts
 * const eventId = await submitReviewWithEvent({
 *   id: 'rv1',
 *   prIssueId: 'i1',
 *   reviewerId: 'u2',
 *   state: 'approved',
 *   body: 'LGTM',
 *   createdAt: Date.now(),
 * });
 * ```
 */
export async function submitReviewWithEvent(row: {
  readonly id: string;
  readonly prIssueId: string;
  readonly reviewerId: string;
  readonly state: string;
  readonly body?: string;
  readonly createdAt: number;
},): Promise<number> {
  await db.exec('BEGIN IMMEDIATE',);
  try {
    await run({
      sql: `INSERT INTO reviews(id, pr_issue_id, reviewer_id, state, body, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      params: [
        row.id,
        row.prIssueId,
        row.reviewerId,
        row.state,
        row.body
          ?? '',
        row.createdAt,
      ],
    },);
    await run({
      sql: 'UPDATE issues SET updated_at = ? WHERE id = ?',
      params: [
        row.createdAt,
        row.prIssueId,
      ],
    },);
    /**
     * Per-resource monotonic sequence captured before the event row insert.
     */
    const sequenceNumber = await nextSequence({
      resourceType: 'pr',
      resourceId: row.prIssueId,
    },);
    /**
     * Generated `events.id` returned to callers for cursor tracking.
     */
    const eventId = await insertEvent({
      resourceType: 'pr',
      resourceId: row.prIssueId,
      kind: 'review.submitted',
      payload: {
        reviewId: row.id,
        reviewerId: row.reviewerId,
        state: row.state,
      },
      sequenceNumber,
      createdAt: row.createdAt,
    },);
    await db.exec('COMMIT',);
    return eventId;
  }
  catch (error) {
    await db.exec('ROLLBACK',);
    throw error;
  }
}

/**
 * Lists reviews for a PR, oldest first.
 *
 * @param prIssueId - PR's issue id
 *
 * @returns reviews array (possibly empty)
 *
 * @example
 * ```ts
 * const reviews = await listReviewsForPr('i1');
 * ```
 */
export async function listReviewsForPr(prIssueId: string,): Promise<Review[]> {
  return await all<Review>({
    sql: 'SELECT * FROM reviews WHERE pr_issue_id = ? ORDER BY created_at ASC, id ASC',
    params: [prIssueId,],
  },);
}

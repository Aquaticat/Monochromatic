/**
 * Planned GitHub Issue contracts.
 *
 * @module
 */

import type { InputPosition, } from './model.ts';

/**
 * Complete create-only Issue request after deterministic rendering.
 *
 * @example
 * ```ts
 * const issue: RenderedIssue = {
 *   position: { kind: 'record', value: 1 },
 *   security: false,
 *   title: '[bug] src/a.ts: Correct the branch',
 *   body: '## Finding',
 *   labels: ['needs-triage'],
 * };
 * ```
 */
export type RenderedIssue = {
  readonly position: InputPosition;
  readonly security: boolean;
  readonly title: string;
  readonly body: string;
  readonly labels: readonly string[];
};

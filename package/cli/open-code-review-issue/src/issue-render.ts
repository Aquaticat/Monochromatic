/**
 * Deterministic GitHub Issue body and request rendering.
 *
 * @module
 */

import type { RenderedIssue, } from './issue-model.ts';
import { renderIssueTitle, } from './issue-title.ts';
import {
  escapeMarkdownInline,
  indentCode,
} from './markdown.ts';
import type { NormalizedFinding, } from './model.ts';

/**
 * Builds plain source location line.
 *
 * @param finding - Validated finding carrying source range.
 *
 * @returns Markdown source location item.
 *
 * @example
 * ```ts
 * renderSourceLocation(finding); // '- Location: src/a.ts:1-2'
 * ```
 */
function renderSourceLocation(finding: NormalizedFinding,): string {
  return `- Location: ${escapeMarkdownInline(finding.path,)}:${String(finding.startLine,)}-${String(finding.endLine,)}`;
}

/**
 * Renders optional indented code section.
 *
 * @param heading - Stable Markdown section heading.
 *
 * @param code - OCR source field.
 *
 * @returns Complete section lines or empty list when field is absent.
 *
 * @example
 * ```ts
 * renderCodeSection({ heading: 'Existing code', code: 'x' });
 * ```
 */
function renderCodeSection({
  heading,
  code,
}: {
  readonly heading: string;
  readonly code: string;
},): readonly string[] {
  return code === ''
    ? []
    : [
      `## ${heading}`,
      '',
      indentCode(code,),
      '',
    ];
}

/**
 * Renders complete body while retaining OCR content as active Markdown.
 *
 * @param finding - Validated normalized finding.
 *
 * @returns Deterministic GitHub Flavored Markdown body.
 *
 * @example
 * ```ts
 * renderIssueBody(finding);
 * ```
 */
export function renderIssueBody(finding: NormalizedFinding,): string {
  /**
   * Category metadata with explicit missing value.
   */
  const category = finding.category ?? 'uncategorized';
  /**
   * Severity metadata with explicit missing value.
   */
  const severity = finding.severity ?? 'unspecified';
  return [
    '## Finding',
    '',
    finding.content,
    '',
    '## Source',
    '',
    renderSourceLocation(finding,),
    `- Category: \`${category}\``,
    `- Severity: \`${severity}\``,
    '',
    ...renderCodeSection({
      heading: 'Existing code',
      code: finding.existingCode,
    },),
    ...renderCodeSection({
      heading: 'Suggested code',
      code: finding.suggestionCode,
    },),
    '## OpenCodeReview',
    '',
    'Generated from OpenCodeReview structured output.',
  ].join('\n',);
}

/**
 * Renders one complete create-only Issue request.
 *
 * @param finding - Validated normalized finding.
 *
 * @param needsTriageLabel - Whether destination label exists.
 *
 * @returns Deterministic title, body, labels, position, and security marker.
 *
 * @example
 * ```ts
 * renderIssue({ finding, needsTriageLabel: true });
 * ```
 */
export function renderIssue({
  finding,
  needsTriageLabel,
}: {
  readonly finding: NormalizedFinding;
  readonly needsTriageLabel: boolean;
},): RenderedIssue {
  return {
    position: finding.position,
    security: finding.category === 'security',
    title: renderIssueTitle({ finding, needsTriageLabel, }),
    body: renderIssueBody(finding,),
    labels: needsTriageLabel ? ['needs-triage',] : [],
  };
}

import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type { AdjudicatedIssue, } from './adjudicate-model.ts';
import type { EditableEnvelope, } from './patch-model.ts';

//region Editor prompt
// One prompt per editor model per chunk: the document pair plus numbered
// edit regions, each carrying the accepted issues it serves and its exact
// current text with disambiguating context. Editors answer with region
// numbers, never offsets or hashes; the resolver binds numbers back to
// envelopes from the same plan that built the prompt, and the deterministic
// apply gate proves every change stayed inside its envelope.

/**
 * Fence line separating instructions from document text.
 */
const EDITOR_FENCE = '=====';

/**
 * Characters of surrounding document shown on each side of a region,
 * so editors locate it even when the base text recurs elsewhere.
 */
const REGION_CONTEXT_CHARS = 40;

/**
 * System instructions shared by every editor call.
 */
const EDITOR_SYSTEM_PROMPT = `You are a careful bilingual translation editor.
Reviewers confirmed the numbered issues below in the TRANSLATION of the ORIGINAL document.
Fix them by rewriting ONLY the numbered edit regions.

Rules, strictly enforced by a machine:
- For each region you fix, return its number and the full replacement text for exactly that region.
- Change as little as possible; keep the surrounding wording untouched.
- An empty CURRENT TEXT marks omitted content: write the missing translation there, matching the surrounding style, and include any spacing the insertion needs.
- Preserve footnote markers like [^1] character for character.
- Never introduce content the ORIGINAL does not support.
- Omit a region entirely when you cannot fix it faithfully; a skipped region stays unchanged.

Reply with ONLY a JSON object of shape {"edits": [{"region": 1, "newText": "..."}]}. No prose, no code fences.`;

/**
 * Messages plus the envelope order edits resolve through:
 * region number N on the wire means `envelopes[N - 1]`.
 *
 * @example
 * ```ts
 * const plan: EditorPromptPlan = buildEditorMessages({
 *   sourceText,
 *   targetText,
 *   envelopes,
 *   issues,
 * },);
 * ```
 */
export type EditorPromptPlan = {
  /**
   * Messages ready for `chatJson`.
   */
  readonly messages: readonly ChatMessage[];

  /**
   * Envelopes in prompt numbering order.
   */
  readonly envelopes: readonly EditableEnvelope[];
};

/**
 * One region block of the prompt sheet.
 *
 * @param envelope - envelope under presentation
 *
 * @param regionNumber - one-based number on the sheet
 *
 * @param targetText - full translation for context extraction
 *
 * @param issues - adjudicated issues for summary lookup
 *
 * @returns Rendered region block
 *
 * @example
 * ```ts
 * regionBlock({ envelope, regionNumber: 1, targetText, issues, },);
 * ```
 */
function regionBlock(
  {
    envelope,
    regionNumber,
    targetText,
    issues,
  }: {
    readonly envelope: EditableEnvelope;
    readonly regionNumber: number;
    readonly targetText: string;
    readonly issues: readonly AdjudicatedIssue[];
  },
): string {
  /**
   * Issue lines for every issue this envelope serves.
   */
  const issueLines = envelope
    .issueIds
    .flatMap(function toLine(issueId,) {
      /**
       * Issue behind this id, when the caller supplied it.
       */
      const issue = issues.find(function matches(candidate,) {
        return candidate.issueId === issueId;
      },);
      if (issue === undefined)
        return [];
      return issue.claims
        .map(function toSummary(member,) {
        return `- issue (${member.claim
          .category}, ${issue.severity}): ${member.claim
            .summary}`;
      },);
    },);

  /**
   * Document context before the region.
   */
  const before = targetText.slice(
    Math.max(
      0,
      envelope.startOffset - REGION_CONTEXT_CHARS,
    ),
    envelope.startOffset,
  );

  /**
   * Document context after the region.
   */
  const after = targetText.slice(
    envelope.endOffset,
    envelope.endOffset + REGION_CONTEXT_CHARS,
  );

  /**
   * Current-text line; insertions present their emptiness explicitly.
   */
  const currentLine = envelope.baseText === ''
    ? 'CURRENT TEXT: (empty; content is missing here)'
    : `CURRENT TEXT: ${envelope.baseText}`;

  return `REGION ${regionNumber}
${issueLines.join('\n',)}
${currentLine}
CONTEXT: ...${before}«REGION ${regionNumber}»${after}...`;
}

/**
 * Builds the editor sheet for one chunk:
 * documents fenced, envelopes as numbered regions with their issues,
 * current text, and disambiguating context.
 *
 * @param sourceText - original chunk text
 *
 * @param targetText - translation chunk text the envelopes were cut from
 *
 * @param envelopes - non-overlapping envelopes in document order
 *
 * @param issues - adjudicated issues referenced by the envelopes
 *
 * @returns Messages plus the envelope numbering order
 *
 * @example
 * ```ts
 * const plan = buildEditorMessages({ sourceText, targetText, envelopes, issues, },);
 * ```
 */
export function buildEditorMessages(
  {
    sourceText,
    targetText,
    envelopes,
    issues,
  }: {
    readonly sourceText: string;
    readonly targetText: string;
    readonly envelopes: readonly EditableEnvelope[];
    readonly issues: readonly AdjudicatedIssue[];
  },
): EditorPromptPlan {
  /**
   * Rendered region blocks in envelope order.
   */
  const blocks = envelopes.map(function toBlock(
    envelope,
    index,
  ) {
    return regionBlock({
      envelope,
      regionNumber: index + 1,
      targetText,
      issues,
    },);
  },);

  return {
    messages: [
      {
        role: 'system',
        content: EDITOR_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `${EDITOR_FENCE} ORIGINAL ${EDITOR_FENCE}
${sourceText}
${EDITOR_FENCE} TRANSLATION ${EDITOR_FENCE}
${targetText}
${EDITOR_FENCE} EDIT REGIONS ${EDITOR_FENCE}
${blocks.join('\n\n',)}
${EDITOR_FENCE} END ${EDITOR_FENCE}`,
      },
    ],
    envelopes,
  };
}

//endregion Editor prompt

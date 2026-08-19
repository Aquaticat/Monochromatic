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
 * What the neighbouring blocks are for, stated inside the editor sheet.
 *
 * THE EDITOR IS WHERE THE WINDOW EITHER PAYS OR DOES HARM, so its rule is the
 * strictest of the three. `#107`'s `lintong` damage is an editor outcome: handed
 * a one-sentence original against a four-sentence incumbent, it repaired the
 * sentence it could match and left the other three in place, and the neighbour's
 * own new translation then said them a second time. Seeing next door is what
 * lets it recognise that case.
 *
 * THE OPPOSITE FAILURE IS WORSE AND IS NAMED HERE TOO. An editor that removes a
 * passage because it can see it next door, when the neighbouring slice does not
 * in fact keep it, deletes content the document had. Removal is therefore
 * allowed only against wording the NEARBY EXISTING TRANSLATION already carries,
 * which is text that is already in the document rather than text some other
 * stage might yet produce.
 */
const NEARBY_RULE = 'THE TWO NEARBY BLOCKS ARE CONTEXT AND MUST NOT BE EDITED. '
  + 'Never copy them into your output. If a region here repeats wording the '
  + 'NEARBY EXISTING TRANSLATION already carries, that repetition is the defect '
  + 'and removing it here is correct. Remove nothing on the grounds that a '
  + 'neighbour OUGHT to carry it';

/**
 * Characters of surrounding document shown on each side of a region,
 * so editors locate it even when the base text recurs elsewhere.
 */
const REGION_CONTEXT_CHARS = 40;

/**
 * Rule block of the editor system prompt; a calibration addendum splices
 * after its last rule line.
 */
const EDITOR_RULES_BLOCK = `You are a careful bilingual translation editor.
Reviewers confirmed the numbered issues below in the TRANSLATION of the ORIGINAL document.
Fix them by rewriting ONLY the numbered edit regions.

Rules, strictly enforced by a machine:
- For each region you fix, return its number and the full replacement text for exactly that region.
- Change as little as possible; keep the surrounding wording untouched.
- An empty CURRENT TEXT marks omitted content: write the missing translation there, matching the surrounding style, and include any spacing the insertion needs.
- When an issue reports omitted content, translate ALL of the missing content in full sentences; never summarize, compress, or drop clauses. A short paraphrase of a long omission is not a fix.
- When a region fills an omission, first locate the exact ORIGINAL sentence or sentences the omission corresponds to, then translate them clause by clause: every clause and every detail of those ORIGINAL sentences must appear in your replacement, none merged or summarized away.
- Write natural, idiomatic prose carrying the ORIGINAL's feeling: its voice, warmth, humor, grief, or irony. Emotional completeness and naturalness outrank word-for-word correspondence, so recast wording, sentence boundaries, and clause order freely when that serves the feeling. A stiff literal rendering that loses the feeling is not a fix.
- Naturalness never licenses dropping content: every detail of the ORIGINAL must survive your rewrite, recast rather than removed.
- Keep any phrase the ORIGINAL writes in a language other than its own in that original wording, and put its meaning alongside it, following whatever convention the document already uses for this, otherwise in parentheses immediately after. Never replace such a phrase with its meaning alone.
- The ORIGINAL's own language is never such a phrase: render it fully into the TRANSLATION's language as usual, including inside quotations and stylized multilingual lines. Only the genuinely foreign phrase keeps its own wording.
- Preserve footnote markers like [^1] character for character.
- Never introduce content the ORIGINAL does not support.
- When the CURRENT TEXT is line-structured, meaning short lines separated by blank lines rather than paragraphs, the line is the unit: keep one output line per input line, in the same order, and recast only within a line. Never merge, split, reorder or invent lines.
- Omit a region entirely when you cannot fix it faithfully; a skipped region stays unchanged.`;

/**
 * Reply-shape block closing the editor system prompt.
 */
const EDITOR_REPLY_BLOCK = `Reply with ONLY a JSON object of shape {"edits": [{"region": 1, "newText": "..."}]}. No prose, no code fences.`;

/**
 * System instructions shared by every baseline editor call.
 */
const EDITOR_SYSTEM_PROMPT = `${EDITOR_RULES_BLOCK}

${EDITOR_REPLY_BLOCK}`;

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
 * @param editorRuleAddendum - extra rule line appended to the enforced
 * rule list, for prompt calibration experiments
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
    editorRuleAddendum,
    neighbouringIncumbentText,
    neighbouringSourceText,
  }: {
    readonly sourceText: string;
    readonly targetText: string;
    readonly envelopes: readonly EditableEnvelope[];
    readonly issues: readonly AdjudicatedIssue[];
    readonly editorRuleAddendum?: string;
    readonly neighbouringIncumbentText?: string;
    readonly neighbouringSourceText?: string;
  },
): EditorPromptPlan {
  /**
   * The passages either side, or nothing when this slice stands alone.
   */
  const nearbyBlock = ((neighbouringSourceText === undefined)
      || (neighbouringSourceText === ''))
      && ((neighbouringIncumbentText === undefined)
        || (neighbouringIncumbentText === ''))
    ? ''
    : `${EDITOR_FENCE} NEARBY ORIGINAL, CONTEXT ONLY ${EDITOR_FENCE}
${neighbouringSourceText ?? ''}
${EDITOR_FENCE} NEARBY EXISTING TRANSLATION, CONTEXT ONLY ${EDITOR_FENCE}
${neighbouringIncumbentText ?? ''}
${EDITOR_FENCE} ${NEARBY_RULE} ${EDITOR_FENCE}
`;

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

  /**
   * System prompt with the calibration addendum composed in as one more
   * machine-enforced rule, before the reply-shape block.
   */
  const systemPrompt = editorRuleAddendum === undefined
    ? EDITOR_SYSTEM_PROMPT
    : `${EDITOR_RULES_BLOCK}
- ${editorRuleAddendum}

${EDITOR_REPLY_BLOCK}`;

  return {
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: `${EDITOR_FENCE} ORIGINAL ${EDITOR_FENCE}
${sourceText}
${EDITOR_FENCE} TRANSLATION ${EDITOR_FENCE}
${targetText}
${nearbyBlock}${EDITOR_FENCE} EDIT REGIONS ${EDITOR_FENCE}
${blocks.join('\n\n',)}
${EDITOR_FENCE} END ${EDITOR_FENCE}`,
      },
    ],
    envelopes,
  };
}

//endregion Editor prompt

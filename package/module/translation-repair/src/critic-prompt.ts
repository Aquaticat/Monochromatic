import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import {
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
} from './issue-taxonomy.ts';

//region Critic prompt
// One strict prompt for every critic model: exact-quote evidence rules, the closed
// category vocabulary, JSON-only output. Document text is embedded between fence
// lines; the fence is decorative for the model, not a security boundary, and the
// deterministic quote resolver is what actually gates fabricated evidence.

/**
 * Fence line separating instructions from document text.
 */
const FENCE = '=====';

/**
 * System instructions shared by every critic call.
 */
const CRITIC_SYSTEM_PROMPT = `You are a strict bilingual translation reviewer.
Compare the ORIGINAL document with its TRANSLATION and report every defect you find in the translation.

Report each defect as one atomic issue:
- category: one of ${ISSUE_CATEGORIES.join(', ',)}
- severity: one of ${ISSUE_SEVERITIES.join(', ',)}
- summary: one sentence stating the single defect
- sourceQuote: exact substring copied character-for-character from the ORIGINAL that evidences the defect (omit if none applies)
- targetQuote: exact substring copied character-for-character from the TRANSLATION where the defect manifests (omit only if the defect has no target-side anchor)

Quote rules, strictly enforced by a machine:
- Quotes must be copied exactly, byte for byte. Paraphrases are discarded.
- Each quote must be long enough to occur exactly once in its document.
- A quote must stay inside one paragraph or block; never span a blank line.
- For omitted content: sourceQuote is the untranslated original text, targetQuote is the translated sentence adjacent to where the content should have appeared.

Translation policy, applied when deciding what counts as a defect:
- Judge emotional completeness and naturalness, not word-for-word correspondence. A rendering whose wording, sentence boundaries, or clause order differ from the ORIGINAL is correct when it reads naturally and carries the same feeling. Never report a defect merely because a rendering is not literal.
- Report lost feeling as a defect: when the TRANSLATION carries the facts but flattens the ORIGINAL's voice, warmth, humor, irony, grief, or intimacy, report style/emotional-flattening.
- Report stiff literal renderings no fluent writer would produce as style/awkward-phrasing, even when every word matches.
- When the ORIGINAL quotes a phrase in a language other than its own (an Esperanto, Japanese, or Latin line inside a Chinese page), the TRANSLATION must keep that phrase in its original wording AND give its meaning alongside, so the reader gets both. Report policy/foreign-phrase-gloss when the TRANSLATION drops the original wording, or reproduces it with no meaning alongside. This does not apply when the quoted phrase is already in the TRANSLATION's own language, where the wording alone suffices.

If the TRANSLATION is not a translation of the ORIGINAL at all (unrelated content, gibberish, a different document), report exactly one issue: category accuracy/non-translation, severity critical, targetQuote copied from the start of the TRANSLATION body. Do not enumerate further issues for such a pair.
If only one section is unrelated while the rest translates the original, report accuracy/non-translation for that section alone, anchored by its quotes, alongside any other issues.

Reply with ONLY a JSON object of shape {"issues": [...]}. No prose, no code fences.
An empty issues array is a valid answer when the translation is faithful.`;

/**
 * Builds the message list for one critic call.
 *
 * @param sourceText - original document, front matter included
 *
 * @param targetText - translation under review, front matter included
 *
 * @returns Messages ready for `chatJson`
 *
 * @example
 * ```ts
 * const messages = buildCriticMessages({ sourceText, targetText, },);
 * ```
 */
export function buildCriticMessages(
  {
    sourceText,
    targetText,
  }: {
    readonly sourceText: string;
    readonly targetText: string;
  },
): readonly ChatMessage[] {
  return [
    {
      role: 'system',
      content: CRITIC_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: `${FENCE} ORIGINAL ${FENCE}
${sourceText}
${FENCE} TRANSLATION ${FENCE}
${targetText}
${FENCE} END ${FENCE}`,
    },
  ];
}

//endregion Critic prompt

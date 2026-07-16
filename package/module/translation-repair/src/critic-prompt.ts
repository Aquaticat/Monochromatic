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

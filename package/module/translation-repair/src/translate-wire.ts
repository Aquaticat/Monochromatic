import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type { JsonSchemaResponseFormat, } from './chat-contract.ts';
import { HOUSE_POLICY_BLOCK, } from './house-policy.ts';
import { isJsonRecord, } from './json-guard.ts';
import { selectFence, } from './prompt-fence.ts';

//region Translate wire
// PROTOTYPE for the re-design proposal in `#70`. Nothing calls this yet.
//
// `doc/decision/translation-repair-output-goal.md` decides that the pipeline
// yields a good translation of the ORIGINAL even where the translation fed in
// does not make sense. The stages that exist cannot express that. Every one of
// them is defect-driven: critics find defects in the input translation, a panel
// adjudicates them, an editor fixes the accepted ones. A passage with no
// translation can only enter that loop as an omission filed against text that
// is not there, which is what produced omission after omission on a section
// running 76 source blocks against 5 target blocks, with the editor authoring
// English one issue at a time and no stage aware it was translating.
//
// This asks the question the loop cannot: render this passage. The existing
// translation is offered as EVIDENCE and as a starting point worth keeping
// where it is right, never as the thing being corrected, which is the same
// anchoring the introduced-defect probe was moved to on 2026-08-12 after the
// old wording made the pre-edit translation the standard of accuracy.

/**
 * Instructions every translator call shares.
 *
 * The prior translation is described as partial and possibly wrong on purpose.
 * Told to "improve" it, a model treats its wording as the baseline and edits
 * around it, which is how a passage that was never translated ends up
 * paraphrased rather than rendered. Told it may be absent, it translates.
 */
const TRANSLATE_RULES =
  `You are a bilingual Chinese-to-English translator working on a memorial archive.

Render the ORIGINAL passage into English.

An EXISTING TRANSLATION may be shown. It may be complete, partial, wrong, or absent altogether. Treat it as evidence about how this archive reads and as wording worth keeping WHERE IT IS RIGHT. It is never the standard: your output is judged against the ORIGINAL.

Rules:
- Translate everything the ORIGINAL says. Content the existing translation never covered is the point of this call, not an optional extra.
- Keep wording from the existing translation wherever it is already a good rendering. Reaching the same English by different words is not an improvement, and a reader who knows this archive should not see it churn.
- Preserve every Markdown structure the ORIGINAL uses: block quotes, list markers, headings, footnote markers, links, and the paragraph breaks between blocks.
- Names, handles and place names already used by the existing translation are authoritative. Keep them exactly, even where they match the original neither phonetically nor semantically.
- Accurate detail the existing translation ADDS, a citation's translator or publisher, a contributor credit, a gloss identifying someone the original assumes known, is kept. It is correct information a reader benefits from, and the ORIGINAL not carrying it is not a reason to drop it.
- Do not add content the ORIGINAL does not support and the existing translation does not already carry.

${HOUSE_POLICY_BLOCK}

Reply with ONLY a JSON object of shape {"translation": "..."}. No prose, no code fences, no commentary.`;

/**
 * Messages for one translation call.
 *
 * @example
 * ```ts
 * const messages = buildTranslateMessages({ sourceText, existingText, },);
 * ```
 */
export type TranslatePromptPlan = {
  /**
   * Messages ready for `chatJson`.
   */
  readonly messages: readonly ChatMessage[];
};

/**
 * Builds the translator sheet for one passage.
 *
 * @param sourceText - original passage to render
 *
 * @param existingText - translation as it stands, empty when there is none
 *
 * @param identityContext - declared names and handles, omitted when absent
 *
 * @returns Messages for the call
 *
 * @example
 * ```ts
 * const plan = buildTranslateMessages({ sourceText, existingText: '', },);
 * ```
 */
export function buildTranslateMessages(
  {
    sourceText,
    existingText,
    identityContext = '',
  }: {
    readonly sourceText: string;
    readonly existingText: string;
    readonly identityContext?: string;
  },
): TranslatePromptPlan {
  /**
   * Fence no enclosed text can reproduce, chosen against every string this
   * sheet carries, since all of them are arbitrary prose.
   */
  const fence = selectFence({
    texts: [
      sourceText,
      existingText,
      identityContext,
    ],
  },);

  return {
    messages: [
      {
        role: 'system',
        content: TRANSLATE_RULES,
      },
      {
        role: 'user',
        content: `${fence} ORIGINAL ${fence}
${sourceText}
${fence} EXISTING TRANSLATION ${fence}
${existingText === '' ? '(none: this passage has no translation yet)' : existingText}${
          identityContext === ''
            ? ''
            : `
${fence} DECLARED NAMES ${fence}
${identityContext}`
        }
${fence} END ${fence}`,
      },
    ],
  };
}

/**
 * One translator reply on the wire.
 *
 * @example
 * ```ts
 * const wire: TranslateReportWire = { translation: 'The cat naps.', };
 * ```
 */
export type TranslateReportWire = {
  /**
   * Rendered English for the whole passage.
   */
  readonly translation: string;
};

/**
 * Guards a translator reply.
 *
 * @param value - parsed model JSON
 *
 * @returns Whether value carries a translation string
 *
 * @example
 * ```ts
 * const ok = isTranslateReportWire(JSON.parse(text,),);
 * ```
 */
export function isTranslateReportWire(value: unknown,): value is TranslateReportWire {
  if (!isJsonRecord(value,))
    return false;

  return (typeof value.translation) === 'string';
}

/**
 * Structured-output constraint for translator calls.
 */
export const TRANSLATE_RESPONSE_FORMAT: JsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'translation_report',
    schema: {
      type: 'object',
      required: ['translation',],
      additionalProperties: false,
      properties: { translation: { type: 'string', }, },
    },
  },
};

//endregion Translate wire

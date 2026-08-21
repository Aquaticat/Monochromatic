import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import type { JsonSchemaResponseFormat, } from './chat-contract.ts';
import { HOUSE_POLICY_BLOCK, } from './house-policy.ts';
import { isJsonRecord, } from './json-guard.ts';
import { selectFence, } from './prompt-fence.ts';

//region Translate wire
// The translator sheet and the guard on what comes back, both of which
// `runTranslateStage` uses on every slice. Written as a prototype for the
// re-design proposal in `#70`, and in production since the lane was built.
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
- Preserve every Markdown structure the ORIGINAL uses: block quotes, list markers, headings, footnote markers, links, and the paragraph breaks between blocks. WHERE THE EXISTING TRANSLATION SHAPES THE PASSAGE DIFFERENTLY, splitting one block into two, merging two into one, or quoting a line the ORIGINAL runs as prose, KEEP THE EXISTING TRANSLATION'S SHAPE. It is the shape the archive's page already has, and a rendering that drops one of its blocks deletes that block from the page.
- Names, handles and place names already used by the existing translation are authoritative, and you keep them exactly even where they match the original neither phonetically nor semantically. WHERE DECLARED NAMES IS SHOWN AND SPELLS THE SAME PERSON OR PLACE DIFFERENTLY, THE DECLARED SPELLING WINS, because the archive's prose contradicts its own front matter on real pages and the front matter is what the archive declares. Where DECLARED NAMES gives more than one form, any declared form is right. Never invent a third spelling of your own.
- Accurate detail the existing translation ADDS, a citation's translator or publisher, a contributor credit, a gloss identifying someone the original assumes known, is kept. It is correct information a reader benefits from, and the ORIGINAL not carrying it is not a reason to drop it.
- Do not add content the ORIGINAL does not support and the existing translation does not already carry.

${HOUSE_POLICY_BLOCK}`;

/**
 * Reply-format instruction, kept LAST in the assembled sheet.
 *
 * Split out so a conditional rule can be inserted before it. Wire instructions
 * that end up above content rules are the ones models drop first.
 */
const TRANSLATE_REPLY_RULE =
  'Reply with ONLY a JSON object of shape {"translation": "..."}. No prose, no code fences, no commentary.';

/**
 * Instruction added when the enclosing chunk's ORIGINAL is line-structured.
 *
 * Written for a translator rather than an editor, which is why it is not
 * `LINE_STRUCTURE_RULE` from `line-structure-addendum.ts`. That one asks an
 * editor to leave existing lines where they are; here there may be no existing
 * lines at all, and the shape has to be built from the original instead.
 *
 * The failure it answers is `Toka_ls`, whose verse chunk runs 21 source blocks
 * at median 22 characters against 18 target blocks at median 101: the existing
 * translation already merged the lines. A translator shown that translation and
 * told nothing would keep reproducing the merge, since the only shape in front
 * of it is the merged one.
 *
 * SHARED WITH THE CONSOLIDATE WIRE, whose producer is a translator too. A
 * second wording of the same rule would drift from the one `Toka_ls` was
 * measured against.
 *
 * SAYS OUTRIGHT THAT IT OUTRANKS THE SHAPE RULE, because the two disagree on
 * exactly the case this exists for. `TRANSLATE_RULES` tells a producer to keep
 * the existing translation's shape where it merges blocks the ORIGINAL keeps
 * apart, and on `Toka_ls` that means keeping 18 blocks where the Chinese has
 * 21. Both rules arrive in one system prompt and neither used to defer, so a
 * producer met a contradiction and resolved it however it liked.
 *
 * THE GUARD DOES NOT DECIDE THIS. `validateTranslatedSlice` is a kind-sequence
 * floor: a candidate carrying MORE blocks than the page passes, and only a
 * candidate missing one fails. Measured, with the archived two-block finding as
 * a positive control. So precedence had to be stated in the sheet; nothing
 * downstream would have caught the wrong choice.
 */
export const TRANSLATE_LINE_STRUCTURE_RULE: string = 'The ORIGINAL is line-structured: each '
  + 'original line is a unit. THIS RULE OUTRANKS THE STANDING RULE ASKING YOU TO '
  + 'KEEP THE EXISTING TRANSLATION\'S SHAPE, which governs prose and not verse. '
  + 'Produce one output line per original line, in the '
  + 'same order. Never merge two original '
  + 'lines into one output line, never split one across two, and never invent or '
  + 'drop a line. Where the EXISTING TRANSLATION has merged lines, unmerge them.';

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
 * @param lineStructured - whether the enclosing CHUNK's original is
 * line-structured, decided by the caller because a slice is too small a unit to
 * decide it on; see `buildEditorAddendum`
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
    pictureContext = '',
    lineStructured = false,
  }: {
    readonly sourceText: string;
    readonly existingText: string;
    readonly identityContext?: string;
    readonly pictureContext?: string;
    readonly lineStructured?: boolean;
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
      pictureContext,
    ],
  },);

  /**
   * Translator sheet, with the line-structure fact inserted above the reply
   * instruction when the enclosing chunk's original is verse.
   */
  const system = [
    TRANSLATE_RULES,
    lineStructured ? TRANSLATE_LINE_STRUCTURE_RULE : '',
    TRANSLATE_REPLY_RULE,
  ]
    .filter(function isPresent(part,): boolean {
      return part !== '';
    },)
    .join('\n\n',);

  return {
    messages: [
      {
        role: 'system',
        content: system,
      },
      {
        role: 'user',
        content: `${fence} ORIGINAL ${fence}
${sourceText}${
          pictureContext === ''
            ? ''
            : `
${fence} WHAT THE PICTURES HERE SAY ${fence}
${pictureContext}`
        }
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
 * A REPLY THAT SAYS NOTHING IS NOT A REPLY. The structured-output schema is
 * satisfied by `{"translation": ""}`, which used to arrive as a heard voice
 * proposing to render the passage as nothing and was then dropped further down
 * while the model that sent it was recorded as answered. Refusing it here makes
 * it a lost voice instead, so the roster re-asks that model in the next round
 * and the loss is reported as one; a slice with no translation in the archive
 * has nothing else to fall back on, which is where the difference is felt.
 *
 * Every source slice says something, so no legitimate reply is blank: an empty
 * run cannot become a slice at all.
 *
 * @param value - parsed model JSON
 *
 * @returns Whether value carries a translation that says something
 *
 * @example
 * ```ts
 * const ok = isTranslateReportWire(JSON.parse(text,),);
 * ```
 */
export function isTranslateReportWire(value: unknown,): value is TranslateReportWire {
  if (!isJsonRecord(value,))
    return false;
  if ((typeof value.translation) !== 'string')
    return false;

  return value.translation
    .trim()
    !== '';
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

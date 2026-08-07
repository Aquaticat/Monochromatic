import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import { HOUSE_POLICY_BLOCK, } from './house-policy.ts';
import { selectFence, } from './prompt-fence.ts';
import type { EditableEnvelope, } from './patch-model.ts';

//region Refinement prompt
// The sheet one rewriter sees for one slice.
//
// This prompt carries more weight than the editor's. The editor works from
// issues a panel already accepted, and checkers afterwards prove each one gone.
// Refinement has no accepted issue behind it and, on a slice with no accepted
// issues at all, nothing downstream re-examines the meaning either. The
// instruction to leave a paragraph alone is therefore the main thing standing
// between an unnecessary rewrite and shipped text, and it is written to be
// easier to obey than to ignore.

// Fences are chosen against the content they enclose rather than fixed, the
// same way `candidate-select-wire.ts` and the introduced-defect probe choose
// theirs. A fixed fence is forgeable: enclosed text carrying a line of the
// fence character closes its own block early, so the rest of that paragraph
// reads to the model as instructions rather than as content. The old fixed
// value was `=====`, which is ordinary Markdown (a setext heading underline),
// so this is a shape real documents contain rather than an invented one.

/**
 * Messages plus the paragraph numbering they were built from.
 *
 * @example
 * ```ts
 * const plan: RefinePromptPlan = { messages, envelopes, };
 * ```
 */
export type RefinePromptPlan = {
  /**
   * Conversation to send.
   */
  readonly messages: readonly ChatMessage[];

  /**
   * Paragraphs in the order the sheet numbers them, so a reply's numbers
   * resolve against exactly what was shown.
   */
  readonly envelopes: readonly EditableEnvelope[];
};

/**
 * Builds the rewriter sheet for one slice.
 *
 * @param sourceText - original chunk text, the faithfulness anchor
 *
 * @param envelopes - eligible paragraphs in document order
 *
 * @param identityContext - declared names and handles from front matter, when
 * the document declares any
 *
 * @returns Messages plus the numbering they used
 *
 * @example
 * ```ts
 * const plan = buildRefineMessages({ sourceText, envelopes, },);
 * ```
 */
export function buildRefineMessages(
  {
    sourceText,
    envelopes,
    identityContext,
  }: {
    readonly sourceText: string;
    readonly envelopes: readonly EditableEnvelope[];
    readonly identityContext?: string;
  },
): RefinePromptPlan {
  /**
   * Fence longer than any run inside anything this prompt encloses, so no
   * enclosed text can close a block it sits in.
   */
  const fence = selectFence({
    texts: [
      sourceText,
      ...envelopes.map(function toBaseText(envelope,) {
        return envelope.baseText;
      },),
      ...(identityContext === undefined ? [] : [identityContext,]),
    ],
  },);

  /**
   * Numbered paragraph blocks in document order.
   */
  const blocks = envelopes
    .map(function toBlock(
      envelope,
      index,
    ) {
      return `PARAGRAPH ${String(index + 1,)}\n${fence}\n${envelope.baseText}\n${fence}`;
    },)
    .join('\n\n',);

  /**
   * Identity block, omitted entirely when the document declares nothing.
   */
  const identityBlock = identityContext === undefined
    ? ''
    : `\n\nDECLARED NAMES AND HANDLES, which must survive exactly:\n${identityContext}`;

  return {
    envelopes,
    messages: [
      {
        role: 'system',
        content: `You improve how an English translation READS. You never change what it says.

${HOUSE_POLICY_BLOCK}

The translation below is already correct as far as anyone has determined. Nobody has claimed any of it is wrong. Your only question per paragraph is whether an English reader would find it awkward, and whether you can fix that without touching meaning.

Rewrite a paragraph ONLY when the improvement is clear and obvious. If a paragraph reads acceptably, leave it out of your reply entirely. Returning an empty list is a correct and common answer, and is much better than proposing a change you would not defend.

These must survive a rewrite unchanged: every number, date, name, handle, link, footnote marker, and any word left in the original language. Do not add information, drop information, soften a statement, sharpen a statement, or change who did what to whom.

Reply with ONLY a JSON object of shape {"rewrites": [{"paragraph": 1, "newText": "..."}]}. Include only the paragraphs you are changing. No prose, no code fences.`,
      },
      {
        role: 'user',
        content:
          `ORIGINAL (Chinese), for checking that meaning survives\n${fence}\n${sourceText}\n${fence}${identityBlock}\n\n${blocks}`,
      },
    ],
  };
}

//endregion Refinement prompt

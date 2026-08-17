import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import { selectFence, } from './prompt-fence.ts';
import {
  CANDIDATE_ONLY_CATEGORIES,
  RENDERING_AUDIT_VERDICTS,
  type RenderingAuditSubject,
  SOURCE_ONLY_CATEGORIES,
} from './rendering-audit-wire.ts';

//region Rendering audit prompt
// What one auditor is asked, and in what words.
//
// SPLIT FROM THE WIRE because the taxonomy lives here. The wire says what
// shape an answer has; this says what the words in it MEAN, and the second is
// what decides whether two voices describing one defect describe it the same
// way.
//
// EVERY CATEGORY IS DEFINED AND ORDERED. Listing category names without
// definitions guarantees label fragmentation: a dropped negation is nameable as
// an omission (the negator is gone) or as a reversed polarity (the sentence now
// asserts the opposite), and two voices splitting between those two names would
// be reported as two single-voice claims rather than one corroborated defect.
// The precedence rule decides it: a proposition the candidate still states is
// never an omission.
//
// A FINDING IS ATOMIC. One defect, one finding, one focus span. Without that,
// a sentence carrying two changed numbers can arrive as one finding quoting the
// whole sentence, and no matcher downstream can separate what was merged before
// it arrived.

/**
 * What each category means, and which one wins when two of them fit.
 *
 * ORDER IS THE PRECEDENCE, stated first so a reader meets the deciding rule
 * before the list it decides between.
 */
const CATEGORY_GUIDE: readonly string[] = [
  'CHOOSING A CATEGORY, in this order:',
  '',
  '  1. Does the candidate state a corresponding proposition at all? If it does NOT, and the original',
  '     does, that is omission. If the CANDIDATE states one the original and the identity evidence do',
  '     not support, that is unsupported-addition.',
  '  2. If both state one and they disagree, name WHAT changed, using the altered category below.',
  '     A proposition the candidate still states is never an omission.',
  '',
  'omission: the original asserts something and the candidate asserts no counterpart to it.',
  'unsupported-addition: the candidate asserts something neither the original nor the identity',
  '  evidence supports.',
  'altered-polarity: the candidate asserts the corresponding proposition with the polarity reversed,',
  '  INCLUDING a positive rendering produced by dropping a negator.',
  'altered-actor: who does it, or who it is done to, changed.',
  'altered-referent: which thing or person is being referred to changed.',
  'altered-modality: how certain, permitted or obliged it is changed (must, may, might, should).',
  'altered-time: when it happens changed: tense, date, duration, or order of events.',
  'altered-number: how many, or a singular against a plural where the count carries meaning.',
  'altered-relation: how two things relate changed: cause, condition, contrast, possession, or',
  '  which part attaches to which.',
  'altered-identity: a name, handle or title is rendered as a different person or thing. Following',
  '  the identity evidence is never this defect; contradicting it is.',
  'broken-structure: meaning-bearing structure changed while both sides still state it: scope,',
  '  attribution of a quote or claim, ordering where order carries meaning, or which item lines up',
  '  with which. Structure the candidate simply lacks is omission, and structure it invents is',
  '  unsupported-addition, by rule 1 above.',
];

/**
 * What is not a defect, said plainly, because each of these is a mistake an
 * auditor makes by trying hard rather than by being careless.
 */
const NOT_DEFECTS: readonly string[] = [
  'NOT DEFECTS:',
  '',
  '  Different wording than you would have chosen.',
  '  Idiom, implication or context carrying a meaning that no single word states.',
  '  Restructuring that preserves what is asserted.',
  '  Brevity on its own. A shorter rendering is not evidence that something was dropped; find the',
  '  dropped proposition or do not file the finding.',
  '  Any difference from another translation. No other translation is shown to you, and divergence',
  '  from one is not a defect.',
];

/**
 * How a finding points at the text it rests on.
 */
const EVIDENCE_GUIDE: readonly string[] = [
  'EVERY FINDING POINTS AT TEXT WITH TWO QUOTES PER SIDE, copied character for character:',
  '',
  '  locator: enough text to identify WHICH occurrence you mean. It must occur exactly once in that',
  '    side. A locator occurring twice is discarded, and so is the finding on it.',
  '  focus: the SMALLEST span carrying the change itself. It may be a single word, and it may repeat',
  '    elsewhere in the passage, but it must occur exactly once inside your own locator.',
  '',
  `  ${SOURCE_ONLY_CATEGORIES.join(', ',)}: quote the ORIGINAL side only, and leave BOTH candidate`,
  '    quotes empty, because content that was never rendered has nothing in the candidate to quote.',
  `  ${CANDIDATE_ONLY_CATEGORIES.join(', ',)}: quote the CANDIDATE side only, and leave BOTH original`,
  '    quotes empty.',
  '  every other category: quote BOTH sides, since the two spans are what disagree.',
  '',
  '  A quote on a side your category does not use is a contradiction, and the finding is discarded.',
  '',
  'ONE FINDING PER DEFECT. If one sentence carries two changed numbers, file two findings with',
  'different focus spans. Do not file one finding covering both.',
];

/**
 * What the reason has to establish, since an unstructured reason cannot be
 * checked against anything.
 */
const REASON_GUIDE: readonly string[] = [
  'Each reason states three things:',
  '',
  '  1. What the ORIGINAL asserts here.',
  '  2. What the CANDIDATE asserts here, or that it asserts nothing corresponding.',
  '  3. Why that difference is semantic rather than paraphrase or restructuring.',
];

/**
 * System message every audit call carries.
 *
 * @returns Instructions, taxonomy and evidence rules
 *
 * @example
 * ```ts
 * const instructions = auditInstructions();
 * ```
 */
function auditInstructions(): string {
  return [
    'You audit one translated passage against its original.',
    '',
    'THE QUESTION IS ABSOLUTE, not comparative. Against the ORIGINAL, and against any identity',
    'evidence given below, does the CANDIDATE fail to render or misrepresent anything?',
    '',
    ...CATEGORY_GUIDE,
    '',
    ...NOT_DEFECTS,
    '',
    ...EVIDENCE_GUIDE,
    '',
    ...REASON_GUIDE,
    '',
    `verdict is one of: ${RENDERING_AUDIT_VERDICTS.join(', ',)}.`,
    'Cast uncertain ONLY when the passage could not be audited at all: it is truncated mid-sentence,',
    'unreadable, or the two texts are not the same passage. Uncertainty about one finding is handled',
    'by not filing that finding, not by the verdict.',
    '',
    'Answer with JSON only.',
  ].join('\n',);
}

/**
 * Builds the messages for one audit call.
 *
 * @param subject - original, candidate and any licensed identity evidence
 *
 * @returns System and user messages
 *
 * @example
 * ```ts
 * const messages = buildRenderingAuditMessages({ subject, },);
 * ```
 */
export function buildRenderingAuditMessages(
  { subject, }: { readonly subject: RenderingAuditSubject; },
): readonly ChatMessage[] {
  /**
   * Fence long enough to hold every text without any of them closing it.
   */
  const fence = selectFence({
    texts: [
      subject.sourceText,
      subject.candidateText,
      subject.identityContext ?? '',
    ],
  },);

  return [
    {
      role: 'system',
      content: auditInstructions(),
    },
    {
      role: 'user',
      content: [
        'ORIGINAL:',
        fence,
        subject.sourceText,
        fence,
        '',
        'CANDIDATE:',
        fence,
        subject.candidateText,
        fence,
        ...((subject.identityContext === undefined)
          ? []
          : [
            '',
            'IDENTITY EVIDENCE, licensed for this document, not a defect when the candidate follows it:',
            fence,
            subject.identityContext,
            fence,
          ]),
      ].join('\n',),
    },
  ];
}

//endregion Rendering audit prompt

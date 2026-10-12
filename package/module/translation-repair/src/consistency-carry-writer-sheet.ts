import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import { citedReferenceBlockText, } from './cited-reference-rule.ts';
import {
  type ConsistencyOccurrenceView,
  type ConsistencyRepeat,
  markedParagraph,
  repeatBlockOf,
  repeatedTextOf,
  selectMarks,
} from './consistency-sheet.ts';
import {
  DECLARED_IDENTITY_RULES,
  declaredNamesBlock,
} from './declared-identity-rule.ts';
import { HOUSE_POLICY_BLOCK, } from './house-policy.ts';
import { NAME_FORM_SCOPE_RULE, } from './name-form-policy.ts';
import { PAGE_APPARATUS_IS_KEPT, } from './page-apparatus-clause.ts';
import { selectFence, } from './prompt-fence.ts';
import {
  tenseCandidateGroups,
  tenseCandidateLines,
} from './tense-candidate-block.ts';
import { TRANSLATE_LINE_STRUCTURE_RULE, } from './translate-wire.ts';

//region Consistency carry writer sheet
// THE SHEET A WRITER READS TO CARRY THE CHOSEN RENDERING TO ONE PLACE. The
// writers are the translate stage's writer bench, asked for the same reply the
// translate stage asks (`{"translation": "..."}`), but the passage they rewrite
// is one paragraph of a settled page, and what they change in it is bounded:
// only the words that render the repeated wording, and only as far as this
// place's own ORIGINAL allows. A model writes the paragraph; the floors and the
// bench's choice decide whether any of it reaches the page.

/**
 The reply-format instruction, kept last in the assembled sheet.
 */
const WRITER_REPLY_RULE =
  'Reply with ONLY a JSON object of shape {"translation": "..."}, where the translation is the whole rewritten paragraph and nothing else. No prose, no code fences, no commentary.';

/**
 What the sheet needs of one place.
 */
type WriterPlace = {
  /**
   The place as the consistency sheet shows it: its paragraph and where the
   repeated wording stands in it.
   */
  readonly view: ConsistencyOccurrenceView;

  /**
   The words of the place's English that render the repeated wording.
   */
  readonly span: string;

  /**
   The English paragraph that holds those words.
   */
  readonly paragraph: string;
};

/**
 Everything a writer's sheet shows.

 @example
 ```ts
 const subject: CarryWriterSubject = { repeat, chosen, receiving, lineStructured: false, };
 ```
 */
export type CarryWriterSubject = {
  /**
   The repeated wording or frame.
   */
  readonly repeat: ConsistencyRepeat;

  /**
   The place every place should follow.
   */
  readonly chosen: WriterPlace;

  /**
   The place the writer rewrites the paragraph of.
   */
  readonly receiving: WriterPlace;

  /**
   The original block before the receiving place's block, where it has one in
   its slice.
   */
  readonly before?: string;

  /**
   The original block after the receiving place's block, where it has one in
   its slice.
   */
  readonly after?: string;

  /**
   Whether the line-structure rule governs the receiving place's slice.
   */
  readonly lineStructured: boolean;

  /**
   Declared identity lines of the page, when it declares any.
   */
  readonly identityContext?: string;

  /**
   Lines of the pages the original cites, when it cites any.
   */
  readonly referenceContext?: string;

  /**
   Whether the original's entry records a death, which adds the tense candidates.
   */
  readonly lifeEnded?: boolean;

  /**
   Names the translation declares for its subject; present only with a recorded death.
   */
  readonly subjectNames?: readonly string[];
};

/**
 The rules of the writer's sheet.

 @param lineStructured - whether the line-structure rule governs the slice

 @param marks - marks the paragraphs carry

 @returns Rule text, ending in the house rules and the reply format

 @example
 ```ts
 const rules = writerRules({ lineStructured: false, marks, },);
 ```
 */
function writerRules(
  {
    lineStructured,
    marks,
  }: {
    readonly lineStructured: boolean;
    readonly marks: {
      readonly open: string;
      readonly close: string;
    };
  },
): string {
  return [
    `You are a bilingual Chinese-to-English translator working on a memorial archive.

One Chinese wording is repeated in several places of one page. The English of the page was settled one passage at a time, so the places render it differently, and a reader who meets all of them reads the difference as a mistake. A panel of judges has chosen which place's rendering the whole page should follow: the CHOSEN RENDERING. Your task is to make the place you are shown follow it.

Rewrite the CURRENT ENGLISH PARAGRAPH of this place and return the whole paragraph. The words that now render the repeated wording here (THE WORDS TO REPLACE) must come out rendered as the CHOSEN RENDERING renders it, so that the same Chinese wording reads as the same English in both places. In each ORIGINAL the repeated wording is enclosed between ${marks.open} and ${marks.close}; the marks are not part of the text.

Rules:
- Change only the words that render the repeated wording. Every other word of the CURRENT ENGLISH PARAGRAPH stays exactly as it is: its names, its tense, its punctuation, its line breaks and its Markdown, apart from what the next rules allow.
- Adapt only what THIS place's own ORIGINAL requires. The CHOSEN RENDERING may carry a word that renders Chinese standing outside the repeated wording in the chosen place, such as an "also" that renders a word standing before the repeated wording there. Never carry such a word here: a word renders ORIGINAL in this place only where this place's ORIGINAL has the Chinese it renders, so the repeated wording is rendered as the chosen place renders it without that word, and a word of this paragraph that renders ORIGINAL outside the repeated wording stays as this paragraph has it.
- In a frame with a slot, the slot content is this place's own: the SLOT IN THE ORIGINAL of this place is rendered with this place's own words, placed where the chosen place's frame places its slot, in grammatical English, and the frame words around it follow the CHOSEN RENDERING.
- The surrounding ORIGINAL blocks are context for this place, not part of the paragraph: render nothing of them.
- ONE TENSE, IN THIS ORDER: where TENSE CANDIDATES are shown, the entry records a death, and the life of a person who has died is told in the past tense by the house rule; a line of it told in the present is moved to the past. Then the tense the page holds for what is still true as it is read. Never let one sentence start in one tense and finish in another.
- Do not add content the ORIGINAL does not support and do not drop content it states.
- Names, handles and place names already used by this paragraph and by DECLARED NAMES are authoritative; keep them exactly. ${NAME_FORM_SCOPE_RULE}
- ${PAGE_APPARATUS_IS_KEPT}
- Keep the paragraph's Markdown: a block quote stays a block quote, a list marker stays, a footnote marker stays where it stands, and a link keeps its destination.`,
    lineStructured ? TRANSLATE_LINE_STRUCTURE_RULE : '',
    HOUSE_POLICY_BLOCK,
    WRITER_REPLY_RULE,
  ]
    .filter(function isPresent(part,): boolean {
      return part !== '';
    },)
    .join('\n\n',);
}

/**
 The fenced blocks that show one place to a writer.

 @param place - the place

 @param name - what the blocks call the place, such as `THIS PLACE`

 @param fence - fence no shown text contains

 @param marks - marks the paragraph carries

 @returns The blocks of its ORIGINAL, its slot where it has one, and its words

 @example
 ```ts
 const blocks = placeBlocksOf({ place, name: 'THIS PLACE', fence, marks, },);
 ```
 */
function placeBlocksOf(
  {
    place,
    name,
    fence,
    marks,
  }: {
    readonly place: WriterPlace;
    readonly name: string;
    readonly fence: string;
    readonly marks: {
      readonly open: string;
      readonly close: string;
    };
  },
): string {
  /**
   The place's slot, for a frame.
   */
  const slot = (place.view
    .slotSource
    === undefined)
    ? ''
    : `${fence} ${name}: SLOT IN THE ORIGINAL ${fence}\n${place.view
      .slotSource}\n`;
  return `${fence} ${name}: ORIGINAL ${fence}\n${markedParagraph({
    view: place.view,
    marks,
  },)}\n${slot}`;
}

/**
 Builds the exchange asking one writer to carry the chosen rendering to one place.

 @param subject - the repeated wording, the chosen place and the receiving place

 @returns Messages for one exchange

 @example
 ```ts
 const messages = buildCarryWriterMessages({ subject, },);
 ```
 */
export function buildCarryWriterMessages(
  { subject, }: { readonly subject: CarryWriterSubject; },
): readonly ChatMessage[] {
  /**
   The tense candidates of the two English paragraphs, shown only where the
   entry records a death, in the lines every judging sheet prints them in.
   */
  const tenseLines = tenseCandidateLines({
    groups: tenseCandidateGroups({
      lifeEnded: subject.lifeEnded === true,
      ...((subject.subjectNames === undefined) ? {} : { subjectNames: subject.subjectNames, }),
      texts: [
        {
          label: 'CURRENT ENGLISH PARAGRAPH',
          text: subject.receiving
            .paragraph,
        },
        {
          label: 'CHOSEN PLACE: ENGLISH PARAGRAPH',
          text: subject.chosen
            .paragraph,
        },
      ],
    },),
  },);
  /**
   Every text the sheet shows.
   */
  const texts = [
    repeatedTextOf({ repeat: subject.repeat, },),
    ...tenseLines,
    subject.identityContext ?? '',
    subject.referenceContext ?? '',
    subject.before ?? '',
    subject.after ?? '',
    ...[
      subject.chosen,
      subject.receiving,
    ].flatMap(function textsOf(place,): readonly string[] {
      return [
        place.view
          .paragraph,
        place.view
          .slotSource
          ?? '',
        place.span,
        place.paragraph,
      ];
    },),
  ];
  /**
   Fence absent from every enclosed value.
   */
  const fence = selectFence({ texts, },);
  /**
   Marks absent from every shown text.
   */
  const marks = selectMarks({ texts, },);
  /**
   Declared identity ahead of the places, none when the page has none.
   */
  const identityBlock = declaredNamesBlock({
    fence,
    ...((subject.identityContext === undefined) ? {} : { identityContext: subject.identityContext, }),
  },);
  /**
   Cited pages and their rule, nothing when the original cites none.
   */
  const referenceBlock = citedReferenceBlockText({
    fence,
    ...((subject.referenceContext === undefined) ? {} : { referenceContext: subject.referenceContext, }),
  },);
  /**
   The blocks around the receiving place's paragraph in its slice.
   */
  const around = [
    (subject.before === undefined) ? '' : `${fence} ORIGINAL BEFORE THIS PLACE ${fence}\n${subject.before}\n`,
    (subject.after === undefined) ? '' : `${fence} ORIGINAL AFTER THIS PLACE ${fence}\n${subject.after}\n`,
  ].join('',);
  /**
   The tense block, fenced like the other blocks, or nothing when no paragraph has a candidate.
   */
  const tenseBlock = (tenseLines.length === 0)
    ? ''
    : `${fence} TENSE CANDIDATES ${fence}\n${tenseLines.join('\n',)}\n${fence}\n`;
  return [
    {
      role: 'system',
      content: `${writerRules({
        lineStructured: subject.lineStructured,
        marks,
      },)}${(identityBlock === '') ? '' : `\n\n${DECLARED_IDENTITY_RULES}`}`,
    },
    {
      role: 'user',
      content: `${identityBlock}${referenceBlock}${
        repeatBlockOf({
          repeat: subject.repeat,
          fence,
        },)
      }${
        placeBlocksOf({
          place: subject.receiving,
          name: 'THIS PLACE',
          fence,
          marks,
        },)
      }${around}${
        placeBlocksOf({
          place: subject.chosen,
          name: 'CHOSEN PLACE',
          fence,
          marks,
        },)
      }${fence} CHOSEN RENDERING ${fence}\n${subject.chosen
        .span}\n${fence} CHOSEN PLACE: ENGLISH PARAGRAPH ${fence}\n${
        subject.chosen
          .paragraph
      }\n${fence} THE WORDS TO REPLACE ${fence}\n${subject.receiving
        .span}\n${fence} CURRENT ENGLISH PARAGRAPH ${fence}\n${
        subject.receiving
          .paragraph
      }\n${tenseBlock}${fence} END ${fence}`,
    },
  ];
}

//endregion Consistency carry writer sheet

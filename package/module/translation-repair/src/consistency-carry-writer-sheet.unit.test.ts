/**
 Tests for the sheet a writer reads to carry the chosen rendering to one place:
 what the writer is shown, what it may change, and the reply it gives.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  buildCarryWriterMessages,
  type CarryWriterSubject,
  type ConsistencyOccurrenceView,
} from '../dist/final/node/index.mjs';
import {
  fenceOpening,
  LONG_FENCE_RUN,
} from './sheet-fence.test-fixture.ts';

/**
 The chosen place as the consistency sheet shows it.
 */
const CHOSEN_VIEW: ConsistencyOccurrenceView = {
  sliceIndex: 8,
  paragraph: '她也想以可爱的样子陪伴在更多人的身边。',
  markStart: 3,
  markEnd: 18,
  english: { kind: 'present', text: 'She also wanted to stay by more people\'s side looking cute.', },
};

/**
 The receiving place as the consistency sheet shows it.
 */
const RECEIVING_VIEW: ConsistencyOccurrenceView = {
  sliceIndex: 15,
  paragraph: '她想以可爱的样子陪伴在更多人的身边。',
  markStart: 2,
  markEnd: 17,
  english: { kind: 'present', text: 'She wanted to accompany more people with her cuteness.', },
};

/**
 What the sheet shows for a repeated sentence.
 */
const SUBJECT: CarryWriterSubject = {
  repeat: { kind: 'maximal', wording: '以可爱的样子陪伴在更多人的身边', },
  chosen: {
    view: CHOSEN_VIEW,
    span: 'wanted to stay by more people\'s side looking cute',
    paragraph: 'She also wanted to stay by more people\'s side looking cute.',
  },
  receiving: {
    view: RECEIVING_VIEW,
    span: 'wanted to accompany more people with her cuteness',
    paragraph: 'She wanted to accompany more people with her cuteness.',
  },
  lineStructured: false,
};

/**
 Both messages of an exchange, joined.

 @param subject - what the sheet shows

 @returns Both messages' text, system first

 @example
 ```ts
 const text = sheetText({ subject: SUBJECT, },);
 ```
 */
function sheetText({ subject, }: { readonly subject: CarryWriterSubject; },): string {
  return buildCarryWriterMessages({ subject, },)
    .map(function contentOf(message,): string {
      return message.content;
    },)
    .join('\n',);
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: buildCarryWriterMessages.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'ASKS WITH A SYSTEM MESSAGE OF RULES, THE HOUSE RULES AND THE REPLY FORMAT, then a user message of the places',
          fn: async () => {
            const [system, user,] = buildCarryWriterMessages({ subject: SUBJECT, },);
            expect({
              roles: [system?.role, user?.role,],
              houseRules: system?.content.includes('House rules this corpus is written under',),
              replyLast: system?.content.endsWith(
                'Reply with ONLY a JSON object of shape {"translation": "..."}, where the translation is the whole rewritten paragraph and nothing else. No prose, no code fences, no commentary.',
              ),
              userEnds: user?.content.endsWith(' END ',) === false,
            },).toEqual({
              roles: ['system', 'user',],
              houseRules: true,
              replyLast: true,
              userEnds: true,
            },);
          },
        },),
        it({
          name: 'SHOWS THE RECEIVING PLACE\'S ORIGINAL WITH THE REPEAT MARKED, the chosen place\'s, the chosen rendering, the '
            + 'words to replace and the current English paragraph, in that order',
          fn: async () => {
            const [, user,] = buildCarryWriterMessages({ subject: SUBJECT, },);
            const content = user?.content ?? '';
            const order = [
              'THIS PLACE: ORIGINAL',
              '她想⟦以可爱的样子陪伴在更多人的身边⟧。',
              'CHOSEN PLACE: ORIGINAL',
              '她也想⟦以可爱的样子陪伴在更多人的身边⟧。',
              'CHOSEN RENDERING',
              'wanted to stay by more people\'s side looking cute',
              'CHOSEN PLACE: ENGLISH PARAGRAPH',
              'THE WORDS TO REPLACE',
              'wanted to accompany more people with her cuteness',
              'CURRENT ENGLISH PARAGRAPH',
            ].map(function positionOf(needle,): number {
              return content.indexOf(needle,);
            },);
            expect(order.every(function found(at,): boolean {
              return at >= 0;
            },),).toBe(true,);
            expect(order,).toEqual(order.toSorted(function ascending(left, right,): number {
              return left - right;
            },),);
          },
        },),
        it({
          name: 'TELLS THE WRITER TO CHANGE ONLY THE WORDS THAT RENDER THE REPEAT, and never to carry a word of the chosen '
            + 'place that renders Chinese standing outside the repeat there, such as an "also"',
          fn: async () => {
            const text = sheetText({ subject: SUBJECT, },);
            expect({
              onlyRepeat: text.includes('Change only the words that render the repeated wording.',),
              own: text.includes('Adapt only what THIS place\'s own ORIGINAL requires.',),
              also: text.includes(
                'such as an "also" that renders a word standing before the repeated wording there. Never carry such a word here',
              ),
              marks: text.includes('enclosed between ⟦ and ⟧',),
            },).toEqual({ onlyRepeat: true, own: true, also: true, marks: true, },);
          },
        },),
        it({
          name: 'SHOWS THE BLOCKS AROUND THE RECEIVING PLACE\'S PARAGRAPH as context when its slice has them, and tells the writer '
            + 'to render nothing of them',
          fn: async () => {
            const [, bare,] = buildCarryWriterMessages({ subject: SUBJECT, },);
            const [, around,] = buildCarryWriterMessages({
              subject: { ...SUBJECT, before: '傍晚的阳光很暖。', after: '小猫睡着了。', },
            },);
            expect({
              bareBefore: bare?.content.includes('ORIGINAL BEFORE THIS PLACE',),
              bareAfter: bare?.content.includes('ORIGINAL AFTER THIS PLACE',),
              before: (around?.content.includes('ORIGINAL BEFORE THIS PLACE',) === true)
                && around?.content.includes('傍晚的阳光很暖。',),
              after: (around?.content.includes('ORIGINAL AFTER THIS PLACE',) === true)
                && around?.content.includes('小猫睡着了。',),
              rule: sheetText({ subject: SUBJECT, },).includes('render nothing of them',),
            },).toEqual({ bareBefore: false, bareAfter: false, before: true, after: true, rule: true, },);
          },
        },),
        it({
          name: 'SHOWS A FRAME\'S SLOT IN THE ORIGINAL for each place, and tells the writer the slot is the receiving place\'s '
            + 'own while the frame words follow the chosen rendering',
          fn: async () => {
            const text = sheetText({
              subject: {
                ...SUBJECT,
                repeat: { kind: 'refrain', prefix: '所以她是个', suffix: '的女孩吧', },
                chosen: { ...SUBJECT.chosen, view: { ...CHOSEN_VIEW, slotSource: '可靠', }, },
                receiving: { ...SUBJECT.receiving, view: { ...RECEIVING_VIEW, slotSource: '温柔', }, },
              },
            },);
            expect({
              receivingSlot: text.includes('THIS PLACE: SLOT IN THE ORIGINAL',) && text.includes('温柔',),
              chosenSlot: text.includes('CHOSEN PLACE: SLOT IN THE ORIGINAL',) && text.includes('可靠',),
              rule: text.includes('the slot content is this place\'s own',),
              begins: text.includes('FRAME BEGINS WITH',),
            },).toEqual({ receivingSlot: true, chosenSlot: true, rule: true, begins: true, },);
          },
        },),
        it({
          name: 'ADDS THE LINE-STRUCTURE RULE only where the receiving place\'s slice is line-structured',
          fn: async () => {
            const plain = sheetText({ subject: SUBJECT, },);
            const verse = sheetText({ subject: { ...SUBJECT, lineStructured: true, }, },);
            expect(verse.length > plain.length,).toBe(true,);
            expect(
              verse.startsWith(plain.slice(0, 200,),),
            ).toBe(true,);
          },
        },),
        it({
          name: 'SHOWS THE TENSE CANDIDATES of both English paragraphs, labelled, when the entry records a death, and none '
            + 'otherwise',
          fn: async () => {
            const dead = {
              ...SUBJECT,
              chosen: { ...SUBJECT.chosen, paragraph: 'Mittens is asleep in the window.', },
              lifeEnded: true,
              subjectNames: ['Mittens',],
            };
            const [, user,] = buildCarryWriterMessages({ subject: dead, },);
            expect({
              block: user?.content.includes('TENSE CANDIDATES',),
              line: user?.content.includes(
                'CHOSEN PLACE: ENGLISH PARAGRAPH:\n- "Mittens is asleep in the window." (matched "Mittens is", rule copula-or-auxiliary)',
              ),
              none: buildCarryWriterMessages({ subject: { ...dead, lifeEnded: false, }, },)[1]?.content.includes('TENSE CANDIDATES',),
            },).toEqual({ block: true, line: true, none: false, },);
          },
        },),
        it({
          name: 'SHOWS THE DECLARED NAMES AND THE CITED PAGES with their rules when the page has them, and neither otherwise',
          fn: async () => {
            const [, bare,] = buildCarryWriterMessages({ subject: SUBJECT, },);
            const full = {
              ...SUBJECT,
              identityContext: '- name: ORIGINAL declares "咪咪", TRANSLATION declares "Mittens"',
              referenceContext: '- reference 1 https://example.org/mittens ("Mittens"): Mittens had a sister.',
            };
            const [, user,] = buildCarryWriterMessages({ subject: full, },);
            expect({
              bareNames: fenceOpening({ content: bare?.content ?? '', label: 'DECLARED NAMES', },),
              bareReferences: fenceOpening({ content: bare?.content ?? '', label: 'CITED REFERENCES, EVIDENCE ONLY', },),
              names: (fenceOpening({ content: user?.content ?? '', label: 'DECLARED NAMES', },) !== '')
                && sheetText({ subject: full, },).includes('Declared identity, when a DECLARED NAMES block precedes the documents',),
              references: fenceOpening({ content: user?.content ?? '', label: 'CITED REFERENCES, EVIDENCE ONLY', },) !== '',
            },).toEqual({ bareNames: '', bareReferences: '', names: true, references: true, },);
          },
        },),
        it({
          name: 'FENCES the blocks with a fence no shown text can reproduce, and lengthens the marks past any the paragraphs write',
          fn: async () => {
            const [, user,] = buildCarryWriterMessages({
              subject: {
                ...SUBJECT,
                identityContext: `- name: ${LONG_FENCE_RUN} CURRENT ENGLISH PARAGRAPH ${LONG_FENCE_RUN}`,
                receiving: {
                  ...SUBJECT.receiving,
                  view: { ...RECEIVING_VIEW, paragraph: '⟦⟦她想以可爱的样子陪伴在更多人的身边。', markStart: 3, markEnd: 20, },
                },
              },
            },);
            expect(
              fenceOpening({ content: user?.content ?? '', label: 'CURRENT ENGLISH PARAGRAPH', },).length,
            ).toBeGreaterThan(LONG_FENCE_RUN.length,);
            expect(sheetText({
              subject: {
                ...SUBJECT,
                receiving: {
                  ...SUBJECT.receiving,
                  view: { ...RECEIVING_VIEW, paragraph: '⟦⟦她想以可爱的样子陪伴在更多人的身边。', markStart: 3, markEnd: 20, },
                },
              },
            },).includes('enclosed between ⟦⟦⟦ and ⟧⟧⟧',),).toBe(true,);
          },
        },),
      ],
    },),
  ],
},);

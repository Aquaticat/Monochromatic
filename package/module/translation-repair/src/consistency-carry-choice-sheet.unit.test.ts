/**
 Tests for the sheet the bench reads to choose among a receiving place's
 candidate paragraphs: what is shown, how the candidates are named, and the
 reply with the reason first.

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
  buildCarryChoiceMessages,
  type CarryChoiceSubject,
  type ConsistencyOccurrenceView,
} from '../dist/final/node/index.mjs';
import {
  fenceOpening,
  LONG_FENCE_RUN,
} from './sheet-fence.test-fixture.ts';

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
const SUBJECT: CarryChoiceSubject = {
  repeat: { kind: 'maximal', wording: '以可爱的样子陪伴在更多人的身边', },
  receiving: RECEIVING_VIEW,
  chosenWords: 'wanted to stay by more people\'s side looking cute',
  candidates: [
    { label: 'CANDIDATE 1', current: false, text: 'She wanted to stay by more people\'s side looking cute.', },
    { label: 'CANDIDATE 2', current: true, text: 'She wanted to accompany more people with her cuteness.', },
    { label: 'CANDIDATE 3', current: false, text: 'She also wanted to stay by more people\'s side looking cute.', },
  ],
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
function sheetText({ subject, }: { readonly subject: CarryChoiceSubject; },): string {
  return buildCarryChoiceMessages({ subject, },)
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
      name: buildCarryChoiceMessages.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'ASKS WITH A SYSTEM MESSAGE OF RULES AND THE HOUSE RULES, then a user message of the original, the chosen '
            + 'rendering and the candidates',
          fn: async () => {
            const [system, user,] = buildCarryChoiceMessages({ subject: SUBJECT, },);
            expect({
              roles: [system?.role, user?.role,],
              houseRules: system?.content.includes('House rules this corpus is written under',),
              original: user?.content.includes('她想⟦以可爱的样子陪伴在更多人的身边⟧。',),
              chosen: user?.content.includes('CHOSEN RENDERING',),
              candidates: ['CANDIDATE 1', 'CANDIDATE 2', 'CANDIDATE 3',].every(function shown(label,): boolean {
                return user?.content.includes(label,) === true;
              },),
            },).toEqual({ roles: ['system', 'user',], houseRules: true, original: true, chosen: true, candidates: true, },);
          },
        },),
        it({
          name: 'NAMES THE CANDIDATE THAT IS THE PARAGRAPH AS THE PAGE HAS IT NOW, and no candidate\'s author',
          fn: async () => {
            const [, user,] = buildCarryChoiceMessages({ subject: SUBJECT, },);
            const content = user?.content ?? '';
            expect({
              current: content.includes(' CANDIDATE 2 (THE PARAGRAPH AS THE PAGE HAS IT NOW) ',),
              others: content.split('THE PARAGRAPH AS THE PAGE HAS IT NOW',).length - 1,
              author: ['writer', 'translator', 'splice',].some(function isNamed(word,): boolean {
                return content.toLowerCase()
                  .includes(word,);
              },),
            },).toEqual({ current: true, others: 1, author: false, },);
          },
        },),
        it({
          name: 'TELLS THE JUDGE TO WRITE THE REASON FIRST and to choose after it, in the rules, in the reply shape naming a shown '
            + 'label, and treats an "also" the chosen place carries for Chinese outside the repeat as an addition',
          fn: async () => {
            const [system, user,] = buildCarryChoiceMessages({ subject: SUBJECT, },);
            expect({
              rule: system?.content.includes('Write the reason first and choose after it',),
              keys: system?.content.includes('keys come in this order: reason, choice',),
              shape: user?.content.endsWith('Reply with JSON only: {"reason":"...","choice":"CANDIDATE 1"}',),
              also: system?.content.includes(
                'A word that renders Chinese outside the repeated wording in the chosen place (such as an "also" the chosen place carries for a word before its repeated wording) is an addition here',
              ),
              standard: system?.content.includes('never choose a candidate because it came first, came last, is longest or is the commonest',),
            },).toEqual({ rule: true, keys: true, shape: true, also: true, standard: true, },);
          },
        },),
        it({
          name: 'SHOWS A FRAME\'S BOUNDS AND THE RECEIVING PLACE\'S SLOT, and a repeated run\'s neither',
          fn: async () => {
            const frame = sheetText({
              subject: {
                ...SUBJECT,
                repeat: { kind: 'refrain', prefix: '所以她是个', suffix: '的女孩吧', },
                receiving: { ...RECEIVING_VIEW, slotSource: '温柔', },
              },
            },);
            const run = sheetText({ subject: SUBJECT, },);
            expect({
              frame: frame.includes('FRAME BEGINS WITH',) && frame.includes('SLOT IN THE ORIGINAL',) && frame.includes('温柔',),
              run: run.includes('SLOT IN THE ORIGINAL',) || run.includes('FRAME BEGINS WITH',),
            },).toEqual({ frame: true, run: false, },);
          },
        },),
        it({
          name: 'SHOWS THE TENSE CANDIDATES OF EACH CANDIDATE TEXT, labelled, when the entry records a death, and none otherwise',
          fn: async () => {
            const dead: CarryChoiceSubject = {
              ...SUBJECT,
              candidates: [
                { label: 'CANDIDATE 1', current: true, text: 'Mittens is asleep in the window.', },
                { label: 'CANDIDATE 2', current: false, text: 'Mittens was asleep in the window.', },
              ],
              lifeEnded: true,
              subjectNames: ['Mittens',],
            };
            const [, user,] = buildCarryChoiceMessages({ subject: dead, },);
            const [, living,] = buildCarryChoiceMessages({ subject: { ...dead, lifeEnded: false, }, },);
            expect({
              block: user?.content.includes('TENSE CANDIDATES',),
              line: user?.content.includes(
                'CANDIDATE 1:\n- "Mittens is asleep in the window." (matched "Mittens is", rule copula-or-auxiliary)',
              ),
              second: user?.content.includes('CANDIDATE 2:\n- ',),
              none: living?.content.includes('TENSE CANDIDATES',),
            },).toEqual({ block: true, line: true, second: false, none: false, },);
          },
        },),
        it({
          name: 'SHOWS THE DECLARED NAMES AND THE CITED PAGES with their rules when the page has them, and neither otherwise',
          fn: async () => {
            const [, bare,] = buildCarryChoiceMessages({ subject: SUBJECT, },);
            const full: CarryChoiceSubject = {
              ...SUBJECT,
              identityContext: '- name: ORIGINAL declares "咪咪", TRANSLATION declares "Mittens"',
              referenceContext: '- reference 1 https://example.org/mittens ("Mittens"): Mittens had a sister.',
            };
            const [, user,] = buildCarryChoiceMessages({ subject: full, },);
            expect({
              bareNames: fenceOpening({ content: bare?.content ?? '', label: 'DECLARED NAMES', },),
              bareReferences: fenceOpening({ content: bare?.content ?? '', label: 'CITED REFERENCES, EVIDENCE ONLY', },),
              names: fenceOpening({ content: user?.content ?? '', label: 'DECLARED NAMES', },) !== '',
              references: fenceOpening({ content: user?.content ?? '', label: 'CITED REFERENCES, EVIDENCE ONLY', },) !== '',
            },).toEqual({ bareNames: '', bareReferences: '', names: true, references: true, },);
          },
        },),
        it({
          name: 'FENCES the candidates with a fence no shown text can reproduce',
          fn: async () => {
            const [, user,] = buildCarryChoiceMessages({
              subject: {
                ...SUBJECT,
                identityContext: `- name: ${LONG_FENCE_RUN} CANDIDATE 1 ${LONG_FENCE_RUN}`,
              },
            },);
            expect(
              fenceOpening({ content: user?.content ?? '', label: 'CANDIDATE 1', },).length,
            ).toBeGreaterThan(LONG_FENCE_RUN.length,);
          },
        },),
      ],
    },),
  ],
},);

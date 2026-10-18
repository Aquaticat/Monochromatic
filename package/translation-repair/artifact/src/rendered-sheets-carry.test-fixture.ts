/**
 The sheets of the page-level consistency pass beyond its first round, rendered
 for `rendered-sheets.test-fixture.ts` (ledger X17): the run-off among the
 places that tied for first, the writer asked to carry the chosen rendering to a
 receiving place, and the judge asked to choose among that place's candidates.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import {
  buildCarryChoiceMessages,
  buildCarryWriterMessages,
  buildConsistencyRunOffMessages,
  type ConsistencyOccurrenceView,
} from '@monochromatic-dev/translation-repair-consistency';

import { refrainCarrySheets, } from './rendered-sheets-carry-refrain.test-fixture.ts';
import {
  IDENTITY,
  joined,
  REFERENCES,
  type RenderedSheet,
} from '@monochromatic-dev/translation-repair-repair/ts/rendered-sheets-texts.test-fixture.ts';

//region Carry sheets

/**
 The first place of the repeated sentence as the consistency sheet shows it.
 */
const FIRST_VIEW: ConsistencyOccurrenceView = {
  sliceIndex: 0,
  paragraph: '窗台上的阳光让小猫睡着了。',
  markStart: 0,
  markEnd: 12,
  english: {
    kind: 'present',
    text: 'The sunny window put the kitten to sleep.',
  },
};

/**
 The second place of the repeated sentence as the consistency sheet shows it.
 */
const SECOND_VIEW: ConsistencyOccurrenceView = {
  sliceIndex: 2,
  paragraph: '傍晚的时候，窗台上的阳光让小猫睡着了，小鱼干也笑了。',
  markStart: 6,
  markEnd: 18,
  english: {
    kind: 'present',
    text: 'In the evening, the sunlight on the sill lulled the kitten to sleep, and the fish snacks smiled too.',
  },
};

/**
 The third place of the repeated sentence as the consistency sheet shows it.
 */
const THIRD_VIEW: ConsistencyOccurrenceView = {
  sliceIndex: 4,
  paragraph: '夜里，窗台上的阳光让小猫睡着了。',
  markStart: 3,
  markEnd: 15,
  english: {
    kind: 'present',
    text: 'At night the sunny window put the kitten to sleep.',
  },
};

/**
 The repeated sentence.
 */
const SENTENCE = {
  kind: 'maximal',
  wording: '窗台上的阳光让小猫睡着了',
} as const;

/**
 The chosen place of the repeated sentence as the carry sheets show it: its words and the paragraph that holds them.
 */
const CHOSEN_PLACE = {
  view: FIRST_VIEW,
  span: 'The sunny window put the kitten to sleep',
  paragraph: 'The sunny window put the kitten to sleep.',
} as const;

/**
 The sheets of the run-off, the writer and the choice among candidates, each
 also with a death recorded so the tense block is rendered once more, and the
 sheets of a refrain whose two places share one paragraph.

 @returns One entry per sheet

 @example
 ```ts
 const sheets = carrySheets();
 ```
 */
export function carrySheets(): readonly RenderedSheet[] {
  return [
    {
      name: 'page consistency run-off, repeated sentence',
      text: joined({
        messages: buildConsistencyRunOffMessages({
          subject: {
            repeat: SENTENCE,
            occurrences: [
              FIRST_VIEW,
              SECOND_VIEW,
            ],
            identityContext: IDENTITY,
            referenceContext: REFERENCES,
          },
          finalists: [
            'OCCURRENCE 1',
            'OCCURRENCE 2',
          ],
          renderings: [
            {
              kind: 'located',
              quote: 'The sunny window put the kitten to sleep',
              core: 'The sunny window put the kitten to sleep',
              start: 0,
            },
            {
              kind: 'located',
              quote: 'the sunlight on the sill lulled the kitten to sleep',
              core: 'the sunlight on the sill lulled the kitten to sleep',
              start: 16,
            },
          ],
        },),
      },),
    },
    {
      name: 'page consistency run-off, repeated sentence, death recorded',
      text: joined({
        messages: buildConsistencyRunOffMessages({
          subject: {
            repeat: SENTENCE,
            occurrences: [
              FIRST_VIEW,
              SECOND_VIEW,
            ],
            identityContext: IDENTITY,
            referenceContext: REFERENCES,
            lifeEnded: true,
            subjectNames: ['Mittens',],
          },
          finalists: [
            'OCCURRENCE 1',
            'OCCURRENCE 2',
          ],
          renderings: [
            {
              kind: 'located',
              quote: 'The sunny window put the kitten to sleep',
              core: 'The sunny window put the kitten to sleep',
              start: 0,
            },
            {
              kind: 'located',
              quote: 'the sunlight on the sill lulled the kitten to sleep',
              core: 'the sunlight on the sill lulled the kitten to sleep',
              start: 16,
            },
          ],
        },),
      },),
    },
    {
      // A run-off among a proper subset of the places: the sheet shows the finalists only, so the labels it names
      // are the first and third, never the second.
      name: 'page consistency run-off, repeated sentence, first and third of three places',
      text: joined({
        messages: buildConsistencyRunOffMessages({
          subject: {
            repeat: SENTENCE,
            occurrences: [
              FIRST_VIEW,
              SECOND_VIEW,
              THIRD_VIEW,
            ],
            identityContext: IDENTITY,
            referenceContext: REFERENCES,
          },
          finalists: [
            'OCCURRENCE 1',
            'OCCURRENCE 3',
          ],
          renderings: [
            {
              kind: 'located',
              quote: 'The sunny window put the kitten to sleep',
              core: 'The sunny window put the kitten to sleep',
              start: 0,
            },
            {
              kind: 'located',
              quote: 'the sunlight on the sill lulled the kitten to sleep',
              core: 'the sunlight on the sill lulled the kitten to sleep',
              start: 16,
            },
            {
              kind: 'located',
              quote: 'the sunny window put the kitten to sleep',
              core: 'the sunny window put the kitten to sleep',
              start: 9,
            },
          ],
        },),
      },),
    },
    {
      name: 'page consistency carry writer, repeated sentence',
      text: joined({
        messages: buildCarryWriterMessages({
          subject: {
            repeat: SENTENCE,
            chosen: {
              view: FIRST_VIEW,
              span: 'The sunny window put the kitten to sleep',
              paragraph: 'The sunny window put the kitten to sleep.',
            },
            receiving: [
              {
                view: SECOND_VIEW,
                span: 'the sunlight on the sill lulled the kitten to sleep',
              },
            ],
            paragraph: 'In the evening, the sunlight on the sill lulled the kitten to sleep, and the fish snacks smiled too.',
            keeping: [],
            before: '傍晚的阳光很暖。',
            after: '小鱼干也笑了。',
            lineStructured: false,
            identityContext: IDENTITY,
            referenceContext: REFERENCES,
          },
        },),
      },),
    },
    {
      name: 'page consistency carry writer, repeated sentence, death recorded',
      text: joined({
        messages: buildCarryWriterMessages({
          subject: {
            repeat: SENTENCE,
            chosen: {
              view: FIRST_VIEW,
              span: 'The sunny window put the kitten to sleep',
              paragraph: 'The sunny window put the kitten to sleep.',
            },
            receiving: [
              {
                view: SECOND_VIEW,
                span: 'the sunlight on the sill lulled the kitten to sleep',
              },
            ],
            paragraph: 'In the evening, the sunlight on the sill lulled the kitten to sleep, and the fish snacks smiled too.',
            keeping: [],
            lineStructured: true,
            identityContext: IDENTITY,
            referenceContext: REFERENCES,
            lifeEnded: true,
            subjectNames: ['Mittens',],
          },
        },),
      },),
    },
    {
      name: 'page consistency carry choice, repeated sentence',
      text: joined({
        messages: buildCarryChoiceMessages({
          subject: {
            repeat: SENTENCE,
            receiving: [
              {
                view: SECOND_VIEW,
                span: 'the sunlight on the sill lulled the kitten to sleep',
              },
            ],
            chosen: CHOSEN_PLACE,
            keeping: [],
            candidates: [
              {
                label: 'CANDIDATE 1',
                current: true,
                text: 'In the evening, the sunlight on the sill lulled the kitten to sleep, and the fish snacks smiled too.',
              },
              {
                label: 'CANDIDATE 2',
                current: false,
                text: 'In the evening, the sunny window put the kitten to sleep, and the fish snacks smiled too.',
              },
            ],
            identityContext: IDENTITY,
            referenceContext: REFERENCES,
          },
        },),
      },),
    },
    {
      name: 'page consistency carry choice, repeated sentence, death recorded',
      text: joined({
        messages: buildCarryChoiceMessages({
          subject: {
            repeat: SENTENCE,
            receiving: [
              {
                view: SECOND_VIEW,
                span: 'the sunlight on the sill lulled the kitten to sleep',
              },
            ],
            chosen: CHOSEN_PLACE,
            keeping: [],
            candidates: [
              {
                label: 'CANDIDATE 1',
                current: true,
                text: 'In the evening, the sunlight on the sill lulled Mittens to sleep, and the fish snacks smiled too.',
              },
              {
                label: 'CANDIDATE 2',
                current: false,
                text: 'In the evening, the sunny window put Mittens to sleep, and the fish snacks smiled too.',
              },
            ],
            identityContext: IDENTITY,
            referenceContext: REFERENCES,
            lifeEnded: true,
            subjectNames: ['Mittens',],
          },
        },),
      },),
    },
    ...refrainCarrySheets(),
  ];
}

//endregion Carry sheets

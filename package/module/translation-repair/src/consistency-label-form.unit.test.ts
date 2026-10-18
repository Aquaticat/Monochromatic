/**
 Tests for the reading of a label a judge wrote against the labels a sheet showed, and for the reply shapes that list
 the labels a reply may use (the lead's ruling of 2026-10-15): `shownLabelOf` finds the one shown label a name stands
 for, the canonical readers rewrite a counted reply's labels to their shown form, and the reply shapes built for one
 ask list the shown labels as an `enum`.

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
  canonicalBallotOf,
  canonicalChoiceOf,
  consistencyChoiceResponseFormat,
  consistencyResponseFormat,
  shownLabelOf,
} from '../dist/final/node/index.mjs';

/**
 The labels of a run-off between the third and fourth places.
 */
const SHOWN = ['OCCURRENCE 3', 'OCCURRENCE 4',] as const;

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: shownLabelOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'FINDS THE ONE SHOWN LABEL A NAME STANDS FOR, as a list of one: the label itself, in any case and with any white '
            + 'space, or its bare number',
          fn: async () => {
            expect([
              'OCCURRENCE 3',
              'occurrence 3',
              '\tOccurrence\u00A0 3 ',
              '3',
              ' 4\n',
            ].map(function found(name,): readonly string[] {
              return shownLabelOf({ name, shown: SHOWN, },);
            },),).toEqual([['OCCURRENCE 3',], ['OCCURRENCE 3',], ['OCCURRENCE 3',], ['OCCURRENCE 3',], ['OCCURRENCE 4',],],);
          },
        },),
        it({
          name: 'FINDS NOTHING FOR A NAME THAT STANDS FOR NO SHOWN LABEL OR FOR TWO, and never guesses between them',
          fn: async () => {
            expect([
              'OCCURRENCE 5',
              '1',
              '03',
              '3.0',
              'Candidate 3',
              'OCCURRENCE',
              '',
              'both',
            ].map(function found(name,): readonly string[] {
              return shownLabelOf({ name, shown: SHOWN, },);
            },),).toEqual([[], [], [], [], [], [], [], [],],);
            expect(shownLabelOf({ name: '1', shown: ['CANDIDATE 1', 'OCCURRENCE 1',], },),).toEqual([],);
            expect(shownLabelOf({ name: 'candidate 1', shown: ['CANDIDATE 1', 'OCCURRENCE 1',], },),).toEqual(['CANDIDATE 1',],);
          },
        },),
      ],
    },),
    describe({
      name: canonicalChoiceOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'REWRITES THE CHOICE TO THE SHOWN LABEL AND KEEPS EVERYTHING ELSE THE REPLY CARRIES, a reply naming no shown label '
            + 'giving none',
          fn: async () => {
            expect(
              canonicalChoiceOf({
                ballot: { seat: 'glm', reason: 'It reads better.', choice: '3', },
                labels: SHOWN,
              },),
            ).toEqual([{ seat: 'glm', reason: 'It reads better.', choice: 'OCCURRENCE 3', },],);
            expect(
              canonicalChoiceOf({ ballot: { reason: 'It reads better.', choice: '1', }, labels: SHOWN, },),
            ).toEqual([],);
          },
        },),
      ],
    },),
    describe({
      name: canonicalBallotOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'REWRITES THE CHOICE, THE KEPT PLACES AND THE QUOTE LABELS, keeping the quotes, the slots and the seat, and gives '
            + 'none for a ballot that names an unknown place or one place twice',
          fn: async () => {
            const labels = ['OCCURRENCE 1', 'OCCURRENCE 2', 'OCCURRENCE 3',];
            const ballot = {
              seat: 'minimax',
              reason: 'The first place words it best.',
              quotes: [{ label: '1', quote: 'The cat naps.', slot: 'naps', }, { label: 'occurrence 2', quote: 'The kitten naps.', },],
              choice: ' Occurrence 1',
              keep: ['2',],
            };
            expect(canonicalBallotOf({ ballot, labels, },),).toEqual([
              {
                seat: 'minimax',
                reason: 'The first place words it best.',
                quotes: [
                  { label: 'OCCURRENCE 1', quote: 'The cat naps.', slot: 'naps', },
                  { label: 'OCCURRENCE 2', quote: 'The kitten naps.', },
                ],
                choice: 'OCCURRENCE 1',
                keep: ['OCCURRENCE 2',],
              },
            ],);
            expect([
              canonicalBallotOf({ ballot: { ...ballot, choice: '9', }, labels, },),
              canonicalBallotOf({ ballot: { ...ballot, keep: ['2', 'occurrence 2',], }, labels, },),
              canonicalBallotOf({ ballot: { ...ballot, quotes: [{ label: '4', quote: 'x', },], }, labels, },),
            ],).toEqual([[], [], [],],);
          },
        },),
      ],
    },),
    describe({
      name: consistencyChoiceResponseFormat.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'LISTS THE SHOWN LABELS AS AN ENUM OF THE CHOICE and declares the reason first, as the reply is asked',
          fn: async () => {
            const format = consistencyChoiceResponseFormat({ labels: SHOWN, },);
            expect(format,).toEqual({
              type: 'json_schema',
              json_schema: {
                name: 'page_consistency_choice',
                schema: {
                  type: 'object',
                  required: ['reason', 'choice',],
                  additionalProperties: false,
                  properties: {
                    reason: { type: 'string', },
                    choice: { type: 'string', enum: ['OCCURRENCE 3', 'OCCURRENCE 4',], },
                  },
                },
              },
            },);
            expect(Object.keys(format.json_schema.schema.properties as Record<string, unknown>,),).toEqual(['reason', 'choice',],);
          },
        },),
      ],
    },),
    describe({
      name: consistencyResponseFormat.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'LISTS THE SHOWN LABELS AS AN ENUM OF THE CHOICE, OF EACH KEPT PLACE AND OF EACH QUOTE LABEL, with the slot the one '
            + 'optional property',
          fn: async () => {
            const labels = ['OCCURRENCE 1', 'OCCURRENCE 2',];
            const format = consistencyResponseFormat({ labels, },);
            expect(format,).toEqual({
              type: 'json_schema',
              json_schema: {
                name: 'page_consistency',
                schema: {
                  type: 'object',
                  required: ['reason', 'quotes', 'choice', 'keep',],
                  additionalProperties: false,
                  properties: {
                    reason: { type: 'string', },
                    quotes: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: ['label', 'quote',],
                        additionalProperties: false,
                        properties: {
                          label: { type: 'string', enum: labels, },
                          quote: { type: 'string', },
                          slot: { type: 'string', },
                        },
                      },
                    },
                    choice: { type: 'string', enum: labels, },
                    keep: { type: 'array', items: { type: 'string', enum: labels, }, },
                  },
                },
              },
            },);
            expect(Object.keys(format.json_schema.schema.properties as Record<string, unknown>,),).toEqual([
              'reason',
              'quotes',
              'choice',
              'keep',
            ],);
          },
        },),
      ],
    },),
  ],
},);

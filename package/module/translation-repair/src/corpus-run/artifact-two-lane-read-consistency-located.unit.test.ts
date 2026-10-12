/**
 Tests for reading a recorded rendering against the ballots: a located one as
 the counter's, the words a quote keeps and where a frame's slot stands in them,
 which must be exactly once for the recount of what moving words over it would
 do; and an unlocated one's reason, which the ballots may contradict.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import {
  ArtifactParseError,
  asLocated,
  reasonContradicted,
} from '../../dist/final/node/index.mjs';
import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: asLocated.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS A QUOTE WITH NO SLOT AS ITS WORDS, the closing punctuation left off and the offset at zero',
          fn: async () => {
            expect(asLocated({
              rendering: { kind: 'located', quote: 'The kitten naps.', },
              path: 'cat.rendering',
            },),).toEqual({
              kind: 'located',
              quote: 'The kitten naps.',
              core: 'The kitten naps',
              start: 0,
            },);
          },
        },),
        it({
          name: 'READS A FRAME\'S SLOT BY WHERE IT STANDS ONCE IN THE WORDS',
          fn: async () => {
            expect(asLocated({
              rendering: { kind: 'located', quote: 'So this cat is a lazy little treasure.', slot: 'lazy', },
              path: 'cat.rendering',
            },),).toEqual({
              kind: 'located',
              quote: 'So this cat is a lazy little treasure.',
              core: 'So this cat is a lazy little treasure',
              start: 0,
              slot: 'lazy',
              slotStart: 17,
            },);
          },
        },),
        it({
          name: 'REFUSES A SLOT THAT STANDS NOWHERE IN THE WORDS OR MORE THAN ONCE, naming the path',
          fn: async () => {
            /**
             The refusal for a slot.
             */
            function refusalFor({ slot, }: { readonly slot: string; },): string {
              try {
                asLocated({
                  rendering: { kind: 'located', quote: 'So this cat is a lazy little treasure.', slot, },
                  path: 'cat.rendering',
                },);
              }
              catch (error) {
                if (error instanceof ArtifactParseError)
                  return error.message;
                throw error;
              }
              return 'not refused';
            }
            expect(['bored', 'e',].map(function refusedFor(slot,): boolean {
              const message = refusalFor({ slot, },);
              return message.includes('cat.rendering',)
                && message.includes('a slot that stands exactly once in the words of its quote',);
            },),).toEqual([true, true,],);
          },
        },),
      ],
    },),
    describe({
      name: reasonContradicted.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'CONTRADICTS A REASON ONLY WHERE THE BALLOTS AGREED ON WHAT IT DENIES: a quote for no-agreement, a '
            + 'quote with words for empty, a slot for slot-no-agreement, a slot with words for slot-empty, and any '
            + 'ballots for not-asked',
          fn: async () => {
            const cases = [
              { reason: 'no-agreement', quotes: ['the cat naps',], slots: [], },
              { reason: 'no-agreement', quotes: [], slots: [], },
              { reason: 'empty', quotes: ['.',], slots: [], },
              { reason: 'empty', quotes: ['the cat naps',], slots: [], },
              { reason: 'empty', quotes: [], slots: [], },
              { reason: 'slot-no-agreement', quotes: ['the cat naps',], slots: [], },
              { reason: 'slot-no-agreement', quotes: ['the cat naps',], slots: ['naps',], },
              { reason: 'slot-no-agreement', quotes: [], slots: [], },
              { reason: 'slot-empty', quotes: ['the cat naps',], slots: ['',], },
              { reason: 'slot-empty', quotes: ['the cat naps',], slots: ['naps',], },
              { reason: 'slot-empty', quotes: ['the cat naps',], slots: [], },
              { reason: 'not-asked', quotes: [], slots: [], },
              { reason: 'not-found', quotes: ['the cat naps',], slots: [], },
            ] as const;
            expect(cases.map(function contradicts(each,): boolean {
              return reasonContradicted(each,);
            },),).toEqual([
              true,
              false,
              false,
              true,
              true,
              false,
              true,
              true,
              false,
              true,
              true,
              true,
              false,
            ],);
          },
        },),
      ],
    },),
  ],
},);

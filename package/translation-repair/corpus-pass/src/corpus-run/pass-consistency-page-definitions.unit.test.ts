/**
 Tests for the callers of the consistency fold that count the stands of some words in a replacement and in the English it replaces:
 a reference whose definition stands in another slice of the page is a link there, so the count reads the page's definitions (n173).

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
  type CarryBlock,
  type PageEnglish,
} from '@monochromatic-dev/translation-repair-consistency';
import { asLocatedBySpan, } from '@monochromatic-dev/translation-repair-artifact';
import { ArtifactParseError, } from '@monochromatic-dev/translation-repair-artifact-pool';
import {
  type ConsistencySliceFacts,
  editsChangingLocatedWords,
  settledIndexOf,
  writtenParagraphsOf,
} from '../../dist/final/node/index.mjs';
import { levelCapturingLogger, } from '@monochromatic-dev/translation-repair-test-fixture/ts/capturing-logger.test-fixture.ts';
import {
  groupIn,
  withEdit,
} from './consistency-apply-group.test-fixture.ts';

/**
 The English of the slice the replacements are made in.
 */
const SLICE = 'kit and tail';

/**
 A page that holds the slice and some definition line after it.

 @param definition - the definition line

 @returns The page, the slice starting at its first character

 @example
 ```ts
 const page = pageWith({ definition: '[r]: u', },);
 ```
 */
function pageWith({ definition, }: { readonly definition: string; },): PageEnglish {
  return {
    text: `${SLICE}\n\n${definition}`,
    offset: 0,
  };
}

/**
 The English of the slice a writer rewrites a block of.
 */
const ENGLISH = '## One\n\nThe sunny window put the kitten to sleep.';

/**
 The body block of that English.
 */
const BLOCK: CarryBlock = {
  start: ENGLISH.indexOf('The sunny',),
  end: ENGLISH.length,
  text: 'The sunny window put the kitten to sleep.',
};

/**
 The facts of the slice a writer rewrites a block of, read alone: they carry no page.
 */
const FACTS_ALONE: ConsistencySliceFacts = {
  sliceIndex: 4,
  sourceIndex: 4,
  sourceText: '## 一\n\n窗台上的阳光让小猫睡着了。',
  sourceStart: 0,
  nodes: [],
  current: { kind: 'present', text: ENGLISH, },
  lineStructured: false,
  disputedWordings: [],
};

/**
 The facts of the slice with the page it belongs to.

 @param page - the English of the whole page

 @returns The slice's facts

 @example
 ```ts
 const facts = factsOn({ page: { text: ENGLISH, offset: 0, }, },);
 ```
 */
function factsOn({ page, }: { readonly page: PageEnglish; },): ConsistencySliceFacts {
  return {
    ...FACTS_ALONE,
    page,
  };
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: editsChangingLocatedWords.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS THE PAGE\'S DEFINITIONS IN THE REPLACEMENT: words joined across a reference the page defines are no stand, so a '
            + 'block that holds them that way changes the words another group located, and not on a page that defines nothing of the '
            + 'kind (n173)',
          fn: async () => {
            const mine = groupIn({
              places: [
                { slice: 0, english: 'The cat naps. It is warm.', quote: 'The cat naps.', },
                { slice: 1, english: SLICE, quote: 'and tail', },
              ],
            },);
            const other = groupIn({
              places: [
                { slice: 1, english: SLICE, quote: 'kit', },
                { slice: 3, english: 'Dusk: the kit purrs in the sun.', quote: 'kit', },
              ],
            },);
            /**
             A block replacement of the whole slice by some text.
             */
            const edit = {
              kind: 'block' as const,
              placePositions: [1,],
              sliceIndex: 1,
              start: 0,
              end: SLICE.length,
              text: 'kit[][r]\'kit tail',
            };
            /**
             What the replacement leaves out, on a page or on none.
             */
            function leftOutOn({ page, }: { readonly page?: PageEnglish; },): unknown {
              return editsChangingLocatedWords({
                index: settledIndexOf({ settled: [withEdit({ group: mine, edit, },), other,], },),
                sliceIndex: 1,
                english: SLICE,
                ...((page === undefined) ? {} : { page, }),
              },);
            }
            expect({
              defined: leftOutOn({ page: pageWith({ definition: '[r]: u', },), },),
              otherLabel: leftOutOn({ page: pageWith({ definition: '[x]: u', },), },),
              alone: leftOutOn({},),
            },).toEqual({
              defined: [{ group: 0, edit, other: { group: 1, label: 'OCCURRENCE 1', start: 0, }, },],
              otherLabel: [],
              alone: [],
            },);
          },
        },),
      ],
    },),
    describe({
      name: asLocatedBySpan.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS A RECORDED SLOT WITHOUT THE PAGE: the artifact holds no English and no definitions, so a slot that stands once '
            + 'only where the page defines the reference inside the quote is refused, the one reading it can make (n173)',
          fn: async () => {
            /**
             What the reader throws for a recorded rendering, none when it reads.
             */
            let thrown: unknown;
            try {
              asLocatedBySpan({
                rendering: { kind: 'located', quote: 'kit[][r]\'kit kit', start: 0, slot: 'kit', },
                path: 'cat.rendering',
              },);
            }
            catch (error) {
              thrown = error;
            }
            expect(thrown,).toBeInstanceOf(ArtifactParseError,);
            expect(String(thrown,),).toContain('a slot that stands exactly once in the words of its quote',);
          },
        },),
      ],
    },),
    describe({
      name: writtenParagraphsOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS THE PAGE\'S DEFINITIONS IN THE PARAGRAPH: words joined across a reference the page defines are no stand, so a '
            + 'paragraph that holds the words to keep that way is withheld, and not on a page that defines nothing of the kind (n173)',
          fn: async () => {
            /**
             What the writers' paragraphs come to on a page or on none.
             */
            function writtenOn({ page, }: { readonly page?: PageEnglish; },): unknown {
              return writtenParagraphsOf({
                voices: [{ seat: 'hyper-cat', translation: 'The sunny window put the kitten[][r]\'kitten to sleep.', },],
                english: ENGLISH,
                block: BLOCK,
                keeping: ['kitten',],
                crossing: [],
                facts: (page === undefined) ? FACTS_ALONE : factsOn({ page, },),
                declared: [],
                declaredNames: [],
                l: levelCapturingLogger({ lines: [], },),
              },);
            }
            expect({
              defined: writtenOn({ page: { text: `${ENGLISH}\n\n[r]: u`, offset: 0, }, },),
              otherLabel: writtenOn({ page: { text: `${ENGLISH}\n\n[x]: u`, offset: 0, }, },),
              alone: writtenOn({},),
            },).toEqual({
              defined: {
                written: [],
                findings: [
                  'consistency-candidate-refused (hyper-cat): the paragraph no longer holds the words of another place that must stay as they are',
                ],
              },
              otherLabel: {
                written: [{ seat: 'hyper-cat', text: 'The sunny window put the kitten[][r]\'kitten to sleep.', },],
                findings: [],
              },
              alone: {
                written: [{ seat: 'hyper-cat', text: 'The sunny window put the kitten[][r]\'kitten to sleep.', },],
                findings: [],
              },
            },);
          },
        },),
      ],
    },),
  ],
},);

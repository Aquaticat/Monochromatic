/**
 Tests for the texts a receiving place's carry may choose among: the slice with
 one block replaced, what the floors make of a candidate slice, and the
 paragraphs the writers wrote that every floor passes, laid out as the page
 lays text out, with a finding for each reply withheld.

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
  composeSlice,
  type ConsistencySliceFacts,
  floorRefusalOf,
  writtenParagraphsOf,
} from '../../dist/final/node/index.mjs';
import { levelCapturingLogger, } from '../capturing-logger.test-fixture.ts';

/**
 The original of the slice every case reads.
 */
const SOURCE = '## 一\n\n窗台上的阳光让小猫睡着了。';

/**
 The English the slice carries now.
 */
const ENGLISH = '## One\n\nThe sunny window put the kitten to sleep.';

/**
 The body block of that English, the one the writers rewrite.
 */
const BLOCK: CarryBlock = {
  start: ENGLISH.indexOf('The sunny',),
  end: ENGLISH.length,
  text: 'The sunny window put the kitten to sleep.',
};

/**
 The slice as the floors read it.

 @param lineStructured - whether the line-structure rule governs the slice

 @returns The slice's facts

 @example
 ```ts
 const facts = factsOf({ lineStructured: false, },);
 ```
 */
function factsOf({ lineStructured, }: { readonly lineStructured: boolean; },): ConsistencySliceFacts {
  return {
    sliceIndex: 4,
    sourceIndex: 4,
    sourceText: SOURCE,
    sourceStart: 0,
    nodes: [],
    current: { kind: 'present', text: ENGLISH, },
    lineStructured,
    disputedWordings: [],
  };
}

/**
 What the writers' paragraphs come to.

 @param voices - the replies with their seats, in roster order

 @param lineStructured - whether the line-structure rule governs the slice

 @param lines - sink for the level and text of every line logged

 @returns The surviving paragraphs and the findings

 @example
 ```ts
 const { written, findings, } = writtenBy({ voices: [], lineStructured: false, lines: [], },);
 ```
 */
function writtenBy(
  {
    voices,
    lineStructured,
    lines,
  }: {
    readonly voices: readonly { readonly seat: string; readonly translation: string; }[];
    readonly lineStructured: boolean;
    readonly lines: string[];
  },
): ReturnType<typeof writtenParagraphsOf> {
  return writtenParagraphsOf({
    voices,
    english: ENGLISH,
    block: BLOCK,
    facts: factsOf({ lineStructured, },),
    declared: [],
    declaredNames: [],
    l: levelCapturingLogger({ lines, },),
  },);
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: composeSlice.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'PUTS THE PARAGRAPH WHERE THE BLOCK STOOD AND KEEPS EVERYTHING AROUND IT, the heading before and a block after',
          fn: async () => {
            expect([
              composeSlice({ english: ENGLISH, block: BLOCK, paragraph: 'The cat dozes.', },),
              composeSlice({
                english: `${ENGLISH}\n\nPurr.`,
                block: BLOCK,
                paragraph: 'The cat dozes.',
              },),
            ],).toEqual([
              '## One\n\nThe cat dozes.',
              '## One\n\nThe cat dozes.\n\nPurr.',
            ],);
          },
        },),
      ],
    },),
    describe({
      name: floorRefusalOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'ANSWERS WITH NONE WHEN EVERY FLOOR PASSES AND WITH ONE SENTENCE OF THE FLOORS\' FINDINGS WHEN ONE REFUSES',
          fn: async () => {
            const facts = factsOf({ lineStructured: false, },);
            expect([
              floorRefusalOf({
                facts,
                currentText: ENGLISH,
                candidateText: '## One\n\nThe sunlit window put the kitten to sleep.',
                declared: [],
                declaredNames: [],
              },),
              floorRefusalOf({
                facts,
                currentText: ENGLISH,
                candidateText: '## One\n\nThe sunlit window put the kitten to sleep.\n\nAnd another paragraph.',
                declared: [],
                declaredNames: [],
              },),
            ],).toEqual([
              [],
              [
                'Your translation is 3 blocks (heading (level 2), paragraph, paragraph) and the PAGE AS IT STANDS is 2. '
                + 'Add a block only to carry something the ORIGINAL has and the text you are replacing left out.',
              ],
            ],);
          },
        },),
        it({
          name: 'JOINS SEVERAL FINDINGS INTO THAT ONE SENTENCE, divided by a bar',
          fn: async () => {
            const [refusal,] = floorRefusalOf({
              facts: factsOf({ lineStructured: false, },),
              currentText: '## One\n\nMittens put the kitten to sleep.',
              candidateText: '# One\n\nThe sunlit window put the kitten to sleep.\n\nAnd another paragraph.',
              declared: [],
              declaredNames: ['Mittens',],
            },);
            expect(refusal?.split(' | ',).length,).toBe(2,);
          },
        },),
      ],
    },),
    describe({
      name: writtenParagraphsOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'KEEPS EACH WRITER\'S PARAGRAPH THAT EVERY FLOOR PASSES, in roster order, with no finding',
          fn: async () => {
            const lines: string[] = [];
            expect(writtenBy({
              voices: [
                { seat: 'hyper-cat', translation: 'The sunlit window put the kitten to sleep.', },
                { seat: 'bedrock-cat', translation: 'The warm window sent the kitten to sleep.', },
              ],
              lineStructured: false,
              lines,
            },),).toEqual({
              written: [
                { seat: 'hyper-cat', text: 'The sunlit window put the kitten to sleep.', },
                { seat: 'bedrock-cat', text: 'The warm window sent the kitten to sleep.', },
              ],
              findings: [],
            },);
            expect(lines,).toEqual([],);
          },
        },),
        it({
          name: 'LAYS A PARAGRAPH OUT ONE CLAUSE PER LINE UNLESS THE LINE-STRUCTURE RULE GOVERNS THE SLICE, and drops the line '
            + 'breaks around it',
          fn: async () => {
            const voices = [{ seat: 'hyper-cat', translation: '\nThe window glowed, and the kitten slept.\n', },];
            expect([
              writtenBy({ voices, lineStructured: false, lines: [], },).written,
              writtenBy({ voices, lineStructured: true, lines: [], },).written,
            ],).toEqual([
              [{ seat: 'hyper-cat', text: 'The window glowed,\nand the kitten slept.', },],
              [{ seat: 'hyper-cat', text: 'The window glowed, and the kitten slept.', },],
            ],);
          },
        },),
        it({
          name: 'WITHHOLDS A PARAGRAPH THE FLOORS REFUSE, with a finding naming the seat and a warning, and keeps the others',
          fn: async () => {
            const lines: string[] = [];
            const { written, findings, } = writtenBy({
              voices: [
                { seat: 'hyper-cat', translation: 'The sunlit window put the kitten to sleep.\n\nAnd another paragraph.', },
                { seat: 'bedrock-cat', translation: 'The warm window sent the kitten to sleep.', },
              ],
              lineStructured: false,
              lines,
            },);
            expect({
              written,
              findings: findings.map(function head(finding,): string {
                return finding.slice(0, 'consistency-candidate-refused (hyper-cat): '.length,);
              },),
              warned: lines.map(function head(line,): string {
                return line.slice(0, 'warn [writtenParagraphsOf] withheld hyper-cat from the bench: '.length,);
              },),
            },).toEqual({
              written: [{ seat: 'bedrock-cat', text: 'The warm window sent the kitten to sleep.', },],
              findings: ['consistency-candidate-refused (hyper-cat): ',],
              warned: ['warn [writtenParagraphsOf] withheld hyper-cat from the bench: ',],
            },);
          },
        },),
        it({
          name: 'WITHHOLDS A REPLY THAT CANNOT BE READ AS A PARAGRAPH, such as a stored one that is not text, with a finding '
            + 'naming the seat, and keeps the others',
          fn: async () => {
            const lines: string[] = [];
            const { written, findings, } = writtenBy({
              voices: [
                // A stored reply of a corrupt record, whose translation is a number.
                JSON.parse('{"seat":"hyper-cat","translation":4}',),
                { seat: 'bedrock-cat', translation: 'The warm window sent the kitten to sleep.', },
              ],
              lineStructured: false,
              lines,
            },);
            expect({
              written,
              findings,
              warned: lines.length,
            },).toEqual({
              written: [{ seat: 'bedrock-cat', text: 'The warm window sent the kitten to sleep.', },],
              findings: ['consistency-candidate-unreadable (hyper-cat)',],
              warned: 1,
            },);
          },
        },),
      ],
    },),
  ],
},);

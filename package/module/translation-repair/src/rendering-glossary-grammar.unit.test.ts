/**
 Guards class one hundred sixty-one (TianqiChen6662, 2026-09-26): under the
 owner's standing instruction of 2026-09-25 ("whenever you see anything that
 can be translated better do it"), three phrasings join the rendering
 glossary. 化作 shipped as the archive's "turned into in a small box", a slip
 no lane repaired; 被她治愈 as "those she has healed" in a life told in the
 past; and 应该会有更好的生活，不是吗 as "should have had a better life, didn't
 she?", a tag that does not match its clause, where the archive had written
 "deserved a better life, didn't she?".

 Class one hundred sixty-four (TianqiChen6665, 2026-09-26) adds 遇到的却是,
 which shipped as the archive's "made her met with" on an unendorsed standing.
 Class one hundred sixty-six (TianqiChen6665) adds 在隙中, which shipped as
 "caught a glimpse through the gaps of those she had comforted", the gaps
 read as belonging to the people seen through them.

 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  RENDERING_GLOSSARY,
  validateTranslatedSlice,
} from '../dist/final/node/index.mjs';

/**
 Original in which the kitten's fur becomes a small ball.
 */
const BECOMING = '小猫的毛化作一个小小的毛球。';

/**
 Original in which the kitten had comforted the other cats.
 */
const COMFORTED = '被她治愈的猫都很开心。';

/**
 Original asking whether so hardworking a kitten deserved better.
 */
const DESERVED = '这样勤快的小猫应该会有更好的生活，不是吗？';

/**
 Original in which the diligent kitten met with the dog's barking instead.
 */
const MET = '小猫很勤快，遇到的却是狗的吠叫。';

/**
 Original in which the kitten glimpsed a friend through the gap in the fence.
 */
const GAP = '小猫在隙中窥见了朋友。';

/**
 Original in which the kitten naps well so there is hope for every plan.
 */
const HOPE = '小猫睡好了，这样一切都会有机会的。';

/**
 Original in which the kitten says it will purr as it leaves the others.
 */
const LEAVING = '我会在离开我们的时候轻轻地叫一声。';

/**
 Original naming, in a life told in the past, what kind of cat she was.
 */
const KIND = '所以她是个勇敢的小猫吧。';

/**
 Terms classes one hundred sixty-one, sixty-four, sixty-six and seventy to seventy-two seed.
 */
const SEEDED_TERMS = [
  '化作',
  '被她治愈',
  '应该会有更好的生活',
  '遇到的却是',
  '在隙中',
  '一切都会有机会',
  '离开我们的时候',
  '所以她是个',
] as const;

/**
 Candidates the page's slips would ship, each with the original it renders.
 */
const REFUSED_CANDIDATES: readonly { readonly sourceText: string; readonly candidateText: string; }[] = [
  { sourceText: BECOMING, candidateText: 'The kitten\'s fur turned into in a small ball.', },
  { sourceText: COMFORTED, candidateText: 'The cats she has healed were all happy.', },
  { sourceText: DESERVED, candidateText: 'Such a hardworking kitten should have had a better life, didn\'t she?', },
  { sourceText: MET, candidateText: 'The kitten was diligent, but fate made her met with the dog\'s barking.', },
  { sourceText: GAP, candidateText: 'The kitten caught a glimpse through the gaps of those it loved.', },
  { sourceText: HOPE, candidateText: 'The kitten slept well, so everything will have a chance.', },
  { sourceText: LEAVING, candidateText: 'When I leave us, I will mew softly.', },
  { sourceText: KIND, candidateText: 'So, she’s a brave little cat.', },
];

/**
 Candidates carrying the English the glossary seeds, each with the original it renders.
 */
const ACCEPTED_CANDIDATES: readonly { readonly sourceText: string; readonly candidateText: string; }[] = [
  { sourceText: BECOMING, candidateText: 'The kitten\'s fur turned into a small ball.', },
  { sourceText: COMFORTED, candidateText: 'The cats she had comforted were all happy.', },
  { sourceText: DESERVED, candidateText: 'Such a hardworking kitten deserved a better life, didn\'t she?', },
  { sourceText: MET, candidateText: 'The kitten was diligent, but what she met with was the dog\'s barking.', },
  { sourceText: GAP, candidateText: 'Through the gap, the kitten glimpsed a friend.', },
  { sourceText: HOPE, candidateText: 'The kitten slept well, so there will be hope for everything.', },
  { sourceText: LEAVING, candidateText: 'When I leave you all, I will mew softly.', },
  { sourceText: KIND, candidateText: 'So she was a brave little cat.', },
];

await describe({
  name: 'grammar slips the rendering glossary refuses (class one hundred sixty-one)',
  children: [
    it({
      name: 'SEEDS 化作, 被她治愈, 应该会有更好的生活, 遇到的却是, 在隙中, 一切都会有机会, 离开我们的时候 and 所以她是个',
      fn: async () => {
        expect(SEEDED_TERMS.filter(function isSeeded(term,): boolean {
          return RENDERING_GLOSSARY.some(function isTerm(entry,): boolean {
            return entry.term === term;
          },);
        },),).toEqual([...SEEDED_TERMS,],);
      },
    },),
    it({
      name: 'REFUSES the slips the page shipped',
      fn: async () => {
        expect(REFUSED_CANDIDATES.map(function kindOf(candidate,): string {
          return validateTranslatedSlice(candidate,).kind;
        },),).toEqual(REFUSED_CANDIDATES.map(function invalid(): string {
          return 'invalid';
        },),);
      },
    },),
    it({
      name: 'PASSES the grammatical English',
      fn: async () => {
        expect(ACCEPTED_CANDIDATES.map(function kindOf(candidate,): string {
          return validateTranslatedSlice(candidate,).kind;
        },),).toEqual(ACCEPTED_CANDIDATES.map(function valid(): string {
          return 'valid';
        },),);
      },
    },),
  ],
},);

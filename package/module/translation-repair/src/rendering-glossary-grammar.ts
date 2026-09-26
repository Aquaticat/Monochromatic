import type { CommunityTerm, } from './community-glossary.ts';

//region Grammar renderings
// CLASS ONE HUNDRED SIXTY-ONE (TianqiChen6662, 2026-09-26): three slips on a
// settled page. 化作一个小小的盒子 shipped as the archive's "turned into in a
// small box", which no lane repaired; 被她治愈 as the archive's "those she has
// healed" in a life the house rule tells in the past; and 应该会有更好的生活，
// 不是吗 as "should have had a better life, didn't she?", a tag that does not
// match its clause, where the archive had written "deserved a better life,
// didn't she?". Each refused form is ungrammatical wherever its term stands,
// so keying it on the term refuses no sound English. Kept beside
// `rendering-glossary.ts`, which spreads these entries into
// `RENDERING_GLOSSARY`, so neither file outgrows the line budget.

/**
 Words the pinned corpus carries whose English the page has written
 ungrammatically, with the English the page uses.
 */
export const GRAMMAR_GLOSSARY: readonly CommunityTerm[] = [
  {
    term: '化作',
    renderings: [
      'turned into',
      'became',
    ],
    refusedForms: [
      'turned into in ',
    ],
    why: 'something becoming something else; the page says it "turned into" or "became" it, never "turned into in"',
  },
  {
    term: '被她治愈',
    renderings: [
      'she had comforted',
      'she had healed',
    ],
    refusedForms: [
      'she has healed',
      'she has comforted',
    ],
    why: 'the people she had comforted; the page tells a life in the past, so the perfect is "had", never "has"',
  },
  {
    term: '应该会有更好的生活',
    renderings: [
      'deserved a better life',
    ],
    refusedForms: [
      'should have had a better life, didn\'t',
      'should have had a better life, didn’t',
    ],
    why: 'a life that ought to have been better; with the tag question 不是吗 the page writes "deserved a better life, '
      + 'didn\'t she?", since "should have had ..., didn\'t she?" mismatches the tag',
  },
];

//endregion Grammar renderings

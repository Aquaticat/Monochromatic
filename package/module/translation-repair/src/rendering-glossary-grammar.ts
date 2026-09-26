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
  // CLASS ONE HUNDRED SIXTY-FOUR (TianqiChen6665, 2026-09-26): 遇到的却是
  // shipped as the archive's "made her met with" on an unendorsed standing
  // after a 2 to 2 contest; the refused form makes that standing ineligible.
  {
    term: '遇到的却是',
    renderings: [
      'met with',
      'was met with',
      'faced',
    ],
    refusedForms: [
      'made her met with',
    ],
    why: 'what someone met with instead of what they hoped for; after "made her" the verb is bare, so the page '
      + 'writes "she was met with" or "what she met with was", never "made her met with"',
  },
  // CLASS ONE HUNDRED SIXTY-SIX (TianqiChen6665, 2026-09-26): 在隙中得以窥见
  // 有被她治愈的人 shipped as "caught a glimpse through the gaps of those she
  // had comforted", the gaps read as belonging to the people seen through them.
  {
    term: '在隙中',
    renderings: [
      'through the gap',
      'through the narrow gap',
    ],
    refusedForms: [
      'gaps of those',
      'gap of those',
    ],
    why: 'looking out through a narrow opening; the gap is the viewer\'s, so the page writes "glimpsed, through the '
      + 'gap, those she had comforted", never "through the gaps of those"',
  },
];

//endregion Grammar renderings

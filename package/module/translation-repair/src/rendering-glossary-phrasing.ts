import type { CommunityTerm, } from './community-glossary.ts';

//region Phrasing renderings
// CLASS ONE HUNDRED TWENTY-NINE (shi_Yumiaoya30, 2026-09-25): 原因是多方面的
// shipped as "There were many sides to the cause", 这个特例 as "this
// exception, Yumiao, received", 摆烂 as "turned to one of giving up",
// 陷入癫狂 as "pushed her mental state into madness" and 万千世界 as "this
// myriad world". 陷入癫狂 keys on the verb, since XingZ60 writes 癫狂 alone
// for an outlook others call mad; lxy writes 偶尔摆烂 for taking it easy.
// Kept beside `rendering-glossary.ts`, which spreads these entries into
// `RENDERING_GLOSSARY`, so neither file outgrows the line budget.

/**
 Phrasings the pinned corpus carries whose word-for-word rendering reads
 badly in English, with the English the page uses.
 */
export const PHRASING_GLOSSARY: readonly CommunityTerm[] = [
  {
    term: '原因是多方面的',
    renderings: [
      'had many causes',
      'had more than one cause',
      'many things led to',
    ],
    refusedForms: [
      'many sides to the cause',
      'many-sided',
      'multifaceted cause',
      'multi-faceted cause',
      'many aspects to the cause',
    ],
    why: 'a death or event with several causes; the page says it "had many causes", never that the cause had "sides"',
  },
  {
    term: '特例',
    renderings: [
      'as an exception',
      'an exception',
      'made an exception',
    ],
    refusedForms: [
      'this exception,',
      'this special case,',
      'the special case,',
    ],
    why: 'someone let off the usual rule; the page says "Yumiao, as an exception," never "this exception, Yumiao,"',
  },
  {
    term: '摆烂',
    renderings: [
      'stopped trying',
      'gave up',
      'let things slide',
      'took it easy',
    ],
    refusedForms: [
      'one of giving up',
      'state of giving up',
      'giving-up state',
      'slacked off',
      'slacking off',
      'slack off',
      'bailan',
    ],
    why: 'internet slang for no longer making an effort; the page writes the plain verb ("she stopped trying"), '
      + 'never an attitude "of giving up" and never the English slang "slacked off"',
  },
  {
    term: '陷入癫狂',
    renderings: [
      'drove her to the edge of madness',
      'drove her half mad',
      'to the brink of madness',
    ],
    refusedForms: [
      'mental state into madness',
      'mental state into insanity',
      'mental state into a frenzy',
      'mental state into mania',
    ],
    why: 'grief or shock that unhinges someone; the page says it drove her to the edge of madness, never that it '
      + 'pushed a "mental state" into madness',
  },
  {
    term: '万千世界',
    renderings: [
      'this vast world',
      'the wide world',
      'the whole wide world',
    ],
    refusedForms: [
      'myriad world',
      'ten thousand worlds',
      'thousands of worlds',
    ],
    why: 'the world in all its variety; "myriad" before a singular noun is not English, so the page says "this vast world"',
  },
];

//endregion Phrasing renderings

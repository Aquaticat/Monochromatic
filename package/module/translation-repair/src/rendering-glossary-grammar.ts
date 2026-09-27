import type { CommunityTerm, } from './community-glossary.ts';

//region Grammar renderings
// CLASS ONE HUNDRED SIXTY-ONE (TianqiChen6662, 2026-09-26): 化作一个小小的盒子
// shipped as the archive's "turned into in a small box", which no lane
// repaired. The refused form is ungrammatical wherever the word stands, so
// keying it on the word refuses no sound English. Kept beside
// `rendering-glossary.ts`, which spreads these entries into
// `RENDERING_GLOSSARY`, so neither file outgrows the line budget.
//
// THE GLOSSARY AUDIT OF 2026-09-27 took out the entries here keyed on one
// sentence's grammar (被她治愈, 应该会有更好的生活, 遇到的却是, 在隙中,
// 一切都会有机会, 离开我们的时候, 所以她是个): none is a word, and each
// lesson (a bare verb after make, a tag that matches its clause, a phrase on
// the noun it describes, the speaker's point of view, the house past tense)
// now stands as a rule in `english-usage-policy.ts` or the house tense rule.

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
];

//endregion Grammar renderings

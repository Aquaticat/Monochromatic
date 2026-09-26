import type { CommunityTerm, } from './community-glossary.ts';

//region Game slang renderings
// CLASS ONE HUNDRED SIXTY-SEVEN (TianqiChen6665, 2026-09-26): the farewell's
// 这次的 uno，真的加了很多呢 shipped as the archive's "the game of Uno, truly,
// we've added a lot", which says nothing in English. In UNO, 加 is stacking
// the +2 and +4 draw cards on the next player. The pinned corpus carries the
// line on one entry. Kept beside `rendering-glossary.ts`, which spreads these
// entries into `RENDERING_GLOSSARY`, so neither file outgrows the line budget.

/**
 Game slang the pinned corpus carries whose word-for-word rendering says
 nothing in English, with the English the page uses.
 */
export const SLANG_GLOSSARY: readonly CommunityTerm[] = [
  {
    term: 'uno，真的加了很多',
    renderings: [
      'draw cards',
      'piled up',
      '+2 and +4 cards',
    ],
    refusedForms: [
      'added a lot',
    ],
    why: 'in UNO, 加 is stacking the +2 and +4 draw cards on the next player; the page says the draw cards really '
      + 'piled up this time, never that someone "added a lot"',
  },
];

//endregion Game slang renderings

import type { CommunityTerm, } from './community-glossary.ts';

//region Medical renderings
// CLASS ONE HUNDRED SIXTY-TWO (TianqiChen6663, 2026-09-26): 身患II型糖尿病
// shipped as the archive's "type II diabetes". The Roman numeral is a dated
// form; current English, Diabetes Canada's among it, writes "type 2
// diabetes". The pinned corpus carries the term on one entry, in the Latin
// capitals II. Kept beside `rendering-glossary.ts`, which spreads these
// entries into `RENDERING_GLOSSARY`, so neither file outgrows the line budget.

/**
 Medical terms the pinned corpus carries whose English the page writes in a
 dated form, with the form current English uses.
 */
export const MEDICAL_GLOSSARY: readonly CommunityTerm[] = [
  {
    term: 'II型糖尿病',
    renderings: [
      'type 2 diabetes',
    ],
    refusedForms: [
      'type ii diabetes',
      'type-ii diabetes',
    ],
    why: 'the common adult-onset diabetes; current English writes the type with an Arabic numeral, "type 2 diabetes", '
      + 'never the dated "type II"',
  },
];

//endregion Medical renderings

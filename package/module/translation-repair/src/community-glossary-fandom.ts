import type { CommunityTerm, } from './community-glossary.ts';

//region Fandom glossary
// CLASS ONE HUNDRED SIXTY (TianqiChen6662, 2026-09-26): a kigurumi performer's
// page shipped 头壳 (the performer's head mask) as "inside her head", the
// wearer's own head, and 阿洛娜 and 亚托莉 as the archive's "Alona and
// Atori"; no candidate on the run wrote the characters' official names, Arona
// of Blue Archive and Atri of ATRI -My Dear Moments-. The archive renders 头壳
// "headpiece" on the same page, so that rendering leads. Kept beside
// `community-glossary.ts`, which spreads these entries into
// `COMMUNITY_GLOSSARY`, so neither file outgrows the line budget. Refused forms
// match as lower-cased substrings, and each applies only where the source
// carries its term.

/**
 Fandom words and character names the pinned corpus carries, with the English
 the fandom uses.
 */
export const FANDOM_GLOSSARY: readonly CommunityTerm[] = [
  {
    term: '头壳',
    renderings: [
      'headpiece',
      'kigurumi head',
      'mask',
    ],
    refusedForms: [
      'inside her head',
      'inside his head',
      'inside their head',
    ],
    why: 'a kigurumi performer\'s full head mask; the archive renders it "headpiece", and "her head" reads it as '
      + 'the wearer\'s own head',
  },
  {
    term: '阿洛娜',
    renderings: ['Arona',],
    refusedForms: ['alona',],
    why: 'Arona, the guide character of the game Blue Archive; the official English name, never a transliteration',
  },
  {
    term: '亚托莉',
    renderings: ['Atri',],
    refusedForms: ['atori',],
    why: 'Atri, the robot heroine of ATRI -My Dear Moments-; the official English name, never a transliteration',
  },
];

//endregion Fandom glossary

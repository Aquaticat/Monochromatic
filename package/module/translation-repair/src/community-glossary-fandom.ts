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
  // CLASS ONE HUNDRED SEVENTY-EIGHT (TianqiChen66610, 2026-09-26): the archive
  // glossed the performer's "high-performance robot" image as "a cute
  // character she cosplayed as"; the owner named the character, Atri, whose
  // catchphrase the phrase is.
  {
    term: '高性能机器人',
    renderings: ['high-performance robot',],
    refusedForms: [],
    why: 'Atri\'s own description of herself in ATRI -My Dear Moments- (her catchphrase "Because I\'m '
      + 'high-performance!"); a performer remembered as the "high-performance robot" is remembered as her Atri, so '
      + 'a note naming Atri is the reference, not an addition',
  },
  // CLASS ONE HUNDRED EIGHTY-FOUR (TianqiChen66616, 2026-09-27): 变娃娃 shipped
  // as "in this game of becoming a doll" and 被她治愈 as "those she had
  // healed". Kigurumi players call putting on the costume 变娃 (a Chinese
  // report on the hobby: 偶装玩家会将穿上偶装称作"变娃"); English "doll up"
  // means dressing smartly, so it is refused. 治愈 refuses nothing, since
  // "healed her heart" is English too; the why names the sense.
  {
    term: '变娃',
    renderings: [
      'put on the kigurumi',
      'in kigurumi',
      'became the doll',
    ],
    refusedForms: [
      'dolled up',
      'dolling up',
    ],
    why: 'kigurumi players\' word for putting on the costume (head, bodysuit) and becoming the character, who '
      + 'then stays silent; not a game, and never "doll up", which in English means dressing smartly',
  },
  {
    term: '治愈',
    renderings: [
      'comforted',
      'cheered up',
      'lifted the spirits of',
      'cured',
    ],
    refusedForms: [],
    why: 'of people or feelings, the comfort a person or a work gives (治愈系, "healing" in the fan sense): the '
      + 'people she comforted, not the people she healed, which reads as curing a wound; "cured" only where the '
      + 'passage speaks of an illness',
  },
];

//endregion Fandom glossary

import type { CommunityTerm, } from './community-glossary.ts';

//region Idiom renderings
// CLASS ONE HUNDRED THIRTY (shi_Yumiaoya31, 2026-09-25): 三剑客汽车节目
// shipped as "the Three Musketeers car show", 燃油车 as "a fuel-powered car",
// 喘不过气 as "left her breathless", 密密麻麻的伤痕 as "densely packed scars",
// 志愿填写 as "her application preferences", 命运的齿轮 as "the gears of fate",
// 相关医院 as "the relevant hospitals", 巨大的影响 as "an enormous influence on
// her death" and 贴贴计划 as "her cuddling plan". Every term appears in the
// pinned corpus on that entry alone. Kept beside `rendering-glossary.ts`, which
// spreads these entries into `RENDERING_GLOSSARY`, so neither file outgrows the
// line budget.

/**
 Idioms and set phrases the pinned corpus carries whose word-for-word
 rendering reads badly in English, with the English the page uses.
 */
export const IDIOM_GLOSSARY: readonly CommunityTerm[] = [
  {
    term: '三剑客',
    renderings: [
      'the Top Gear trio',
      'Clarkson, Hammond and May',
      'the three presenters',
    ],
    refusedForms: [
      'three musketeers',
      'three swordsmen',
      'sanjianke',
    ],
    why: 'the three presenters of Top Gear and The Grand Tour; English viewers call them "the Top Gear trio", never '
      + '"the Three Musketeers"',
  },
  {
    term: '燃油车',
    renderings: [
      'gas-powered car',
      'gasoline car',
      'gas car',
    ],
    refusedForms: [
      'fuel-powered car',
      'fuel powered car',
      'fuel car',
      'fuel vehicle',
      'fuel-burning car',
      // Class one hundred thirty-two: "petrol" is British; the page is Canadian.
      'petrol car',
      'petrol-powered',
    ],
    why: 'a car with a gasoline engine, the kind being phased out; Canadian English says "a gas-powered car", never '
      + '"a fuel-powered car" or the British "petrol car"',
  },
  {
    term: '喘不过气',
    renderings: [
      'crushing',
      'could barely breathe',
      'overwhelmed',
    ],
    refusedForms: [
      'breathless',
      'out of breath',
    ],
    why: 'pressure so heavy it smothers; "breathless" in English means excited or winded, so the page says the pressure '
      + 'was crushing or that she could barely breathe under it',
  },
  {
    term: '密密麻麻',
    renderings: [
      'covered in scars',
      'a mass of scars',
      'thick with scars',
    ],
    refusedForms: [
      'densely packed',
      'densely-packed',
      'dense scars',
    ],
    why: 'so many that they crowd together; the page says her arms were covered in scars, never "densely packed scars"',
  },
  {
    term: '志愿填写',
    renderings: [
      'university applications',
      'choice of universities',
      'university choices',
    ],
    refusedForms: [
      'application preferences',
      'preference form',
      'volunteer form',
      'wish form',
    ],
    why: 'listing the universities a gaokao candidate applies to; the page says she made a mistake on her university '
      + 'applications, never her "application preferences"',
  },
  {
    term: '命运的齿轮',
    renderings: [
      'wheels of fate',
      'wheel of fate',
    ],
    refusedForms: [
      'gears of fate',
      'gear of fate',
      'cogs of fate',
      'gears of destiny',
    ],
    why: 'the moment a life\'s course is set; the English idiom is "the wheels of fate began to turn", never "gears"',
  },
  {
    term: '相关医院',
    renderings: [
      'hospital treatment',
      'treatment in hospital',
      'psychiatric treatment',
    ],
    refusedForms: [
      'relevant hospital',
      'related hospital',
    ],
    why: '相关 here only says the hospitals suited to her illness; the page says she sought hospital treatment, never '
      + '"the relevant hospitals"',
  },
  {
    term: '巨大的影响',
    renderings: [
      'played a large part in',
      'played a big part in',
      'had a great deal to do with',
    ],
    refusedForms: [
      'influence on her death',
      'influence on his death',
      'influence on their death',
      'impact on her death',
      'effect on her death',
    ],
    why: 'people who helped bring about a death; English says they "played a large part in her death", never that '
      + 'they had an "influence on" it',
  },
  {
    term: '贴贴计划',
    renderings: [
      'cuddle meetups',
      'cuddle tour',
      'meetups to hug',
    ],
    refusedForms: [
      'cuddling plan',
      'cuddle plan',
      'sticking plan',
      'tietie',
    ],
    why: 'her project of meeting community friends across the country for hugs; the page names the meetups, never a '
      + '"cuddling plan"',
  },
  // CLASS ONE HUNDRED FIFTY-SEVEN (aiyysk1, 2026-09-26): 樱奈以生命相逼 shipped as
  // "Sakurana threatened her life", which reads as a threat against the other
  // girl; the friend staked her own life ("If I find out, I'll kill myself").
  // The archive wrote "threatened her in return". The pinned corpus carries
  // the idiom once, on aiyysk.
  {
    term: '以生命相逼',
    renderings: [
      'threatened to take her own life',
      'threatened to kill herself',
      'used her own life as leverage',
    ],
    refusedForms: [
      'threatened her life',
      'threatened his life',
      'threatened their life',
      'threatening her life',
    ],
    why: 'someone who stakes their own life to stop another, threatening to kill themselves; "threatened her life" '
      + 'says the other person\'s life was threatened',
  },
];

//endregion Idiom renderings

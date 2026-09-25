import type { CommunityTerm, } from './community-glossary.ts';

//region Wording renderings
// CLASS ONE HUNDRED THIRTY-ONE (shi_Yumiaoya32, 2026-09-25): 辅导员 shipped as
// "her counselor" (a therapist to an English reader), 矫正机构 as "a
// correctional facility" (a prison), 主动提出 as "took the initiative to
// propose", 营救计划 as "a rescue plan", ICU 抢救了六天 as "six days of
// resuscitation in the ICU", 代替鱼喵的视角 as "replace Yumiao's perspective"
// and 性格非常好的人 as "a person of such a good nature". 抢救 alone stands in
// thirteen pinned entries, one of them a joke meaning "salvage", so only the
// ICU form is seeded; 代替 stands in two, and only the perspective calque is
// refused. Kept beside `rendering-glossary.ts`, which spreads these entries
// into `RENDERING_GLOSSARY`, so neither file outgrows the line budget.

/**
 Wording in accounts of events whose word-for-word rendering misleads or reads
 badly in English, with the English the page uses.
 */
export const WORDING_GLOSSARY: readonly CommunityTerm[] = [
  {
    term: '辅导员',
    renderings: [
      'student advisor',
      'student affairs advisor',
      'academic advisor',
    ],
    refusedForms: [
      'counselor',
      'counsellor',
    ],
    why: 'a Chinese university\'s student affairs officer, not a therapist; "counsellor" tells an English reader she '
      + 'was seeing one, so the page says "student advisor", the Canadian spelling of the role',
  },
  {
    term: '矫正机构',
    renderings: [
      'behaviour-correction centre',
      'behaviour-correction camp',
      'correction camp',
    ],
    refusedForms: [
      'correctional facility',
      'correctional institution',
      'correctional center',
      'correctional centre',
    ],
    why: 'a private institution that claims to correct behaviour, not a prison; "correctional facility" in English '
      + 'is a prison, so the page says "behaviour-correction centre"',
  },
  {
    term: '主动提出',
    renderings: [
      'was the one who suggested',
      'was the one to suggest',
      'was the one who asked',
    ],
    refusedForms: [
      'took the initiative to propose',
      'took the initiative to suggest',
      'proactively proposed',
    ],
    why: 'she raised it herself; the page says she "was the one who suggested" it, never that she "took the '
      + 'initiative to propose" it',
  },
  {
    term: '营救',
    renderings: [
      'efforts to free',
      'campaign to free',
      'get her released',
    ],
    refusedForms: [
      'rescue plan',
      'rescue operation',
    ],
    why: 'work to get a detained friend released; "rescue plan" reads as a raid, so the page says "efforts to free" '
      + 'or "a campaign to free"',
  },
  {
    term: 'ICU 抢救',
    renderings: [
      'in intensive care',
      'doctors fought to save',
      'emergency treatment in the ICU',
    ],
    refusedForms: [
      'days of resuscitation',
    ],
    why: 'days of emergency care after an attempt; resuscitation is a matter of minutes, so the page says she spent '
      + 'the days in intensive care or that doctors fought to save her',
  },
  {
    term: '代替',
    renderings: [
      'in her place',
      'in place of',
      'through her eyes',
    ],
    refusedForms: [
      'replace her perspective',
      'replace his perspective',
      'replace their perspective',
      'replace yumiao\'s perspective',
      'replace yumiao’s perspective',
    ],
    why: 'a keepsake that goes on seeing for the dead; the page says the camera "will look on the world in her '
      + 'place", never that it will "replace her perspective"',
  },
  {
    term: '性格非常好',
    renderings: [
      'very good-natured',
      'had a lovely nature',
      'so good-natured',
    ],
    refusedForms: [
      'of such a good nature',
    ],
    why: 'praise of her temperament; the page says she "was very good-natured", never "a person of such a good nature"',
  },
  // CLASS ONE HUNDRED THIRTY-THREE (shi_Yumiaoya34, 2026-09-25): 人生中的第一颗补佳乐
  // shipped as "the first Progynova of her life" and 精神已留下了巨大的创伤 as "her
  // mind had already been left with great trauma". Each term stands in one pinned
  // entry, so the refused forms are read only on that page's paragraphs.
  {
    term: '人生中的第一颗',
    renderings: [
      'her very first',
      'her first-ever',
    ],
    refusedForms: [
      'of her life',
      'of his life',
      'of its life',
    ],
    why: 'the first pill she ever took; "the first Progynova of her life" is word for word, so the page says she took '
      + '"her very first" Progynova',
  },
  {
    term: '留下了巨大的创伤',
    renderings: [
      'left her deeply traumatized',
      'deeply traumatized',
      'left deep scars',
    ],
    refusedForms: [
      'left with great trauma',
      'left with a huge trauma',
      'great trauma',
      'huge trauma',
    ],
    why: 'the arrest left her badly hurt in mind; "left with great trauma" is word for word, so the page says it '
      + '"left her deeply traumatized"',
  },
];

//endregion Wording renderings

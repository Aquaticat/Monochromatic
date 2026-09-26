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
  // CLASS ONE HUNDRED THIRTY-FOUR (hulicaijia19, 2026-09-25): 药代 shipped as
  // "In her role as a pharmaceutical sales representative", the general sense
  // of the abbreviation (医药代表), where the page means she resold medication
  // to others. It stands in one pinned entry.
  {
    term: '药代',
    renderings: [
      'sold medication',
      'selling medication',
      'medication seller',
    ],
    refusedForms: [
      'pharmaceutical sales representative',
      'pharmaceutical sales rep',
      'pharmaceutical representative',
      'medical representative',
      'sales representative',
    ],
    why: 'in the community, someone who buys medication and resells it to others; the general abbreviation of '
      + '医药代表 ("pharmaceutical sales representative") misreads it, so the page says she sold medication',
  },
  // CLASS ONE HUNDRED THIRTY-FIVE (hulicaijia20, 2026-09-25): the closing
  // quote shipped 豆花 as "tofu pudding" while the front matter (published as
  // the archive has it), the archive and every other slice wrote "douhua",
  // so one food stood under two names on one page. The corpus writes 豆花 on
  // that page alone; MocaKawai's "tofu pudding" glosses 豆腐脑, another word,
  // which this entry never reads.
  {
    term: '豆花',
    renderings: ['douhua',],
    refusedForms: [
      'tofu pudding',
      'tofu flower',
      'bean curd pudding',
      'soybean pudding',
      'tofu custard',
    ],
    why: 'the page names the dish "douhua" in its front matter and throughout, and a second name for it on the same '
      + 'page reads as a second food',
  },
  // CLASS ONE HUNDRED FORTY (XingZ6012, 2026-09-26): the song credit
  // 「——来自《笼中之鸟》，作者 洁澄天奏Official」 shipped "——from “Bird in a
  // Cage”…, author Jiecheng Tianzou Official", where XingZ6011 and XingZ623
  // wrote "by". The term is the credit form with its comma: 作者 alone also
  // stands inside 社会工作者 ("social worker") on GLaDOSister, and the one
  // other pinned 「，作者」 opens a footnote whose subject is the author, which
  // renders "the author" and never ", author ".
  {
    term: '，作者',
    renderings: [
      'by',
      'written by',
    ],
    refusedForms: [', author ',],
    why: 'a credit line\'s 作者 names who made the work, and an English credit says "by" before the maker; '
      + '", author" before a name is word for word',
  },
  // CLASS ONE HUNDRED FIFTY-FIVE (shi_Yumiaoya38, 2026-09-26): the father's
  // insult 「逆子」——耻辱，没本事 shipped "a disgrace, someone with no
  // capability", word for word, where shi_Yumiaoya37 wrote "a failure". The
  // pinned corpus carries 没本事 once, in that insult, with no archive English.
  {
    term: '没本事',
    renderings: [
      'good-for-nothing',
      'useless',
      'a failure',
      'worthless',
    ],
    refusedForms: [
      'no capability',
      'no capabilities',
      'without capability',
      'lacking capability',
    ],
    why: 'a parent\'s insult for a child who will amount to nothing; an English parent says "good-for-nothing" or '
      + '"useless", and "no capability" is word for word',
  },
  // CLASS ONE HUNDRED FIFTY-SIX (shihai4h1, 2026-09-26): 初中 shipped as
  // "junior middle school", 自考 as "self-taught exams" and 压力话 as
  // "subjected to pressured remarks". 初中 stands in five pinned entries, and
  // four of the five archive passages that render it write "junior high
  // school"; shihai4h's archive alone writes "junior middle school". 自考 and
  // 压力话 stand on shihai4h alone, with no archive English.
  {
    term: '初中',
    renderings: [
      'junior high school',
      'junior high',
      'middle school',
    ],
    refusedForms: ['junior middle school',],
    why: 'the three school years before senior high; a Canadian reader knows them as "junior high", and "junior middle '
      + 'school" is word for word',
  },
  {
    term: '自考',
    renderings: [
      'self-study examinations',
      'self-study exams',
      'self-study degree exams',
    ],
    refusedForms: [
      'self-taught exam',
      'self-taught examination',
    ],
    why: 'short for 高等教育自学考试, the state examinations that grant a degree to someone who studied on their own; '
      + 'their English name is "self-study examinations", and an exam is never "self-taught"',
  },
  {
    term: '压力话',
    renderings: [
      'pressured',
      'nagged',
      'pressure',
    ],
    refusedForms: [
      'pressured remarks',
      'pressure remarks',
      'pressure words',
      'pressuring words',
    ],
    why: 'remarks meant to push someone into line; English says she was pressured or nagged, and "pressured remarks" '
      + 'is word for word',
  },
];

//endregion Wording renderings

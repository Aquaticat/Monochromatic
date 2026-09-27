import type { CommunityTerm, } from './community-glossary.ts';

//region Wording renderings
// CLASS ONE HUNDRED THIRTY-ONE (shi_Yumiaoya32, 2026-09-25): 辅导员 shipped as
// "her counselor" (a therapist to an English reader), 矫正机构 as "a
// correctional facility" (a prison), 营救计划 as "a rescue plan" and ICU
// 抢救了六天 as "six days of resuscitation in the ICU". Kept beside
// `rendering-glossary.ts`, which spreads these entries into
// `RENDERING_GLOSSARY`, so neither file outgrows the line budget.
//
// THE GLOSSARY AUDIT OF 2026-09-27 took out the entries here keyed on one
// sentence's words rather than a word (主动提出, 代替, 性格非常好,
// 人生中的第一颗, 留下了巨大的创伤, and the credit form ，作者); their lessons are
// the idiomatic English and credit rules of `english-usage-policy.ts`. It
// seeded 抢救 as the word where ICU 抢救 held one sentence's collocation (抢救
// stands in thirteen pinned entries, one of them a joke meaning "salvage"),
// and dropped 营救's refused forms, since a rescue operation is the English
// for 营救 wherever the rescue is one.

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
    term: '营救',
    renderings: [
      'rescue',
      'efforts to free',
      'campaign to free',
    ],
    refusedForms: [],
    why: 'a rescue; where the person is detained, the rescue is the work to get them released, and English says '
      + '"efforts to free" her or "a campaign to free" her, since "a rescue plan" reads as a raid',
  },
  {
    term: '抢救',
    renderings: [
      'emergency treatment',
      'intensive care',
      'doctors fought to save',
    ],
    refusedForms: [],
    why: 'emergency medical treatment to save a life, which can run for hours or days; English says emergency '
      + 'treatment or intensive care, and "resuscitation" only for the minutes of reviving someone; said of a thing, '
      + 'it is salvaging it',
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

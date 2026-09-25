import {
  type CommunityTerm,
  communityTermLines,
} from './community-glossary.ts';

//region Rendering glossary
// CLASS ONE HUNDRED TWENTY-THREE (shi_Yumiaoya23, 2026-09-25). The page
// shipped 师范学院 as "a normal college" and 觉醒了学霸属性 as "awakened her
// top-student trait": word-for-word renderings an English reader stumbles on,
// chosen by judges who had nothing telling them the ordinary English. The
// owner answered on 2026-09-25 that anything which can be translated better
// should be. This glossary holds ordinary Chinese words, not the community's
// own (`community-glossary.ts`), with the English the page uses and the
// calques a candidate may not write. It shares the community glossary's
// machinery: the words an entry's source carries reach every sheet's identity
// context (`renderingTermLines`), and the source-carry floor refuses a
// candidate that keeps one in Han or writes a refused form
// (`translate-source-carry.ts`). An entry is added whenever a read finds a
// rendering that can be better; an official name that carries a word (北京师范
// 大学, "Beijing Normal University") is never entered, only the generic word.

/**
 Ordinary words the pinned corpus carries whose word-for-word rendering reads
 badly in English, with the English the page uses.
 */
export const RENDERING_GLOSSARY: readonly CommunityTerm[] = [
  {
    term: '师范学院',
    renderings: [
      'teachers\' college',
      'teachers college',
      'teacher-training college',
    ],
    refusedForms: [
      'normal college',
    ],
    why: 'a generic college that trains teachers; "normal college" is a calque English readers do not '
      + 'recognise, kept only inside an institution\'s own official English name',
  },
  {
    term: '师范学校',
    renderings: [
      'teacher-training school',
      'teachers\' school',
      'teachers\' college',
    ],
    refusedForms: [
      'normal school',
    ],
    why: 'a generic school that trains teachers; "normal school" is a dated calque English readers do not '
      + 'recognise',
  },
  {
    term: '学霸',
    renderings: [
      'top student',
      'star student',
      'straight-A',
    ],
    refusedForms: [
      'top-student trait',
      'top student trait',
      'academic tyrant',
      'study tyrant',
      'xueba',
    ],
    why: 'a student who excels academically; 觉醒了学霸属性 is internet slang for suddenly becoming a top '
      + 'student, so the page says that, never that she "awakened" a "trait" or "attribute"',
  },
  // CLASS ONE HUNDRED TWENTY-FIVE (shi_Yumiaoya25, 2026-09-25): 滑档二本
  // shipped as "slid down into a second-tier admission slot" and 用这种方式告诉
  // as "using this way to tell". Each form appears once in the pinned corpus.
  {
    term: '二本',
    renderings: [
      'second-tier university',
      'second-tier college',
      'second-tier school',
    ],
    refusedForms: [
      'admission slot',
      'second batch',
      'erben',
    ],
    why: 'the second tier of Chinese universities, admitted by gaokao score after the first tier (一本); the '
      + 'page names the kind of university, never the admission batch or slot',
  },
  {
    term: '滑档',
    renderings: [
      'missed her chosen schools',
      'fell through to',
      'ended up at',
    ],
    refusedForms: [
      'slid down',
      'slid into',
      'slid to',
      'slipped to',
      'slipped into',
      'slipped a file',
      'sliding file',
      'huadang',
    ],
    why: 'a gaokao applicant whose score met none of the schools she applied to and who was placed at a lower '
      + 'tier; the page says she missed her chosen schools and ended up at the lower-tier one',
  },
  {
    term: '用这种方式',
    renderings: [
      'this was her way of',
      'in this way',
      'by doing so',
    ],
    refusedForms: [
      'using this way to',
      'use this way to',
      'used this way to',
      // shi_Yumiaoya26 wrote the same calque with another noun.
      'using this method to',
      'use this method to',
      'used this method to',
    ],
    why: '"use this way to" is not English and "use this method to" is the same calque; the page writes "this was her way of telling" or "in this way"',
  },
  // CLASS ONE HUNDRED TWENTY-SIX (shi_Yumiaoya27, 2026-09-25): 年级组长
  // shipped as "the grade leader", 未成年药娘 as "a minor trans girl", 骨灰骰子
  // as "ash dice", 同居者 as "cohabitants" and 精神霸凌 as plain "bullied".
  {
    term: '年级组长',
    renderings: [
      'head of year',
      'year head',
      'grade director',
    ],
    refusedForms: [
      'grade leader',
      'grade group leader',
      'grade team leader',
    ],
    why: 'the teacher in charge of a whole school year; "grade leader" is a calque English readers do not know',
  },
  {
    term: '未成年',
    renderings: [
      'underage',
      'under eighteen',
      'a minor',
    ],
    refusedForms: [
      'minor trans',
      'minor girl',
      'minor boy',
    ],
    why: '"a minor" is English as a noun, but before another noun ("a minor trans girl") it reads as "unimportant"; '
      + 'the page writes "an underage trans girl"',
  },
  {
    term: '骨灰骰子',
    renderings: [
      'dice made from the ashes',
      'memorial dice made from the ashes',
    ],
    refusedForms: [
      'ash dice',
      'ashes dice',
    ],
    why: 'dice made with a person\'s cremated ashes as a keepsake; "ash dice" reads as dice made of ash from anything',
  },
  {
    term: '同居者',
    renderings: [
      'housemate',
      'roommate',
      'flatmate',
    ],
    refusedForms: [
      'cohabitant',
      'cohabiter',
    ],
    why: 'someone she shared a home with; "cohabitant" says a romantic partner, which the original does not',
  },
  {
    term: '精神霸凌',
    renderings: [
      'psychologically bullied',
      'emotionally bullied',
      'psychological bullying',
    ],
    refusedForms: [
      'spiritually bull',
      'spiritual bull',
    ],
    why: 'bullying by words and pressure rather than by force; the page keeps the adjective ("psychologically '
      + 'bullied"), never "spiritual"',
  },
];

/**
 Identity-context lines for the ordinary words an entry's source carries,
 under a heading that does not call them the community's.

 @param text - whole original document

 @returns Heading and one line per word present, empty when none is

 @example
 ```ts
 const lines = renderingTermLines({ text: sourceText, },);
 ```
 */
export function renderingTermLines(
  { text, }: { readonly text: string; },
): readonly string[] {
  return communityTermLines({
    text,
    glossary: RENDERING_GLOSSARY,
    heading: 'RENDERINGS for ordinary words this entry carries: write the English meaning, not a word-for-word calque '
      + '(a rendering may inflect):',
  },);
}

/**
 Identity-context lines for both glossaries: the community's words an entry
 carries (the owner's decision of 2026-09-09), then the ordinary words whose
 calque reads badly.

 @param text - whole original document

 @returns Both glossaries' headed lines, each empty when the entry carries
 none of its words

 @example
 ```ts
 const lines = glossaryTermLines({ text: sourceText, },);
 ```
 */
export function glossaryTermLines(
  { text, }: { readonly text: string; },
): readonly string[] {
  return [
    ...communityTermLines({ text, },),
    ...renderingTermLines({ text, },),
  ];
}

//endregion Rendering glossary

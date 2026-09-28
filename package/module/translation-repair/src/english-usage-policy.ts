//region English usage policy
// THE GLOSSARY AUDIT OF 2026-09-27. Class one hundred eighty-three keyed a
// rendering-glossary entry on a sentence's own words (kigurumi的记忆结束), and
// the owner answered that a sentence fragment is not a dictionary keyword and
// that every other entry with the same problem be fixed too. Twenty-three
// entries were keyed on one sentence's construction, grammar or pronoun
// (用这种方式, 原因是多方面的, 被她治愈, 在隙中, 离开我们的时候, ，作者, the UNO
// line and the rest; the list stands in `glossary-dictionary-terms.unit.test.ts`).
// Each taught a general lesson, and the rules below state those lessons for
// every sheet, since a rule reaches the next page's sentence where an entry
// keyed on one sentence's words never fires again. `house-policy.ts` splices
// them into its bullets.

/**
 A clause keeps its subject (class one hundred eighty-three, TianqiChen66614:
 "when I leave you all, they will end with the memories of kigurumi" for a
 clause whose subject is 我).

 @example
 ```ts
 const bullet = `Pronouns follow ... ${KEPT_SUBJECT_RULE}`;
 ```
 */
export const KEPT_SUBJECT_RULE: string =
  'A clause keeps the subject the ORIGINAL writes: where 我 (or a named person) does something, the English makes I (or that person) the one who does it, and never hands the verb to another subject (they, the memories, the page) to make the sentence smoother; the English already on the page moving a subject is a mistranslation to correct, not a reading to keep.';

/**
 Idiomatic English over the Chinese construction, the lesson of the entries
 keyed on one sentence's phrasing (classes one hundred twenty-five,
 twenty-nine, thirty, thirty-one, thirty-three, fifty-nine and seventy).

 @example
 ```ts
 const bullet = `- ${IDIOMATIC_ENGLISH_RULE}`;
 ```
 */
export const IDIOMATIC_ENGLISH_RULE: string =
  'The English says what the ORIGINAL means the way an English writer would say it, never the Chinese construction word for word. A rendering that follows the Chinese construction into English no one writes is a mistranslation however faithful each word looks: a stock phrase takes the English stock phrase for the same meaning; a word takes the sense its context gives it rather than its first dictionary gloss (the place someone lived is their surroundings, not the environment); a word the Chinese construction needs and English does not (相关 before a noun, 巨大的 before an effect) is said plainly or left out; and an abstract noun the Chinese makes a subject or object becomes the verb or adjective English uses (it had many causes, not there were many sides to the cause; she was good-natured, not a person of such a good nature). The English already on the page carrying such a construction is a mistranslation to correct, not a reading to keep.';

/**
 Grammatical English, the lesson of the entries keyed on one sentence's
 grammar slip (classes one hundred sixty-one, sixty-four, sixty-six and
 seventy-one). The doubled preposition (class one hundred sixty-one, "turned
 into in a small box") joined it on 2026-09-28 (ledger R5): refused as a
 form keyed on 化作, it also refused sound English whose next phrase opens
 with "in" ("what the kitten turned into in spring").

 @example
 ```ts
 const bullet = `- ${GRAMMATICAL_ENGLISH_RULE}`;
 ```
 */
export const GRAMMATICAL_ENGLISH_RULE: string =
  'Every sentence is grammatical English: a verb after make or let is bare (made her meet, never made her met), a verb\'s preposition is written once before its object (turned into a small box, never turned into in a small box), a tag question matches its clause (she deserved better, didn\'t she), a phrase attaches to the noun it describes, and a pronoun keeps the speaker\'s own point of view (when I leave you all, never when I leave us).';

/**
 A credit names its maker with "by" (class one hundred forty, XingZ6012:
 "author Jiecheng Tianzou Official").

 @example
 ```ts
 const bullet = `A work the ORIGINAL names ... ${CREDIT_BY_RULE}`;
 ```
 */
export const CREDIT_BY_RULE: string =
  'A credit naming who made a work (作者, 词 or 曲 before a name) reads by, lyrics by or music by before the name, never ", author" before it.';

/**
 A game's jargon in that game's English (class one hundred sixty-seven,
 TianqiChen6665: UNO's 加 as "added a lot").

 @example
 ```ts
 const bullet = `The page is plain written English ... ${GAME_JARGON_RULE}`;
 ```
 */
export const GAME_JARGON_RULE: string =
  'A word used as a game\'s or a hobby\'s jargon takes that game\'s English term, never its everyday sense (in UNO, 加 is stacking the draw cards on the next player, not adding).';

//endregion English usage policy

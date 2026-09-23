//region Second-person address the passage carries
// CLASS NINETY-SEVEN (yingying5, 2026-09-23). The original's closing wish
// addresses the deceased directly (愿在你的下一个世界……), the archive wrote
// it in the third person, the repair lane wrote "you" and the translate lane
// copied the archive; the contest tied two to two, the archive's line stood,
// and the gate kept it over the consolidated "you" with one ballot reading
// the Chinese as "she". yingying1 to 4 had shipped the second person. A
// pronoun the ORIGINAL writes is rendered as written where it stands (class
// eighty-one), and a rendering that turns 你 into she or they is refused
// before any judge reads it, as a dropped marker is (class ninety-two). THE
// FLOOR IS NARROW: a greeting (你好) addresses nobody, and a rendering that
// carries no pronoun at all ("Ah, wanna play?" for 干干你的) is left to the
// judges; only a rendering with no second-person pronoun and a third-person
// one in its place fails. The corpus census of 2026-09-23 found 67 of 92
// archive pages carrying 你, and of 31 aligned blocks six without "you": four
// greetings, colloquial drops or misalignments and two person switches.

/**
 Characters that address someone in the second person.
 */
const ADDRESS_CHARACTERS: ReadonlySet<string> = new Set([
  '你',
  '您',
]);

/**
 Character that turns an address character into a greeting.
 */
const GREETING_TAIL = '好';

/**
 English second-person pronouns, lower case.
 */
const SECOND_PERSON: ReadonlySet<string> = new Set([
  'you',
  'your',
  'yours',
  'yourself',
  'yourselves',
]);

/**
 English third-person pronouns, lower case.
 */
const THIRD_PERSON: ReadonlySet<string> = new Set([
  'she',
  'he',
  'her',
  'him',
  'his',
  'hers',
  'herself',
  'himself',
  'they',
  'them',
  'their',
  'theirs',
  'themselves',
]);

/**
 Opening of an HTML comment.
 */
const COMMENT_OPEN = '<!--';

/**
 Closing of an HTML comment.
 */
const COMMENT_CLOSE = '-->';

/**
 Text with its HTML comments cut out, so a comment's words count for
 nothing.

 @param text - passage to strip

 @returns The passage without its comments

 @example
 ```ts
 withoutComments({ text: '<!-- 你 --> 猫', },); // ' 猫'
 ```
 */
export function withoutComments({ text, }: { readonly text: string; },): string {
  /**
   Kept pieces, in order.
   */
  const kept: string[] = [];
  for (let at = 0; at <= text.length;) {
    /**
     Where the next comment opens, -1 for none.
     */
    const open = text.indexOf(
      COMMENT_OPEN,
      at,
    );
    if (open === (-1)) {
      kept.push(text.slice(at,),);
      break;
    }
    kept.push(text.slice(
      at,
      open,
    ),);
    /**
     Where that comment closes, -1 for an unclosed one, which runs to the end.
     */
    const close = text.indexOf(
      COMMENT_CLOSE,
      open + COMMENT_OPEN.length,
    );
    if (close === (-1))
      break;
    at = close + COMMENT_CLOSE.length;
  }
  return kept.join('',);
}

/**
 How many times a passage addresses someone in the second person, greetings
 left out.

 @param text - original passage, comments already cut

 @returns Count of address characters not opening a greeting

 @example
 ```ts
 addressCount({ text: '你好，你来了。', },); // 1
 ```
 */
function addressCount({ text, }: { readonly text: string; },): number {
  /**
   Addresses counted so far.
   */
  let count = 0;
  for (let at = 0; at < text.length; at += 1) {
    if (!ADDRESS_CHARACTERS.has(text.charAt(at,),))
      continue;
    if (text.charAt(at + 1,) === GREETING_TAIL)
      continue;
    count += 1;
  }
  return count;
}

/**
 Whether a character is an ASCII letter.

 @param character - one UTF-16 unit

 @returns True for a to z in either case

 @example
 ```ts
 isAsciiLetter({ character: 'y', },); // true
 ```
 */
function isAsciiLetter({ character, }: { readonly character: string; },): boolean {
  return ((character >= 'a') && (character <= 'z')) || ((character >= 'A') && (character <= 'Z'));
}

/**
 Every run of ASCII letters in a text, lower-cased, so a pronoun is matched
 as a whole word and never inside another.

 @param text - candidate text

 @returns Words in order

 @example
 ```ts
 latinWords({ text: 'May you, yes you!', },); // ['may', 'you', 'yes', 'you']
 ```
 */
function latinWords({ text, }: { readonly text: string; },): readonly string[] {
  /**
   Words found so far.
   */
  const words: string[] = [];
  for (let start = 0; start < text.length; start += 1) {
    if (!isAsciiLetter({ character: text.charAt(start,), },))
      continue;
    /**
     Offset just past this word.
     */
    const end = wordEnd({
      text,
      start,
    },);
    words.push(text.slice(
      start,
      end,
    )
      .toLowerCase(),);
    start = end;
  }
  return words;
}

/**
 Offset just past the run of ASCII letters starting at an offset.

 @param text - text being scanned

 @param start - offset of the run's first letter

 @returns Offset of the first character that is no letter, or the length

 @example
 ```ts
 wordEnd({ text: 'you!', start: 0, },); // 3
 ```
 */
function wordEnd(
  {
    text,
    start,
  }: {
    readonly text: string;
    readonly start: number;
  },
): number {
  for (let at = start; at < text.length; at += 1) {
    if (!isAsciiLetter({ character: text.charAt(at,), },))
      return at;
  }
  return text.length;
}

/**
 Findings for a candidate that renders a passage the original addresses in
 the second person with a third-person pronoun and no second-person one.

 @param sourceText - original slice

 @param candidateText - candidate under validation

 @returns One finding, or none where the address is kept or no pronoun stands
 in its place

 @example
 ```ts
 const findings = droppedAddressFindings({ sourceText: '愿你安好。', candidateText: 'May she be well.', },);
 ```
 */
export function droppedAddressFindings(
  {
    sourceText,
    candidateText,
  }: {
    readonly sourceText: string;
    readonly candidateText: string;
  },
): readonly string[] {
  /**
   How often the original addresses someone, greetings left out.
   */
  const addresses = addressCount({ text: withoutComments({ text: sourceText, },), },);
  if (addresses === 0)
    return [];
  /**
   Words of the candidate outside its comments.
   */
  const words = latinWords({ text: withoutComments({ text: candidateText, },), },);
  if (words.some(function secondPerson(word,): boolean {
    return SECOND_PERSON.has(word,);
  },))
    return [];
  /**
   Third-person pronouns the candidate carries instead.
   */
  const thirdPerson = [...new Set(words.filter(function isThird(word,): boolean {
    return THIRD_PERSON.has(word,);
  },),),];
  if (thirdPerson.length === 0)
    return [];
  /**
   Third-person pronouns quoted for the finding.
   */
  const quoted = thirdPerson
    .map(function quote(word,): string {
      return `"${word}"`;
    },)
    .join(', ',);
  /**
   How often, in words.
   */
  const times = (addresses === 1) ? 'once' : `${String(addresses,)} times`;
  return [
    `Your translation drops the address in the second person the ORIGINAL carries: the ORIGINAL passage writes 你 or 您 ${times}, and your translation carries no "you" but ${quoted} in its place. A pronoun the ORIGINAL writes is rendered as written where it stands: address the person the ORIGINAL addresses.`,
  ];
}

//endregion Second-person address the passage carries

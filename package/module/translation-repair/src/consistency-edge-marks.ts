import { ConsistencyInvariantError, } from './consistency-invariant-error.ts';
import { isClosing, } from './consistency-quote-bounds.ts';
import { continuesLatinWord, } from './latin-letters.ts';

//region Consistency edge marks
// WHICH CHARACTERS AT THE TWO EDGES OF A QUOTE ARE NOT ITS WORDS. A judge copies
// the words of a place's English with the sentence punctuation that closed them
// (`consistency-quote-bounds.ts`), and also with the quotation marks or the
// brackets the English happened to hold around them: `"So she was kind".` and
// `So she was kind` name one span. A mark is an edge mark only where the words
// it encloses do not need it: a quotation mark or a bracket that pairs with one
// INSIDE the quote belongs to the words (`"So she was kind," she said`, `So she
// was (kind)`), since moving the words without the mark would leave the other one
// stranded, and no floor reads quotation marks.
//
// THE FOLD HAS TURNED CURLY QUOTES, SINGLE AND DOUBLE, AND THE CORNER BRACKETS
// INTO THE STRAIGHT ONES (`quote-normalize.ts`), so only the straight marks and
// the ASCII brackets are met here.
//
// AN APOSTROPHE AT A WORD EDGE IS PART OF THE WORD (`'Tis`, `goin'`, `the cats'`).
// A single quotation mark that touches a letter on one side and is neither
// closed nor opened by a mark across the quote stays in the span; one that
// touches no letter is read by counting as before. A pair that encloses the
// whole quote is still trimmed, with an apostrophe inside it left in place
// (`'the cats' bowl'` names `the cats' bowl`).
//
// A FIXED POINT: edges are taken off one character at a time, the words read
// again after each, until neither edge moves. A mark exposed by taking another
// off (`("cat").`) goes too, and every decision reads the words that are left and
// nothing outside them, so the words of a quote that has been read once are
// read again unchanged.

/**
 A bracket pair: an opening bracket and its closing bracket.

 @example
 ```ts
 const pair: BracketPair = { opener: '(', closer: ')', };
 ```
 */
type BracketPair = {
  /**
   The opening bracket.
   */
  readonly opener: string;

  /**
   The closing bracket.
   */
  readonly closer: string;
};

/**
 The bracket pairs the words may hold.
 */
const BRACKET_PAIRS: readonly BracketPair[] = [
  {
    opener: '(',
    closer: ')',
  },
  {
    opener: '[',
    closer: ']',
  },
  {
    opener: '{',
    closer: '}',
  },
];

/**
 The straight quotation marks, which open and close with one character.
 */
const QUOTE_MARKS = '"\'';

/**
 Whether a character is a straight quotation mark.

 @param point - one whole character

 @returns Whether it is a double or a single straight quotation mark

 @example
 ```ts
 const quote = isQuoteMark({ point: '"', },); // true
 ```
 */
function isQuoteMark({ point, }: { readonly point: string; },): boolean {
  return QUOTE_MARKS.includes(point,);
}

/**
 The closing bracket of an opening one, as a list of zero or one.

 @param point - one whole character

 @returns The closing bracket, none when the character opens no bracket pair

 @example
 ```ts
 const [closer,] = closerOf({ point: '(', },); // ')'
 ```
 */
function closerOf({ point, }: { readonly point: string; },): readonly string[] {
  return BRACKET_PAIRS
    .filter(function opensIt({ opener, },): boolean {
      return opener === point;
    },)
    .map(function closerOfPair({ closer, },): string {
      return closer;
    },);
}

/**
 The opening bracket of a closing one, as a list of zero or one.

 @param point - one whole character

 @returns The opening bracket, none when the character closes no bracket pair

 @example
 ```ts
 const [opener,] = openerOf({ point: ')', },); // '('
 ```
 */
function openerOf({ point, }: { readonly point: string; },): readonly string[] {
  return BRACKET_PAIRS
    .filter(function closesIt({ closer, },): boolean {
      return closer === point;
    },)
    .map(function openerOfPair({ opener, },): string {
      return opener;
    },);
}

/**
 The straight single quotation mark, which is also the apostrophe.
 */
const APOSTROPHE = '\'';

/**
 What a quotation mark is among the words.

 `interior` stands between two word characters (the apostrophe of `wasn't`).
 `matched` is a single quotation mark that opens before a letter and is closed
 by a mark after one, or closes after a letter and has an opener before it.
 `apostrophe` is a single quotation mark that touches a letter on one side and
 is neither closed nor opened by a matching mark across the stretch read (the
 `'` of `'Tis`, `goin'` and `the cats'`), so it is part of the word it touches.
 `bare` touches no letter, or is a double quotation mark, and can only pair by
 counting. `absent` marks a position that holds no mark of the kind read.
 */
type MarkRole = 'absent' | 'interior' | 'apostrophe' | 'matched' | 'bare';

/**
 What each quotation mark of one kind in a stretch of the words is: a mark
 between two word characters, a single mark that opens or closes a pair, a
 single mark that is an apostrophe, or a mark that only counts. The roles are
 listed by position among the words, `absent` at every position that holds no
 such mark.

 @param points - the words, one whole character each

 @param from - first position read

 @param to - exclusive position the reading stops at

 @param mark - the quotation mark read

 @returns The roles, indexed by position among the words

 @example
 ```ts
 const roles = markRolesIn({ points: Array.from('the cats\'',), from: 0, to: 9, mark: '\'', },); // ['absent', ..., 'apostrophe']
 ```
 */
function markRolesIn(
  {
    points,
    from,
    to,
    mark,
  }: {
    readonly points: readonly string[];
    readonly from: number;
    readonly to: number;
    readonly mark: string;
  },
): readonly MarkRole[] {
  // Both are built by this one pass, in position order, and read by no one before it ends.
  /**
   The role of each mark met, indexed by position, mutated only inside this function.
   */
  const roles = Array.from(
    { length: to, },
    function absentRole(): MarkRole {
      return 'absent';
    },
  );
  /**
   Positions of the openers not yet closed, innermost last, mutated only inside this function.
   */
  const open: number[] = [];
  for (
    let at = from;
    at < to;
    at += 1
  ) {
    if (points[at] !== mark)
      continue;
    /**
     Whether a word character stands before the mark.
     */
    const wordBefore = continuesLatinWord({ character: points[at - 1] ?? '', },);
    /**
     Whether a word character stands after it.
     */
    const wordAfter = continuesLatinWord({ character: points[at + 1] ?? '', },);
    if (wordBefore && wordAfter) {
      roles[at] = 'interior';
    }
    else if ((mark !== APOSTROPHE) || ((!wordBefore) && (!wordAfter))) {
      roles[at] = 'bare';
    }
    else if (wordAfter) {
      // An opener is an apostrophe until a closer after it takes it.
      roles[at] = 'apostrophe';
      open.push(at,);
    }
    else {
      /**
       The innermost opener still open, none when nothing before the mark opened.
       */
      const opener = open.pop();
      if (opener === undefined) {
        roles[at] = 'apostrophe';
      }
      else {
        roles[opener] = 'matched';
        roles[at] = 'matched';
      }
    }
  }
  return roles;
}

/**
 How many quotation marks of one kind a stretch of the words holds that can
 pair: those not standing between two word characters, such as the apostrophe
 of `wasn't`, and, for the single mark, not an apostrophe that touches a letter
 and has no matching mark across the stretch.

 @param points - the words, one whole character each

 @param from - first position read

 @param to - exclusive position the reading stops at

 @param mark - the quotation mark counted

 @returns The count

 @example
 ```ts
 const marks = pairableMarksIn({ points: Array.from('"cat" naps',), from: 0, to: 10, mark: '"', },); // 2
 ```
 */
function pairableMarksIn(
  {
    points,
    from,
    to,
    mark,
  }: {
    readonly points: readonly string[];
    readonly from: number;
    readonly to: number;
    readonly mark: string;
  },
): number {
  return markRolesIn({
    points,
    from,
    to,
    mark,
  },)
    .filter(function isPairable(role,): boolean {
      return (role === 'matched') || (role === 'bare');
    },)
    .length;
}

/**
 What the quotation mark at one position of the words is, read over all of
 them: an edge mark that touches a letter and pairs with no mark across the
 words is an apostrophe and part of the word.

 @param points - the words, one whole character each

 @param at - position of the mark, which holds a quotation mark

 @returns The role of the mark

 @throws {@link ConsistencyInvariantError} when the position holds no quotation mark

 @example
 ```ts
 const role = markRoleAt({ points: Array.from('\'Tis',), at: 0, },); // 'apostrophe'
 ```
 */
function markRoleAt(
  {
    points,
    at,
  }: {
    readonly points: readonly string[];
    readonly at: number;
  },
): MarkRole {
  /**
   The mark at the position.
   */
  const mark = points[at] ?? '';
  /**
   The role of every mark of that kind among all the words, by position.
   */
  const roles = markRolesIn({
    points,
    from: 0,
    to: points.length,
    mark,
  },);
  /**
   The role of the mark asked about.
   */
  const role = roles[at] ?? 'absent';
  if (role === 'absent') {
    throw new ConsistencyInvariantError({ invariant:
      `position ${String(at,)} of the words holds no quotation mark of the kind read, and the role of a quotation mark is asked only for a position that holds one`, },);
  }
  return role;
}

/**
 Whether a quotation mark at an edge belongs to the words: it pairs with a mark
 across them, or it is an apostrophe that touches a letter.

 @param role - what the mark is among all the words

 @returns Whether the edge keeps it

 @example
 ```ts
 const keeps = isWordMark({ role: 'apostrophe', },); // true
 ```
 */
function isWordMark({ role, }: { readonly role: MarkRole; },): boolean {
  return (role === 'apostrophe') || (role === 'matched');
}

/**
 Whether a stretch of the words holds the brackets of one pair in order and
 balanced: none closes before it opens, and as many close as open.

 @param points - the words, one whole character each

 @param from - first position read

 @param to - exclusive position the reading stops at

 @param opener - the pair's opening bracket

 @param closer - the pair's closing bracket

 @returns Whether the stretch is balanced for the pair

 @example
 ```ts
 const balanced = isBalanced({ points: Array.from('a (b) c',), from: 0, to: 7, opener: '(', closer: ')', },); // true
 ```
 */
function isBalanced(
  {
    points,
    from,
    to,
    opener,
    closer,
  }: {
    readonly points: readonly string[];
    readonly from: number;
    readonly to: number;
    readonly opener: string;
    readonly closer: string;
  },
): boolean {
  /**
   Brackets opened and not yet closed, mutated only inside this function.
   */
  const depth = { open: 0, };
  for (const point of points.slice(
    from,
    to,
  )) {
    if (point === opener)
      depth.open += 1;
    else if (point === closer) {
      if (depth.open === 0)
        return false;
      depth.open -= 1;
    }
  }
  return depth.open === 0;
}

/**
 Whether the first and last characters of the words are one mark and its pair,
 around words that hold that mark in order: the mark encloses all of them.

 @param points - the words, one whole character each

 @returns Whether the first and last characters enclose what is between them

 @example
 ```ts
 const encloses = enclosesAll({ points: Array.from('"cat"',), },); // true
 ```
 */
function enclosesAll({ points, }: { readonly points: readonly string[]; },): boolean {
  if (points.length < 2)
    return false;
  /**
   The first character.
   */
  const first = points[0] ?? '';
  /**
   The last character.
   */
  const last = points.at(-1,) ?? '';
  if (isQuoteMark({ point: first, },)) {
    return (first === last) && ((pairableMarksIn({
      points,
      from: 1,
      to: points.length - 1,
      mark: first,
    },) % 2) === 0);
  }
  /**
   The closing bracket of the first character, none when it opens no pair.
   */
  const [closer,] = closerOf({ point: first, },);
  return (closer === last) && isBalanced({
    points,
    from: 1,
    to: points.length - 1,
    opener: first,
    closer,
  },);
}

/**
 Whether the first character of the words is not one of them.

 @param points - the words, one whole character each

 @returns Whether to take it off: closing punctuation, space or an invisible
 character; a quotation mark or an opening bracket that pairs with nothing in
 the rest; or a closing bracket, which can close nothing before it

 @example
 ```ts
 const off = dropsAtStart({ points: Array.from('"cat naps',), },); // true
 ```
 */
function dropsAtStart({ points, }: { readonly points: readonly string[]; },): boolean {
  /**
   The first character.
   */
  const point = points[0] ?? '';
  if (isClosing({ point, },))
    return true;
  if (isQuoteMark({ point, },)) {
    // A MARK THAT TOUCHES A LETTER AND PAIRS ACROSS THE WORDS, OR PAIRS WITH NOTHING, IS PART OF THEM.
    /**
     What the first mark is among all the words.
     */
    const role = markRoleAt({
      points,
      at: 0,
    },);
    if (isWordMark({ role, },))
      return false;
    return (pairableMarksIn({
      points,
      from: 1,
      to: points.length,
      mark: point,
    },) % 2) === 0;
  }
  /**
   The closing bracket of the first character, none when it opens no pair.
   */
  const [closer,] = closerOf({ point, },);
  if (closer !== undefined) {
    return !points.slice(1,)
      .includes(closer,);
  }
  /**
   The opening bracket of the first character, none when it closes no pair.
   */
  const openers = openerOf({ point, },);
  return openers.length > 0;
}

/**
 Whether the last character of the words is not one of them.

 @param points - the words, one whole character each

 @returns Whether to take it off: closing punctuation, space or an invisible
 character; a quotation mark or a closing bracket that pairs with nothing before
 it; or an opening bracket, which can open nothing after it

 @example
 ```ts
 const off = dropsAtEnd({ points: Array.from('cat naps."',), },); // true
 ```
 */
function dropsAtEnd({ points, }: { readonly points: readonly string[]; },): boolean {
  /**
   The last character.
   */
  const point = points.at(-1,) ?? '';
  if (isClosing({ point, },))
    return true;
  if (isQuoteMark({ point, },)) {
    /**
     What the last mark is among all the words.
     */
    const role = markRoleAt({
      points,
      at: points.length - 1,
    },);
    if (isWordMark({ role, },))
      return false;
    return (pairableMarksIn({
      points,
      from: 0,
      to: points.length - 1,
      mark: point,
    },) % 2) === 0;
  }
  /**
   The opening bracket of the last character, none when it closes no pair.
   */
  const [opener,] = openerOf({ point, },);
  if (opener !== undefined) {
    return !points.slice(
      0,
      -1,
    )
      .includes(opener,);
  }
  /**
   The closing bracket of the last character, none when it opens no pair.
   */
  const closers = closerOf({ point, },);
  return closers.length > 0;
}

/**
 The words once one reading of the two edges has taken off what is not theirs.

 @param points - the words so far, one whole character each

 @returns The words after the reading, the same ones when no edge moved

 @example
 ```ts
 const next = edgeStepOf({ points: Array.from('"cat".',), },); // Array.from('"cat"',)
 ```
 */
function edgeStepOf({ points, }: { readonly points: readonly string[]; },): readonly string[] {
  if (points.length === 0)
    return points;
  // A MARK THAT ENCLOSES ALL THE WORDS GOES WITH ITS PAIR, both at once: taken
  // one at a time, the first off would leave the other pairing with nothing
  // inside and the pair split.
  if (enclosesAll({ points, },)) {
    return points.slice(
      1,
      -1,
    );
  }
  /**
   The words with the start taken off when it is not theirs.
   */
  const fromStart = dropsAtStart({ points, },) ? points.slice(1,) : points;
  if ((fromStart.length > 0) && dropsAtEnd({ points: fromStart, },)) {
    return fromStart.slice(
      0,
      -1,
    );
  }
  return fromStart;
}

/**
 The words of a quote once the marks and punctuation at its two edges are taken
 off, read to a fixed point.

 @param points - the folded quote, one whole character each

 @returns The words, empty when the quote holds none

 @example
 ```ts
 const words = edgeFreeWordsOf({ points: Array.from('"cat naps".',), },); // ['c', 'a', 't', ' ', 'n', 'a', 'p', 's']
 ```
 */
export function edgeFreeWordsOf(
  { points, }: { readonly points: readonly string[]; },
): readonly string[] {
  /**
   The words so far and whether an edge moved in the last reading, mutated only inside this function.
   */
  const reading = {
    words: points,
    moved: true,
  };
  while (reading.moved) {
    /**
     The words before this reading.
     */
    const before = reading.words;
    /**
     The words after it.
     */
    const after = edgeStepOf({ points: before, },);
    reading.words = after;
    reading.moved = after.length < before.length;
  }
  return reading.words;
}

//endregion Consistency edge marks

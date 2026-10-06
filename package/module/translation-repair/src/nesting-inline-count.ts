import {
  isOneOf,
  characterRunEnd,
  type FenceRun,
} from './nesting-line-lexing.ts';
import {
  DELIMITER_BOUND,
  NESTING_BOUND,
  type NestingGrammar,
  type NestingMeasure,
  type NestingReading,
} from './nesting-vocabulary.ts';

//region Nesting inline count
// COUNTS WHAT A LINE OPENS AND CLOSES: brackets, emphasis delimiters, and under the
// strict grammar open tags and open braces, each carried from line to line in one
// mutable state the scan owns, and read against its bound as it grows.

/**
 ASCII letters, the characters a tag name begins with.
 */
const ASCII_LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 Characters a tag's name is made of.
 */
const TAG_NAME_CHARACTERS = `${ASCII_LETTERS}0123456789`;

/**
 HTML elements that never hold content, so an open tag of one nests nothing.
 */
const VOID_ELEMENTS: ReadonlySet<string> = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
],);

/**
 The counts one scan carries from line to line.
 */
type Counted = 'brackets' | 'delimiters' | 'tags' | 'braces';

/**
 Whether a tag was begun whose closing angle bracket is still to come.
 */
type PendingTag = 'none' | 'opening' | 'closing';

/**
 Mutable state one scan carries from line to line.
 */
export type ScanState = {
  /**
   Open brackets of the paragraph being read.
   */
  brackets: number;

  /**
   Emphasis delimiters of the block being read.
   */
  delimiters: number;

  /**
   Open tags not yet closed.
   */
  tags: number;

  /**
   Open braces not yet closed.
   */
  braces: number;

  /**
   Whether a tag was begun whose closing angle bracket is still to come.
   */
  pendingTag: PendingTag;

  /**
   The fence run the body is inside, none when it is inside no fence.
   */
  fence: FenceRun;
};

/**
 What the measure names for each count.
 */
const COUNTED_MEASURE: Readonly<Record<Counted, NestingMeasure>> = {
  brackets: 'brackets',
  delimiters: 'emphasis delimiters',
  tags: 'open tags',
  braces: 'open braces',
};

/**
 The bound each count is read against.
 */
const COUNTED_BOUND: Readonly<Record<Counted, number>> = {
  brackets: NESTING_BOUND,
  delimiters: DELIMITER_BOUND,
  tags: NESTING_BOUND,
  braces: NESTING_BOUND,
};

/**
 Which count a character opens.

 @param character - one UTF-16 unit

 @param grammar - grammar that will read the body

 @returns The count it opens, or that it opens none

 @example
 ```ts
 opensOf({ character: '[', grammar: 'markdown', },);
 // => 'brackets'
 ```
 */
function opensOf(
  {
    character,
    grammar,
  }: {
    readonly character: string;
    readonly grammar: NestingGrammar;
  },
): Counted | 'none' {
  if (character === '[')
    return 'brackets';
  if (isOneOf({
    character,
    set: '*_~',
  },))
    return 'delimiters';
  if ((grammar === 'mdx') && (character === '{'))
    return 'braces';
  return 'none';
}

/**
 Which count a character closes.

 @param character - one UTF-16 unit

 @param grammar - grammar that will read the body

 @returns The count it closes, or that it closes none

 @example
 ```ts
 closesOf({ character: ']', grammar: 'markdown', },);
 // => 'brackets'
 ```
 */
function closesOf(
  {
    character,
    grammar,
  }: {
    readonly character: string;
    readonly grammar: NestingGrammar;
  },
): Counted | 'none' {
  if (character === ']')
    return 'brackets';
  if ((grammar === 'mdx') && (character === '}'))
    return 'braces';
  return 'none';
}

/**
 Counts one more of something against its bound.

 @param counted - which count grows

 @param lineNumber - one-based number of the line

 @param index - zero-based index of the character that opens it

 @param state - counts carried from line to line, updated in place

 @returns That the count passed its bound at this place, or that it stays within

 @example
 ```ts
 const reading = opened({ counted: 'brackets', lineNumber: 1, index: 0, state, },);
 ```
 */
function opened(
  {
    counted,
    lineNumber,
    index,
    state,
  }: {
    readonly counted: Counted;
    readonly lineNumber: number;
    readonly index: number;
    readonly state: ScanState;
  },
): NestingReading {
  state[counted]++;
  if (state[counted] <= COUNTED_BOUND[counted])
    return { kind: 'within', };
  return {
    kind: 'beyond',
    measure: COUNTED_MEASURE[counted],
    bound: COUNTED_BOUND[counted],
    line: lineNumber,
    column: index + 1,
  };
}

/**
 Reads the angle brackets of a line against the open tags, which only the
 strict grammar nests over.

 @param line - one line without its newline

 @param index - index of the character, an angle bracket

 @param lineNumber - one-based number of the line

 @param state - counts carried from line to line, updated in place

 @returns That a tag opened past the bound at this place, or that it stays within

 @example
 ```ts
 const reading = readAngle({ line: '<div>', index: 0, lineNumber: 1, state, },);
 ```
 */
function readAngle(
  {
    line,
    index,
    lineNumber,
    state,
  }: {
    readonly line: string;
    readonly index: number;
    readonly lineNumber: number;
    readonly state: ScanState;
  },
): NestingReading {
  if (line[index] === '<') {
    /**
     Index after the name a tag opening here begins with, absent for none.
     */
    const nameEnd = characterRunEnd({
      line,
      from: index + 1,
      set: TAG_NAME_CHARACTERS,
    },);
    /**
     Name the tag opens with, lowercased as elements are compared.
     */
    const name = line
      .slice(
        index + 1,
        nameEnd,
      )
      .toLowerCase();
    if (isOneOf({
      character: line[index + 1] ?? '',
      set: ASCII_LETTERS,
    },))
      state.pendingTag = VOID_ELEMENTS.has(name,) ? 'none' : 'opening';
    else if ((line[index + 1] === '/') && isOneOf({
      character: line[index + 2] ?? '',
      set: ASCII_LETTERS,
    },))
      state.pendingTag = 'closing';
    return { kind: 'within', };
  }
  /**
   Which kind of tag this angle bracket ends, if any is begun.
   */
  const { pendingTag, } = state;
  state.pendingTag = 'none';
  if (pendingTag === 'closing')
    state.tags = Math.max(
      0,
      state.tags - 1,
    );
  if ((pendingTag === 'opening') && (line[index - 1] !== '/'))
    return opened({
      counted: 'tags',
      lineNumber,
      index,
      state,
    },);
  return { kind: 'within', };
}

/**
 Reads one character of a line against the counts it opens and closes.

 @param line - one line without its newline

 @param index - index of the character

 @param lineNumber - one-based number of the line

 @param grammar - grammar that will read the body

 @param state - counts carried from line to line, updated in place

 @param skipDelimiters - whether this line's emphasis delimiters nest nothing

 @returns That the character passed a bound at this place, or that it stays within

 @example
 ```ts
 const reading = readCharacter({ line: '[a]', index: 0, lineNumber: 1, grammar: 'markdown', state, skipDelimiters: false, },);
 ```
 */
function readCharacter(
  {
    line,
    index,
    lineNumber,
    grammar,
    state,
    skipDelimiters,
  }: {
    readonly line: string;
    readonly index: number;
    readonly lineNumber: number;
    readonly grammar: NestingGrammar;
    readonly state: ScanState;
    readonly skipDelimiters: boolean;
  },
): NestingReading {
  /**
   Character read here.
   */
  const character = line[index] ?? '';
  /**
   Count this character opens, if any, under the grammar.
   */
  const opens = opensOf({
    character,
    grammar,
  },);
  if (opens !== 'none') {
    if ((opens === 'delimiters') && skipDelimiters)
      return { kind: 'within', };
    return opened({
      counted: opens,
      lineNumber,
      index,
      state,
    },);
  }
  /**
   Count this character closes, if any, under the grammar.
   */
  const closes = closesOf({
    character,
    grammar,
  },);
  if (closes !== 'none') {
    state[closes] = Math.max(
      0,
      state[closes] - 1,
    );
    return { kind: 'within', };
  }
  if ((grammar === 'mdx') && ((character === '<') || (character === '>')))
    return readAngle({
      line,
      index,
      lineNumber,
      state,
    },);
  return { kind: 'within', };
}

/**
 Reads the inline characters of one line against the bound.

 @param line - one line without its newline

 @param start - index where the inline text begins

 @param lineNumber - one-based number of the line

 @param grammar - grammar that will read the body

 @param state - counts carried from line to line, updated in place

 @param skipDelimiters - whether this line's emphasis delimiters nest nothing

 @returns The first excess on the line, or that it stays within

 @example
 ```ts
 const reading = scanInline({ line, start: 0, lineNumber: 1, grammar: 'markdown', state, skipDelimiters: false, },);
 ```
 */
export function scanInline(
  {
    line,
    start,
    lineNumber,
    grammar,
    state,
    skipDelimiters,
  }: {
    readonly line: string;
    readonly start: number;
    readonly lineNumber: number;
    readonly grammar: NestingGrammar;
    readonly state: ScanState;
    readonly skipDelimiters: boolean;
  },
): NestingReading {
  for (let index = start; index < line.length; index++) {
    if (line[index] === '\\') {
      // An escaped character opens and closes nothing.
      index++;
      continue;
    }
    /**
     What this character did to the counts.
     */
    const reading = readCharacter({
      line,
      index,
      lineNumber,
      grammar,
      state,
      skipDelimiters,
    },);
    if (reading.kind === 'beyond')
      return reading;
  }
  return { kind: 'within', };
}

//endregion Nesting inline count

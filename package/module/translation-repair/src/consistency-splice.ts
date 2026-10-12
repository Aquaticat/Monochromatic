import { isCasedLetter, } from './cased-letters.ts';
import type { ConsistencyRendering, } from './consistency-count-types.ts';
import { ConsistencyInvariantError, } from './consistency-invariant-error.ts';

//region Consistency splice
// Moving a chosen place's quoted words over another place's, by code.
//
// NO MODEL WRITES NEW TEXT HERE (the owner's ruling of 2026-10-11). The words
// a replacement carries are words a majority of judges quoted from the page.
// Two edges of the quotes are the only things this code adjusts, and each is
// a rule about the place the words go to rather than a rewrite: the closing
// punctuation of a quote stays where the receiving place has it, and a first
// letter (the first past any opening mark) takes the receiving place's capital
// or small form when the two quotes begin with the same letter.

/**
 One replacement of words in a place's English.

 @example
 ```ts
 const edit: ConsistencyEdit = { id: 'g0:OCCURRENCE 2', start: 0, end: 12, text: 'the cat naps', };
 ```
 */
export type ConsistencyEdit = {
  /**
   Name the outcome of this edit is reported under.
   */
  readonly id: string;

  /**
   Offset in the English where the replaced words start.
   */
  readonly start: number;

  /**
   Exclusive offset where they end.
   */
  readonly end: number;

  /**
   The words that go in their place.
   */
  readonly text: string;
};

/**
 What moving the chosen place's words over another place amounts to.

 @example
 ```ts
 const plan: ConsistencyPlan = { kind: 'same', };
 ```
 */
export type ConsistencyPlan =
  | {
    /**
     The receiving place already carries these words.
     */
    readonly kind: 'same';
  }
  | {
    /**
     The receiving place's words are replaced.
     */
    readonly kind: 'replace';

    /**
     Offset where the replaced words start.
     */
    readonly start: number;

    /**
     Exclusive offset where they end.
     */
    readonly end: number;

    /**
     The words that go in.
     */
    readonly text: string;
  };

/**
 Marks that may open a quote before its first letter: quotation marks,
 brackets and the characters that open emphasis, code or strikethrough.
 */
const OPENING_MARKS = '"\'“‘„«‹([{*_~`¿¡「『（《〈';

/**
 Where a text's first letter stands: past any opening marks, as the character
 there and its offset.

 @param text - words whose first letter is wanted

 @returns The first character after the opening marks and its offset in UTF-16
 units, as a list of one; empty for a text made of opening marks alone

 @example
 ```ts
 const [first,] = firstLetterOf({ text: '“The cat', },); // { character: 'T', at: 1 }
 ```
 */
function firstLetterOf(
  { text, }: { readonly text: string; },
): readonly {
  readonly character: string;
  readonly at: number;
}[] {
  /**
   Offset reached so far, in UTF-16 units.
   */
  const reached = { at: 0, };
  for (const character of text) {
    if (!OPENING_MARKS.includes(character,)) {
      return [
        {
          character,
          at: reached.at,
        },
      ];
    }
    reached.at += character.length;
  }
  return [];
}

/**
 A letter in the case of another, when the two are one letter.

 @param text - words whose first letter may change case

 @param like - words whose first letter sets the case

 @returns The text with its first letter, whole and past any opening mark, in
 the case it has in `like`, or the text itself when the two first letters are
 not one letter in two cases

 @example
 ```ts
 const adapted = firstLetterLike({ text: 'The cat naps', like: 'the cat sleeps', },); // 'the cat naps'
 ```
 */
function firstLetterLike(
  {
    text,
    like,
  }: {
    readonly text: string;
    readonly like: string;
  },
): string {
  /**
   First letter of each.
   */
  const [first,] = firstLetterOf({ text, },);
  /**
   First letter of the text whose case is followed.
   */
  const [model,] = firstLetterOf({ text: like, },);
  if ((first === undefined) || (model === undefined)
    || (first.character === model.character))
    return text;
  if ((!isCasedLetter({ character: first.character, },)) || (!isCasedLetter({ character: model.character, },)))
    return text;
  if (first.character
    .toLowerCase()
    !== model.character
    .toLowerCase())
    return text;
  return `${text.slice(
    0,
    first.at,
  )}${model.character}${text.slice(first.at
    + first.character
    .length,)}`;
}

/**
 Words a frame's chosen pattern gives a receiving place.

 @param chosen - the chosen place's located rendering

 @param target - the receiving place's located rendering

 @returns The chosen quote's words with its slot words replaced by the
 receiving place's slot words, or the chosen words themselves when the group
 has no slot

 @example
 ```ts
 const words = patternFor({ chosen, target, },);
 ```
 */
function patternFor(
  {
    chosen,
    target,
  }: {
    readonly chosen: Extract<ConsistencyRendering, { readonly kind: 'located'; }>;
    readonly target: Extract<ConsistencyRendering, { readonly kind: 'located'; }>;
  },
): string {
  if ((chosen.slot === undefined) || (chosen.slotStart === undefined)
    || (target.slot === undefined))
    return chosen.core;
  return `${chosen.core
    .slice(
      0,
      chosen.slotStart,
    )}${target.slot}${
    chosen.core
      .slice(chosen.slotStart
        + chosen.slot
        .length,)
  }`;
}

/**
 Plans moving the chosen place's rendering over a receiving place's.

 @param chosen - the chosen place's located rendering

 @param target - the receiving place's located rendering

 @returns That the receiving place already agrees, or the replacement

 @example
 ```ts
 const plan = planConsistencyEdit({ chosen, target, },);
 ```
 */
export function planConsistencyEdit(
  {
    chosen,
    target,
  }: {
    readonly chosen: Extract<ConsistencyRendering, { readonly kind: 'located'; }>;
    readonly target: Extract<ConsistencyRendering, { readonly kind: 'located'; }>;
  },
): ConsistencyPlan {
  /**
   The words the receiving place is given.
   */
  const text = firstLetterLike({
    text: patternFor({
      chosen,
      target,
    },),
    like: target.core,
  },);
  if (text === target.core)
    return { kind: 'same', };
  return {
    kind: 'replace',
    start: target.start,
    end: target.start
      + target.core
      .length,
    text,
  };
}

/**
 What applying a place's edits came to.

 @example
 ```ts
 const applied: AppliedEdits = { text: 'The cat naps.', applied: [], overlapped: [], };
 ```
 */
export type AppliedEdits = {
  /**
   The English with the applied edits made.
   */
  readonly text: string;

  /**
   Ids of the edits made.
   */
  readonly applied: readonly string[];

  /**
   Ids of the edits left out because their words overlap an edit that came
   before them.
   */
  readonly overlapped: readonly string[];
};

/**
 Applies edits to one English, the earlier edit winning wherever two overlap.

 Every edit's offsets address the English as it stood when the words were
 located, so the text is cut once, from the start, between the kept edits,
 which overlap none another, and none moves another.

 @param english - the place's English before any edit

 @param edits - edits in priority order

 @returns The edited English and which edits were made

 @throws {@link Error} when an edit's span lies outside the English or is
 empty, since offsets located in that English cannot

 @example
 ```ts
 const { text, } = applyConsistencyEdits({ english, edits, },);
 ```
 */
export function applyConsistencyEdits(
  {
    english,
    edits,
  }: {
    readonly english: string;
    readonly edits: readonly ConsistencyEdit[];
  },
): AppliedEdits {
  /**
   Edits kept so far.
   */
  const kept: ConsistencyEdit[] = [];
  /**
   Ids of edits left out.
   */
  const overlapped: string[] = [];
  for (const edit of edits) {
    if ((edit.start < 0) || (edit.end > english.length)
      || (edit.end <= edit.start)) {
      throw new ConsistencyInvariantError({ invariant:
        `edit ${edit.id} spans ${String(edit.start,)} to ${String(edit.end,)} in an English whose length is ${
          String(english.length,)
        }, and a span located in that English lies inside it and is not empty`, },);
    }
    if (kept.some(function overlaps(other,): boolean {
      return (edit.start < other.end) && (other.start < edit.end);
    },))
      overlapped.push(edit.id,);
    else
      kept.push(edit,);
  }
  /**
   Kept edits in the order their spans stand in the text.
   */
  const fromTheStart = kept.toSorted(function earlierFirst(
    a,
    b,
  ): number {
    return a.start - b.start;
  },);
  /**
   Pieces of the edited text: the English between edits, and each edit's words.
   */
  const pieces: string[] = [];
  /**
   Offset in the English up to which the pieces hold its text.
   */
  const cursor = { at: 0, };
  for (const edit of fromTheStart) {
    pieces.push(
      english.slice(
        cursor.at,
        edit.start,
      ),
      edit.text,
    );
    cursor.at = edit.end;
  }
  pieces.push(english.slice(cursor.at,),);
  return {
    text: pieces.join('',),
    applied: kept.map(function idOf(edit,): string {
      return edit.id;
    },),
    overlapped,
  };
}

//endregion Consistency splice

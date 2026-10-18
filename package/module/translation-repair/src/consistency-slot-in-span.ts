import { locateWords, } from './consistency-fold.ts';
import { carriesOrCutsMarkup, } from './consistency-markup.ts';
import {
  agreedSlotWordsOf,
  type QuotesByLabel,
  quotesByLabelOf,
} from './consistency-majority.ts';
import type { ConsistencyVoice, } from './consistency-count-types.ts';
import type { PageEnglish, } from './consistency-page-english.ts';
import { rendersAsNothing, } from './renders-as-nothing.ts';

//region Consistency slot in span
// A SLOT IS NO CONDITION OF A SPAN. A frame's slot words are agreed the way its span is, by a strict majority of the usable
// ballots that gave the agreed words, and they must stand once inside the span the place was located by, as the English holds
// them; a slot the ballots do not agree on, that shows a reader nothing, that stands nowhere or twice in the span, that is all of
// the span or that cuts markup is no slot, and the place is located without one (`consistency-count.ts`), which leaves the code
// splice unavailable for it and the writers to carry the slot.

/**
 The slot words a strict majority gave inside a located span, as the English
 holds them.

 @param voices - usable ballots

 @param label - the place's label

 @param words - the folded words the span was agreed by

 @param span - the English's own words of the span

 @param quotesByLabel - the quote entries of these ballots by label, which a caller that asks many places reads once for the
 group; read from the ballots where absent

 @param page - the English of the whole page the span belongs to and where the span starts in it, whose link and footnote
 definitions a reference inside the span resolves against (n173); the span alone is the page where absent

 @returns The slot as the span holds it and its offset in the span, as a list of
 zero or one; none when the ballots do not agree on a slot, it shows a reader
 nothing, it does not stand once inside the span, it is all of the span, or it
 cuts markup

 @example
 ```ts
 const [slot,] = slotInSpan({ voices, label: 'OCCURRENCE 1', words: 'So she was a girl, wasn\'t she', span: 'So she was a girl, wasn’t she', },);
 ```
 */
export function slotInSpan(
  {
    voices,
    label,
    words,
    span,
    quotesByLabel = quotesByLabelOf({ voices, },),
    page,
  }: {
    readonly voices: readonly ConsistencyVoice[];
    readonly label: string;
    readonly words: string;
    readonly span: string;
    readonly quotesByLabel?: QuotesByLabel;
    readonly page?: PageEnglish;
  },
): readonly {
  readonly slot: string;
  readonly slotStart: number;
}[] {
  /**
   The slot words a strict majority gave beside the agreed words.
   */
  const [slotWords,] = agreedSlotWordsOf({
    voices,
    label,
    quotesByLabel,
    words,
  },);
  if ((slotWords === undefined) || rendersAsNothing({ text: slotWords, },))
    return [];
  /**
   Where the slot words stand in the span.
   */
  const inside = locateWords({
    haystack: span,
    words: slotWords,
    apostrophes: 'outside',
    ...((page === undefined) ? {} : { page, }),
  },);
  if (inside.kind !== 'once')
    return [];
  /**
   The slot as the span holds it.
   */
  const slot = span.slice(
    inside.start,
    inside.end,
  );
  if ((slot === span) || carriesOrCutsMarkup({ text: slot, },))
    return [];
  return [
    {
      slot,
      slotStart: inside.start,
    },
  ];
}

//endregion Consistency slot in span

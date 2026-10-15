import type { JsonSchemaResponseFormat, } from './chat-contract.ts';
import {
  isJsonArray,
  isJsonRecord,
} from './json-guard.ts';
import { rendersAsNothing, } from './renders-as-nothing.ts';

//region Consistency wire
// The one question the page-level consistency pass asks about a repeated
// source wording: the page renders it in several places, the renderings
// differ, and a judge picks the one every place should follow, or says which
// places call for their own.
//
// THE JUDGE NAMES WORDS, NEVER WRITES THEM. The ballot quotes the exact words
// of each place's English that render the repeated wording, and the pass
// locates them in the place's own English (`consistency-fold.ts`): a quote is
// evidence of where it points, never text to splice (the owner's ruling of
// 2026-10-11). What carries the chosen rendering to another place is chosen
// among candidates by the bench and held to every floor
// (`corpus-run/pass-consistency-carry.ts`): the chosen words moved in by code,
// where the place's words can be moved whole, and the blocks the translate
// stage's writers write; no judge's quote and no model's text reaches the page
// without that choice and those floors.
//
// REASON BEFORE CHOICE (the owner's ruling of 2026-10-11): the reply schema
// declares `reason` first, the sheet's reply shape shows it first, and the
// sheet says to write it before choosing.

/**
 Word every place's label begins with.
 */
const LABEL_WORD = 'OCCURRENCE';

/**
 One place's quoted rendering, by label.

 @example
 ```ts
 const item: ConsistencyQuoteWire = { label: 'OCCURRENCE 1', quote: 'the cat naps', };
 ```
 */
export type ConsistencyQuoteWire = {
  /**
   Label of the place the quote is taken from.
   */
  readonly label: string;

  /**
   Exact words of that place's English that render the repeated wording, or
   an empty string when the judge cannot give them.
   */
  readonly quote: string;

  /**
   For a frame: the exact words inside the quote that render the varying
   slot. Absent for a repeated run with no slot.
   */
  readonly slot?: string;
};

/**
 One judge's reply about one repeated wording.

 @example
 ```ts
 const ballot: ConsistencyBallotWire = { reason: 'Both say it alike.', quotes: [], choice: 'OCCURRENCE 1', keep: [], };
 ```
 */
export type ConsistencyBallotWire = {
  /**
   Why the judge chose as it did, written before the choice.
   */
  readonly reason: string;

  /**
   One quote per place.
   */
  readonly quotes: readonly ConsistencyQuoteWire[];

  /**
   Label of the place every place should follow.
   */
  readonly choice: string;

  /**
   Labels of the places whose surroundings call for different wording.
   */
  readonly keep: readonly string[];
};

/**
 Label of the place at a position on the sheet.

 @param position - zero-based position among the sheet's places

 @returns Label, counting from one

 @example
 ```ts
 const label = consistencyLabel({ position: 0, },); // 'OCCURRENCE 1'
 ```
 */
export function consistencyLabel({ position, }: { readonly position: number; },): string {
  return `${LABEL_WORD} ${String(position + 1,)}`;
}

/**
 Labels of the first places of a sheet, in order.

 @param count - how many places the sheet shows

 @returns One label per place

 @example
 ```ts
 const labels = consistencyLabels({ count: 2, },); // ['OCCURRENCE 1', 'OCCURRENCE 2']
 ```
 */
export function consistencyLabels({ count, }: { readonly count: number; },): readonly string[] {
  return Array.from(
    { length: count, },
    function labelAt(
      _unused,
      position,
    ): string {
      return consistencyLabel({ position, },);
    },
  );
}

/**
 Whether a parsed quote has the shape of one.

 @param value - parsed item

 @returns Whether it carries a label and a quote, and a slot when it has one

 @example
 ```ts
 isConsistencyQuoteWire({ label: 'OCCURRENCE 1', quote: 'the cat naps', },);
 ```
 */
function isConsistencyQuoteWire(value: unknown,): value is ConsistencyQuoteWire {
  if (!isJsonRecord(value,))
    return false;
  if (((typeof value.label) !== 'string') || ((typeof value.quote) !== 'string'))
    return false;
  return (value.slot === undefined) || ((typeof value.slot) === 'string');
}

/**
 Whether a parsed reply has the shape of a ballot, whatever it names.

 @param value - parsed provider value

 @returns Whether it carries a reason, a list of quotes, a choice and a list
 of kept labels

 @example
 ```ts
 isConsistencyBallotWire(JSON.parse(text,),);
 ```
 */
export function isConsistencyBallotWire(value: unknown,): value is ConsistencyBallotWire {
  if (!isJsonRecord(value,))
    return false;
  if (((typeof value.reason) !== 'string') || ((typeof value.choice) !== 'string'))
    return false;
  if ((!isJsonArray(value.quotes,)) || (!isJsonArray(value.keep,)))
    return false;
  return value.quotes
    .every(isConsistencyQuoteWire,)
    && value.keep
    .every(function isLabel(entry,): boolean {
        return (typeof entry) === 'string';
      },);
}

/**
 Whether a label list names only shown places, each once.

 @param labels - labels a ballot gave

 @param shown - labels the sheet showed

 @returns Whether every label is shown and none repeats

 @example
 ```ts
 namesShownOnce({ labels: ['OCCURRENCE 2',], shown: ['OCCURRENCE 1', 'OCCURRENCE 2',], },);
 ```
 */
function namesShownOnce(
  {
    labels,
    shown,
  }: {
    readonly labels: readonly string[];
    readonly shown: readonly string[];
  },
): boolean {
  /**
   The labels the sheet showed, as a set, so each label a ballot gave is looked up in constant time and the work grows with the
   number of labels, never with the number of pairs of labels.
   */
  const shownLabels = new Set(shown,);
  return labels.every(function isShown(label,): boolean {
    return shownLabels.has(label,);
  },) && (new Set(labels,).size === labels.length);
}

/**
 Whether a ballot can be counted against the places a sheet showed: it gives
 a reason that shows a reader something, chooses a shown place, keeps only
 shown places, and quotes only shown places, each once.

 @param ballot - ballot of the right shape

 @param labels - labels the sheet showed

 @returns Whether the ballot counts

 @example
 ```ts
 isUsableConsistencyBallot({ ballot, labels: consistencyLabels({ count: 2, },), },);
 ```
 */
export function isUsableConsistencyBallot(
  {
    ballot,
    labels,
  }: {
    readonly ballot: ConsistencyBallotWire;
    readonly labels: readonly string[];
  },
): boolean {
  if (rendersAsNothing({ text: ballot.reason, },))
    return false;
  if (!labels.includes(ballot.choice,))
    return false;
  return namesShownOnce({
    labels: ballot.keep,
    shown: labels,
  },) && namesShownOnce({
    labels: ballot.quotes
      .map(function labelOf(quote,): string {
        return quote.label;
      },),
    shown: labels,
  },);
}

/**
 Guard handed to the quorum gather, so a reply that cannot be counted is
 asked again like one that is not a ballot.

 @param labels - labels the sheet showed

 @returns Guard accepting only ballots that count

 @example
 ```ts
 const validate = usableConsistencyBallotFor({ labels: consistencyLabels({ count: 2, },), });
 ```
 */
export function usableConsistencyBallotFor(
  { labels, }: { readonly labels: readonly string[]; },
): (value: unknown,) => value is ConsistencyBallotWire {
  return function isUsableBallot(value: unknown,): value is ConsistencyBallotWire {
    return isConsistencyBallotWire(value,) && isUsableConsistencyBallot({
      ballot: value,
      labels,
    },);
  };
}

/**
 Structured-output constraint for consistency replies. `reason` is declared
 first, and `slot` is the one optional property.
 */
export const CONSISTENCY_RESPONSE_FORMAT: JsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'page_consistency',
    schema: {
      type: 'object',
      required: [
        'reason',
        'quotes',
        'choice',
        'keep',
      ],
      additionalProperties: false,
      // REASON DECLARED BEFORE CHOICE, as the sheet's reply shape shows it
      // (owner, 2026-10-11, "Reason before vote").
      properties: {
        reason: { type: 'string', },
        quotes: {
          type: 'array',
          items: {
            type: 'object',
            required: [
              'label',
              'quote',
            ],
            additionalProperties: false,
            properties: {
              label: { type: 'string', },
              quote: { type: 'string', },
              slot: { type: 'string', },
            },
          },
        },
        choice: { type: 'string', },
        keep: {
          type: 'array',
          items: { type: 'string', },
        },
      },
    },
  },
};

/**
 What a sheet shows of the English of one place.

 @example
 ```ts
 const english: ConsistencyEnglish = { kind: 'present', text: 'The cat naps.', };
 ```
 */
export type ConsistencyEnglish =
  | {
    /**
     The place's slice carries English.
     */
    readonly kind: 'present';

    /**
     The slice's whole English as it now stands.
     */
    readonly text: string;
  }
  | {
    /**
     The place's slice carries no English.
     */
    readonly kind: 'absent';
  };

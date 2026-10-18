import type { JsonSchemaResponseFormat, } from '@monochromatic-dev/translation-repair-provider/ts';
import { shownLabelOf, } from './consistency-label-form.ts';
import {
  majorityChoiceOf,
  tiedForFirstOf,
} from './consistency-majority.ts';
import { isJsonRecord, } from '@monochromatic-dev/translation-repair-document-structure/ts';
import { rendersAsNothing, } from '@monochromatic-dev/translation-repair-typography/ts';

//region Consistency choice
// THE REPLY OF A JUDGE WHO ONLY CHOOSES: the run-off among the places that tied
// for first, and the choice among the candidate texts of a receiving place. The
// first round asks for quotes too; these two ask for a reason and a choice, in
// that order (REASON BEFORE CHOICE, the owner's ruling of 2026-10-11), the
// reason declared first in the reply schema and written first on the sheet.

/**
 One judge's reply that only chooses.

 @example
 ```ts
 const ballot: ConsistencyChoiceWire = { reason: 'It reads as the refrain reads.', choice: 'CANDIDATE 2', };
 ```
 */
export type ConsistencyChoiceWire = {
  /**
   Why the judge chose as it did, written before the choice.
   */
  readonly reason: string;

  /**
   Label of the place or candidate chosen.
   */
  readonly choice: string;
};

/**
 One heard choice with the seat that gave it.

 @example
 ```ts
 const voice: ConsistencyChoiceVoice = { seat: 'glm-5.3', reason: 'Reads best.', choice: 'OCCURRENCE 3', };
 ```
 */
export type ConsistencyChoiceVoice = ConsistencyChoiceWire & {
  /**
   Seat that answered.
   */
  readonly seat: string;
};

/**
 Structured-output constraint for replies that only choose, built for one ask: `reason` is declared first, and `choice` lists
 the labels the sheet showed as an `enum`, so a provider that enforces the schema can answer with no other.

 @param labels - labels the sheet showed, the only labels a reply may use

 @returns The constraint for this ask

 @example
 ```ts
 const format = consistencyChoiceResponseFormat({ labels: ['CANDIDATE 1', 'CANDIDATE 2',], },);
 ```
 */
export function consistencyChoiceResponseFormat(
  { labels, }: { readonly labels: readonly string[]; },
): JsonSchemaResponseFormat {
  return {
    type: 'json_schema',
    json_schema: {
      name: 'page_consistency_choice',
      schema: {
        type: 'object',
        required: [
          'reason',
          'choice',
        ],
        additionalProperties: false,
        // REASON DECLARED BEFORE CHOICE, as the sheets' reply shape shows it.
        properties: {
          reason: { type: 'string', },
          choice: {
            type: 'string',
            enum: [...labels,],
          },
        },
      },
    },
  };
}

/**
 Whether a parsed reply has the shape of a choice, whatever it names.

 @param value - parsed provider value

 @returns Whether it carries a reason and a choice

 @example
 ```ts
 isConsistencyChoiceWire(JSON.parse(text,),);
 ```
 */
export function isConsistencyChoiceWire(value: unknown,): value is ConsistencyChoiceWire {
  return isJsonRecord(value,) && ((typeof value.reason) === 'string')
    && ((typeof value.choice) === 'string');
}

/**
 The choice with its label as the sheet showed it, when it names exactly one shown label in any form (its case, white space
 around it, a bare number, the word with the number); every other field of the reply is kept.

 @param ballot - choice of the right shape, with whatever else the reply carries

 @param labels - labels the sheet showed

 @returns The choice with the shown label, as a list of zero or one; none when the choice names no shown label or more than one

 @example
 ```ts
 const [canonical,] = canonicalChoiceOf({ ballot: { reason: 'r', choice: '3', }, labels: ['OCCURRENCE 3',], },);
 ```
 */
export function canonicalChoiceOf<BallotT extends ConsistencyChoiceWire,>(
  {
    ballot,
    labels,
  }: {
    readonly ballot: BallotT;
    readonly labels: readonly string[];
  },
): readonly BallotT[] {
  /**
   The shown label the choice stands for.
   */
  const [label,] = shownLabelOf({
    name: ballot.choice,
    shown: labels,
  },);
  return (label === undefined)
    ? []
    : [
      {
        ...ballot,
        choice: label,
      },
    ];
}

/**
 Whether a choice can be counted against the labels a sheet showed: it gives a
 reason that shows a reader something and chooses a shown label, written as the
 label or in another form of it.

 @param ballot - choice of the right shape

 @param labels - labels the sheet showed

 @returns Whether the choice counts

 @example
 ```ts
 isUsableChoice({ ballot, labels: ['OCCURRENCE 3', 'OCCURRENCE 4',], });
 ```
 */
export function isUsableChoice(
  {
    ballot,
    labels,
  }: {
    readonly ballot: ConsistencyChoiceWire;
    readonly labels: readonly string[];
  },
): boolean {
  return (!rendersAsNothing({ text: ballot.reason, },)) && (canonicalChoiceOf({
    ballot,
    labels,
  },)
    .length
    > 0);
}

/**
 Guard handed to the quorum gather, so a reply that cannot be counted is asked
 again like one that is not a choice.

 @param labels - labels the sheet showed

 @returns Guard accepting only choices that count

 @example
 ```ts
 const validate = usableChoiceFor({ labels: ['CANDIDATE 1', 'CANDIDATE 2',], });
 ```
 */
export function usableChoiceFor(
  { labels, }: { readonly labels: readonly string[]; },
): (value: unknown,) => value is ConsistencyChoiceWire {
  return function isUsableReply(value: unknown,): value is ConsistencyChoiceWire {
    return isConsistencyChoiceWire(value,) && isUsableChoice({
      ballot: value,
      labels,
    },);
  };
}

/**
 The choices that can be counted against the labels a sheet showed, each with the shown label it names in place of the form it
 was written in, so a choice stored before the forms were read is counted as one stored since.

 @param voices - every heard choice with its seat

 @param labels - labels the sheet showed

 @returns The usable choices

 @example
 ```ts
 const usable = usableChoicesOf({ voices, labels, },);
 ```
 */
export function usableChoicesOf(
  {
    voices,
    labels,
  }: {
    readonly voices: readonly ConsistencyChoiceVoice[];
    readonly labels: readonly string[];
  },
): readonly ConsistencyChoiceVoice[] {
  return voices.flatMap(function counted(voice,): readonly ConsistencyChoiceVoice[] {
    return isUsableChoice({
      ballot: voice,
      labels,
    },)
      ? canonicalChoiceOf({
        ballot: voice,
        labels,
      },)
      : [];
  },);
}

/**
 The labels that tie for first among the choices that can be counted: two or more labels share the highest count and no label
 has more than half of the usable choices. A single leader without a majority is no tie, and neither is a majority.

 @param voices - every heard choice with its seat

 @param labels - labels the sheet showed, in sheet order

 @returns The tied labels in sheet order, none when no tie

 @example
 ```ts
 const tied = tiedChoicesOf({ voices, labels: ['CANDIDATE 1', 'CANDIDATE 2', 'CANDIDATE 3',], },);
 ```
 */
export function tiedChoicesOf(
  {
    voices,
    labels,
  }: {
    readonly voices: readonly ConsistencyChoiceVoice[];
    readonly labels: readonly string[];
  },
): readonly string[] {
  return tiedForFirstOf({
    voices: usableChoicesOf({
      voices,
      labels,
    },),
    labels,
  },);
}

/**
 What a set of choices come to: the usable count and the label a strict
 majority of the usable choices named.

 @param voices - every heard choice with its seat

 @param labels - labels the sheet showed

 @returns How many choices counted, and the label more than half of them chose, as a list of zero or one

 @example
 ```ts
 const { usable, chosen, } = choiceTallyOf({ voices, labels, },);
 ```
 */
export function choiceTallyOf(
  {
    voices,
    labels,
  }: {
    readonly voices: readonly ConsistencyChoiceVoice[];
    readonly labels: readonly string[];
  },
): {
  readonly usable: number;
  readonly chosen: readonly string[];
} {
  /**
   The choices that count.
   */
  const usable = usableChoicesOf({
    voices,
    labels,
  },);
  return {
    usable: usable.length,
    chosen: majorityChoiceOf({ voices: usable, },),
  };
}

//endregion Consistency choice

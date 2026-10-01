import { isIsoStampText, } from '../iso-stamp-text.ts';
import {
  isWholeNumberText,
  WHOLE_NUMBER_RULE,
} from '../whole-number-text.ts';

//region Run timing parse
// Reads a run's own log back into the two shapes that say where its hours
// went, and answers the question the timing work was opened on.
//
// TWO LINES CARRY THE CLOCK, and neither did before the timing work:
//
//   The ROUND line, from `runGatherRound`, splits one fan-out into the time it
//   spent working and the time it spent waiting on a straggler after quorum
//   already stood. Only the second half is straggler cost.
//
//   The STREAM line, from `reportStreamProgress`, carries `elapsed`, which with
//   the line's own timestamp gives each call an interval. Overlapping those
//   intervals is what achieved concurrency IS, and nothing could compute it
//   while a completion line said only when a call finished.
//
// EVERY READ NAMES WHAT IT FOUND rather than returning an absence. A completion
// line with no duration and a line that is not a completion at all are
// different facts about a log: the first says this run predates the timing work, and a
// report that folded them together would describe a mixed archive's readable
// half as the whole of it.
//
// NO PATTERNS. Both lines are written by this codebase with fixed separators,
// so an index scan reads them exactly and says which field was missing when one
// drifts, where a pattern would only fail to match.
//
// READS IDS, COUNTS AND DURATIONS. A run log carries no corpus wording by
// construction, and nothing here would print it if it did.

/**
 Marker that opens a stream completion line's payload.
 */
export const STREAM_MARKER = '] [reportStreamProgress] stream ';

/**
 Marker that opens a round line's payload, after the stage label.
 */
const ROUND_MARKER = ' round: ';

/**
 Field a round line ends with, which tells a complete line from one truncated
 at the tail of a log still being written.
 */
const GRACE_FIELD = 'ms in grace';

/**
 Field a completion line carries only since the timing work.
 */
const ELAPSED_FIELD = 'elapsed ';

/**
 Value `indexOf` returns for text that is not there.
 */
const NOT_FOUND = -1;

/**
 One fan-out round, as its own line reported it.
 
 @example
 ```ts
 const round: RoundTiming = { stage: 'editor', heard: 6, asked: 7, totalMs: 91_402, toQuorumMs: 61_401, inGraceMs: 30_001, };
 ```
 */
export type RoundTiming = {
  /**
   Stage that ran this round.
   */
  readonly stage: string;

  /**
   Voices this round heard, which the grace window can raise past quorum.
   */
  readonly heard: number;

  /**
   Models this round asked.
   */
  readonly asked: number;

  /**
   Time the whole round took.
   */
  readonly totalMs: number;

  /**
   Time before quorum stood, which is the round doing its work.
   */
  readonly toQuorumMs: number;

  /**
   Time after quorum stood, which is the round waiting on voices it may
   never hear. THIS IS THE STRAGGLER COST, measured rather than bounded.
   */
  readonly inGraceMs: number;
};

/**
 What one line turned out to say about a round.
 
 @example
 ```ts
 const reading: RoundReading = readRoundTiming({ line, },);
 ```
 */
export type RoundReading =
  | {
    readonly kind: 'round';

    /**
     Numbers the round reported about itself.
     */
    readonly round: RoundTiming;
  }
  | {
    /**
     Line says nothing about a round, including a round line truncated by a
     log still being written.
     */
    readonly kind: 'other-line';
  };

/**
 One model call, as its completion line reported it.
 
 @example
 ```ts
 const call: CallTiming = { label: 'hf:whiskers', outcome: 'completed', endedAt: 1_760_000_000_000, elapsedMs: 4_210, };
 ```
 */
export type CallTiming = {
  /**
   Model the call went to.
   */
  readonly label: string;

  /**
   How the call ended: `completed`, `cut`, `degenerate`.
   */
  readonly outcome: string;

  /**
   Epoch milliseconds the completion line was written, which is when the call
   ended.
   */
  readonly endedAt: number;

  /**
   How long the call ran, from arming to its end.
   */
  readonly elapsedMs: number;
};

/**
 What one line turned out to say about a call.
 
 @example
 ```ts
 const reading: CallReading = readCallTiming({ line, },);
 ```
 */
export type CallReading =
  | {
    readonly kind: 'timed';

    /**
     Interval the call occupied, which is what an overlap count needs.
     */
    readonly call: CallTiming;
  }
  | {
    /**
     Completion line carrying no duration, which every log written before
     the timing work is made of. Counted rather than skipped, so a report can say how
     much of an archive it could not read.
     */
    readonly kind: 'untimed';
  }
  | {
    /**
     Completion line carrying a duration but no stamp as the logger writes
     one, so no instant places the call (ledger B73). Counted rather than
     skipped, like an untimed line.
     */
    readonly kind: 'unstamped';
  }
  | {
    /**
     Line is not a completion at all.
     */
    readonly kind: 'other-line';
  };

/**
 Reads one field as a whole number, refusing anything else.
 
 @param field - digits and nothing else
 
 @returns Count the field carries
 
 @throws Error when the field is empty, or is not digits a double holds exactly
 
 @example
 ```ts
 const heard = countIn({ field: '5', },);
 ```
 */
function countIn({ field, }: { readonly field: string; },): number {
  if (field === '')
    throw new Error('count field is empty',);
  if (!isWholeNumberText({ text: field, },))
    throw new Error(`count field is not ${WHOLE_NUMBER_RULE}: "${field}"`,);
  return Number(field,);
}

/**
 Reads one field's number, given the unit it must carry.
 
 NAMES THE FIELD IT COULD NOT READ rather than returning a zero, because a
 silent zero in a timing report reads as a measurement of nothing happening.
 
 @param field - one comma-separated field, shaped `<number>ms <name>`
 
 @param unit - text the number is followed by
 
 @returns Number the field opened with
 
 @throws Error when the field does not carry that unit, or what precedes it is
 not a whole number of milliseconds written in digits
 
 @example
 ```ts
 const ms = durationIn({ field: '30001ms in grace', unit: 'ms ', },);
 ```
 */
function durationIn(
  {
    field,
    unit,
  }: {
    readonly field: string;
    readonly unit: string;
  },
): number {
  /**
   Digits ahead of the unit, or the whole field when the unit is absent.
   */
  const digits = field
    .split(unit,)[0] ?? '';

  if (digits === field)
    throw new Error(`timing field carries no ${unit}unit: "${field}"`,);
  // WHOLE MILLISECONDS IN DIGITS, as the round and stream lines write them:
  // `Number` read nothing before the unit as no time at all, NaN out of a word,
  // and a sign or an exponent as a time no line writes (ledger B73).
  if (!isWholeNumberText({ text: digits, },))
    throw new Error(`timing field's milliseconds are not ${WHOLE_NUMBER_RULE}: "${field}"`,);
  return Number(digits,);
}

/**
 Reads one round line, or says the line is not one.
 
 @param line - one log line
 
 @returns What the line turned out to say about a round
 
 @throws Error when a round line's own fields will not read, since a round
 reporting a partial straggler cost is worse than one reporting none
 
 @example
 ```ts
 const reading = readRoundTiming({ line, },);
 ```
 */
export function readRoundTiming(
  { line, }: { readonly line: string; },
): RoundReading {
  /**
   Where the round payload starts, after the tagged prefix and stage label.
   */
  const at = line.indexOf(ROUND_MARKER,);
  if (at === NOT_FOUND)
    return { kind: 'other-line', };

  // A log still being written ends mid-line, so a round missing its last field
  // is a truncation rather than a round that spent no grace.
  if (!line.includes(GRACE_FIELD,))
    return { kind: 'other-line', };

  /**
   Words ahead of the marker, whose last one names the stage.
   */
  const beforeMarker = line
    .slice(
      0,
      at,
    )
    .split(' ',);

  /**
   Stage label, which is the last word before the marker.
   */
  const stage = beforeMarker.at(-1,) ?? '';

  /**
   Comma-separated fields of the payload, one per reported number.
   */
  const [
    ratioField,
    totalField,
    quorumField,
    graceField,
  ] = line
    .slice(at + ROUND_MARKER.length,)
    .split(', ',);

  /**
   Ratio the first field opens with, ahead of the word `heard`.
   */
  const ratio = (ratioField ?? '')
    .split(' heard',)
    .at(0,);

  /**
   Heard and asked counts, which the ratio joins with a slash.
   */
  const counts = ratio?.split('/',) ?? [];

  try {
    // TWO WHOLE NUMBERS OR NOTHING. `Number('')` is 0 and `Number('x')` is
    // NaN, and either rode into the report as a round that heard nobody or a
    // round that never summed; the duration fields already refused, and the
    // counts refuse the same way now.
    if (counts.length !== 2)
      throw new Error(`round ratio is not heard/asked: "${ratio ?? ''}"`,);

    return {
      kind: 'round',
      round: {
        stage,
        heard: countIn({ field: counts[0] ?? '', },),
        asked: countIn({ field: counts[1] ?? '', },),
        totalMs: durationIn({
          field: totalField ?? '',
          unit: 'ms ',
        },),
        toQuorumMs: durationIn({
          field: quorumField ?? '',
          unit: 'ms ',
        },),
        inGraceMs: durationIn({
          field: graceField ?? '',
          unit: 'ms ',
        },),
      },
    };
  } catch (error) {
    throw new Error(
      `round line unreadable: ${line}`,
      { cause: error, },
    );
  }
}

/**
 Reads one stream completion line, saying whether it carried a duration and
 a stamp as the logger writes one.
 
 @param line - one log line
 
 @returns What the line turned out to say about a call
 
 @example
 ```ts
 const reading = readCallTiming({ line, },);
 ```
 */
export function readCallTiming(
  { line, }: { readonly line: string; },
): CallReading {
  /**
   Where the stream payload starts, after the tagged prefix.
   */
  const at = line.indexOf(STREAM_MARKER,);
  if (at === NOT_FOUND)
    return { kind: 'other-line', };

  /**
   Bracketed fields of the tagged prefix, in the order the logger writes them.
   */
  const prefixFields = line
    .slice(
      0,
      at,
    )
    .split('] [',);

  /**
   Timestamp the line was written, which the logger prints second.
   */
  const stamp = prefixFields.at(1,) ?? '';

  /**
   Comma-separated fields of the payload, the first pairing label to outcome.
   */
  const [
    namedField,
    elapsedField,
  ] = line
    .slice(at + STREAM_MARKER.length,)
    .split(', ',);

  if (!(elapsedField ?? '').startsWith(ELAPSED_FIELD,))
    return { kind: 'untimed', };

  // A STAMP THE LOGGER DID NOT WRITE PLACES NO CALL: `Date.parse` reads one
  // without its zone as local time and one cut off as NaN, which the sweep
  // cannot order (ledger B73).
  if (!isIsoStampText({ text: stamp, },))
    return { kind: 'unstamped', };

  /**
   Label and outcome, which the first field joins with a colon.
   */
  const named = (namedField ?? '')
    .split(': ',);

  return {
    kind: 'timed',
    call: {
      label: named[0] ?? '',
      outcome: named[1] ?? '',
      endedAt: Date.parse(stamp,),
      elapsedMs: durationIn({
        field: (elapsedField ?? '').slice(ELAPSED_FIELD.length,),
        unit: 'ms',
      },),
    },
  };
}

//endregion Run timing parse

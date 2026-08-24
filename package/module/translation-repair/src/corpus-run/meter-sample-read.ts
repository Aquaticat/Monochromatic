import type { MeterState, } from '../provider-budget.ts';

//region Meter sample read
// Reads the availability record `provider-budget.ts` leaves in a run log back
// into samples, so provider outages can be counted instead of remembered.
//
// WHY A LOG AND NOT A LEDGER. The budget layer already reads both meters on a
// cached schedule and already knows what they said. Everything a duty cycle
// needs was being computed and then dropped, so the record costs one log line
// per reading rather than a new file, a new writer, and a new thing to keep in
// step with the code that decides.
//
// NO REGEX. The line is `[level] [iso] [tag] [tag] METERS name=state name=state`,
// which is a handful of `indexOf` calls and a split. A pattern here would buy
// nothing and would have to be defended under the repo's regex rule.
//
// ABSENCE IS A NAMED VALUE, never a nullish union: `'not-a-record'` for a line
// that is not one, `'skipped'` for a line that is one and will not read, and
// `'absent'` for a field a record does not carry. `doc/research/optionality-
// enforcement.md` records the four accepted forms; this file uses the sentinel.
//
// A LINE THAT IS A RECORD AND WILL NOT PARSE IS COUNTED, NOT DROPPED.
// Interleaved output and truncated writes both produce them, and a reader that
// silently skipped them would report a cleaner record than the one it read.

/**
 * Marker every availability line carries, spaced on both sides so it cannot
 * match inside a longer word.
 */
const METERS_MARKER = ' METERS ';

/**
 * Separator between a provider's name and what its meter said.
 */
const FIELD_SEPARATOR = '=';

/**
 * Value `indexOf` returns for a search that found nothing.
 */
const NOT_FOUND = -1;

/**
 * States a meter can be recorded in, as written on the line.
 */
const METER_STATES = [
  'wet',
  'dry',
  'unreadable',
] as const;

/**
 * One reading of both meters, at the moment it was taken.
 */
export type MeterSample = {
  /**
   * Epoch milliseconds the reading was logged at.
   */
  readonly at: number;

  /**
   * What the first provider's meter said.
   */
  readonly synthetic: MeterState;

  /**
   * What the second provider's meter said.
   */
  readonly hyper: MeterState;

  /**
   * Every field beyond the two states, in the order written.
   *
   * NOT AN ABSENCE SENTINEL WHEN EMPTY. A record written before the levels
   * were added carries none, and so does one whose meters both failed to
   * answer; those two are told apart by the states beside them, which read
   * `wet` or `dry` in the first case and `unreadable` in the second.
   */
  readonly levels: readonly string[];
};

/**
 * What one log line turned out to be.
 *
 * The three cases are genuinely different evidence: a line that is not a
 * record says nothing, and a record that will not read says the log has a hole
 * in it.
 */
export type LineReading = MeterSample | 'skipped' | 'not-a-record';

/**
 * Everything one log yielded, including what it would not yield.
 */
export type MeterLogReading = {
  /**
   * Samples in the order they appeared.
   */
  readonly samples: readonly MeterSample[];

  /**
   * Records that could not be read.
   *
   * KEPT SO A HOLE IS VISIBLE. A run whose log was truncated mid-line still
   * reports the samples around the hole, and this says the hole is there.
   */
  readonly skippedLines: number;
};

/**
 * Narrows a written word to a meter state.
 *
 * POSITIONAL RATHER THAN DESTRUCTURED, which the repo's object-parameter
 * convention would otherwise ask for: TypeScript refuses a type predicate that
 * names an element of a binding pattern (TS1230), so a guard has to take its
 * subject directly.
 *
 * @param value - word read off the line
 *
 * @returns Whether it names a state a meter can be in
 *
 * @example
 * ```ts
 * if (isMeterState(value,)) { ... }
 * ```
 */
function isMeterState(value: string,): value is MeterState {
  return (METER_STATES as readonly string[]).includes(value,);
}

/**
 * Reads one `name=state` field out of the text after the marker.
 *
 * @param tail - everything after the marker
 *
 * @param name - provider whose field is wanted
 *
 * @returns That provider's state, or that the record does not carry it
 *
 * @example
 * ```ts
 * const state = fieldValue({ tail: 'synthetic=wet hyper=dry', name: 'hyper', },);
 * ```
 */
function fieldValue(
  {
    tail,
    name,
  }: {
    readonly tail: string;
    readonly name: string;
  },
): MeterState | 'absent' {
  for (const field of tail.split(' ',)) {
    /**
     * Where this field's name stops and its state starts.
     */
    const at = field.indexOf(FIELD_SEPARATOR,);

    if ((at === NOT_FOUND) || (field.slice(
      0,
      at,
    ) !== name))
      continue;

    /**
     * Word written after the separator.
     */
    const value = field.slice(at + 1,);

    if (isMeterState(value,))
      return value;

    return 'absent';
  }

  return 'absent';
}

/**
 * Whether the text after the marker opens with a field a record would carry.
 *
 * THE GATE BETWEEN A RECORD AND A SENTENCE. Any log line may mention the
 * marker in prose, and treating those as records that failed to parse would
 * report a hole in an intact log. A record's first field is `name=state`;
 * a sentence's first word is not.
 *
 * @param tail - everything after the marker
 *
 * @returns Whether the first field names a state a meter can be in
 *
 * @example
 * ```ts
 * firstFieldReads({ tail: 'synthetic=wet hyper=dry', },);
 * // => true
 * ```
 */
function firstFieldReads(
  { tail, }: { readonly tail: string; },
): boolean {
  /**
   * First whitespace-separated token after the marker.
   */
  const first = tail.split(' ',)[0] ?? '';

  /**
   * Where that token's name stops and its state starts.
   */
  const at = first.indexOf(FIELD_SEPARATOR,);

  if (at === NOT_FOUND)
    return false;

  return isMeterState(first.slice(at + 1,),);
}

/**
 * Reads every field the record carries that is not one of the two states.
 *
 * DEFINED BY WHAT A VALUE IS NOT, so a field added to the record later is
 * carried through here without this reader being taught its name. The two
 * state fields are exactly the ones whose value names a state a meter can be
 * in; everything else with a separator is a level.
 *
 * @param tail - everything after the marker
 *
 * @returns Level fields verbatim, in the order they were written
 *
 * @example
 * ```ts
 * levelFields({ tail: 'synthetic=wet hyper=dry hyperBalance=0', },);
 * // => ['hyperBalance=0',]
 * ```
 */
function levelFields(
  { tail, }: { readonly tail: string; },
): readonly string[] {
  return tail
    .split(' ',)
    .filter(function isLevel(field,): boolean {
      /**
       * Where this field's name stops and its value starts.
       */
      const at = field.indexOf(FIELD_SEPARATOR,);

      if (at === NOT_FOUND)
        return false;

      return !isMeterState(field.slice(at + 1,),);
    },);
}

/**
 * Reads the bracketed timestamp a console record is prefixed with.
 *
 * The prefix is `[level] [iso] `, so the timestamp is what sits between the
 * second pair of brackets.
 *
 * @param line - whole log line
 *
 * @returns Epoch milliseconds, or that no timestamp could be read
 *
 * @example
 * ```ts
 * const at = stampOf({ line, },);
 * ```
 */
function stampOf(
  { line, }: { readonly line: string; },
): number | 'unstamped' {
  /**
   * End of the level bracket, before which nothing is a timestamp.
   */
  const afterLevel = line.indexOf(']',);

  if (afterLevel === NOT_FOUND)
    return 'unstamped';

  /**
   * Start of the timestamp bracket.
   */
  const opened = line.indexOf(
    '[',
    afterLevel,
  );

  if (opened === NOT_FOUND)
    return 'unstamped';

  /**
   * End of the timestamp bracket.
   */
  const closed = line.indexOf(
    ']',
    opened,
  );

  if (closed === NOT_FOUND)
    return 'unstamped';

  /**
   * Epoch milliseconds the bracket parsed to, or NaN where it is not a date.
   */
  const parsed = Date.parse(line.slice(
    opened + 1,
    closed,
  ),);

  if (Number.isNaN(parsed,))
    return 'unstamped';

  return parsed;
}

/**
 * Reads one log line as a sample, or reports what else it is.
 *
 * @param line - whole log line
 *
 * @returns Sample, `'skipped'` for a record that will not read, or
 * `'not-a-record'` for an ordinary line
 *
 * @example
 * ```ts
 * const read = readMeterLine({ line, },);
 * ```
 */
export function readMeterLine(
  { line, }: { readonly line: string; },
): LineReading {
  /**
   * Where the marker sits, or that this is an ordinary line.
   */
  const markerAt = line.indexOf(METERS_MARKER,);

  if (markerAt === NOT_FOUND)
    return 'not-a-record';

  /**
   * Everything written after the marker.
   */
  const tail = line.slice(markerAt + METERS_MARKER.length,);

  // PROSE MENTIONING THE MARKER IS NOT A TRUNCATED RECORD. Found by reading
  // back a real sample: the sampler's own summary said "the METERS line above
  // is the record", which counted as a record that would not parse and
  // reported a hole in a log that had none. A record is recognised by its
  // first field parsing, which prose does not do, while a record truncated
  // part way through its second field still does and is still counted.
  if (!firstFieldReads({ tail, },))
    return 'not-a-record';

  /**
   * When the reading was taken.
   */
  const at = stampOf({ line, },);

  if (at === 'unstamped')
    return 'skipped';

  /**
   * What the first provider's meter said.
   */
  const synthetic = fieldValue({
    tail,
    name: 'synthetic',
  },);

  /**
   * What the second provider's meter said.
   */
  const hyper = fieldValue({
    tail,
    name: 'hyper',
  },);

  if ((synthetic === 'absent') || (hyper === 'absent'))
    return 'skipped';

  return {
    at,
    synthetic,
    hyper,
    levels: levelFields({ tail, },),
  };
}

/**
 * Reads every sample a log holds.
 *
 * TWO LINEAR PASSES RATHER THAN AN ACCUMULATOR. A pass log runs to thousands
 * of lines, and rebuilding the sample array once per line would make reading
 * one cost the square of its length.
 *
 * @param text - whole log
 *
 * @returns Samples in order, plus how many records would not read
 *
 * @example
 * ```ts
 * const { samples, skippedLines, } = readMeterLog({ text, },);
 * ```
 */
export function readMeterLog(
  { text, }: { readonly text: string; },
): MeterLogReading {
  /**
   * Every line that turned out to be a record, read or skipped.
   */
  const records = text
    .split('\n',)
    .map(function read(line,): LineReading {
      return readMeterLine({ line, },);
    },)
    .filter(function isRecord(reading,): reading is MeterSample | 'skipped' {
      return reading !== 'not-a-record';
    },);

  /**
   * Records that would not read, kept so their count can be reported.
   */
  const skipped = records.filter(function wasSkipped(reading,): boolean {
    return reading === 'skipped';
  },);

  return {
    samples: records.filter(function isSample(reading,): reading is MeterSample {
      return reading !== 'skipped';
    },),
    skippedLines: skipped.length,
  };
}

//endregion Meter sample read

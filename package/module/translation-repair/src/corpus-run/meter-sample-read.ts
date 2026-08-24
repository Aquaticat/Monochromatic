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
// which is three `indexOf` calls and a split. A pattern here would buy nothing
// and would have to be defended under the repo's regex rule.
//
// A LINE THAT CARRIES THE MARKER AND WILL NOT PARSE IS COUNTED, NOT DROPPED.
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
};

/**
 * Everything one log yielded, including what it would not yield.
 */
export type MeterLogReading = {
  /**
   * Samples in the order they appeared.
   */
  readonly samples: readonly MeterSample[];

  /**
   * Lines carrying the marker that could not be read as a sample.
   *
   * KEPT SO A HOLE IS VISIBLE. A run whose log was truncated mid-line still
   * reports the samples around the hole, and this says the hole is there.
   */
  readonly skippedLines: number;
};

/**
 * Narrows a written word to a meter state.
 *
 * @param value - word read off the line
 *
 * @returns Whether it names a state a meter can be in
 *
 * @example
 * ```ts
 * if (isMeterState({ value, },)) { ... }
 * ```
 */
function isMeterState(
  { value, }: { readonly value: string; },
): value is MeterState {
  return (METER_STATES as readonly string[]).includes(value,);
}

/**
 * Reads the bracketed timestamp a console record is prefixed with.
 *
 * The prefix is `[level] [iso] `, so the timestamp is what sits between the
 * second pair of brackets.
 *
 * @param line - whole log line
 *
 * @returns Epoch milliseconds, or absent where no timestamp could be read
 *
 * @example
 * ```ts
 * const at = stampOf({ line, },);
 * ```
 */
function stampOf(
  { line, }: { readonly line: string; },
): number | undefined {
  /**
   * End of the level bracket, before which nothing is a timestamp.
   */
  const afterLevel = line.indexOf(']',);
  if (afterLevel < 0)
    return undefined;

  /**
   * Start of the timestamp bracket.
   */
  const opened = line.indexOf(
    '[',
    afterLevel,
  );
  if (opened < 0)
    return undefined;

  /**
   * End of the timestamp bracket.
   */
  const closed = line.indexOf(
    ']',
    opened,
  );
  if (closed < 0)
    return undefined;

  /**
   * Epoch milliseconds the bracket parsed to, or NaN where it is not a date.
   */
  const parsed = Date.parse(line.slice(
    opened + 1,
    closed,
  ),);

  if (Number.isNaN(parsed,))
    return undefined;

  return parsed;
}

/**
 * Reads the `name=state` fields that follow the marker.
 *
 * @param tail - everything after the marker
 *
 * @returns States by provider name, empty where a field would not read
 *
 * @example
 * ```ts
 * const states = statesIn({ tail: 'synthetic=wet hyper=dry', },);
 * ```
 */
function statesIn(
  { tail, }: { readonly tail: string; },
): Readonly<Record<string, MeterState>> {
  return tail
    .split(' ',)
    .reduce(
      function addField(
        states: Record<string, MeterState>,
        field: string,
      ): Record<string, MeterState> {
        /**
         * Where this field's name stops and its state starts.
         */
        const at = field.indexOf(FIELD_SEPARATOR,);
        if (at < 0)
          return states;

        /**
         * Word written after the separator.
         */
        const value = field.slice(at + 1,);
        if (!isMeterState({ value, },))
          return states;

        return {
          ...states,
          [field.slice(
            0,
            at,
          )]: value,
        };
      },
      {},
    );
}

/**
 * Reads one log line as a sample, or reports that it is not one.
 *
 * Returns `undefined` for a line without the marker, which is almost every
 * line in a run log; `'skipped'` for one that carries the marker and will not
 * read, which is the case worth counting.
 *
 * @param line - whole log line
 *
 * @returns Sample, `'skipped'`, or absent for an ordinary line
 *
 * @example
 * ```ts
 * const read = readMeterLine({ line, },);
 * ```
 */
export function readMeterLine(
  { line, }: { readonly line: string; },
): MeterSample | 'skipped' | undefined {
  /**
   * Where the marker sits, or that this is an ordinary line.
   */
  const markerAt = line.indexOf(METERS_MARKER,);
  if (markerAt < 0)
    return undefined;

  /**
   * When the reading was taken.
   */
  const at = stampOf({ line, },);
  if (at === undefined)
    return 'skipped';

  /**
   * What each named provider's meter said.
   */
  const states = statesIn({ tail: line.slice(markerAt + METERS_MARKER.length,), },);

  /**
   * Both providers' states, absent where the line named neither or one.
   */
  const {
    synthetic,
    hyper,
  } = states;

  if ((synthetic === undefined) || (hyper === undefined))
    return 'skipped';

  return {
    at,
    synthetic,
    hyper,
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
 * @returns Samples in order, plus how many marked lines would not read
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
   * Every line that carried the marker, read or skipped.
   */
  const marked = text
    .split('\n',)
    .map(function read(line,): MeterSample | 'skipped' | undefined {
      return readMeterLine({ line, },);
    },)
    .filter(function carriedMarker(
      read,
    ): read is MeterSample | 'skipped' {
      return read !== undefined;
    },);

  return {
    samples: marked.filter(function isSample(read,): read is MeterSample {
      return read !== 'skipped';
    },),
    skippedLines: marked.filter(function wasSkipped(read,): boolean {
      return read === 'skipped';
    },).length,
  };
}

//endregion Meter sample read

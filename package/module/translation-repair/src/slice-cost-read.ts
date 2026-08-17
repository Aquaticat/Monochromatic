import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import {
  SLICE_COST_MARKER,
  type SliceCostLane,
} from './slice-cost-log.ts';

//region Slice cost read
// Reads back what `armSliceCost` wrote, so a pass's log answers whether a
// slice's cost scales with its size (`#92`).
//
// REFUSES RATHER THAN GUESSES, and says why. A log is written while a pass runs,
// so its last line can be half-written, and a reader that silently skipped
// malformed lines would report a smaller corpus without saying so. Every line
// carrying the marker is either a row or a named refusal.
//
// NO REGEX: the grammar is `key=value` separated by single spaces, which an
// index scan and two splits express directly, in one linear pass over each line.

/**
 * One slice's measured cost.
 *
 * @example
 * ```ts
 * const row: SliceCostRow = { lane: 'repair', chunkIndex: 3, sourceChars: 812, elapsedMs: 45210, };
 * ```
 */
export type SliceCostRow = {
  /**
   * Lane that paid.
   */
  readonly lane: SliceCostLane;

  /**
   * Slice this measures.
   */
  readonly chunkIndex: number;

  /**
   * Size of what was translated.
   */
  readonly sourceChars: number;

  /**
   * Wall time the slice took.
   */
  readonly elapsedMs: number;
};

/**
 * Everything one log said about slice cost, refusals kept beside rows.
 *
 * @example
 * ```ts
 * const reading: SliceCostReading = readSliceCosts({ log, },);
 * ```
 */
export type SliceCostReading = {
  /**
   * Lines that parsed, in the order the log carried them.
   */
  readonly rows: readonly SliceCostRow[];

  /**
   * Why a line carrying the marker produced no row.
   */
  readonly dropped: readonly string[];
};

/**
 * Fields a cost line must carry for a row to be built from it.
 */
const REQUIRED_FIELDS = [
  'lane',
  'chunk',
  'sourceChars',
  'ms',
] as const;

/**
 * Splits one marker-bearing line into its `key=value` pairs.
 *
 * @param line - whole log line, including whatever the logger prefixed
 *
 * @returns Pairs found after the marker, later duplicates overwriting earlier
 *
 * @example
 * ```ts
 * const fields = fieldsOf({ line, },);
 * ```
 */
function fieldsOf({ line, }: { readonly line: string; },): ReadonlyMap<string, string> {
  /**
   * Where the cost report starts, past anything the logger put in front.
   */
  const start = line.indexOf(SLICE_COST_MARKER,);

  /**
   * Report body, with the marker itself dropped.
   */
  const body = line.slice(start + SLICE_COST_MARKER.length,);

  /**
   * Pairs read so far.
   */
  const fields = new Map<string, string>();
  for (const token of body.split(' ',)) {
    /**
     * Where this token separates its name from its value.
     */
    const split = token.indexOf('=',);
    if (split <= 0)
      continue;

    fields.set(
      token.slice(
        0,
        split,
      ),
      token.slice(split + 1,),
    );
  }

  return fields;
}

/**
 * Whether a field's text is a whole number, and what it is when so.
 *
 * DISCRIMINATED rather than a nullish union, because absence and zero are both
 * ordinary answers here: a slice can genuinely cost 0 ms, and a sentinel would
 * make that indistinguishable from a field the log never carried.
 *
 * @example
 * ```ts
 * const read: WholeRead = wholeNumber({ raw, },);
 * ```
 */
type WholeRead = {
  /**
   * Text names a whole number.
   */
  readonly kind: 'whole';

  /**
   * Number it names.
   */
  readonly value: number;
} | {
  /**
   * Text names something else.
   */
  readonly kind: 'not-whole';
};

/**
 * Reads one whole number out of a field's text.
 *
 * @param raw - field value as the log carried it
 *
 * @returns Whole number, or a refusal when the text names something else
 *
 * @example
 * ```ts
 * const ms = wholeNumber({ raw, },);
 * ```
 */
function wholeNumber({ raw, }: { readonly raw: string; },): WholeRead {
  /**
   * Value read as a number, which is `NaN` for anything else.
   */
  const value = Number(raw,);

  return Number.isInteger(value,)
    ? {
      kind: 'whole',
      value,
    }
    : { kind: 'not-whole', };
}

/**
 * Reads a field the caller has already proven is a whole number.
 *
 * @param fields - pairs read off one line
 *
 * @param name - field to read
 *
 * @returns Number it carries
 *
 * @throws {@link Error} when called before validation, which is a programming
 * error rather than a malformed log
 *
 * @example
 * ```ts
 * const ms = provenWhole({ fields, name: 'ms', },);
 * ```
 */
function provenWhole(
  {
    fields,
    name,
  }: {
    readonly fields: ReadonlyMap<string, string>;
    readonly name: string;
  },
): number {
  /**
   * What this field carries, which validation proved is a whole number.
   */
  const read = wholeNumber({ raw: nonNullishOrThrow(fields.get(name,),), },);
  if (read.kind !== 'whole')
    throw new Error(`${name} was read as a number before it was checked to be one`,);

  return read.value;
}

/**
 * What one marker-bearing line yielded: a row, or the reason it yielded none.
 *
 * @example
 * ```ts
 * const read: LineReading = readLine({ fields, },);
 * ```
 */
type LineReading = {
  /**
   * Line parsed.
   */
  readonly kind: 'row';

  /**
   * What it said.
   */
  readonly row: SliceCostRow;
} | {
  /**
   * Line carried the marker and no usable measurement.
   */
  readonly kind: 'dropped';

  /**
   * Which fields failed, and how.
   */
  readonly reason: string;
};

/**
 * Turns one line's fields into a row, or says why they are not one.
 *
 * VALIDATES AND BUILDS TOGETHER, so no field is checked in one place and read in
 * another. Splitting them would leave the reader holding values the type system
 * cannot see were checked, and the usual repair for that is a default, which
 * invents a measurement nothing measured.
 *
 * @param fields - pairs read off one line
 *
 * @returns Row, or the named refusal
 *
 * @example
 * ```ts
 * const read = readLine({ fields, },);
 * ```
 */
function readLine(
  { fields, }: { readonly fields: ReadonlyMap<string, string>; },
): LineReading {
  /**
   * Names that failed, collected in declared order.
   */
  const failed: string[] = [];
  for (const name of REQUIRED_FIELDS) {
    if (!fields.has(name,)) {
      failed.push(`${name} missing`,);
      continue;
    }

    /**
     * Value the line carried for it.
     */
    const raw = nonNullishOrThrow(fields.get(name,),);

    if (name === 'lane') {
      if ((raw !== 'translate') && (raw !== 'repair'))
        failed.push(`lane ${raw}`,);

      continue;
    }

    /**
     * Whether this field's text names a whole number.
     */
    const read = wholeNumber({ raw, },);
    if (read.kind !== 'whole')
      failed.push(`${name} ${raw}`,);
  }

  if (failed.length > 0) {
    return {
      kind: 'dropped',
      reason: failed.join(', ',),
    };
  }

  /**
   * Lane, narrowed by the check just passed.
   */
  const lane: SliceCostLane = (fields.get('lane',) === 'translate') ? 'translate' : 'repair';

  return {
    kind: 'row',
    row: {
      lane,
      chunkIndex: provenWhole({
        fields,
        name: 'chunk',
      },),
      sourceChars: provenWhole({
        fields,
        name: 'sourceChars',
      },),
      elapsedMs: provenWhole({
        fields,
        name: 'ms',
      },),
    },
  };
}

/**
 * Reads every slice cost a log reported.
 *
 * @param log - whole log text, of any length, including lines about other things
 *
 * @returns Rows in log order, beside a named refusal for every marker-bearing
 * line that produced none
 *
 * @example
 * ```ts
 * const { rows, dropped, } = readSliceCosts({ log: await readFile(path, 'utf8',), },);
 * ```
 */
export function readSliceCosts({ log, }: { readonly log: string; },): SliceCostReading {
  /**
   * Rows built so far.
   */
  const rows: SliceCostRow[] = [];

  /**
   * Refusals collected so far.
   */
  const dropped: string[] = [];
  for (const line of log.split('\n',)) {
    if (!line.includes(SLICE_COST_MARKER,))
      continue;

    /**
     * What this line yielded.
     */
    const read = readLine({ fields: fieldsOf({ line, },), },);
    if (read.kind === 'dropped') {
      dropped.push(read.reason,);
      continue;
    }

    rows.push(read.row,);
  }

  return {
    rows,
    dropped,
  };
}

//endregion Slice cost read

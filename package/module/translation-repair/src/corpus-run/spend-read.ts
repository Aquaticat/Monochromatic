import { SPEND_MARKER, } from '../spend-line.ts';

//region Spend read
// Reads `SPEND` lines back out of run logs and totals them per model.
//
// THE OTHER HALF OF `spend-line.ts`, and it imports that module's marker rather
// than restating it, so the writer and the reader cannot drift.
//
// NO REGEX. The line is `[level] [iso] [tag] [tag] SPEND name=value ...`, which
// is one `indexOf` and two splits. Same shape and same discipline as
// `meter-sample-read.ts`, which reads the `METERS` line.
//
// ABSENCE IS A NAMED VALUE, never a nullish union: `'not-a-record'` for a line
// that is not one, `'unreadable'` for a line that is one and will not parse,
// and `'unreported'` for a count the provider never sent.
//
// PROSE MENTIONING THE MARKER IS NOT A RECORD. A run log carries this module's
// own commit messages, task notes and test output, any of which may write the
// word. A record is recognised by its first field parsing, which prose does not
// do, while a record truncated part way through a later field still does and is
// still counted. That trap was found the first time by `meter-sample-read.ts`,
// whose own summary line mentioned its marker and was counted as a hole.
//
// A LINE THAT IS A RECORD AND WILL NOT PARSE IS COUNTED, NOT DROPPED, for the
// same reason: interleaved writes from concurrent stages produce them, and a
// reader that skipped them would report a cleaner record than the one it read.

/**
 * What `indexOf` returns for a marker that is not in the line.
 */
const NOT_FOUND = -1;

/**
 * Value a count carries when the provider sent no usage block.
 */
const UNREPORTED = 'unreported';

/**
 * Field opening every record, checked to tell a record from prose.
 */
const FIRST_FIELD = 'provider=';

/**
 * Providers a record may name, which is also the check that its first field
 * reads.
 */
const PROVIDERS = [
  'synthetic',
  'hyper',
] as const;

/**
 * One call's token counts, or the named absence standing for a provider that
 * reported none.
 */
export type SpendCount = number | typeof UNREPORTED;

/**
 * What one `SPEND` line said.
 *
 * @example
 * ```ts
 * const record: SpendRecord = {
 *   provider: 'hyper',
 *   model: 'qwen3.8-max',
 *   prompt: 5120,
 *   completion: 3072,
 * };
 * ```
 */
export type SpendRecord = {
  /**
   * Meter this call drew on.
   */
  readonly provider: typeof PROVIDERS[number];

  /**
   * Model as the serving provider names it.
   */
  readonly model: string;

  /**
   * Tokens the request consumed.
   */
  readonly prompt: SpendCount;

  /**
   * Tokens the answer produced, thinking included.
   */
  readonly completion: SpendCount;
};

/**
 * What one line turned out to be.
 */
export type SpendLineReading = SpendRecord | 'not-a-record' | 'unreadable';

/**
 * One `name=value` field, split.
 */
type SpendField = {
  /**
   * Text before the separator.
   */
  readonly name: string;

  /**
   * Text after it, empty where the field carried none.
   */
  readonly value: string;
};

/**
 * Splits a `name=value` field, reporting a piece that carries no separator.
 *
 * @param field - one space-delimited piece of the record tail
 *
 * @returns Name and value, or that this piece is not a field
 *
 * @example
 * ```ts
 * const pair = fieldOf({ field: 'provider=hyper', },);
 * ```
 */
function fieldOf(
  { field, }: { readonly field: string; },
): SpendField | 'not-a-field' {
  /**
   * Where the separator sits, or that this piece carries none.
   */
  const at = field.indexOf('=',);

  if (at === NOT_FOUND)
    return 'not-a-field';

  return {
    name: field.slice(
      0,
      at,
    ),
    value: field.slice(at + 1,),
  };
}

/**
 * Reads a count field, keeping a provider's silence as a named value rather
 * than folding it into zero.
 *
 * @param value - what the field carried
 *
 * @returns Count, the named absence, or that the field will not read
 *
 * @example
 * ```ts
 * const prompt = countOf({ value: '5120', },);
 * ```
 */
function countOf(
  { value, }: { readonly value: string; },
): SpendCount | 'unreadable' {
  if (value === UNREPORTED)
    return UNREPORTED;

  // A BLANK STRING READS AS ZERO THROUGH `Number`, which is why emptiness is
  // refused here rather than trusted to the check below it.
  if (value === '')
    return 'unreadable';

  /**
   * Field read as a number, which is NaN for anything that is not one.
   */
  const parsed = Number(value,);

  // WHOLE AND NOT NEGATIVE, because a token count is a count.
  if (!Number.isSafeInteger(parsed,))
    return 'unreadable';

  if (parsed < 0)
    return 'unreadable';

  return parsed;
}

/**
 * Finds the marker where a logger prefix precedes it.
 *
 * @param line - one line of a run log
 *
 * @returns Where the marker word starts, or that the line carries none
 *
 * @example
 * ```ts
 * const at = spacedMarkerIn({ line: '[info] [t] SPEND provider=hyper', },);
 * ```
 */
function spacedMarkerIn(
  { line, }: { readonly line: string; },
): number {
  /**
   * Where the space in front of the marker sits.
   */
  const at = line.indexOf(` ${SPEND_MARKER}`,);

  return (at === NOT_FOUND) ? NOT_FOUND : (at + 1);
}

/**
 * Collects the fields of a record tail, keyed by name.
 *
 * A `Map` RATHER THAN AN OBJECT, because the keys come off a log line and an
 * object would let a line writing `__proto__=` reach the prototype. Nothing in
 * a run log is supposed to do that, which is exactly why the reader must not
 * depend on it not happening.
 *
 * @param fields - space-delimited pieces of the tail
 *
 * @returns Every piece that split, keyed by name
 *
 * @example
 * ```ts
 * const named = namedFields({ fields: ['provider=hyper',], },);
 * ```
 */
function namedFields(
  { fields, }: { readonly fields: readonly string[]; },
): ReadonlyMap<string, string> {
  /**
   * Fields collected so far.
   */
  const named = new Map<string, string>();

  for (const field of fields) {
    /**
     * Name and value of this piece.
     */
    const pair = fieldOf({ field, },);
    if (pair !== 'not-a-field') {
      named.set(
        pair.name,
        pair.value,
      );
    }
  }

  return named;
}

/**
 * Reads one log line as a spend record.
 *
 * @param line - one line of a run log, tag prefix and all
 *
 * @returns Record, or which kind of non-record this line is
 *
 * @example
 * ```ts
 * const read = readSpendLine({ line, },);
 * ```
 */
export function readSpendLine(
  { line, }: { readonly line: string; },
): SpendLineReading {
  /**
   * Where the marker sits, or that this is an ordinary line.
   *
   * ACCEPTED AT THE START OF A LINE OR AFTER A SPACE, so both forms read: the
   * bare line `reportSpend` returns, and the same line once a logger has put
   * its level, stamp and tags in front of it. Demanding the space would refuse
   * the writer's own output.
   */
  const markerAt = line.startsWith(SPEND_MARKER,)
    ? 0
    : spacedMarkerIn({ line, },);

  if (markerAt === NOT_FOUND)
    return 'not-a-record';

  /**
   * Fields written after the marker.
   */
  const fields = line
    .slice(markerAt + SPEND_MARKER.length,)
    .split(' ',);

  // PROSE IS NOT A TRUNCATED RECORD, decided on the first field alone.
  if (!(fields[0] ?? '').startsWith(FIRST_FIELD,))
    return 'not-a-record';

  /**
   * Every field that split, keyed by name.
   */
  const named = namedFields({ fields, },);

  /**
   * Provider named, checked against the ones a record may carry.
   */
  const provider = PROVIDERS.find(function names(candidate,): boolean {
    return candidate === named.get('provider',);
  },);

  /**
   * Model named, absent on a record truncated before it.
   */
  const model = named.get('model',);

  if (provider === undefined)
    return 'unreadable';

  if ((model === undefined) || (model === ''))
    return 'unreadable';

  /**
   * Tokens the request consumed, or that the field will not read.
   */
  const prompt = countOf({ value: named.get('prompt',) ?? '', },);

  /**
   * Tokens the answer produced, or that the field will not read.
   */
  const completion = countOf({ value: named.get('completion',) ?? '', },);

  if (prompt === 'unreadable')
    return 'unreadable';

  if (completion === 'unreadable')
    return 'unreadable';

  return {
    provider,
    model,
    prompt,
    completion,
  };
}

/**
 * What one seat spent across every call a log recorded for it.
 *
 * @example
 * ```ts
 * const spend: SeatSpend = {
 *   provider: 'hyper',
 *   model: 'qwen3.8-max',
 *   calls: 13,
 *   promptTokens: 84_000,
 *   completionTokens: 51_065,
 *   unreportedCalls: 0,
 * };
 * ```
 */
export type SeatSpend = {
  /**
   * Meter these calls drew on.
   */
  readonly provider: SpendRecord['provider'];

  /**
   * Model as the serving provider names it.
   */
  readonly model: string;

  /**
   * Calls the log recorded for this seat, reported or not.
   */
  readonly calls: number;

  /**
   * Prompt tokens summed over the calls that reported any.
   */
  readonly promptTokens: number;

  /**
   * Completion tokens summed over the calls that reported any, thinking
   * included.
   */
  readonly completionTokens: number;

  /**
   * Calls whose provider sent no usage block.
   *
   * CARRIED BESIDE THE TOTALS RATHER THAN FOLDED INTO THEM, because a total
   * over reported calls only is a floor, and a reader has to be able to see how
   * much of the run it is a floor over.
   */
  readonly unreportedCalls: number;
};

/**
 * Everything a set of log lines said about what was spent.
 *
 * @example
 * ```ts
 * const tally = tallySpend({ lines, },);
 * ```
 */
export type SpendTally = {
  /**
   * One entry per provider and model pair, since the same model can be served
   * by both and only one of the two is priced per token.
   */
  readonly seats: readonly SeatSpend[];

  /**
   * Lines that carried the marker and a readable first field but would not
   * parse, counted so a hole in the record cannot pass for an absence of spend.
   */
  readonly unreadableLines: number;
};

/**
 * Totals every spend record in a log, per seat.
 *
 * @param lines - log lines in any order, records and prose mixed
 *
 * @returns Per-seat totals, sorted by completion tokens so the seat that cost
 * the most reads first, plus how many records would not parse
 *
 * @example
 * ```ts
 * const tally = tallySpend({ lines: text.split('\n',), },);
 * ```
 */
export function tallySpend(
  { lines, }: { readonly lines: readonly string[]; },
): SpendTally {
  /**
   * What every line turned out to be, read once so the counts below cannot
   * disagree about which lines were records.
   */
  const readings = lines.map(function readOne(line,): SpendLineReading {
    return readSpendLine({ line, },);
  },);

  /**
   * Records that carried the marker and would not parse.
   */
  const unreadableLines = readings
    .filter(function damaged(reading,): boolean {
      return reading === 'unreadable';
    },)
    .length;

  /**
   * Every line that read as a record.
   */
  const records = readings.filter(function isRecord(reading,): reading is SpendRecord {
    if (reading === 'not-a-record')
      return false;

    return reading !== 'unreadable';
  },);

  /**
   * Running totals keyed by provider and model together.
   */
  const seats = new Map<string, SeatSpend>();

  for (const record of records) {
    /**
     * Key pairing the provider with the model, since one model may be served
     * by both and the two are billed differently.
     */
    const key = `${record.provider} ${record.model}`;

    /**
     * Totals this seat had before this call.
     */
    const running = seats.get(key,) ?? {
      provider: record.provider,
      model: record.model,
      calls: 0,
      promptTokens: 0,
      completionTokens: 0,
      unreportedCalls: 0,
    };

    /**
     * Whether this call reported anything at all.
     */
    const reported = (record.prompt !== UNREPORTED) || (record.completion !== UNREPORTED);

    seats.set(
      key,
      {
        provider: running.provider,
        model: running.model,
        calls: running.calls + 1,
        promptTokens: running.promptTokens
          + ((record.prompt === UNREPORTED) ? 0 : record.prompt),
        completionTokens: running.completionTokens
          + ((record.completion === UNREPORTED) ? 0 : record.completion),
        unreportedCalls: running.unreportedCalls + (reported ? 0 : 1),
      },
    );
  }

  return {
    seats: [...seats.values(),].toSorted(function costliestFirst(
      left,
      right,
    ): number {
      return right.completionTokens - left.completionTokens;
    },),
    unreadableLines,
  };
}

//endregion Spend read

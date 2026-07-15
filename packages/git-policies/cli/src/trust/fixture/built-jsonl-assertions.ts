/**
 * Packed canonical JSONL compatibility assertions.
 *
 * @module
 */

/**
 * Narrows unknown value to non-array record.
 *
 * @param value - unknown parsed JSON value
 *
 * @returns whether value is record object
 */
function isRecordObject(value: unknown,): value is Record<string, unknown> {
  return ((typeof value) === 'object') && (value !== null)
    && (!Array.isArray(value,));
}

/**
 * Parses one canonical compact LF-terminated JSON object.
 *
 * @param text - complete machine stream
 *
 * @param context - assertion label
 *
 * @returns parsed object after exact framing and canonical encoding checks
 *
 * @example
 * ```ts
 * parseJsonObjectLine({ text: '{"ok":true}\n', context: 'sample' });
 * ```
 */
export function parseJsonObjectLine({
  text,
  context,
}: Readonly<{
  text: string;
  context: string;
}>,): Record<string, unknown> {
  if (!text.endsWith('\n',))
    throw new Error(`${context} expected terminal LF\n${text}`,);
  /**
   * Complete compact JSON text without terminal LF.
   */
  const json = text.slice(
    0,
    -1,
  );
  if (json.includes('\n',) || json.includes('\r',))
    throw new Error(`${context} expected one compact JSON object\n${text}`,);
  /**
   * Parsed unknown machine value.
   */
  const value: unknown = JSON.parse(json,);
  if (!isRecordObject(value,))
    throw new Error(`${context} expected one JSON object\n${text}`,);
  if (JSON.stringify(value,) !== json)
    throw new Error(`${context} expected canonical compact JSON encoding\n${text}`,);
  return value;
}

/**
 * Parses canonical compact LF-terminated JSONL objects.
 *
 * @param text - complete nonempty machine stream
 *
 * @param context - assertion label
 *
 * @returns parsed objects in wire order
 *
 * @example
 * ```ts
 * parseJsonObjectLines({ text: '{"sequence":0}\n{"sequence":1}\n', context: 'sample' });
 * ```
 */
export function parseJsonObjectLines({
  text,
  context,
}: Readonly<{
  text: string;
  context: string;
}>,): readonly Record<string, unknown>[] {
  if (!text.endsWith('\n',))
    throw new Error(`${context} expected terminal LF\n${text}`,);
  return text.slice(
    0,
    -1,
  )
    .split('\n',)
    .map(function parseLine(
      line,
      ordinal,
    ) {
      return parseJsonObjectLine({
        text: `${line}\n`,
        context: `${context} line ${String(ordinal,)}`,
      },);
    },);
}

/**
 * Asserts one pure compact LF-terminated JSONL policy event.
 *
 * @param text - complete machine stream
 *
 * @param expectedCode - stable failure code
 *
 * @param context - assertion label
 *
 * @example
 * ```ts
 * assertJsonl({ text: '{"schemaVersion":1,"sequence":0,"type":"engine-failure","code":"x"}\n', expectedCode: 'x', context: 'sample' });
 * ```
 */
export function assertJsonl({
  text,
  expectedCode,
  context,
}: Readonly<{
  text: string;
  expectedCode: string;
  context: string;
}>,): void {
  /**
   * Parsed canonical event objects.
   */
  const events = parseJsonObjectLines({
    text,
    context,
  },);
  if (events.length !== 1)
    throw new Error(`${context} expected one event, got ${String(events.length,)}\n${text}`,);
  /**
   * Sole event selected through array destructuring.
   */
  const [event,] = events;
  if ((event?.schemaVersion !== 1)
    || (event.sequence !== 0)
    || ((typeof event.type) !== 'string')
    || (event.code !== expectedCode))
    throw new Error(`${context} expected schema-one sequence-zero event code ${expectedCode}\n${text}`,);
}

/**
 * Asserts recursive untrust summary names expected affected root.
 *
 * @param text - complete management stdout
 *
 * @param root - expected affected recursive root
 *
 * @param context - assertion label
 *
 * @example
 * ```ts
 * assertAffectedRootSummary({ text: '{"schemaVersion":1,"type":"untrust-summary","removed":true,"affectedRoots":["/repo"]}\n', root: '/repo', context: 'untrust' });
 * ```
 */
export function assertAffectedRootSummary({
  text,
  root,
  context,
}: Readonly<{
  text: string;
  root: string;
  context: string;
}>,): void {
  /**
   * Canonical recursive untrust summary.
   */
  const summary = parseJsonObjectLine({
    text,
    context,
  },);
  /**
   * Recursive roots named by summary.
   */
  const {affectedRoots} = summary;
  if ((summary.schemaVersion !== 1)
    || (summary.type !== 'untrust-summary')
    || (summary.removed !== true)
    || (!Array.isArray(affectedRoots,))
    || (!affectedRoots.includes(root,)))
    throw new Error(`${context} summary mismatch\n${text}`,);
}

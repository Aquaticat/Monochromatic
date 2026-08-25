import { ForbiddenStringsPluginError, } from './errors.ts';

/**
 * Exact warning discriminator emitted by forbidden-strings scanner.
 */
const CACHE_WARNING_TYPE = 'forbidden-strings/cache-warning';

/**
 * Current scanner cache-warning protocol schema.
 */
const CACHE_WARNING_SCHEMA_VERSION = 1;

/**
 * Closed reasons recovered by compiling authoritative text.
 */
const COMPILE_FROM_TEXT_REASONS: ReadonlySet<string> = new Set([
  'missing',
  'cache-root-unavailable',
  'unreadable',
  'source-mismatch',
  'incompatible',
  'invalid',
] as const,);

/**
 * Exact key set accepted from cache-warning JSON.
 */
const CACHE_WARNING_KEYS: ReadonlySet<string> = new Set([
  'reason',
  'recovery',
  'schemaVersion',
  'type',
],);

/**
 * Returns whether unknown value is non-null JSON object rather than array.
 *
 * @param value - Parsed JSON value.
 *
 * @returns Whether value can carry exact warning fields.
 *
 * @example
 * ```ts
 * isJsonRecord({ type: 'warning' });
 * ```
 */
function isJsonRecord(value: unknown,): value is Readonly<Record<string, unknown>> {
  if ((typeof value) !== 'object')
    return false;
  if (value === null)
    return false;
  return !Array.isArray(value,);
}

/**
 * Throws fail-closed malformed-output diagnostic.
 *
 * @param line - Complete scanner stderr line.
 *
 * @param cause - Optional JSON parser failure.
 *
 * @throws Always, because unknown scanner output cannot be ignored.
 */
function malformedWarning(
  {
    line,
    cause,
  }: Readonly<{
    line: string;
    cause?: unknown;
  }>,
): never {
  throw new ForbiddenStringsPluginError(
    `Malformed forbidden-strings scanner output: ${line}`,
    cause === undefined ? undefined : { cause, },
  );
}

/**
 * Validates exact warning keys without allowing protocol expansion.
 *
 * @param record - Parsed warning candidate.
 *
 * @param line - Complete scanner stderr line.
 */
function validateKeys(
  {
    record,
    line,
  }: Readonly<{
    record: Readonly<Record<string, unknown>>;
    line: string;
  }>,
): void {
  /**
   * Actual enumerable warning keys checked against closed schema.
   */
  const keys = Object.keys(record,);
  if (keys.length !== CACHE_WARNING_KEYS.size)
    malformedWarning({ line, },);
  for (const key of keys) {
    if (!CACHE_WARNING_KEYS.has(key,))
      malformedWarning({ line, },);
  }
}

/**
 * Validates closed reason and recovery pairing.
 *
 * @param reason - Parsed reason field.
 *
 * @param recovery - Parsed recovery field.
 *
 * @param line - Complete scanner stderr line.
 */
function validateRecovery(
  {
    reason,
    recovery,
    line,
  }: Readonly<{
    reason: unknown;
    recovery: unknown;
    line: string;
  }>,
): void {
  if ((typeof reason) !== 'string')
    malformedWarning({ line, },);
  if ((typeof recovery) !== 'string')
    malformedWarning({ line, },);
  if (reason === 'write-failed') {
    if (recovery !== 'continue-with-compiled-rules')
      malformedWarning({ line, },);
    return;
  }
  if ((!COMPILE_FROM_TEXT_REASONS.has(reason,)) || (recovery !== 'compile-from-text'))
    malformedWarning({ line, },);
}

/**
 * Parses complete JSON text or converts parser failure to plugin diagnostic.
 *
 * @param line - Complete scanner stderr line.
 *
 * @returns Parsed unknown JSON value.
 */
function parseWarningJson(line: string,): unknown {
  try {
    return JSON.parse(line,);
  }
  catch (error: unknown) {
    return malformedWarning({
      line,
      cause: error,
    },);
  }
}

/**
 * Parses one complete JSON cache warning or reports that line is plain finding syntax.
 *
 * A scanner finding always ends in ` rule=<token>`, so only a line beginning and
 * ending with JSON object delimiters enters this parser. Every complete JSON object
 * must match the exact closed warning schema or fail closed.
 *
 * @param line - Complete nonempty scanner stderr line.
 *
 * @returns Whether line is valid cache warning and should not become a finding.
 *
 * @throws {@link ForbiddenStringsPluginError} for malformed or unknown JSON records.
 *
 * @example
 * ```ts
 * parseCacheWarning('{"type":"forbidden-strings/cache-warning","schemaVersion":1,"reason":"missing","recovery":"compile-from-text"}');
 * ```
 */
export function parseCacheWarning(line: string,): boolean {
  if ((!line.startsWith('{',)) || (!line.endsWith('}',)))
    return false;
  /**
   * Parsed warning candidate retained as unknown until record narrowing.
   */
  const parsed = parseWarningJson(line,);
  if (!isJsonRecord(parsed,))
    malformedWarning({ line, },);
  validateKeys({
    record: parsed,
    line,
  },);
  if ((parsed.type !== CACHE_WARNING_TYPE)
    || (parsed.schemaVersion !== CACHE_WARNING_SCHEMA_VERSION))
    malformedWarning({ line, },);
  validateRecovery({
    reason: parsed.reason,
    recovery: parsed.recovery,
    line,
  },);
  return true;
}

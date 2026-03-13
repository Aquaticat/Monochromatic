/** Maximum preview length for inspect output */
const INSPECT_PREVIEW_LENGTH = 200;

/**
 * Logs the current value and returns it unchanged (a debug tap).
 * Preserves the input type so it can be inserted anywhere in a pipeline
 * without breaking type inference.
 *
 * @param value - Value to log and pass through
 *
 * @returns Same value, unmodified
 */
export function inspect<const TValue>(value: TValue): TValue {
  /** Stringified representation for logging */
  const preview = typeof value === 'string'
    ? value
    : JSON.stringify(value, null, 2);
  console.log(
    `[file-enforcer] inspect: ${preview.length > INSPECT_PREVIEW_LENGTH ? `${preview.slice(0, INSPECT_PREVIEW_LENGTH)}...` : preview}`,
  );
  return value;
}

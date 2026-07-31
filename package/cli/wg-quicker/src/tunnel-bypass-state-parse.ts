import { BypassStateError, } from './errors.ts';
import type { BypassState, } from './tunnel-bypass-types.ts';

/**
 * Largest unsigned integer accepted by Linux mark,
 * route table,
 * and rule preference fields.
 */
const MAX_UINT32 = 0xFF_FF_FF_FF;

/**
 * Linux interface-name byte limit excluding terminating null.
 */
const MAX_INTERFACE_NAME_BYTES = 15;

/**
 * Checks unknown object shape.
 *
 * @param value - Candidate JSON value.
 *
 * @returns Whether value supports field guards.
 *
 * @example
 * ```ts
 * isRecord({ version: 1 }); // true
 * ```
 */
function isRecord(value: unknown,): value is Record<PropertyKey, unknown> {
  return ((typeof value) === 'object') && (value !== null);
}

/**
 * Checks finite unsigned integer range.
 *
 * @param value - Candidate numeric field.
 *
 * @returns Whether Linux integer field can represent value.
 *
 * @example
 * ```ts
 * isUint32(52000); // true
 * ```
 */
function isUint32(value: unknown,): value is number {
  return ((typeof value) === 'number')
    && Number.isInteger(value,)
    && (value >= 0)
    && (value <= MAX_UINT32);
}

/**
 * Checks persisted interface identity against Linux naming bounds.
 *
 * @param value - Candidate interface name.
 *
 * @returns Whether name is nonempty,
 * slash-free,
 * null-free,
 * and within kernel byte limit.
 *
 * @example
 * ```ts
 * isInterfaceName('wg0'); // true
 * ```
 */
function isInterfaceName(value: unknown,): value is string {
  return ((typeof value) === 'string')
    && (value !== '')
    && (!value.includes('/',))
    && (!value.includes('\0',))
    && (Buffer.byteLength(
      value,
      'utf8',
    ) <= MAX_INTERFACE_NAME_BYTES);
}

/**
 * Checks nonempty ownership identity.
 *
 * @param value - Candidate owner token.
 *
 * @returns Whether token can distinguish lock ownership.
 *
 * @example
 * ```ts
 * isOwnerId('owner'); // true
 * ```
 */
function isOwnerId(value: unknown,): value is string {
  return ((typeof value) === 'string') && (value !== '');
}

/**
 * Parses JSON with application-state diagnostic identity.
 *
 * @param text - JSON state text.
 *
 * @param path - Path named in diagnostics.
 *
 * @returns Parsed unknown value.
 *
 * @throws {@link BypassStateError} when JSON is malformed.
 *
 * @example
 * ```ts
 * parseStateJson({ text: '{}', path: '/tmp/state' });
 * ```
 */
function parseStateJson(
  {
    text,
    path,
  }: {
    readonly text: string;
    readonly path: string;
  },
): unknown {
  try {
    return JSON.parse(text,);
  }
  catch (error) {
    throw new BypassStateError(
      `Invalid application-bypass state JSON at ${path}: ${String(error,)}`,
    );
  }
}

/**
 * Parses and validates persisted bypass state.
 *
 * @param text - JSON state text.
 *
 * @param path - Path named in diagnostics.
 *
 * @returns Validated state.
 *
 * @throws {@link BypassStateError} when JSON or state shape is invalid.
 *
 * @example
 * ```ts
 * parseBypassState({ text: '{"version":1}', path: '/tmp/state' });
 * ```
 *
 * @internal
 */
export function parseBypassState(
  {
    text,
    path,
  }: {
    readonly text: string;
    readonly path: string;
  },
): BypassState {
  /**
   * Parsed JSON before field validation.
   */
  const value: unknown = parseStateJson({
    text,
    path,
  },);
  if ((!isRecord(value,))
    || (value.version !== 1)
    || (!isInterfaceName(value.interfaceName,))
    || (!isUint32(value.mark,))
    || (value.mark === 0)
    || (!isUint32(value.table,))
    || (value.table === 0)
    || (!isUint32(value.preference,))
    || (value.preference === 0)
    || (!isOwnerId(value.ownerId,))) {
    throw new BypassStateError(`Invalid application-bypass state: ${path}`,);
  }
  return {
    version: 1,
    interfaceName: value.interfaceName,
    mark: value.mark,
    table: value.table,
    preference: value.preference,
    ownerId: value.ownerId,
  };
}

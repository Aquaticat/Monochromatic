/**
 Closed data readers for original prerequisite evidence.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { readPolicyRecord, } from './policy-data.ts';

//region Data readers never invoke submitted accessors

/**
 Original prerequisite evidence is unavailable, malformed, mismatched or stale.
 */
export class AuthorizationEvidenceError extends Error {
  /** Stable diagnostic identity does not assert policy permission. */
  override readonly name = 'AuthorizationEvidenceError';
}

/**
 Runtime method shape remains deliberately untrusted until its owner is bound.
 */
type EvidenceMethod = (...args: readonly unknown[]) => unknown;

/**
 Structural diagnostics omit source text and submitted evidence.
 */
const l = tagged({ tag: 'auto-mode-authorization-evidence-data', },);

/**
 Copy exactly the expected own data fields, retaining nested values as untrusted.

 @param input - original record whose getters must not be evaluated
 @param fields - complete expected field membership
 @returns copied values requiring domain-specific validation
 @throws AuthorizationEvidenceError for missing, extra or non-data fields
 */
export function readAuthorizationRecord(
  { input, fields, }: { readonly input: unknown; readonly fields: readonly string[] },
): Readonly<Record<string, unknown>> {
  /** Trace record shape checks without publishing its values. */
  const rl = tagged({ tag: readAuthorizationRecord.name, l, },);
  rl.debug('checking original authorization record shape',);
  try {
    /** The incumbent data reader rejects proxy, prototype and accessor traps. */
    const record = readPolicyRecord({ input, fields, },);
    if (fields.some(function absent(field,) { return !Object.hasOwn(record, field,); },))
      throw new AuthorizationEvidenceError('Authorization evidence has missing fields',);
    return record;
  }
  catch (error) {
    throw new AuthorizationEvidenceError(
      'Authorization evidence requires exactly its expected enumerable data properties',
      { cause: error, },
    );
  }
}

/**
 Narrow callable shape without invoking the borrowed method.

 @param input - borrowed capability candidate
 @returns whether invocation is structurally supported
 */
function isEvidenceMethod(input: unknown,): input is EvidenceMethod {
  return typeof input === 'function';
}

/**
 Capture original owner method identities without freezing their borrowed container.

 @param input - bootstrap-selected owner, never model metadata
 @returns original capture and freshness methods
 @throws AuthorizationEvidenceError for unsupported owner methods
 */
export function readAuthorizationOwner(input: unknown,): {
  readonly capture: EvidenceMethod;
  readonly assertCurrent: EvidenceMethod;
} {
  /** Owner checks remain distinct from original-evidence checks. */
  const rl = tagged({ tag: readAuthorizationOwner.name, l, },);
  rl.debug('checking original authorization owner methods',);
  /** Fields are copied before callable narrowing. */
  const methods = readAuthorizationRecord({ input, fields: ['capture', 'assertCurrent',], },);
  if (!isEvidenceMethod(methods.capture,) || !isEvidenceMethod(methods.assertCurrent,))
    throw new AuthorizationEvidenceError('Authorization owner needs capture and freshness capabilities',);
  return Object.freeze({ capture: methods.capture, assertCurrent: methods.assertCurrent, },);
}

//endregion Closed data readers

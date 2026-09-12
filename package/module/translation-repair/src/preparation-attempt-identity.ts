//region Canonical independently supplied namespace identity

/** Lowercase output grammar shared by SHA-256 hex and generated UUID components. */
const LOWER_HEX = '0123456789abcdef';
/** SHA-256 digest text extent. */
const DIGEST_CHARACTERS = 64;
/** Generated UUID's bounded text extent. */
const UUID_CHARACTERS = 36;
/** UUID segment lengths in the generated namespace representation. */
const UUID_SEGMENT_LENGTHS = [8, 4, 4, 4, 12,] as const;

/**
 * Recognizes canonical UUID-v4/SHA-256 identity and independently measured plan extent before filesystem work.
 * This validates metadata grammar, not root-plan semantics or creation provenance.
 * @param attemptId - independently supplied generated UUID
 * @param rootPlanDigest - independently supplied exact plan digest
 * @param rootPlanBytes - measured UTF-8 extent from namespace creation
 * @returns Whether marker reconstruction and total plan read have finite canonical inputs
 * @example
 * ```ts
 * const valid = validPreparationAttemptIdentity({ attemptId, rootPlanDigest, rootPlanBytes });
 * ```
 */
export function validPreparationAttemptIdentity({ attemptId, rootPlanDigest, rootPlanBytes, }: {
  readonly attemptId: string;
  readonly rootPlanDigest: string;
  readonly rootPlanBytes: number;
},): boolean {
  if (((typeof attemptId) !== 'string') || (attemptId.length !== UUID_CHARACTERS)
    || ((typeof rootPlanDigest) !== 'string') || (rootPlanDigest.length !== DIGEST_CHARACTERS)
    || (!Number.isSafeInteger(rootPlanBytes,)) || (rootPlanBytes < 2))
    return false;
  /** Canonical components bound every subsequent string scan. */
  const parts = attemptId.split('-',);
  if ((parts.length !== UUID_SEGMENT_LENGTHS.length)
    || parts.some(function invalid(part, index,): boolean {
      return (part.length !== UUID_SEGMENT_LENGTHS[index]) || [...part,].some(function nonHex(character,): boolean { return !LOWER_HEX.includes(character,); },);
    },)
    || (parts[2]?.[0] !== '4'))
    return false;
  /** Variant presence follows the checked shape and is still narrowed explicitly for typed access. */
  const variant = parts[3]?.[0];
  if ((variant === undefined) || (!'89ab'.includes(variant,)))
    return false;
  return [...rootPlanDigest,].every(function hex(character,): boolean { return LOWER_HEX.includes(character,); },);
}

//endregion Canonical independently supplied namespace identity

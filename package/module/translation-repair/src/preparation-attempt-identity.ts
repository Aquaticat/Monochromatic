//region Canonical independently supplied namespace identity

/**
 * Lowercase output grammar shared by SHA-256 hex and generated UUID components.
 */
const LOWER_HEX = '0123456789abcdef';
/**
 * SHA-256 digest text extent.
 */
const DIGEST_CHARACTERS = 64;
/**
 * Generated UUID's bounded text extent.
 */
const UUID_CHARACTERS = 36;
/**
 * Leading UUID group extent.
 */
const UUID_FIRST_SEGMENT = 8;
/**
 * Repeated middle UUID group extent.
 */
const UUID_MIDDLE_SEGMENT = 4;
/**
 * Trailing UUID group extent.
 */
const UUID_LAST_SEGMENT = 12;
/**
 * UUID group carrying the variant nibble.
 */
const UUID_VARIANT_SEGMENT_INDEX = 3;
/**
 * UUID segment lengths in the generated namespace representation.
 */
const UUID_SEGMENT_LENGTHS = [
  UUID_FIRST_SEGMENT,
  UUID_MIDDLE_SEGMENT,
  UUID_MIDDLE_SEGMENT,
  UUID_MIDDLE_SEGMENT,
  UUID_LAST_SEGMENT,
] as const;

/**
 * Checks bounded ASCII hex without treating Unicode graphemes as interchangeable identity characters.
 *
 * @param text - component whose length has already been bounded
 *
 * @returns Whether every code unit belongs to canonical lowercase hex
 *
 * @example
 * ```ts
 * const valid = lowerHex('1a2b');
 * ```
 */
function lowerHex(text: string,): boolean {
  // The cursor belongs only to this bounded scan.
  for (let offset = 0; offset < text.length; offset += 1) {
    if (!LOWER_HEX.includes(text.charAt(offset,),))
      return false;
  }
  return true;
}

/**
 * Recognizes canonical UUID-v4/SHA-256 identity and independently measured plan extent before filesystem work.
 * This validates metadata grammar, not root-plan semantics or creation provenance.
 *
 * @param attemptId - independently supplied generated UUID
 *
 * @param rootPlanDigest - independently supplied exact plan digest
 *
 * @param rootPlanBytes - measured UTF-8 extent from namespace creation
 *
 * @returns Whether marker reconstruction and total plan read have finite canonical inputs
 *
 * @example
 * ```ts
 * const valid = validPreparationAttemptIdentity({ attemptId, rootPlanDigest, rootPlanBytes });
 * ```
 */
export function validPreparationAttemptIdentity({
  attemptId,
  rootPlanDigest,
  rootPlanBytes,
}: {
  readonly attemptId: string;
  readonly rootPlanDigest: string;
  readonly rootPlanBytes: number;
},): boolean {
  if (((typeof attemptId) !== 'string') || (attemptId.length !== UUID_CHARACTERS)
    || ((typeof rootPlanDigest) !== 'string')
    || (rootPlanDigest.length !== DIGEST_CHARACTERS)
    || (!Number.isSafeInteger(rootPlanBytes,))
    || (rootPlanBytes < 2))
    return false;
  /**
   * Canonical components bound every subsequent string scan.
   */
  const parts = attemptId.split('-',);
  if ((parts.length !== UUID_SEGMENT_LENGTHS.length)
    || parts.some(function invalid(
      part,
      index,
    ): boolean {
      return (part.length !== UUID_SEGMENT_LENGTHS[index]) || (!lowerHex(part,));
    },)
    || (parts[2]?.[0] !== '4'))
    return false;
  /**
   * Variant presence follows the checked shape and is still narrowed explicitly for typed access.
   */
  const variant = parts[UUID_VARIANT_SEGMENT_INDEX]?.[0];
  if ((variant === undefined) || (!'89ab'.includes(variant,)))
    return false;
  return lowerHex(rootPlanDigest,);
}

//endregion Canonical independently supplied namespace identity

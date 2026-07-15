/**
 * Manual-push probe internal contracts.
 *
 * @module
 */

/**
 * Git-native push update plus destination used for authority query.
 */
export type ProbedPushUpdate = Readonly<{
  /**
   * Local source ref expression reported by Git.
   */
  localRef: string;
  /**
   * Local object ID reported by Git.
   */
  localOid: string;
  /**
   * Destination remote location used by Git.
   */
  remoteLocation: string;
  /**
   * Destination name supplied to pre-push hook.
   */
  remoteName: string;
  /**
   * Advertised remote object ID reported by push negotiation.
   */
  advertisedRemoteOid: string;
  /**
   * Fully qualified destination ref.
   */
  remoteRef: string;
}>;

/**
 * Manual-push discovery failure.
 */
export class ManualPushProbeError extends Error {
  /**
   * Creates stable update-discovery failure.
   *
   * @param message - safe failure explanation
   *
   * @param options - optional cause
   *
   * @mutates options through super global Error options cause access
   */
  public constructor(
    message: string,
    options?: ErrorOptions,
  ) {
    super(
      message,
      options,
    );
    this.name = 'ManualPushProbeError';
  }
}

/**
 * Reports whether object ID is Git's format-width zero sentinel.
 *
 * @param oid - object ID text
 *
 * @returns whether every character is zero
 *
 * @example
 * ```ts
 * isZeroOid('0000');
 * ```
 */
export function isZeroOid(oid: string,): boolean {
  if (oid.length === 0)
    return false;
  for (let index = 0; index < oid.length; index += 1) {
    if (oid.charAt(index,) !== '0')
      return false;
  }
  return true;
}

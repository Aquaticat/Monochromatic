//region Translation repair interruption

/**
 * Operational stop when an absent passage cannot form another unique repair task.
 *
 * This preserves latest findings for resumed stage work.
 * It is not quality verdict and does not authorize publication.
 *
 * @example
 * ```ts
 * throw new TranslationRepairInterruptedError({
 *   reason: 'production-cycle',
 *   findings: [],
 * },);
 * ```
 */
export class TranslationRepairInterruptedError extends Error {
  /**
   * Declares message safe because reason is closed operation vocabulary.
   */
  readonly messageNamesOnly: true = true;

  /**
   * Latest stage findings available when repair paused.
   */
  public readonly findings: readonly string[];

  /**
   * Constructs operation-only interruption without source or candidate wording.
   *
   * @param reason - named stage state preventing unique continuation
   *
   * @param findings - latest structured evidence for resumed repair
   *
   * @example
   * ```ts
   * new TranslationRepairInterruptedError({
   *   reason: 'insertion-placement-unresolved',
   *   findings: [],
   * },);
   * ```
   */
  public constructor(
    {
      reason,
      findings,
    }: {
      readonly reason:
        | 'carried-evidence-lost'
        | 'insertion-placement-unresolved'
        | 'production-cycle'
        | 'provider-unavailable';
      readonly findings: readonly string[];
    },
  ) {
    super(`translation repair interrupted: ${reason}`,);
    this.name = 'TranslationRepairInterruptedError';
    this.findings = findings;
  }
}

//endregion Translation repair interruption

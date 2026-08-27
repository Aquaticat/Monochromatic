//region Pass entry contract
// Shapes shared by corpus scheduling and one-entry settlement.

/**
 * Whether one entry reached its artifact.
 *
 * @example
 * ```ts
 * const outcome: EntryOutcome = { kind: 'settled', };
 * ```
 */
export type EntryOutcome = {
  /**
   * Artifact was written after all stages and publication completed.
   */
  readonly kind: 'settled';
} | {
  /**
   * Entry raised or hit its ceiling, and no artifact exists for it.
   */
  readonly kind: 'failed';
};

/**
 * One eligible corpus pair with its text loaded.
 *
 * @example
 * ```ts
 * const entry: CorpusPair = { id: 'CatEntry', sourceText: '猫。', targetText: 'Cat.' };
 * ```
 */
export type CorpusPair = {
  /**
   * Person entry id.
   */
  readonly id: string;

  /**
   * Original Chinese page text.
   */
  readonly sourceText: string;

  /**
   * English archive page text.
   */
  readonly targetText: string;
};

//endregion Pass entry contract

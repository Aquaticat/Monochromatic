//region Frozen selection identity, not acquisition approval

/**
 * Parent identity encoded by the independently frozen task40 selection.
 *
 * @example
 * ```ts
 * const parent: FrozenPreparationParent = { parentId, entryId, sourceIndex: 0, targetIndex: 0 };
 * ```
 */
export type FrozenPreparationParent = {
  /**
   * Exact ordered identifier from the frozen selection.
   */
  readonly parentId: string;
  /**
   * Corpus entry directory component, not a generated display name.
   */
  readonly entryId: string;
  /**
   * Initial source section, not final child coordinates.
   */
  readonly sourceIndex: number;
  /**
   * Initial target section, not a later receipt-selected parent.
   */
  readonly targetIndex: number;
};

/**
 * Supporting artifact whose bytes must still be verified before root materialization.
 *
 * @example
 * ```ts
 * const reference: FrozenPreparationReference = { path, hash };
 * ```
 */
export type FrozenPreparationReference = {
  /**
   * Original artifact locator retained as data, never executed or treated as an instruction.
   */
  readonly path: string;
  /**
   * Exact expected raw-byte SHA-256 from the frozen selection.
   */
  readonly hash: string;
};

/**
 * Reading-derived source obligations preserved independently of incumbent factual accuracy.
 *
 * @example
 * ```ts
 * const obligation: FrozenPreparationObligation = { parentId, requiredContext, pictureEvidenceNeeded: true, scopeQualificationOpen: true };
 * ```
 */
export type FrozenPreparationObligation = {
  /**
   * Frozen parent whose output/context coverage remains to be established.
   */
  readonly parentId: string;
  /**
   * Authored reading notes, not implicit model prompts or call permission.
   */
  readonly requiredContext: readonly string[];
  /**
   * Existing reading identified a picture-source obligation.
   */
  readonly pictureEvidenceNeeded: boolean;
  /**
   * A known scope obligation remains unresolved; it cannot be silently discarded.
   */
  readonly scopeQualificationOpen: boolean;
};

/**
 * Parsed identity of the frozen parent selection, without reference verification or root/phase approval.
 * This is a partial identity projection. The whole-artifact digest binds unprojected nested fields,
 * full population/exclusion evidence and the sampler recipe; this reader does not validate them as a root plan.
 *
 * @example
 * ```ts
 * const selection = readFrozenPreparationSelection({ text, expectedDigest, l });
 * ```
 */
export type FrozenPreparationSelection = {
  /**
   * Visible distinction from a materialized or reviewed acquisition plan.
   */
  readonly scope: 'frozen-selection-identity';
  /**
   * Independently expected digest checked before JSON interpretation.
   */
  readonly digest: string;
  /**
   * Exact UTF-8 extent of the supplied serialized artifact.
   */
  readonly bytes: number;
  /**
   * Pinned corpus identity; checkout location does not become semantic root identity.
   */
  readonly corpusCommitSha: string;
  /**
   * Frozen eligible population, never resampled here.
   */
  readonly populationDigest: string;
  /**
   * Frozen ordered parent pool whose bytes are checked by the next boundary.
   */
  readonly poolDigest: string;
  /**
   * Exact initial parent sequence, not final prepared writing units.
   */
  readonly parents: readonly FrozenPreparationParent[];
  /**
   * Complete unexecuted reference inventory for subsequent byte and role binding.
   */
  readonly references: readonly FrozenPreparationReference[];
  /**
   * Source-reading obligations retain their original order and unresolved flags.
   */
  readonly obligations: readonly FrozenPreparationObligation[];
  /**
   * Original selection implementation identity, separate from acquisition runtime.
   */
  readonly selectionRuntimeDigest: string;
  /**
   * Node used when the parent selection was frozen, not a required current executable.
   */
  readonly samplerNodeVersion: string;
  /**
   * Recorded ICU version relevant to historical locale ordering.
   */
  readonly samplerIcuVersion: string;
  // Remaining sampler configuration stays bound solely by the independently expected whole-artifact digest.
};

//endregion Frozen selection identity, not acquisition approval

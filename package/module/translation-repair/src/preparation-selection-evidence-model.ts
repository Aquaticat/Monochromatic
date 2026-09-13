import type { FrozenPreparationSelection, } from './preparation-selection-model.ts';

//region Supporting bytes matched to independent frozen selection

/**
 * Caller-loaded artifact bytes with their original frozen locator, not an instruction to open a path.
 * @example
 * ```ts
 * const input: PreparationArtifactInput = { path, content };
 * ```
 */
export type PreparationArtifactInput = {
  /** Exact locator named by the frozen reference inventory. */
  readonly path: string;
  /** Raw bytes before any decoding or normalization. */
  readonly content: Readonly<Uint8Array>;
};

/**
 * Owned byte snapshot matched to one frozen reference, without semantic role or approval authority.
 * @example
 * ```ts
 * const artifact: MatchedPreparationArtifact = { path, hash, bytes: content.length, content };
 * ```
 */
export type MatchedPreparationArtifact = {
  /** Original locator retained only as data; the verifier does not read or execute it. */
  readonly path: string;
  /** Independently recorded expected hash matched against the owned bytes. */
  readonly hash: string;
  /** Exact raw-byte extent, including zero for a genuinely empty supporting artifact. */
  readonly bytes: number;
  /** Owned snapshot; later caller changes to source buffers cannot change the matched bytes. */
  readonly content: Readonly<Uint8Array>;
};

/**
 * Complete supporting-byte inventory in frozen reference order, not a semantic correspondence root or approval.
 * @example
 * ```ts
 * const evidence = readPreparationSelectionEvidence({ text, expectedDigest, artifacts, l });
 * ```
 */
export type PreparationSelectionEvidence = {
  /** Identity and byte equality only; role derivation, corpus rebuilding and review remain separate. */
  readonly scope: 'matched-selection-artifacts';
  /** Independently matched selection projection, re-read by this owning operation. */
  readonly selection: FrozenPreparationSelection;
  /** Every reference appears exactly once in the selection's original order. */
  readonly artifacts: readonly MatchedPreparationArtifact[];
};

//endregion Supporting bytes matched to independent frozen selection

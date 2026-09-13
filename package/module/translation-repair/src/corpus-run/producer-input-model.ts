import type { ProducerInputFileIdentity, } from './producer-input-file.ts';

//region Fixed provider-free preparation input launch contract

/**
 * A host locator and independently recorded raw identity, not a command to execute from model output.
 *
 * @example
 * ```ts
 * const file: ProducerInputLocatedFile = { path, bytes, sha256 };
 * ```
 */
export type ProducerInputLocatedFile = ProducerInputFileIdentity & {
  /** Canonical absolute host locator, validated before mount construction. */
  readonly path: string;
};

/**
 * Closed launch inputs for one provider-free native reconstruction.
 * No arbitrary command, application entry, environment map or live mode is accepted.
 *
 * @example
 * ```ts
 * const launch: ProducerInputLaunch = { version: 1, kind: 'producer-preparation-input-launch', bootstrap, podman, imageId, runtime, atomicLibrary, selection, supporting, corpus, outputParent };
 * ```
 */
export type ProducerInputLaunch = {
  /** Only the initial launch schema is implemented. */
  readonly version: 1;
  /** This contract never authorizes correspondence acquisition or writer execution. */
  readonly kind: 'producer-preparation-input-launch';
  /** Identity of the separately reviewed single-file bootstrap being invoked. */
  readonly bootstrap: ProducerInputFileIdentity;
  /** Host Podman invocation belongs to the trusted launcher, not to application data. */
  readonly podman: ProducerInputLocatedFile;
  /** Exact lowercase image ID returned by local Podman, never a tag or pull instruction. */
  readonly imageId: string;
  /** Frozen application execution directory contains runtime files and its manifest only. */
  readonly runtime: {
    /** Canonical absolute host directory copied from a fresh sealed build. */
    readonly dir: string;
    /** Independently recorded manifest identity, not a self-approved build description. */
    readonly manifest: ProducerInputFileIdentity;
  };
  /** The measured Linux GNU Node target needs this explicitly bound default-path library. */
  readonly atomicLibrary: ProducerInputLocatedFile;
  /** Task40's original selection is separately bound before any supporting locator is followed. */
  readonly selection: ProducerInputLocatedFile;
  /** One explicitly authorized root supplies only the selection's exact reference inventory. */
  readonly supporting: {
    /** Canonical absolute host directory used for lexical-to-container locator mapping. */
    readonly dir: string;
    /** Caller-authorized aggregate allowance, not the earlier probe's implicit global ceiling. */
    readonly maximumBytes: number;
  };
  /** Native Git reads only the separately authorized immutable corpus commit. */
  readonly corpus: {
    /** Canonical absolute host clone directory, mounted read-only. */
    readonly dir: string;
    /** Existing task40 corpus identity; current policy reconstruction checks it independently. */
    readonly commitSha: string;
  };
  /** Existing private caller-owned directory under which a fresh run is created exclusively. */
  readonly outputParent: string;
};

/**
 * Complete producer-input output remains unqualified evidence despite its durable identity.
 *
 * @example
 * ```ts
 * const completion: ProducerInputCompletion = { version: 1, kind: 'producer-preparation-input-complete', runId, launchSha256, artifact, parentCount, registrationCount };
 * ```
 */
export type ProducerInputCompletion = {
  /** Fixed completion representation. */
  readonly version: 1;
  /** Completion of input reconstruction, not model or phase approval. */
  readonly kind: 'producer-preparation-input-complete';
  /** Exclusive input-run identity remains separate from preparation-attempt identity. */
  readonly runId: string;
  /** Exact independently bound launch used by this run. */
  readonly launchSha256: string;
  /** Raw output identity names one fixed unqualified artifact file. */
  readonly artifact: ProducerInputFileIdentity & {
    /** No caller-selected output filename is accepted. */
    readonly file: 'unqualified-inputs.json';
  };
  /** Observed frozen parent count does not establish writer eligibility. */
  readonly parentCount: number;
  /** Initial structural/correspondence scope count does not authorize calls. */
  readonly registrationCount: number;
};

//endregion Fixed provider-free preparation input launch contract

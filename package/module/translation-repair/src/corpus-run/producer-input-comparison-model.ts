import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ProducerInputFileIdentity, } from './producer-input-file.ts';

//region One fixed reconstruction comparison, never a plan or acquisition certificate

/**
 * Caller authority for one fresh invocation of the independently authenticated input bootstrap.
 * The caller authenticates its own host program and Node before execution;
 * file identities do not authenticate their creator or approve an acquisition phase.
 *
 * @example
 * ```ts
 * const request: ProducerInputComparisonRequest = { launchPath, launchIdentity, bootstrapPath, reference, signal, l };
 * ```
 */
export type ProducerInputComparisonRequest = {
  /** Exact authorized input launch, not a command or application entry selector. */
  readonly launchPath: string;
  /** Independently recorded raw launch identity. */
  readonly launchIdentity: ProducerInputFileIdentity;
  /** Frozen standalone producer-prepare.mjs whose bytes the launch binds. */
  readonly bootstrapPath: string;
  /** Separately retained unqualified-input identity, never inferred from the new output. */
  readonly reference: ProducerInputFileIdentity;
  /** Caller cancellation remains distinct from successful artifact reconstruction. */
  readonly signal: AbortSignal;
  /** Names-only operation telemetry stays with the invoking owner. */
  readonly l: Logger;
};

/**
 * Matched files remain unqualified and require separate root/phase review before clients may be constructed.
 * The owning operation must reconstruct these files rather than accept caller node tables.
 * This structural type does not authenticate its creator or certify that operation.
 *
 * @example
 * ```ts
 * const artifactPath = result.artifact.path;
 * ```
 */
export type ProducerInputComparisonResult = {
  /** Byte parity is not semantic review or model-call permission. */
  readonly scope: 'matched-unqualified-input-files';
  /** Private comparison namespace, separate from the completed input-run namespace. */
  readonly directory: string;
  /** Fresh input run retained even if subsequent planning fails. */
  readonly inputRunDirectory: string;
  /** The native exclusive run identity, not a preparation acquisition-attempt ID. */
  readonly inputRunId: string;
  /** Independently matched launch remains explicit beside the fresh run. */
  readonly launchIdentity: ProducerInputFileIdentity;
  /** Existing raw artifact bytes, not reserialized caller data. */
  readonly artifact: ProducerInputFileIdentity & {
    /** Fixed file inside the freshly verified input run. */
    readonly path: string;
  };
};

//endregion One fixed reconstruction comparison, never a plan or acquisition certificate

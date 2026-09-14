import type { BigIntStats, } from 'node:fs';
import type { Logger, LoggerCallbackName, } from '@monochromatic-dev/module-logger/ts';
import type { ProducerInputFileIdentity, } from './producer-input-file.ts';
import type { ProducerInputLaunch, } from './producer-input-model.ts';

//region One fixed reconstruction comparison, never a plan or acquisition certificate

/**
 Caller authority for one fresh invocation of the independently authenticated input bootstrap.
 The caller authenticates its own host program and Node before execution;
 file identities do not authenticate their creator or approve an acquisition phase.
 
 @example
 ```ts
 const request: ProducerInputComparisonRequest = { baseLaunchPath, baseLaunchIdentity, bootstrapPath, reference, signal, l };
 ```
 */
export type ProducerInputComparisonRequest = {
  /**
   Authorized input/exec bindings; this invocation may derive a private descendant output parent only.
   */
  readonly baseLaunchPath: string;
  /**
   Independently supplied raw base-launch identity does not itself authorize orchestration.
   */
  readonly baseLaunchIdentity: ProducerInputFileIdentity;
  /**
   Frozen standalone producer-prepare.mjs whose bytes the launch binds.
   */
  readonly bootstrapPath: string;
  /**
   Separately retained unqualified-input identity, never inferred from the new output.
   */
  readonly reference: ProducerInputFileIdentity;
  /**
   Caller cancellation remains distinct from successful artifact reconstruction.
   */
  readonly signal: AbortSignal;
  /**
   Names-only operation telemetry stays with the invoking owner.
   */
  readonly l: Logger;
};

/**
 Internal invocation data comes from the fixed owner's checked base-to-derived launch construction.
 This type is not authentication and is not accepted as a public caller certificate.
 
 @example
 ```ts
 const path = invocation.derivedLaunchPath;
 ```
 */
export type ProducerInputComparisonInvocation = {
  /**
   Existing independently authenticated standalone bootstrap.
   */
  readonly bootstrapPath: string;
  /**
   Bootstrap identity from the matched base launch, never from child output.
   */
  readonly bootstrapIdentity: ProducerInputFileIdentity;
  /**
   Runtime identity remains unchanged during output-parent derivation.
   */
  readonly runtime: ProducerInputLaunch['runtime'];
  /**
   Exclusive persisted derived launch with the private producer-runs output parent.
   */
  readonly derivedLaunchPath: string;
  /**
   Exact owner-derived identity, not independently granted approval.
   */
  readonly derivedLaunchIdentity: ProducerInputFileIdentity;
  /**
   Caller cancellation remains live until the comparison owner finishes.
   */
  readonly signal: AbortSignal;
};

/**
 Real created stream-descriptor observations survive close for subsequent pathname verification.
 These fields are internal observations, not caller-supplied creation certificates.
 
 @example
 ```ts
 const path = streams.stdoutPath;
 ```
 */
export type ProducerInputBootstrapStreams = {
  /**
   Fixed metadata output pathname.
   */
  readonly stdoutPath: string;
  /**
   Fixed private diagnostic pathname.
   */
  readonly stderrPath: string;
  /**
   Actual stdout descriptor state after native close and synchronization.
   */
  readonly stdoutState: BigIntStats;
  /**
   Actual stderr descriptor state after native close and synchronization.
   */
  readonly stderrState: BigIntStats;
};

/**
 Matched files remain unqualified and require separate root/phase review before clients may be constructed.
 The owning operation must reconstruct these files rather than accept caller node tables.
 This structural type does not authenticate its creator or certify that operation.
 
 @example
 ```ts
 const artifactPath = result.artifact.path;
 ```
 */
export type ProducerInputComparisonResult = {
  /**
   Byte parity is not semantic review or model-call permission.
   */
  readonly scope: 'matched-unqualified-input-files';
  /**
   Detached callback-failure names are telemetry only, never message-delivery or operation authority.
   */
  readonly loggerCallbackFailures: readonly LoggerCallbackName[];
  /**
   Private comparison namespace, separate from the completed input-run namespace.
   */
  readonly directory: string;
  /**
   Fresh input run retained even if subsequent planning fails.
   */
  readonly inputRunDirectory: string;
  /**
   The native exclusive run identity, not a preparation acquisition-attempt ID.
   */
  readonly inputRunId: string;
  /**
   Independently supplied base launch remains explicit beside its derived invocation.
   */
  readonly baseLaunchIdentity: ProducerInputFileIdentity;
  /**
   Actual completion binds this exact owner-derived launch, not the base launch SHA.
   */
  readonly derivedLaunchIdentity: ProducerInputFileIdentity;
  /**
   Existing raw artifact bytes, not reserialized caller data.
   */
  readonly artifact: ProducerInputFileIdentity & {
    /**
     Fixed file inside the freshly verified input run.
     */
    readonly path: string;
  };
};

//endregion One fixed reconstruction comparison, never a plan or acquisition certificate

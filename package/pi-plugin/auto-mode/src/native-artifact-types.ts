/**
 Closed native declarations survive relocation into an immutable release.

 @module
 */
import type { createEnvironment } from '../native/contract/integration/native-batch/environment.mjs';
import type { createDomainFixtureAssessment } from '../native/contract/integration/native-batch/domain-fixture-assessment.mjs';
import type { bindNativePolicyRuntime } from '../native/contract/integration/native-batch/runtime.mjs';
import type { createRootSessionFactory } from '../native/contract/integration/native-batch/session-root.ts';
import type { createRequestProducerOwner } from '../native/contract/collector/request-producer-judgment-consumers/owner.ts';

//region Declaration bundling follows the original owners without emitting fixture implementations.

/**
 Original environment constructor, including its genuine SDK and parser contracts.
 */
export type NativeEnvironmentFactory = typeof createEnvironment;

/**
 Original assessment constructor retains the maintained sender signature.
 */
export type NativeAssessmentFactory = typeof createDomainFixtureAssessment;

/**
 Original policy runtime constructor retains its bootstrap input and disposal contract.
 */
export type NativeRuntimeFactory = typeof bindNativePolicyRuntime;

/**
 Original session factory preserves generic option inference and SDK result identity.
 */
export type NativeSessionFactory = typeof createRootSessionFactory;

/**
 Original request producer owner keeps its generic judgment and SDK stream contracts.
 Its bound judgment constructor stays generic so the genuine production
 `createJudgmentConstructor` result fits without bundling that factory's generated
 native-return and maintained-policy bridges into the clean-archive closure.
 */
export type NativeRequestProducerFactory = typeof createRequestProducerOwner;

export type {
  DomainFixtureAssessmentSender,
  DomainFixtureAssessmentObservations,
  DomainFixtureAssessmentSettings,
} from '../native/contract/integration/native-batch/domain-fixture-assessment.mjs';

export type {
  NativeBatchEnvironment,
  NativeBatchEnvironmentInput,
  NativeBatchEnvironmentOptions,
} from '../native/contract/integration/native-batch/environment.mjs';

//endregion

/**
 Closed declarations for native fixture owners survive relocation into an immutable release.

 @module
 */
import type { createEnvironment } from '../native/contract/integration/native-batch/environment.mjs';
import type { createDomainFixtureAssessment } from '../native/contract/integration/native-batch/domain-fixture-assessment.mjs';
import type { bindNativePolicyRuntime } from '../native/contract/integration/native-batch/runtime.mjs';
import type { createRootSessionFactory } from '../native/contract/integration/native-batch/session-root.ts';

//region Declaration bundling follows the original owners without emitting fixture implementations.

/** Original environment constructor, including its genuine SDK and parser contracts. */
export type NativeEnvironmentFactory = typeof createEnvironment;

/** Original assessment constructor retains the maintained sender signature. */
export type NativeAssessmentFactory = typeof createDomainFixtureAssessment;

/** Original policy runtime constructor retains its bootstrap input and disposal contract. */
export type NativeRuntimeFactory = typeof bindNativePolicyRuntime;

/** Original session factory preserves generic option inference and SDK result identity. */
export type NativeSessionFactory = typeof createRootSessionFactory;

export type {
  DomainFixtureAssessmentSender,
} from '../native/contract/integration/native-batch/domain-fixture-assessment.mjs';

//endregion

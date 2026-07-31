/**
 * Internal policy engine invocation contracts.
 *
 * @module
 */
import type { GenericSchema, } from 'valibot';
import type { LazyPolicyGitFacts, } from '../api/context-types.ts';
import type {
  PolicyContext,
  PolicyFinding,
  PolicyPatch,
  PolicySeverity,
  PolicyTrigger,
} from '../api/policy-types.ts';
import type { PolicyEvent, } from './events.ts';

/**
 * Runtime-erased policy after option validation.
 */
export type RuntimePolicyDefinition = {
  /**
   * Effective built-in or namespaced policy ID.
   */
  readonly name: string;
  /**
   * Declared default severity.
   */
  readonly defaultSeverity: PolicySeverity;
  /**
   * Whether warning preserves enforcement semantics.
   */
  readonly warnSafe: boolean;
  /**
   * Applicable lifecycle triggers.
   */
  readonly triggers: readonly PolicyTrigger[];
  /**
   * Optional runtime options schema.
   */
  readonly options?: GenericSchema<unknown, unknown>;
  /**
   * Runtime policy callback receiving validated options.
   */
  readonly check: (input: Readonly<{
    context: PolicyContext;
    options: unknown;
  }>,) => Promise<readonly PolicyFinding[]>;
};

/**
 * Configuration accepted by engine invocation.
 */
export type PolicyEngineConfig = Readonly<{
  /**
   * Persistent built-in severity overrides.
   */
  policies?: Readonly<Record<string, PolicySeverity>>;
}>;
/**
 * Policy engine invocation options.
 */
export type RunPolicyEngineOptions = Readonly<{
  /**
   * Exact wrapper arguments.
   */
  args: readonly string[];
  /**
   * Lifecycle trigger.
   */
  trigger: PolicyTrigger;
  /**
   * Final transformed arguments retained for later lifecycle stages.
   */
  transformedArgs?: readonly string[];
  /**
   * Lifecycle-specific Git facts.
   */
  gitFacts?: LazyPolicyGitFacts;
  /**
   * Monotonic candidate version for convergence passes.
   */
  candidateVersion?: number;
  /**
   * Whether current lifecycle owns safe patch application.
   */
  canApplyPatches?: boolean;
  /**
   * Canonical repository root when already resolved.
   */
  repositoryRoot?: string;
  /**
   * Persistent built-in settings.
   */
  config?: PolicyEngineConfig;
  /**
   * Optional direct-check policy filter.
   */
  selectedPolicyIds?: readonly string[];
  /**
   * Internal registry adapter for sequencing tests and trusted plugins.
   */
  registeredPolicies?: readonly RuntimePolicyDefinition[];
  /**
   * Runtime-validated option outputs by effective policy ID.
   */
  policyOptions?: ReadonlyMap<string, unknown>;
}>;
/**
 * Stable policy-engine result.
 */
export type PolicyEngineResult = Readonly<{
  /**
   * Forwardable args after wrapper controls are removed.
   */
  args: readonly string[];
  /**
   * Policy IDs escaped for complete invocation lifecycle.
   */
  escapedPolicyIds: ReadonlySet<string>;
  /**
   * Stable ordered events.
   */
  events: readonly PolicyEvent[];
  /**
   * Ordered engine-owned patch proposals from current pass.
   */
  patches: readonly PolicyPatch[];
  /**
   * Settled cli-git exit code.
   */
  exitCode: 0 | 1 | 2;
  /**
   * Whether real Git should run.
   */
  shouldForward: boolean;
}>;
/**
 * Parsed invocation controls.
 */
export type ParsedPolicyControls = Readonly<{
  /**
   * Forwardable arguments.
   */
  args: readonly string[];
  /**
   * Continue mode.
   */
  keepGoing: boolean;
  /**
   * Escaped policy IDs.
   */
  escapedPolicyIds: ReadonlySet<string>;
}>;

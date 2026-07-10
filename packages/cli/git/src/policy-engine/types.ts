/**
 * Internal policy engine invocation contracts.
 *
 * @module
 */
import type {
  PolicyDefinition,
  PolicySeverity,
} from '../api/policy-types.ts';
import type { PolicyEvent, } from './events.ts';

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
  trigger: 'pre-forward' | 'direct-check';
  /**
   * Persistent built-in settings.
   */
  config?: PolicyEngineConfig;
  /**
   * Optional direct-check policy filter.
   */
  selectedPolicyIds?: readonly string[];
  /**
   * Internal registry adapter for sequencing tests.
   */
  registeredPolicies?: readonly PolicyDefinition[];
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
   * Stable ordered events.
   */
  events: readonly PolicyEvent[];
  /**
   * Unsafe warning configuration diagnostics.
   */
  configWarnings: readonly string[];
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

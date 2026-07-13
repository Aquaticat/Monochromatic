/**
 * Manual-push applicability and lifecycle gate.
 *
 * @module
 */
import type { PolicySeverity, } from '../api/policy-types.ts';
import { parseGlobalOptions, } from '../parse-global-options.ts';
import { parsePushRegion, } from '../parsers/push.ts';
import {
  hasManualPushPolicy,
  runManualPushLifecycle,
} from './manual-push-lifecycle.ts';
import type {
  PolicyEngineResult,
  RuntimePolicyDefinition,
} from './types.ts';

/**
 * Manual-push lifecycle does not apply to invocation.
 */
export const MANUAL_PUSH_NOT_APPLICABLE: unique symbol = Symbol('manual push lifecycle not applicable',);

/**
 * Runs manual-push lifecycle only for enabled real push.
 *
 * @param rawArgs - exact wrapper arguments
 *
 * @param transformedArgs - final forwardable arguments
 *
 * @param gitPath - resolved real Git executable
 *
 * @param policySeverities - trusted policy settings
 *
 * @param registeredPolicies - trusted runtime registry
 *
 * @param policyOptions - validated policy options
 *
 * @returns settled result or not-applicable sentinel
 *
 * @example
 * ```ts
 * await runManualPushGate({ rawArgs, transformedArgs, gitPath, policySeverities, registeredPolicies, policyOptions });
 * ```
 */
export async function runManualPushGate({
  rawArgs,
  transformedArgs,
  gitPath,
  policySeverities,
  registeredPolicies,
  policyOptions,
}: Readonly<{
  rawArgs: readonly string[];
  transformedArgs: readonly string[];
  gitPath: string;
  policySeverities: Readonly<Record<string, PolicySeverity>>;
  registeredPolicies: readonly RuntimePolicyDefinition[];
  policyOptions: ReadonlyMap<string, unknown>;
}>,): Promise<PolicyEngineResult | typeof MANUAL_PUSH_NOT_APPLICABLE> {
  /**
   * Final transformed command layout.
   */
  const layout = parseGlobalOptions(transformedArgs,);
  if (transformedArgs[layout.subcommandIndex] !== 'push')
    return MANUAL_PUSH_NOT_APPLICABLE;
  /**
   * Push arguments after subcommand.
   */
  const postSubcommand = transformedArgs.slice(layout.subcommandIndex + 1,);
  if (parsePushRegion(postSubcommand,)
    .isDryRun)
    return MANUAL_PUSH_NOT_APPLICABLE;
  if (!hasManualPushPolicy({
    registeredPolicies,
    policySeverities,
  },))
    return MANUAL_PUSH_NOT_APPLICABLE;
  return await runManualPushLifecycle({
    rawArgs,
    transformedArgs,
    gitPath,
    cwd: layout.effectiveCwd,
    policySeverities,
    registeredPolicies,
    policyOptions,
  },);
}

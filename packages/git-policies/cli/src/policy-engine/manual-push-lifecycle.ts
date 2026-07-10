/**
 * Manual-push policy lifecycle over authoritative remote updates.
 *
 * @module
 */
import nanoSpawn from 'nano-spawn';
import {
  ABSENT_GIT_VALUE,
  type LazyPolicyGitFacts,
} from '../api/context-types.ts';
import type { PolicySeverity, } from '../api/policy-types.ts';
import { createEngineFailureEvent, } from './events.ts';
import { runPolicyEngine, } from './engine.ts';
import {
  ManualPushProbeError,
  probeManualPushUpdates,
} from './manual-push-probe.ts';
import type {
  PolicyEngineResult,
  RuntimePolicyDefinition,
} from './types.ts';

/**
 * Reports whether registered policy requires manual-push facts.
 *
 * @param registeredPolicies - trusted runtime registry
 *
 * @param policySeverities - configured effective overrides
 *
 * @returns whether at least one enabled policy has manual-push trigger
 *
 * @example
 * ```ts
 * hasManualPushPolicy({ registeredPolicies: [], policySeverities: {} });
 * ```
 */
export function hasManualPushPolicy({
  registeredPolicies,
  policySeverities,
}: Readonly<{
  registeredPolicies: readonly RuntimePolicyDefinition[];
  policySeverities: Readonly<Record<string, PolicySeverity>>;
}>,): boolean {
  return registeredPolicies.some(function isEnabledManualPushPolicy(policy,) {
    const severity = policySeverities[policy.name] ?? policy.defaultSeverity;
    return (severity !== 'off') && policy.triggers.includes('manual-push',);
  },);
}

/**
 * Resolves canonical repository root through real Git.
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective repository directory
 *
 * @returns canonical repository root
 */
async function resolveRepositoryRoot({
  gitPath,
  cwd,
}: Readonly<{
  gitPath: string;
  cwd: string;
}>,): Promise<string> {
  const result = await nanoSpawn(
    gitPath,
    [
      'rev-parse',
      '--show-toplevel',
    ],
    { cwd, },
  );
  if (result.stdout.length === 0)
    throw new ManualPushProbeError('Git returned empty manual-push repository root.',);
  return result.stdout;
}

/**
 * Runs manual-push policies before forwarding real Git.
 *
 * @param rawArgs - exact wrapper arguments
 *
 * @param transformedArgs - final forwardable push arguments
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective repository directory
 *
 * @param policySeverities - trusted policy settings
 *
 * @param registeredPolicies - trusted runtime registry
 *
 * @param policyOptions - validated policy options
 *
 * @returns settled engine result
 *
 * @example
 * ```ts
 * await runManualPushLifecycle({ rawArgs, transformedArgs, gitPath, cwd, policySeverities, registeredPolicies, policyOptions });
 * ```
 */
export async function runManualPushLifecycle({
  rawArgs,
  transformedArgs,
  gitPath,
  cwd,
  policySeverities,
  registeredPolicies,
  policyOptions,
}: Readonly<{
  rawArgs: readonly string[];
  transformedArgs: readonly string[];
  gitPath: string;
  cwd: string;
  policySeverities: Readonly<Record<string, PolicySeverity>>;
  registeredPolicies: readonly RuntimePolicyDefinition[];
  policyOptions: ReadonlyMap<string, unknown>;
}>,): Promise<PolicyEngineResult> {
  try {
    const [repositoryRoot, updates,] = await Promise.all([
      resolveRepositoryRoot({ gitPath, cwd, },),
      probeManualPushUpdates({
        gitPath,
        cwd,
        args: transformedArgs,
      },),
    ],);
    const gitFacts: LazyPolicyGitFacts = {
      candidates: function candidates() {
        return Promise.resolve([],);
      },
      headOid: function headOid() {
        return Promise.resolve(ABSENT_GIT_VALUE,);
      },
      landedCommitOid: function landedCommitOid() {
        return Promise.resolve(ABSENT_GIT_VALUE,);
      },
      pushUpdates: function pushUpdates() {
        return Promise.resolve(updates,);
      },
    };
    return await runPolicyEngine({
      args: rawArgs,
      transformedArgs,
      trigger: 'manual-push',
      gitFacts,
      repositoryRoot,
      config: { policies: policySeverities, },
      registeredPolicies,
      policyOptions,
    },);
  }
  catch (error: unknown) {
    return {
      args: transformedArgs,
      escapedPolicyIds: new Set(),
      events: [createEngineFailureEvent({
        sequence: 0,
        code: 'content-unavailable',
        trigger: 'manual-push',
        message: Error.isError(error,) ? error.message : String(error,),
      },),],
      patches: [],
      exitCode: 2,
      shouldForward: false,
    };
  }
}

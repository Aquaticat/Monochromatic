/**
 * Settled post-commit policy gate before automatic backup.
 *
 * @module
 */
import type { PolicySeverity, } from '../api/policy-types.ts';
import { BUILT_IN_POLICIES, } from './built-ins.ts';
import {
  createCommitLandedEvent,
  type PolicyEvent,
} from './events.ts';
import {
  createPostCommitGitFacts,
  resolveLandedCommit,
} from './post-commit-facts.ts';
import { runPolicyEngine, } from './engine.ts';
import type { RuntimePolicyDefinition, } from './types.ts';

/**
 * Post-commit gate outcome.
 */
export type PostCommitLifecycleResult = Readonly<{
  /**
   * Exact landed commit OID.
   */
  oid: string;
  /**
   * Settled post-commit events, including landed state when blocked.
   */
  events: readonly PolicyEvent[];
  /**
   * Whether automatic push must be skipped.
   */
  blocked: boolean;
}>;

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Internal registry contains callback-bearing declarations; lifecycle reads but never mutates them, as documented in docs/troubleshooting/oxlint-prefer-readonly-authoring-identity.md. */
/**
 * Runs post-commit policies against exact committed ground truth.
 *
 * @param rawArgs - exact wrapper arguments
 *
 * @param transformedArgs - exact arguments received by real Git
 *
 * @param gitPath - resolved real Git executable
 *
 * @param cwd - effective Git working directory
 *
 * @param policySeverities - trusted effective severity map
 *
 * @param registeredPolicies - built-ins and trusted plugins
 *
 * @param policyOptions - trusted validated policy options
 *
 * @returns settled backup gate with explicit landed state
 *
 * @example
 * ```ts
 * await runPostCommitLifecycle({ rawArgs: ['commit', 'file'], transformedArgs: ['commit', '-o', 'file'], gitPath: '/usr/bin/git', cwd: '/repo', policySeverities: {}, registeredPolicies: [], policyOptions: new Map() });
 * ```
 */
export async function runPostCommitLifecycle({
  rawArgs,
  transformedArgs,
  gitPath,
  cwd,
  policySeverities = {},
  registeredPolicies = BUILT_IN_POLICIES,
  policyOptions = new Map(),
}: Readonly<{
  rawArgs: readonly string[];
  transformedArgs: readonly string[];
  gitPath: string;
  cwd: string;
  policySeverities?: Readonly<Record<string, PolicySeverity>>;
  registeredPolicies?: readonly RuntimePolicyDefinition[];
  policyOptions?: ReadonlyMap<string, unknown>;
}>,): Promise<PostCommitLifecycleResult> {
  /**
   * Exact post-spawn commit identity and repository root.
   */
  const landed = await resolveLandedCommit({
    gitPath,
    cwd,
  },);
  /**
   * Settled post-commit engine decision.
   */
  const result = await runPolicyEngine({
    args: rawArgs,
    transformedArgs,
    trigger: 'post-commit',
    gitFacts: createPostCommitGitFacts({
      gitPath,
      cwd,
      landedOid: landed.oid,
    },),
    repositoryRoot: landed.repositoryRoot,
    config: { policies: policySeverities, },
    registeredPolicies,
    policyOptions,
  },);
  if (result.shouldForward) {
    return {
      oid: landed.oid,
      events: result.events,
      blocked: false,
    };
  }
  return {
    oid: landed.oid,
    events: [
      ...result.events,
      createCommitLandedEvent({
        sequence: result.events
          .length,
        oid: landed.oid,
      },),
    ],
    blocked: true,
  };
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */

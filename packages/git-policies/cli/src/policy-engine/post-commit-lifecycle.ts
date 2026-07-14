/**
 * Settled post-commit policy gate before automatic backup.
 *
 * @module
 */
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';

import type { PolicySeverity, } from '../api/policy-types.ts';
import { BUILT_IN_POLICIES, } from './built-ins.ts';
import {
  createCommitLandedEvent,
  createEngineFailureEvent,
  type PolicyEvent,
} from './events.ts';
import {
  createPostCommitGitFacts,
  resolveLandedCommitOid,
  resolvePostCommitRepositoryRoot,
} from './post-commit-facts.ts';
import { runPolicyEngine, } from './engine.ts';
import type { RuntimePolicyDefinition, } from './types.ts';

/**
 * Injectable post-commit dependencies for deterministic failure tests.
 */
export type PostCommitLifecycleDependencies = {
  /**
   * Exact landed OID resolver.
   */
  readonly resolveLandedCommitOid: typeof resolveLandedCommitOid;
  /**
   * Canonical repository root resolver.
   */
  readonly resolvePostCommitRepositoryRoot: typeof resolvePostCommitRepositoryRoot;
  /**
   * Landed tree fact builder.
   */
  readonly createPostCommitGitFacts: typeof createPostCommitGitFacts;
  /**
   * Policy engine entry point.
   */
  readonly runPolicyEngine: typeof runPolicyEngine;
};

/**
 * Canonical production post-commit dependencies.
 */
export const POST_COMMIT_LIFECYCLE_DEPENDENCIES: PostCommitLifecycleDependencies = {
  resolveLandedCommitOid,
  resolvePostCommitRepositoryRoot,
  createPostCommitGitFacts,
  runPolicyEngine,
};

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
 * @param dependencies - injectable landed-state and engine dependencies
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
  dependencies = POST_COMMIT_LIFECYCLE_DEPENDENCIES,
}: Readonly<{
  rawArgs: readonly string[];
  transformedArgs: readonly string[];
  gitPath: string;
  cwd: string;
  policySeverities?: Readonly<Record<string, PolicySeverity>>;
  registeredPolicies?: readonly RuntimePolicyDefinition[];
  policyOptions?: ReadonlyMap<string, unknown>;
  dependencies?: PostCommitLifecycleDependencies;
}>,): Promise<PostCommitLifecycleResult> {
  /**
   * Exact post-spawn commit identity resolved before fallible policy setup.
   */
  const oid = await dependencies.resolveLandedCommitOid({
    gitPath,
    cwd,
  },);
  try {
    /**
     * Canonical repository root for landed policy context.
     */
    const repositoryRoot = await dependencies.resolvePostCommitRepositoryRoot({
      gitPath,
      cwd,
    },);
    /**
     * Settled post-commit engine decision.
     */
    const result = await dependencies.runPolicyEngine({
      args: rawArgs,
      transformedArgs,
      trigger: 'post-commit',
      gitFacts: dependencies.createPostCommitGitFacts({
        gitPath,
        cwd,
        landedOid: oid,
      },),
      repositoryRoot,
      config: { policies: policySeverities, },
      registeredPolicies,
      policyOptions,
    },);
    if (result.shouldForward)
      return {
        oid,
        events: result.events,
        blocked: false,
      };
    return {
      oid,
      events: [
        ...result.events,
        createCommitLandedEvent({
          sequence: result.events
            .length,
          oid,
        },),
      ],
      blocked: true,
    };
  }
  catch (error: unknown) {
    /**
     * Stable setup or unexpected engine failure event.
     */
    const failure = createEngineFailureEvent({
      sequence: 0,
      code: 'content-unavailable',
      message: caughtValueText(error,),
      trigger: 'post-commit',
    },);
    return {
      oid,
      events: [
        failure,
        createCommitLandedEvent({
          sequence: 1,
          oid,
        },),
      ],
      blocked: true,
    };
  }
}

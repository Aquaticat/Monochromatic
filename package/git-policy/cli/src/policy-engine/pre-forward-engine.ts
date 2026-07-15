/**
 * Pre-forward policy engine with command-specific candidate facts.
 *
 * @module
 */
import {
  ADD_POLICY_FACTS_NOT_APPLICABLE,
  createAddPolicyFacts,
} from './add-policy-facts.ts';
import { BUILT_IN_POLICIES, } from './built-ins.ts';
import { parsePolicyControls, } from './controls.ts';
import { runPolicyEngine, } from './engine.ts';
import type {
  PolicyEngineResult,
  RunPolicyEngineOptions,
} from './types.ts';

/**
 * Runs pre-forward engine with exact private add candidates when applicable.
 *
 * @param options - ordinary engine options
 *
 * @param gitPath - resolved real Git executable
 *
 * @mutates options through https://github.com/open-circle/valibot safeParse access to options.config getters, proxy hooks, and schema callbacks
 *
 * @returns settled policy result
 *
 * @example
 * ```ts
 * await runPreForwardPolicyEngine({ options: { args: ['status'], trigger: 'pre-forward' }, gitPath });
 * ```
 */
export async function runPreForwardPolicyEngine({
  options,
  gitPath,
}: Readonly<{
  options: RunPolicyEngineOptions;
  gitPath: string;
}>,): Promise<PolicyEngineResult> {
  /**
   * Effective registry used to strip exact wrapper controls before private Git.
   */
  const registeredPolicies = options.registeredPolicies ?? BUILT_IN_POLICIES;
  /**
   * Wrapper-control-free command used only for candidate derivation.
   */
  const controls = parsePolicyControls({
    args: options.args,
    registeredPolicies,
  },);
  /**
   * Optional private add candidate state.
   */
  const addFacts = await createAddPolicyFacts({
    args: controls.args,
    gitPath,
  },);
  if ((typeof addFacts) === 'symbol') {
    if (addFacts !== ADD_POLICY_FACTS_NOT_APPLICABLE)
      throw new TypeError('Unknown add policy facts state.',);
    return runPolicyEngine(options,);
  }
  /**
   * Scope-bound exact private add candidate facts.
   */
  await using scopedAddFacts = addFacts;
  /**
   * Policy result settled before private candidate disposal.
   */
  const result = await runPolicyEngine({
    ...options,
    gitFacts: scopedAddFacts.gitFacts,
    repositoryRoot: scopedAddFacts.repositoryRoot,
  },);
  return result;
}

/**
 * Whole-shell proof for read-only Bash inspection.
 *
 * @module
 */

import {
  commandIsReadOnly,
  supportsReadOnlyProof,
} from './read-only-bash-command.ts';
import { commandWordsStayInReadScope, } from './read-only-bash-word-proof.ts';
import { isExistingPathUnderTrustedAgentTemp, } from './trusted-agent-temp-paths.ts';
import type {
  BashAnalysis,
  SignalContext,
} from './types.ts';

/**
 * Read-only proof applicability and result.
 */
type ReadOnlyBashProof = {
  /**
   * Whether command should be gated by positive read-only proof.
   */
  readonly required: boolean;
  /**
   * Whether complete shell passed command, expansion, and path checks.
   */
  readonly proven: boolean;
};

/**
 * Prove complete parsed shell consists only of supported read-only commands.
 *
 * @param analysis - parsed shell facts
 *
 * @param ctx - Pi cwd and account home
 *
 * @param trustedAgentTempDirs - canonical private scratch roots
 *
 * @returns whether whole shell is read-only and scope-bounded
 *
 * @example
 * ```typescript
 * await shellIsProvenReadOnly({ analysis, ctx, trustedAgentTempDirs });
 * ```
 */
async function shellIsProvenReadOnly(
  {
    analysis,
    ctx,
    trustedAgentTempDirs,
  }: {
    readonly analysis: BashAnalysis;
    readonly ctx: SignalContext;
    readonly trustedAgentTempDirs: readonly string[];
  },
): Promise<boolean> {
  if (!analysis.parsed)
    return false;
  if (analysis.hasBackground)
    return false;
  if (analysis.hasCommandSubstitution)
    return false;
  if (analysis.hasProcessSubstitution)
    return false;
  /**
   * Executed and definition command partitions used by positive proof.
   */
  const {
    executedCommands,
    functionDefinitionCommands,
  } = analysis;
  if (functionDefinitionCommands.length > 0)
    return false;
  if (executedCommands.length === 0)
    return false;
  /**
   * Concurrent path-provenance checks for every command after shape checks.
   */
  const commandScopePromises: Promise<boolean>[] = [];
  for (const command of executedCommands) {
    if (!commandIsReadOnly(command,))
      return false;
    commandScopePromises[commandScopePromises.length] = commandWordsStayInReadScope({
      command,
      ctx,
      trustedAgentTempDirs,
    },);
  }
  /**
   * Per-command scope decisions after every independent check settles.
   */
  const commandScopeDecisions = await Promise.all(commandScopePromises,);
  return commandScopeDecisions.every(function commandScopeIsProven(decision,): boolean {
    return decision;
  },);
}

/**
 * Check whether existing path facts reach private agent scratch.
 *
 * @param analysis - parsed shell facts
 *
 * @param ctx - Pi cwd and account home
 *
 * @param trustedAgentTempDirs - canonical private scratch roots
 *
 * @returns whether shell names existing trusted scratch path
 *
 * @example
 * ```typescript
 * await analysisTouchesTrustedScratch({ analysis, ctx, trustedAgentTempDirs });
 * ```
 */
async function analysisTouchesTrustedScratch(
  {
    analysis,
    ctx,
    trustedAgentTempDirs,
  }: {
    readonly analysis: BashAnalysis;
    readonly ctx: SignalContext;
    readonly trustedAgentTempDirs: readonly string[];
  },
): Promise<boolean> {
  /**
   * Concurrent containment checks for analyzer path facts.
   */
  const decisionPromises: Promise<boolean>[] = [];
  for (const filePath of analysis.allFiles) {
    decisionPromises[decisionPromises.length] = isExistingPathUnderTrustedAgentTemp({
      filePath,
      ctx,
      trustedAgentTempDirs,
    },);
  }
  /**
   * Containment decisions after every independent check settles.
   */
  const decisions = await Promise.all(decisionPromises,);
  return decisions.some(function decisionAllowsScratch(decision,): boolean {
    return decision;
  },);
}

/**
 * Classify whether Bash call requires and satisfies read-only bypass proof.
 *
 * @param analysis - parsed shell facts
 *
 * @param ctx - Pi cwd and account home
 *
 * @param trustedAgentTempDirs - canonical private scratch roots
 *
 * @returns proof applicability and decision
 *
 * @example
 * ```typescript
 * await classifyReadOnlyBash({ analysis, ctx, trustedAgentTempDirs });
 * ```
 */
async function classifyReadOnlyBash(
  {
    analysis,
    ctx,
    trustedAgentTempDirs,
  }: {
    readonly analysis: BashAnalysis;
    readonly ctx: SignalContext;
    readonly trustedAgentTempDirs: readonly string[];
  },
): Promise<ReadOnlyBashProof> {
  /**
   * Whether any executed command belongs to positively modeled family.
   */
  const provableCommand = { found: false, };
  for (const command of analysis.executedCommands) {
    if (supportsReadOnlyProof(command.name,))
      provableCommand.found = true;
  }
  /**
   * Final modeled-command presence after linear scan.
   */
  const hasProvableCommand = provableCommand.found;
  /**
   * Whether unmodeled command reaches trusted scratch path.
   */
  const touchesTrustedScratch = await analysisTouchesTrustedScratch({
    analysis,
    ctx,
    trustedAgentTempDirs,
  },);
  /**
   * Whether this call enters positive read-proof policy.
   */
  const required = hasProvableCommand || touchesTrustedScratch;
  if (!required) {
    return {
      required: false,
      proven: false,
    };
  }
  return {
    required: true,
    proven: await shellIsProvenReadOnly({
      analysis,
      ctx,
      trustedAgentTempDirs,
    },),
  };
}

export { classifyReadOnlyBash, };
export type { ReadOnlyBashProof, };

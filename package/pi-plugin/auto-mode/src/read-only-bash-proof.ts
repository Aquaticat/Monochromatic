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

/** Read-only proof applicability and result. */
type ReadOnlyBashProof = {
  /** Whether command should be gated by positive read-only proof. */
  readonly required: boolean;
  /** Whether complete shell passed command, expansion, and path checks. */
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
  if (!analysis.parsed
    || analysis.hasBackground
    || analysis.hasCommandSubstitution
    || analysis.hasProcessSubstitution
    || (analysis.functionDefinitionCommands.length > 0)
    || (analysis.executedCommands.length === 0)) {
    return false;
  }
  for (const command of analysis.executedCommands) {
    if (!commandIsReadOnly(command,))
      return false;
    if (!(await commandWordsStayInReadScope({
      command,
      ctx,
      trustedAgentTempDirs,
    },))) {
      return false;
    }
  }
  return true;
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
  /** Concurrent containment checks for analyzer path facts. */
  const decisions = await Promise.all(analysis.allFiles.map(
    function pathTouchesTrustedScratch(filePath,): Promise<boolean> {
      return isExistingPathUnderTrustedAgentTemp({
        filePath,
        ctx,
        trustedAgentTempDirs,
      },);
    },
  ),);
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
  /** Whether any executed command belongs to positively modeled family. */
  const hasProvableCommand = analysis.executedCommands.some(
    function commandHasReadOnlyProof(command,): boolean {
      return supportsReadOnlyProof(command.name,);
    },
  );
  /** Whether unmodeled command reaches trusted scratch path. */
  const touchesTrustedScratch = await analysisTouchesTrustedScratch({
    analysis,
    ctx,
    trustedAgentTempDirs,
  },);
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

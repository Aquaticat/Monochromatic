/**
 * Second-pass fix prompt builder for code-generation probes.
 *
 * Builds a diagnostics-only follow-up prompt so the model can fix lint, type-check,
 * and runtime issues in one turn. The model's first-pass code is already present
 * in the conversation as a native assistant message (see runner-second-pass.ts),
 * so the fix prompt references it without repeating the source.
 */
import {
  type LintResult,
  lintSource,
} from '../linter.ts';

import { extractCode, } from './extract-code.ts';

import type { ContainerResult, } from '../container.ts';
import type { ScoreContext, } from '../probes.ts';

/**
 * Maximum bytes of runtime stderr to include in the fix prompt to avoid token waste
 */
const MAX_RUNTIME_STDERR_LENGTH = 500;

/**
 * Formats a failed container result into a diagnostic section string.
 *
 * @param container - container result with non-zero exit code or timeout flag
 *
 * @returns formatted runtime error section
 */
function buildRuntimeSection(container: ContainerResult,): string {
  if (container.timedOut)
    return '=== runtime error ===\nProcess timed out.';
  /**
   * First N bytes of stderr; cap keeps the fix prompt within a reasonable token budget.
   */
  const truncated = container.stderr
    .slice(
    0,
    MAX_RUNTIME_STDERR_LENGTH,
  );
  /**
   * "...(truncated)" tail when the cap kicked in; empty otherwise.
   */
  const suffix = container.stderr
    .length
    > MAX_RUNTIME_STDERR_LENGTH
    ? '\n...(truncated)'
    : '';
  return `=== runtime error ===\nProcess exited with code ${
    String(container.exitCode,)
  }.\n${truncated}${suffix}`;
}

/**
 * Options for {@link buildCodeGenFixPrompt}.
 *
 * @example
 * ```ts
 * const options: BuildCodeGenFixPromptOptions = {
 *   response: 'raw model text',
 *   context: scoreContext,
 *   priorLint: lintResult,
 *   priorContainer: containerResult,
 * };
 * ```
 */
type BuildCodeGenFixPromptOptions = {
  /**
   * Raw model output from the first pass (used to extract source for linting)
   */
  readonly response: string;
  /**
   * Model identity and pass for artifact organization
   */
  readonly context: ScoreContext;
  /**
   * Lint result already computed by score(); omit to re-lint
   */
  readonly priorLint?: LintResult;
  /**
   * Container result already computed by score(); runtime errors are included when present, omit to skip
   */
  readonly priorContainer?: ContainerResult;
};

/**
 * Builds a diagnostics-only follow-up prompt for the fix turn.
 * Returns empty string when there are no diagnostics (skip the second pass).
 *
 * The model's first-pass response is already in the conversation as a native
 * assistant message, so this prompt only carries diagnostics; no code echo.
 *
 * @param response - raw model output from the first pass (used to extract source for linting)
 *
 * @param context - model identity and pass for artifact organization
 *
 * @param priorLint - lint result already computed by score(); if provided, skips re-linting
 *
 * @param priorContainer - container result already computed by score(); runtime errors are included when present
 *
 * @returns follow-up user message, or empty string to skip
 *
 * @example
 * ```ts
 * const prompt = await buildCodeGenFixPrompt({ response, context, priorLint, priorContainer });
 * if (prompt !== '') sendFixTurn(prompt);
 * ```
 */
export async function buildCodeGenFixPrompt({
  response,
  context,
  priorLint,
  priorContainer,
}: BuildCodeGenFixPromptOptions,): Promise<string> {
  /**
   * Source extracted from the model's first-pass response; fed to the linter for fix-time diagnostics.
   */
  const source = extractCode(response,);
  // Reuse the lint result from score() if available to avoid linting the same code twice.
  // Falls back to running lintSource if called without a prior result (e.g. in tests).
  /**
   * Lint result reused from the scoring phase, or freshly computed when missing (e.g. in tests).
   */
  const lint = priorLint ?? await lintSource({
    source,
    meta: {
      model: context.label,
      label: context.label,
      probe: 'fix-prompt',
      pass: context.pass,
      timestamp: context.timestamp,
    },
  },);

  // Narrow to a failed container only when exit was non-zero or process was killed
  /**
   * Container result restricted to actual failures (non-zero exit or timeout); undefined for clean runs.
   */
  const failedContainer = (priorContainer !== undefined)
      && ((priorContainer.exitCode
        !== 0) || priorContainer
        .timedOut)
    ? priorContainer
    : undefined;

  /**
   * True when lint reported actionable issues with diagnostic text to surface.
   */
  const hasLintDiagnostics = ((lint.violationCount
    + lint
    .typeErrors) > 0)
    && (lint.rawDiagnostics
      .length
      > 0);
  if ((failedContainer === undefined) && (!hasLintDiagnostics))
    return '';

  /**
   * One-line lint summary shown before the diagnostics; undefined when there are zero issues.
   */
  const lintSummary =
    (lint.severity
      .errors
      > 0) || (lint.severity
        .warnings
        > 0)
      || (lint.typeErrors
        > 0)
      ? `It has ${String(lint.severity
        .errors,)} lint errors, ${
        String(lint.severity
          .warnings,)
      } lint warnings, and ${String(lint.typeErrors,)} type errors.`
      : undefined;
  /**
   * One-line runtime summary shown alongside `lintSummary`; undefined when the run did not fail.
   */
  const runtimeSummary = failedContainer !== undefined
    ? (failedContainer.timedOut
      ? 'It timed out at runtime.'
      : `It crashed at runtime (exit code ${String(failedContainer.exitCode,)}).`)
    : undefined;

  /**
   * Diagnostic blocks (runtime + lint) in display order; empty entries filtered before joining.
   */
  const diagnosticParts = [
    failedContainer !== undefined ? buildRuntimeSection(failedContainer,) : '',
    lint.rawDiagnostics
      .length
      > 0 ? lint.rawDiagnostics : '',
  ]
    .filter(function hasContent(part,): boolean {
      return part.length
        > 0;
    },);

  return [
    'Your code from the previous response has issues.',
    [
      lintSummary,
      runtimeSummary,
    ]
      .filter(function isDefined(line,): line is string {
        return line !== undefined;
      },)
      .join(' ',),
    'Here are the diagnostics:',
    '',
    diagnosticParts.join('\n\n',),
    '',
    'Fix all the issues. Output ONLY the complete fixed TypeScript source in a single fenced code block.',
  ]
    .join('\n',);
}

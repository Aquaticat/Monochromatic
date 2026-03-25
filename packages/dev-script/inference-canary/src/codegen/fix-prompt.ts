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

/** Maximum bytes of runtime stderr to include in the fix prompt to avoid token waste */
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
  const truncated = container.stderr.slice(
    0,
    MAX_RUNTIME_STDERR_LENGTH,
  );
  const suffix = container.stderr.length > MAX_RUNTIME_STDERR_LENGTH
    ? '\n...(truncated)'
    : '';
  return `=== runtime error ===\nProcess exited with code ${
    String(container.exitCode,)
  }.\n${truncated}${suffix}`;
}

/**
 * Builds a diagnostics-only follow-up prompt for the fix turn.
 * Returns undefined when there are no diagnostics (skip the second pass).
 *
 * The model's first-pass response is already in the conversation as a native
 * assistant message, so this prompt only carries diagnostics -- no code echo.
 *
 * @param response - raw model output from the first pass (used to extract source for linting)
 *
 * @param context - model identity and pass for artifact organization
 *
 * @param priorLint - lint result already computed by score(); if provided, skips re-linting
 *
 * @param priorContainer - container result already computed by score(); runtime errors are included when present
 *
 * @returns follow-up user message, or undefined to skip
 */
export async function buildCodeGenFixPrompt(
  response: string,
  context: ScoreContext,
  priorLint?: LintResult,
  priorContainer?: ContainerResult,
): Promise<string | undefined> {
  const source = extractCode(response,);
  // Reuse the lint result from score() if available to avoid linting the same code twice.
  // Falls back to running lintSource if called without a prior result (e.g. in tests).
  const lint = priorLint ?? await lintSource(
    source,
    {
    model: context.label,
    label: context.label,
    probe: 'fix-prompt',
    pass: context.pass,
    timestamp: context.timestamp,
  },
  );

  // Narrow to a failed container only when exit was non-zero or process was killed
  const failedContainer = priorContainer !== undefined
      && (priorContainer.exitCode !== 0 || priorContainer.timedOut)
    ? priorContainer
    : undefined;

  const hasLintDiagnostics = lint.violationCount + lint.typeErrors > 0
    && lint.rawDiagnostics.length > 0;
  if (failedContainer === undefined && !hasLintDiagnostics)
    return undefined;

  const lintSummary =
    lint.severity.errors > 0 || lint.severity.warnings > 0 || lint.typeErrors > 0
      ? `It has ${String(lint.severity.errors,)} lint errors, ${
        String(lint.severity.warnings,)
      } lint warnings, and ${String(lint.typeErrors,)} type errors.`
      : undefined;
  const runtimeSummary = failedContainer !== undefined
    ? (failedContainer.timedOut
      ? 'It timed out at runtime.'
      : `It crashed at runtime (exit code ${String(failedContainer.exitCode,)}).`)
    : undefined;

  const diagnosticParts = [
    failedContainer !== undefined ? buildRuntimeSection(failedContainer,) : '',
    lint.rawDiagnostics.length > 0 ? lint.rawDiagnostics : '',
  ]
    .filter(function hasContent(part,): boolean {
      return part.length > 0;
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

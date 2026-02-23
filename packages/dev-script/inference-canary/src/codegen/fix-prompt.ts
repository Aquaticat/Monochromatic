/**
 * Second-pass fix prompt builder for code-generation probes.
 *
 * Sends the model its own first-pass code along with the lint and type-check
 * diagnostics so it can attempt to fix all issues in one follow-up turn.
 */
import { lintSource, } from '../linter.ts';

import { extractCode, } from './extract-code.ts';

import type { ScoreContext, } from '../probes.ts';

/**
 * Builds a follow-up prompt carrying the model's first-pass code + diagnostics.
 * Returns undefined when there are no diagnostics (skip the second pass).
 * @param response - raw model output from the first pass
 * @param context - model identity and pass for artifact organization
 * @returns follow-up user message, or undefined to skip
 */
export async function buildCodeGenFixPrompt(response: string, context: ScoreContext): Promise<string | undefined> {
  const source = extractCode(response);
  const lint = await lintSource(source, {
    model: context.modelId,
    probe: 'fix-prompt',
    pass: context.pass,
    timestamp: new Date().toISOString(),
  });

  if (lint.violationCount + lint.typeErrors === 0 || lint.rawDiagnostics.length === 0) return undefined;

  return [
    'Here is your code from the previous response:',
    '',
    '```typescript',
    source,
    '```',
    '',
    `It has ${String(lint.severity.errors)} lint errors, ${String(lint.severity.warnings)} lint warnings, and ${String(lint.typeErrors)} type errors.`,
    'Here are the diagnostics:',
    '',
    lint.rawDiagnostics,
    '',
    'Fix all the issues. Output ONLY the complete fixed TypeScript source in a single fenced code block.',
  ].join('\n');
}

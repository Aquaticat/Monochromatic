/**
 * RFC 4180 CSV parser probe.
 *
 * Full RFC 4180 CSV parsing including escaped quotes, multiline fields, and mixed
 * line endings. Hard because most models get the escaped-quote-within-quoted-field case wrong.
 */
import { runInContainer, } from '../container.ts';

import { CODE_GEN_SYSTEM, } from './system-prompt.ts';
import { buildCodeGenFixPrompt, combinedScore, extractCode, lintAndLog, } from './scoring.ts';

import type { ContainerResult, } from '../container.ts';
import type { LintResult, } from '../linter.ts';
import type { Probe, } from '../probes.ts';

/**
 * Lint results from the most recent score() call, keyed by model ID.
 * Used by buildFixPrompt to avoid re-linting the same source that score() already analyzed.
 */
const lintCache = new Map<string, LintResult>();

/**
 * Container results from the most recent score() call, keyed by model ID.
 * Used by buildFixPrompt to include runtime errors in the second-pass prompt.
 */
const containerCache = new Map<string, ContainerResult>();

/** Test input covering the hardest RFC 4180 edge cases */
const CSV_TEST_INPUT = 'name,bio,age\n"O\'Brien, ""Bob""","likes\ntravel",30\nJane,simple,25\n';

/** {@inheritDoc Probe} */
export const csvRfc4180: Probe = {
  name: 'csv-rfc4180',
  category: 'code-gen',
  system: CODE_GEN_SYSTEM,
  buildFixPrompt: (response, context) => buildCodeGenFixPrompt(response, context, lintCache.get(context.modelId), containerCache.get(context.modelId)),
  prompt: [
    'Write a TypeScript CLI that parses RFC 4180 compliant CSV from stdin and outputs a JSON array to stdout.',
    'Requirements:',
    '- First row is the header; each subsequent row becomes an object keyed by header names',
    '- Handle quoted fields containing commas, newlines, and escaped quotes (doubled: "")',
    '- Handle fields that are NOT quoted alongside fields that ARE quoted in the same row',
    '- Trim whitespace from unquoted values only (preserve whitespace in quoted values)',
    '- Handle both \\r\\n and \\n line endings',
    '- Print the JSON array with 2-space indentation',
    '',
    'Example input (note the escaped quote and newline inside a quoted field):',
    'name,bio,age',
    '"O\'Brien, ""Bob""","likes\\ntravel",30',
    'Jane,simple,25',
  ].join('\n'),
  score: async (response, context) => {
    const source = extractCode(response);
    const [result, lint] = await Promise.all([
      runInContainer(source, CSV_TEST_INPUT, context.signal),
      lintAndLog(source, 'csv-rfc4180', context),
    ]);
    lintCache.set(context.modelId, lint);
    containerCache.set(context.modelId, result);

    if (result.timedOut || result.exitCode !== 0) return combinedScore(0, lint);

    try {
      const parsed = JSON.parse(result.stdout.trim()) as Record<string, string>[];
      if (!Array.isArray(parsed) || parsed.length !== 2) return combinedScore(0.1, lint);

      const first = parsed[0];
      if (first === undefined) return combinedScore(0.1, lint);

      const second = parsed[1];
      if (second === undefined) return combinedScore(0.2, lint);

      const TOTAL_CHECKS = 5;
      const correctCount = [
        first['name'] === 'O\'Brien, "Bob"',
        first['bio'] === 'likes\ntravel',
        first['age'] === '30',
        second['name'] === 'Jane',
        second['bio'] === 'simple',
      ].filter(Boolean).length;

      return combinedScore(correctCount / TOTAL_CHECKS, lint);
    } catch {
      return combinedScore(0.05, lint);
    }
  },
};

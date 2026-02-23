/**
 * Expression evaluator probe.
 *
 * Asks the model to implement a recursive-descent parser for arithmetic expressions
 * with correct operator precedence and parentheses. Models frequently get precedence
 * wrong or fail on nested parentheses.
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

/** Test input covering precedence, parentheses, negation, and floats */
const EXPR_TEST_INPUT = '2 + 3 * 4\n(2 + 3) * 4\n10 / (5 - 5)\n-3 + 4 * -2\n((1 + 2) * (3 + 4))\n3.5 * 2 + 1.5\n';

/** Expected outputs for each expression in EXPR_TEST_INPUT */
const EXPR_EXPECTED = ['14', '20', 'ERR', '-11', '21', '8.5'] as const;

/** {@inheritDoc Probe} */
export const expressionEvaluator: Probe = {
  name: 'expr-eval',
  category: 'code-gen',
  system: CODE_GEN_SYSTEM,
  buildFixPrompt: (response, context) => buildCodeGenFixPrompt(response, context, lintCache.get(context.modelId), containerCache.get(context.modelId)),
  prompt: [
    'Write a TypeScript CLI that reads arithmetic expressions from stdin (one per line) and prints results to stdout (one per line).',
    'Requirements:',
    '- Support +, -, *, / with standard mathematical precedence (* and / before + and -)',
    '- Support parentheses for grouping with arbitrary nesting depth',
    '- Support negative numbers (e.g., -3, --5)',
    '- Support floating point numbers (e.g., 3.14)',
    '- Division by zero should output "ERR"',
    '- Invalid expressions should output "ERR"',
    '- Do NOT use eval(), new Function(), or any equivalent',
    '- Implement the parser yourself using recursive descent',
    '',
    'Example input:',
    '2 + 3 * 4',
    '(2 + 3) * 4',
    '10 / (5 - 5)',
    '-3 + 4 * -2',
    '((1 + 2) * (3 + 4))',
    '',
    'Expected output:',
    '14',
    '20',
    'ERR',
    '-11',
    '21',
  ].join('\n'),
  score: async (response, context) => {
    const source = extractCode(response);
    const [result, lint] = await Promise.all([
      runInContainer(source, EXPR_TEST_INPUT, context.signal),
      lintAndLog(source, 'expr-eval', context),
    ]);
    lintCache.set(context.modelId, lint);
    containerCache.set(context.modelId, result);

    if (result.timedOut || result.exitCode !== 0) return combinedScore(0, lint);

    const lines = result.stdout.trim().split('\n').map((line) => line.trim());
    const FLOAT_TOLERANCE = 0.001;
    const correctCount = EXPR_EXPECTED.filter((exp, index) => {
      const actual = lines[index];
      if (actual === undefined) return false;
      if (exp === 'ERR') return actual === 'ERR';
      return Math.abs(Number(actual) - Number(exp)) < FLOAT_TOLERANCE;
    }).length;

    return combinedScore(correctCount / EXPR_EXPECTED.length, lint);
  },
};

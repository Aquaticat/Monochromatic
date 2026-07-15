/**
 * Expression evaluator probe.
 *
 * Asks the model to implement a recursive-descent parser for arithmetic expressions
 * with correct operator precedence and parentheses. Models frequently get precedence
 * wrong or fail on nested parentheses.
 */
import type { Probe, } from '../probes.ts';
import { EXPR_PERF_INPUT, } from './perf-test-data/index.ts';
import { createCodeGenProbe, } from './probe-factory.ts';

/**
 * Test input covering precedence, parentheses, negation, and floats
 */
const EXPR_TEST_INPUT =
  '2 + 3 * 4\n(2 + 3) * 4\n10 / (5 - 5)\n-3 + 4 * -2\n((1 + 2) * (3 + 4))\n3.5 * 2 + 1.5\n';

/**
 * Expected outputs for each expression in EXPR_TEST_INPUT
 */
const EXPR_EXPECTED = [
  '14',
  '20',
  'ERR',
  '-11',
  '21',
  '8.5',
] as const;

/**
 * Allowed floating-point comparison tolerance
 */
const FLOAT_TOLERANCE = 0.001;

/**
 * {@inheritDoc Probe}
 */
export const expressionEvaluator: Probe = createCodeGenProbe({
  name: 'expr-eval',
  testInput: EXPR_TEST_INPUT,
  perfTest: {
    input: EXPR_PERF_INPUT,
    fastMs: 2_000,
    slowMs: 8_000,
  },
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
  ]
    .join('\n',),
  verify: function verifyExprEval(result,): { correctness: number; } {
    /**
     * Per-line model output, trimmed so trailing whitespace does not perturb the float comparison below.
     */
    const lines = result.stdout
      .trim()
      .split('\n',)
      .map(function trimLine(line,): string {
      return line.trim();
    },);
    /**
     * Number of expected outputs the model produced; divided by the total to yield correctness.
     */
    const correctCount = EXPR_EXPECTED
      .filter(function checkLine(
        exp,
        index,
      ): boolean {
        /**
         * Model's output for the current expected line; undefined when the model emitted fewer lines than expected.
         */
        const actual = lines[index];
        if (actual === undefined)
          return false;
        if (exp === 'ERR')
          return actual === 'ERR';
        return Math.abs(Number(actual,)
          - Number(exp,),)
          < FLOAT_TOLERANCE;
      },)
      .length;

    return { correctness: correctCount / EXPR_EXPECTED
      .length, };
  },
},);

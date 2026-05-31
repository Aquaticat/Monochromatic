/**
 * RFC 4180 CSV parser probe.
 *
 * Full RFC 4180 CSV parsing including escaped quotes, multiline fields, and mixed
 * line endings. Hard because most models get the escaped-quote-within-quoted-field case wrong.
 */
import type { Probe, } from '../probes.ts';
import { CSV_PERF_INPUT, } from './perf-test-data/index.ts';
import { createCodeGenProbe, } from './probe-factory.ts';

/**
 * Test input covering the hardest RFC 4180 edge cases
 */
const CSV_TEST_INPUT =
  'name,bio,age\n"O\'Brien, ""Bob""","likes\ntravel",30\nJane,simple,25\n';

/**
 * Number of correctness checks in the output verifier
 */
const TOTAL_CHECKS = 5;

/**
 * {@inheritDoc Probe}
 */
export const csvRfc4180: Probe = createCodeGenProbe({
  name: 'csv-rfc4180',
  testInput: CSV_TEST_INPUT,
  perfTest: {
    input: CSV_PERF_INPUT,
    fastMs: 2_000,
    slowMs: 8_000,
  },
  prompt: [
    'Write a TypeScript CLI that parses RFC 4180 compliant CSV from stdin and outputs a JSON array to stdout.',
    'Requirements:',
    '- First row is the header; each subsequent row becomes an object keyed by header names',
    '- Handle quoted fields containing commas, newlines, and escaped quotes (doubled: "")',
    '- Handle fields that are NOT quoted alongside fields that ARE quoted in the same row',
    '- Trim whitespace from unquoted values only (preserve whitespace in quoted values)',
    String.raw`- Handle both \r\n and \n line endings`,
    '- Print the JSON array with 2-space indentation',
    '',
    'Example input (note the escaped quote and newline inside a quoted field):',
    'name,bio,age',
    String.raw`"O'Brien, ""Bob""","likes\ntravel",30`,
    'Jane,simple,25',
  ]
    .join('\n',),
  verify: function verifyCsv(result,): { correctness: number; } {
    try {
      /* oxlint-disable typescript/no-unsafe-type-assertion -- JSON.parse output matched against known test input shape */
      /**
       * Parsed model output; rejected below when not an array of two rows.
       */
      const parsed = JSON.parse(result.stdout
        .trim(),) as Record<string, string>[];
      /* oxlint-enable typescript/no-unsafe-type-assertion */
      if ((!Array.isArray(parsed,)) || (parsed.length
        !== 2))
        return { correctness: 0.1, };

      /**
       * First and second rows of the parsed model output; each may be undefined when the array is short.
       */
      const [first, second,] = parsed;
      if (first === undefined)
        return { correctness: 0.1, };

      if (second === undefined)
        return { correctness: 0.2, };

      /**
       * Number of field-level checks the model output satisfied; divided by the total to yield correctness.
       */
      const correctCount = [
        first.name
          === 'O\'Brien, "Bob"',
        first.bio
          === 'likes\ntravel',
        first.age
          === '30',
        second.name
          === 'Jane',
        second.bio
          === 'simple',
      ]
        .filter(Boolean,)
        .length;

      return { correctness: correctCount / TOTAL_CHECKS, };
    }
    catch {
      return { correctness: 0.05, };
    }
  },
},);

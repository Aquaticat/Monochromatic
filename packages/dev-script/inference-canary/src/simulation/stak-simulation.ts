/**
 * Stak simulation probe.
 *
 * Gives the model the TypeScript source of the Stak interpreter and asks it to
 * trace five programs mentally. Tests whether the model reads code carefully
 * rather than pattern-matching to familiar language semantics.
 *
 * Correctness is a hard gate: any incorrect case zeroes the entire score.
 *
 * Trip wires (visible only in the interpreter source, not in the prompt):
 * - DIV uses Math.floor (floor division), not Math.trunc (truncation)
 * - MOD uses ((a % b) + b) % b (floored remainder), not a % b (JS remainder)
 * - JUMPZ consumes its operand unconditionally, preventing stack accumulation in loops
 */
import { readFile, } from 'node:fs/promises';

import { SIMULATION_SYSTEM, } from './system-prompt.ts';
import { SIMULATION_CASES, } from '../stak/test-cases.ts';

import type { Probe, } from '../probes.ts';

/** Interpreter TypeScript source, read at module load time and embedded in every probe invocation */
const INTERPRETER_SOURCE = await readFile(
  new URL('../stak/interpreter.ts', import.meta.url),
  'utf8',
);

/**
 * Builds the simulation probe prompt with the interpreter source and all five programs.
 *
 * @returns formatted prompt string
 */
function buildSimulationPrompt(): string {
  const programBlocks = SIMULATION_CASES.map(function formatCase(testCase, index): string {
    const lines = [
      `Program ${String(index + 1)}:`,
      '```',
      testCase.program,
      '```',
    ];
    return lines.join('\n');
  });

  return [
    'Here is the TypeScript source of the Stak interpreter:',
    '',
    '```typescript',
    INTERPRETER_SOURCE.trim(),
    '```',
    '',
    'Trace the exact output of each program below.',
    'Separate the five results with "---" on its own line.',
    '',
    ...programBlocks.flatMap(function addSeparator(block): string[] { return [block, '']; }),
  ].join('\n');
}

/**
 * Parses the model response into per-program sections by splitting on "---".
 *
 * Normalizes before splitting: inserts a newline before any `---` that is directly
 * appended to content (e.g. `Hi---`) so the split works regardless of whether the
 * model placed the separator on its own line.
 *
 * @param response - raw model output
 *
 * @returns array of trimmed output sections, one per program
 */
function parseSections(response: string): readonly string[] {
  const normalized = response.replaceAll(/([^\n])---/g, '$1\n---');
  return normalized
    .split(/^---$/m)
    .map(function trimSection(section): string { return section.trim(); });
}

/**
 * {@inheritDoc Probe}
 */
export const stakSimulation: Probe = {
  name: 'stak-simulation',
  category: 'simulation',
  system: SIMULATION_SYSTEM,
  prompt: buildSimulationPrompt(),
  score: function scoreStakSimulation(response, context): number {
    const sections = parseSections(response);
    let allCorrect = true;
    for (const [index, testCase] of SIMULATION_CASES.entries()) {
      const section = sections[index] ?? '';
      const match = section === testCase.expected;
      if (!match) {
        allCorrect = false;
        console.log(
          `  [${context.label}:stak-simulation] case ${testCase.label}: expected ${JSON.stringify(testCase.expected)}, got ${JSON.stringify(section)}`,
        );
      }
    }
    return allCorrect ? 1 : 0;
  },
};

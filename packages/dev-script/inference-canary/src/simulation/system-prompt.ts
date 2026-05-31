/**
 * System prompt for simulation-category probes.
 *
 * Simulation probes give the model a TypeScript interpreter source file and ask it
 * to trace program execution mentally, without running any code.
 */

/**
 * System prompt instructing the model to trace execution from interpreter source
 */
export const SIMULATION_SYSTEM: string = [
  'You are given the TypeScript source of an interpreter for an invented language.',
  'Read the interpreter code carefully, then trace the exact output of each numbered program.',
  'Output each result exactly as the interpreter would produce it.',
  'Do not add explanations, labels, or code fences.',
  'Separate the five results with the exact line "---" (three hyphens, nothing else on that line).',
  'If a program produces no output, leave that section empty (two "---" lines in a row).',
]
  .join('\n',);

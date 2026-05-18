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

import {
  l,
  tagged,
} from '../log.ts';
import { SIMULATION_CASES, } from '../stak/test-cases.ts';
import { SIMULATION_SYSTEM, } from './system-prompt.ts';

import type { Probe, } from '../probes.ts';

/**
 * Reads all interpreter source files and concatenates them into a single string.
 *
 * The interpreter was split across three files for max-lines compliance, but the
 * simulation probe must present the complete source so models can trace execution.
 * Files are ordered dependency-first so the concatenated source reads top-down.
 *
 * @returns concatenated interpreter source
 */
async function readInterpreterSource(): Promise<string> {
  /** Interpreter source files in dependency order; concatenation flows top-down for the model. */
  const files = [
    '../stak/interpreter-jumps.ts',
    '../stak/interpreter-ops.ts',
    '../stak/interpreter.ts',
  ] as const;
  /** Raw file contents fetched in parallel; joined below into the embedded prompt block. */
  const sources = await Promise.all(
    files.map(function readSourceFile(relativePath,): Promise<string> {
      return readFile(
        new URL(
          relativePath,
          import.meta.url,
        ),
        'utf8',
      );
    },),
  );
  return sources.join('\n',);
}

/** Interpreter TypeScript source, read at module load time and embedded in every probe invocation */
const INTERPRETER_SOURCE = await readInterpreterSource();

/**
 * Builds the simulation probe prompt with the interpreter source and all five programs.
 *
 * @returns formatted prompt string
 */
function buildSimulationPrompt(): string {
  /** One formatted block per simulation case; spliced into the prompt below. */
  const programBlocks = SIMULATION_CASES.map(
    function formatCase(
      testCase,
      index,
    ): string {
      /** Lines composing one program block: header, fence open, program body, fence close. */
      const lines = [
        `Program ${String(index + 1,)}:`,
        '```',
        testCase.program,
        '```',
      ];
      return lines.join('\n',);
    },
  );

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
    ...programBlocks.flatMap(function addSeparator(block,): string[] {
      return [
        block,
        '',
      ];
    },),
  ]
    .join('\n',);
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
function parseSections(response: string,): readonly string[] {
  /** Response with `---` separators forced onto their own line so the split below stays uniform. */
  const normalized = forceDashSeparatorsToOwnLine(response,);
  return splitOnDashOnlyLines(normalized,)
    .map(function trimSection(section,): string {
      return section.trim();
    },);
}

/**
 * Inserts `\n` immediately before every `---` not already preceded by
 * `\n` (or start-of-string). Mirrors
 * `s.replaceAll(/([^\n])---/g, '$1\n---')` with a linear `indexOf` walk
 * that never revisits a byte.
 *
 * @param s - raw model output
 *
 * @returns normalised output where every `---` opens its own line
 */
function forceDashSeparatorsToOwnLine(s: string,): string {
  /** Length of the `---` separator literal; used as the cursor step. */
  const DASH_SEPARATOR_LENGTH = '---'.length;
  /**
   * Recursive accumulator: copies non-matching text verbatim and inserts
   * a synthetic newline before each `---` that needs one.
   *
   * @param from - cursor index for the next `indexOf` call
   *
   * @param acc - normalised text collected so far
   *
   * @returns final normalised string
   */
  function walk({
    from,
    acc,
  }: {
    from: number;
    acc: string;
  },): string {
    /** Position of the next `---`; `-1` ends the scan. */
    const idx = s.indexOf(
      '---',
      from,
    );
    if (idx === (-1))
      return `${acc}${s.slice(from,)}`;
    /** Char immediately before the match (or `'\n'` for start-of-string). */
    const prev = idx === 0 ? '\n' : s.charAt(idx - 1,);
    /** Inserted newline keeps the regex's `$1\n---` rewrite semantics. */
    const insertion = prev === '\n' ? '' : '\n';
    return walk({
      from: idx + DASH_SEPARATOR_LENGTH,
      acc: `${acc}${
        s.slice(
          from,
          idx,
        )
      }${insertion}---`,
    },);
  }
  return walk({
    from: 0,
    acc: '',
  },);
}

/**
 * Splits `s` on lines that contain exactly `---` (and nothing else).
 * Mirrors `s.split(/^---$/m)`: requires the separator to sit alone on its
 * own line, neither prefixed nor suffixed.
 *
 * @param s - normalised text with `---` separators on their own lines
 *
 * @returns ordered list of inter-separator sections
 */
function splitOnDashOnlyLines(s: string,): string[] {
  /** Lines after a primary `\n` split; separator lines are detected below. */
  const lines = s.split('\n',);
  /**
   * Recursive walker that flushes the current section on each line that is
   * exactly `---`.
   *
   * @param idx - cursor into `lines`
   *
   * @param section - lines accumulated since the last separator
   *
   * @param acc - completed sections so far
   *
   * @returns final section list
   */
  function walk({
    idx,
    section,
    acc,
  }: {
    idx: number;
    section: readonly string[];
    acc: readonly string[];
  },): string[] {
    if (idx >= lines.length) {
      return [
        ...acc,
        section.join('\n',),
      ];
    }
    /** Line at the cursor. */
    const line = lines[idx] ?? '';
    if (line === '---') {
      return walk({
        idx: idx + 1,
        section: [],
        acc: [
          ...acc,
          section.join('\n',),
        ],
      },);
    }
    return walk({
      idx: idx + 1,
      section: [
        ...section,
        line,
      ],
      acc,
    },);
  }
  return walk({
    idx: 0,
    section: [],
    acc: [],
  },);
}

/**
 * {@inheritDoc Probe}
 */
export const stakSimulation: Probe = {
  name: 'stak-simulation',
  category: 'simulation',
  system: SIMULATION_SYSTEM,
  prompt: buildSimulationPrompt(),
  score: function scoreStakSimulation(
    response,
    context,
  ): number {
    /**
     * Per-program output sections parsed from the response; positional alignment with {@link SIMULATION_CASES}.
     */
    const sections = parseSections(response,);
    /** Probe-specific logger for simulation case mismatch messages. */
    const rl = tagged({
      tag: 'stak-simulation',
      l: tagged({
        tag: context.label,
        l,
      },),
    },);
    /** Per-case match flags; logged on mismatch and reduced to the overall pass/fail score. */
    const matches = SIMULATION_CASES.map(function checkCase(
      testCase,
      index,
    ): boolean {
      /** Section text for this case; empty string when the response had fewer sections than cases. */
      const section = sections[index] ?? '';
      /** Whether this case's output matches its expectation exactly (whitespace-trimmed). */
      const match = section === testCase.expected;
      if (!match) {
        rl.info(
          `case ${testCase.label}: expected ${JSON.stringify(testCase.expected,)}, got ${
            JSON.stringify(section,)
          }`,
        );
      }
      return match;
    },);
    return matches.every(Boolean,) ? 1 : 0;
  },
};

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
  /**
   * Interpreter source files in dependency order; concatenation flows top-down for the model.
   */
  const files = [
    '../stak/interpreter-jumps.ts',
    '../stak/interpreter-ops.ts',
    '../stak/interpreter.ts',
  ] as const;
  /**
   * Raw file contents fetched in parallel; joined below into the embedded prompt block.
   */
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

/**
 * Interpreter TypeScript source, read at module load time and embedded in every probe invocation
 */
const INTERPRETER_SOURCE = await readInterpreterSource();

/**
 * Builds the simulation probe prompt with the interpreter source and all five programs.
 *
 * @returns formatted prompt string
 */
function buildSimulationPrompt(): string {
  /**
   * One formatted block per simulation case; spliced into the prompt below.
   */
  const programBlocks = SIMULATION_CASES.map(
    function formatCase(
      testCase,
      index,
    ): string {
      /**
       * Lines composing one program block: header, fence open, program body, fence close.
       */
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
  /**
   * Response with `---` separators forced onto their own line so the split below stays uniform.
   */
  const normalized = forceDashSeparatorsToOwnLine(response,);
  return splitOnDashOnlyLines(normalized,)
    .map(function trimSection(section,): string {
      return section.trim();
    },);
}

/**
 * Inserts `\n` immediately before every `---` that is not already preceded
 * by `\n` (or start-of-string), scanning left-to-right in one linear pass.
 *
 * Matches come from a non-overlapping `indexOf` walk that advances three
 * chars past each `---`, so a glued run like `------` becomes two separators
 * (`---\n---`), not the overlapping rewrite a `/([^\n])---/g` regex would
 * produce. No recursion, so a long run of separators cannot overflow the
 * stack.
 *
 * @param s - raw model output
 *
 * @returns normalised output where every `---` opens its own line
 *
 * @example
 * ```ts
 * forceDashSeparatorsToOwnLine('a---b');  // 'a\n---b'
 * forceDashSeparatorsToOwnLine('------'); // '---\n---'
 * ```
 */
export function forceDashSeparatorsToOwnLine(s: string,): string {
  /**
   * Length of the `---` separator literal; used as the cursor step.
   */
  const DASH_SEPARATOR_LENGTH = '---'.length;
  return (function build(): string {
    /**
     * Output fragments in order; joined once so the accumulator is never rebuilt per match (O(n), no recursion).
     */
    const out: string[] = [];
    /**
     * Start of the not-yet-emitted text; advances three chars past each `---`.
     */
    let from = 0;
    /**
     * Position of the next `---` at or after `from`; `-1` ends the scan.
     */
    let idx = s.indexOf(
      '---',
      from,
    );
    while (idx !== (-1)) {
      /**
       * Char immediately before the match (or `'\n'` for start-of-string).
       */
      const prev = idx === 0 ? '\n' : s.charAt(idx - 1,);
      /**
       * Synthetic newline inserted unless the match already opens a line.
       */
      const insertion = prev === '\n' ? '' : '\n';
      out.push(
        s.slice(
          from,
          idx,
        ),
      );
      out.push(insertion,);
      out.push('---',);
      from = idx + DASH_SEPARATOR_LENGTH;
      idx = s.indexOf(
        '---',
        from,
      );
    }
    out.push(s.slice(from,),);
    return out.join('',);
  })();
}

/**
 * Splits `s` on lines that contain exactly `---` (and nothing else).
 * Mirrors `s.split(/^---$/m)`: requires the separator to sit alone on its
 * own line, neither prefixed nor suffixed.
 *
 * @param s - normalised text with `---` separators on their own lines
 *
 * @returns ordered list of inter-separator sections
 *
 * @example
 * ```ts
 * splitOnDashOnlyLines('a\n---\nb'); // ['a', 'b']
 * ```
 */
export function splitOnDashOnlyLines(s: string,): string[] {
  /**
   * Lines after a primary `\n` split; separator lines are exactly `---`.
   */
  const lines = s.split('\n',);
  /**
   * Completed sections in order; a separator line (and the final line) always flushes one, even when empty, so consecutive and edge separators yield empty sections.
   */
  const sections: string[] = [];
  /**
   * Lines since the last separator; flushed into `sections` and cleared on each separator so the accumulator is never copied (O(n) total).
   */
  const current: string[] = [];

  for (const line of lines) {
    if (line === '---') {
      sections.push(current.join('\n',),);
      current.length = 0;
    }
    else {
      current.push(line,);
    }
  }

  sections.push(current.join('\n',),);

  return sections;
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
    /**
     * Probe-specific logger for simulation case mismatch messages.
     */
    const rl = tagged({
      tag: 'stak-simulation',
      l: tagged({
        tag: context.label,
        l,
      },),
    },);
    /**
     * Per-case match flags; logged on mismatch and reduced to the overall pass/fail score.
     */
    const matches = SIMULATION_CASES.map(function checkCase(
      testCase,
      index,
    ): boolean {
      /**
       * Section text for this case; empty string when the response had fewer sections than cases.
       */
      const section = sections[index]
        ?? '';
      /**
       * Whether this case's output matches its expectation exactly (whitespace-trimmed).
       */
      const match = section === testCase
        .expected;
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

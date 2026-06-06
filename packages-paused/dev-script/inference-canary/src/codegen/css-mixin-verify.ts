/**
 * Verification logic for the CSS native mixin transpiler probe.
 *
 * Checks that the transpiled output correctly resolves @mixin declarations,
 * expands @apply rules, and handles property overrides.
 */
import type { ContainerResult, } from '../container.ts';

/**
 * Number of correctness checks in the css-mixin scoring function
 */
export const CSS_MIXIN_TOTAL_CHECKS = 11;

/**
 * Minimum number of flex-center expansions expected (into .card, .nav .link, and .hero)
 */
const MIN_FLEX_OCCURRENCES = 3;

/**
 * Maximum consecutive `\n` characters retained when collapsing vertical whitespace.
 */
const MAX_CONSECUTIVE_NEWLINES = 2;

/**
 * Collapses every run of `' '` and `'\t'` into a single space. Mirrors
 * `s.replaceAll(/[ \t]+/g, ' ')` with a linear walker that never revisits
 * a byte. Other whitespace (newlines, carriage returns) passes through
 * unchanged so the subsequent line-shape transforms still see them.
 *
 * @param s - input text
 *
 * @returns text with horizontal whitespace runs collapsed
 *
 * @example
 * ```ts
 * collapseHorizontalRuns('a    b'); // 'a b'
 * ```
 */
export function collapseHorizontalRuns(s: string,): string {
  return (function build(): string {
    /**
     * Output fragments in order; joined once at the end so the accumulator is never rebuilt per char (O(n), no recursion).
     */
    const out: string[] = [];
    /**
     * Whether the previous char was a space or tab; a run emits a single space at its start only.
     */
    let inRun = false;
    for (const c of s) {
      if ((c === ' ') || (c === '\t')) {
        if (!inRun)
          out.push(' ',);
        inRun = true;
      }
      else {
        out.push(c,);
        inRun = false;
      }
    }
    return out.join('',);
  })();
}

/**
 * Collapses any run of three or more consecutive `\n` characters down to
 * exactly two. Mirrors `s.replaceAll(/\n{3,}/g, '\n\n')` with a linear
 * walker; other characters pass through verbatim.
 *
 * @param s - input text
 *
 * @returns text with at most two consecutive newlines anywhere
 *
 * @example
 * ```ts
 * collapseExcessNewlines('a\n\n\n\nb'); // 'a\n\nb'
 * ```
 */
export function collapseExcessNewlines(s: string,): string {
  return (function build(): string {
    /**
     * Output fragments in order; joined once at the end so the accumulator is never rebuilt per char (O(n), no recursion).
     */
    const out: string[] = [];
    /**
     * Consecutive `\n` chars already seen in the current run; only the first `MAX_CONSECUTIVE_NEWLINES` are emitted.
     */
    let runLength = 0;
    for (const c of s) {
      if (c === '\n') {
        if (runLength < MAX_CONSECUTIVE_NEWLINES)
          out.push('\n',);
        runLength += 1;
      }
      else {
        out.push(c,);
        runLength = 0;
      }
    }
    return out.join('',);
  })();
}

/**
 * Checks that the `.override-test` block resolves property override correctly.
 * CSS later properties override earlier ones, so `display: grid` (from the rule)
 * must be the winning declaration over `display: flex` (from the mixin).
 * Accepts both keeping all declarations in source order and collapsing to the winner.
 *
 * @param output - normalized transpiler output
 *
 * @returns true when the last `display:` in the override-test block resolves to `grid`
 *
 * @example
 * ```ts
 * verifyOverrideTest('.override-test { display: flex; display: grid; }'); // true (both kept)
 * verifyOverrideTest('.override-test { display: grid; }'); // true (collapsed)
 * verifyOverrideTest('.override-test { display: flex; }'); // false (wrong winner)
 * ```
 */
function verifyOverrideTest(output: string,): boolean {
  /**
   * Byte offset where the `.override-test` selector begins in the transpiled output.
   */
  const start = output.indexOf('.override-test',);
  if (start === (-1))
    return false;
  /**
   * Byte offset of the closing brace that terminates the `.override-test` rule.
   */
  const blockEnd = output.indexOf(
    '}',
    start,
  );
  /**
   * Slice covering the `.override-test` rule body from selector to closing brace.
   */
  const block = output.slice(
    start,
    blockEnd,
  );
  /**
   * Offset of the last `display:` declaration in the block, used to identify the cascade winner.
   */
  const lastDisplay = block.lastIndexOf('display:',);
  return (lastDisplay !== (-1))
    && block
    .slice(lastDisplay,)
    .includes('grid',);
}

/**
 * Verifies CSS mixin transpiler output against 11 correctness checks.
 *
 * Checks cover: mixin/apply removal, declaration expansion, multi-selector
 * expansion, nested mixin resolution, CSS variable preservation, accessibility
 * utilities, and property override ordering.
 *
 * @param result - container execution result with stdout
 *
 * @returns correctness fraction (correct checks / total checks)
 *
 * @example
 * ```ts
 * const { correctness } = verifyCssMixin(containerResult);
 * ```
 */
export function verifyCssMixin(result: ContainerResult,): { correctness: number; } {
  /**
   * Stdout with whitespace normalised so cosmetic formatting differences do not affect scoring.
   */
  const output = collapseExcessNewlines(collapseHorizontalRuns(result.stdout,),);

  /**
   * Count of `display: flex` declarations; the mixin must expand into three call sites.
   */
  const flexOccurrences = output.split('display: flex',)
    .length
    - 1;
  /**
   * Boolean correctness invariants for each scoring criterion; their sum divided by {@link CSS_MIXIN_TOTAL_CHECKS} is the score.
   */
  const checks = [
    !output.includes('@mixin',),
    !output.includes('@apply',),
    output.includes('margin: 0',)
      && output
      .includes('padding: 0',),
    output.includes('display: flex',)
      && output
      .includes('align-items: center',),
    output.includes('padding-block: 1rem',)
      && output
      .includes('padding-inline: 2rem',),
    output.includes('border-radius: 0.5rem',),
    output.includes('color: var(--link-fg)',),
    output.includes('background-color: var(--surface-bg)',),
    output.includes('clip-path: inset(50%)',)
      && output
      .includes('overflow: hidden',),
    // flex-center should expand into .card, .nav .link, and .hero
    flexOccurrences >= MIN_FLEX_OCCURRENCES,
    // Later property overrides mixin property: either both present in order or only winner kept
    verifyOverrideTest(output,),
  ];

  return { correctness: checks.filter(Boolean,)
    .length
    / CSS_MIXIN_TOTAL_CHECKS, };
}

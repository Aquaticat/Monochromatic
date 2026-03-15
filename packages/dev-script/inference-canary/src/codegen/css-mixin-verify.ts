/**
 * Verification logic for the CSS native mixin transpiler probe.
 *
 * Checks that the transpiled output correctly resolves @mixin declarations,
 * expands @apply rules, and handles property overrides.
 */
import type { ContainerResult, } from '../container.ts';

/** Number of correctness checks in the css-mixin scoring function */
export const CSS_MIXIN_TOTAL_CHECKS = 11;

/** Minimum number of flex-center expansions expected (into .card, .nav .link, and .hero) */
const MIN_FLEX_OCCURRENCES = 3;

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
  const start = output.indexOf('.override-test',);
  if (start === -1)
    return false;
  const blockEnd = output.indexOf('}', start,);
  const block = output.slice(start, blockEnd,);
  const lastDisplay = block.lastIndexOf('display:',);
  return lastDisplay !== -1 && block.slice(lastDisplay,).includes('grid',);
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
  // Normalize whitespace so cosmetic formatting differences don't affect scoring
  const output = result.stdout.replaceAll(/[ \t]+/g, ' ',).replaceAll(/\n{3,}/g, '\n\n',);

  const flexOccurrences = output.split('display: flex',).length - 1;
  const checks = [
    !output.includes('@mixin',),
    !output.includes('@apply',),
    output.includes('margin: 0',) && output.includes('padding: 0',),
    output.includes('display: flex',) && output.includes('align-items: center',),
    output.includes('padding-block: 1rem',) && output.includes('padding-inline: 2rem',),
    output.includes('border-radius: 0.5rem',),
    output.includes('color: var(--link-fg)',),
    output.includes('background-color: var(--surface-bg)',),
    output.includes('clip-path: inset(50%)',) && output.includes('overflow: hidden',),
    // flex-center should expand into .card, .nav .link, and .hero
    flexOccurrences >= MIN_FLEX_OCCURRENCES,
    // Later property overrides mixin property -- either both present in order or only winner kept
    verifyOverrideTest(output,),
  ];

  return { correctness: checks.filter(Boolean,).length / CSS_MIXIN_TOTAL_CHECKS, };
}

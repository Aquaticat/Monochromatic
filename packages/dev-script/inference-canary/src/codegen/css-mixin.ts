/**
 * CSS native mixin transpiler probe.
 *
 * Asks the model to build a single-file CSS transpiler that resolves @mixin declarations
 * and @apply rules. CSS native mixins are new enough that models won't have canned solutions,
 * making this a strong signal of genuine reasoning ability.
 */
import { CSS_MIXIN_TEST_CSS, } from './css-mixin-test-css.ts';
import { CSS_MIXIN_PERF_INPUT, } from './perf-test-data/index.ts';
import { createCodeGenProbe, } from './probe-factory.ts';

import type { ScoreContext, } from '../probes.ts';

/**
 * Tracks whether the most recent score() call detected regex usage, keyed by model ID.
 * Set by transformSource and read by customizeFixPrompt.
 */
const regexViolationCache = new Map<string, boolean>();

/**
 * Detects regular expression usage in generated source code.
 * Matches regex literals (`/.../flags`) and the `new RegExp(...)` constructor.
 * @param source - TypeScript source to check
 * @returns true when regex usage is detected
 *
 * @example
 * ```ts
 * detectsRegexUsage('const re = /foo/g;'); // true
 * detectsRegexUsage('const re = new RegExp("foo");'); // true
 * detectsRegexUsage('source.indexOf("foo")'); // false
 * ```
 */
function detectsRegexUsage(source: string): boolean {
  // oxlint-disable-next-line prefer-named-capture-group -- detection heuristic, not data extraction
  return /\/(\\.|[^/\n])\/[gimsuy]*|new\s+RegExp\s*\(/.test(source);
}

/** Number of correctness checks in the css-mixin scoring function */
const CSS_MIXIN_TOTAL_CHECKS = 11;

/** Constraint violation message prepended to the fix prompt when regex is detected */
const REGEX_CONSTRAINT_MSG = [
  'CONSTRAINT VIOLATION: Your solution used regular expressions, which is explicitly forbidden by the prompt.',
  'Your score was 0. Rewrite the solution using character-by-character parsing or string index operations instead.',
  '',
].join('\n');

/**
 * Checks that the `.override-test` block resolves property override correctly.
 * CSS later properties override earlier ones, so `display: grid` (from the rule)
 * must be the winning declaration over `display: flex` (from the mixin).
 * Accepts both keeping all declarations in source order and collapsing to the winner.
 * @param output - normalized transpiler output
 * @returns true when the last `display:` in the override-test block resolves to `grid`
 *
 * @example
 * ```ts
 * verifyOverrideTest('.override-test { display: flex; display: grid; }'); // true (both kept)
 * verifyOverrideTest('.override-test { display: grid; }'); // true (collapsed)
 * verifyOverrideTest('.override-test { display: flex; }'); // false (wrong winner)
 * ```
 */
function verifyOverrideTest(output: string): boolean {
  const start = output.indexOf('.override-test');
  if (start === -1) return false;
  const blockEnd = output.indexOf('}', start);
  const block = output.slice(start, blockEnd);
  const lastDisplay = block.lastIndexOf('display:');
  return lastDisplay !== -1 && block.slice(lastDisplay).includes('grid');
}

/** {@inheritDoc Probe} */
export const cssMixinTranspiler = createCodeGenProbe({
  name: 'css-mixin-transpiler',
  testInput: CSS_MIXIN_TEST_CSS,
  perfTest: {
    input: CSS_MIXIN_PERF_INPUT,
    fastMs: 3_000,
    slowMs: 12_000,
  },
  transformSource: (source, context) => {
    const usesRegex = detectsRegexUsage(source);
    regexViolationCache.set(context.label, usesRegex);
    return { reject: usesRegex, source, };
  },
  customizeFixPrompt: (base, context) => {
    if (regexViolationCache.get(context.label) !== true) return base;
    // Prepend constraint violation to existing fix prompt, or create a standalone prompt
    return base !== undefined ? `${REGEX_CONSTRAINT_MSG}\n${base}` : REGEX_CONSTRAINT_MSG;
  },
  prompt: [
    'Write a TypeScript CLI that reads CSS from stdin and writes transpiled CSS to stdout.',
    'It must resolve CSS native mixins:',
    '',
    '1. Parse `@mixin --name { ...declarations... }` blocks and collect their contents',
    '2. Replace every `@apply --name;` rule with the collected declarations from that mixin',
    '3. Remove `@mixin` blocks from the output entirely',
    '4. Preserve all other CSS exactly as-is (selectors, properties, comments, whitespace between rules)',
    '5. A rule block may contain multiple `@apply` rules -- expand each in order',
    '6. The same mixin may be referenced from multiple rule blocks',
    '7. Mixin names always start with `--` (CSS custom property convention)',
    '8. Mixin bodies can contain declarations, nested rules, AND `@apply` of other mixins (recursive expansion)',
    '9. `@apply` can appear inside nested rules (CSS nesting with `&`) -- resolve them at any depth',
    '10. `@apply` at the top level (outside any rule block) expands the mixin body directly into the stylesheet',
    '',
    'Constraint: do not use regular expressions (no RegExp literals, no `new RegExp`, no `String.match`/`replace`/`search` with regex patterns).',
    'Parse the CSS by walking the text character-by-character or using string index operations.',
    'Solutions that use regex in any form will be rejected and scored 0.',
    '',
    'Example 1 -- basic:',
    '```css',
    '@mixin --flex-center {',
    '  display: flex;',
    '  align-items: center;',
    '}',
    '.card { @apply --flex-center; padding: 1rem; }',
    '```',
    'Becomes:',
    '```css',
    '.card { display: flex; align-items: center; padding: 1rem; }',
    '```',
    '',
    'Example 2 -- top-level apply:',
    '```css',
    '@mixin --reset { body { margin: 0; } }',
    '@apply --reset;',
    '```',
    'Becomes:',
    '```css',
    'body { margin: 0; }',
    '```',
  ].join('\n'),
  verify: (result) => {
    // Normalize whitespace so cosmetic formatting differences don't affect scoring
    const output = result.stdout.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');

    const flexOccurrences = output.split('display: flex').length - 1;
    const checks = [
      !output.includes('@mixin'),
      !output.includes('@apply'),
      output.includes('margin: 0') && output.includes('padding: 0'),
      output.includes('display: flex') && output.includes('align-items: center'),
      output.includes('padding-block: 1rem') && output.includes('padding-inline: 2rem'),
      output.includes('border-radius: 0.5rem'),
      output.includes('color: var(--link-fg)'),
      output.includes('background-color: var(--surface-bg)'),
      output.includes('clip-path: inset(50%)') && output.includes('overflow: hidden'),
      // flex-center should expand into .card, .nav .link, and .hero = 3 occurrences
      flexOccurrences >= 3,
      // Later property overrides mixin property -- either both present in order or only winner kept
      verifyOverrideTest(output),
    ];

    return { correctness: checks.filter(Boolean).length / CSS_MIXIN_TOTAL_CHECKS, };
  },
});

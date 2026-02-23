/**
 * CSS native mixin transpiler probe.
 *
 * Asks the model to build a single-file CSS transpiler that resolves @mixin declarations
 * and @apply rules. CSS native mixins are new enough that models won't have canned solutions,
 * making this a strong signal of genuine reasoning ability.
 */
import { runInContainer, } from '../container.ts';

import { CODE_GEN_SYSTEM, } from './system-prompt.ts';
import { buildCodeGenFixPrompt, combinedScore, extractCode, lintAndLog, } from './scoring.ts';
import { CSS_MIXIN_TEST_CSS, } from './css-mixin-test-css.ts';

import type { LintResult, } from '../linter.ts';
import type { Probe, } from '../probes.ts';

/**
 * Lint results from the most recent score() call, keyed by model ID.
 * Used by buildFixPrompt to avoid re-linting the same source that score() already analyzed.
 */
const lintCache = new Map<string, LintResult>();

/** Number of correctness checks in the css-mixin scoring function */
const CSS_MIXIN_TOTAL_CHECKS = 10;

/** {@inheritDoc Probe} */
export const cssMixinTranspiler: Probe = {
  name: 'css-mixin-transpiler',
  category: 'code-gen',
  system: CODE_GEN_SYSTEM,
  buildFixPrompt: (response, context) => buildCodeGenFixPrompt(response, context, lintCache.get(context.modelId)),
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
  score: async (response, context) => {
    const source = extractCode(response);
    const [result, lint] = await Promise.all([
      runInContainer(source, CSS_MIXIN_TEST_CSS),
      lintAndLog(source, 'css-mixin', context),
    ]);
    lintCache.set(context.modelId, lint);

    if (result.timedOut || result.exitCode !== 0) return combinedScore(0, lint);

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
    ];

    return combinedScore(checks.filter(Boolean).length / CSS_MIXIN_TOTAL_CHECKS, lint);
  },
};

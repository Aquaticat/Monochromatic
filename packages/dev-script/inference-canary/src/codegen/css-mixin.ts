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

import { verifyCssMixin, } from './css-mixin-verify.ts';

import type { ScoreContext, } from '../probes.ts';

/**
 * Tracks whether the most recent score() call detected regex usage, keyed by model ID.
 * Set by transformSource and read by customizeFixPrompt.
 */
const regexViolationCache = new Map<string, boolean>();

/**
 * Detects regular expression usage in generated source code.
 * Matches regex literals (`/.../flags`) and the `new RegExp(...)` constructor.
 *
 * @param source - TypeScript source to check
 *
 * @returns true when regex usage is detected
 *
 * @example
 * ```ts
 * detectsRegexUsage('const re = /foo/g;'); // true
 * detectsRegexUsage('const re = new RegExp("foo");'); // true
 * detectsRegexUsage('source.indexOf("foo")'); // false
 * ```
 */
function detectsRegexUsage(source: string,): boolean {
  // oxlint-disable-next-line prefer-named-capture-group -- detection heuristic, not data extraction
  return /\/(\\.|[^/\n])\/[gimsuy]*|new\s+RegExp\s*\(/.test(source,);
}

/** Constraint violation message prepended to the fix prompt when regex is detected */
const REGEX_CONSTRAINT_MSG = [
  'CONSTRAINT VIOLATION: Your solution used regular expressions, which is explicitly forbidden by the prompt.',
  'Your score was 0. Rewrite the solution using character-by-character parsing or string index operations instead.',
  '',
]
  .join('\n',);

/**
 * {@inheritDoc Probe}
 */
export const cssMixinTranspiler = createCodeGenProbe({
  name: 'css-mixin-transpiler',
  testInput: CSS_MIXIN_TEST_CSS,
  perfTest: {
    input: CSS_MIXIN_PERF_INPUT,
    fastMs: 3_000,
    slowMs: 12_000,
  },
  transformSource: function checkRegex(source,
    context,): { reject: boolean; source: string; }
  {
    const usesRegex = detectsRegexUsage(source,);
    regexViolationCache.set(context.label, usesRegex,);
    return { reject: usesRegex, source, };
  },
  customizeFixPrompt: function addRegexWarning(base, context,): string | undefined {
    if (regexViolationCache.get(context.label,) !== true)
      return base;
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
  ]
    .join('\n',),
  verify: verifyCssMixin,
},);

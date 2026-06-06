/**
 * CSS native mixin transpiler probe.
 *
 * Asks the model to build a single-file CSS transpiler that resolves @mixin declarations
 * and @apply rules. CSS native mixins are new enough that models won't have canned solutions,
 * making this a strong signal of genuine reasoning ability.
 */
import type {
  Probe,
  ScoreContext,
} from '../probes.ts';
import { CSS_MIXIN_TEST_CSS, } from './css-mixin-test-css.ts';
import { CSS_MIXIN_PERF_INPUT, } from './perf-test-data/index.ts';
import { createCodeGenProbe, } from './probe-factory.ts';

import { verifyCssMixin, } from './css-mixin-verify.ts';

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
 * detectsRegexUsage('const re = /a/g;'); // true (one-char body)
 * detectsRegexUsage('const re = /foo/g;'); // false (multi-char body; literal detection is deliberately narrow)
 * detectsRegexUsage('const re = new RegExp("foo");'); // true
 * detectsRegexUsage('source.indexOf("foo")'); // false
 * ```
 */
export function detectsRegexUsage(source: string,): boolean {
  return hasRegexConstructorCall(source,)
    || hasSingleCharRegexLiteral(source,);
}

/**
 * Returns the first index at or after `from` in `s` that is not one of the
 * six ASCII whitespace chars, scanning left-to-right in one linear pass with
 * no recursion. Returns `s.length` when the tail from `from` is all
 * whitespace.
 *
 * @param s - string whose chars are scanned
 *
 * @param from - index to start scanning from
 *
 * @returns first non-whitespace index at or after `from`, or `s.length`
 *
 * @example
 * ```ts
 * skipInlineWhitespace({ s: 'a   b', from: 1 }); // 4
 * skipInlineWhitespace({ s: 'ab', from: 1 });    // 1
 * ```
 */
function skipInlineWhitespace({
  s,
  from,
}: {
  readonly s: string;
  readonly from: number;
},): number {
  return (function advance(): number {
    /**
     * Cursor advanced over each whitespace char; the first non-whitespace index is returned.
     */
    let pos = from;
    while (pos < s
      .length) {
      /**
       * Char at the cursor; only the six ASCII whitespace chars advance the scan.
       */
      const c = s.charAt(pos,);
      if (
        (c !== ' ')
        && (c !== '\t')
          && (c !== '\n')
          && (c !== '\r')
          && (c !== '\f')
          && (c !== '\v')
      ) {
        return pos;
      }
      pos += 1;
    }
    return pos;
  })();
}

/**
 * Returns true when `source` contains a `new RegExp` constructor call,
 * allowing whitespace between the identifier and the opening parenthesis.
 * Scans every `new RegExp` occurrence left-to-right in one linear pass; no
 * recursion, so a long run of occurrences cannot overflow the stack.
 *
 * @param source - candidate TypeScript source
 *
 * @returns whether `source` shows a `new RegExp` invocation
 */
function hasRegexConstructorCall(source: string,): boolean {
  /**
   * Constructor identifier whose `(`-after-whitespace continuation marks an invocation.
   */
  const TOKEN = 'new RegExp';
  return (function scanTokens(): boolean {
    /**
     * Index of the candidate `new RegExp`; advances one past each non-matching occurrence.
     */
    let idx = source.indexOf(
      TOKEN,
      0,
    );
    while (idx !== (-1)) {
      /**
       * First non-whitespace index after the token; its char must be `(` to count as a call.
       */
      const afterWs = skipInlineWhitespace({
        s: source,
        from: idx + TOKEN
          .length,
      },);
      if (source.charAt(afterWs,)
        === '(')
        return true;
      idx = source.indexOf(
        TOKEN,
        idx + 1,
      );
    }
    return false;
  })();
}

/**
 * Returns true when `source` contains a one-char regex literal of the
 * form `'/X/[flags]'`, where `X` is either a single non-`/` non-newline
 * character or a backslash-escape sequence. Mirrors the prior
 * `/\/(\\.|[^/\n])\/[gimsuy]*\/` heuristic; preserves its (deliberately
 * narrow) one-char-body shape.
 *
 * @param source - candidate TypeScript source
 *
 * @returns whether `source` contains a one-char regex literal
 */
function hasSingleCharRegexLiteral(source: string,): boolean {
  // Walk every `/` left-to-right as a candidate regex opener in one linear
  // pass; no recursion, so a long run of slashes cannot overflow the stack.
  // The match shape is: opener `/`, then either one non-`/` non-`\n` char OR
  // a `\<any>` escape (2 chars), then a closing `/`.
  return (function scanSlashes(): boolean {
    /**
     * Index of the candidate opener `/`; advances one past each occurrence that fails the shape.
     */
    let open = source.indexOf(
      '/',
      0,
    );
    while (open !== (-1)) {
      /**
       * Body length: `2` for `\X`, `1` for a plain char.
       */
      const bodyLen = source.charAt(open + 1,)
        === '\\' ? 2 : 1;
      /**
       * Index of the closing-slash slot, just past the body.
       */
      const bodyEnd = open + 1
        + bodyLen;
      if (bodyEnd >= source
        .length)
        return false;
      /**
       * Body char (or escape lead) checked against the `[^/\n]` constraint.
       */
      const body = source.charAt(open + 1,);
      /**
       * Whether a one-char body is itself `/` or newline, which the shape forbids.
       */
      const bodyIsForbidden = (bodyLen === 1) && ((body === '/') || (body === '\n'));
      if ((!bodyIsForbidden) && (source.charAt(bodyEnd,)
        === '/'))
        return true;
      open = source.indexOf(
        '/',
        open + 1,
      );
    }
    return false;
  })();
}

/**
 * Constraint violation message prepended to the fix prompt when regex is detected
 */
const REGEX_CONSTRAINT_MSG = [
  'CONSTRAINT VIOLATION: Your solution used regular expressions, which is explicitly forbidden by the prompt.',
  'Your score was 0. Rewrite the solution using character-by-character parsing or string index operations instead.',
  '',
]
  .join('\n',);

/**
 * {@inheritDoc Probe}
 */
export const cssMixinTranspiler: Probe = createCodeGenProbe({
  name: 'css-mixin-transpiler',
  testInput: CSS_MIXIN_TEST_CSS,
  perfTest: {
    input: CSS_MIXIN_PERF_INPUT,
    fastMs: 3_000,
    slowMs: 12_000,
  },
  transformSource: function checkRegex(
    source,
    context,
  ): {
    reject: boolean;
    source: string;
  } {
    /**
     * Whether the model's source violates the no-regex constraint stated in the prompt.
     */
    const usesRegex = detectsRegexUsage(source,);
    regexViolationCache.set(
      context.label,
      usesRegex,
    );
    return {
      reject: usesRegex,
      source,
    };
  },
  customizeFixPrompt: function addRegexWarning(
    base,
    context,
  ): string {
    if (regexViolationCache.get(context.label,)
      !== true)
      return base;
    // Prepend constraint violation to existing fix prompt, or create a standalone prompt
    return base !== '' ? `${REGEX_CONSTRAINT_MSG}\n${base}` : REGEX_CONSTRAINT_MSG;
  },
  prompt: [
    'Write a TypeScript CLI that reads CSS from stdin and writes transpiled CSS to stdout.',
    'It must resolve CSS native mixins:',
    '',
    '1. Parse `@mixin --name { ...declarations... }` blocks and collect their contents',
    '2. Replace every `@apply --name;` rule with the collected declarations from that mixin',
    '3. Remove `@mixin` blocks from the output entirely',
    '4. Preserve all other CSS exactly as-is (selectors, properties, comments, whitespace between rules)',
    '5. A rule block may contain multiple `@apply` rules; expand each in order',
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
    'Example 1 (basic):',
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
    'Example 2 (top-level apply):',
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

# typesafe-i18n: catastrophic regex backtracking on nested-brace strings

## Symptom

A page that uses [`typesafe-i18n`][typesafe-i18n] hangs indefinitely
when rendering a translation whose value contains nested `{}` patterns
(e.g. an embedded JSON schema literal).
The hang is silent: no console error,
no JS exception,
and no network activity until the regex engine times out.
Bun (JavaScriptCore) handles the same input in microseconds,
so back-end smoke tests pass while browser e2e tests time out.

Concretely,
in `paper2vn` the chapter-generation prompt was stored as a translation:

```ts
chapterInstruction:
  'Split the paper into 3 to 8 chapters that follow the paper\'s logical structure. ' +
  'Return JSON with shape `{ "title": string, "chapters": [{ "title": string, "summary": string, ' +
  '"dialogue": [{ "text": string, "pose": "neutral" | "thinking" | "happy" }] }] }`. ' +
  'Each chapter should have 3 to 6 dialogue beats; each beat is one to three sentences.',
```

Calling `LL().chapterInstruction()` from the browser pinned a CPU at 100%
and never returned within a 4-minute test timeout.

## Root cause

`typesafe-i18n` parses every translation lazily on first access using
a regex defined in `parser/src/parse-rule.mts` (compiled into
`runtime/dist/i18n.object.js`):

```js
var REGEX_BRACKETS_SPLIT = /(\{(?:[^{}]+|\{(?:[^{}]+)*\})*\})/g;
```

Source path in node_modules:
`node_modules/.pnpm/typesafe-i18n@5.27.1_typescript@6.0.2/node_modules/typesafe-i18n/dist/i18n.object.js:60`.

The pattern is a textbook
[catastrophic-backtracking][redos] case.
The outer group allows arbitrary alternation between
`[^{}]+` (non-brace text)
and a nested `\{(?:[^{}]+)*\}` (one level of nesting).
Both branches share the same `[^{}]+` cost,
so on input with three or more nesting levels (
exactly what a JSON schema string contains)
the engine explores every interleaving before declaring no match.

V8 (Chrome) handles the regex via a backtracking interpreter and pins for minutes.
JavaScriptCore (Bun, Safari) and SpiderMonkey
(Firefox 140 on this box, observationally)
either short-circuit early or use a different scheduling strategy
that hides the worst case.
The bug is engine-dependent,
which is why a Bun smoke test for the same code path passes in 60 seconds
while a Playwright run in headless Chromium hangs forever.

This is a bug in the parser regex,
not in the consumer's translation file.
The translation contains a literal `{` /
`}` pattern that is meaningful to the consumer (a JSON schema)
but indistinguishable from
`typesafe-i18n`'s parameter-interpolation syntax (`{key}`).
The regex tries to disambiguate by accepting any `{}`-bounded section,
and that's where it fails.

## Verification

Minimal repro:

```ts
import { i18nObject, } from 'typesafe-i18n/runtime/esm';
const dict = {
  bad: '{ "a": [{ "b": [{ "c": "x" }] }] }',
};
const LL = i18nObject('en', { en: dict, }, {}, {},);
console.time('lookup');
LL.bad();
console.timeEnd('lookup');
```

Run under Chrome 145 / V8: `lookup` never returns.
Run under Bun 1.x or SpiderMonkey: sub-millisecond.

The threshold is roughly three levels of nested `{}`;
two levels stay within practical bounds even in V8.

## Fix used in `paper2vn`

`paper2vn` translations include `persona`, `chapterInstruction`,
and `askInstruction`:
locale-aware system prompts that need no parameter interpolation.
We bypass the parser entirely
for those keys via `rawString` in `i18n/runtime.ts`:

```ts
import { loadedLocales, } from './i18n-util.ts';

type StringKey = {
  [K in keyof Translations]: Translations[K] extends string ? K : never;
}[keyof Translations];

export function rawString(key: StringKey,): string {
  const locale = resolveLocale();
  const value = loadedLocales[locale][key];
  if (typeof value !== 'string')
    throw new Error(`[i18n] expected string for ${key}, got ${typeof value}`,);
  return value;
}
```

Call sites in `client/dialogue/generator.ts` and
`client/dialogue/ask.ts` swap from
`ll.chapterInstruction()` to `rawString('chapterInstruction')`.
The lookup is a plain object index;
no regex evaluation runs.

This works because the affected keys hold static strings:
nothing that needs typesafe-i18n's templating machinery.
Translation keys that *do* need parameters
(`{name}`, plurals, formatters, ...) must keep using `LL()`.

## Alternatives we considered and rejected

- **Escape every `{` in the translation as `\{`.**
  Mechanical but voluminous:
  the JSON schema has dozens of braces,
  and every locale needs the same edits.
  A single missed escape silently re-introduces the hang.
- **Move the schema part out of i18n into a constant in `generator.ts`.**
  Loses locale-aware schema phrasing
  (the Chinese prompt has the schema in the same sentence as the count guidance).
  The split would either duplicate the natural-language part across locales
  or interleave i18n strings with hardcoded chunks.
- **Pre-compute every translation eagerly at boot.**
  Triggers the same regex on the same input:
  doesn't help.
- **Switch to a different i18n library.**
  Disproportionate to one bug in one prompt;
  `typesafe-i18n` is otherwise fine.

`rawString` is minimal and isolates the workaround
to two call sites with a comment pointing at this doc.

## What does *not* work

- Using `\{` and `\}` only at the outermost level.
  The regex still descends into the content
  and backtracks on inner braces.
- Replacing the JSON schema with `<json>...</json>` placeholders
  and substituting at call time.
  The placeholders have no `{}` at all,
  so the parser is fine,
  but the LLM sees a degraded prompt
  and starts producing schema-violating output
  (we observed this in early experiments).
- Disabling minification on the client bundle.
  Confirmed by building with `compress: false`:
  the hang persists,
  ruling out a minifier-induced regex change.

## Decision: keep `typesafe-i18n`

We evaluated dropping `typesafe-i18n` entirely.
Decision: **keep it**, retain the `rawString` workaround.

### Why keep it

- The bug is **fully contained**.
  Only three translations have nested `{}` (
  `persona`,
  `chapterInstruction`,
  `askInstruction`)
  and all three already bypass the parser.
  Every other key
  (UI labels,
  error messages,
  status text)
  goes through the normal `LL()` path and works.
- The project is **alive enough**.
  Original author Ivan Hofer (1995-2023) is memorialized in the README;
  the repo was transferred to the `codingcommons` organization
  (`https://github.com/codingcommons/typesafe-i18n`)
  and the new maintainers shipped `5.27.1` on 2026-02-11
  after a ~2.5-year dormant gap.
  npm downloads roughly doubled year-over-year to ~50k/week.
- **Zero runtime dependencies**,
  **zero CVEs / advisories ever filed**
  (GitHub Advisory DB,
  Snyk,
  Socket, all clean as of 2026-04-29).
  The supply-chain surface is the smallest of any candidate evaluated.
- **Migration cost is meaningful**:
  every `ll.foo()` call site across `screens/*`,
  the type-generation pipeline,
  and three locale files would need to change,
  plus full e2e re-validation.
  Not justified for one contained parser bug.

### Risks we accept

- No bug-fix commits have landed at `codingcommons` since the revival:
  most activity is CI/release plumbing
  (release-please,
  Node 24,
  npm provenance).
  Even if we file the ReDoS upstream
  (the draft below is ready),
  do not assume a quick fix.
- The bug is **latent and unreported**.
  No public CVE exists.
  Anyone introducing a new translation with three or more levels of nested `{}`
  reproduces the V8 hang silently.
  The `rawString` workaround comment
  and this doc are the only guard.
- Effective maintainer bus factor is one
  (Ivan Hofer authored 1231 of ~1300 commits;
  current top contributor `benjaminstrasser` has 6).
  If the codingcommons revival stalls,
  the next decision will be forced.

### Top alternatives (for the file-this-when-it-stalls case)

1. **`i18next`** with default `{{ }}` syntax.
  Interpolation regex is `/{{(.+?)}}/g`:
  non-greedy,
  no nested-brace alternation,
  and **does not match single `{` or `}` at all**.
  Empirically 0 matches in 0.16 ms on our JSON-with-3-levels input.
  Literal `{` needs no escaping.
  Type safety via `i18next-resources-for-ts`
  (less first-class than `typesafe-i18n`,
  but workable).
  Two historical XSS CVEs
  (CVE-2017-16008,
  CVE-2017-16010),
  both fixed.
  **Lowest-friction migration**.
2. **`@lingui/core`**.
  Translations are compiled to a token array at build time;
  the runtime never regex-scans `{...}`.
  Best security posture of any candidate
  (Crowdin-backed,
  248 contributors,
  SLSA provenance attestations on npm,
  smallest gzip ~2 kB).
  Downside:
  ICU MessageFormat requires single-quote escape for literal `{` /
  `}`:
  same escaping-gymnastics problem we hit with the regex,
  just at compile time instead of runtime.
3. **`@inlang/paraglide-js`**.
  Only runtime that needs **zero escaping** for `{`:
  translations are compiled to JS template literals
  (e.g. `` `Hello ${name}` ``),
  so the literal text never round-trips through any parser.
  Downside:
  heavier transitive build deps
  (`@inlang/sdk`,
  `@lix-js/sdk`,
  `kysely`,
  `sqlite-wasm-kysely`),
  and effectively two-maintainer.

### Order if we ever switch

`paraglide-js` for technical fit (no escaping at all),
or `i18next` for migration ease.
`@lingui/core` is the security-first pick
but inherits the same literal-brace problem
in a different shape.

## Draft upstream issue

Title: parser regex catastrophically backtracks on translations
containing nested `{}` literals (engine-dependent: V8 hangs)

Labels: `bug`, `parser`

```md
## Description

`REGEX_BRACKETS_SPLIT` in `parser/src/parse-rule.mts` exhibits
catastrophic backtracking on translation values that contain three or
more levels of nested `{}` literals. The hang is engine-dependent:
JavaScriptCore (Bun, Safari) returns sub-millisecond; V8 (Chrome,
Edge) pins a CPU and never returns within practical timeouts.

The pattern is `/(\{(?:[^{}]+|\{(?:[^{}]+)*\})*\})/g`. The two
alternatives in the inner non-capturing group share `[^{}]+`, so the
engine explores every interleaving when neither alternative matches,
which is what happens on input shaped like an embedded JSON schema.

## Reproduction

```ts
import { i18nObject } from 'typesafe-i18n';

const en = {
  bad: '{ "a": [{ "b": [{ "c": "x" }] }] }',
};
const LL = i18nObject('en', { en } as any, {}, {});

console.time('lookup');
LL.bad();         // hangs in V8, returns immediately in JSC
console.timeEnd('lookup');
```

Run under Chrome (or any V8-based environment, including Node) and
the call never returns within a reasonable test timeout. Run under
Bun and it returns immediately.

## Why this matters

LLM-app boilerplate often stores model instructions as translations
so the prompt can be locale-aware. Embedded JSON schema literals
(`{ "title": string, "chapters": [{ ... }] }`) are common in those
prompts. The hang has no console output, no exception, and no network
activity, so it presents to consumers as "the page froze" with no
diagnostic.

## Suggested fix

Replace the alternation pattern with one that doesn't share a left-
factor across branches, e.g. parse `{...}` sections with a recursive
descent helper that runs in linear time instead of relying on a regex
to handle nesting. A short-term mitigation could replace the regex
with one that bails out on more than two levels of nesting and
reports a clearer error.

## Workaround

Read the raw string from `loadedLocales[locale][key]` directly when
the translation contains literal braces and doesn't need parameter
interpolation. This bypasses the parser entirely.
```

[typesafe-i18n]: https://github.com/ivanhofer/typesafe-i18n
[redos]: https://en.wikipedia.org/wiki/ReDoS

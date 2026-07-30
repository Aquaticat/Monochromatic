# Learning Rust HTML formatting boundary

Proposal for GitHub issue 401,
`Reconcile learning Rust HTML source contract with dprint and Stylelint`.

Status: proposal.
The repository owner has not accepted an option.
Nothing here is a ratified decision.

## What issue 401 asked

The standalone teaching pages under `package/learning/rust/` repeat an exact compact inline CSS snippet
recorded in `package/learning/rust/NOTES.md`.
dprint reports every page unformatted,
and Stylelint reports 40 errors across the five pages.

Issue 401 recommended revising the source contract so the pages match the shared dprint and Stylelint fixed point.
The repository owner was reluctant to apply that recommendation.

## Why the recommendation should not be applied as written

Three of the issue's load-bearing claims were unmeasured.
All three were measured in a throwaway worktree at `HEAD` `aa4747a1e`,
with dprint 0.55.2, `markup_fmt` 0.23.1, Malva 0.14.1, and Stylelint 17.14.1.

### markup_fmt reflows hand-authored prose, so the cost recurs

Issue 401 called the formatting cost `broad one-time HTML churn`.
It is not one-time.
`markup` is configured with `printWidth: 90`,
and `dprint fmt` rewraps prose inside block elements at that column.

Formatting `package/learning/rust/reference/reading-loop.html` turned this authored line:

```html
      <li>Inspect the linked monorepo source only when the lesson says the required concepts are available.</li>
```

into this:

```html
        <li>
          Inspect the linked monorepo source only when the lesson says the required
          concepts are available.
        </li>
```

The break now falls between `required` and `concepts`,
chosen by column count rather than by meaning.
Every future prose edit reflows its neighbours,
so sentence-level diffs become paragraph-level diffs permanently.
`AGENTS.md` rule `MD1` requires exactly the semantic-boundary style these pages already use,
for Markdown.

The same run also uppercased `<!doctype html>` to `<!DOCTYPE html>`,
rewrote attribute quotes from double to single,
split `<meta name='viewport' content='...'>` across three lines under `maxAttrsPerLine: 1`,
and reindented `<head>` and `<body>` by one level.
The two prose pages formatted together produced 200 insertions and 153 deletions.

### The compliant CSS is 20 lines, breaking a second `NOTES.md` rule

`package/learning/rust/NOTES.md` requires keeping the CSS `near ten lines`.
The canonical snippet is 8 lines.

The shared fixed point that passes both tools is:

```css
:root {
  --dark: oklch(10% 0 0turn);
  --light: oklch(90% 0 0turn);

  @media (prefers-color-scheme: light) {
    --fg: var(--dark);
    --bg: var(--light);
  }

  @media (prefers-color-scheme: dark) {
    --fg: var(--light);
    --bg: var(--dark);
  }
}

html {
  color: var(--fg);

  background-color: var(--bg);
}
```

That is 20 lines,
two and a half times the canonical form,
in the same file that caps the CSS near ten.
Issue 401 resolves one policy conflict by creating another.

Reaching that fixed point also required a correction to the issue's description.
Issue 401 proposed `required blank lines` before declarations.
Blank lines between consecutive custom properties are rejected by
`custom-property-empty-line-before`,
whose `stylelint-config-standard` value excepts `after-custom-property`.
Only `background-color` takes a preceding blank line.

Two of the issue's five rules are notational and could be satisfied without touching layout:
`lightness-notation` and `hue-degree-notation`.
The other three cannot be satisfied while the block stays compact:
`declaration-block-single-line-max-declarations`,
`at-rule-empty-line-before`,
and `declaration-empty-line-before`.
Option 1 therefore necessarily destroys the compact form;
it is not the same CSS in different notation.

### Stylelint coverage is not all-or-nothing

Issue 401 framed the choice as keeping every check or excluding the files.
A scoped `overrides` entry is a third path that the issue never considered,
and `AGENTS.md` rule `LN3` requires trying configuration before any suppression.

## Recommended option

Treat `package/learning/rust/**/*.html` as an authored-document boundary,
using two narrow configuration changes and no in-file directives.

### Exclude the pages from dprint only

Add to the root `dprint.json`:

```json
{
  "extends": ["./package/config/dprint/index.json"],
  "excludes": [
    "package/learning/rust/**/*.html"
  ]
}
```

Measured:
`dprint output-file-paths` drops from 767 to 762 entries,
removing exactly the five learning pages.
Every inherited exclude stays honoured
(`node_modules`, `dist`, `src/i18n`, and the `toml-edit` fixtures remain absent).
Ten other HTML files stay under dprint.

Root `dprint.json` is the right home rather than `package/config/dprint/index.json`,
because the shared Stylelint config already states that path-based ignores must live in the consuming root config.
The shared dprint config does carry repository-specific fixture paths today,
so precedent is mixed;
root placement keeps the learning-content exception out of the reusable config.

### Re-point the five Stylelint rules instead of disabling them

Add to the root `stylelint.config.mjs`:

```js
// stylelint.config.mjs
overrides: [{
  files: ['package/learning/rust/**/*.html',],
  customSyntax: 'postcss-html',
  rules: {
    'lightness-notation': 'number',
    'hue-degree-notation': 'number',
    'at-rule-empty-line-before': 'never',
    'declaration-block-single-line-max-declarations': 2,
    'declaration-empty-line-before': 'never',
  },
},],
```

These are alternate rule values,
not `null` and not disables.
Stylelint stops reporting the compact form as wrong and starts enforcing it.

Measured on the five canonical pages: exit 0, zero errors.

Measured against a probe page that drifted from the compact contract:

- `oklch(10% ...)` rejected with `Expected "10%" to be "0.1"` from `lightness-notation`;
- a blank line before `@media` rejected by `at-rule-empty-line-before`;
- a blank line before a declaration rejected by `declaration-empty-line-before`;
- three declarations on one line rejected by `declaration-block-single-line-max-declarations`;
- `color: red` still rejected by `color-named` from the base config;
- a missing blank line before a rule still rejected by `rule-empty-line-before`.

Measured that the rest of the workspace CSS policy stays active inside the boundary:
`color-named`,
`function-disallowed-list`,
`unit-disallowed-list`,
`media-feature-name-unit-allowed-list`,
`media-feature-range-notation`,
and `media-feature-name-disallowed-list` all fired on the probe.

Measured that the five rules keep their standard values outside the boundary:
a probe with identical CSS placed at the repository root still reported
`lightness-notation`,
`hue-degree-notation`,
`at-rule-empty-line-before`,
`declaration-block-single-line-max-declarations`,
and `declaration-empty-line-before`.

### The auto-fix trap disappears

Issue 401 recorded that `stylelint --fix` cannot reach a valid result from the canonical snippet,
because it rewrites unitless hue zero to `0deg`,
which the workspace `unit-disallowed-list` then rejects.

Under the re-pointed rules,
`stylelint --fix` across `package/learning/rust/**/*.html` exits 0
and leaves the pages byte-identical.
The trap is resolved rather than avoided,
so the repository `format` task becomes stable on these files instead of fighting them.

### Record the policy in `NOTES.md`

`package/learning/rust/NOTES.md` should state that the compact CSS is enforced by the scoped Stylelint override,
that dprint does not format these pages,
and that prose line breaks follow semantic boundaries rather than a column limit.
The last point is currently implicit in the authored files and stated nowhere.

## Pros and cons

### Recommended: authored-document boundary with re-pointed rules

Pros:
preserves the exact compact CSS and the authored prose boundaries;
adds no in-file clutter and no per-page work for future lessons;
keeps every semantic CSS rule active inside the boundary;
converts five rules from unsatisfiable to enforcing, so the contract is machine-checked;
resolves the `stylelint --fix` trap;
uses the two mechanisms the repository already uses for exact-source files.

Cons:
dprint stops checking five of the fifteen HTML files it covers;
adds two configuration exceptions to maintain;
the five re-pointed rules mean these pages will not match repository CSS style if the compact contract is ever dropped;
`dprint check` invoked with those paths explicitly now exits 14 with `No files found to format`,
so the reproduction command in issue 401 fails for a new reason.

### Issue option 1: revise the source contract

Pros:
keeps root tooling untouched;
one formatter fixed point for every file;
no exceptions, suppressions, or scoped configuration;
rendered light and dark behaviour is unchanged.

Cons:
revokes the approved compact form;
grows the CSS from 8 to 20 lines, breaching the `near ten lines` rule in the same `NOTES.md`;
hands permanent 90-column control over teaching prose to `markup_fmt`;
makes future prose edits reflow their neighbours;
the initial pass is large review noise for zero behaviour change.

### Ignore only each `<style>` element and re-point the Stylelint rules

Measured as partly unavailable.
`<!-- dprint-ignore -->` placed before `<style>` does not protect the embedded CSS:
Malva still expanded the compact one-liners.
A Malva `/* formatter-ignore */` comment as the first thing inside `<style>` does protect it,
because the repository already sets `"ignoreCommentDirective": "formatter-ignore"`.

Pros:
preserves the exact CSS;
keeps dprint formatting the rest of each document.

Cons:
still reflows prose on every edit, which is the larger recurring cost;
adds a directive to every page and to every future page;
the directive is node-scoped, so it needs repeating per top-level rule.

### Issue option 2: exclude from both tools and add a verifier

Pros:
preserves all authored source;
one central exception.

Cons:
drops Stylelint coverage that measurement shows is retainable;
requires a permanent custom verifier that duplicates checks Stylelint already performs;
cannot be a package verifier, because this subtree is not a package.

### Issue option 3: per-file ignores and Stylelint disable comments

Pros:
keeps the exception physically beside the affected source;
leaves global configuration untouched.

Cons:
repeats the policy in every page and every future page;
clutters teaching documents that learners read as source;
suppresses checks instead of expressing an alternate policy;
`reportDescriptionlessDisables` and `reportUnscopedDisables` require justification text on each one.

## Ranking

Recommended boundary > issue option 1 > style-element ignore > issue option 2 > issue option 3.

- The recommended boundary ranks above issue option 1 because it keeps both authored contracts intact
  and still machine-checks the CSS, whereas option 1 trades a measured, recurring authoring cost
  for consistency that changes nothing a reader sees.
- Issue option 1 ranks above the style-element ignore because once dprint owns the surrounding prose,
  a single uniform formatter policy beats a directive repeated in every page for the same prose outcome.
- The style-element ignore ranks above issue option 2 because it keeps markup formatting and full CSS
  linting rather than replacing them with a bespoke verifier.
- Issue option 2 ranks above issue option 3 because one auditable boundary beats a suppression
  duplicated in every file.

## Correction to the issue framing

Issue 401 describes a `package source contract`.
`package/learning/rust/` is not a package:

- it has no `package.json` and no `mise.toml`;
- the pnpm workspace glob is `package/*/*`, which needs a `package.json` to match;
- nothing in the repository references it except `doc/troubleshooting/dprint.md`.

The accurate framing is an authored learning-content contract conflicting with root formatter and linter defaults.
This matters because `add a package verifier` is not actionable as written.

`AGENTS.md` rules `AP1` through `AP3` and `DPL` suggest this subtree does not belong under `package/`.
Relocating it is a separate question and does not resolve issue 401:
HTML under `doc/` is still matched by the dprint `**/*.html` association
and by the Stylelint `**/*.html` override,
so relocation alone changes nothing here.

## Separate defect found while measuring

`package/learning/rust/NOTES.md` requires every page to declare
`<meta name="color-scheme" content="light dark">`
so browser-default link colours follow the active theme.

Only `package/learning/rust/reference/aquascope-decoder.html` declares it.
These four pages do not:

- `package/learning/rust/lessons/index.html`;
- `package/learning/rust/lessons/0001-whats-different-about-this-book.html`;
- `package/learning/rust/reference/index.html`;
- `package/learning/rust/reference/reading-loop.html`.

This is a user-visible contract violation unrelated to formatting,
tracked separately from issue 401.

## Open question for the repository owner

Whether to accept the recommended boundary is the one genuinely non-measurable call:
it trades dprint coverage on five teaching pages for the authored compact CSS and semantic prose breaks.
Everything else here is measured.

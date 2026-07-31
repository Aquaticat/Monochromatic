# Learning Rust formatting boundary investigation

Status:
proposal,
not an accepted decision.

This document investigates
[issue 401](https://github.com/Aquaticat/Monochromatic/issues/401).
It records current-tool behavior,
package constraints,
repository-owned alternatives,
and a ranked resolution.

## Owner constraints

The package-local requirements are narrower than the issue originally assumed.

- CSS should remain around ten lines.
- CSS layout within that approximate budget is not prescribed.
- The CSS may contain no presentation rules beyond the approved foreground and background colors.
- The pages remain complete,
  build-free HTML that works through `file:///`.
- Every page repeats its CSS inline.
  `package/learning/rust/README.md` and `NOTES.md` explicitly reject an extracted stylesheet.
- Exact authored prose wrapping is not required.
- A line break inside a tight grammatical unit is unacceptable.

An unacceptable break is:

```text
I ate
a chicken.
```

A list-like break is acceptable:

```text
I ate a chicken,
a pig,
and a cow.
```

For affected `oklch()` values,
the preferred channel syntax is:

- lightness as `<number>`;
- chroma as `none` when zero,
  or `<number>` otherwise;
- hue as `none` when zero,
  or a numeric `deg` angle otherwise.

The desired achromatic values are therefore:

```css
oklch(0.1 none none)
oklch(0.9 none none)
```

This is package-local policy.
It does not need an `AGENTS.md` rule.
Whether the `oklch()` syntax preference should become repository-wide remains undecided.

## Affected files and current contract gaps

The affected pages are:

- `package/learning/rust/lessons/index.html`
- `package/learning/rust/lessons/0001-whats-different-about-this-book.html`
- `package/learning/rust/reference/index.html`
- `package/learning/rust/reference/reading-loop.html`
- `package/learning/rust/reference/aquascope-decoder.html`

The stylesheet shown in `package/learning/rust/NOTES.md` contains seven nonblank CSS lines.
All five pages contained byte-identical style content when measured at `HEAD` `68eb96063`.
Byte equality is a current-corpus fact,
not a formatting requirement.

`NOTES.md` also requires this element on every page:

```html
<meta name="color-scheme" content="light dark">
```

Only `reference/aquascope-decoder.html` currently contains it.
The other four affected pages violate that separate package contract.
Any golden-source or package-assertion option must correct this before treating the current corpus as valid.

`package/learning/rust/README.md` says the workspace has no build tasks.
A new package generator or checker therefore carries a real local-infrastructure cost.

## Current formatter and linter baseline

### dprint and markup formatting

At `printWidth: 90`,
dprint 0.55.2 with `markup_fmt` 0.23.1 and Malva 0.14.1 introduces prose breaks that split grammatical units.
Examples include splitting `required` from `concepts` and `original` from `variable`.

Formatting two prose-heavy pages in the first disposable probe produced:

- 200 insertions;
- 153 deletions.

The old shared dprint and Stylelint fixed point expanded the seven-line stylesheet to 20 lines.
The particular layout was not independently wrong,
but 20 lines missed the package's approximate ten-line budget.

A repository-wide dprint inventory at `HEAD` `68eb96063` contained 775 paths:

- 376 JSON;
- 293 TOML;
- 17 YAML;
- 36 CSS;
- 15 HTML;
- 31 XML;
- 7 SVG.

Of those,
724 were JSON,
TOML,
YAML,
XML,
or SVG paths unrelated to issue 401.
The issue does not justify replacing dprint across those domains.

### Stylelint

At the measured revision,
Stylelint discovered 51 CSS or HTML paths.
Root ignores removed 32.
The active surface was 19 files containing 14 actual CSS regions.

The merged recommended,
standard,
and local configuration enabled 82 rules:

- 34 advertised fixes;
- 48 did not.

The repository-wide run reported 185 diagnostics from eight rule names.
The learning pages contributed 40 diagnostics.

The 185-diagnostic baseline was:

- `at-rule-empty-line-before`:
   10;
- `declaration-block-single-line-max-declarations`:
   5;
- `declaration-empty-line-before`:
   5;
- `function-disallowed-list`:
   16;
- `hue-degree-notation`:
   10;
- `lightness-notation`:
   10;
- `property-disallowed-list`:
   62;
- `unit-disallowed-list`:
   67.

All current diagnostics from the first six rule names were not evidence that only those rules matter.
A whole-Stylelint replacement still needs an explicit outcome for every enabled rule.

No workflow under `.github/workflows/` invokes the root dprint or Stylelint tasks.
The conflict currently causes local lint noise and destructive local formatting,
not a CI failure.

## Pinned source findings

### Embedded CSS is always delegated

The pinned `markup_fmt` printer calls `format_style` for every non-empty `<style>` element in
`markup_fmt/src/printer.rs:701-737` at
[commit `2d902a5a1`](https://github.com/g-plane/markup_fmt/commit/2d902a5a1af8d7f07e06f189ae1e3132ea344e74).

The dprint adapter creates a synthetic path such as `index.html#.css` and sends it to the host formatter in
`dprint_plugin/src/lib.rs:54-90` at the same commit.

A markup plugin option cannot disable that delegation by path.
It can,
however,
change both markup and Malva settings by path through dprint's plugin override mechanism.

### dprint supports scoped plugin overrides

dprint 0.55.2 documents plugin `overrides` in `website/src/config.md:284-339` at
[commit `89ff90b3c`](https://github.com/dprint/dprint/commit/89ff90b3cc6f9fa211c82fb5865491c8865ea79a).

Each override names files already routed to the plugin and replaces only the listed plugin settings.
Later matching overrides win.
Overrides do not change discovery or plugin associations.

### Excluded explicit paths have a supported success mode

dprint tests `--allow-no-files` for both `fmt` and `check` in
`crates/dprint/src/commands/formatting.rs:1413-1444` at the same pinned commit.

A disposable worktree excluded the five pages and then ran their explicit paths with that flag.
The command exited 0.
The earlier exit-14 caveat is therefore not a blocker.

### The correct node-ignore directive is tool-specific

The pinned `markup_fmt` schema defines:

- `ignoreCommentDirective`:
  `markup-fmt-ignore`;
- `ignoreFileCommentDirective`:
  `dprint-ignore-file`.

`<!-- dprint-ignore -->` before a style element was the wrong node directive.
`<!-- markup-fmt-ignore -->` does skip the next node.

Probes before `<body>` and `<main>` preserved the subtree.
The raw subtree retained its old indentation while its parent was reformatted,
which produced inconsistent nesting indentation.
The mechanism works,
but root exclusion or file ignore is cleaner for these pages.

## Configuration probes reopened by the clarified contract

### A scoped Malva threshold meets the line budget

This dprint override matched the synthetic embedded-CSS path:

```json
{
  "malva": {
    "overrides": {
      "files": "package/learning/rust/**/*.html#.css",
      "singleLineBlockThreshold": 2
    }
  }
}
```

All five embedded styles formatted to seven nonblank CSS lines.
The output retained:

```css
--dark: oklch(0.1 none none);
--light: oklch(0.9 none none);
```

A second dprint run was byte-identical.
The old 20-line result is not an unavoidable dprint result.

### Markup width trades grammatical breaks for long lines

A probe compared new line-break contexts inside HTML text nodes after formatting all five pages.
The metric screens for changes;
it does not understand grammar by itself.
Every context still needs human classification.

Measured results were:

- width 160:
   94 new contexts;
- width 240:
   30;
- width 320:
   11;
- width 500:
   3;
- width 600:
   0.

Width 600 avoids new grammatical splits by joining paragraphs.
It also produced:

- 1,441 insertions;
- 1,684 deletions;
- 225 lines over 120 characters in `aquascope-decoder.html`;
- 61 lines over 200 characters in that file;
- a 593-character maximum line.

Zero new break contexts is therefore not a clean source-readability win.
It exchanges bad breaks for long lines and broad churn.

`whitespaceSensitivity: 'strict'` did not preserve authored wrapping.
It produced:

- 357 new contexts at width 90;
- 100 at width 160;
- 49 at width 200.

### A selective formatter boundary is possible

At width 160,
every new break context occurred in only these two prose-heavy pages:

- `lessons/0001-whats-different-about-this-book.html`
- `reference/aquascope-decoder.html`

The other three pages produced no new intra-text break contexts.

A verified selective configuration:

- excluded those two files;
- formatted the other three at markup width 160;
- used `singleLineBlockThreshold: 2` for synthetic embedded CSS;
- applied the preferred `oklch()` values to all five pages.

The result had:

- zero new intra-text break contexts;
- 90 insertions;
- 84 deletions;
- seven nonblank CSS lines in every page;
- byte-identical Stylelint fix and second dprint runs.

This retains more formatter coverage than an all-five boundary.
It also creates an exact-path exception list and leaves future teaching pages needing classification.

## Stylelint policy probes

### The current media-unit configuration has a live defect

`package/config/stylelint/index.mjs` intends to require `rem` for every media-feature name.
It uses the plain string `'/[\w-]+/'` as a regex-shaped map key.
JavaScript passes `/[w-]+/` to Stylelint because the plain string consumes the backslash.

A runtime probe accepted `height: 10em` and rejected `width: 10em`.
`width` happens to contain `w`;
`height` does not.
This is a downstream configuration defect,
not a Stylelint defect.

The finding shows that keeping Stylelint does not automatically preserve intended policy coverage.
It also argues against regex-shaped strings for structural CSS relations.

### A scoped profile reaches a fixed point

A path-scoped equivalent of these settings passed the preferred seven-line CSS in all five pages:

```js
{
  'at-rule-empty-line-before': 'never',
  'declaration-block-single-line-max-declarations': 2,
  'declaration-empty-line-before': 'never',
  'lightness-notation': 'number',
  'unit-allowed-list': ['deg'],
  'unit-disallowed-list': null,
}
```

The existing `hue-degree-notation: 'angle'` rule remained active.

The profile:

- rejected percentage lightness;
- rejected `turn` and pixel units;
- rejected a bare nonzero hue;
- accepted a nonzero degree hue;
- left all five desired pages unchanged in fix mode;
- remained unchanged after the next dprint run.

The full sequence was tested after applying the preferred `oklch()` values.

### Generic Stylelint rules cannot express the full channel policy

`oklch(0.1 0 none)` passes the tested profile.
No enabled generic rule requires zero chroma to be written as `none`.

A bare zero hue is diagnosed,
but Stylelint suggests `0deg` rather than the preferred `none`.

Strict machine enforcement therefore requires one of:

- a narrow repository-owned Stylelint rule;
- a package-local semantic assertion;
- a broader source-policy checker;
- or deliberate human review.

The issue can still be resolved without adding that enforcement.
The user stated a preference,
not a requirement that every preference gain a linter immediately.

### Global Stylelint changes have wider effects

Applying the package's compact values globally was not viable.
Setting the three layout rules to `never` increased repository diagnostics from 185 to 909.
`declaration-empty-line-before` alone produced 735 diagnostics.

Disabling the three layout rules globally and switching lightness to numbers reduced diagnostics to 162.
That removes useful future layout enforcement everywhere.
It also introduces seven numeric-lightness migrations outside the learning pages.
A scoped profile is the narrower response.

## Repository-owned tooling evidence

### Existing CSS and HTML parsers are sufficient for narrow checks

`package/module/css-edit/` is an immutable,
byte-preserving CSS CST over `@csstools/css-tokenizer`.
It follows the repository's `jsonc-edit` and `toml-edit` precedents.

At `HEAD` `68eb96063`:

- the nested learning stylesheet parsed;
- declarations and media blocks remained distinct nodes;
- tokens retained source offsets;
- serialization was byte-identical;
- all 14 active CSS regions parsed and round-tripped byte-identically.

The existing `@lezer/html` dependency exposed embedded CSS as exact `StyleText` ranges.
It ignored false style text inside an HTML comment and quoted attribute.
It reported no parse-error nodes in the five current pages.
Adversarial probes produced errors for a mismatched inline closing tag,
an unterminated attribute,
and an unterminated comment.

These parsers can support a narrow package assertion or source-preserving fixer.
They do not justify a full replacement by themselves.

### Measured audit surfaces

`module-css-edit` contains 10 production TypeScript files and 1,728 source lines.
Installed Stylelint production `lib/` contains 357 modules and 34,348 source lines.
Stylelint 17.14.1 declares 35 direct runtime dependencies.

These measurements describe audit surface.
They do not prove semantic parity,
maintenance cost,
or a reason to replace Stylelint.

## Horizontal option analysis

### Markup ownership options

#### All-five authored-document boundary

Exclude `package/learning/rust/**/*.html` from dprint.
Use `--allow-no-files` when a scoped invocation may contain only excluded paths.
Continue linting embedded CSS through Stylelint.

Pros:
uses one package boundary;
preserves all current and future teaching prose;
avoids formatter churn and long lines;
keeps dprint on 760 other measured paths;
needs no in-file directive;
fits the workspace's build-free authored-source model.

Cons:
removes dprint markup formatting from three current pages that can be formatted safely at width 160;
does not validate full HTML structure by itself;
leaves source layout to authors.

#### Selective two-file boundary

Exclude only the two measured prose-heavy pages.
Use markup width 160 and the scoped Malva threshold for the other three.

Pros:
retains dprint markup formatting on three pages;
produced no new intra-text break contexts;
kept every style at seven nonblank lines;
reached a verified dprint and Stylelint fixed point.

Cons:
encodes current-corpus knowledge as two exact paths;
future lessons need manual classification;
adds both markup and synthetic-CSS override configuration;
produces more initial churn than the package boundary.

#### Width-600 formatting for all five

Format all pages with markup width 600 and the scoped Malva threshold.

Pros:
keeps dprint coverage on every page;
introduces no new text-node break context;
reaches the CSS line budget.

Cons:
produces lines up to 593 characters;
produces broad one-time churn;
joins most prose wrapping;
uses an extreme width to avoid a semantic problem the formatter cannot model.

#### File-ignore directives

Place `<!-- dprint-ignore-file -->` in every affected file.

Pros:
works with the pinned plugin;
is visible beside the source;
needs no root exclusion.

Cons:
repeats one directive in every page;
future pages can omit it;
expresses one package policy as local tool syntax;
still gives up all markup formatting.

#### Node-ignore directives

Use `<!-- markup-fmt-ignore -->` before selected subtrees.

Pros:
keeps formatting outside the ignored node;
uses the directive the plugin actually supports.

Cons:
produced inconsistent parent and raw-subtree indentation;
requires repeated placement;
large content nodes make the remaining formatter value small.

#### Source-preserving region formatter

Exclude the pages from general markup formatting.
Use `@lezer/html` to extract style ranges,
then delegate only those ranges to a CSS formatter or repository-owned fixer.

Pros:
never touches prose;
can keep Malva or use `css-edit` fixes;
can map diagnostics to host HTML positions.

Cons:
adds orchestration and editor integration;
solves a seven-line CSS region already handled by Stylelint and authors;
needs fixed-point and failure-path tests.

#### Repository-owned dprint plugin

Write a dprint-compatible plugin for these pages or their synthetic CSS paths.

Pros:
retains dprint discovery and editor integration;
can preserve text while owning only package semantics.

Cons:
adds plugin packaging and maintenance;
requires a policy for prose breaking that a CSS-only plugin cannot solve;
is more machinery than current evidence demands.

#### Full repository-owned HTML formatter

Pros:
complete local control.

Cons:
requires a grammatical line-breaking policy;
duplicates general formatter responsibilities;
has no evidence-backed advantage over leaving authored prose unformatted.

### Markup ranking

All-five boundary > selective two-file boundary > width-600 formatting > file-ignore directives
> source-preserving region formatter > node-ignore directives > repository-owned dprint plugin
> full repository-owned HTML formatter.

- The all-five boundary ranks above selective exclusion because one durable package rule is simpler than exact-path
  classification,
  and formatting three short pages adds less value than future-proof prose safety.
- Selective exclusion ranks above width 600 because it retains measured-safe coverage without 593-character lines.
- Width 600 ranks above file directives because one root policy avoids repeated comments while retaining all formatter
  coverage.
- File directives rank above a region formatter because they solve the boundary without new code.
- A region formatter ranks above node directives because it preserves indentation and expresses the actual CSS seam.
- Node directives rank above a custom dprint plugin because they already exist and work despite poor indentation.
- A narrow dprint plugin ranks above a full HTML formatter because it reuses discovery and limits ownership.

## Vertical CSS policy options

### Scoped Stylelint profile with authored preferred values

Keep Stylelint.
Apply the tested profile only to `package/learning/rust/**/*.html`.
Update current colors to `none` zero channels.
Accept human review for the zero-chroma condition Stylelint cannot express.

Pros:
uses current editor and CLI integration;
retains all other Stylelint rules;
reaches a tested fixed point;
adds configuration but no new runtime code.

Cons:
does not enforce zero chroma as `none`;
keeps the existing media-feature regex-string defect until separately fixed;
a bare zero hue receives the wrong suggested fix.

### Scoped Stylelint plus one narrow channel rule

Add a repository-owned rule that parses `oklch()` channels structurally.
Keep Stylelint for every other rule.

Pros:
closes the measured semantic gap;
keeps one diagnostic system and editor integration;
avoids porting 82 rules.

Cons:
introduces a custom Stylelint plugin and value parser dependency or tokenizer logic;
needs tests for absolute,
relative,
alpha,
calculated,
and malformed color syntax;
may be excessive for two current color declarations.

### Package-local source assertion

Check HTML parse errors,
style-region count,
approved declarations,
line budget,
required meta,
and `oklch()` channels without rewriting source.

Pros:
can encode the whole package contract;
uses already verified parsers;
keeps policy independent of formatter defaults.

Cons:
requires defining a numeric meaning for “around ten”;
introduces check infrastructure into a workspace documented as having no build tasks;
duplicates some Stylelint syntax coverage;
needs an execution path before it protects anything.

### Generated or synchronized style regions

Keep one authoritative style source and patch only the five inline regions.
Commit standalone HTML output.

Pros:
prevents drift across byte-identical regions;
preserves prose;
keeps reader-time use build-free.

Cons:
adds author-time generation;
conflicts with the workspace's current no-build-task model;
turns flexible formatting into generated output unless the generator preserves local layout;
needs safe region ownership and failure recovery.

### `light-dark()` source simplification

Replace nested media rules with `light-dark()` colors and ensure every page declares a used color scheme.

Firefox shipped the function in version 120 according to
[Mozilla bug 1856999](https://bugzilla.mozilla.org/show_bug.cgi?id=1856999).
Chromium's intent records desktop and Android milestone 123 in
[the Blink shipping thread](https://groups.google.com/a/chromium.org/g/blink-dev/c/IsXAWrFLUHE).
WebKit landed its implementation in
[commit `9240183`](https://github.com/WebKit/WebKit/commit/9240183bbeb26b30cfaa51cd0f5739eb1429731f).

Pros:
can remove media-query duplication;
fits the line budget;
has shipping implementations in the major engines.

Cons:
reverses the repository's explicit `function-disallowed-list` ban on `light-dark`;
changes source semantics rather than only resolving tool ownership;
still does not solve markup prose reflow;
uses a CSS Color Level 5 feature whose current W3C document is a Working Draft.

### Global Stylelint policy change

Pros:
can separate semantic lint from layout across the repository;
removing global layout rules reduced measured diagnostics.

Cons:
changes policy for every stylesheet;
`never` values produced 909 diagnostics;
disabling rules loses future enforcement outside this package;
issue 401 supplies no repository-wide need.

### Full Stylelint replacement

Build a semantic checker over `css-edit` and `@lezer/html`.

Pros:
can express typed policy directly;
can preserve host source and exact offsets;
removes regex-string configuration hazards.

Cons:
requires decisions for 82 current rules;
adds discovery,
diagnostics,
editor integration,
and maintenance;
the current corpus proves parsing feasibility,
not parity.

### CSS policy ranking

Scoped Stylelint profile > scoped profile plus one narrow rule > package-local assertion
> generated style regions > `light-dark()` simplification > global Stylelint change
> full Stylelint replacement.

- The scoped profile ranks above a custom rule because it resolves the current conflict with no new runtime code;
  the remaining `none` condition can remain a reviewed preference.
- One narrow rule ranks above a package assertion when strict channel enforcement is wanted because it reuses the
  existing diagnostic and editor path.
- A package assertion ranks above generation because checking source is less invasive than owning source production.
- Generation ranks above `light-dark()` because it preserves the accepted media-query semantics.
- `light-dark()` ranks above a global lint change because its impact is confined to this package.
- A global lint change ranks above replacing Stylelint because it retains the incumbent's semantic rule surface.

## Other rejected or deferred families

### External stylesheet

A relative stylesheet can be tested under `file:///`,
but the package contract explicitly says to repeat the CSS inline and not extract a stylesheet.
This is not a live option unless the owner revises that contract.

### Post-format contract restorer

A CSS restorer could compact style regions after dprint.
It cannot reconstruct acceptable prose breaks after markup formatting has discarded them unless it owns another
canonical prose source.
It therefore does not resolve the whole issue by itself.

### Separate authored and generated HTML

Keeping authored teaching source and committed generated reader output preserves reader-time `file:///` use.
It also creates two source layers and a generation workflow in a workspace documented as build-free.
No current measurement justifies that complexity.

### Upstream feature work

`markup_fmt` could add a text-wrap-preservation mode or a style-formatter disable option.
No upstream defect is established,
and an upstream feature would not decide this repository's package policy or Stylelint rules.
It is lower priority than available local mechanisms.

### Status quo

Leaving the issue open avoids migration work.
It retains destructive local formatting,
40 learning-page Stylelint diagnostics,
the current `oklch()` mismatch,
and four missing color-scheme meta elements.
It is a temporary pause,
not a resolution.

## Recommended resolution

Use the all-five authored-document boundary and the scoped Stylelint profile.
Do not replace dprint or Stylelint for issue 401.
Do not add package policy to `AGENTS.md`.

The implementation sequence,
if the owner accepts it,
is:

1. Change the two achromatic values in all five pages and `NOTES.md` to `none` zero channels.
2. Add the missing color-scheme meta element to the other four pages.
3. Exclude `package/learning/rust/**/*.html` in root `dprint.json`.
4. Ensure explicit scoped dprint checks pass `--allow-no-files`.
5. Add the tested path-scoped Stylelint rules in root `stylelint.config.mjs`.
6. Keep dprint for every unrelated format and Stylelint rule.
7. Add no custom checker yet.
8. Revisit one narrow `oklch()` rule only if machine enforcement of the channel preference is wanted.

This ranks above the selective boundary because the package is an authored,
future-growing teaching workspace.
The one package glob is easier to maintain than deciding whether each future lesson is prose-heavy enough for
`markup_fmt`.

## Verification required after implementation

Run on a disposable fixture before applying to real files,
then verify the committed boundary:

- dprint check of the five paths with `--allow-no-files` exits 0;
- dprint still discovers every other intended HTML and data path;
- Stylelint check of all five pages exits 0;
- Stylelint fix leaves all five byte-identical;
- a second dprint and Stylelint sequence remains byte-identical;
- every style region stays around ten nonblank lines;
- percentage lightness,
  `turn` hue,
  pixel hue,
  a third same-line declaration,
  and unwanted blank-line layouts are rejected;
- all five pages contain the color-scheme meta;
- light and dark browser modes compute the approved foreground and background colors;
- every relative link still works through `file:///`.

A strict package assertion additionally needs an owner-selected numeric line range.
Do not invent that range from the phrase `around ten`.

## Open decisions

The evidence leaves these owner choices:

- accept the recommended all-five package boundary,
  or retain more dprint coverage with the verified selective two-file boundary;
- leave zero-channel notation as reviewed source preference,
  or add one narrow machine rule;
- keep the affected `oklch()` preference package-scoped,
  or evaluate it separately as repository-wide CSS policy.

These are preference and scope decisions.
The formatter behavior,
configuration capabilities,
corpus effects,
and parser feasibility are measured.

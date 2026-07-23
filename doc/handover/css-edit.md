# css-edit: replace postcss in build-tool-css with an in-house CST over `@csstools/css-tokenizer`

Status: in progress.
This document is the durable record for the migration;
update it after each landmark (decision, commit, verification result).

## Task

User request: migrate `package/build-tool/css` off postcss.
Original phrasing named css-tree as the target;
a grilling session (2026-07-22) replaced that target after empirical probes.

## Requirements (confirmed with user)

- Cure four named postcss pains:
  unguarded `process.env` reach-in (forces `process-shim.ts`),
  stringly-typed at-rule params,
  mutable OO AST feel,
  and dependency hygiene.
- Preserve current `@mixin`/`@apply` semantics and monorepo-aware `@import` inlining.
- Keep the pipeline pure JS and browser-compatible
  (`applyMixins()` runs in-browser in `package/webapp-productivity/done-postcss/src/client/css.ts`).
- Full sibling rigor: `css-edit.fuzz`, `css-edit.bench`, and `css-edit.conformance` packages,
  mirroring the `jsonc-edit` family.

## Decision: hybrid CST layer, not an off-the-shelf parser

New package `package/module/css-edit` (`@monochromatic-dev/module-css-edit`)
implements the stylesheet-structure layer (CSS Syntax section 5 consume-block-contents)
over `@csstools/css-tokenizer` (4.0.0, zero deps, TS-native, MIT, csstools team).
`build-tool-css` then consumes css-edit and drops postcss.

## Candidate survey evidence (probes run 2026-07-22, scratch dir `~/temp/agent/css-tree-probe-2026-07-22`)

All candidates were probed with the same corpus:
comment, `@mixin` body containing declarations plus relaxed nesting plus `&` nesting plus `@apply`,
`@media` range syntax, braces and semicolons inside strings and `url()`,
escaped selectors, custom-property block values.

- `css-tree` 3.2.1 (original migration target): rejected.
  Corrupts relaxed nesting (nested `button:disabled {}` without `&` becomes Raw plus parse error);
  this syntax exists today in `package/webapp-productivity/done-postcss/src/client/mixins.css`
  (`@mixin --shadow-dom-globals`).
  Unknown at-rule blocks parse in rule-list mode, mangling `@mixin` bodies,
  fixable only via `fork()` with a custom `atrule` parser config (verified working).
  Drops all comments (its `Block.js` skips comment tokens), generate() is minified-only,
  and `@types/css-tree` (2.3.11) lags css-tree by a major version.
- `@adobe/css-tools` 4.5.0: runner-up.
  Passed the full corpus including relaxed nesting and comment preservation;
  zero deps, TS-native types, no `process` references.
  Rejected because custom-property block values (`--raw: { nested: token };`) throw,
  its scanner is regex-era (two patched ReDoS CVEs in 2023),
  and string preludes keep the stringly-params pain.
- `@projectwallace/css-parser` 0.18.1: disqualified.
  Arena-based analyzer with no generate/stringify export; cannot emit CSS.
- `@stacksjs/ts-css` 0.1.1: disqualified.
  Silently deleted a nested rule from a `@mixin` body and ejected `@apply` to top level;
  week-old 0.x, Bun-first (conflicts with cross-runtime rule XRT).
- `@csstools/css-parser-algorithms` 4.0.0: component-value level only,
  no stylesheet or rule parser; not usable alone, informs the hybrid design.
- `@csstools/css-tokenizer` 4.0.0: chosen foundation.
  Byte-perfect lossless round-trip on the full corpus including every adversarial case,
  zero parse errors, comments preserved as tokens, `stringify` re-emits tokens exactly.
- Keeping postcss: viable null option, cures none of the four pains.
  postcss remains in the repo regardless (stylelint config plus catalog override in
  `pnpm-workspace.yaml`), so this migration only removes it from `build-tool-css`.

## Design decisions

- API follows the `jsonc-edit` family convention (verified in
  `package/module/jsonc-edit/src/edit-state.ts`):
  immutable state handle, every edit returns fresh state, structural sharing,
  `kind`-discriminated readonly plain-object nodes.
- Node kinds: stylesheet, at-rule (name, prelude token slice, optional block),
  rule (prelude token slice, block), raw declaration runs;
  whitespace and comments preserved in place as token slices.
  No selector or value parsing: preludes and declaration values stay token arrays.
- Strict parsing: positioned custom error on tokenizer parse errors.
- Stringify is token re-emission: byte-identical output for untouched regions.
- `build-tool-css` mixin redesign: the fixed-point ten-pass loop with string comparison
  in `mixin-registry.ts` is replaced by visited-set recursive expansion;
  circular references report the exact cycle.
  The module-level mutable `mixins` Map becomes a registry value threaded through functions.
  Public API changes are fine (unpublished package, design change per HON).
- `process-shim.ts` is deleted along with its `sideEffects` entry and export
  (existed solely for postcss; verify no importer remains, including `package-paused/`).
- Output behavior change: author formatting and comments survive byte-exactly outside
  spliced regions; spliced mixin bodies keep definition-site indentation.

## Rejected ideas

- Pure in-house tokenizer: re-implements what csstools maintains; only buys zero deps.
- css-tree plus authoring convention (`&`-only nesting): pays fork config,
  comment loss, minified output, and stale types to cure two pains.

## Open questions

- None blocking. Deferred: none (conformance sibling was added back by user).
- Conformance data source: tabatkins css-parsing-tests (used by tinycss2).

## Plan and progress

1. [x] Grilling session: target, placement, API model, rigor, sequencing confirmed.
2. [x] This handover doc.
3. [ ] Add `@csstools/css-tokenizer` to pnpm catalog.
4. [ ] Scaffold `package/module/css-edit` (mirror `jsonc-edit` scaffolding).
5. [ ] Implement tokenize-wrapper, structure parser, stringify, walk/edit helpers.
6. [ ] Unit tests per branch plus adversarial corpus; all green.
7. [ ] Port `build-tool-css` (import inlining, mixin redesign, applyMixins, shim removal).
8. [ ] Integration fixtures green (both resolution strategies), CLI verified (VB2).
9. [ ] Browser verification: done-postcss via agent-browser, then `agent-browser close` (VB5, ABR).
10. [ ] `css-edit.fuzz` sibling: byte-identity fuzz plus differential vs postcss oracle.
11. [ ] `css-edit.bench` sibling: parse plus stringify vs postcss and css-tree baselines.
12. [ ] `css-edit.conformance` sibling: css-parsing-tests corpus.
13. [ ] Docs: `doc/troubleshooting/css-tooling.md` dated survey section, both READMEs.
14. [ ] Clean probe scratch dir.

## Commits

(record as they land)

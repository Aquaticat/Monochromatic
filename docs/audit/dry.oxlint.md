# DRY audit: oxlint plugins

Generated 2026-06-30 from a focused sweep of the three oxlint plugin packages
under `packages/oxlint-plugins/`:

- `no-restricted-syntax` (`@monochromatic-dev/config-oxlint-no-restricted-syntax`)
- `stylistic` (`@monochromatic-dev/config-oxlint-stylistic`)
- `tsdoc` (`@monochromatic-dev/config-oxlint-tsdoc`)

This is a deep dive scoped to these three packages, complementing the repo-wide
[`dry.md`](dry.md). It covers source only (`src/**`, excluding `dist/`, `node_modules/`).
Every finding below was checked against the cited line ranges; counts come from `rg`,
not estimation. Findings are ordered by severity. Each is tagged with the package or
packages it touches, the would-be factory parameters (what actually differs between
copies), and an honest estimate of lines saved.

## Scope and method

Four independent investigations ran in parallel, one per package plus one for
cross-package duplication, then key claims were re-verified directly against source:

- Whether each apparent family of files truly shares logic or only shares shape.
- Whether a shared helper already exists and is bypassed, versus genuinely missing.
- Whether factoring would improve or harm clarity (coincidental similarity is called out
  separately under "Justified similarity").

The deliverable is this audit. No refactors were applied.

## Already factored (do not redo)

These are correctly DRY today. Listed so a future session does not propose redundant work.

- `banDisableRule` (`packages/oxlint-plugins/no-restricted-syntax/src/rules/_ban-disable-factory.ts`)
  is used by all `no-disable-*.ts` rules. Every consumer is pure config
  (`ruleId`, `description`, `message`); there are no hand-rolled outliers.
- `methodCallBanRule` (`packages/oxlint-plugins/no-restricted-syntax/src/rules/_method-call-ban-rule.ts`)
  backs `no-promise-catch.ts`, `no-promise-finally.ts`, `no-hasownproperty.ts`.
- The symbol-sentinel no-match convention (`NO_STATIC_SOURCE`, `NOT_ERROR_DETECTION`, and peers,
  guarded by `typeof x === 'symbol'`) recurs widely but is a mandated policy, not extractable
  duplication.
- `no-sync.syntax.ts` is the shared AST hub for the `no-sync.*` family and is cross-imported by
  `prefer-error-is-error.syntax.ts` and `no-immediate-mutation.syntax.ts` for `findVariable`.
  The `no-sync.*` and `no-low-information-symbol-description/*` file splits are single algorithms
  divided for the max-lines budget, not duplication.
- In tsdoc, `createTsdocVisitor` / `createFunctionTsdocVisitor` (`rules/tsdoc-visitors.ts`),
  `findTsdocComment` / `parseTsdocForNode` (`tsdoc-comments.ts`), `splitDocComment`
  (`tsdoc-blocks.ts`), the `tsdoc-doc-model.ts` flags, and `ast-access.ts` narrowers absorb most
  of the comment-discovery and parse boilerplate. Rules consume precomputed flags rather than
  re-scanning.
- Build and tool config is already DRY: `tsdown.node.config.ts` is the identical one-line
  re-export of `@monochromatic-dev/config-tsdown/.node.ts` in all three; `tsconfig.json` and
  `mise.toml` inherit shared bases. The per-package `package.json` differences are intrinsic.

## High severity

### H1. Test-harness scaffolding reimplemented in all three test files

Packages: all three.

Files:

- `packages/oxlint-plugins/no-restricted-syntax/src/oxlint-no-restricted-syntax.unit.test.ts:22-198`
- `packages/oxlint-plugins/stylistic/src/oxlint-stylistic.unit.test.ts:28-209`
- `packages/oxlint-plugins/tsdoc/src/oxlint-tsdoc.unit.test.ts:26-198`

Each test file independently redefines the same oxlint runner. Verified duplicates:

- `OxlintDiagnostic` / `OxlintOutput` types, identical modulo blank lines (stylistic only differs
  by making `code` optional).
- `TempFixtureFile` / `TempFixtureFileOptions` types, byte-identical between stylistic and tsdoc.
- `createTempFixtureFile`, identical between stylistic and tsdoc except the `mkdtemp` prefix string.
- The capture-stdout-from-thrown-error body, including this verbatim line in all three:

```ts
// all three *.unit.test.ts files (no-restricted:109, stylistic:155, tsdoc:150)
return (error as { stdout: string; }).stdout;
```

What differs (would-be parameters): the plugin-code prefix filter
(`'no-restricted-syntax('` / `'stylistic('` / `'tsdoc('`), the `mkdtemp` prefix, the oxlint config
flag (`-c` versus `--config`), and `ROOT` resolution.

Latent inconsistency worth fixing while consolidating: `ROOT` has already drifted.
tsdoc resolves it via `findMiseMonorepoRoot` while the other two hardcode a relative climb:

```ts
// tsdoc/src/oxlint-tsdoc.unit.test.ts:64
const ROOT = await findMiseMonorepoRoot({ cwd: import.meta.dirname, },);

// no-restricted-syntax/src/...unit.test.ts:45 and stylistic/src/...unit.test.ts:74
const ROOT = resolve(import.meta.dirname, '..', '..', /* ... */);
```

`uniqueRules` has likewise drifted (`map().toSorted()` versus `flatMap().sort()`).

Suggestion: a dev-only test kit (for example `@monochromatic-dev/oxlint-plugin-test-kit`),
exporting the diagnostic types, `createTempFixtureFile({ prefix })`,
`runOxlint({ pluginPrefix, configPath, target })`, `uniqueRules`, and one `ROOT` resolver.
It must stay a `devDependency` only so it never enters the three plugins' published runtime graph.
This is the cleanest win and has no independent-publishing tension.

Estimated savings: on the order of 250 lines net, plus elimination of the `ROOT` and
`uniqueRules` drift.

### H2. `param-fix.ts` is a near-verbatim fork of `needs-fix.ts` plus `item-per-line-fix.ts`

Package: stylistic.

Files:

- `packages/oxlint-plugins/stylistic/src/utility/param-fix.ts:46-118` (`paramsNeedFix`)
  versus `utility/needs-fix.ts:38-114` (`needsPerLineFix`)
- `packages/oxlint-plugins/stylistic/src/utility/param-fix.ts:160-244` (`buildParamFix`)
  versus `utility/item-per-line-fix.ts:107-256` (`buildPerLineFix`)

`paramsNeedFix` and `needsPerLineFix` are the same three-part check (first item shares the
opening-delimiter line; last item shares the closing-delimiter line; adjacent items share a line).
The adjacent-pair loop is byte-identical except the variable name:

```ts
// needs-fix.ts:85 and param-fix.ts:89 (only `items` vs `params` differs)
for (let loopIndex = 1; loopIndex < items.length; loopIndex++) {
  const prevRange = rangeOf(at({ arr: items, index: loopIndex - 1, },),);
  const currRange = rangeOf(at({ arr: items, index: loopIndex, },),);
  if (lineAt({ sourceText, offset: prevRange[1], },)
    === lineAt({ sourceText, offset: currRange[0], },)) return true;
}
```

`buildParamFix` and `buildPerLineFix` are the same fixer pipeline (compute base indent;
`childIndent = baseIndent + '  '`; map items to trimmed text; detect trailing delimiter; render
one per line; `replaceTextRange`).

What differs (would-be parameters): boundary source (container `Span` versus explicit
`openParen` / `closeParen` offsets), the bracket pair (`(` / `)` hardcoded in the param copy),
the delimiter, whether each item's trailing delimiter is stripped, and the indent helper. The only
true blocker today is that `needsPerLineFix` reads `rangeOf(container)`; the fix builder already
locates brackets by scanning from item positions, so it does not actually depend on the container
span.

Suggestion: let `needsPerLineFix` and `buildPerLineFix` accept the boundary as either a container
`Span` or an explicit `[openOffset, closeOffset]`, plus an `open`/`close` char pair and a
`stripItemDelimiter` flag. `param-fix.ts` then collapses to a thin adapter or disappears.

Estimated savings: 150 to 180 lines (param-fix is 244 lines, roughly 180 of them re-expressed).

### H3. `paramPerLine` re-hand-rolls the scaffolding `checkItemsPerLine` exists to remove

Package: stylistic.

Files:

- `packages/oxlint-plugins/stylistic/src/rules/param-per-line.ts:101-176`
- versus `utility/item-per-line.ts:95-136` (`checkItemsPerLine`)

Every other per-line rule is roughly eight lines of delegation. `paramPerLine` instead inlines the
open/close scan, the needs-check, and the report-plus-fix wiring. That scan duplicates the one
inside `buildPerLineFix`, and the report wrapper duplicates `checkItemsPerLine`. The rule's own
docstring justifies the divergence on the grounds that `checkItemsPerLine` "expects a container
node with delimiters", but its fix path scans rather than using the container span, so the
justification only holds for the needs-check boundary, which H2 already lifts.

What differs (would-be parameters): the function-like visitor keys, a bracket pair of `(` / `)`,
and the `params` field. Resolve H2 and `paramPerLine` becomes a normal delegating rule.

Estimated savings: roughly 120 of its 178 lines. Treat H2 and H3 as one refactor.

### H4. `@word`-run scanning reimplemented across tsdoc rules

Package: tsdoc.

`comment-text.ts` already exposes the canonical linear scanners `wordRunEnd` (`:237-256`),
`tokenEnd` (`:273-292`), `leadingTag` (`:320-340`), and `collectTags` (`:359-393`). Three rule
files re-implement the same word-run and whitespace-run cursors as private inner functions:

- `packages/oxlint-plugins/tsdoc/src/rules/structural-tags.ts:65-95` (`extractLeadingTag` plus inner `scan`)
- `packages/oxlint-plugins/tsdoc/src/rules/empty-tags.ts:96-159` (`parseTaggedLine` plus `scanTag` / `scanWhitespace`)
- `packages/oxlint-plugins/tsdoc/src/rules/type-annotations.ts:68-164` (`findTypeAnnotations` plus `scanTag` / `scanWs`)

The inner word-run cursor is identical across all three and to `wordRunEnd`:

```ts
// empty-tags.ts:106, mirrored by structural-tags.ts:75 (scan) and type-annotations.ts:76 (scanTag)
function scanTag(idx: number,): number {
  let cursor = idx;
  while ((cursor < s.length) && isWordChar(s.charAt(cursor,),)) cursor += 1;
  return cursor;
}
```

What differs: only the outer capture intent (leading tag only; `@tag <rest>` split; `@tag {Type}`
extraction). The scanning primitives underneath are the same.

Suggestion: import `wordRunEnd` / `tokenEnd` (and reuse `leadingTag` where line-start suffices)
from `comment-text.ts`, deleting the inner `scan*` helpers. The outer functions stay as thin
wrappers.

Estimated savings: roughly 40 lines, plus collapse of the corresponding per-rule scan tests onto
the shared `comment-text` test surface.

## Medium severity

### M1. Leaf char predicates `isWhitespaceChar` and `isWordChar` copied verbatim

Packages: tsdoc and stylistic (the same family spans both, so this is cross-cutting).

`isWhitespaceChar` (identical seven-line body) appears in five places, one already exported:

- `packages/oxlint-plugins/tsdoc/src/comment-text.ts:80` (exported)
- `packages/oxlint-plugins/tsdoc/src/rules/empty-tags.ts:56`
- `packages/oxlint-plugins/tsdoc/src/rules/type-annotations.ts:41`
- `packages/oxlint-plugins/tsdoc/src/rules/tag-validation.ts:25`
- `packages/oxlint-plugins/stylistic/src/utility/indent.ts:9` (private; cross-package copy)

`isWordChar` (identical six-line body) appears in four tsdoc files: `comment-text.ts:60`,
`rules/empty-tags.ts:41`, `rules/structural-tags.ts:42`, `rules/type-annotations.ts:27`.

```ts
// byte-identical across comment-text.ts:80, tag-validation.ts:25, indent.ts:9, and others
function isWhitespaceChar(c: string,): boolean {
  return (c === ' ') || (c === '\t') || (c === '\n')
    || (c === '\r') || (c === '\f') || (c === '\v');
}
```

What differs: nothing.

Suggestion: within tsdoc, export `isWordChar` from `comment-text.ts` (it already exports
`isWhitespaceChar`) and import both in the rule files. For the cross-package copy, these are pure
leaf primitives with no AST coupling, so a shared kit (see "Recommended homes") can host both;
`stylistic/src/utility/indent.ts` then imports rather than redeclaring. Note
`no-restricted-syntax/src/rules/arrow-function-params.ts:50` has a differently shaped predicate
over a fixed array; that one is genuinely different and stays.

Estimated savings: roughly 28 lines for the `isWhitespaceChar` copies, plus 18 for `isWordChar`.

### M2. AST helpers duplicated between `no-sync.syntax.ts` and `prefer-error-is-error.syntax.ts`

Package: no-restricted-syntax.

Three helper pairs share logic and can silently drift. The two files already cross-import, so
unification is low friction.

- `rules/no-sync.syntax.ts:51-83` (`getStaticPropertyName` / `getMemberName`)
  versus `rules/prefer-error-is-error.syntax.ts:82-103` (`getStaticMemberName`)
- `rules/no-sync.syntax.ts:97-113` (`getSingleStringArgument`)
  versus `rules/prefer-error-is-error.syntax.ts:315-338` (`getSingleArgumentText`)
- `rules/no-sync.syntax.ts:207-225` (`getImportDeclaration`)
  versus `rules/prefer-error-is-error.syntax.ts:231-249` (`getImportSource`)

The single-argument extractors share the identical three-guard prologue:

```ts
// no-sync.syntax.ts:100 and prefer-error-is-error.syntax.ts:324 (sentinel + final step differ)
if (call.arguments.length !== 1) return /* sentinel */;
const [argument,] = call.arguments;
if (argument === undefined) return /* sentinel */;
if (argument.type === 'SpreadElement') return /* sentinel */;
// no-sync: return getStaticString({ expression: argument, },);
// prefer-error-is-error: return context.sourceCode.getText(argument,);
```

What differs (would-be parameters): only the no-match sentinel and the final extraction step
(static-string value versus raw source text; whole declaration versus `.source.value`).

Suggestion: have the generic core return `string | undefined` and let each family wrap it to remap
to its own sentinel. Place the shared helpers in `no-sync.syntax.ts` (already the de-facto hub) or,
if that ownership feels wrong, a neutral `rules/_ast-syntax.ts`.

Estimated savings: 45 to 55 lines, and removal of the drift hazard on member-name and
import-resolution logic that must track the oxlint AST.

### M3. Single-syntax ban rules repeat the `meta` plus `createOnce` plus `report` shell

Package: no-restricted-syntax.

The unconditional core trio is structurally identical, differing only in the visitor key:

- `rules/no-enum.ts:24-45` (`TSEnumDeclaration`)
- `rules/no-for-in.ts:28-51` (`ForInStatement`)
- `rules/no-switch.ts:34-57` (`SwitchStatement`)

```ts
// no-switch.ts:47, mirrored by no-enum.ts:35 and no-for-in.ts:41
createOnce(context: Context,): VisitorWithHooks {
  return {
    SwitchStatement(node: ESTree.SwitchStatement,): void {
      context.report({ node, messageId: 'forbidden', },);
    },
  };
},
```

Four guarded variants add one predicate before reporting: `no-try-finally.ts:45-56`
(`node.finalizer !== null`), `catch-binding.ts:48-58` (`node.param === null`),
`no-nullish-union.ts:144-155`, `require-destructured-params.ts:56-72`.

What differs (would-be parameters): the visitor key / node type, `meta.type`, `description`,
`message`, and an optional `shouldReport` predicate.

Suggestion: extract `rules/_single-syntax-ban-factory.ts` exporting
`singleSyntaxBanRule({ nodeType, type, description, message, shouldReport? })`, mirroring the
existing `banDisableRule` / `methodCallBanRule` factories. The multi-visitor rules
(`no-rest-params`, `no-variable-function-expression`) have divergent per-node bodies and should
stay out.

Estimated savings: modest per file (these are already small), 70 to 90 lines of shell across the
trio plus the four guarded variants. The real payoff is uniformity and a single place to update if
the `context.report` shape changes.

### M4. Rule-definition shell repeated across roughly 62 rule sites

Packages: all three.

Every rule is hand-written as the same `CreateOnceRule` shape:
`meta: { type, docs: { description, recommended: true }, messages: {...} }` then
`createOnce(context: Context,): VisitorWithHooks`. Counts: no-restricted 24, stylistic 17,
tsdoc 21.

What differs (would-be parameters): `meta.type`, `docs.description`, the `messages` map, optional
`schema` / `defaultOptions`, and the visitor object. The parameterizable scaffold is the
`CreateOnceRule` wrapper, the `meta` nesting, and the `createOnce` signature. The two existing
factories prove the pattern; a general `defineRule({ meta, messages, createOnce })` would
generalize it.

Honest caveat: per-rule `meta` and visitor genuinely vary, so the net is mostly ergonomic
(one import, fewer type annotations) rather than large line removal. Lower priority than M3, which
removes whole visitor bodies for its subset.

Estimated savings: roughly 150 to 250 structural lines, spread thin.

### M5. Per-line report-location shape repeated across tsdoc rules

Package: tsdoc.

Rules that walk physical comment lines all build the same `loc` inline:

```ts
// e.g. tag-names.ts:146, empty-tags.ts:234, tag-escaping.ts:113, type-annotations.ts:208
loc: { start: { line: comment.loc.start.line + index, column: 0, }, },
```

Occurrences at `rules/tag-names.ts:146-172`, `rules/empty-tags.ts:234-242`,
`rules/tag-escaping.ts:113-120`, `rules/type-annotations.ts:208-215`,
`rules/asterisk-validation.ts:65-73`, `rules/structural.ts:264-273`,
`rules/structural-tags.ts:194-206`.

What differs (would-be parameters): the line offset (`index` versus `index + 1`, because some rules
slice the opener before iterating) and `column` (`0` versus the actual indent).

Suggestion: a sibling to the existing `commentReportLoc` (`rules/tsdoc-visitors.ts:49-71`), for
example `lineReportLoc({ comment, lineOffset, column })`. Centralizing the `+ index` arithmetic
also reduces the off-by-one footgun, which is a live risk since rules disagree on whether they
sliced the opener first.

Estimated savings: roughly 50 lines.

### M6. `createFunctionTsdocVisitor` duplicated in `yields.ts`

Package: tsdoc.

- Shared: `packages/oxlint-plugins/tsdoc/src/rules/tsdoc-visitors.ts:192-237`
- Local copy: `packages/oxlint-plugins/tsdoc/src/rules/yields.ts:25-91`

The `yields.ts` copy is near-identical (same `check`, same unsafe cast, same `before` hook). Its
own comment states the only intended difference: it omits `ArrowFunctionExpression` because arrows
cannot be generators.

What differs (would-be parameter): the registered node-type list.

Suggestion: give the shared `createFunctionTsdocVisitor` an optional `includeArrow` (or `nodeTypes`)
parameter defaulting to current behavior, and delete the local copy. Keep the arrow exclusion as a
parameter; it is a real correctness nicety.

Estimated savings: roughly 55 lines.

### M7. `validTypes` re-declares the full documentable-node visitor map

Package: tsdoc.

`rules/tag-types.ts:66-89` hand-writes the entire node enumeration (`FunctionDeclaration` through
`TSEnumMember`, plus the `Property` get/set guard) that `createTsdocVisitor`
(`rules/tsdoc-visitors.ts:131-154`) already provides verbatim. The only reason it cannot reuse the
existing factory is that `validTypes` needs `parseTsdocForNode` (to read `result.messages`) whereas
`createTsdocVisitor` hands back the raw comment.

Suggestion: add `createTsdocParseVisitor` in `tsdoc-visitors.ts`, the all-node analogue of the
function-only `createFunctionTsdocVisitor`, covering the same node set but invoking
`parseTsdocForNode`. `validTypes` then becomes a handler over `result.messages`.

Estimated savings: roughly 20 lines, and the node map stops being maintained in two places.

### M8. Whitespace-plus-delimiter predicate triplicated, and the separator-insert report loop duplicated

Package: stylistic.

The six-branch ASCII-whitespace test is written three times (the two rule copies add one extra
allowed char each):

- `utility/indent.ts:9-16` (`isWhitespaceChar`, private)
- `rules/one-var-declaration-per-line.ts:35-51` (`isOnlyWhitespaceOrComma`)
- `rules/max-statements-per-line.ts:76-92` (`isOnlyWhitespaceOrSemicolon`)

Separately, both statement-level rules duplicate the "insert separator between same-line nodes,
suppress fix on comment" report loop (`one-var-declaration-per-line.ts:143-210` and
`max-statements-per-line.ts:225-289`), differing only in the separator string, the `data` payload,
the messageId, and the pair-selection gate.

The adjacent-pair line-share loop (`lineAt(prev.end) === lineAt(curr.start)`) now appears in four
places once H2 is counted: `needs-fix.ts:85`, `param-fix.ts:89`,
`one-var-declaration-per-line.ts:143`, `max-statements-per-line.ts:225`.

Suggestion: export `isWhitespaceChar` from `indent.ts` and add `isOnlyFiller(s, extra)`; add
`reportSeparatorBetween({ context, prev, curr, separator, messageId, data?, canFix })` for the
report-plus-conditional-fix block. The bucketing and gating stay per rule.

Estimated savings: roughly 45 to 55 lines.

### M9. `isTsdocBlock` predicate duplicated

Package: tsdoc.

- `tsdoc-comments.ts:48-52` (`isTsdocBlock`)
- `rules/structural.ts:68-72` (`isTsdocBlockComment`)

Byte-identical body (`comment.type === 'Block' && comment.value.startsWith('*')`). Differ by name
only.

Suggestion: export one (push it down to `comment-text.ts` as a leaf predicate alongside
`isFenceLine`) and import in `structural.ts`. Roughly 10 lines.

## Low severity

### L1. Record-narrowing guard reimplemented per package

Packages: all three.

The one-line `typeof === 'object' && !== null` predicate appears under three names with three
target types:

- `tsdoc/src/ast-access.ts:30` (`isRecord`, plus `isRecordArray:51`)
- `stylistic/src/utility/comma-dangle.ts:166` (`isFieldRecord`)
- `no-restricted-syntax/src/rules/no-immediate-mutation.syntax.ts:177` (`isRecord`)

Differs only by the `value is T` target. A shared generic
`isRecord(value): value is Readonly<Record<string, unknown>>` (the `ast-access.ts` version is the
most general) would cover all three, with use-site narrowing where needed. Related: the
untyped-AST-access approaches have diverged (tsdoc casts `node as Span & Record<string, unknown>`;
the other two use the record guard); unifying behind one `ast-access` helper is conceptual cleanup,
not copy-paste removal. Roughly 6 to 10 lines.

### L2. Recursive binding-pattern unwrap duplicated

Package: tsdoc.

- `tsdoc-params.ts:55-94` (`extractBindingName`)
- `tsdoc-destructured.ts:54-140` (inner `collect`)

Both recurse through the same three wrapper node types (`AssignmentPattern`, `RestElement`,
`TSParameterProperty`) with identical unwrap logic. The terminal handling is intentionally opposite
(one keeps `Identifier` names and ignores patterns; the other skips identifiers and descends into
patterns), so only the three wrapper arms are shared.

Suggestion: extract `unwrapBindingChild(pattern)` in `ast-access.ts` returning the inner record for
the three wrapper cases; both walkers call it and keep their distinct terminal logic. Partial
dedupe, roughly 20 lines; the two outer functions stay separate.

### L3. Member-call guard repeated in no-restricted-syntax

Package: no-restricted-syntax.

The "callee is an un-computed `MemberExpression` with an `Identifier` property" guard, plus method
name extraction, recurs in `_method-call-ban-rule.ts:58-72`, `no-trim-left-right.ts:46-58`,
`require-queryselector-generic.ts:67-80`, and
`no-low-information-symbol-description/ast.ts:47-49`. Only the guard plus name extraction is
shareable; each rule's follow-up differs, so they cannot all call `methodCallBanRule` (which only
reports). Extract `getCalledStaticMethodName({ node }): string | symbol` into the M2 shared syntax
module and consume it. Low priority; do it opportunistically alongside M2. Roughly 12 lines.

### L4. Dead `findDelimiter` utility overlaps inline bracket scans

Package: stylistic.

`utility/delimiter.ts:45-64` exports `findDelimiter`, which is imported by nothing (`rg` finds only
its own definition). It does exactly the open/close bracket scan that `buildPerLineFix`
(`item-per-line-fix.ts:134-150`) and `paramPerLine` (`param-per-line.ts:125-135`) inline by hand.
So a utility built to remove this duplication exists but is unused while the duplication persists.
Either wire it into the scan sites or delete it (64 lines). `delimiter.ts:14` and
`comma-dangle.ts:26-31` also keep separate `CLOSE_DELIMITERS` sets.

### L5. Thin per-line rule shell repeated across the per-line family

Package: stylistic.

Roughly seven to nine per-line rules (`array-element-per-line.ts`, `object-property-per-line.ts`,
`destructure-per-line.ts`, `tuple-per-line.ts`, `argument-per-line.ts`, plus the
`import` / `export` / `type-property` variants) each declare a
`type XListNode = Span & { readonly <field>?: readonly Span[] }`, narrow the node, undefined-guard
the field, and call `checkItemsPerLine`. The hard logic is already delegated; only the selector
differs. A `makePerLineRule({ visitorKeys, field | selectItems, messageId, bracketPair, delimiter?,
meta })` would collapse the simple cases and let the three filtering variants pass a `selectItems`
callback. This is volume (200-plus lines) but low risk and partly a clarity-versus-concision call,
since the per-line logic is already DRY and each rule reads clearly.

### L6. `comma-dangle` per-field check wrappers

Package: stylistic.

`rules/comma-dangle.ts:53-233` has roughly nine `checkElements` / `checkProperties` / and peers that
are identical apart from the `fieldName` passed to `lastFieldNode`. A
`Record<visitorKey, fieldName>` table feeding one generic handler would collapse them. Intra-file
and the underlying utility is already well-factored; cosmetic.

### L7. `before` ignore-file hook and untyped-node cast, repeated in tsdoc

Package: tsdoc.

The three-line `before() { if (shouldIgnoreFile(context.filename)) return false; return undefined; }`
recurs in the standalone-visitor rules (`tag-types.ts`, `structural.ts`, `require-tsdoc.ts`,
`require-example.ts`, `yields.ts`); a `makeIgnoreFileBefore(context)` helper collapses each to one
line. Separately, `node as Span & Record<string, unknown>` with its `no-unsafe-type-assertion`
suppression recurs about seven times; an `asUntypedNode(node)` helper in `ast-access.ts` would
centralize the single suppression. Both are low value (the win is consolidating suppressions, not
lines), and `require-example` legitimately needs extra `before` work.

## Justified similarity (no action)

These look parallel but factoring would hurt; recorded so they are not re-raised.

- The three `index.ts` files share only the `eslintCompatPlugin({ meta, rules })` wrapper; each
  assembles an entirely different rule map. The import lists and rule maps are intrinsic.
- The identical four-symbol `import type { Context, CreateOnceRule, ESTree, VisitorWithHooks }`
  block recurs widely, but TypeScript cannot share an import statement. A barrel re-export would be
  ergonomic only, not structural.
- stylistic's `range.ts`, `line-at.ts`, and `indent.ts` byte/line/indent math is genuinely
  package-local; tsdoc computes positions from the AST `comment.range` / `loc` and no-restricted
  does no range math. Only the `isWhitespaceChar` leaf (M1) crosses over.
- `getAllComments()` scanning appears in `_ban-disable-factory.ts`, `tsdoc-comments.ts`, and
  `structural.ts`, but each scans for a different thing; only the external API entry point is
  shared.
- `chain-per-line` and `invocation-depth-per-line` operate on a different AST axis and legitimately
  cannot use `item-per-line`; their resemblance to the per-line family is coincidental.
- `prefer-error-is-error.globals.ts` `isGlobalErrorConstructor` versus `isGlobalObjectConstructor`
  look parallel but the Error variant does extra `globalThis.Error` member-walking. Different
  intent.
- Per-package `package.json`, `mise.toml`, `tsconfig.json`, and `tsdown.node.config.ts` differences
  are intrinsic or already inherit shared bases.

## Recommended homes and priority

No shared oxlint-utility package exists today. The only related package,
`@monochromatic-dev/config-oxlint` (`packages/config/oxlint`), aggregates and is downstream of all
three plugins, so it cannot host shared helpers without an import cycle. Two new homes fit the
publish constraints:

- A dev-only test kit (`devDependency` only, never in the published runtime graph): the oxlint
  runner harness, fixture-temp helpers, diagnostic types, `uniqueRules`, and one `ROOT` resolver.
  Covers H1.
- A published runtime kit (`workspace:*` dependency of all three; precedent exists, stylistic
  already depends on `@monochromatic-dev/module-or-throw`): the char-class primitives (M1),
  generic `isRecord` plus unified untyped-AST access (L1, L7), and optionally `defineRule` with an
  `@oxlint/plugins` type barrel (M4).

Suggested order by value:

1. H1 (test harness), highest value and no publishing tension.
2. H2 with H3 (one stylistic refactor removing the most code).
3. H4 and M1 (tsdoc scan primitives and char predicates; the canonical versions already live in
   `comment-text.ts`).
4. M2 (drift-dangerous AST helpers) and M3 (single-syntax ban factory).
5. M5, M6, M7, M8, M9 (modest tsdoc and stylistic factories that also cut off-by-one and node-list
   drift).
6. L1 through L7 (opportunistic; L4 is simply dead code to delete or wire up).

M4 and L5 are volume-heavy but mostly ergonomic; weigh the clarity cost before doing them.

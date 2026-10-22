# Mis-indented TypeScript passes oxlint-stylistic after dprint's typescript-0.95.9 formatter was disabled

## Symptom

Mis-indented TypeScript passes `oxlint` in every package.
Issue [aquaticats/Monochromatic#577](https://github.com/Aquaticats/Monochromatic/issues/577) states it plainly:
"nothing that runs today checks indentation".

Evidence recorded there:

- the translation-repair audit fixed blocks whose indentation disagreed with their nesting while lint stayed clean:
  about 190 lines in `src/benchmark.ts` (`runCriticBenchmark`'s nested blocks, fixed in `632ef5fbc`),
  about 60 lines in `src/repair-translation.unit.test.ts` after a template literal,
  and shallower-than-block arguments in `src/stream-idle-guard.unit.test.ts` (fixed in `f7b766fa4`);
- a heuristic scan of that package's 1,666 `.ts` files flagged 35 lines; the rest were template-literal ends.

Measured over the whole repository corpus in this investigation (see "Verification"):

- 10,380 code lines (0.99% of 1,052,277 code lines) disagree with the four-route indent model defined in
  "The model"; the model matches 99.01% of code lines overall;
- 578 flagged lines are off by an odd width (1 or 3 spaces), which no 2-space convention can intend;
- concrete failures: `package/agent-harness-shared/advisor/rolldown.node.config.ts:16` holds array elements two
  spaces deeper than both the dprint convention and the `item-per-line-fix` render, and
  `package/agent-harness-shared/advisor/src/operation-usage.ts:46` starts a function-expression body two spaces
  shallower than its owner line.

Related replacement gap recorded in the same issue: `comma-dangle` ships in the plugin but
`package/config/oxlint/src/rule/style.ts` does not enable it, while the retired dprint config set
`"trailingCommas": "always"`; files in one package mix both styles.

## Root cause

`package/config/dprint/index.json` disables the dprint TypeScript formatter, moving its duties to the plugin:

```jsonc
// package/config/dprint/index.json:39
    // Disabled: to be replaced by our oxlint-stylistic
    //    "https://plugins.dprint.dev/typescript-0.95.9.wasm",
```

The conventions it used to enforce live on as commented settings in the `"typescript"` block
(`package/config/dprint/index.json:105`: `preferHanging`, `memberExpression.linePerExpression`,
`binaryExpression.linePerExpression`, `trailingCommas`, `useBraces`, `nextControlFlowPosition`)
plus `lineWidth: 90`, `indentWidth: 2`, `useTabs: false` (`package/config/dprint/index.json:32`).

The plugin accepted the handoff in its own package doc
(`package/oxlint-plugin/stylistic/src/index.ts:38`):

```text
 The per-line rules fire when 2 or more items share a source line and
 auto-fix by placing every item on its own line with consistent
 indentation. They are this repository's TypeScript layout authority
 because dprint's TypeScript formatter is disabled; dprint still formats
 non-TypeScript files.
```

No rule in the plugin computes expected indentation.
The convention survives only as fixer emission points in three utilities, all in the same shape:
indent children of the line where the construct starts, plus two spaces.
`package/oxlint-plugin/stylistic/src/utility/item-per-line-fix.ts:188`:

```ts
  const linePrefix = sourceText.slice(
    lineStart,
    openPos,
  );
  const baseIndent = leadingWhitespace(linePrefix,);
  /**
   Two-space continuation indent for items inside the brackets.
   */
  const childIndent = `${baseIndent}  `;
```

and `package/oxlint-plugin/stylistic/src/utility/item-per-line-fix.ts:257` returns the closer to that base indent:

```ts
  const replacement =
    `${bracketPair.open}\n${formattedItems}\n${baseIndent}${bracketPair.close}`;
```

`package/oxlint-plugin/stylistic/src/rule/chain-per-line.ts:180` names the same rule:

```ts
      /**
       Continuation indent: the head line's indentation plus two spaces.
       */
      const childIndent = `${
        baseIndentAt({
          sourceText,
          offset: regionStart,
        },)
      }  `;
```

`package/oxlint-plugin/stylistic/src/utility/invocation-depth-fix.ts:292` repeats it:

```ts
  /**
   Head-line indentation; the closing bracket returns to it.
   */
  const baseIndent = baseIndentAt({
    sourceText,
    offset: owner.start,
  },);
  /**
   Operand-line indentation: head-line indent plus two spaces.
   */
  const childIndent = `${baseIndent}  `;
```

Consequence: any checker or fixer that computes a different width fights these three and the file
oscillates, the failure mode recorded in `doc/troubleshooting/oxlint-multi-fix-convergence.md`.
A checker built on "anchor line indent plus two spaces, closers at the bracket base" converges with them
by construction, which is why "The model" uses exactly that formula.

Readings this investigation retracted, each with the evidence that disproved it:

- Matching dprint's output exactly was the goal.
  Wrong: the rule defines its own pragmatic convention and formatter parity is out of scope
  (user correction 2026-10-22).
- A report-only checker is enough.
  Wrong: the feature ships with an autofix (user correction 2026-10-22).
- Plain ancestor-plus-two predicts indentation everywhere.
  Wrong: the probe's first model systematically predicted `catch`/`else` two spaces deeper than their
  statement lines and chain lines deeper than the fixers emit; the emission excerpts above show the true anchors.
- A body brace whose owner ends where its parent ends can adopt the parent's start line.
  Wrong: the `owner.end === parent.end` probe variant mis-remapped `ParenthesizedExpression` nodes inside
  `BinaryExpression` (example `package/agent-harness-shared/advisor/src/advisor-client.ts:234`, predicted 6,
  produced 4); restricting the remap to `{` tokens of `Block`, `ModuleBlock`, and `CaseBlock` fixed it.
- The repository's `typescript` dependency can parse TypeScript for tooling.
  Wrong: `require('typescript')` resolves to `typescript@7.1.0-beta`'s `lib/version.cjs`, where `SyntaxKind`
  is undefined; the probe parses with the classic `typescript.js` from the TypeScript v5.9.3 release.

## Verification

Versions under test: `oxlint` 1.89.0 and `@oxlint/plugins` 1.89.0 from `node_modules`, the dprint oracle
running dprint 0.64.0 with `typescript-0.95.9.wasm`, and TypeScript v5.9.3 classic `typescript.js` in the probe.
The plugin API surface needed for check and autofix is present in `node_modules/@oxlint/plugins/index.d.ts:2917`:

```ts
  insertTextBeforeRange(range: Range, text: string): Fix;
  removeRange(range: Range): Fix;
  replaceTextRange(range: Range, text: string): Fix;
```

Harness: a disposable AST probe (413 LoC) at `~/temp/agent/indent-probe-2026-10-22/probe.mjs`, run as
`node probe.mjs corpus.txt > full3.json`, over every `.ts` file under `package/` excluding test fixtures,
build output, and `node_modules`: 7,091 files and 1,052,277 code lines after blank, comment, and
template-literal-content lines are exempted.
The probe is scratch, and "The model" below is sufficient to rebuild it.

Clean patterns (the model predicts the corpus):

- item start lines at anchor plus two: 706,672 of 709,875 match (99.55%);
- closers (`}`, `]`, `)`) at the bracket base: 244,008 of 245,523 match (99.38%);
- suffix keywords (`else`, `catch`, `finally`, do-while `while`) at the owner statement line:
  2,000 of 2,000 match (100%).

Failing patterns (the model and the corpus disagree; the autofix would rewrite these):

- continuation lines overall match 89,162 of 94,824 (94.03%), and the disagreements concentrate in coherent
  alternative styles: flat binary and string-concatenation operands (`PlusToken`, 1,898 lines),
  flat union and intersection bars (`BarToken`, 1,265 lines), and hanging function-expression bodies written
  flat (`ReturnKeyword`, 738 lines, plus their closers);
- deviation widths: 7,947 lines two spaces shallower than the model, 1,705 two spaces deeper,
  578 off by an odd width, 150 off by four;
- corpus-level consequence: the rule's autofix would normalize 10,380 lines in one sweep (0.99% of code
  lines), which the user accepted ("I don't care about huge sweeping changes").

Cross-check with the dprint oracle (scratch `~/temp/agent/indent-dprint-oracle-2026-10-22/`):
200 corpus files formatted by dprint with the repository's conventions change in 195 files, with 6,785
changed line pairs; only 228 are genuine content-line indent changes, 1,972 are TSDoc blank-line whitespace
normalizations, and 4,585 (67.58%) are non-indent rewraps.
On the overlapping package samples (the oracle's first 200 corpus files, the probe's 50-file advisor-heavy
smoke slice) the two instruments agree on where indent drift lives: 228 per 200 files against 56 per 50 files.

## Verified workarounds

- Probe-guided manual correction: run `node probe.mjs <file-list>` and fix the reported lines by hand.
  Tradeoff: no autofix and no lint integration, so drift returns; the alternative corpus styles listed
  under failing patterns show up as flags even where they are internally consistent.
- Classic `typescript.js` for AST work: fetch `typescript.js` from the TypeScript v5.9.3 release when scratch
  tooling needs the parser and `SyntaxKind`.
  Tradeoff: a second compiler version runs beside the repository's `typescript@7.1.0-beta`;
  fine for scratch probes, not for repository code.
- dprint as an indentation oracle: copy corpus files to scratch and run `dprint check` and `dprint fmt` with a
  scratch `dprint.json` carrying the repository's `lineWidth`, `indentWidth`, `useTabs`, and `"typescript"`
  settings, then keep only indentation hunks.
  Tradeoff: 67.58% of dprint's changes are non-indent rewraps, so hunk filtering is manual, and dprint's
  convention is not the rule's convention.

## What does not work

- Re-enabling the dprint TypeScript plugin: it rewrites 195 of 200 sampled files with 4,585 non-indent rewraps
  and 1,972 TSDoc blank-line normalizations.
  That is a whole-file reformat, the outcome
  `.out-of-scope/low-impact-typescript-formatting.md` rejects in favor of newline-first structure work.
- The plain ancestor-plus-two model with no closer, suffix, or template handling: systematic errors on
  `catch`, `else`, chains, and template tail lines (see the retracted readings in "Root cause").
- A checker whose fixer uses another width than the existing fixers emit: oscillation, recorded in
  `doc/troubleshooting/oxlint-multi-fix-convergence.md`.
- `require('typescript')` from the repository for parsing: `typescript@7.1.0-beta` exposes only
  `lib/version.cjs`.
- Reproducing eslint's `lib/rules/indent.js` offset tables (2,332 lines, fixable whitespace): that rule
  encodes per-construct offsets for eslint's ecosystem, while this repository needs one uniform convention,
  and the measured prototype computes it in far less code.

## Estimated implementation cost

The rule `indentation` in `package/oxlint-plugin/stylistic`, check plus autofix, on the simplest model the
measurements support (the user's direction: "Make the model as simple as possible. I don't care about huge
sweeping changes.").

### The model

Every code line is judged by one of four routes.

#### Template exemption

Template-literal content (`TemplateExpression`, `NoSubstitutionTemplateLiteral` spans) is exempt.

#### Ancestor plus two

A line's first token expects the indent of the line where its nearest AST ancestor starting on an earlier
line begins, plus two spaces; `SourceFile` depth is zero.

#### Closer at the bracket base

A closer (`}`, `]`, `)`) expects the indent of the line where its opening bracket begins, except a `}`
closing a `Block`, `ModuleBlock`, or `CaseBlock` whose owner starts on an earlier line expects the owner's
line indent.

#### Suffix keyword at the owner line

Suffix keywords (`else`, `catch`, `finally`, do-while `while`) expect their owner statement's line indent.

The autofix rewrites the leading whitespace of deviating lines only.
Because the existing fixers all emit anchor-line plus two (`item-per-line-fix.ts:195`,
`chain-per-line.ts:180`, `invocation-depth-fix.ts:293`), the fixer converges with them by construction.

### Components

Sizes in the repository's measured style:

- expected-indent engine (four routes, template spans, line and anchor walk): 500 to 900 LoC;
- rule wrapper, reporter, and per-line whitespace fixer: 350 to 600 LoC;
- convergence tests running the new fixer to a fixed point against the per-line, chain, invocation-depth,
  and block-body fixers: 250 to 400 LoC;
- valid and invalid fixtures plus unit tests covering every model branch: 800 to 1,300 LoC;
- docs and rule registration: 100 to 200 LoC.

Total: 2,000 to 3,400 LoC, central estimate about 2,700 LoC, check and autofix included.

Calibration behind the ranges: eslint's fixable `lib/rules/indent.js` is 2,332 lines with per-construct
offset tables, and the prototype for the four-route model is 413 lines including statistics and reporting.
This plugin family measures 7,599 production LoC plus 1,823 test LoC and 2,208 fixture LoC (0.53 times the
production size).

Decision rule from the user: over 10,000 LoC closes issue #577 as not planned.
This estimate clears that threshold by about 3.7 times, so the issue stays open.

## Upstream filing artifact

Nothing to add upstream.
The capability gap is in this repository's plugin, and `@oxlint/plugins` 1.89.0 already ships the
report-and-fix primitives quoted in "Verification".

`.out-of-scope/` was checked:
`low-impact-typescript-formatting.md` excludes type-parameter, type-argument, import-attribute, enum, and
quote rules as low-impact polish, and names block bodies, lists, and expression chains as the useful work;
indentation checking is that useful work, so no exemption applies.

### Upstream filing decision

#### Is it really upstream's fault?

No.
dprint's formatter behavior is by design and this repository disabled the plugin deliberately
(`package/config/dprint/index.json:39`).
oxlint's plugin API supports `Context.report` with `loc` and range fixers, so no upstream behavior blocks
the rule.

#### Can upstream fix it?

Not applicable: nothing is broken upstream.
An upstream built-in `indent` rule would be a feature request against the eslint-core port umbrella
(`oxc-project/oxc#479`), not a bug.

#### Are they supporting this use case?

The plugin API exists for rules like this, and the repository's own
`.out-of-scope/low-impact-typescript-formatting.md` assigns indentation of block bodies, lists, and chains
to this repository's formatter work.
The use case is supported here, not upstream.

#### Would the repo welcome our contribution?

Not applicable to upstream filing; the work lands in this repository either way.
`CONTRIBUTING.md` and repository policy here were checked and place no restriction on in-repo lint rules.

#### Will they likely fix it?

Not applicable.
Tracker search on 2026-10-22 for indent issues in `oxc-project/oxc` found no dedicated request for a built-in
TypeScript indent lint rule.
The closest items are formatter-side indent bugs (`oxc-project/oxc#20145`, `oxc-project/oxc#26598`) and the
jsplugin interplay report `oxc-project/oxc#24385`.

#### Have we prototyped a minimal fix compatible with their architecture?

Yes, at prototype scale.
The 413-line probe implements the four-route model against the real `typescript.js` parser and the
`@oxlint/plugins` visitor shape, and the convergence constraint against `item-per-line-fix`,
`chain-per-line`, and `invocation-depth-fix` is read from their sources and quoted in "Root cause".
The full rule is the remaining work sized in "Estimated implementation cost".

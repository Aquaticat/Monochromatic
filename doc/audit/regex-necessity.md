# AUDIT: regex necessity

Repo-wide audit of regex use against one criterion,
 with one GitHub issue filed per unnecessary site.

## Criterion

A regex site is unnecessary when the feature it implements can be written without regex
 at similar or better time complexity.
Code length,
 familiarity,
 and "the pattern is safe" do not enter the test:
 a bounded,
 backtracking-free pattern that a string API answers directly is still unnecessary.

Two classes survive the criterion:

- The feature **is** regex semantics on an arbitrary pattern supplied by someone else
  (a user-typed `/.../` filter,
  a Jest-compatible `toMatch(string)` that must compile to a `RegExp` for chai).
- The value must **be** a `RegExp`,
  because an API,
  a type,
  or a test subject requires that type
  (`expect.stringMatching(pattern: RegExp)`,
  upstream pify's `Array<string | RegExp>` include list,
  `regExpOrThrow` inputs,
  deepmerge leaf values,
  the `no-regex` rule's own fixtures).

Everything else is a fixed pattern over a known alphabet,
 which a linear scan answers.

## Method

Enumeration had to see justified sites too,
 so suppression directives could not simply be honoured.

1. Mirror every tracked and untracked `.ts`,
   `.tsx`,
   `.mts`,
   `.cts`,
   `.js`,
   `.jsx`,
   `.mjs`,
   and `.cjs` file into a scratch tree
   (`node build-mirror.mjs`,
   6996 files),
   rewriting `oxlint-disable` to `oxlint-xisable` and `oxlint-enable` to `oxlint-xnable`.
   Both replacements are the same byte length,
   so line and column positions are unchanged.
2. Run the repository's own `no-restricted-syntax/no-regex` rule over the mirror with a
   scratch config whose `ignorePatterns` is empty and whose only enabled rule is `no-regex`.
   The detector is therefore the parser-backed rule the gate uses,
   not a text search.
3. Map each diagnostic back to the original path,
   slice the exact source text on UTF-8 byte offsets
   (oxlint spans are byte offsets,
   so slicing code units drifts on any file containing non-ASCII),
   and dedupe on `(offset, length)`.
   Chained calls such as `md.replaceAll(/a/, '').replaceAll(/b/, '')` report one diagnostic
   per call with the same start offset and different lengths,
   and the regex belonging to a given call is the last literal inside its span.
4. Recompute directive ranges from the original text
   (block `disable` to matching `enable` or end of file,
   plus `disable-next-line` and `disable-line`),
   so each site is attributed to the justification that actually covers it.
5. Classify each site as necessary or unnecessary,
   derive the replacement shape from a tokenizer over the pattern body
   (literals,
   character classes,
   quantifiers,
   groups,
   anchors,
   boundaries,
   lookbehind),
   and resolve the owning package from the nearest `mise.toml` and `package.json`.

Result:
 1631 unique regex sites repo-wide.

## Results

- **278 unnecessary sites in tracked first-party code**:
  221 in active packages,
  57 in `package-paused/`.
  One issue each.
- **118 necessary sites** under the criterion
  (38 active,
  80 paused),
  each with the reason recorded in the audit data.
- **1069 sites in untracked files**:
  gitignored local artifacts,
  dominated by `src/canary-lint/<model>/<probe>/canary.ts`,
  which `package-paused/dev-script/inference-canary/README.md` documents as generated model
  outputs that are gitignored but preserved locally.
  Editing them would falsify a measurement record,
  so they are out of scope.
- **165 sites in `package/module/deepmerge-ts.fuzz/src/declared-type-soundness.generated.ts`**:
  generated corpus data ("Do not edit"),
  where each `new RegExp("x", "gu")` is a leaf value the merge must handle.
  Necessary on both counts.
- **1 site in `package/module/conf-fork.fuzz/upstream-conf/index.ts`**:
  a vendored upstream snapshot under `@ts-nocheck`,
  whose value is that it matches upstream.

Replacement shapes across the 278:
 88 field extractions between literal delimiters,
 54 literal-plus-character-run scans,
 24 ordered literal and class sequences,
 23 alternations over a fixed candidate set,
 21 literal prefix tests,
 21 word-boundary substring tests,
 10 literal substring tests,
 8 runtime-compiled patterns,
 8 fixed-count character runs,
 8 small token grammars,
 5 literal global replacements,
 4 anchored literals,
 4 lookbehind escape-parity scans.

## Measured refutations of recorded justifications

The audit did not accept a disable justification as evidence of necessity.
Where a justification made a checkable claim,
 the claim was checked.

- `package/typeface/aquaticat/src/parse-svg.ts:150` claims the element tokenizer is
  "Linear:
  every char is visited at most twice across the alternation".
  Measured on unterminated `<rect ` openers,
  one `exec` over the input takes 39 to 47 ms at 32 KB,
  153 to 165 ms at 64 KB,
  and 617 to 649 ms at 128 KB,
  three runs per size:
  about four times per doubling,
  which is quadratic,
  with roughly 10% run-to-run spread.
  Each opener starts a lazy `[^>]*?` scan that reaches end of input before failing.
- `package/cli/wg-quicker/src/config-parse-values.ts:128` calls `/^[0-9.]+$/u` an
  "Anchored IPv4 token classification".
  Measured,
  it accepts `...`,
  `.`,
  `1..2`,
  `1.2.3.4.5.6.7.8.9`,
  and `999.999.999.999`.
  What it tests is "every character is a digit or a dot".
- `package/ssg/aquati.cat/src/lib/git-dates.ts:199` parses `owner/repo` with
  `[^/]+\/[^/.]+`.
  The `[^/.]` class excludes dots from repository names,
  so measured results are `null` for `git@github.com:owner/repo.js.git`,
  `https://github.com/owner/dot.repo`,
  and `git@github.com:owner/repo.name.git`,
  while `gh api repos/socketio/socket.io` confirms dotted repository names are real.
  The caller then returns its ABSENT sentinel,
  silently dropping commit dates.
- `package-paused/webapp-forge/server/src/storage/write-buffer.unit.test.ts:107` states
  "expect API requires a RegExp".
  This repository's expect does not:
  `toMatch: (expected: string | RegExp,) => void`
  (`package/module/test-expect/src/expect-matchers.ts:87`),
  with an existing test named `toMatch works with string`
  (`package/module/test-expect/src/expect.unit.test.ts:311`).
- Seven rolldown configs justify `/^node:/u` and `/^electron(\/|$)/u` as anchored tests
  the bundler needs.
  Rolldown's `external` accepts a plain string or a predicate:
  `type ExternalOption = StringOrRegExp | StringOrRegExp[] | ExternalOptionFunction` and
  `type ExternalOptionFunction = (id, parentId, isResolved) => NullValue<boolean>`
  (`node_modules/rolldown/dist/shared/define-config-CGhm2DU-.d.mts:3415-3417`).
  For the same reason,
  `escapePackageNameForRegExp` in `package/config/rolldown/src/package-externals.ts:89`
  exists only to feed the `new RegExp` at line 111,
  and both disappear under a predicate.
- `package/oxlint-plugin/no-restricted-syntax/src/rule/prefer-describe-function-ref-name.ts`
  omits the `u` flag on four interpolated patterns because "u-mode's code-point semantics
  plus stricter escape parsing could alter how that interpolated value matches".
  Measured over six parser-produced identifiers,
  including `$dollar`,
  `_under`,
  digits,
  and mixed case,
  the flagged and unflagged forms give identical results:
  an identifier contains only characters that are literals in both modes.
  The same file's re-export matcher `export\s*\{[^}]*\bNAME\b[^}]*\}\s*from\s*['"]` was
  also measured on a 256 KB brace-free region and stayed linear (0.16 ms),
  so the cost argument does not rescue it either;
  the shape is the problem.
- `package-paused/module/es/.../t typeof/.../index.ts:135` and `:138` claim
  "no string API exposes the Unicode upper-letter set".
  Case mapping is a string API carrying the same Unicode data.
  Measured over 15 samples,
  `char.toLowerCase() !== char && char.toUpperCase() === char` agrees with `\p{Upper}`
  everywhere except U+1D2C and U+1D43 (category Lm).
  These two sites are therefore recorded as a judgement call rather than a settled finding:
  the regex is only necessary if modifier letters must classify by Unicode property,
  and the justification does not say that.
- Runtime compilation cost was checked and did **not** support a hot-path argument:
  1000 iterations of `new RegExp(source)` plus a test took 32.6 ms against 32.3 ms for a
  literal,
  and 5000 iterations took 168.1 ms against 160.4 ms,
  differences inside run-to-run spread.
  No issue in this audit claims a compilation-cost win.

## Gate coverage

175 of the 278 unnecessary sites carry no justification at all,
 because the gate never reaches them:

- 163 sites are in packages with no `lint:oxlint` task.
  Measured with `mise tasks ls --all`:
  `//package/desktop-app/ide`,
  `//package/music-player`,
  `//package/linter/monochromatic-lint`,
  `//package/git-policy/cli.fuzz`,
  `//package/linter/monochromatic-lint.fuzz`,
  `//package/cli/forbidden-strings`,
  and `//package/music-player/truepeak-core.bench` each list zero such tasks.
  Positive control:
  `//package/pi-plugin/auto-mode`,
  `//package/ssg/aquati.cat`,
  `//package/typeface/aquaticat`,
  `//package/cli/wg-quicker`,
  and `//package/config/oxlint` each list one,
  so the probe can show a task when one exists.
- 10 sites are in `doc/handover/` and `doc/troubleshooting/` scripts,
  which no package task covers.
- 1 site is in a `.js` or `.cjs` file,
  which `package/config/oxlint/src/config-base.ts:63` excludes through `ignorePatterns`.
- 1 site is reached and is red:
  `mise run //package/git-policy/cli:lint:oxlint` reports 75 errors and 65 warnings,
  one of them the `no-regex` error at
  `package/git-policy/cli/bin/build-git-test-image.mjs:61`.
  That contradicts the "sweep complete,
  green for every non-paused package" status in `doc/handover/no-regex.md`.

The coverage gap is filed as its own issue,
 because closing 175 per-site issues still leaves the gate blind to the next one.

## Relationship to the earlier sweep

`doc/handover/no-regex.md` records the sweep that cleared the gate's findings and paused
 three packages.
 `doc/audit/regex-replacement-perf.md` audited the performance of the parsers that sweep
 introduced,
 and listed "regex deliberately kept with a justified disable" as out of scope.
This audit covers exactly that excluded set plus every site the gate cannot see,
 so the two documents are complementary rather than overlapping.

## Non-JS surfaces checked

The detector is a JavaScript rule,
 so the other languages and the config layer were checked separately.

- **Rust**:
  outside the two crates whose product is a regex engine
  (`package/rust-module/forbidden-regex`,
  `package/cli/forbidden-strings`),
  the only tracked construction site is
  `package/desktop-app/ide/src/find.rs:170`,
  which escapes a user's find text and builds a case-insensitive Unicode matcher.
  Classified necessary:
  the feature is case-insensitive literal search with full Unicode case folding,
  and the `regex` crate supplies both the folding and a literal-optimized matcher.
  A hand-rolled scanner would need its own folding table and would compare at every
  position instead of using the crate's literal search.
  `doc/audit/resharp-fuzz-2026-06-19/tool/anchor_denot.rs` also imports the crate,
  as a one-off tool whose subject is regex denotations.
  No Rust lint rule polices regex use,
  so this surface has no gate equivalent to `no-regex`.
- **Kotlin**:
  zero `Regex(` and zero `toRegex(` sites across 246 tracked `.kt` files.
- **Config and data files**:
  no regex-shaped strings in tracked JSON,
  JSONC,
  TOML,
  or YAML config.
  Stylelint is removed (`doc/decision/remove-stylelint.md`),
  so the regex-shaped stylelint strings recorded in `doc/handover/no-regex.md` are gone.
- **Regex as data**:
  `package/cli/mutation-test/src/engine/enumerate.unit.test.ts` holds regex source text
  as string fixtures for the quantifier mutators,
  and `package/dev-script/deps-cube/src/script/filter.ts` holds user search strings.
  Both are inputs to a feature whose subject is regex,
  not regex use.

## Reproducing

The scratch harness lives outside the repository,
 in `${HOME}/temp/agent/regex-audit/`,
 and is not committed:
`build-mirror.mjs`,
 `sites3.mjs`,
 `pipeline.mjs`,
 `pattern-analysis.mjs`,
 `rebuttals.mjs`,
 `generate.mjs`,
 `evidence.mjs`,
 and `spread.mjs`.
The measurements quoted here come from `evidence.mjs` and `spread.mjs` run under
 Node v26.11.1 on this machine;
 timings are single-machine and are reported as doubling series with per-size repeats
 rather than as absolute claims.

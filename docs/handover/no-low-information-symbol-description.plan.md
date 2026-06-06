# Implement oxlint rule: no-low-information-symbol-description

## Current status

The original Shannon-entropy and compression-first plan is obsolete.
The current benchmark proves that threshold-only scoring is not enough, and that a structural classifier reaches zero
misclassifications on the persisted calibration set without global compression.

Measured current data state:

- `packages/test-fixture/oxlint-no-restricted-syntax/data/no-low-information-symbol-description.pass.txt`: 145 rows.
- `packages/test-fixture/oxlint-no-restricted-syntax/data/no-low-information-symbol-description.fail.txt`: 217 rows.
- `packages/test-fixture/oxlint-no-restricted-syntax/data/no-low-information-symbol-description.borderline.txt`: 2 rows.
- `packages/test-fixture/oxlint-no-restricted-syntax/data/no-low-information-symbol-description.benchmark.html`: embeds 362 pass/fail rows.

Browser verification of the benchmark reported 0 classifier errors, no classifier mismatches, and no console or page
errors. The selected threshold comparison still reports 19 errors because it is only the old numeric baseline:
minimum length, distinct words, and type-token ratio. It is intentionally not the proposed rule.

## Intent

Implement `no-restricted-syntax/no-low-information-symbol-description` for static Symbol descriptions:

- `Symbol('...')`
- `Symbol.for('...')`
- zero-expression template literals, such as `` Symbol(`...`) ``

Skip absent, dynamic, and non-string descriptions. Type information is unavailable in an oxlint JS plugin, so only
static AST shape is enforceable.

The rule gates the debugging identity of Symbols, especially sentinel Symbols used instead of nullish unions.
Descriptions that read like generic code identifiers, generic absence labels, or repeated low-information phrases
should report. Descriptions with enough contextual detail should pass even when short.

## Non-goals

- Do not use Shannon entropy.
- Do not use global compression.
- Do not use broad vocabulary lists such as `stopWords` or `specificWords`.
- Do not treat current repo Symbol descriptions as automatic ground truth.
- Do not re-add borderline descriptions to `fail.txt`.
  The borderline file is not an allowlist. If a borderline description trips the actual production classifier in source,
  fix that Symbol description in source rather than weakening the classifier or moving the row back into fail data.
- Do not flag no-argument `Symbol()` in this rule unless the user explicitly asks.
- Do not hardcode per-description allowlists or denylists in the production rule.

## Data files

Keep these calibration files under `packages/test-fixture/oxlint-no-restricted-syntax/data/`:

- `no-low-information-symbol-description.pass.txt`, labeled pass examples.
- `no-low-information-symbol-description.fail.txt`, labeled fail examples.
- `no-low-information-symbol-description.borderline.txt`, examples that are intentionally excluded from pass/fail.
- `no-low-information-symbol-description.benchmark.html`, browser benchmark and visual diagnostics.

Current borderline rows:

- `no-static-method-name`
- `NO STATIC METHOD NAME`

These rows are excluded from pass/fail calibration so future agents do not re-add them to `fail.txt`.
They are not protected examples. If the implemented rule reports either description in real source, rewrite the real
Symbol description to carry more context instead of changing classifier behavior for them.

`unparseable-iso8601-timestamp` is a pass row.
`unparseable-timestamp` is a fail row.

## Production classifier

Port the classifier from the benchmark, not the threshold sweep.
The current benchmark implementation starts at
`packages/test-fixture/oxlint-no-restricted-syntax/data/no-low-information-symbol-description.benchmark.html:591`.
The threshold baseline starts at the separate `predictedThresholdPass` function and must not become production logic.

### Tokenization

Use a linear scan, not regex.
Split a description into words by:

- non-alphanumeric separators,
- lower or digit to upper boundary,
- acronym boundary where an uppercase run is followed by lowercase text.

Preserve original casing for structural checks, and also derive lowercased tokens for comparisons.

### Namespace handling

Treat `/` and `:` as namespace separators only when the prefix before the delimiter contains no spaces.
This keeps `penpot:skip` namespaced, and keeps `File absent: eaten by cat` as prose.

For namespaced descriptions, compare namespace words and tail words separately where needed.
Namespace words do not rescue a generic short tail.

### Specificity marker

A description has a structural specificity marker when it contains any of these:

- uppercase letter,
- digit,
- dot,
- underscore,
- word of length at least 4 with no `a`, `e`, `i`, `o`, or `u`.

This is not a broad semantic word list. It is a structural signal for technical tokens.

### Repetition handling

Meaningful repetition ignores:

- words of length 2 or less,
- words repeated from the namespace prefix.

Repeated meaningful words fail.

`because` receives narrow cause-and-effect handling:

- If `because` is absent, any repeated meaningful word fails.
- If `because` is present, compare meaningful words on both sides of `because`.
- Fail only when both sides repeat the same phrase, as in `file absent because file absent`.
- Do not globally exempt every string that contains `because`.

Do not run compression here unless a later user decision adds it as a narrow redundancy signal.
If compression is added later, it may only run inside a branch that already found a structural ambiguity, such as
repetition. It must not become a global hard gate.

### Check order

Report the first matching failure in this order:

1. Fewer than 3 words or fewer than 3 distinct lowercased words.
2. All alphabetic words are uppercase.
3. Bare camel/Pascal identifier with no separator and at least 3 words, such as `runWithContext`.
4. Repeated meaningful word, including repeated same phrase around `because`.
5. Namespaced description with tail shorter than 3 words.
6. Non-namespaced description starting with `no` and lacking a specificity marker.
7. Non-namespaced description starting with `not` and lacking a specificity marker.
8. Non-namespaced 3-word description lacking a specificity marker and whose third word does not end in `ed` or `ing`.
9. Otherwise pass.

The `no`, `not`, `because`, `ed`, and `ing` checks are intentionally small structural grammar hooks, not broad
vocabulary lists. Keep them visible in constants or helper names so future reviews can challenge them.

## Implementation files

### Create rule source

Create:

```txt
packages/oxlint-plugins/no-restricted-syntax/src/rules/no-low-information-symbol-description.ts
```

Follow the existing rule shape in `rules/no-regex.ts` and `rules/no-class.ts`:

- `CreateOnceRule` export named `noLowInformationSymbolDescription`.
- `meta.type: 'suggestion'`.
- `docs.description` explains that static Symbol descriptions must carry enough debugging information.
- `messages` has one message id per failure branch:
  - `tooFewWords`
  - `allUppercase`
  - `bareCamelIdentifier`
  - `repeatedMeaningfulWord`
  - `shortNamespacedTail`
  - `startsWithNoWithoutMarker`
  - `startsWithNotWithoutMarker`
  - `shortPhraseLacksSpecificityMarker`
- No options in the first implementation. The benchmark calibrated an opinionated rule, not a tunable threshold rule.
  Add options later only when a real consuming package needs them.
- `createOnce(context)` returns a visitor with `CallExpression(node)`.

Helpers to implement, with TSDoc and examples for every declaration:

- `isSymbolCall({ node })`
- `isSymbolForCall({ node })`
- `staticDescription({ node })`
- `splitDescriptionWords({ description })`
- `namespaceParts({ description })`
- `hasUppercase({ description })`
- `hasDigit({ description })`
- `hasLongNoVowelWord({ words })`
- `hasSpecificityMarker({ description, words })`
- `allAlphabeticWordsUppercase({ words })`
- `meaningfulWords({ words, namespaceWords })`
- `repeatedMeaningfulWord({ words, namespaceWords })`
- `repeatsSamePhraseAcrossBecause({ words, namespaceWords })`
- `hasSeparator({ description })`
- `isBareCamelIdentifier({ description, words })`
- `endsVerbLike({ word })`
- `classifySymbolDescription({ description })`

Keep implementation free of regex. If a regex becomes unavoidable, add the required scoped oxlint disable with a
justification that names input bounds and backtracking safety, but the current benchmark proves regex is unnecessary.

### Modify plugin index

Modify:

```txt
packages/oxlint-plugins/no-restricted-syntax/src/index.ts
```

Add the import and register:

```ts
'no-low-information-symbol-description': noLowInformationSymbolDescription,
```

Place it alphabetically in the syntax rules block between `no-hasownproperty` and `no-module-root-let`.

### Modify fixture config

Modify:

```txt
packages/test-fixture/oxlint-no-restricted-syntax/.oxlintrc.fixture.json
```

Add:

```json
"no-restricted-syntax/no-low-information-symbol-description": "error"
```

### Modify repo oxlint config

Modify:

```txt
packages/config/oxlint/src/rules/restriction.ts
```

Add the rule near the other substantive no-restricted-syntax rules.
Start as `warn` if existing repo descriptions are not remediated in the same change.
Use `error` only after the repo-wide smoke test reports no violations outside intentional fixtures.

This differs from the original plan. The current calibration includes repo-existing descriptions labeled as fail, so
turning the rule on as `error` before fixing those Symbols would intentionally break lint.

### Add fixtures and generated test sources

Prefer tests that read the `.txt` calibration files directly, because those files are now the source of truth.
Avoid hand-maintaining a second list of hundreds of Symbol calls.

Create one minimal persistent invalid fixture because `SUBSTANTIVE_RULES` maps each rule name to
`src/invalid/<rule>.ts`:

```txt
packages/test-fixture/oxlint-no-restricted-syntax/src/invalid/no-low-information-symbol-description.ts
```

That fixture only needs one obvious violation, such as `Symbol('meow')`, so the existing generic substantive-rule test
can prove the rule is wired into oxlint.

In `packages/oxlint-plugins/no-restricted-syntax/src/oxlint-no-restricted-syntax.unit.test.ts`:

- Add the rule to `SUBSTANTIVE_RULES` in alphabetical order.
- Add a pass-data test:
  - read every line from `no-low-information-symbol-description.pass.txt`,
  - generate a temporary TypeScript source file containing one `Symbol(<json string>)` call per row,
  - lint it with the fixture config,
  - assert no diagnostics for `no-restricted-syntax(no-low-information-symbol-description)`.
- Add a fail-data test:
  - read every line from `no-low-information-symbol-description.fail.txt`,
  - generate a temporary TypeScript source file containing one `Symbol(<json string>)` call per row,
  - lint it with the fixture config,
  - assert the rule emits exactly one diagnostic per row.
- Add a branch coverage test that checks representative message prefixes or message ids for every failure branch.
- Add a borderline-data test that asserts the borderline rows are absent from both pass and fail data files.
  Do not assert that the production rule passes or fails borderline rows unless the user labels them.
  If a borderline row appears in actual source and the implemented classifier reports it during repo remediation,
  fix the source description rather than changing the classifier to accommodate the borderline row.

If generating temp source inside the unit test is awkward with the current harness, create persistent generated fixtures
under `src/valid/` and `src/invalid/`, but generate them from the `.txt` data in a small TypeScript helper instead of
manually duplicating labels.

### Update README

Modify:

```txt
packages/oxlint-plugins/no-restricted-syntax/README.md
```

Add:

- rule list bullet,
- `## no-low-information-symbol-description` section,
- examples of pass, fail, and borderline labels,
- note that compression is not used globally,
- note that dynamic Symbol descriptions are skipped,
- note that the benchmark page compares the production classifier against threshold-only baselines.

## Repo remediation step

After implementing the rule, run it against the repo before enabling it as `error`.
For each diagnostic in real source, either:

- rewrite the Symbol description to a higher-information phrase, or
- keep the rule at `warn` until a follow-up migration fixes the remaining descriptions.

Do not suppress the rule with inline disables unless the rule source was inspected and a suppression document proves why
configuration or a clearer description cannot work.

The borderline file is not a suppression list.
Do not change classifier behavior to make `no-static-method-name` or `NO STATIC METHOD NAME` pass merely because they
are borderline.
If the repo-wide lint dry run reports either one in actual source, fix the actual Symbol description to be more
informative.

## Verification

Run package tasks through mise, not raw tools:

1. `mise run //packages/oxlint-plugins/no-restricted-syntax:lint:types`
2. `mise run //packages/oxlint-plugins/no-restricted-syntax:lint:oxlint`
3. `mise run //packages/oxlint-plugins/no-restricted-syntax:test:unit`
4. `mise run //packages/oxlint-plugins/no-restricted-syntax:build`

User-boundary smoke test:

1. Create a disposable temp directory.
2. Generate one temp TypeScript file from `pass.txt` and one from `fail.txt`.
3. Run oxlint through the fixture config on those files.
4. Confirm pass rows produce zero diagnostics for this rule.
5. Confirm fail rows produce exactly one diagnostic per row for this rule.
6. Delete the temp directory.

Benchmark verification after any classifier edit:

1. Regenerate the embedded benchmark data from `pass.txt` and `fail.txt`.
2. Open the benchmark with `agent-browser` via `file://`.
3. Confirm classifier errors are 0.
4. Confirm the classifier mismatch table says `No classifier mismatches.`
5. Exercise threshold preset buttons.
6. Confirm `agent-browser errors` and console output are empty.

## Commit plan

Make coherent commits as work lands:

1. Rule implementation and plugin registration.
2. Dataset-driven tests and fixtures.
3. Documentation.
4. Repo remediation or config enablement, depending on whether existing source diagnostics remain.

Keep unrelated concurrent work out of every commit by staging explicit pathspecs.

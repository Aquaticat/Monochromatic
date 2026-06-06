# No low information symbol description handover

## Current goal

Reach zero misclassifications on the persisted symbol-description calibration dataset, then verify the benchmark page in a browser.

## Files in scope

- `packages/test-fixture/oxlint-no-restricted-syntax/data/no-low-information-symbol-description.pass.txt`
- `packages/test-fixture/oxlint-no-restricted-syntax/data/no-low-information-symbol-description.fail.txt`
- `packages/test-fixture/oxlint-no-restricted-syntax/data/no-low-information-symbol-description.borderline.txt`
- `packages/test-fixture/oxlint-no-restricted-syntax/data/no-low-information-symbol-description.benchmark.html`

## Current dataset state

The pass dataset has 145 descriptions.
The fail dataset has 217 descriptions.
The borderline dataset has 2 descriptions.
The current benchmark page embeds 362 pass/fail rows.

The user added short pass examples, then asked for more low-character pass cases. The pass file now includes examples such as:

- `File absent: eaten by cat`
- `zero things to average by`
- `github token expired`
- `editor IS IntelliJ Idea`
- `editor IS Zed`
- `not built by Vite`

## Constraint learned

Do not hardcode broad word lists such as `stopWords` or `specificWords`. The user called that cheating.

Do not run compression non-discriminatively. Compression may only run after a structural signal indicates a redundancy check is relevant.

Adversarial fail rows were added after the classifier first reached zero errors:

- `VALUE IS MISSING`
- `STATE IS UNKNOWN`
- `NO STATIC METHOD NAME`
- `value missing because value missing`
- `file absent because file absent`

Repo-existing all-uppercase symbol descriptions added as definite fail rows:

- `NO_CHURN`
- `NO_DEEPEN`
- `NO_HOST_COMMITS`
- `NO_LAST_PAGE`
- `NO_ORIGIN`
- `NO_REFS`
- `NO_STORAGE`
- `NO_TREE0`
- `NOT_FOUND`
- `UNMEASURED`

User-labeled repo-existing descriptions added as fail rows:

- `wrapper-succeeded`
- `unparseable-timestamp`
- `shared`
- `realpath-absent`
- `realpath-unavailable`
- `runWithContext`
- `package-unavailable`
- `outside-string`
- `outside-worktree`
- `no-verdict`
- `no-tool-call`
- `no-partial`
- `no-node-fs`
- `no nested script`
- `kv-store/absent`
- `invalidValue`
- `invalid-input`
- `flag-unset`
- `hash-oversized`
- `css-absent`
- `chip-not-found`

User-labeled repo-existing description added as a pass row:

- `unparseable-iso8601-timestamp`

Borderline descriptions removed from fail rows and persisted in the new borderline file:

- `no-static-method-name`
- `NO STATIC METHOD NAME`

## Classifier now embedded in the benchmark

The benchmark HTML now uses a classifier that reaches 0 misclassifications without broad word lists or non-discriminative compression.

Classifier shape:

1. Split words by non-alphanumeric separators plus camel and acronym boundaries.
2. Treat `/` or `:` as namespace separators only when the prefix before the separator has no spaces.
   This keeps `penpot:skip` namespaced, but does not treat `File absent: eaten by cat` as namespaced.
3. Fail descriptions with fewer than 3 words or fewer than 3 distinct words.
4. Fail repeated meaningful words, ignoring words of length 2 or less and words that came from the namespace prefix.
   If the description contains `because`, compare meaningful words on both sides of `because` and fail only when both sides repeat the same phrase.
5. Fail all-uppercase phrases, because capitalization alone is not specificity.
6. Fail bare camelCase identifiers with three or more words.
7. Fail namespaced descriptions whose tail has fewer than 3 words.
8. Fail non-namespaced descriptions that start with `no` or `not` unless they have a specificity marker.
9. Fail non-namespaced 3-word descriptions without a specificity marker and without an `ed` or `ing` ending on the third word.
10. Otherwise pass.

Specificity marker is structural, not vocabulary-based:

- any uppercase letter,
- any digit,
- dot or underscore,
- any word of length at least 4 with no vowel.

Compression is not run in the current classifier because the structural classifier already reaches zero errors.
If compression is added later, run it only inside a narrow ambiguity branch such as repeated meaningful words.

## Verification already run

A browser verification loaded the benchmark HTML through `agent-browser` at its local `file://` URL.
The rendered page reported:

- pass count: 145,
- fail count: 217,
- classifier errors: 0,
- classifier summary: `Classifier gives 0 total errors, 0 false-failed pass descriptions, and 0 missed fail descriptions.`,
- classifier mismatch table: `No classifier mismatches.`,
- dataset rows: 362.

`agent-browser errors` and `agent-browser console` returned no output after verification.

## Plan state

The implementation plan at `/var/home/user/.claude/plans/implement-this-oxlint-rule-dynamic-torvalds.md` has been
refined to replace the obsolete Shannon-entropy and compression-first approach with the current structural classifier.
It now calls out the pass, fail, and borderline data files, the repo-remediation step before enabling the rule as an
error, and the requirement to test against the `.txt` datasets.

## Next steps

1. If implementing the oxlint rule, port this classifier carefully without broad hardcoded word lists and without global compression.
2. Use the refined plan as the execution checklist.

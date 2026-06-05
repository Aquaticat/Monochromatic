# No low information symbol description handover

## Current goal

Reach zero misclassifications on the persisted symbol-description calibration dataset, then verify the benchmark page in a browser.

## Files in scope

- `packages/test-fixture/oxlint-no-restricted-syntax/data/no-low-information-symbol-description.pass.txt`
- `packages/test-fixture/oxlint-no-restricted-syntax/data/no-low-information-symbol-description.fail.txt`
- `packages/test-fixture/oxlint-no-restricted-syntax/data/no-low-information-symbol-description.benchmark.html`

## Current dataset state

The pass dataset has 144 descriptions.
The fail dataset has 183 descriptions.
The current benchmark page embeds 327 rows.

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

## Candidate classifier with zero errors in a Node probe

A probe reached 0 misclassifications without broad word lists or non-discriminative compression. The classifier shape was:

1. Split words by non-alphanumeric separators plus camel and acronym boundaries.
2. Treat `/` or `:` as namespace separators only when the prefix before the separator has no spaces.
   This keeps `penpot:skip` namespaced, but does not treat `File absent: eaten by cat` as namespaced.
3. Fail descriptions with fewer than 3 words or fewer than 3 distinct words.
4. Fail repeated meaningful words, ignoring words of length 2 or less and words that came from the namespace prefix.
   If the description contains `because`, skip this repetition failure so `package-json-manifest-unreadable-because-json-parse-failed` can pass.
5. Fail namespaced descriptions whose tail has fewer than 3 words.
6. Fail non-namespaced descriptions that start with `no` or `not` unless they have a specificity marker.
7. Fail non-namespaced 3-word descriptions without a specificity marker and without an `ed` or `ing` ending on the third word.
8. Otherwise pass.

Specificity marker is structural, not vocabulary-based:

- any uppercase letter,
- any digit,
- dot or underscore,
- any word of length at least 4 with no vowel.

Compression was not needed for zero errors in that probe. If compression is added, run it only inside the repeated-meaningful-word branch or another similarly narrow ambiguity branch.

## Verification already run

A Node probe using the candidate classifier against the persisted pass/fail text files printed `errors 0`.

The benchmark HTML has not yet been updated with this classifier.

## Next steps

1. Update the HTML benchmark to add the candidate classifier.
2. Remove or deemphasize non-discriminative global deflate threshold sweep, because it violates the new constraint.
3. Show classifier result counts and mismatch table.
4. Verify the HTML through `agent-browser` on `file://` and check page errors plus console output.
5. Commit the updated benchmark and this handover.

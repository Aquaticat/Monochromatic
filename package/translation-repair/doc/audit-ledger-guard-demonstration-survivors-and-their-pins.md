# Audit ledger: survivors of the guard demonstrations and the tests that pin them

Paths in this record are the layout after 2026-10-18,
under `package/translation-repair`.

The mutations of the guards of four rounds that every test passed (B674),
and the test round that closed the reachable ones.
B674 is filed in
[Audit ledger: test cases that cannot fail](audit-ledger-test-cases-that-cannot-fail.md),
with the three survivors that change what the code does.
The unreachable branches the same round met are B683,
filed in
[Audit ledger: branches no input reaches, kept as quiet answers](audit-ledger-unreachable-branches-kept-as-quiet-answers.md).

Written on 2026-10-19 (UTC) from the notes of the test round (`s245/w188-notes.md`).
The hashes here are those on the branch.
The notes give the hashes of the round's own worktree,
which is detached at `95a57f628d`.

Part of [Audit ledger](audit-ledger.md),
which lists every file of this record.

## B684: the test round that pinned the reachable survivors of the guard demonstrations

Run on 2026-10-18 (UTC),
after the demonstrations of n168,
n169,
n171 and n173 left 64 of 287 mutations passing every test (B674).

Outcome written on 2026-10-19 (UTC).
The round changed tests only,
and no production file.
It landed as 15 commits,
`4df68c685e` to `58b9d98583`,
in the seven packages `consistency`,
`corpus-pass`,
`provider`,
`stage`,
`provider-stream`,
`typography` and `artifact`.

Method:
each survivor was proved the same way.
The test was committed first.
Then the mutation of the demonstration's spec was applied
(or an equivalent by content,
where the file had moved),
the package and any consumer rebuilt,
and the named test run and required to show a `[FAIL]` line naming the new test.
Then the file was restored with `git checkout -- <file>`,
rebuilt,
and `git status --short` checked empty.
The proofs are kept outside the repository,
in six logs of the round's scratch folder.

The commits,
by what each pins:

- `4df68c685e`,
  consistency:
  the whole-number,
  once-counted and twice-shown readings of a label.
- `5a0fc8d58e`,
  consistency:
  the definitions of the final edge test,
  and the apostrophes of a slot.
- `b8b1f2eb01`,
  consistency:
  the label order,
  the word run past links,
  and the hidden stretches of a fold.
- `f6b787eac0` and `3b18ef4de5`,
  consistency:
  the tie-break of equal-length candidates,
  the mark before a match,
  and the longest reason.
  The second replaces the fixture of the first (M268).
- `197f5f3d50`,
  consistency:
  a slot is read in a span alone,
  with no definitions of its own.
- `fe70efbec5`,
  corpus-pass:
  the run-off key,
  stage,
  counts,
  log lines and findings of the carry choice.
- `36a887e41b`,
  corpus-pass:
  the page definitions on the English and block sides,
  and the worked page.
- `39dd48f4c2`,
  provider:
  the kind and cause of a refusal-shaped re-ask failure.
- `41dfc43d1f`,
  stage:
  the bound on the opening of the re-ask reply in the lost-voice line.
- `e6d073dead`,
  provider-stream:
  the counted characters on the cut that a drain throws and a transport masks.
- `4f1548ddd3`,
  typography:
  the whole-number clause of the landing error message.
- `5a0fe85281`,
  artifact:
  the run-off recount checks one at a time,
  and the reader of an unlocated reason.
  Its body says six guards for the nine mutations it pins (M267).
- `ce66f2cb07` and `58b9d98583`:
  type fixes in the new tests of consistency,
  and type fixes with a loop `await` in the run-off and page definitions tests of corpus-pass.
  `lint:types` and `lint` found them after the pins,
  and the affected proofs were run again.

The three survivors that change behaviour:
the decision of the round is that the current behaviour is right in the code and wrong in the mutation,
so the tests pin the code,
and no guard is disputed.
The evidence is the TSDoc and header comments named here,
and the dated ruling of 2026-10-15 in the header of `consistency-label-form.ts`.
The notes searched the package ledger and found no text on the slot apostrophes
and only the fold's own sentences on the final edges,
so the ledger neither supports nor contradicts these three.

- `n169-locate-shown-definitions`:
  "CUTS THE FINAL EDGE BY THE REFERENCES THE PAGE DEFINES" in `consistency-fold.unit.test.ts` (`5a0fc8d58e`).
  The TSDoc of `locateWords` and the fold header say that the word test runs again on the final edges,
  reading the text a reader sees,
  which needs the page definitions.
  The mutation drops them at that call.
- `n171-B639-lf-last-digit`:
  "FINDS A LABEL BY THE WHOLE NUMBER IT ENDS IN" in `consistency-label-form.unit.test.ts` (`4df68c685e`),
  where `12` names `OCCURRENCE 12` and not the label that ends in `1`.
  The file header says that a name may be "only the number the label ends in",
  and `trailingNumberOf` is documented as the ASCII digits a label ends in.
- `n171-slot-apostrophes`:
  "GIVES THE SLOT AT ITS WORDS ALONE" in `consistency-slot-in-span.unit.test.ts` (`5a0fc8d58e`).
  The slot is a part of the located span,
  which already holds the apostrophes of the located words,
  and `locateWords` is called with `apostrophes: 'outside'` for it.

The other pinned survivors,
each shown to fail under its mutation:

- Reading order and joints:
  `n168-B638-nested` (the children of a nested node in the order a reader sees them),
  `n169-G2-runs-on-after` and `n169-G2-runs-back-before` (`cutsWord` with a stand inside a word,
  in `consistency-word-joints.unit.test.ts`),
  and `n169-fl-closing-first-after-last`,
  `n173-fl-first-after-last` and `n173-fl-no-unit`
  (folds built by hand with swapped and missing units,
  in `consistency-folded-links.unit.test.ts`).
- Labels:
  `n171-B639-lf-no-dedupe` and `n171-B639-lf-dedupe-both`
  (one label counted once when a name reaches it by its form and by its number,
  and a label the sheet showed twice counted as one;
  at unit level,
  since production sheets never trigger them).
- Span agreement:
  `n171-B645-mark-before` (words refused when a combining mark stands directly before them),
  `n171-B642-no-tie-break`,
  `n171-B645-utf16-tie-break` and `n171-B642-count-reason-from-shortest`.
- A slot read in a span alone:
  `n173-slot-reader-invents-definitions`.
  The mutation site is `slotInSpan`,
  which the recorded-slot reader of the artifact reaches through `asLocatedBySpan`,
  and the existing artifact test `n173-slot-reader-handed-page` is the reader's own pin.
- The carry choice and its run-off:
  `n171-B639-carry-ask-format`,
  `n171-B641-carry-ask-stage` and `n171-B641-carry-ask-key`,
  and `n171-B641-choose-count-all`,
  `-first-quorum`,
  `-log-quorum`,
  `-log-usable`,
  `-log-ending`,
  `-log-tie`,
  `-own-key`,
  `-record-quorum`,
  `-findings` and `n171-B641-finalists-below-quorum-asks`.
  The log lines are pinned exactly through the resumed-cache technique:
  run `choose` once,
  keep `scene.persisted`,
  edit the stored records by hand,
  and run again with `resumed`.
- Page definitions:
  `n173-al-english-side`,
  `n173-aw-page` and `n173-cc-block-side`.
- The re-ask and the drain:
  `n171-B640-reask-cause` and `n171-B640-reask-kind`,
  `n171-B640-stage-call-raw-unbounded`,
  `n171-B643-drain-passes-counts` and `n171-B643-transport-passes-counts`,
  and `n171-fle-message`.
- The run-off recount of the artifact:
  `n171-B641-recount-run-off-beside-majority`
  (the weak `includes('cat.carries[0].runOff')` assertions now assert the exact refusal text),
  `n171-B641-recount-quorum`,
  `n171-B641-recount-all-labels`,
  and the two checks that shadowed each other,
  `n171-B641-recount-finalists-count-redo` and `-labels-redo`.
  One fixture has finalists longer than the leaders,
  and only the count check refuses it.
  Another has the same count and other labels,
  and only the label check refuses it.
  Each mutation fails alone,
  in separate proofs.
- The reader of a reason:
  `n171-B642-reader-old-reading`,
  `-candidates-only`,
  `-any-span` and `-readable` (`artifact-two-lane-read-consistency-span.ts`).
  The second fixture uses a lone variation selector (U+FE0F) twice,
  which folds to something and yet `rendersAsNothing` is true.

Equivalent survivors,
with the reason the probes of the demonstration gave and no input found to tell the mutant from the code:

- `n168-f-gate`:
  the closing-bracket gate only skips a parse that finds no link in such a text,
  so the output never differs (0 of 21,870 probe rows).
- `n169-W8-apostrophe-before-stand`:
  the backward joint reading and the shown-word test answer the same rows,
  so the step over empty links in `apostropheJoinsAt` is shadowed (dead by shadowing,
  kept).
- `n171-B639-lf-shown-duplicates`:
  the final `Set` in `shownLabelOf` removes only duplicates that the first `Set` of that function already removes,
  so with it standing nothing differs.
  The pair is pinned through `n171-B639-lf-dedupe-both`.
  This describes the code as it stood before B679.
- `n171-B639-lf-isNumber`:
  `byNumber` holds digit strings only,
  so a name that is not all digits never matches in it.
- `n171-B639-lf-no-trailing-digits`:
  the empty number key is looked up only for an all-digit name,
  which cannot be empty.
- `n171-B640-bench-decide-kind`:
  only an asked verdict can hold a `runOff`,
  so the kind test restates the type (a dead guard,
  kept).
- `n171-B641-finalists-kind-test`:
  a counted choice has no `reason` field,
  so the reason test already excludes it (a dead guard,
  kept).
- `n171-B641-tied-majority-kept`:
  a label with a strict majority leaves no second label with the top count,
  so the lone-leader rule already returns none (a dead guard,
  kept).
- `n171-slot-blank`:
  words that fold to nothing are refused by later checks of `slotInSpan` (0 differences over 15 spans and slots).
- `n171-slot-once`:
  a slot standing twice makes the locator answer many,
  the slice becomes the whole span,
  and the all-of-the-span check refuses it.
- `n173-count-page-offset`:
  the moved offset reaches `slotInSpan`,
  whose `locateWords` call passes `apostrophes: 'outside'`,
  and `page.offset` is read only when proven apostrophes are taken in.
  It is equivalent today,
  and becomes live if that call ever switches proven apostrophes on.

Branches that cannot be reached:
four silently fell back to an empty list and none threw a named invariant error,
which the notes call a finding.
They are B683.

Not pinned:

- `n171-gl-number-passed`:
  the group number in the error text of the pass is unreachable through the pass,
  because no test makes the pass throw from the group line,
  and the error class and text are not exported for a unit test.
- `n169-LT-quadratic`:
  a work count (each link taken out rewrites the whole pending run),
  and the thousand-link test pins the result and not the work,
  so no assertion on output can fail.
  It is unpinned by design.

State at the end of the round:
`build`,
`lint:types`,
`lint` and `test:unit` exit 0 for all seven packages with no `[FAIL]` line,
and `git status --short` was empty.
Ported onto the branch of generation 19,
the round had four conflicts,
all of one kind,
each side having added whole tests at the same place of a test file,
and both sides were kept.
The `test:unit` task of the seven packages then had no `[FAIL]` line,
and the `source-scan` task,
which the round had not run,
found two problems in its tests (M266).

Recurrence:
`mistake-prevention-guards-searches-and-claims.md`,
"Guards that cannot fail".

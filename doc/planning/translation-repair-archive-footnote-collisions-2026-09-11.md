# Archive footnote collisions in writer preparation

## Task and boundary

Task 39 blocks task 38's prepared writer inputs.
The corpus remains pinned at `a41fc607ea5a70d8a7625cc67d5ed8c444f53379` and read-only.
No paid preparation or writer generation has run for the new plan.
No corpus passages or edits belong in this repository.

The existing policy is recorded in the translation package README's nineteenth-class account:
archive labels follow the original before lanes run,
references and definition openers move together,
and changed target text is prepared again.
The [archive-original decision][original] additionally protects sealed English-original spans byte for byte.

## Measured collision

The selected `Y1Ran` input has source labels `1` and `2`,
and archive labels `1`,
`2` and `3`.
A manually source-reviewed definition correspondence maps archive `2` to source `1`
and archive `3` to source `2`.
The additional archive definition at `1` remains unpaired.

Frozen `97599f638` returns:

```text
kind: open
the map lands on [^1] which the archive carries and the map does not move
(1 archive labels and 0 original labels unaccounted for)
```

The two-note permutation positive control closes successfully.
Evidence is `footnote-pool-closure.json` in the owned writer workspace
and `~/temp/agent/writer-pool-footnote-closure-20260911.out`.
These manually reviewed correspondences are mechanism controls,
not acquired model evidence or calibration approval.

## Direction

Use deterministic displacement of colliding unmapped archive labels into unused labels.
This is an operational rename,
not a new source correspondence.
For the measured input,
the intended composition is:

- Correspondence `2` to `1`.
- Correspondence `3` to `2`.
- Collision avoidance `1` to fresh label `4`.

Fresh labels must be absent from both normalized identifier universes.
Preserve every reference,
definition and note body.
No archive prose repair,
extra writer round or per-entry exception is authorized by this operation.

Displacement is allowed only after all source labels have correspondence evidence
or the existing forced elimination.
If source correspondence is incomplete,
keep a colliding map open rather than closing it with displacement.
Existing collision-free partial rewrites remain operationally valid without claiming complete correspondence.
Identity correspondences must not be guessed from equal label spelling:
the old `mapLabels` filtered identity moves out.
Complete correspondence evidence now remains distinguishable from the rewrite map.

Independent review supports this ownership split:
closure owns the validated composed map and typed provenance;
the application/pass boundary owns syntactic rewriting,
definition order,
graph preservation and protected-byte checks.

## Syntax safety findings

A provider-free probe on frozen `895843508` found additional deciding behavior:

- `applyFootnoteRelabel` scans the complete raw document.
  It rewrites matching strings inside front matter,
  inline code,
  fenced code,
  escaped literals,
  HTML comments,
  ordinary link destinations and JSX attributes.
- Case-equivalent references `Note` and `note` remain unchanged when a map only names definition spelling `NOTE`.
- An escaped closing bracket in a valid footnote identifier is truncated by the raw scanner.
- The document graph counts an escaped literal opening as a reference.
- Space-containing examples in this probe are ordinary text,
  not GFM footnote nodes.
- The parsed tree distinguishes normalized identifiers,
  decoded labels and exact source offsets.
  Rewriting must not derive a raw span length from a normalized or decoded label.

Evidence:
`footnote-syntax-probe.json` in the owned workspace and
`~/temp/agent/writer-footnote-syntax-probe-20260911.out`.
The fixtures are invented.
These observations are about this package's scanner/application composition,
not an upstream parser defect.

## Required implementation proof

- Keep supplied correspondence,
  elimination-derived correspondence,
  collision-avoidance moves and the composed rewrite map separate.
- Validate normalized membership,
  injectivity and final closure.
- Choose unused positive decimal labels deterministically without numeric-overflow assumptions.
- Rewrite simultaneously so swaps and displacement cannot cascade.
- Use syntax-positioned markers,
  not a whole-document substring replacement.
- Keep escaped literals,
  code,
  comments,
  front matter,
  link destinations and JSX attribute strings untouched.
- Retain unmatched definitions once in their existing relative order after source-ordered definitions.
- Compare reference/definition structure under the rename;
  never merge labels or introduce lost/unresolved links.
- If any relabel or reorder would change a protected English-original span,
  withhold the whole change and return the original archive with an explicit finding.
- Reparse after changes before using offsets,
  containers,
  hashes,
  pairings or a reviewed-plan digest.
- Verify the actual pinned `Y1Ran` consumer composition,
  existing permutations and no-op behavior,
  multiple colliders,
  incomplete source evidence,
  normalization-equivalent and escaped identifiers,
  invalid destinations,
  protected references/definitions,
  and guard removal.

## Current state

The mathematical closure layer is implemented through `81da9c055`.
It validates normalized membership and injectivity,
keeps supplied relations,
forced non-identity elimination and retained-label displacement separate,
and refuses displacement while any original remains unaccounted for.
The first eight retention regressions failed on the old implementation and pass on the new core.
Existing no-op closures do not invent identity correspondence.
Through `b3b6ee29c`,
the readers retain complete correspondence evidence,
and active marker inventories use strict MDX grammar with offset-preserving comment and invisible-line masks.
The rewrite validates destination grammar and whole-namespace injectivity,
copies non-marker bytes unchanged,
and checks the reparsed marker-role and identifier sequence.
The original-English guard anchors both sealed text and its declaring comment by position.
A rename or reorder touching either withholds the entire operation.
After an allowed rename,
protected offsets are derived again from the changed text.

Definition movement now preserves each distinct separator once,
compares normalized label ranks,
withholds changes across non-blank gaps or shared container delimiters,
and checks actual reparsed definition-block text against every copied block.
The public pass helper records supplied correspondence,
forced elimination and archive-only retention separately,
and records structured refusal instead of reporting withheld operations as applied.

The additional movement regressions exposed the old first-gap duplication,
comment relocation,
case-sensitive ordering and split-container behavior.
The malformed-JSX control also showed that `parseSliceBody`'s lone-tag mask was unsuitable for whole-document edits.
The marker inventory now requires document grammar;
the attempted `parseSliceBody.parsedText` API extension was removed.
Strictly parsed structural-fragment compatibility remains part of the full-suite and consumer review.

Build and type checks pass through `b3b6ee29c`.
Scoped retention,
correspondence,
syntax,
protection,
definition-order and existing relabel tests pass.
Logs are `footnote-{correspondence,syntax,protection}-{build,types,green}-20260911.out`
in `~/temp/agent`.
The source tree recorded as `75b769026` also passed the full unit process,
with `footnote-full-unit-20260911.out` ending at line 9253.
That direct invocation did not append a separate `unit exit 0` marker;
final wrapper-based verification remains required.
The second formatter run reported zero warnings and errors before the latest boundary test additions.
Final lint and individual guard-removal proof remain incomplete.
The first implementation-review Advisor call timed out.
A later review identified prepared-fragment parsing,
stale rewrite domains and real pass/cache integration as remaining boundaries.
These findings supersede any inference that the initial guard catalog covered the complete operation.
This is not a release-ready or calibration-approved checkpoint.

The source trace currently covers:

- `package/module/translation-repair/src/archive-footnote-closure.ts`.
- `package/module/translation-repair/src/archive-footnote-relabel.ts`.
- `package/module/translation-repair/src/archive-footnote-order.ts`.
- `package/module/translation-repair/src/corpus-run/pass-footnote-relabel.ts`.
- `package/module/translation-repair/src/footnote-graph.ts`.
- `package/module/translation-repair/src/footnote-identifier.ts`.

The actual pinned `Y1Ran` consumer control passed on frozen `.frozen-dist-b3b6ee29c`,
digest `sha256-tree-v1:7612f144d20cc33ccd9a0263801a50725401bca1ebb2e493785d9edc52cfa96f`.
It retained all three references and definitions,
with final definition labels `1`,
`2` and `4`,
and no footnote findings before or after.
Front matter remained identical;
all 45 target nodes appeared once across 23 fresh prepared slices with current ranges.
It exercised `translateSliceInput`,
compiled the masked MDX body without execution,
and proved a repeat operation is a no-op.
The configured no-network container used 2 GiB RAM,
2 CPUs and 512 PIDs.
The driver recorded zero fetch calls and 194 ms elapsed.
Evidence is `footnote-consumer-control.json` in the owned workspace
and `~/temp/agent/footnote-Y1-consumer-r3-20260911.out`.
Earlier harness attempts had a compiler import-resolution error and an incorrect assumption about
`PreparedDocumentPair` fields;
`targetText` and parsed nodes replaced the nonexistent `target` property.
No corpus bytes were modified.

At `2ce03f9a1`,
individual removal of 22 registered guards rebuilt successfully and failed at the intended normal assertion.
Restored source rebuilt and all registered tests passed.
The measured memory peak was 726011904 bytes,
with no OOM or PID-limit events.
The complete intermediate proof is retained in `~/temp/agent/footnote-guard-proof-20260911`.
The owned worktree `~/temp/agent/translation-repair-footnote-guard-20260911` still exists,
restored to its source baseline;
it was created from main at `f78921f15` with the single committed `2ce03f9a1` test overlay.
No source from the development worktree was mutated by the experiment.

The independent review correctly identified another real input boundary:
a default-budget prepared container can yield a marker-bearing fragment with an unmatched container half.
The actual forty-paragraph fixture produced a marker slice at offsets 0 to 450 and the old reader threw `syntax`.
The hypothesis that the lexical length bound diverged on astral characters was not supported.
Actual parser controls accept 999 UTF-16 units,
including mixed astral/ASCII and escaped-bracket cases,
and reject 1000;
NFC and NFD identifiers remain distinct.
Evidence is `footnote-review-probe-r2-20260911.out` and the committed Unicode tests.

Red tests in `e305de648` demonstrated the prepared-fragment failure,
stale source/target slice inputs and missing map domains.
Through `9196cb780`,
changing map keys must occur in the current active namespace,
and `footnoteRelabelOf` takes complete `sourceText`,
`targetText` and slices.
It projects whole-document reference markers into checked current ranges instead of reparsing fragments.
`sliceFootnoteLabels` checks integer bounds,
exact text and whole-marker containment;
it uses a binary search followed by the intersecting marker run.
The pass caller and existing tests now pass complete document context.
Build,
types and the review regressions pass in `footnote-review-{build,types,green}-20260911.out`.

The next step is the actual `preparePassEntry` cold/warm cache and re-preparation test,
additional syntax/compound-operation controls,
updated removal proof,
current-runtime consumer verification,
independent re-review and final wrapper-based verification.
The initial `Y1Ran` control manually called deterministic preparation after the operation;
it did not prove the actual pass caller's cache lifecycle.
The first formatter run (`proc_d6ff`) completed with `no-nullish-union`
on the lexical no-marker return and `max-statements-per-line` on a lookup callback.
The scanner now uses a domain-specific `NO_GFM_MARKER` sentinel,
and the callback is split onto statement lines.
The package diff contains only task-owned footnote paths;
unrelated `mise.lock` drift remains untouched.
The second formatter run passed.
A final lint check remains required after the latest boundary tests.
Only mocked or provider-free work has run.
The latest fully checked translation runtime remains `.frozen-dist-895843508`,
digest `sha256-tree-v1:56d8d472b1a526faef861068d41e224c3640457b18ef0802a58b50992d18273c`.

[original]: ../decision/translation-repair-archive-original.md

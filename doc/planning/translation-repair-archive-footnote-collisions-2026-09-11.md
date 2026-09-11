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
keep the map open.
Identity correspondences must not be guessed from equal label spelling:
`mapLabels` currently filters identity moves out,
so complete correspondence evidence needs to remain distinguishable from the rewrite map.

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

No footnote implementation has changed yet.
The source trace currently covers:

- `package/module/translation-repair/src/archive-footnote-closure.ts`.
- `package/module/translation-repair/src/archive-footnote-relabel.ts`.
- `package/module/translation-repair/src/archive-footnote-order.ts`.
- `package/module/translation-repair/src/corpus-run/pass-footnote-relabel.ts`.
- `package/module/translation-repair/src/footnote-graph.ts`.
- `package/module/translation-repair/src/footnote-identifier.ts`.

The next step is a regression for collision closure with retained-note provenance,
then syntax-aware application and protected-byte integration.
The current checked translation runtime is `.frozen-dist-895843508`,
digest `sha256-tree-v1:56d8d472b1a526faef861068d41e224c3640457b18ef0802a58b50992d18273c`.

[original]: ../decision/translation-repair-archive-original.md

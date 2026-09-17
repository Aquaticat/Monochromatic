# meow parses HCL with a patched `hcl-edit` under its own evaluator

## Status

Accepted 2026-09-17,
after the brief from
[`doc/planning/monorepo-manager-route-research/hcl-tooling.md`](../planning/monorepo-manager-route-research/hcl-tooling.md):
the user chose "Patched `hcl-edit`" for the front end
and "Allow,
mark evaluations uncacheable for stuff that used them,
and warn user with detailed messages."
 for functions with unpredictable results.
Every decision here applies to meow 0.x only (user,
 2026-09-17).
Vets:
[`tech-meow-hcl-front-end-vet-2026-09-17.md`](../audit/tech-meow-hcl-front-end-vet-2026-09-17.md)
and
[`tech-meow-language-server-framework-vet-2026-09-17.md`](../audit/tech-meow-language-server-framework-vet-2026-09-17.md).
Design:
"HCL tooling" in
[`doc/planning/monorepo-manager-from-scratch-design.md`](../planning/monorepo-manager-from-scratch-design.md).

Not decided here,
still with the user:
naming for meow-only functions,
the diagnostic renderer,
and acceptance of the formatter and language server recommendations.

## Context

- The configuration syntax is OpenTofu-shaped HCL,
   accepted the same day
   ([`monorepo-manager-all-rust.md`](monorepo-manager-all-rust.md)).
- Managed edits must preserve comments,
   which makes write-back fidelity a decision-level property.
- Measured on a 2,246-file corpus against the Go reference:
   `hcl-edit` 0.9.7 accepted and rejected exactly what the reference did,
   and round-tripped 2,153 of 2,185 valid files byte for byte.
- The 32 differences reduce to two defects,
   each root-caused and prototype-fixed with the upstream suite green:
   comments lost inside binary operations,
   and `<<-` heredoc introducer and body indentation rewritten.
- `hcl-rs` 0.19.8's evaluator diverged from the reference on 12 of 21 cases
   and reports errors without spans.

## Decision

- meow depends on `hcl-edit` 0.9.7 and carries the two prototype patches until upstream releases fixes.
- meow writes its own evaluator over that tree,
   using its byte spans for diagnostics.
- `timestamp`,
   `uuid`,
   and `bcrypt` exist with OpenTofu's names.
  An evaluation that calls one is recorded as uncacheable.
- Such an evaluation produces a diagnostic naming the function called,
   the block it was called from,
   and the caching it disabled,
   per rules `DGT` and `DNL`.

## Consequences

- Every `hcl-edit` release must be re-patched and re-measured;
   the round-trip probe over the corpus is the regression test and ran in 0.255 seconds.
- `hcl-edit` aborts the process at nesting depth 5,000 with no knob,
   so meow pre-scans nesting depth before parsing.
- `hcl-edit` has no error recovery,
   which limits the language server on a file in mid-edit.
- Uncacheable evaluations re-run every time,
   so a configuration that calls these functions loses caching for that evaluation until the call is removed.
- The two `hcl-edit` defects and the `hcl-rs` divergences are tracked for the user to file upstream.

## Rejected

- meow's own lexer and parser:
   the reference parser is 17,459 lines of Go with 20,670 lines of tests,
   and `hcl-edit` is already proven exact against it,
   so this spends the first effort re-proving a solved part.
- Unpatched `hcl-edit`:
   32 of 2,185 corpus files lose comments or heredoc markers,
   against the settled comment-preservation requirement.
- `hcl-rs` as published,
   forked,
   or as an evaluator source:
   wrong arithmetic,
   insertion-order object iteration,
   a panic on `5 % 0`,
   and no spans.
- `tree-sitter-hcl`:
   reported no error node on 5 invalid corpus files.
- Forbidding functions with unpredictable results,
   or allowing them only in `task` and `check` blocks:
   the user chose uncacheable evaluations with warnings instead.

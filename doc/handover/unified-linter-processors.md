# Unified-linter processor handoff

## Purpose and scope

Implement the processor contract in `../planning/unified-linter.md`.
Ownership is restricted to new native processor modules and fixtures,
module registration,
package verification tasks,
and this handoff.
Existing rule implementations,
configuration,
manifests,
scanner code,
and the fuzz sidecar remain untouched.

## Interface design

The processor module is a deep module at the orchestration seam.
It owns extraction,
doctest preparation,
composed source maps,
and grouped fix projection.
Callers select configuration using virtual names,
then receive original-host diagnostics and fixes.
Immutable mapping layers retain exact parent snapshots.
Projection verifies that reparsing the changed container extracts the intended virtual bytes.
Unsupported mappings fail explicitly,
not as a clean result or a partial fix.

Virtual Rust has no Cargo semantic context supplied by this interface.
Selecting full explicit-type checking must yield an explicit processing failure.
No method-name heuristic or guessed resolution is permitted.

## Work queue

- Implement native fence and authored Rustdoc extraction.
- Implement doctest preparation and composed original-host mapping.
- Implement syntax-only checking without synthetic-main findings or counts.
- Verify grouped edits,
delimiter guards,
Unicode,
newline spellings,
and bounded nesting.
- Run bounded container tests,
Clippy,
mutation controls,
and processor fuzz controls.
- Render-check this document and record commits,
source snapshot,
commands,
results,
limitations,
and executable integration steps.

## Initial evidence

Read the processor section at `doc/planning/unified-linter.md:111`.
Read native source,
position,
diagnostic,
edit,
fix-loop,
configuration lookup/matching,
and Rust execution modules before choosing the interface.
The pre-existing worktree has concurrent modifications in rule modules,
`fix_loop.rs`,
its tests,
`lib.rs` module ordering,
and the fuzz sidecar.
These are not processor work and must not be restored or staged.

## Next action

Implement the native extraction and mapping modules.

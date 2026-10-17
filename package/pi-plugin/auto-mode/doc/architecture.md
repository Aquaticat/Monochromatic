# Auto-mode architecture

Auto-mode owns review of a complete prepared Pi tool group before any member executes.
Its permission decision uses selected readable instructions and visible conversation,
locally parsed operation structure,
the existing Luna Decisions model,
and scoped human confirmation when automatic review cannot resolve the operation.

## Refactor status

The user authorized consolidation and package-local justification on 2026-10-17.
The refactor preserves the installed native host's behavior and removes the superseded extension pipeline.
The source inventory and dependency graph are retained privately under
`${HOME}/temp/agent/pi-mimo-lint-approval-20261017`.

The initial tracked inventory contains 881 files.
The native policy entry reaches 64 local source modules;
the old extension entry additionally reaches 33 modules absent from that native graph.
The native integration entry graph reaches 237 modules,
excluding imports generated during the build.
Those graph counts include type imports and are a source-maintenance inventory,
not a claim about loaded runtime code or dead native code.

The package occupies 7,354,649,993 apparent bytes at the initial measurement.
The diagnostic directory accounts for 7,089,712,671 bytes in 12,728 files;
retained build output accounts for 258,159,664 bytes.
Source and native trees account for 2,265,351 and 2,025,723 bytes respectively.
These independent contributors require independent remedies.

## Major modules and their required justification

- Host integration connects the qualified Pi session,
  complete-group dispatch,
  extension tools,
  and session disposal.
- Instruction collection preserves readable source identity,
  selected excerpts,
  relevance refresh,
  and freshness across asynchronous callbacks.
- Operation preparation preserves original tool identity,
  complete arguments,
  group membership,
  parsed shell structure,
  and actual execution order.
- Decision review owns Luna question binding,
  model attribution,
  categorical admission,
  instruction interpretation,
  and operation outcomes.
- Confirmation owns exact-group Allow and Stop,
  headless withholding,
  cancellation,
  and explicit session bypass.
- Build lifecycle owns qualified upstream source,
  generated transformations,
  immutable release publication,
  and executable resolution.
- Diagnostics preserve the source,
  operation,
  scores,
  routing reasons,
  and failures needed to reconstruct a decision.

Each retained major module receives a package-local document covering its callers,
interface,
invariants,
alternatives,
and executable verification.
An existing implementation is evidence of a responsibility,
not sufficient justification for its current decomposition.

## Work remaining

- Remove the superseded extension pipeline and its exclusive tests and exports.
- Consolidate retained implementations around the major module interfaces.
- Complete the individual module justifications and link their verification tasks.
- Reduce build duplication while retaining stable module paths for running sessions.
- Address accumulated diagnostics without discarding investigation evidence.
- Measure the resulting source graph and generated footprint.
- Finish both reported approval reproductions and installed-consumer controls.

The root `TCV` rule remains unchanged by the user's explicit decision.
Request-payload verification belongs in
[review input verification](../native/review-input-verification.md).

# Auto-mode architecture

Auto-mode owns review of a complete prepared Pi tool group before any member executes.
Its permission decision uses selected readable instructions and visible conversation,
locally parsed operation structure,
the existing Luna Decisions model,
and scoped human confirmation when automatic review cannot resolve the operation.

## Refactor status

The user rejects the initial consolidation as insufficient for implementation maintainability.
The [compact prepared-group design](compact-review-design.md) records the deeper replacement now being implemented.
The measurements and module documents in this index describe the current baseline until that replacement is verified.

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

- [Host integration](host-integration.md) connects the qualified Pi session,
  complete-group dispatch,
  extension tools,
  and session disposal.
- [Instruction collection](instruction-collection.md) preserves readable source identity,
  selected excerpts,
  relevance refresh,
  and freshness across asynchronous callbacks.
- [Operation preparation](operation-preparation.md) preserves original tool identity,
  complete arguments,
  group membership,
  parsed shell structure,
  and actual execution order.
- [Decision review](decision-review.md) owns Luna question binding,
  model attribution,
  categorical admission,
  instruction interpretation,
  and operation outcomes.
- [Decision transport](decision-transport.md) owns credential isolation,
  response validation,
  cancellation,
  and bounded request recovery.
- [Confirmation](confirmation.md) owns exact-group Allow and Stop,
  headless withholding,
  cancellation,
  and explicit session bypass.
- [Build lifecycle](build-lifecycle.md) owns qualified upstream source,
  generated transformations,
  immutable release publication,
  and executable resolution.
- [Diagnostics](diagnostics.md) preserve the source,
  operation,
  scores,
  routing reasons,
  and failures needed to reconstruct a decision.

Each retained major module has a package-local document covering its callers,
interface,
invariants,
alternatives,
and executable verification.
An existing implementation is evidence of a responsibility,
not sufficient justification for its current decomposition.

## Implemented consolidation and measurements

The [retired extension pipeline](retired-extension.md) no longer supplies another execution-permission path.
The tracked inventory changes from 881 files to 847 files,
including the new architecture documents and regressions.
The inventory's maintained non-test `src` category changes from 96 files and 18,761 lines
to 65 files and 10,484 lines.
Verification changes from 49,012 lines to 41,673 lines by removing tests exclusive to retired behavior.
Native production remains approximately 55,855 lines;
this refactor does not claim that every retained internal module is minimal.

`src/native-policy-api.ts` supplies the canonical native interface.
The generated runtime bridge,
declaration bridge,
and public entry derive their exports from that interface instead of maintaining separate lists.
The final literal-import graph reaches 63 native policy modules and 237 native integration modules.
The public entry adds only its two facades beyond the native policy graph.
Types and literal imports count in this inventory;
dynamic generation is verified separately by the build and installed replay.

The post-archive `du --bytes --max-depth=1` measurement is 393,847,525 apparent package bytes,
including 312,619,660 bytes in retained build output.
`du --block-size=1 --summarize` reports 484,130,816 allocated bytes.
The initial measurement records apparent bytes only;
it does not establish an allocated-byte reduction.
Active diagnostics continue to grow during verification.

Historical logs are preserved as 194,896,137 compressed bytes outside the package,
with independently verified decompressed hashes and lengths.
New builds share identical immutable files with the previous release;
old release paths remain available to running sessions.
See [diagnostic storage](diagnostics.md) and [build lifecycle](build-lifecycle.md) for ownership and safeguards.

## Verification and limits

The disposable,
two-CPU,
2 GiB `test:unit` run passes,
including release publication and native lifecycle regressions.
`lint:types` passes.
Complete maintained lint checks 825 files with 486 rules on one thread:
30 errors and 13,163 warnings remain for the lint handoff.
This is not a zero-lint completion claim.

The native integration graph remains substantial because it includes host transformation,
source custody,
asynchronous freshness,
and prepared-group lifetime checks.
Each major responsibility's document identifies its actual callers,
required invariant,
and verification boundary.
These responsibilities do not justify duplicating the retired permission pipeline or public export lists.

The root `TCV` rule remains unchanged by the user's explicit decision.
Request-payload verification belongs in
[review input verification](../native/review-input-verification.md).

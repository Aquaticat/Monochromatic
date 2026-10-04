# cli-git and unified-linter implementation

## Authority

Implementation authorized on 2026-10-04 by the user's "Do it."
The user subsequently selected a simple handwritten merge inside the linter for now.
Do not wait for the deepmerge fork or implement a separate merge package.
The accepted scope is in
[`cli-git-rust-implementation.md`](../planning/cli-git-rust-implementation.md)
and
[`unified-linter.md`](../planning/unified-linter.md).

## Work queue

- [ ] Unified-linter foundation: JSONC schema, ordered merge, command interface, and artifact tests.
- [ ] Unified-linter Rust and Markdown/MDX rules, processors, fix mapping, and consumer parity.
- [ ] Newly requested explicit Rust annotations and anonymous-function ban, with container, mutation, and fuzz controls.
- [ ] Forbidden-strings structured embedding interface, standalone parity, and integration fuzzing.
- [ ] Rust cli-git configuration, Git resolution/argv, static policies, and management commands.
- [ ] Rust cli-git transactions, hooks, locks, replay, recovery, worktree copy, and auto-push.
- [ ] Container integration, mutation testing, fuzzing, platform checks, and release-artifact performance gates.
- [ ] Coordinated native installation, consumer migration, documentation, and retirement of old implementations.

Each item needs its own passing evidence before completion.
Current production tools remain active until cutover.
The first crates.io publication still needs explicit user approval.

## Prerequisites and evidence

- Rust JSONC prerequisite:
  `mise run //package/rust-module/jsonc-edit:test:debug` passed on 2026-10-04.
- Latest Git:
  the official `https://git-scm.com/downloads` page reports 2.56.0;
  the official `git/git` tag list corroborates `v2.56.0`.
  Use that exact stable release for the initial latest-only container fixture.
- The deepmerge fork exists as `Aquaticat/deepmerge-ts`,
  and the repository has the public JSON corpus in `package/module/deepmerge-ts.fuzz/src/json-case.ts`.
  Fork work is unnecessary after the user's handwritten-merge instruction.
  Do not read or copy its embargoed `*.local.*` findings into public artifacts.

## Completed slices

The handwritten merge is implemented in `package/linter/monochromatic-lint/src/config_merge.rs`.
It uses the parser's value model,
merges every key's full input group together,
concatenates arrays,
preserves first-seen key order,
and selects the last value on any kind mismatch.
The public JSON corpus is copied from the existing sidecar;
no generic deepmerge package is added.

Verification:

- `mise run //package/linter/monochromatic-lint:lint:types` passed.
- `mise run //package/linter/monochromatic-lint:test:container` passed in a mount-free,
  network-disabled 2 GiB / 2 CPU container.
- Tests include the independent corpus,
  a wrong-pairwise-fold positive control,
  and the parser's 512-container limit.
- The first comment-ownership fixture failed because comments after a comma on the same line belong to the preceding value.
  The fixture now uses separate lines and asserts that the intended final comment is present before testing ownership.

JSONC schema validation and nearest/explicit configuration discovery are implemented.
The loader rejects null,
decoded duplicate keys,
unknown fields/rules/options,
invalid UTF-16 text,
and invalid exact-integer limits before merging.
Explicit config uses cwd as its pattern base;
nearest config is used alone.
Memory-backed discovery tests do not read host-wide configuration,
and native adapter tests use owned disposable directories.

The container suite now passes 23 tests.
Cargo check and Clippy pass.
The first mutation campaign generated 62 mutants:
53 caught,
1 missed,
and 8 unviable.
The missed mutation changed the LFS option-name guard from conjunction to disjunction.
Added rejection cases for an exclusion on the wrong rule and an unrelated option on the LFS rule.
The rerun caught all 54 viable mutants;
8 remain unviable because rustc E0277 rejects generated `Default` construction for non-Default domain types.
No mutant exclusions were added.
Reports are under
`package/linter/monochromatic-lint/target/verification/mutation-eXe8bh`
and
`package/linter/monochromatic-lint/target/verification/mutation-YOFJ8l`.

The mutation runner uses cargo-mutants 27.1.0 inside a mount-free,
network-disabled 2 GiB / 2 CPU container.
`--in-place` applies only to the disposable container's source snapshot;
that tool rejects an explicit `--jobs` with `--in-place`,
so the runner leaves jobs implicit and retains Cargo's bounded compiler concurrency.
The runner retains diagnostic reports before deleting its owned container.

Configuration pattern matching,
resolved defaults,
atomic grouped source edits,
JSONL finding serialization,
and the existing Rust rules are implemented.
The last completed container run passed 56 tests;
Cargo check and Clippy passed with the aligned parser dependencies.
The extern-crate fixture initially assumed a named diagnostic;
source inspection confirmed its identifier is a `NAME_REF`,
so the fixture now preserves the incumbent's nameless message.

The enlarged core mutation campaign generated 205 mutants:
181 caught,
7 missed,
and 17 unviable.
Added controls for exact ignore patterns,
adjacent edits in both selection orders,
an unterminated string token ending at EOF,
and final lines without LF.
Two reported comparison mutants were equivalent because an empty slice cannot end in LF;
the redundant nonempty guards were removed instead of adding exclusions.
The updated core campaign still needs rerunning.
Evidence:
`package/linter/monochromatic-lint/target/verification/mutation-pgvqN1`.

The fuzz sidecar is implemented at `package/linter/monochromatic-lint.fuzz`.
The first completed ASAN campaigns recorded 243,146 structured merge executions
and 17,634 mixed raw/generated configuration executions,
both exit 0.
Evidence:
`package/linter/monochromatic-lint.fuzz/target/verification/campaign-Bx5G2Z`.
Those runs cover schema/merge foundations,
not the subsequently added pattern matcher,
edit engine,
or language rules.
The shared ordinary JSONC generator has a depth cap of 4;
the separate 512-depth unit control remains necessary.

Fuzz build containers read the installed nightly compiler through a read-only mount.
SELinux label isolation is disabled only for those build containers,
avoiding relabeling the shared host toolchain.
Fuzz execution itself has no host mounts,
retains normal label isolation,
and runs under 2 GiB / 2 CPU / 128 PID bounds.
The runner resolves the actual PATH-selected cargo-fuzz 0.13.2 rather than assuming Cargo home's older binary.
The first dictionary attempt used a JSON newline escape;
libFuzzer requires hexadecimal escapes,
so the dictionary now uses `\\x0a`.
The runner now requires a positive reported execution count as well as exit 0,
so dictionary/setup failures cannot masquerade as clean fuzzing.

Rust parser dependency correction:
`ra-ap-rustc_lexer` 0.165.0 asserts equal Unicode-table versions.
The fresh lock selected unicode-ident 1.0.26 (Unicode 18)
with unicode-properties 0.1.4 (Unicode 17),
causing rustc E0080.
The manifest now pins unicode-ident 1.0.24 and unicode-properties 0.1.4,
the same Unicode 17 pair as the incumbent;
compilation and the Rust container suite pass.
An explicit dependency-fetch task prepares all target archives before offline vendoring.

## Current step

The user added explicit Rust annotations,
then a ban on anonymous Rust functions.
The ban supersedes inline closures in the user's initial example;
use a named callback instead.
`rust/no-anonymous-functions` is implemented and registered in the configuration schema.
Focused tests cover closure modifiers,
nested closures,
named callbacks,
non-function pipe syntax,
UTF-8 byte positions,
and severity/option validation.
`mise run //package/linter/monochromatic-lint:test:rust-style` passed independently of the Markdown gate:
5 tests passed,
77 unrelated tests filtered out.
Evidence:
process `proc_3877`,
image `268493227fcaf3af6ae661616665f7da15fac28b1caeb987d12d438ad6787f67`.
The focused mutation gate passed with 2 caught mutants,
1 unviable mutant,
and no misses.
The unviable replacement constructs `Diagnostic::default()`,
which rustc rejects with E0277 because `Diagnostic` intentionally has no default.
Evidence:
`package/linter/monochromatic-lint/target/verification/mutation-DGghv8`.
The removed-rule mutant returned an empty findings list and was caught by the positive controls.

The new raw/generated Rust-style ASAN target completed 1,274 executions with exit 0.
The same rebuilt campaign completed 247,794 merge executions and 17,633 configuration executions.
Evidence:
`package/linter/monochromatic-lint.fuzz/target/verification/campaign-xNoaiG`.
The Rust generator independently exercises bounded closure counts and non-closure controls;
arbitrary valid UTF-8 also goes through the real parser.
The separate Clippy gate initially failed because concurrent commit `53c1e01a9`
added fleet-wide `shadow_reuse`,
`shadow_same`,
and `shadow_unrelated` denials.
Renamed the affected owned bindings without weakening those rules;
also replaced the Markdown link rule's late initialization with a named replacement helper.
The test image now copies the repository's `clippy.toml` instead of silently omitting its parameters.
`mise run //package/linter/monochromatic-lint:lint:rust-style` passed on recheck (`proc_a018`).
Cargo still emits `cargo::unused_dependencies` for the reserved `ignore` dependency
because the file walker is not implemented yet.
Executable dispatch remains pending.
The user answered A to the annotation scope question:
full semantic enforcement is authorized for `rust/require-explicit-types`,
including explicit generic arguments on resolved calls.
This supersedes the prior no-semantic-analysis decision for the new rule.
Preserve `_` for unnameable function-item types;
report resolution limitations honestly for standalone snippets.
Do not reopen this settled scope question or substitute method-name heuristics.
Detailed next steps and source findings:
`doc/planning/rust-explicit-types.md`.
A read-only rust-analyzer checkout matches the syntax crate's recorded upstream revision.
The first semantic dependency fetch found no published HIR 0.0.335;
a re-probed sparse index confirms the gap.
The disposable probe now successfully fetches synchronized 0.0.336,
without changing production dependencies.
Build-script entry points and their compiler-probe helpers were inspected.
The Linux-filtered graph has 175 packages.
The first consumer run compiled but lacked rust-analyzer's required database attachment scope.
The corrected run (`proc_46ae`) passed receiver disambiguation with counts `[1, 0, 1]`
using named callbacks through `attach_db` and `with_attached_db`,
without adding anonymous functions or mutable request globals.
The inference-site probe (`proc_a10b`) and typed per-database selection control (`proc_39fb`) passed.
Salsa inputs let named callbacks read the selected file without captured closures or a second request-global store.
The standard-library user example resolved correctly (`proc_e5d4`),
then passed the real composed rule in an external Rust consumer (`proc_7d2f`).
The unfinished crate now depends on synchronized rust-analyzer 0.0.336 and Salsa 0.27.2.

The actual rule comprises declaration-presence checks,
resolved generic methods/type or value paths,
enum/alias argument ownership,
and inferred-type validation.
`Diagnostic.processing_failure` is internal and omitted from JSONL;
the future executable must honor it for unavailable semantic coverage.
`RustSource::from_syntax` reuses the registered tree rather than reparsing it.

The package's new semantic conformance catalog uses disposable Cargo projects and source overlays,
including positive/negative cache controls.
Its first package run (`proc_ae2d`) passed 93 tests but stopped the semantic catalog
on the intentionally disabled `AbsPath::exists()` method.
The helper now uses `std::fs::metadata` as required by the inspected API;
the full test/Clippy rerun is `proc_8e60`.
The published API prerequisite failures are recorded in
`doc/troubleshooting/rust-analyzer-semantic-scope.md`.
The test image now includes Rust 1.97's matching rust-src component:
`84f24e75017a7d8afa1c69e51c52f37e7d8d644cd2597a01f4732ad0b386dc20`.
This image was built without host mounts using the inspected rustup component command.

Next:
inspect and fix any conformance/Clippy failures,
add the remaining semantic edge controls,
run full-rule mutation and bounded fuzzing,
and integrate workspace loading/CLI dispatch.
Do not call the explicit-types rule complete from its passing user example alone.

The first full Markdown container run compiled and ran 77 tests:
76 passed and the assumed invalid-ESM error fixture failed.
Source inspection established that Sätteri uses ESM parsing for completeness,
then constructs an ESM node even when that check returns Error.
The adapter's contract is rejection of reported parser errors,
not independent JavaScript validation.
The revised test first proves a mismatched JSX closing tag enters the native error vector,
then asserts adapter rejection and original byte offsets with and without BOM.
A separate control records ESM acceptance and the retained source newline.
After correcting the source-slice expectation,
the full existing slice passed 83 tests and Clippy (`proc_adf2`).
That result precedes the new semantic conformance additions.
The corrected error-boundary assumptions and source evidence are recorded in
`doc/troubleshooting/satteri-mdx-error-fixtures.md`.

Native Markdown/MDX arena adapter,
owned byte/UTF-16 positions,
and the initial heading/link/fence rule ports are written and awaiting their first verification.
Dependencies retain the already approved Sätteri versions.
The markdownlint MIT notice is now included.
Continue with the remaining Markdown rules,
processors,
CLI and integration,
then scanner embedding and the Rust Git wrapper.
Do not replace current production tools early.

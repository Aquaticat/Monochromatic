# cli-git and unified-linter implementation

## Authority

Implementation authorized on 2026-10-04 by the user's "Do it."
The user subsequently selected a simple handwritten merge inside the linter for now.
Do not wait for the deepmerge fork or implement a separate merge package.
The accepted scope is in
[`cli-git-rust-implementation.md`](../planning/cli-git-rust-implementation.md)
and
[`unified-linter.md`](../planning/unified-linter.md).

## Handoff 2026-10-05

This session hands off to Claude Opus after the Astra usage limit was reached.
The three scope-limited delegate sessions
(scanner verification,
native LFS URL evaluation,
processors) have all returned.

### Session-owner state

Main session work since the delegates started:

- Bounded fixpoint loop (`fix_loop.rs`) with cycle detection,
  ten-pass cap,
  and mandatory final check;
  170-test gate passed (`proc_0fca`).
- Native cli-git wrapper foundations in `package/git-policy/cli/src/native/`:
  `global_arguments.rs` (Git 2.56.0 `handle_options` parity,
  9 tests passed in container `proc_d019`)
  and `config_loading.rs` (lazy policy-loading classification).
  The classification gate (`proc_c227`) passed all 9 tests
  but Clippy failed with `if_same_then_else` in `config_loading.rs:188`.
  Fix that condition merge before continuing the wrapper.
  The wrapper has its own `Cargo.toml`,
  `native:lock`/`native:format`/`native:check`/`native:test:container` tasks,
  and its test fixture uses the audited Git 2.56.0 image
  `6ec87f6d290a2f59bda5b3ffd4197058fe0749d02b4978c877e8edf6dc38802a`.
- Processor implementation from the delegate is now committed (`ff5706ef3`)
  after the delegated session's guardrail blocked its scoped commits.
  Formatter-only deltas committed as `00777e5ef`.
- A trust rule for private scratch audit helpers and bounded container verification
  under `~/temp/agent` was accepted in this session,
  so the blocked LFS URL evaluation can resume.

### Delegate outcomes

**Scanner embedding verification**
(`doc/handover/scanner-native-verification.md`,
commit `f0635c911`):
complete.
Release suite passed 158 library tests,
2 binary-boundary tests,
4 public embedding tests,
40 CLI integration tests,
and 8 pathname tests.
Clippy passed across scanner and every fuzz-sidecar target.
ASan embedding fuzzing passed 256,297 runs.
Panic controls passed with independent observations
(hook ownership, unwind outcomes, real parallel CLI faults).
Mutation: 147 mutants, 122 caught, 22 unviable, 3 survivors;
startup follow-up caught all 5 mutants including the logging-filter survivor.
Remaining limitation:
two Windows-native prefix-detection mutants survive on Linux;
the full mutation gate stays non-green pending Windows-native verification.
Scoped paths are committed and clean.

**Native LFS URL evaluation**
(`doc/planning/native-lfs-url-normalization-evaluation.md`,
commit `afa351721`):
blocked before candidate vetting by the private-helper permission gate.
Local measurements completed:
Node v26.10.0 with Ada 4.0.0,
consumed `lfsObjectBase` contract documented
(parse without base,
clear credentials/query/fragment,
serialize,
remove one final slash,
preserve literal prefix matching).
No candidate is recommended or adopted.
With the newly accepted trust rule the queue can resume at
frozen discovery queries and candidate screening.
Do not treat the Rust `url` family or Ada bindings as preselected winners.

**Processors**
(`doc/handover/unified-linter-processors.md`):
implemented and committed (`ff5706ef3`),
verified at 203 native tests (33 processor tests),
Clippy,
standalone built-library consumer,
84 systematic cases,
1,024 seeded fuzz cases,
and 5/5 guard-focused mutants caught
(immutable image `62a207e21b353bf4b0b047e67d9424a2720eda1c1d7286b006150ddd9f96188a`).
Interface:
`extract`,
`VirtualSource::check_rust` (host-mapped findings,
no synthetic-main reporting),
`project_diagnostic`,
`project_fix` (container-preserving atomic groups),
explicit processing failure for unresolvable virtual semantics.
The final handover document still needs a render check
and the delegate's scoped mutation campaign was still running when it returned.
Integration into executable orchestration and global fuzzing remains.

### Mutation state

- Full snapshot campaign (`proc_3d86`, older snapshot):
  439 mutants, 18 missed, 367 caught, 52 unviable, 2 timeouts.
  Survivors include `rust_inferred_constants.rs` argument-index arithmetic.
- Markdown-scoped rerun (`proc_ea56`):
  496 mutants, 17 missed, 442 caught, 26 unviable, 11 timeouts.
  Survivors concentrate in `markdown_tables.rs` cell boundaries,
  `markdown_prose_context.rs` continuation prefixes,
  `markdown_break_points.rs`, and `markdown_block_start.rs`.
  Full inventory:
  `package/linter/monochromatic-lint/target/verification/`.
- Fuzz campaign `campaign-KqhBLf` passed
  (147,101 merge, 13,394 configuration, 1,185 rust-style,
  539 explicit-types, 64,366 Markdown/MDX including tables and prose).

## Resumption 2026-10-05

Claude Opus resumed from the `Handoff 2026-10-05` section on the user's instruction to continue with subagents.
The main session coordinates and integrates;
delegates own disjoint files and write their own evidence documents.
This document and the coverage ledger are edited only by the main session.

### Done by the main session

- `if_same_then_else` in `config_loading.rs` is fixed (`2680f7cb6`);
  `mise run //package/git-policy/cli:native:test:container` passed 9 tests and Clippy.
- Verification runners take an overridable image tag (`cd54f8b64`):
  `GIT_POLICY_NATIVE_IMAGE_TAG` for the wrapper runner
  and `MONOCHROMATIC_LINT_IMAGE_TAG` for the linter test, Clippy and mutation runners,
  both defaulting to `development`.
  Two snapshots building one fixed tag could run each other's image.
  The wrapper override was exercised with default and custom tags;
  the linter runners get their first run from the delegates' gates.
- `doc/handover/unified-linter-processors.md` passed its render check.
- The processor delegate's last campaign
  (`package/linter/monochromatic-lint/target/verification/processors-mutation-VrbPEr`)
  finished with 5 caught and none missed.
  That campaign plants 5 guard removals;
  an unrestricted cargo-mutants pass over the `processors*.rs` files has not run.

### Delegates and ownership

- Linter executable (main checkout):
  owns `package/linter/monochromatic-lint` and `package/linter/monochromatic-lint.fuzz`
  except the files listed for the mutation-survivor delegate.
  Slices: rule coverage audit, binary and orchestration, binary-level container tests,
  fuzz sidecar extension, differential comparison against both incumbents.
  Evidence: `doc/handover/unified-linter-executable.md`.
- Native wrapper foundation (main checkout):
  owns `package/git-policy/cli/src/native` except `command_*.rs` and `rule_*.rs`,
  the crate manifest and lockfile, the native runner, and the `native:*` tasks.
  Slices: `cli-git.config.jsonc` loader, real-Git resolution and forwarding with the executable entry,
  management-command skeleton, wrapper mutation runner, `package/git-policy/cli.fuzz`.
  Evidence: `doc/handover/cli-git-native-foundation.md`.
- Behavior ledger (documentation only):
  `doc/planning/cli-git-rust-behavior-ledger.md`,
  the first step of the accepted implementation sequence, which had not been written.
- LFS URL normalizer selection (documentation and one fixture):
  see `User correction: no vetting decision gate`.
- Scanner Windows-native verification:
  the two retained survivors at `package/cli/forbidden-strings/src/path_name_bytes.rs:36`,
  through a Windows virtual machine;
  evidence goes into `doc/handover/scanner-native-verification.md`.
- Linter mutation survivors (queued, linked worktree
  `.claude/worktrees/linter-mutation-survivors`, branch `test/linter-mutation-survivors`):
  owns `markdown_block_start.rs`, `markdown_break_points.rs`, `markdown_code.rs`, `markdown_commands.rs`,
  `markdown_headings.rs`, `markdown_prose_context.rs`, `markdown_source.rs`, `markdown_tables.rs`,
  `rust_inferred_constants.rs`, their tests, `bin/mutate-container.mjs`, and the `mutation*` tasks.
  Inventories: `mutation-1vJeuS` (full campaign, 18 missed, 2 timeouts)
  and `mutation-p3QH2L` (Markdown rerun, 17 missed, 11 timeouts)
  under `package/linter/monochromatic-lint/target/verification`.
  Evidence: `doc/handover/unified-linter-mutation-survivors.md`.
- Git command parser and pure rule cores (queued, linked worktree
  `.claude/worktrees/cli-git-native-command-parser`, branch `feat/cli-git-native-command-parser`):
  ports `package/git-policy/cli/src/parser` and the decision cores of `src/rule`
  into `command_*.rs` and `rule_*.rs`.
  Evidence: `doc/handover/cli-git-native-command-parser.md`.

The two queued delegates wait for a free slot:
this session allows 5 concurrent subagents.
Their branches are cherry-picked onto `main` by the main session,
which unions `src/native/lib.rs` and reruns both package gates on the integrated tree.

### Delegate results

**Behavior ledger**:
complete,
[`cli-git-rust-behavior-ledger.md`](../planning/cli-git-rust-behavior-ledger.md),
last commit `ab7ff3f89`.
It records 112 responsibilities:
92 retained and 20 retired,
each retirement cited to the planning text.
Line numbers are valid at `cd54f8b64` for the TypeScript source and `SPEC.md`,
and at `df25471a9` for native files.
The delegate reports 632 `path:line` citations checked by script for existing files and in-range lines,
and no advisor review (the tool was overloaded).
The main session spot-checked one claim against source:
`package/git/executable/src/self-shim.ts:212` returns `false` from the self-shim test for any native executable header,
so the TypeScript resolver would accept a native wrapper as real Git.
That is a cutover item for the resolver's surviving TypeScript consumers.

Findings sent on to the wrapper foundation delegate:

- the native registry gave the optional policies an `Off` default,
  while the incumbent runs `mono/dependent-version-bump` at `error` without the root configuration listing it;
- the Rust resolver must prove by a binary-level test that it never resolves to a copy of itself.

The ledger's `Open questions` section lists 21 behaviors the planning documents do not determine,
and its `Spec and code disagreements` section lists 13.
Working default for both:
the incumbent's behavior where the ledger does not list it as a defect,
Git's own convention where it does,
each recorded as open to veto by the delegate that implements it.
None blocks the slices in flight.
The first ones that will need the user are in the transaction phase:
the native form of the generated hook entries (Node scripts today),
and whether lock birth-identity strings must match the incumbent's so both versions judge each other's locks.

The ledger also measured the incumbent with `tokei` 15.0.0, tests and fixtures excluded:
312 files and 40,559 code lines,
of which `policy-engine` is 135 files and 18,582 lines
and worktree copy is 25 files and 3,755 lines.

**LFS URL normalizer**:
selected,
see the `Selected owner` section of
[`native-lfs-url-normalization-evaluation.md`](../planning/native-lfs-url-normalization-evaluation.md)
(commits `eeb3f5e75`, `5c39793e1`, `c8da20019`, `78350705c`).
The owner is a standard-library-only function in the linter crate,
`lfs_object_base(endpoint: &str) -> Result<String, LfsUrlRejection>`,
restricted to plain ASCII `http` and `https` endpoints,
with 12 named rejections in a fixed evaluation order.
It adds no crate;
the Rust `url` crate would have added 8 to the linter lockfile and was never built or measured.
`fixtures/lfs-url-parity.json` holds 868 endpoint cases and 73 `.lfsconfig` cases captured from the incumbent
on Node v26.10.0 with Ada 4.0.0.
The main session recounted the endpoint cases from the file:
459 accepted with the incumbent's exact output,
289 that the incumbent accepts and the native function rejects,
and 120 that both reject.
The delegate reports no case where both accept and return different strings
across the fixture, a 2,160-case matrix, and 1,000,000 seeded random inputs,
with 12 single-fault variants of the normalizer each failing at least one fixture case.

Open to veto:
the 289 native-only rejections are a deliberate behavior change.
Endpoints such as `ssh://` schemes, IPv6 literals, Unicode hosts, and dot segments
get a named error natively instead of the incumbent's normalized output.
This repository's endpoint and every endpoint in the incumbent's tests are in the accepted class.

Limits the delegate stated:
only Linux x64 was measured;
equality on acceptance rests on differential evidence and a partial reading of Ada's host path, not a proof
(reading the source found a host-length divergence that 1,000,000 random inputs had missed);
the reference source is scratch code and has not been through the crate's Clippy configuration.
The linter executable delegate has the contract and is porting `markdown/lfs-image-url`.

**Processor mutation campaign**:
the first unrestricted cargo-mutants pass over `src/processors*.rs`,
run by the main session from the snapshot at `9be97dce4` with image tag `processors-full`
(`mise run //package/linter/monochromatic-lint:mutation:processors:files`, 2,641 seconds).
Result:
380 mutants,
302 caught,
52 missed,
24 unviable,
2 timeouts.
Evidence:
`package/linter/monochromatic-lint/target/verification/mutation-exJwfB`
(base image `57e310bd9253f1fd6e84437012336fb14c9ecf36fef71091b3fd9fe15beab3f5`).
Missed by file:
`processors_spans.rs` 15,
`processors_docs.rs` 14,
`processors_rewrite.rs` 12,
`processors.rs` 3,
`processors_prepare.rs` 3,
`processors_projection.rs` 3,
`processors_fences.rs` 1,
`processors_model.rs` 1.
Timeouts:
`processors_docs.rs:223` and `processors_lines.rs:45`, both `+=` replaced by `*=`.
The earlier "5 of 5 caught" result came from five planted guard removals
and does not describe coverage of these modules.
Disposition is queued for a delegate in the linked worktree `.claude/worktrees/linter-processor-survivors`
(branch `test/linter-processor-survivors`, based on `9be97dce4`).

**Scanner Windows-native verification**:
the two retained survivors at `package/cli/forbidden-strings/src/path_name_bytes.rs:36` are caught on native Windows
by the existing test `path_scan::tests::windows_volume_prefix_is_not_name_segment`.
Detail and evidence:
`doc/handover/scanner-native-verification.md`, section `Windows-native follow-up` (commit `0fa9f3761`),
and `package/cli/forbidden-strings/target/verification/windows-native-8Wo0tM`.
Target:
Windows Server 2025 evaluation build 10.0.26100.1742,
`rustc` 1.97.0,
`x86_64-pc-windows-gnu`,
built and tested inside a disposable 4 vCPU / 8 GiB virtual machine that was destroyed afterwards.
A positive-control mutant failed 14 tests.

Limits of that closure:

- Only the GNU ABI ran;
  the published binaries are MSVC.
- The unmutated Windows baseline is not green.
  `tests/integration.rs` does not compile on Windows (Unix-only permission APIs),
  and six tests fail for causes not established,
  so the result is differential:
  each mutant adds exactly one failing test to the baseline's set.
- One manual run on one snapshot, not a recurring gate.

New defect found by that run, not fixed:
device-namespace pathnames fail open on Windows.
`\\.\COM1\<forbidden name>\clean.txt` produced no finding and no masking.
The main session confirmed the mechanism by reading the source:
`count_prefix_parts` (`src/path_name_bytes.rs:44`) counts the `.` of `\\.\` as a prefix part,
while `src/path_scan.rs:129` treats a `.` component as navigation and continues without consuming a prefix part,
so the remaining prefix skips swallow the first real name.
Drive, UNC, and `\\?\` forms behaved correctly.
Proposed, awaiting the user:
fix it with target-independent tests that run on Linux,
with Windows confirmation later.

Host notes from that run:

- The `mvm` MCP tools did not work on this host:
  `virsh` and `qemu-img` exist only inside the `org.virt_manager.virt-manager` Flatpak,
  and no `virtiofsd` is available,
  so the delegate drove the `mvm` CLI through scratch shims and moved files over loopback HTTP.
  A troubleshooting entry for this is not written yet.
- The Windows template's evaluation license had lapsed.
  The delegate ran `slmgr.vbs /rearm` on the disposable overlay only;
  the template is unchanged.

**Linter executable**:
complete,
evidence in [`unified-linter-executable.md`](unified-linter-executable.md)
(commits `2cdcea1f3`, `9adb2f918`, `c46396109`, `6b260a81e`, `4b6d46b9a`, `2aab0b324`, `a4b2f08dc`).
`monochromatic-lint` builds as a binary with orchestration, stdin fixing, every designed flag,
core processing findings, panic containment and mode-preserving atomic writes.
All 17 designed rules have an implementation and tests;
`markdown/lfs-image-url` was ported against `fixtures/lfs-url-parity.json`
(all 868 endpoint and 73 configuration cases).
The main session read the final gate log for source commit `2aab0b324`:
`lint:container` exit 0,
335 library tests and 10 executable tests passed,
Clippy clean,
image `59eb21a45a09dfd956606f040fb66aec6fa3393f608dbdba4e899cfc7c559173`.
The fuzz sidecar gained an `orchestration` target;
a 30-second smoke of all six targets exited 0
(`package/linter/monochromatic-lint.fuzz/target/verification/campaign-IvsNWV`).

Differential comparison against both incumbents over this repository,
read-only, with fixes only in throwaway worktrees:

- Rust:
  all 185 findings under the draft configuration match the incumbent exactly, spans included;
  the incumbent's other 222 are hidden by the draft's added `**/*.fuzz/**` and `doc/audit/**` exemptions,
  and without them both report 407.
- Markdown:
  of about 52,000 findings, 623 differ,
  all in 9 files after their first character outside the Basic Multilingual Plane:
  607 are the incumbent's issue #559 offset bug
  and 16 are the same positions in different column units.
- Fixes:
  byte-identical to the incumbent with #559 corrected,
  except one fuzz seed where the native rule removes a trailing `\.` completely;
  a second fix pass changes nothing.

Open to veto, from that document's `Decisions open for veto` section:
exit 2 for processing findings and for a missing configuration,
the `core/*` finding codes,
per-file LFS root discovery,
an in-crate SHA-256,
strict JSON for `--print-config`,
and UTF-16 Markdown columns.

What the draft configuration would do to this repository at cutover,
which the user needs to see before the cutover step:

- `rust/no-anonymous-functions` at `error` reports 1,215 findings in `.rs` files
  and 207 more in Markdown snippets and doc tests,
  with no burn-down block covering either.
- Snippet `require-rustdoc` warnings number 1,142 in 200 files
  (the design estimated 905);
  710 are the file-level rustdoc requirement.
- `--fix` under the draft rewrites 693 `.rs` files (comment lines only) and 185 Markdown files,
  and rustdoc line-break fixes leave two spaces after `///`.

Not done:
a mutation campaign over the new orchestration modules,
Windows and release-build runs,
a fuzz campaign longer than the smoke,
85 `require-rustdoc` findings in the crate's own older modules,
and a file-size limit (the incumbent skips files over 5 MiB).
Commit `a4b2f08dc` is scoped `docs(handover)` but also changes both package READMEs.

### User correction: no vetting decision gate

The main session briefed `markdown/lfs-image-url` as blocked on a vetting decision by the user.
The user replied (2026-10-05):
"we don't need a vetting decision here."
The gate is removed.
The normalizer owner is chosen by measurement:
the option that reproduces the incumbent on a differential corpus with the least added dependency footprint.
The delegate commits `package/linter/monochromatic-lint/fixtures/lfs-url-parity.json`
and a `Selected owner` section in
[`native-lfs-url-normalization-evaluation.md`](../planning/native-lfs-url-normalization-evaluation.md);
the linter delegate then ports the rule and may add a selected crate to the manifest.
The differential test stays because the rule's findings and edits must match the incumbent;
that is verification, not a decision for the user.

### Environment findings

- Tool-managed worktree isolation fails in this repository:
  `.claude/settings.local.json` registers `cctt` (the terminal-title plugin) for the `WorktreeCreate` hook.
  A command hook on that event must create the worktree and print its path;
  `cctt` prints none,
  so Claude Code reports "hook succeeded but returned no worktree path".
  Workaround used: `git worktree add -b <branch> .claude/worktrees/<name> main`
  (`.claude/` is ignored at `.gitignore:125`),
  with the delegate told to keep every path inside that root.
- The second-opinion command from the generated `CLAUDE.md`
  (`pi --model openai-codex/gpt-5.6-sol`) exited 1 with "No API key found for openai-codex";
  pi also reports that model retired in favor of `gpt-6.1-sol`.
  The advisor was consulted alone.

## Work queue

- [x] Unified-linter foundation: JSONC schema, ordered merge, command interface, and artifact tests.
- [ ] Unified-linter Rust and Markdown/MDX rules, processors, fix mapping, and consumer parity.
  Rules, processors and the executable are implemented and gated;
  differential comparison is recorded under `Resumption 2026-10-05`.
  Remaining: orchestration mutation campaign, processor and Markdown survivor dispositions,
  and consumer migration.
- [x] Newly requested explicit Rust annotations and anonymous-function ban, with container, mutation, and fuzz controls.
- [x] Forbidden-strings structured embedding interface and standalone parity.
  The two Windows-native survivors are caught on Windows (GNU ABI, differential against a red baseline).
- [ ] Scanner on Windows: device-namespace pathnames fail open;
  the Windows baseline has a non-compiling integration target and six failing tests;
  MSVC is unexercised.
- [ ] Rust cli-git configuration, Git resolution/argv, static policies, and management commands.
  Native global-argument and lazy-config foundations are in and pass tests and Clippy (`2680f7cb6`);
  configuration, Git resolution and forwarding, the command parser and rule cores are delegated
  (see `Resumption 2026-10-05`).
  The policy engine, management-command execution, and the optional policies are not started.
- [ ] Rust cli-git transactions, hooks, locks, replay, recovery, worktree copy, and auto-push.
- [ ] Container integration, mutation testing, fuzzing, platform checks, and release-artifact performance gates.
  Mutation survivors from both campaigns need disposition or new controls.
- [ ] Coordinated native installation, consumer migration, documentation, and retirement of old implementations.
- [ ] Native LFS URL normalization: owner selected by differential measurement, no decision gate;
  then port `markdown/lfs-image-url`.
- [ ] Behavior ledger for the wrapper (`doc/planning/cli-git-rust-behavior-ledger.md`), delegated.

Each item needs its own passing evidence before completion.
Current production tools remain active until cutover.
The first crates.io publication still needs explicit user approval.
The user chose continuous execution:
finish the queue or identify a genuine blocker rather than ending on a progress report.

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
the full test suite then passed all 94 tests in `proc_8e60`,
including the semantic conformance/source-overlay catalog.
Clippy found one `clippy::question_mark` occurrence;
it has been rewritten with typed `?` propagation without changing rule severity.
Additional const-inference,
alias,
trait,
and lifetime cases are now running in `proc_cd25`
(`unified-linter-semantic-edge-conformance`).
That gate found a real classification defect:
`build::<_>()` was parsed as a type-shaped generic argument,
but its resolved declaration requires a constant.
The checker now maps the argument position to the resolved type/const parameter list
before asking for type information.
Verification is pending on this correction.

The production `RustSemanticSession` is now implemented:
it owns a preloaded workspace,
verifies selected-file membership,
applies exact in-memory source overlays,
uses named protected query callbacks,
and preserves typed failures.
The conformance fixture now calls this production session instead of test-only query glue.
Session panic and missing/relative-file controls are included.
The complete session snapshot passed 97 tests and Clippy (`proc_baf0`).
The production Cargo loader is also implemented:
explicit Cargo manifests,
read-only installed-toolchain/source discovery,
locked/offline dependency handling,
and separate source-only/generated-source preparation.
A real fixture proves generated definitions become visible after Cargo preparation
and failed build scripts are not accepted as complete metadata.
That snapshot passed 99 tests and Clippy (`proc_6bfb`).
Typed Rust configuration selection,
shared syntax/semantic dispatch,
and a lazy invocation-level Rust workspace cache were added afterward.
The syntax-only route does not inspect or open a Cargo workspace,
and semantic source overlays retain the user's display filename.
Native literal-path discovery now handles hidden directories,
Git/dependency exclusions,
combined extra ignore patterns,
and explicit I/O failures.
These dispatch/discovery additions await their gate;
glob expansion and the executable are still unfinished.
The accepted CLI grammar is now declared through the incumbent Clap family,
including native path values,
stdin-filename requirements,
positive concurrency,
repeatable ignore flags,
and rejection of an unsupported --rule option.
CLI grammar,
dispatch,
and literal discovery passed their gate (`proc_c3dd`).
Glob expansion and JSONL/stdin-fix output routing were then added.
`proc_2dfd` passed all 121 tests,
but Clippy rejected one unnecessary cloned single-element test slice
(`clippy::cloned_ref_to_slice_refs`);
that assertion now uses `std::slice::from_ref`.
The output/glob recheck passed all 121 tests and Clippy (`proc_6b17`).
The preceding gate passed 108 tests but one new settings fixture attempted to parse top-level null,
which the JSONC package rejects before schema validation.
The fixture now tests a valid JSONC array root and nested null instead.

Markdown commands-show-output,
textually scoped duplicate headings,
and trailing punctuation have now been ported.
`proc_1bf8` passed all 130 tests,
including escaped/entity punctuation and LF/CRLF/bare-CR prompt fixes.
Clippy rejected the optional-edit construction with `clippy::manual_map`;
a named early-return helper now preserves the no-closure policy without suppressing that lint.
Additional controls cover output-bearing CRLF/bare-CR fences,
container exceptions,
exact messages,
markup-boundary heading text,
and native fence offsets.
The recheck (`proc_a6c6`) passed 131 tests and failed the new bare-CR output-bearing fence control.
`all_prompts` split decoded content only on LF;
Sätteri retained CR in this code value,
so a command followed by output became one prompt-looking line.
The checker now splits on either CR or LF,
while the byte editor still preserves each original line ending.
A new full gate is pending.

Advisor review supplied those additional controls.
Its suggested punctuation expansion and registry finding were rejected after checking
`package/cli/markdown-lint/src/rule/md026-no-trailing-punctuation.ts`
and `package/linter/monochromatic-lint/src/configuration_rules.rs`:
the accepted punctuation is only `.` and `:`,
and all specified Markdown identifiers were already registered.
Executable dispatch is still pending,
so registration alone does not establish a working command.
Textual ancestry and column-one fence restrictions directly match the incumbent rule source.
The proposed non-JSON silent-mode error output was not adopted:
findings remain JSONL when displayed,
and exit status remains independent of display filtering.
The punctuation suffix scanner consumes each successful scanned suffix before continuing;
the first unsupported suffix returns immediately,
so repeated reverse searches do not rescan the successful prefixes.

Full mutation is running as `proc_3d86` against its recorded immutable source snapshot.
It has reported a survivor in `markdown_code.rs`:
changing the indentation adjustment from addition to subtraction.
The existing native fixture's code-node range already excludes indentation.
Installed Sätteri `firstpass.rs` (`parse_fenced_code_block`) records the scanner's marker offset,
and `arena_build.rs` copies that span.
A native parser offset/fix matrix now covers column-one,
indented,
quoted,
list-contained,
and Unicode-prefixed fences before removing redundant adjustment logic.
The native fence matrix passed in `proc_a6c6`,
so redundant indentation adjustment was removed and the helper renamed `fence_marker_end`.
The mutation campaign also survived strict/adjacent heading-depth comparison mutations;
regular one-step increases and equal-depth siblings now have explicit controls.
The final mutation report and further survivor dispositions remain pending.
A separate `mutation:markdown` task verifies the current Markdown-only scope after a full test baseline;
it does not replace the existing full-snapshot campaign.
Reference-definition checking has also been ported,
with normalized parser identities and source-preserving newline/container deletion tests.
The complete current snapshot passed 138 tests in `proc_02be`,
including the bare-CR regression,
fence-offset matrix,
reference-definition removals,
and output-filter controls.
Clippy stopped the mutation task on `clippy::needless_late_init` in the definition reason selection.
The rule now returns early for the first used definition,
then initializes its reason with a short conditional.
The scoped mutation task has not reached mutation yet.
The refreshed gate passed all 138 tests and Clippy in `proc_a8a3`.
Its Markdown-scoped mutation campaign is now running against that exact pre-table snapshot:
315 mutants,
passing unmutated baseline,
evidence `package/linter/monochromatic-lint/target/verification/mutation-n3zXgl`.
The surfaced prompt-scan mutants showed missing controls for `$ ` inside a command.
A new regression checks embedded prompt-looking text in every newline mode;
the scanner now uses a newline-retaining standard iterator instead of redundant byte loops.
The scoped campaign completed:
315 mutants,
247 caught,
39 missed,
20 unviable,
and 9 timeouts.
`mutation-n3zXgl/mutants.out/missed.txt` is the complete survivor inventory.
Survivors are concentrated in the old manual prompt scanning/opener arithmetic,
a zero-offset punctuation guard,
an equivalent parity subtraction,
malformed-arena guards,
and node-span length.
The prompt loops/opener arithmetic have since been simplified,
punctuation now toggles escape parity rather than subtracting equivalent values,
and native corruption/zero-offset/exact-length controls were added.
These dispositions still require mutation reruns;
the 9 timeout cases are retained separately,
not reported as ordinary caught results.
Mutation log matches are context-only;
terminal outcomes still wake the agent.

Pipe-table reporting/conversion and the HTML/MDX text encoder have been added afterward.
They preserve alignment and literal Markdown cell syntax,
report nested/indented tables without destructive whole-node fixes,
and encode HTML-sensitive characters plus MDX expression braces at interpolation.
The JavaScript trim set was measured over BMP scalar values;
it includes BOM and excludes NEXT LINE,
unlike Rust's default trim.
The latest table/prompt container gate is `proc_ccaf`.
Tables are not covered by either currently running mutation snapshot or `proc_415a`.
`proc_ccaf` passed 145 tests and failed the header-only table fixture:
`A | B` followed by `- | -` did not produce a table node.
The fixture now uses an unambiguous `--- | ---` delimiter row;
its verification is pending rather than assumed.
Native semantic-line-break helpers and the AST-driven rule have now been ported as well:
byte-preserving abbreviation checks,
closing-delimiter tails,
paragraph/container prefixes,
block-start guards,
and point-anchored add-only edits.
The complete table/prose gate passed all 156 tests and Clippy (`proc_32b5`).
The unambiguous header-only table fixture passed.
A read-only Node probe now captures 44 break-offset cases and 32 block-start cases
from the unchanged incumbent helpers,
with their source hashes in `fixtures/semantic-break-parity.json`.
New native tests compare those measured outputs rather than only handwritten expectations.
A separately measured incumbent Unicode defect is intentionally not copied:
`İİİİ etc. Next sentence.` and `İİİİ e.g. Next sentence.` each reported byte 13,
because lowercasing expands the prefix and shifts abbreviation ranges away from original offsets.
The native scanner tests abbreviations at original byte positions and keeps both cases unbroken.
The differential/arena guard gate passed all 164 tests and Clippy (`proc_1baf`).
It also verifies zero-offset punctuation,
all inline delimiter families,
nested quote/list prefixes,
JSONL zero-length point spans,
and deliberately corrupted native arenas.
The later arithmetic simplifications still require their next snapshot's verification.
New helper/rule files have uncommitted formatter output after their scoped feature commits.
The Markdown ASAN generator controls passed all 5 sidecar tests in `proc_415a`.
Its complete campaign then passed:
152,781 merge executions,
11,426 configuration executions,
1,129 anonymous-function executions,
458 semantic explicit-type executions,
and 57,218 Markdown/MDX executions.
Evidence:
`package/linter/monochromatic-lint.fuzz/target/verification/campaign-BUNASg`.
This snapshot excludes table/prose additions and later scanner refactors;
it is not a final full-implementation campaign.
The next campaign (`proc_5733`) includes tables and prose.
Its generator controls passed,
but the newly added sidecar Clippy stage found `clippy::shadow_unrelated`
in the existing configuration reconstruction helper.
The second `source` binding is now named `reconstructed`.
The retry passed (`proc_4875`):
all generator controls and sidecar Clippy,
then 147,101 merge executions,
13,394 configuration executions,
1,185 anonymous-function executions,
539 semantic explicit-type executions,
and 64,366 Markdown/MDX executions including tables and prose.
Evidence:
`package/linter/monochromatic-lint.fuzz/target/verification/campaign-KqhBLf`.
That snapshot includes the later prompt/escape simplifications,
but not the new exact node-span-length assertion.

Scanner embedding has begun with the structured `ScanFinding` model in
`package/cli/forbidden-strings/src/scan_finding.rs`.
The type is now registered and used by the shared content and pathname cores.
Standalone adapters render those canonical records into the existing protocol.
`Scanner::load`,
`Scanner::scan`,
`CandidateScan`,
and structured `CacheWarning` accessors are implemented,
with direct candidate-buffer and redaction controls.
The adapter now accepts native `Path` values for candidates and rule loading.
Component matching uses native bytes;
only unmatched display text is encoded,
including explicit escapes for invalid UTF-8.
New Unix byte-path controls and a public integration consumer cover the boundary,
but their container gate is still pending.
The first scanner container attempt (`proc_8f12`) stopped before compilation:
`cargo vendor --offline` lacked the locked `id-arena 2.3.0` archive.
A separate `dependencies:fetch` task completed (`proc_83cb`).
The scanner retry passed (`proc_9535`):
142 library tests,
40 binary integration tests,
and 8 pathname integration tests,
with no filtered tests in those suites.
The binary unit-test target had no tests in that snapshot.
The fixture is unprivileged and uses Git 2.56.0.
This snapshot precedes the final native rule-loader/public consumer additions
and the standalone panic-output boundary.
The production executable has not been rebuilt or replaced.
Next scanner work must share typed findings with the standalone formatter,
not parse terminal text back into candidate identities.
The standalone executable now installs a payload-omitting hook once before startup/workers,
then invokes logger initialization and the CLI inside a separate named unwind boundary.
Unexpected startup/runtime panics produce a fixed redacted setup error;
already-caught matcher panics retain their per-candidate EngineError records.
The library does not change a host's process hook.
New subprocess controls compare the default payload-bearing hook with the protected mode.
Their first gate is pending.
Public load-panic conversion and embedding-host hook/profile obligations remain open;
a hook is not an unwind catcher,
and prior hooks must not be blindly chained because they can print payloads.
Thread names are also not assumed safe output.
Source inspection found scan results/scratch local to each call in
`runtime_matcher.rs::line_matches`
and `forbidden-regex/src/regex/batch.rs::line_matches`;
matching methods borrow immutable compiled rules.
The separate shared CPU-count cache is in `forbidden-regex/src/parallel.rs`.
A complete panic-reuse/lifecycle proof remains pending.

The current Rust test image was probed and contains Git 2.47.3;
the host `/usr/bin/git` is 2.55.0.
Neither is the selected 2.56.0 wrapper-test contract.
Git 2.56.0 source was cloned read-only at
`~/temp/agent/git-native-2.56.0-20261004`,
commit `a018953688f1b10bddf91bff8747068f5f4746a4`.
Its build entry points/generators were inspected,
and `EXECUTION.md` records the mount-free,
network-disabled,
2 GiB/2 CPU/128 PID boundary.
The owning `test:git-image` task passed (`proc_b2d5`).
Result image:
`6ec87f6d290a2f59bda5b3ffd4197058fe0749d02b4978c877e8edf6dc38802a`.
Its `/usr/bin/git --version` probe returned exactly Git 2.56.0.
Evidence:
`package/git-policy/cli/target/verification/git-image-xKWiQ6`.
The fixture excludes Tk UI and localization only;
Perl/Python helpers,
curl,
fsmonitor,
and Git's default Rust support remain enabled.
A version probe must show exactly Git 2.56.0 before scanner/wrapper verification uses the image.

A Markdown/MDX ASAN target has been added to the fuzz sidecar.
Every draw exercises an independently counted rule fixture,
original-byte spans,
and reparsing after accepted grouped fixes,
then arbitrary UTF-8 in both modes.
The generator unit controls cover every fixture and LF/CRLF/bare-CR choice.
`proc_415a` is running the full sidecar smoke task under the existing bounds;
its source snapshot predates the final definition-selection refactor.
The owning Cargo task regenerated the fuzz lockfile;
inspection showed only the already selected Clap dependency family was added.
Semantic fuzz controls now exercise all generated branches through production sessions.
The first fixture path was not a crate root;
renaming the fixed metadata path to `/main.rs` made all generator controls pass.
The optimized ASAN build then lost a rustc child to SIGKILL under the 2 GiB cap (`proc_d430`);
this is not a fuzz-input failure or a verified OOM diagnosis.
The retry uses one compiler job and 16 codegen units,
retains container build state,
and keeps ASAN/coverage instrumentation enabled
(`proc_f48f`).
That retry completed all targets successfully:
155,424 merge executions,
13,716 configuration executions,
1,200 anonymous-function executions,
and 485 semantic explicit-type executions.
Evidence:
`package/linter/monochromatic-lint.fuzz/target/verification/campaign-DWubzj`.
All runtime fuzz containers remained mount-free with ASAN enabled.
These figures cover the recorded source snapshot,
not subsequent CLI/discovery changes.
The build emitted unused-doc-comment warnings on two macro invocations;
those comments are now ordinary comments rather than rustdoc.

The user corrected a progress-only stopping point with "Don't stop."
Continue the next unblocked item while background gates run;
a future process notification is not a reason to issue a progress-only final reply.
Proposed `AGENTS.md` tightening for `PXQ`:
"While tracked work remains, start the next unblocked item during background verification.
Do not end with a progress-only reply; finish the queue or identify a genuine blocker."
The proposal has not been applied to `AGENTS.md`.
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
and the initial heading/link/fence rule ports passed their recorded gates.
Later Markdown additions have their separate results recorded in this handover.
Dependencies retain the already approved Sätteri versions.
The markdownlint MIT notice is now included.
Continue with the remaining Markdown rules,
processors,
CLI and integration,
then scanner embedding and the Rust Git wrapper.
Do not replace current production tools early.

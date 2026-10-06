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

#### Scanner embedding verification

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

#### Native LFS URL evaluation

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

#### Processors

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

Every delegate in that list has reported;
`Delegate results` has each outcome.
Running at the last update of this document (2026-10-06):

- Linter mutation close (main checkout):
  the orchestration campaign and the Markdown and processor reruns to 0 missed and 0 timeouts.
  Evidence: `doc/handover/unified-linter-mutation-close.md`.
- Candidate content layer
  (linked worktree `.claude/worktrees/cli-git-candidates`, branch `feat/cli-git-native-candidates`):
  merging `main` into the branch,
  gating the merged tree,
  and applying the failure-code mapping.
  The main session fast-forwards `main` to the gated merge.
- Scanner Windows suite through the `mvm` command-line program (no repository code changes):
  the run that would show the Windows suite green,
  recorded in `doc/handover/scanner-native-verification.md`.

Reported and recorded under `Delegate results`:
the scanner Windows follow-up,
the open-decision brief,
the native policy engine,
the candidate content layer's own work,
and mvm.
The main session ran the cargo-mutants option prototype itself;
see `Mutation timeouts and the cargo-mutants exit status`.

### Delegate results

#### Behavior ledger

Complete,
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

#### LFS URL normalizer

Selected,
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

Accepted by the user on 2026-10-05 (see `User decisions 2026-10-05`):
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

#### Processor mutation campaign

The first unrestricted cargo-mutants pass over `src/processors*.rs`,
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

#### Scanner Windows-native verification

The two retained survivors at `package/cli/forbidden-strings/src/path_name_bytes.rs:36` are caught on native Windows
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

#### Linter executable

Complete,
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

#### Linter Markdown and constant-slot mutation survivors

Dispositioned on branch `test/linter-mutation-survivors` (head `4fa031de1`),
evidence in [`unified-linter-mutation-survivors.md`](unified-linter-mutation-survivors.md).
Several survivors were redundant guards or hand-stepped index arithmetic;
those were restructured (slice scans, `rfind`, a parity flag) rather than excluded,
and the non-equivalent ones gained controls.
Scoped reruns against test image `f1ccc6b562a7aed6507b6d19af275edb33d2da0b727c692d44f5e9cf41c94111`
(source `1e257034b`; the gate before them passed 217 tests and Clippy):

- constant-slot scope (`mutation-yE1SL2`):
  14 mutants, 12 caught, 0 missed, 2 unviable;
- parent-lookup scope (`mutation-BmlHMt`):
  4 mutants, 4 caught;
- Markdown scope (`mutation-BX2JYq`):
  424 mutants, 394 caught, 0 missed, 26 unviable, 4 timeouts, so the task still exits 3.

The 4 timeouts:
`markdown_definitions.rs:44` and `markdown_punctuation.rs:64` still use hand-stepped loops,
and the two `MarkdownSource::parent` replacements make every ancestor walk spin
(the parent-lookup scope catches those two in under a second).
Main-session choice, open to veto:
bound ancestor walks by the arena's node count so a cycle becomes a typed error,
instead of adding a mutant exclusion to the Markdown scope.
That and the two loops are queued.
The delegate also noted that cargo-mutants 27.1.0 needs `-- -- a b` to pass two test filters,
and that the unscoped suite's 139 seconds leave about 41 seconds of margin under the 180-second mutant timeout.

#### Processor mutation survivors

Dispositioned on branch `test/linter-processor-survivors`,
evidence in [`unified-linter-processor-survivors.md`](unified-linter-processor-survivors.md)
and `package/linter/monochromatic-lint/target/verification/processor-survivors-mutation-w00nRd`.
All 52 missed mutants were planted by hand from their recorded spans;
49 failed under the new exact-position, margin, refusal-text and whole-text tests.
The other 3 sat on code the parsers cannot reach
(a carriage return after a lexed line comment, and a fence whose decoded lines outnumber its authored lines),
and that code was removed.
Rerun after the changes,
over test image `48f1112dda8a331248860032ba641dc900154d87f7522225c829826d5e5cb126`
(228 tests and Clippy passed first):
374 mutants,
348 caught,
0 missed,
24 unviable,
2 timeouts.
No processor defect was found on unmutated input,
but one test gap mattered:
the refusal of an insertion between `\r` and `\n` in a `///` line was the only guard against
turning `/// Alpha.\r\n` into `/// Alpha.\rX\n`,
and no test pinned which refusal fired.
It is now pinned.

#### Integration of both survivor branches

Landed on `main` at `7e10fefd0` and pushed.
The main session cherry-picked 18 commits from `test/linter-mutation-survivors`
and 8 from `test/linter-processor-survivors` (excluding their shared `9be97dce4`, applied once)
onto a branch in the linked worktree `.claude/worktrees/integrate-linter`.
The only conflict was two tasks appended at the end of the package `mise.toml`;
both were kept.
Gates on the integrated tree, image tag `integrate-linter`:
the first 18 commits passed 349 library and 10 executable tests and Clippy (286 seconds),
and all 26 passed 374 library and 10 executable tests and Clippy with no warnings (351 seconds).
`main` moved twice during landing,
so the branch was rebased onto it;
`package/linter`, `package/rust-module/jsonc-edit` and `clippy.toml` were verified byte-identical
to the gated head before the fast-forward.
The other sessions' commits in between touched only unrelated packages.
Creating the integration branch inside an existing worktree was refused by the `branch-worktree-only` policy,
which requires `git worktree add -b`.

Choices the main session settled, open to veto:

- The 2 processor timeouts (`processors_docs.rs` and `processors_lines.rs`, both `+=` to `*=` on a zero counter)
  are restructured so no mutation can spin,
  the same treatment as the Markdown loops,
  rather than counting exit 3 as a pass in the mutation runner.
  Queued with the Markdown timeouts.
- The test that calls the internal `host_range` function directly stays:
  no input through `VirtualSource` reaches the guard it pins,
  and the guard stays as defense against future callers.
- The fence line-count simplification stays,
  because the repository removes provably redundant code instead of recording mutant exclusions.

#### Scanner device-namespace fail-open

Fixed on `main` (`833483171`),
detail in `doc/handover/scanner-native-verification.md`.
The cause was broader than the Windows run reported:
any Windows prefix part spelled `.` or `..`,
or an empty device name,
was displayed but not counted off,
so the first real name after the prefix escaped scanning.
Failing forms included `\\.\COM1\<name>`, `\\.\..\<name>`, `\\server\..\<name>`, and `\\?\UNC\..\share\<name>`,
so the earlier statement that verbatim forms were unaffected was wrong.
The scan now counts one prefix part per non-empty component before classifying `.` and `..` as navigation,
matching how `count_prefix_parts` defines a part.
13 new target-independent tests failed before the fix and pass after;
8 controls passed both times.
Final tree:
`test:container` passed 180 library, 4 binary-unit, 2 embedding, 2 cache-warning, 40 CLI and 8 pathname tests,
and Clippy was clean
(images `sha256:9c1d8dbb303da6872c0413f16b1150f968ca48beb336effd5b36c3312cf9f393`
and `sha256:167b707f83ff9e89580ad4fce5a391ec3a566b1edd2563e31cdd64ed841ad06f`).
Still open:
native Windows confirmation at a snapshot containing the fix,
a mutation rerun over `path_scan.rs` (no task scopes the pathname files),
and the `#[cfg(windows)]` test, which has never been compiled.
`lint:rust` reports 8 older `require-rustdoc` findings in `load_request.rs`, `process_boundary.rs` and `scanner.rs`.
A concurrent session's commit `8fdbbded9` (`test(desktop-app-ide): ...`) swept in the 17 pre-fix tests;
the delegate posted a corrective commit comment on it rather than amending.

#### Native wrapper foundation

Complete on `main`,
evidence in [`cli-git-native-foundation.md`](cli-git-native-foundation.md)
(17 commits from `df25471a9` to `48a1b5756`).
Delivered:
the typed `cli-git.config.jsonc` schema and loader,
real-Git resolution with self-exclusion,
Unix `exec` forwarding verified byte for byte against Git 2.56.0,
the child environment,
JSONL `engine-failure` and `configuration-warning` events,
the `git cli-git check|fix` grammar,
retired trust commands that explain themselves,
a bounded mutation runner,
and the `package/git-policy/cli.fuzz` sidecar with three ASAN targets.
The native executable stops every repository-changing command with exit 2,
because policy execution does not exist yet;
it is not installed and does not shadow `git`.
The main session read the final gate evidence
(`package/git-policy/cli/target/verification/native-dtC4QT`):
tests and Clippy passed on image `16f09e939ecefa1a500520d1b4ed0d9745e1f373305101cbb02743dcb1fc212a`;
the delegate reports 145 unit and 21 binary-level tests.
Both ledger findings are acted on:
every registry default equals the incumbent's `defaultSeverity`, pinned by a test,
and `resolution::wrapper_never_selects_itself_or_a_copy_of_itself` drives the built binary through
symlinks, hard links and byte copies earlier and later on `PATH`,
with a planted guard removal that makes it fail.
Mutation:
the last full campaign (`native-mutation-3CvHMl`) had 513 mutants,
429 caught,
56 unviable,
11 missed and 17 timeouts;
one missed mutant was later killed by a 64 KiB bound control,
8 of the remaining 10 are in `#[cfg(not(unix))]` code the Linux gate never compiles,
and 2 are documented as equivalent.
Fuzz smoke:
975,367, 359,412 and 49,392 executions on the three targets with no crash.
A flaky "Text file busy" fixture failure was diagnosed
(another test thread forking while a script was open for writing)
and fixed by writing fixtures through child processes:
74 failures in 400 runs at 16 threads before, 0 after.

Three of the following were decided by the user afterwards
(optional-policy defaults, the configuration root, and the legacy-file notice;
see `User decisions 2026-10-05`).
Open to veto at the time (detail in the foundation document):
namespaced policy names;
"option C" defaults, where the 4 policies that came from plugins are off when no `cli-git.config.jsonc` exists;
a bare severity accepted for option-taking policies;
the configuration root following `--git-dir` and `--work-tree`;
a legacy `.ts` config beside JSONC reported on every configuration-loading command;
symlinked configuration rejected and a 1 MiB size cap;
retired trust commands exiting 0;
exit 2 for every wrapper failure;
the new `configuration-warning` event;
the plugin and trust failure codes dropped.
Dependency needs recorded, not solved:
forwarding a signal from a waiting wrapper to its Git child needs signal handling the standard library lacks
(`signal-hook` or `libc`);
that is a technology choice for the transaction phase, where the wrapper waits instead of `exec`ing.
Oxlint reports 2 errors (banned `spawnSync`, banned `try...finally`) and several warnings in
`bin/test-native-container.mjs` and `bin/mutate-native-container.mjs`;
the linter package's runner scripts share the pattern.
Windows and macOS code paths were never compiled.

#### Native command parser and rule cores

Complete on branch `feat/cli-git-native-command-parser`,
evidence in [`cli-git-native-command-parser.md`](cli-git-native-command-parser.md).
It ports Git 2.56.0 `parse-options` tokenization,
the facts of `commit`, `push`, `status`, `add`, `reset`, `clean`, `stash`, `config` and branch creation,
and the pure cores of commit-only, atomic-push, status-hints, require-root and the index and sequencer checks,
with no process spawning or filesystem access.
Its gate passed 186 tests and Clippy.
Real-Git oracles:
2,591 argument lists against `git rev-parse --parseopt`,
29 option tables against `--git-completion-helper-all`,
and 625 `branch`, `checkout` and `switch` argument lists run against a fixture repository.
Hand-planted mutations:
114 in the first rounds with every survivor killed or its branch removed as unable to change an answer.
Integrated on `main` at `7d103c174` and pushed:
one merge commit `0a1959a3b` (the only conflict was the module list in `src/native/lib.rs`, resolved as the union),
then `e23f6fa18` removed the duplicated escape-hatch module in favor of `escape_hatch.rs`
and shared the identical test helpers `REAL_GIT` and `remove`.
The merged tree passed the wrapper gate with 322 unit and 21 binary-level tests and Clippy
(image tag `integrate-cli-git`, evidence `native-g7bnkQ`).
Landing merged `main` in once more (`7d103c174`);
the wrapper paths were verified byte-identical to the gated head before the fast-forward.
Open questions it raised, with the main session's working answers
(open to veto, except the require-root root, which the user decided; see `User decisions 2026-10-05`):

- A parser `OptionError` means Git itself refuses the command:
  forward it unchanged and let Git report the error, as the delegate recommends,
  so the wrapper never invents a different diagnosis of an invalid command.
- Require-root compares against the top level Git reports,
  matching the foundation's choice that the configuration root follows `--git-dir` and `--work-tree`;
  the incumbent's nearest-marker walk is recorded as the difference.
- Branch-creation facts read option names and argument counts only,
  so `--track=bogus` still counts as creation:
  keep rejecting it, because Git refuses it anyway and the policy's job is the worktree-first rule.
- Wrapper controls before the subcommand must be stripped from the global prefix before any rule runs;
  the policy engine owns that.

#### Wrapper runner lint

`bin/test-native-container.mjs` and `bin/mutate-native-container.mjs` now pass Oxlint with no errors or warnings
(commits `6bc2f15f3`, `9b99e49f3`, `9cd9935d5`; detail in the foundation document's
`Runners under the Oxlint configuration` section).
`spawnSync` became asynchronous `spawn` with the output cap kept,
`try...finally` became `await using` over disposable temporary directories and containers,
and regexes became single-pass string checks.
The gate on old and new scripts reported identical counts (322 unit and 21 binary-level tests, Clippy)
on the same image with byte-identical evidence files,
and a planted failing test still failed the task and left no temporary directory or container.
This was done before the engine phase because every later wrapper gate runs through these scripts.

Proposed, not applied:
type-aware Oxlint reports many `typescript(no-unsafe-*)` findings on every `bin/*.mjs` in the repository
because those scripts sit outside every `tsconfig.json` include list,
so `process` and `node:` imports have no types there.
The delegate measured 30 such findings on one helper without `/// <reference types="node" />` and 0 with it.
The configuration-level fix (a tsconfig that includes `bin/**/*.mjs`) changes shared configuration
that file-enforcer may own,
so it needs its own change after checking `file-enforcer.config.ts`.

#### Engine phase launched

The policy engine with the pre-forward built-ins and argv transforms (main checkout,
evidence `doc/handover/cli-git-native-policy-engine.md`)
and the candidate content layer with the scanner adapter (worktree `.claude/worktrees/cli-git-candidates`,
branch `feat/cli-git-native-candidates`, evidence `doc/handover/cli-git-native-candidates.md`).
The engine brief pins, each with a binary-level test:
wrapper controls stripped before any rule core runs
(today `git --cli-git-keep-going status` from a subdirectory would pass require-root);
one hatch-removal mechanism for detection and removal;
an explicit exit-2 refusal, derived from the behavior ledger,
for every command whose incumbent behavior needs unported processing;
a typed unavailable result for unsupported triggers;
and a read-only fast path that loads no configuration and starts no extra Git process.
The candidate brief requires a bounded Git process count for N staged candidates with a naive-reader positive control,
and staged-versus-worktree byte isolation for the scanner.
The optional policies follow once both land.
The wrapper's 16 spinning mutation timeouts wait until the engine delegate releases the native modules.

#### Second API session limit and file-enforcer manifests

All four running delegates stopped again on the API session limit and were resumed from their transcripts.
The engine and candidate delegates had not written anything yet.
The linter mutation runner and the scanner's Windows virtual machine (`mvm-wbase-20261005`) kept running
through the interruption;
a subagent that dies does not take its background processes with it,
so a resumed delegate must check them by process and evidence directory rather than wait for a notification.

A concurrent session's file-enforcer run left `package/git-policy/cli/Cargo.toml`
and `package/git-policy/cli.fuzz/Cargo.toml` modified.
`file-enforcer.config.ts` owns package Cargo manifests:
it derives `package.homepage` from the crate path
and pins `libfuzzer-sys` with the `arbitrary-derive` feature for fuzz sidecars.
The delegates' hand-written wrapper manifests had never been through it.
The main session committed its output as `ff3559d89`,
with the fuzz lockfile regenerated through `mise run //package/git-policy/cli.fuzz:lock`
(adds `derive_arbitrary` and its four proc-macro crates only).

Rule `WC2` in `AGENTS.md` now covers package `Cargo.toml` files (`0ae51048d`);
see `User decisions 2026-10-05`.

#### Mutation timeouts and the cargo-mutants exit status

23 timeouts were recorded across the linter and wrapper campaigns:
15 from `+=` replaced by `*=`,
3 from `-=` replaced by `/=`,
3 from `+=` replaced by `-=` in the wrapper's index-stepping argument scanners,
and 2 from constant replacements of `MarkdownSource::parent`.
cargo-mutants 27.1.0 exits 3 when any mutant times out and has no option to change that,
so no campaign containing one could pass.
Cause, reproduction, per-crate cost of the exclusion and the upstream state:
`doc/troubleshooting/cargo-mutants-timeout-exit-status.md` (`ee7d77b01`).

After the user's decision (see `User decisions 2026-10-05`):

- All three mutation runners pass `--exclude-re` for the two stalling replacement kinds:
  linter `af8431372`,
  wrapper `d86b7463c`,
  scanner `703a1c21d`.
  Measured with `cargo mutants --list --no-config`,
  the patterns remove 32 of 1,672 linter mutants,
  34 of 1,230 wrapper mutants
  and 5 of 526 scanner mutants.
- The wrapper's three scanners visit argument slices instead of stepping an index (`d1c02273a`).
- The linter's ancestor walks are bounded,
  so a circular parent lookup is a typed error;
  the delegate had also reshaped the linter's stalling loops before the decision arrived.
  Detail: `doc/handover/unified-linter-mutation-close.md`, section `Timeouts removed`.

Still open:
the linter's three campaigns and the wrapper campaign must each be rerun to 0 missed and 0 timeouts
on the final trees;
the delegates own those runs.

The troubleshooting entry's upstream check required a prototype of the option upstream issue 545 describes.
The main session wrote it against `v27.1.0` in a disposable clone
(`doc/troubleshooting/cargo-mutants-timeout-exit-status.patch`, `b7918044f`, results `61565a1a4`):
`--accept` and an `accept` configuration key with the values `timeout` and `missed`.
In a container without network,
an unpatched build exits 3 on a crate with one timing-out mutant,
and the patched build exits 0 with timeouts accepted,
2 when a missed mutant remains,
and 0 with both accepted or with the configuration key.
The format check passes;
the two unit tests and six Clippy errors that fail on the patched tree fail identically on the unpatched tree.
The full upstream integration suite was not run.
The 26 upstream integration tests that cover help, completions, configuration and options also pass.
On the user's decision the patch was posted as a comment on issue 545;
see `User decisions 2026-10-05`.

#### Open-decision brief

`doc/planning/cli-git-rust-open-decisions.md` (`07bc2f24b`) works through every item of the behavior ledger's
`Open questions`,
plus choices the delegate found outside that list.
Its `Verdict summary` separates the two outcomes.

Thirteen items are settled by evidence and are adopted unless the user vetoes them;
the section `Settled by evidence` lists each with its determining source.
Two of them have consequences worth the user's attention:

- The manual-push gate applies without a configuration file,
  which follows from "`{}` and no file behave identically".
  In a repository with no configuration,
  each real push then gains a dry-run negotiation with the remote.
  The native code already behaves this way.
- The spec requires recovery to run before read-only commands once recovery is ported,
  while the engine delegate's read-only fast path deliberately does nothing extra.
  That conflict is not settled here;
  it goes to the user with the transactions-phase questions.

Twenty-two items need the user,
in the batches of the brief's `Question batches` section.
The optional-policies batch is answered (see `User decisions 2026-10-05`).
Still to ask:
the transactions phase (nine questions in three batches)
and cutover (ten questions in three batches).

Findings from the brief that are not questions:

- A `commit` reached through an alias bypasses the commit rules.
  Measured with the installed incumbent in a disposable repository:
  `git commit -a -m direct` is rejected with `commit-only/all-flag`,
  and `git -c alias.c=commit c -a -m aliased` creates the commit.
  The native executable reproduces it.
  Whether to resolve aliases is one of the transactions-phase questions.
- This host's `/usr/bin/git` is 2.55.0 and the newest upstream tag is `v2.56.0`,
  so any run-time check for the supported Git fails here until Git is upgraded.
- The ledger's citations into the native source are stale by a few lines,
  and its `Open questions` still lists the three items decided earlier;
  the brief re-cites at native commit `4bef275e6`.

#### Third API session limit

All five running delegates stopped on the API session limit at about 17:20 on 2026-10-05
and were resumed from their transcripts at 18:51.
No container was running at that point,
so each was told to judge its interrupted campaign from the evidence directory rather than assume it finished.
The mvm delegate had about 27 modified and 4 new files uncommitted;
it was told to commit before each next step.
The open-decision brief existed only as an untracked file.
The linter mutation delegate stopped once more on 2026-10-06,
on an API authentication error (HTTP 403) during its second round,
and was resumed again.

#### Native policy engine

Complete for commands that need no commit transaction, worktree copy or manual-push scanning;
evidence in `doc/handover/cli-git-native-policy-engine.md` (last commit `53e6b6180`),
final source tree `348d94cbe`.
The wrapper is not near cutover:
the commit path,
which is the reason for the rewrite,
is not started.

- Gate on the final tree:
  442 unit and 37 binary-level tests,
  Clippy with warnings denied
  (`package/git-policy/cli/target/verification/native-eqKHwb`).
- Mutation over every file of `src/native/` with the two excluded replacement kinds:
  1,208 mutants,
  1,074 caught,
  134 that do not compile,
  0 missed,
  0 timeouts.
  Two earlier campaigns on a loaded host recorded timeouts that clustered at host stalls
  and became catches on a quieter rerun of the same image.
  The first campaign also found five missed mutants and four real stalls in the command parser,
  all removed with tests or by restructuring.
- Fuzz:
  a new `wrapper_controls` target,
  nine planted defects noticed,
  every target's smoke run exit 0.
- The native executable refuses, with exit 2 and one line naming what is missing,
  everything it cannot yet do correctly:
  every real commit,
  `git add` while a content policy is on (with defaults, every plain `git add`),
  a push that is not provably a dry run,
  and direct `check` or `fix` over content policies.
  The section `Refusal frontier` lists all eight cases with their tests.
- `policy-incomplete` exists as a code (`090c147e7`) but no engine path emits it yet:
  a policy whose own machinery can fail needs a second failing outcome in `run_policy_stage`.
- The section `Engine interface for the optional-policy phase` names the seam the next phase extends
  (`PolicyChecks::check`, `ShippedChecks`, `CandidateSource`).
- Left for the main session:
  `doc/handover/cli-git-native-foundation.md` still describes the executable and the survivor counts
  as they were before this delegate
  (its section `Superseded passages elsewhere` lists the passages),
  and a new `native:lint:rust` task reports 263 `require-rustdoc` findings in `src/native/`,
  212 of them on `use` statements;
  it is not part of the gate.

#### Candidate content layer and scanner adapter

Complete on branch `feat/cli-git-native-candidates` (`30c854f96`, gated at `d34761d35`);
evidence in `doc/handover/cli-git-native-candidates.md` on that branch.

- Gate: 398 unit, 21 binary-level and 1 public-interface test, Clippy
  (`native-fm9zle`), against a 322 and 21 baseline.
- A counting wrapper around real Git measured 2 Git processes for 1, 20 and 200 staged candidates;
  the positive control, a per-file reader, spawned 1, 20 and 200.
- The scanner sees staged bytes, not worktree bytes, in each swap the tests construct.
- Mutation: 147 mutants, 114 caught, 33 that do not compile, 0 missed, 0 timeouts, no exclusions needed.
- The wrapper lockfile is seeded from the scanner's lockfile (155 packages, 153 identical),
  through a new `native:lock:scanner` task;
  open to veto.
- Nothing is reachable from the executable yet,
  and these candidate sources are not provided:
  the `git add` staged delta,
  tracked non-candidate files,
  multi-commit listings for manual push,
  and worktree bytes for direct `check`.
- Merging into `main` conflicts in six files where both sides added entries at one place.
  The delegate is merging `main` into its branch,
  gating the merged tree and applying the failure-code mapping;
  the main session fast-forwards `main` afterwards.

#### mvm on a Flatpak-only libvirt host

Complete and committed (`f0d86a092` to `85ec58ea4`);
evidence in `doc/handover/mvm-flatpak-libvirt.md`,
diagnosis in `doc/troubleshooting/mvm-libvirt-flatpak-only-host.md`.

- `mvm` finds `virsh` and `qemu-img` on `PATH`,
  through `MVM_VIRSH_COMMAND` and `MVM_QEMU_IMG_COMMAND`,
  or inside the `org.virt_manager.virt-manager` Flatpak;
  this host needs no setting.
- Without `virtiofsd`,
  files move through the guest agent
  (about 0.2 to 0.4 MiB/s to the guest, about 3 MiB/s back).
- Both guest-agent defects from the scanner's Windows run are handled:
  an unanswered status poll is asked again,
  and every command prints a fresh marker so a reused process ID cannot return an older result.
  Neither was reproduced on a real guest;
  a stand-in `virsh` reproduces both.
- Real runs with the built command-line program, no shim and no hand-started daemon:
  Alpine and Windows Server 2025 guests created,
  commands run,
  files of 32 bytes, 1 MiB and 64 MiB round-tripped with matching SHA-256.
  One 64 MiB push to Windows failed when the agent went silent for almost three minutes under host load;
  the retry was then extended to five minutes (`95d283d0e`) and a second Windows guest took the file whole.
- The `mvm` MCP tools are unverified from a session:
  every running Claude Code session still holds an old server process.
  The user must restart the sessions that should use them.
- Nine choices are open to veto and seven items remain;
  the delegate's report sections `Decisions open to the human's veto` and `What remains` list them.

A new delegate is rerunning the scanner's Windows suite through the `mvm` command-line program alone,
which is also the first real consumer run of these changes.

#### Scanner Windows baseline and prefix confirmation

Detail: `doc/handover/scanner-native-verification.md`,
from `Windows virtual machine and bridges` to `Guest agent findings`.

- The prefix fix `833483171` is confirmed on Windows:
  a probe showed the name scanned and masked for all 18 prefix forms,
  and `windows_device_namespace_prefix_is_not_name_segment` compiled and passed there for the first time.
- The whole Windows suite at `fe805727c` ran 234 tests and passed 232, with none ignored or filtered.
  Five earlier baseline failures are fixed.
  The two that remain are the blocked-cache-root tests,
  which differ only in the reason word the platform reports.
- The pathname mutation scope on Windows tested 57 mutants:
  53 caught,
  none missed,
  4 unviable,
  no timeouts,
  with the same names as the Linux campaign.
- After the user accepted the platform difference,
  `aaf4c08e7` makes both tests assert the platform's reason
  (`unreadable` on Unix, `missing` on Windows)
  and `40fb4cdef` documents it.
  No virtual machine was started for that change,
  so the Windows suite has not been observed green:
  234 of 234 from `aaf4c08e7` on is expected, not measured.
- Two guest-agent bridge defects surfaced and were worked around in the run's own client:
  `mvm exec` exits 1 when one status poll exceeds the agent's 5-second timeout
  although the guest command keeps running,
  and an unread exit status keyed by process ID alone was returned for a later command that reused the ID.
  They are in the brief of the delegate that is changing mvm.
- The delegate finished at `703a1c21d`:
  `test:container` passed 182 library, 4 binary-unit, 2 embedding, 2 cache-warning, 40 CLI and 8 pathname tests,
  with `lint:clippy:container`, `lint:clippy:windows` and `lint:rust` clean.
  `lint:clippy:windows` compiles the Windows branch of both changed tests and runs neither.
- The scanner's mutation runner gained a `--list` flag (`cd1b9d1db`),
  not asked for,
  used to measure the exclusion through the runner itself.
  In the pathname scope the exclusion removes three mutants that every retained campaign had caught
  and none had timed out on,
  so for the scanner the user's "in any of our mutation runs" costs three caught mutants and removes no timeout.

Still open:
one Windows run at or after `aaf4c08e7` with both tests unfiltered and the failing positive control beside it,
whose mutation campaign also drops the two Windows-only `--skip` filters for those tests;
MSVC, which is unexercised;
and two non-blocking choices the delegate left
(the rustdoc of `platform_absolute_path`,
and `logical_path` with verbatim or differently cased Windows paths),
described in `doc/handover/scanner-native-verification.md`,
section `Decisions left after the Windows baseline follow-up`.

#### Isolated worktree settings

`.claude/settings.local.json` sets `worktree.baseRef` to `head`
and `worktree.symlinkDirectories` to `package/cli/forbidden-strings/target`.
An isolated agent then starts from the local checkout
and needs only `mise run prepare:pnpm:install` (15.5 seconds measured) before its first commit.
Listing `node_modules` as well failed the first commit
and would resolve workspace packages into the main checkout,
so it is not listed.
A worktree that has changes is left for the caller to remove,
and its branch is auto-pushed.
Evidence and the cleanup order:
`doc/troubleshooting/claude-code-worktree-create-hook-no-path.md`,
section `Worktree settings chosen and tested`.
Both probe worktrees and the pushed probe branch are removed.

### User decisions 2026-10-05

Asked through the question tool, with context restated, as rule `QRX` requires.

- No parity rule goes into `AGENTS.md`.
  The main session proposed a rule that choices settled by a parity measurement against an incumbent
  are adopted with evidence instead of waiting for acceptance.
  The user declined:
  "AGENTS.md are read by all types of agents and adding this rule is inviting lesser, weaker agents to bomb me."
  Rejected idea; do not re-propose.
  The correction in `User correction: no vetting decision gate` still stands for this session's work.
- Rule `WC2` is extended to package `Cargo.toml` files (`0ae51048d`, with the regenerated `CLAUDE.md`).
  The rule stays at 197 characters, inside the tagged-rule budget.
- file-enforcer gets no check mode.
  The user:
  "Check mode is delibrately not built because it'd go against file-enforcer's naming and philosophy."
  The issue was framed around where enforcement should run instead:
  [#607](https://github.com/Aquaticat/Monochromatic/issues/607),
  "file-enforcer: new managed files can be committed before they are enforced".
  Do not propose a drift-reporting mode.
- `cctt` is unregistered from `WorktreeCreate`,
  in `.claude/settings.local.json` and the terminal-title README (`495f36355`).
  Built-in worktree isolation works again.
  Detail: `doc/troubleshooting/claude-code-worktree-create-hook-no-path.md`, section `Fix applied`.
- Both Claude Code `worktree` settings are set and tested,
  the option the user picked over leaving isolation unprovisioned.
  Result: `Isolated worktree settings` under `Delegate results`.
- The restricted LFS URL normalizer is kept.
  The 289 endpoint forms the old linter accepts and the native one refuses are accepted as a behavior change.
- The wrapper's four optional policies (forbidden-strings, forbidden-root-context, dependent-version-bump,
  Markdown autofix) run only when `cli-git.config.jsonc` lists them.
  This replaces the foundation's "option C", where a present file turned all nine on;
  `{}` and no file now behave identically.
  Cutover consequence:
  this repository's translated config must list all four,
  including `mono/dependent-version-bump`, which the incumbent ran at `error` without the root config naming it.
- The wrapper's repository root is the top level Git reports,
  for both configuration lookup and require-root,
  honoring `--git-dir`, `--work-tree` and their environment forms.
  The incumbent's nearest-marker walk is an intentional difference.
- A legacy `cli-git.config.ts` beside the JSONC file is reported only by `git cli-git check`.
  Ordinary commands stay silent about it during the rollback period.
  A legacy file with no JSONC file stays a migration error.
- `rust/no-anonymous-functions` rolls out at `warn` everywhere and is raised to `error` when the count reaches zero.
  The user chose this over a per-file burn-down list;
  the draft configuration in `doc/planning/unified-linter.md` is updated.
- Mutation timeouts.
  Asked first whether to exclude, restructure or patch,
  the user answered:
  "Can we change the tool to not do that?"
  The source says no for 27.1.0
  (`doc/troubleshooting/cargo-mutants-timeout-exit-status.md`).
  Asked again with that answer,
  the user chose to skip the two stalling replacement kinds in every mutation runner
  and fix the five timeouts those kinds do not cover in code.
  `+=` replaced by `-=` stays in every campaign.
- mvm learns this host's setup,
  where libvirt exists only inside the `org.virt_manager.virt-manager` Flatpak and there is no `virtiofsd`,
  instead of each run carrying its own shims.
  A delegate owns `package/cli/mvm` for this;
  diagnosis: `doc/troubleshooting/mvm-libvirt-flatpak-only-host.md`.
  The mvm tools in a running session need a reload by the user after the build.
- The scanner keeps reporting the platform's own reason for a cache root blocked by a regular file
  (`unreadable` on Unix, `missing` on Windows).
  The user accepted the difference rather than mapping either platform onto the other;
  the tests and the README state it.

- The scanner's private rules file is named by a `rulesFile` option in `cli-git.config.jsonc` first,
  then by `FORBIDDEN_STRINGS_RULES`,
  then by the default file.
  The user chose this over keeping the variable alone (silent built-in-only scan when it is absent)
  and over configuration alone.
  Implemented in the optional-policies phase;
  this repository's translated configuration must then set `rulesFile`.
- The failure code of a shipped policy that could not finish is chosen by cause:
  `content-unavailable` when repository content or a fact could not be read,
  `policy-incomplete` when the policy's own machinery failed.
  `plugin-threw` is not carried over and no code is added.
  The engine delegate adds `policy-incomplete` to the native code set.
- The dependent-version bump ends with one implementation, in the native wrapper:
  the release task calls `git cli-git fix` for that policy
  and the TypeScript planning code is deleted at cutover.
  Before that,
  both entry points must be shown to give the same result on the release workflow's input,
  and the release workflow must be able to build or fetch the native executable.
- The cargo-mutants prototype is posted as a comment on upstream issue 545
  (the user chose a comment over a pull request and over keeping it local):
  <https://github.com/sourcefrog/cargo-mutants/issues/545#issuecomment-6005242222>.

- A signal that reaches the wrapper while it waits for Git is caught:
  the wrapper passes it to Git only when the sender was a process and not the terminal,
  waits for Git,
  releases its locks and removes the transaction.
  Chosen over ending at once (today) and over relaying every signal.
- When real Git was ended by a signal, the wrapper exits with 128 plus the signal number.
- Hook entry files on Linux and macOS are symbolic links to the wrapper named after the hook;
  the wrapper acts on the name it was started under.
- Hook entry files on Windows are `<hook>.exe` hard links to the wrapper,
  or copies when the Git directory is on another volume.
  This rests on reading Git's source;
  nothing was run on Windows.
  The user selected no option for this one and wrote:
  "I'm going with all your recommendations this turn".

The no-config, repository-root and legacy-config decisions were sent to the engine delegate,
which owns the affected modules,
to implement with tests before building further on those defaults.
The failure-code decision went to the engine delegate as well,
and the failure-code and rules-file decisions to the candidate-layer delegate,
whose scanner adapter they describe;
neither changes that branch's scope.
The engine delegate landed the optional-policy and legacy-config decisions as `329de1b97`.

#### Standing instruction for this session

In the same answer the user added:
"for this session,
for options that blows all other options out of the water,
adopt them directly,
no need to burn a question on that."
The main session therefore adopts a clearly dominant option,
records it with its reason under `Adopted without a question`,
and keeps it open to veto;
it asks only where options trade real costs against each other.
The instruction is for this session and is not a repository rule.

#### Adopted without a question

From the transactions-phase items of `doc/planning/cli-git-rust-open-decisions.md`,
each for the reason given;
all remain open to the user's veto.

- Locks and journals interoperate with the incumbent in both directions while both are in use,
  including identical process birth-identity strings.
  The implementation plan states this as its default,
  and the alternatives need a moment when no session is committing,
  which this repository rarely has.
  A better identity scheme can follow after the rollback period.
- A legacy `cli-git-transaction` directory makes the native wrapper stop with instructions
  to run the previous executable once.
  No instance exists in this checkout,
  the format was superseded on 2026-09-25,
  and the previous executable stays available through the rollback period.
- The test-only crash switch (`CLI_GIT_TEST_ONLY_PHASE_SIGNAL`) is in the release executable.
  The plan requires container tests to exercise the installed executable,
  and the landing steps can be reached only through that switch;
  Git itself reads `GIT_TEST_*` variables in its ordinary executable.
- A file name that is not UTF-8 appears in an event as a readable `path`
  plus a new optional `pathBytes` field with the exact bytes.
  It only adds a field,
  where escaping in place would change every existing name that contains a backslash
  and replacing bytes would make the file unidentifiable.
- An alias that expands to `commit` gets the commit rules.
  Measured:
  `git -c alias.c=commit c -a` commits today while `git commit -a` is rejected,
  so keeping today's behavior keeps a one-argument bypass of the rules.
- Recovery of interrupted transactions also runs before read-only commands,
  as the spec and the incumbent do,
  for every command that already asks Git for the repository location.
  The check is one directory lookup after a query that runs anyway,
  and without it `git status` after a crash can show a state recovery was about to repair.
  Commands that start no Git process (`version`, `help`, native queries) stay exempt.
- The read-only fast path's accepted contract is what the engine delegate measured:
  no configuration or lease read,
  no Git process for exempt commands,
  exactly one (the location query) otherwise.
  The plan's "no extra work" cannot hold together with the decision that the root is what Git reports.
- For the scanner adapter,
  `policy-incomplete` also covers an unrepresentable pathname,
  a stale candidate and a pathname with a line break:
  none is a failure to read repository content,
  and the incumbent treated the line-break case as an engine failure.

The cutover questions of that brief are not asked or adopted yet.

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

- Tool-managed worktree isolation failed in this repository until the registration was removed
  (see `User decisions 2026-10-05`):
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
- [ ] Scanner on Windows: the prefix fail-open fix (`833483171`) is confirmed on Windows,
  and the suite passed 232 of 234 tests at `fe805727c`.
  The two remaining tests now assert the platform's reason (`aaf4c08e7`);
  a Windows run that shows 234 of 234 beside a failing positive control is still owed
  (a delegate is running it through `mvm`),
  and MSVC is unexercised.
- [ ] Mutation gates exit 0 with the two excluded replacement kinds, 0 missed and 0 timeouts.
  Done for the wrapper on its final engine tree (`348d94cbe`) and for the candidate branch;
  the linter's scopes are still being rerun by their delegate,
  and the merged wrapper tree needs its own campaign.
- [x] cargo-mutants upstream check: the option from upstream issue 545 is prototyped and verified
  (`doc/troubleshooting/cargo-mutants-timeout-exit-status.md`, section `Prototype`).
- [x] The user chose to post the cargo-mutants prototype as a comment on upstream issue 545; it is posted.
- [x] Transactions-phase decisions: four answered by the user,
  the rest adopted under the standing instruction (`User decisions 2026-10-05`).
- [ ] Cutover decisions from `doc/planning/cli-git-rust-open-decisions.md`, section `Question batches`:
  adopt the clearly dominant ones and ask the rest before cutover work starts.
- [x] Rust cli-git configuration, Git resolution/argv, static policies, and management commands
  for commands that need no commit transaction:
  on `main`, final engine tree `348d94cbe` (`Native policy engine`).
- [ ] Merge the candidate content layer into `main` after its merged-tree gate.
- [ ] Content policies over candidates:
  the missing candidate sources (`git add` staged delta, worktree bytes for direct `check`, manual-push listings),
  the five built-in content policies,
  then the four optional policies
  (forbidden-strings with the `rulesFile` option and an emitting path for `policy-incomplete`,
  forbidden-root-context,
  dependent-version propagation as the one implementation,
  Markdown autofix through the native linter).
  This repository's translated configuration must list all four optional policies and set `rulesFile`.
- [ ] Rust cli-git transactions, hooks, locks, replay, recovery, worktree copy, and auto-push.
- [ ] Container integration, mutation testing, fuzzing, platform checks, and release-artifact performance gates.
  Mutation survivors from both campaigns need disposition or new controls.
- [ ] Coordinated native installation, consumer migration, documentation, and retirement of old implementations.
- [x] Native LFS URL normalization: owner selected by differential measurement,
  and `markdown/lfs-image-url` is in the native linter (`LFS URL normalizer` and `Linter executable` results).
- [x] Behavior ledger for the wrapper (`doc/planning/cli-git-rust-behavior-ledger.md`).

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

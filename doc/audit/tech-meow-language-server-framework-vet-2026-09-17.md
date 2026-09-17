# Technology vet: meow language server framework

Status:
 complete.
Lifecycle phase:
 recommended;
 discovery saturated,
 three finalists validated and scored,
 every one-at-a-time sensitivity test preserved the order,
 recommendation `lsp-server` 0.10.0 with `gen-lsp-types` 0.11.0
 ("Recommendation").
Not adopted:
 no decision record exists.

Subject:
 meow language server framework.

Decision scope:
 select the Rust crate that carries the Language Server Protocol transport and dispatch
 for the language server that ships inside the meow single-file binary.

Start date:
 2026-09-17.

Last updated:
 2026-09-17.

Governing skill:

- Commit `a05818ad70a40e5769a36de669697ba109891b31`.
- SHA-256 `393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`.

Compatibility fingerprint:
 `e6c575549543f9224ff7fc7056bc83cbec52e089d7016715ab222a68706f6132`.
Fingerprint input and lock tooling:
 `~/temp/agent/hcl-evaluator-2026-09-17/scripts/vet-fingerprint-lock.ts`.

Active audit owner:
 Claude Code session `e28ad59c-f3f5-46e9-8c8c-59a61c331610` (subagent).

Prior compatible report:
 none.
Related but incompatible:
 [`tech-meow-hcl-front-end-vet-2026-09-17.md`](tech-meow-hcl-front-end-vet-2026-09-17.md)
 selects the parse layer this server sits on.

Process deviation recorded up front:
 written in one pass at the end of the audit rather than updated at each phase.

## Context

Measured or read on 2026-09-17.

- meow is designed but not implemented,
   so there is no incumbent language server and no existing protocol code to keep working.
- Distribution is a single file
   (`doc/planning/monorepo-manager-from-scratch-design.md`,
   "Distribution"),
   so the server is a subcommand of the same binary rather than a second executable.
- The rest of meow is synchronous command-line work,
   so an async runtime entering the binary for the language server alone is a real cost,
   not a neutral choice.
- The server answers from the same trees and the same evaluator as the command line,
   so its value depends on meow's own code,
   not on the framework's feature list.
- `opentofu/tofu-ls` is the closest comparable server.
   Verified:
   27675 lines of Go across 233 files,
   built on `hashicorp/hcl-lang`'s 17375-line schema layer,
   both shaped for Terraform's provider schema rather than meow's blocks,
   so it is a reference for feature scope and not a reusable component.

## Classification

Base category:
 inspectable open-source local technology.

Overlays:
 human auditability;
 multi-platform claim.

## Frozen hard constraints

- HC1:
   speaks LSP over stdio and answers `initialize`,
   diagnostics,
   completion,
   hover,
   definition,
   formatting,
   and `shutdown` from a built binary.
- HC2:
   builds for x86_64 and aarch64 Linux,
   glibc and static musl,
   with no C or assembly toolchain.
- HC3:
   published on crates.io.
- HC4:
   license permits distribution inside an LGPL-3.0-or-later binary.
- HC5:
   builds from source at the audited revision.
- HC6:
   inspectable source small enough to read in full.
- HC7:
   ships inside the same binary as the rest of meow,
   with no second executable.

## Frozen soft criteria and weights

- LC1,
   weight 5:
   answers the protocol from a built binary.
- LC2,
   weight 4:
   maintenance and release cadence.
- LC3,
   weight 4:
   upstream tests that pass at the audited revision.
- LC4,
   weight 4:
   binary size added to a static musl build.
- LC5,
   weight 3:
   source auditability.
- LC6,
   weight 3:
   execution model fit with a synchronous tool.
- LC7,
   weight 2:
   protocol features provided rather than left to meow.
- LC8,
   weight 3:
   adoption by comparable language servers.

## Unresolved preferences

None.
The protocol types crate is a separate,
 smaller decision recorded in "Protocol types",
and it is decided on measured evidence rather than asked.

## Discovery protocol

### Frozen query schedule

Source class 1,
 crates.io:

1.  keyword `lsp`;
2.  free-text `language server protocol`,
     sorted by downloads;
3.  expansion round from ledger taxonomy terms:
    `tower-lsp`,
     `lsp types`,
     `jsonrpc stdio`.

Source class 2,
 GitHub:
manifests of language servers written in Rust,
read directly through the API to see which framework each one actually depends on.

Source class 3,
 the broader web:
`opentofu/tofu-ls` and `hashicorp/hcl-lang` as the feature reference for an HCL language server.

Source class 4,
 this repository:
no incumbent;
`doc/planning/monorepo-manager-from-scratch-design.md` for the distribution constraint.

### Recorded queries

Recorded in `data/crates-queries.jsonl`.

- crates.io `/api/v1/crates`,
   kind `keyword`,
   value `lsp`,
   sort relevance,
   100 per page,
   6 pages fetched,
   reported total 596,
   returned 596.
   This enumeration completed.
- crates.io `/api/v1/crates`,
   kind `q`,
   value `language server protocol`,
   sort downloads,
   100 per page,
   10 pages fetched,
   returned 1000,
   reported total not provided.
   The provider returns HTTP 400 beyond page 10 for free-text search,
   so this query hit a provider cap rather than exhaustion.
   Per the skill,
   a capped query does not saturate a source class;
   the keyword enumeration above is the independent path that completed it,
   and the cap is recorded here rather than hidden.

Source class 2 read 30 repository manifests through `gh api`,
recorded in `data/lsp-adoption.jsonl`,
of which 25 returned a manifest and 5 returned HTTP 404 for the guessed path.

### Discovery ledger

#### `lsp-server` 0.10.0

Source class 1 and 2.
Category:
 synchronous LSP transport and dispatch,
 maintained inside `rust-lang/rust-analyzer`.
Screening result:
 survivor,
 promoted to finalist.
Verified metadata:
 published 2026-07-16,
 `MIT OR Apache-2.0`,
 18327-byte crate,
 26 versions,
3 releases in the past year,
 207 reverse dependencies,
 15822501 all-time downloads.

#### `tower-lsp-server` 0.23.0

Source class 1 and 2.
Category:
 async LSP framework,
 community fork of `tower-lsp`.
Screening result:
 survivor,
 promoted to finalist.
Verified metadata:
 latest `0.24.0-rc.1` published 2026-09-11,
 `MIT OR Apache-2.0`,
 71456-byte crate,
7 versions,
 2 releases in the past year,
 82 reverse dependencies,
 2148980 all-time downloads.
The audited and measured version is 0.23.0,
 the newest stable.

#### `async-lsp` 0.2.4

Source class 1 and 2.
Category:
 async LSP framework built on `tower` layers.
Screening result:
 survivor,
 promoted to finalist.
Verified metadata:
 published 2026-04-24,
 `MIT OR Apache-2.0`,
 51303-byte crate,
 11 versions,
2 releases in the past year,
 34 reverse dependencies,
 1496583 all-time downloads.

#### `tower-lsp` 0.20.0

Source class 1 and 2.
Category:
 async LSP framework,
 the original.
Screening result:
 exit at HC5.
Verified:
 `cargo test` fails to compile at revision `49e1ce5` in four feature combinations
(`--all-features`,
 `runtime-tokio`,
 `runtime-agnostic`,
 and both with `proposed`),
with `WorkspaceDiagnosticRefresh` not in scope;
last release 2023-08-11;
repository pushed 2024-08-15 with 41 open issues;
the community fork `tower-lsp-server` exists because of this.
The published 0.20.0 does build as a dependency,
 and its size was measured,
but a dependency whose own source tree does not build is one meow cannot fix without forking.

#### `lspower` 1.5.0

Source class 1.
Category:
 earlier fork of `tower-lsp`.
Screening result:
 exit.
Verified:
 last release 2021-12-07,
 0 releases in the past year,
 30726 recent downloads,
license `Apache-2.0 WITH LLVM-exception`.

#### `auto-lsp` 0.6.2

Source class 1.
Category:
 higher-level server framework with `tree-sitter` integration.
Screening result:
 exit at HC4 and category.
Verified:
 `GPL-3.0`,
 which conflicts with distribution inside this project's LGPL-3.0-or-later binary
as a matter that would need legal review rather than a build flag;
846674-byte crate;
1 reverse dependency;
0 releases in the past year.

#### `lsp-server-tokio` 0.1, `tower-lsp-f`, `realhydroper-lsp`, `laburnum`, `lspt`, `lsp-codec`, `lsprotocol`

Source class 1.
Category:
 small forks,
 experiments,
 or protocol codecs.
Screening result:
 exit on adoption and maintenance.
Verified:
 11323,
 25149,
 6160,
 1642,
 4576,
 840080,
 and 6469 all-time downloads respectively,
none appearing in any of the 25 language-server manifests read in source class 2.

#### `lsp-types` 0.97.0, `ls-types` 0.0.6, `gen-lsp-types` 0.11.0, `lsp-textdocument` 0.5.0

Source class 1 and 2.
Category:
 protocol type definitions and document helpers,
 not transports.
Screening result:
 separate sub-decision,
 recorded in "Protocol types".

### Adoption evidence

Read from the actual manifests of 25 language servers,
 `data/lsp-adoption.jsonl`.

- `lsp-types`:
   `rust-lang/rust-analyzer`,
   `astral-sh/ruff`,
   `tamasfe/taplo`,
   `oxalica/nil`,
   `slint-ui/slint`,
   `wgsl-analyzer/wgsl-analyzer`,
   `nushell/nushell`.
- `gen-lsp-types`:
   `rust-lang/rust-analyzer`,
   `wgsl-analyzer/wgsl-analyzer`.
   Verified line in rust-analyzer's manifest:
   `lsp-types = { version = "0.11.0", package = "gen-lsp-types", features = ["url"] }`.
- `lsp-server`:
   `astral-sh/ruff`,
   `slint-ui/slint`,
   `nushell/nushell`,
   and `rust-lang/rust-analyzer` itself,
   whose manifest line is `lsp-server.workspace = true`.
- `tower-lsp-server`:
   `biomejs/biome`,
   `oxc-project/oxc`,
   `tekumara/typos-lsp`,
   `Automattic/harper`.
- `tower-lsp`:
   `kdl-org/kdl-rs`,
   `terror/just-lsp`,
   `Feel-ix-343/markdown-oxide`,
   `rvben/rumdl`,
   `uiua-lang/uiua`.
- `async-lsp`:
   `oxalica/nil`.
- `lsp-async-stub`:
   `tamasfe/taplo`.

### Terminal discovery result

Saturated with at least two survivors:
three finalists.
Source class 1 completed through the keyword enumeration after the free-text query hit the provider cap.

## Execution manifest

Identical to the front-end vet:
`scripts/run-box.ts`,
image `localhost/hashvet-rusttest:2`
digest `sha256:efe5b287e1875e44129878945b0a2cbc630bec17eec0b9b063fbf5e37822c3bf`,
bounds `--memory=2g --cpus=2 --pids-limit=512 --ulimit nofile=4096:4096 --network=none`,
no credentials,
 no repository mount,
host toolchain `nightly-2026-09-12-x86_64-unknown-linux-gnu` mounted read-only,
target directories under `~/temp/agent/hcl-evaluator-target-2026-09-17/`.

Consumer-boundary runs were driven from the host by `scripts/lsp-client.ts`,
which starts the built binary,
 speaks LSP over stdio with `Content-Length` framing,
and records every reply.

## Evidence records

All dates are 2026-09-17.

### L1: consumer boundary

Candidates:
 all four frameworks including `tower-lsp` 0.20.0.
Method:
 build a minimal server with each framework,
then drive it with a scripted client that sends `initialize`,
 `initialized`,
 `didOpen`,
`completion`,
 `hover`,
 `definition`,
 `formatting`,
 and `shutdown`.
Artifacts:
 `data/lsp-consumer-lsp-server.json`,
 `data/lsp-consumer-tower-lsp-server.json`,
`data/lsp-consumer-async-lsp.json`,
 `data/lsp-consumer-tower-lsp.json`.
Result:
 each server returned 7 messages and exited 0,
answering every request and publishing diagnostics after `didOpen`.
HC1 passes for all four.

### L2: upstream suites

Method:
 run each project's own tests in the container at the cloned revision.
Artifact:
 `data/lsp-suites.jsonl`.
Result:
`tower-lsp-server` `a6ab04d`:
 44 passed,
 0 failed with `runtime-tokio`;
 44 passed,
 0 failed with
`runtime-agnostic`.
`async-lsp` `e3d479d`:
 4 passed with `--all-features --all-targets`,
 2 doc tests passed,
 0 failed.
`lsp-server` 0.10.0:
 `cargo test --lib` gives 10 passed,
 0 failed.
`tower-lsp` `49e1ce5`:
 compile failure in all four attempted feature combinations.

### L3: `lsp-server` packaging quirk

Method:
 run the published crate's full test command.
Result:
 `cargo test` fails with `unresolved import lsp_types`,
because the crate's integration tests and examples depend on types and helpers
that are not dev-dependencies of the published package.
Workaround verified:
 add `gen-lsp-types` as a dev dependency to a scratch copy
and run `cargo test --lib`,
 which passes 10 tests.
This is a packaging defect in the published artifact,
 not a defect in the library meow would link.
Recorded here rather than as a troubleshooting document,
because it affects auditing the crate rather than using it.

### L4: size

Method:
 one feature per framework,
 minimal server,
 `x86_64-unknown-linux-musl`,
`opt-level = 3`,
 `lto = true`,
 `codegen-units = 1`,
 `strip = true`,
 `panic = "abort"`.
Artifact:
 `data/sizes.jsonl`.
Result,
 over a 455424-byte baseline:
`lsp-server` with `lsp-types` 729968 (274544 added);
`async-lsp` with `tokio`,
 `tower`,
 `lsp-types` 0.95.1 1241984 (786560 added);
`tower-lsp-server` with `tokio` 1954704 (1499280 added);
`tower-lsp` with `tokio` 2126736 (1671312 added).
A `tokio` baseline with `rt`,
 `io-std`,
 `io-util`,
 and `macros` is 562064,
so the runtime alone is 106640 bytes and the rest is framework and generated protocol code.
Verified first attempt:
 the `tower-lsp-server` build initially failed with `E0063`,
a missing `offset_encoding` field in `InitializeResult`;
the measurement is from the successful rebuild using `..InitializeResult::default()`.

### L5: source surface

Method:
 file and line counts,
 plus pattern counts,
 over the cloned sources.
Artifact:
 `data/lsp-source-audit.jsonl`.
Result:
`lsp-server` 1129 lines in 6 files,
 10 tests,
 0 `unsafe`,
 0 `cancelRequest` matches;
`async-lsp` 2954 lines in 11 files,
 3 tests,
 3 `unsafe`,
 3 `catch_unwind`,
 3 `cancelRequest`;
`tower-lsp` 5403 lines in 16 files,
 14 tests,
 0 `unsafe`,
 9 `cancelRequest`;
`tower-lsp-server` 5949 lines in 17 files,
 14 tests,
 0 `unsafe`,
 11 `cancelRequest`.
All four have zero matches for `position_encoding`,
 `positionEncoding`,
 or `PositionEncoding`,
so UTF-16 position conversion is meow's work in every case.

### L6: maintenance

Artifact:
 `data/maintenance.jsonl`.
Result:
`tower-lsp-community/tower-lsp-server` pushed 2026-09-11,
 224 stars,
 2 open issues,
releases `v0.24.0-rc.1` 2026-09-11,
 `v0.23.0` 2025-12-07,
 `v0.22.1` 2025-08-05;
contributors show 507 commits inherited from the original author plus 60 by the active maintainer.
`oxalica/async-lsp` pushed 2026-08-09,
 178 stars,
 4 open issues,
 `v0.2.4` 2026-04-24;
contributor list is 158 commits by one person and 1 each by three others;
3 of the 20 sampled issues and pull requests are open.
`ebkalderon/tower-lsp` pushed 2024-08-15,
 1362 stars,
 41 open issues,
 last release 2023-08-11.
`rust-lang/rust-analyzer`,
 which contains `lsp-server`,
 pushed 2026-09-17 and releases weekly.

### L7: async-lsp shutdown quirk

Method:
 consumer-boundary run.
Result:
 a `Router` that omits `request::Shutdown` answers `-32601 No such method shutdown`,
because `LifecycleLayer` tracks lifecycle state and forwards the request rather than answering it.
Adding the handler fixed it,
 and the rebuilt binary answered all seven messages.
Recorded as a usage foot-gun,
 not a library defect.

### L8: license

`lsp-server`,
 `tower-lsp-server`,
 `async-lsp`,
 and `tower-lsp` are all `MIT OR Apache-2.0`.
`lsp-types`,
 `ls-types`,
 and `gen-lsp-types` are `MIT`.
`auto-lsp` is `GPL-3.0` and exits on that basis.
HC4 is therefore not a differentiator among the finalists.

## Hard-gate outcomes

- `lsp-server` 0.10.0:
   HC1 to HC7 all pass.
- `tower-lsp-server` 0.23.0:
   HC1 to HC7 all pass.
- `async-lsp` 0.2.4:
   HC1 to HC7 all pass.
- `tower-lsp` 0.20.0:
   HC5 fail,
   exit.
- `auto-lsp` 0.6.2:
   HC4 concern,
   exit.

## Score arithmetic

Computed by `scripts/score.ts`.

`lsp-server` 0.10.0:
LC1 4 high,
 LC2 4 high,
 LC3 2 high,
 LC4 4 high,
 LC5 4 high,
 LC6 4 high,
 LC7 1 high,
 LC8 4 high.
Earned 98 of 112,
 normalized 87.5.

`tower-lsp-server` 0.23.0:
LC1 4 high,
 LC2 4 high,
 LC3 4 high,
 LC4 1 high,
 LC5 2 high,
 LC6 1 high,
 LC7 4 high,
 LC8 3 high.
Earned 82 of 112,
 normalized 73.2.

`async-lsp` 0.2.4:
LC1 4 high,
 LC2 2 medium,
 LC3 2 high,
 LC4 2 high,
 LC5 3 high,
 LC6 1 high,
 LC7 3 medium,
 LC8 1 high.
Earned 65 of 112,
 normalized 58.0.

Rating justifications for the values that carry the decision:

- `lsp-server` LC3 is 2 because only its library tests could be run,
   and the published crate's own integration tests do not build;
   10 passing library tests keep it at acceptable rather than weak.
- `lsp-server` LC7 is 1 because it provides framing and dispatch and nothing else:
   no cancellation,
   no lifecycle tracking,
   no position encoding.
- `tower-lsp-server` LC4 is 1 because 1499280 bytes is 5.5 times the smallest option,
   and LC6 is 1 because it requires an async runtime in an otherwise synchronous binary.
- `async-lsp` LC2 is 2 with medium confidence because activity is real but concentrated in one person,
   and LC8 is 1 because exactly one of the 25 manifests read depends on it.

## Sensitivity

Every criterion weight was moved across 1 through 5 one at a time (40 tests),
and every medium-confidence rating was moved one step down and up (4 tests).

Result:
 the order `lsp-server` then `tower-lsp-server` then `async-lsp` held in all 44 tests.
No test changed the winner or any adjacent pair.
Stability was tested one input at a time and does not cover simultaneous changes.

## Pros and cons

### `lsp-server` 0.10.0

Pros:
smallest addition at 274544 bytes;
1129 readable lines with zero `unsafe`;
maintained inside rust-analyzer,
 which releases weekly;
used by `ruff`,
 `slint`,
 `nushell`,
 and rust-analyzer itself;
synchronous,
 so meow's binary keeps one execution model;
`MIT OR Apache-2.0`.

Cons:
provides framing and dispatch only,
so cancellation,
 lifecycle state,
 and position encoding are meow's work;
the published crate's own integration tests and examples do not build.

### `tower-lsp-server` 0.23.0

Pros:
the most active framework,
 with releases through 2026-09-11;
44 tests passing on both runtime feature sets;
the most protocol machinery provided,
 including `cancelRequest` handling;
used by `biome`,
 `oxc`,
 `typos-lsp`,
 and `harper`.

Cons:
1499280 bytes added,
 the largest of the surviving three;
requires `tokio`;
5949 lines to audit against 1129.

### `async-lsp` 0.2.4

Pros:
tower layers compose cancellation,
 concurrency,
 and tracing;
786560 bytes,
 between the other two;
2954 lines.

Cons:
4 tests in the whole crate;
one maintainer with 158 of 161 commits;
one adopter among the 25 manifests read;
a shutdown foot-gun that produces `-32601` until the router registers `Shutdown`;
still requires `tokio` in practice.

## Complete ranking

1.  `lsp-server` 0.10.0.
2.  `tower-lsp-server` 0.23.0.
3.  `async-lsp` 0.2.4.
4.  `tower-lsp` 0.20.0,
     exited at a hard gate.

Adjacent-pair reasons.

- `lsp-server` over `tower-lsp-server`:
   1224736 fewer bytes and no async runtime in a binary whose every other subcommand is synchronous,
   against protocol conveniences meow can write once in a loop it already owns.
- `tower-lsp-server` over `async-lsp`:
   44 passing tests against 4,
   a maintained community project against a single maintainer,
   and 4 adopters among the manifests read against 1.
- `async-lsp` over `tower-lsp`:
   `async-lsp` builds and passes its tests at the audited revision;
   `tower-lsp` does not compile at HEAD in any feature combination tried and has no release since 2023.

## Protocol types

A separate,
 smaller decision,
decided here on measured evidence rather than asked.

Verified sizes,
 static musl,
 over the 455424-byte baseline,
each linking a program that deserializes `InitializeParams` and serializes `ServerCapabilities`:
`lsp-types` 0.97.0 at 758528 (303104 added);
`ls-types` 0.0.6 at 770816 (315392 added);
`gen-lsp-types` 0.11.0 at 824064 (368640 added).
The `gen-lsp-types` probe sets a different capability field because its generated API differs,
so its number is comparable to within a few kilobytes rather than exactly.

Verified maintenance:
`lsp-types` 0.97.0 was published 2024-06-04 with 0 releases in the past year and 476 reverse dependencies;
`ls-types` 0.0.6 was published 2026-03-08 with 5 releases in the past year and 11 reverse dependencies;
`gen-lsp-types` 0.11.0 was published 2026-07-28 with 12 releases in the past year and 13 reverse dependencies.

Recommendation:
`gen-lsp-types` 0.11.0,
because rust-analyzer,
 the project that also maintains `lsp-server`,
 depends on it
(`lsp-types = { version = "0.11.0", package = "gen-lsp-types", features = ["url"] }`),
because it is regenerated against the specification 12 times in the past year
while `lsp-types` has not been released since 2024-06-04,
and because the 65536-byte difference against `lsp-types` is small next to the recommendation's
274544-byte transport.
`ls-types` is the second choice,
 and would be first if meow ever moved to `tower-lsp-server`,
which depends on it.

## Confidence and evidence limits

- Sizes were measured for `x86_64-unknown-linux-musl` only.
- The minimal servers exercise the protocol,
   not meow's workload;
   nothing here measures how each framework behaves under a real editing session.
- Maintenance evidence is a point-in-time sample of the GitHub API on 2026-09-17.
- `tower-lsp-server` 0.24.0-rc.1 exists but was not measured;
   0.23.0,
   the newest stable,
   was.
- No estimate is offered for how long any option takes to implement,
   per rule CK3.

## Recommendation

Adopt `lsp-server` 0.10.0 with `gen-lsp-types` 0.11.0
for the language server that ships inside the meow binary,
run from a hidden `meow lsp` subcommand over stdio.
Write meow's own request cancellation and UTF-16 position conversion,
which every candidate leaves to the consumer anyway.

Revisit if meow's architecture becomes async for other reasons,
in which case `tower-lsp-server` becomes the better fit and carries `ls-types` with it.

## Adoption boundary

This report recommends;
it does not adopt.
Adoption needs a decision record under `doc/decision/`,
created only after the user accepts or delegates the decision,
 per rule DRR.

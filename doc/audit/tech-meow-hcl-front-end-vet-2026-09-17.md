# Technology vet: meow HCL front end

Status:
 complete.
Lifecycle phase:
 recommended;
 discovery saturated,
 three finalists validated and scored,
 the winner stable under every one-at-a-time sensitivity test,
 recommendation `hcl-edit` 0.9.7 carried with two local patches
 ("Recommendation").
Not adopted:
 no decision record exists.

Subject:
 meow HCL front end.

Decision scope:
 select the library that lexes,
 parses,
 and writes back HCL for meow
 (placeholder name of the single-file all-Rust monorepo manager),
 under which meow owns the evaluator,
 the function library,
 and the formatter.

Start date:
 2026-09-17.

Last updated:
 2026-09-17.

Governing skill:

- Commit `a05818ad70a40e5769a36de669697ba109891b31`
   (last commit touching `.agents/skills/choosing-technology/SKILL.md`;
   `.claude/skills/choosing-technology/SKILL.md` is an ignored mirror with identical bytes).
- SHA-256 `393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`.

Compatibility fingerprint:
 `78c5879d60feefa00c38c70c134fc5713739acd2c139476d11a34dd6aa78170d`.
Fingerprint input and lock tooling:
 `~/temp/agent/hcl-evaluator-2026-09-17/scripts/vet-fingerprint-lock.ts`.

Active audit owner:
 Claude Code session `e28ad59c-f3f5-46e9-8c8c-59a61c331610` (subagent).

Prior compatible report:
 none.
When this audit started,
 no file in `doc/audit/` started with `tech-meow-hcl-front-end-vet-`.
Related but incompatible:
 [`tech-monorepo-manager-vet-2026-09-16.md`](tech-monorepo-manager-vet-2026-09-16.md) selects the tool itself,
 and [`tech-meow-cache-key-hash-vet-2026-09-17.md`](tech-meow-cache-key-hash-vet-2026-09-17.md)
 selects a hash for the same tool.

Process deviation recorded up front:
 this report was written in one pass at the end of the audit,
 rather than created at threshold crossing and updated at each phase
 as the skill's "Update throughout the audit" section asks.
 The evidence it cites was collected before it was written,
 and every command is reproducible.

## Context

Measured or read on 2026-09-17.

- meow is designed but not implemented
   (`doc/planning/monorepo-manager-from-scratch-design.md`,
   "Status"),
   so there is no incumbent library.
   The nearest incumbent is `file-enforcer.config.ts`,
   2329 lines of TypeScript,
   which is the configuration meow's HCL is meant to replace.
- The configuration syntax is settled as HCL,
   OpenTofu shaped,
   with a light endorsement of the syntax and the full language allowed,
   including author-defined functions and recursion
   (task statement,
   and `doc/planning/monorepo-manager-route-research/stack-declarative-config.md`).
- Managed edits must preserve comments;
   untouched bytes and CRLF need not be preserved (task statement).
   This makes write-back fidelity a decision-level property rather than a nicety.
- Distribution is a single file for Linux x86_64 and aarch64,
   glibc and static musl,
   published to crates.io and GitHub Releases
   (`doc/planning/monorepo-manager-from-scratch-design.md`,
   "Distribution" and "Platforms and builds").
- `doc/decision/monorepo-manager-all-rust.md` records that the tool is all-Rust.
   A C toolchain in the build is therefore a constraint question,
   not a taste question.
- The user's settled position is that library gaps are not disqualifiers by themselves,
   and that writing much more repository code is accepted.
   This report therefore gates on measured defects
   (data loss on write-back,
   process aborts,
   conformance failures,
   build constraints)
   and never on a missing feature.
   That resolves,
   explicitly,
   the tension with the skill's
   "Existing tools before custom implementation" rule:
   the custom parts here are the evaluator,
   the function library,
   and the formatter,
   which the user already decided meow writes,
   and this vet selects only the layer underneath them.

## Classification

Base category:
 inspectable open-source local technology.

Overlays:

- human auditability,
   because meow's diagnostics and managed edits depend on this layer being readable;
- multi-platform claim,
   because four Linux targets must build;
- native,
   Wasm,
   prebuilt binary,
   or generated-code boundary,
   because one candidate ships a generated C parser.

## Frozen hard constraints

- HC1:
   accepts every input the Go reference implementation accepts,
   and rejects every input it rejects,
   measured over the corpus.
- HC2:
   parsing to a tree and printing that tree back reproduces the input byte for byte,
   or the deviations are bounded,
   understood,
   and fixable.
- HC3:
   every node carries a source byte span usable for diagnostics under rule DGT.
- HC4:
   comments survive parse and write-back.
- HC5:
   builds for x86_64 and aarch64 Linux,
   glibc and static musl,
   with no C or assembly toolchain.
- HC6:
   published on crates.io so the release can depend on it.
- HC7:
   license permits distribution inside an LGPL-3.0-or-later binary.
- HC8:
   inspectable source.
- HC9:
   no process abort on inputs a user can type,
   or a bounded mitigation meow can apply outside the library.

## Frozen soft criteria and weights

Weights are 1 through 5 and were frozen before ratings were assigned.

- SC1,
   weight 5:
   conformance with the Go reference over the corpus.
- SC2,
   weight 5:
   write-back fidelity and comment preservation.
- SC3,
   weight 4:
   source spans available for diagnostics.
- SC4,
   weight 3:
   robustness on adversarial and deeply nested input.
- SC5,
   weight 3:
   maintenance and release cadence.
- SC6,
   weight 3:
   source auditability.
- SC7,
   weight 4:
   dependency surface and all-Rust build.
- SC8,
   weight 2:
   binary size added.
- SC9,
   weight 4:
   fit for the formatter,
   managed edits,
   and the language server.

## Unresolved preferences

One preference is unresolved and is asked of the user rather than decided here:
whether meow carries a patched `hcl-edit`,
owns the parser outright,
or accepts the two measured write-back defects unpatched.
The recommendation below assumes the first,
and the question with options,
 pros,
 cons,
 and a ranking is in the design appendix
that accompanies this audit.

## Discovery protocol

### Frozen query schedule

Source class 1,
 the category registry,
 crates.io:

1.  free-text `hcl`;
2.  keyword `hcl`;
3.  free-text `hashicorp configuration language`;
4.  expansion round,
     from taxonomy terms found in the ledger:
    `terraform parser`,
     `tree-sitter grammar`,
     `cty`.

Source class 2,
 the repository host,
 GitHub:

1.  `hcl language:rust`;
2.  `hashicorp configuration language rust`;
3.  organization projects for `hashicorp`,
     `opentofu`,
     `martinohmann`.

Source class 3,
 the broader web:
peer implementations of HCL outside Rust,
used to establish the reference implementation and the semantics to conform to,
namely `hashicorp/hcl`,
 `zclconf/go-cty`,
 `opentofu/opentofu`,
 `opentofu/tofu-ls`,
 `hashicorp/hcl-lang`.

Source class 4,
 this repository:
`file-enforcer.config.ts` as the incumbent configuration;
`doc/planning/monorepo-manager-route-research/stack-declarative-config.md` as the prior design;
`doc/decision/monorepo-manager-all-rust.md` as the governing decision;
`doc/audit/` for prior reports.

### Recorded queries

Recorded in `~/temp/agent/hcl-evaluator-2026-09-17/data/crates-queries.jsonl`.

- crates.io `/api/v1/crates`,
   kind `q`,
   value `hcl`,
   sort relevance,
   100 per page,
   3 pages fetched,
   reported total 209,
   returned 209.
- crates.io `/api/v1/crates`,
   kind `keyword`,
   value `hcl`,
   sort relevance,
   1 page,
   reported total 21,
   returned 21.
- crates.io `/api/v1/crates`,
   kind `q`,
   value `hashicorp configuration language`,
   sort relevance,
   1 page,
   reported total 86,
   returned 86.
- GitHub search for HCL repositories in Rust,
   42 repositories captured in `data/gh-repos-hcl-rust.json`,
   with full name,
   description,
   stars,
   archived flag,
   and last update.

No filter removed results before recording.
De-duplicated across queries,
 282 distinct crates were seen,
of which 89 mention HCL,
 HashiCorp,
 Terraform,
 or OpenTofu in name or description.

### Discovery ledger

Each row is a candidate,
 its discovery source,
 its category,
 and its screening result.

#### `hcl-edit` 0.9.7

Source class 1,
 free-text `hcl`.
Category:
 HCL parser and write-back tree.
Screening result:
 survivor,
 promoted to finalist.
Verified metadata:
 published 2026-08-09,
 `MIT OR Apache-2.0`,
 68561-byte crate,
 53 versions,
6 releases in the past year,
 5 reverse dependencies,
 2077344 all-time downloads.

#### `hcl-rs` 0.19.8

Source class 1,
 free-text `hcl`.
Category:
 HCL parser,
 value tree,
 evaluator,
 and serde support.
Screening result:
 survivor,
 promoted to finalist.
Verified metadata:
 published 2026-08-09,
 `MIT OR Apache-2.0`,
 108039-byte crate,
 81 versions,
6 releases in the past year,
 77 reverse dependencies,
 1923525 all-time downloads.

#### `hcl-primitives` 0.1.12

Source class 1.
Category:
 shared primitives of the same project.
Screening result:
 not an independent candidate;
it is a dependency of both crates above.

#### `tree-sitter-hcl` 1.1.0

Source class 1,
 free-text `hcl`.
Category:
 generated incremental parser with a C runtime.
Screening result:
 survivor,
 promoted to finalist.
Verified metadata:
 published 2025-05-16,
 `Apache-2.0`,
 60729-byte crate,
 1 version on crates.io,
0 releases in the past year,
 51 reverse dependencies,
 2352404 all-time downloads.

#### `arborium-hcl` 2.18.2

Source class 1.
Category:
 alternative packaging of the same tree-sitter grammar.
Screening result:
 exit,
 duplicate of `tree-sitter-hcl` for this decision,
and it carries the same generated-C boundary.

#### `babbel_hcl` 0.2.1

Source class 1.
Category:
 HCL parser in Rust.
Screening result:
 exit at HC1.
Verified:
 rejects 199 of the 2185 corpus files the reference accepts.
Verified metadata:
 14 all-time downloads,
 1 version,
 repository `clockworkengineer/babbel`
with 1 star and 1 contributor.

#### `hashicorp-configuration-language-rs`

Source class 2,
 GitHub.
Category:
 HCL parser,
 evaluator,
 formatter,
 and language server in Rust.
Screening result:
 exit at HC1,
 HC6,
 and HC9.
Verified:
 rejects 85 valid files and panics on 1;
aborts by stack overflow at nesting depth 20000;
panics with `byte range starts at 2 but ends at 1` on nested interpolations at depth 10;
returns 404 from the crates.io API;
repository has 0 stars,
 0 releases,
 1 contributor,
 4 commits.

#### `ensan` 0.2.1

Source class 1,
 free-text `hcl`.
Category:
 evaluator layered on `hcl-rs`.
Screening result:
 exit.
Verified:
 last release 2024-05-28,
 0 releases in the past year,
 0 reverse dependencies,
17571-byte crate,
 33 recent downloads.
It inherits every `hcl-rs` evaluation defect measured in this audit,
and adds no parse or write-back capability.

#### `DanielMSchmidt/rust-hcl` and `DanielMSchmidt/rust-cty`

Source class 2,
 GitHub.
Category:
 hand ports of the Go implementation.
Screening result:
 exit at HC6.
Verified:
 290 `todo!()` bodies in `rust-hcl` and 369 in `rust-cty`,
and neither is published to crates.io.

#### `jimmycuadra/rust-hcl`, `evq/molysite`, `miller-time/hq`

Source class 2,
 GitHub.
Category:
 older or partial HCL parsers and a command-line processor.
Screening result:
 exit.
Verified:
 `jimmycuadra/rust-hcl` last updated 2025-10-03 with 16 stars,
`molysite` last updated 2023-02-04 with 10 stars,
`hq` is a consumer tool rather than a library.

#### Consumers and unrelated name collisions

`hcl2json`,
 `nu_plugin_hcl`,
 `cloud_terrastodon_hcl`,
 `cloud_terrastodon_hcl_types`,
 `hclua`,
 `template-cli`,
`hq-rs`,
 `slo-converter`,
 `envhub`,
 `nomadcfg`:
consumers of an HCL library rather than candidates.
`hcl` (a cryptography crate),
 `hcloud`,
 `ghcl`,
 `mathcli`,
 `oauthcli`,
 `dixscript`,
 `ncl`:
name collisions or different languages.
All exit at category mismatch.

### Expansion round

Taxonomy terms collected from the ledger:
`tree-sitter grammar`,
 `cty`,
 `terraform parser`,
 `winnow`,
 `rowan`,
 `cstree`,
 `logos`.
The expansion round searched for parser-construction libraries meow could build on directly
(`winnow` 1.0,
 `rowan`,
 `cstree`,
 `logos`),
which are recorded as inputs to the own-parser option in the design appendix rather than as
front-end candidates,
because none of them parses HCL.

### Terminal discovery result

Saturated with at least two survivors:
three finalists,
 `hcl-edit`,
 `hcl-rs`,
 and `tree-sitter-hcl`.
Source class 1 finished its frozen schedule with the reported totals above,
each under one page beyond the last new survivor.
No provider cap was hit in this vet's queries.

## Execution manifest

Every build,
 benchmark,
 and suite ran through `~/temp/agent/hcl-evaluator-2026-09-17/scripts/run-box.ts`,
which records each run in `data/logs/executions.jsonl` with image,
 digest,
 bounds,
 workdir,
 command,
status,
 signal,
 elapsed seconds,
 and log path.

- Image `localhost/hashvet-rusttest:2`,
   digest `sha256:efe5b287e1875e44129878945b0a2cbc630bec17eec0b9b063fbf5e37822c3bf`.
- Bounds on every run:
   `--memory=2g --cpus=2 --pids-limit=512 --ulimit nofile=4096:4096 --network=none`.
- No credentials,
   no repository mount,
   no network.
- Toolchain:
   host `nightly-2026-09-12-x86_64-unknown-linux-gnu` mounted read-only at `/toolchain`,
   `CARGO_HOME=/t/cargo-home`,
   `CARGO_NET_OFFLINE=true`.
- Cargo target directories under `~/temp/agent/hcl-evaluator-target-2026-09-17/` with `CACHEDIR.TAG`.
- 68 executions recorded.

The reference implementation used as the oracle is a small Go program,
`lab/go-oracle/main.go`,
built against the local `hashicorp/hcl` and `zclconf/go-cty` clones through `replace` directives,
with modes `validate`,
 `eval`,
 `evalfile`,
 `format`,
 `formatall`,
 and `bench`.

The corpus is 2246 files and 1317750 bytes:
every `.tf`,
 `.tofu`,
 `.hcl`,
 and `.tfvars` file in the `opentofu`,
 `hcl`,
 `hcl-rs`,
 `tofu-ls`,
 and `hcl-lang`
clones,
plus `corpus/meow-inventory.hcl` (12618 bytes,
 every `hcl` fence of the meow configuration research),
`corpus/hetzner.tf` (27689 bytes),
and `corpus/comments.hcl` (1318 bytes,
 a comment in every position the grammar allows).

## Evidence records

Each record names the candidate and version,
 the method,
 the command,
 the artifact,
 and the date.
All dates are 2026-09-17.

### E1: acceptance against the reference

Candidates:
 `hcl-edit` 0.9.7,
 `babbel_hcl` 0.2.1,
 `hashicorp-configuration-language-rs` `b665927`,
`tree-sitter-hcl` 1.1.0 with `tree-sitter` 0.27.0.
Method:
 parse all 2246 corpus files with each engine and with `hclsyntax.ParseConfig`,
 compare outcomes.
Commands:
`run-box.ts go-oracle-validate ... oracle validate /w/corpus/list-all.txt`,
`run-box.ts roundtrip-hcl-edit ... /t/probe-hcl/release/roundtrip`,
`run-box.ts probe-others-run ... /t/probe-others/release/probe-others`.
Artifacts:
 `data/go-validate.jsonl`,
 `data/roundtrip-hcl-edit.jsonl`,
 `data/probe-others.jsonl`.
Result:
reference accepts 2185 and rejects 61;
`hcl-edit` matches exactly on both sets;
`babbel_hcl` fails 199 of the accepted;
`hashicorp-configuration-language-rs` fails 85 and panics on 1;
`tree-sitter-hcl` reports no `ERROR` node on any accepted file and also none on 5 rejected files.

### E2: write-back fidelity

Candidate:
 `hcl-edit` 0.9.7.
Method:
 parse and print each accepted file,
 compare bytes,
 classify differences.
Artifacts:
 `data/roundtrip-hcl-edit.jsonl`,
 `data/roundtrip-hcl-edit-diffs.txt`.
Result:
 2153 of 2185 byte identical;
 32 differ;
1 file loses 2 comments inside binary operations;
31 files lose a `<<-` heredoc introducer or change heredoc body indentation.
Root causes and prototype fixes are recorded in
`doc/troubleshooting/hcl-edit-binary-operator-decor.md` and
`doc/troubleshooting/hcl-edit-heredoc-dedent.md`.

### E3: prototype fixes verified

Candidate:
 `hcl-edit` 0.9.7 in a disposable clone with pushes disabled.
Method:
 build a targeted harness,
 run it before and after the patch,
then run the whole upstream workspace suite.
Artifacts:
 `data/logs/proto-operator-build-pre.log`,
 `proto-operator-build-post.log`,
`proto-heredoc-pre.log`,
 `proto-heredoc-post.log`,
`proto-operator-upstream-test-post.log`,
 `proto-heredoc-upstream-test-post.log`,
patches in `data/hcl-edit-operator-decor.patch` and `data/hcl-edit-heredoc-dedent.patch`.
Result:
 the harness reproduces the loss before each patch and preserves the bytes after;
the upstream workspace suite is 243 passed and 0 failed across 23 test binaries with each patch applied.

### E4: evaluator conformance

Candidate:
 `hcl-rs` 0.19.8.
Method:
 21 semantic cases evaluated by `hcl::eval` and by `hclsyntax` plus `go-cty`,
 compared.
Artifacts:
 `data/logs/semantics-release.log`,
 `data/logs/semantics-checked.log`,
`data/logs/go-oracle-eval.log`.
Result:
 12 of 21 diverge,
 including wrapping integer arithmetic,
 saturation instead of infinity,
insertion-order object iteration against the specification's lexicographic order,
a panic on remainder by zero,
and a `-9223372036854775809` literal that evaluates to `9223372036854775807`.
Rebuilt with overflow checks,
 4 of those cases panic instead of returning a wrong value.
A prototype fix and a new 12-case conformance test are recorded in
`doc/troubleshooting/hcl-rs-eval-arithmetic-and-iteration-order.md`;
the new test failed 5 assertions before the patch and the whole workspace passes 248 tests after.

### E5: spans

Candidates:
 `hcl-edit` 0.9.7,
 `hcl-rs` 0.19.8.
Method:
 source reading.
Result:
 `hcl-edit` exposes `fn span(&self) -> Option<Range<usize>>` on `Spanned`,
 `Decorated`,
 and `Formatted`
(`crates/hcl-edit/src/repr.rs` lines 91 to 94);
`rg 'span' crates/hcl-rs/src/` returns no matches,
and evaluation errors carry `expr: Option<Expression>` (`crates/hcl-rs/src/eval/error.rs` line 168).

### E6: robustness

Candidates:
 `hcl-edit` 0.9.7,
 `tree-sitter-hcl` 1.1.0,
 `hashicorp-configuration-language-rs`,
and the Go reference as a control.
Method:
 nested and adversarial inputs,
 each parsed in a child process with a wall clock cap.
Artifacts:
 `data/logs/depth-hcl.log`,
 `data/logs/robust-run.log`,
 `data/logs/go-deep.log`.
Result:
 `hcl-edit` aborts with signal 6 at nesting depth 5000 for every shape;
the Go reference survives depth 20000 and dies at depth 100000 with
`runtime: goroutine stack exceeds 1000000000-byte limit`;
`tree-sitter-hcl` survives every shape at every size tested;
`hashicorp-configuration-language-rs` aborts at depth 20000 and panics on nested interpolations at depth 10.
Neither `hcl-edit` nor `hclsyntax` has a configurable depth limit.

### E7: build and size

Candidates:
 all three finalists.
Method:
 one feature per library,
 built for `x86_64-unknown-linux-musl` with
`opt-level = 3`,
 `lto = true`,
 `codegen-units = 1`,
 `strip = true`,
 `panic = "abort"`.
Artifact:
 `data/sizes.jsonl`.
Result:
 baseline 455424 bytes;
`hcl-edit` 799488 (344064 added);
`hcl-rs` with evaluation 951072 (495648 added);
`tree-sitter` with `tree-sitter-hcl` 639808 (184384 added).
All three built for static musl inside the container.
`tree-sitter` compiles C through `cc` as part of that build.

### E8: speed

Candidates:
 `hcl-edit` 0.9.7,
 `hcl-rs` 0.19.8,
 Go reference.
Method:
 7 runs each,
 median and band recorded per rule QNB.
Artifacts:
 `data/logs/bench-hcl.log`,
 `data/logs/bench-go.log`.
Result at 12618 bytes:
`hcl-edit` parse 371.1 microseconds median with a 30.5 percent band,
`hcl-rs` parse 431.8,
Go parse 1245.5.
At 1024529 bytes:
 `hcl-edit` 33.2 MiB per second,
 Go about 10.4 MiB per second.
Speed decides no pair here:
 every candidate is far inside an editor's and a CLI's budget,
and the run-to-run band at realistic sizes exceeds the differences that matter.

### E9: license and dependency surface

Method:
 manifest reading.
Result:
`hcl-edit` and `hcl-rs` are `MIT OR Apache-2.0`;
`tree-sitter-hcl` is `Apache-2.0` and `tree-sitter` is `MIT`;
`hashicorp-configuration-language-rs` is `CC0 OR MIT OR Apache-2.0`;
`babbel_hcl` is `MIT`.
All are compatible with distribution inside an LGPL-3.0-or-later binary,
so HC7 passes for every candidate and is not a differentiator.
`hcl-edit` has five direct dependencies:
`fnv`,
 `hcl-primitives`,
 `pratt`,
 `vecmap-rs`,
 `winnow`,
 all pure Rust.
`tree-sitter-hcl` depends on `tree-sitter`,
 which builds a C runtime and a generated C parser.

### E10: source auditability

Method:
 line counts and pattern counts over the cloned sources.
Result:
`hcl-edit` is 9934 lines of Rust across 37 source files with 36 test functions and zero `unsafe`;
`hcl-rs` is 14962 lines with 90 test functions;
`hcl-primitives` is 1601 lines;
`tree-sitter-hcl` ships a generated C parser whose table code is not meaningfully reviewable,
plus an external scanner in C.

### E11: maintenance

Method:
 GitHub API through `gh`,
 recorded in `data/maintenance.jsonl`.
Result:
`martinohmann/hcl-rs` pushed 2026-09-05,
 185 stars,
 11 open issues,
 not archived,
releases `hcl-rs-v0.19.8`,
 `hcl-edit-v0.9.7`,
 and `hcl-primitives-v0.1.12` all on 2026-08-09,
contributor concentration 406 commits by the maintainer with the next humans at 4,
 2,
 and 2.
`tree-sitter-grammars/tree-sitter-hcl` pushed 2026-09-17,
 146 stars,
 11 open issues,
tags through `v1.2.0` on 2025-06-16 while crates.io serves 1.1.0,
issue 49 "Infinite loop on fuzzing input" open since 2024-06-22 with a 2026 comment saying it no longer
reproduces,
issues 77 and 78 describing scanner serialization and a host-dependent `CHAR_MAX` in the external scanner,
contributor concentration 141 commits by one maintainer.

Single-maintainer concentration is recorded for both surviving projects
and is reflected in SC5 rather than treated as a hard gate,
per the skill's rule that a sparse tracker is not a hard failure.

## Hard-gate outcomes

- `hcl-edit` 0.9.7:
   HC1 pass (E1),
   HC2 pass with bounded and fixed deviations (E2,
   E3),
   HC3 pass (E5),
   HC4 pass with the
   same patches (E2,
   E3),
   HC5 pass (E7),
   HC6 pass,
   HC7 pass (E9),
   HC8 pass (E10),
   HC9 pass only with meow's own pre-scan,
   because the library aborts at depth 5000 and has no knob (E6).
- `hcl-rs` 0.19.8:
   HC1 pass,
   HC2 fail for its own write path
   (`hcl::format` deletes every comment and is not idempotent,
   `data/logs/format-hcl-rs.log`),
   HC3 fail (E5),
   HC4 fail,
   HC5 pass,
   HC6 pass,
   HC7 pass,
   HC8 pass,
   HC9 fail (panic on `% 0`,
   E4).
   Retained as a scored finalist rather than an exit,
   because it shares the parser with `hcl-edit` and the failures are in the layers meow would not use;
   the scoring reflects that it fails four gates in the role being selected.
- `tree-sitter-hcl` 1.1.0:
   HC1 fail (accepts 5 invalid files,
   E1),
   HC2 not applicable in the same sense
   (no printer;
   edits are byte-range operations),
   HC3 pass,
   HC4 pass,
   HC5 fail as stated by `doc/decision/monorepo-manager-all-rust.md`,
   because the build compiles C,
   HC6 pass,
   HC7 pass,
   HC8 partial (generated tables),
   HC9 pass (E6).
- `babbel_hcl`,
   `hashicorp-configuration-language-rs`,
   `rust-hcl`,
   `rust-cty`,
   `ensan`:
   exits recorded in the ledger.

Two finalists fail hard gates in the role being selected.
The skill keeps hard gates outside the arithmetic,
so the scores below rank the finalists on soft criteria while the gate outcomes stand on their own.
`hcl-edit` is the only finalist that passes every gate,
with HC9 passing only because meow can apply the mitigation outside the library.

## Finalist validation

Each finalist was exercised at the boundary meow would use,
not only compiled.

- `hcl-edit` 0.9.7:
   parsed and printed 2246 files;
   parsed and evaluated the depth series;
   printed `corpus/comments.hcl` for comment behaviour;
   benchmarked at three sizes;
   built for static musl;
   patched in a disposable clone and re-run against the upstream suite.
- `hcl-rs` 0.19.8:
   parsed and evaluated 21 semantic cases in two build profiles;
   formatted `corpus/comments.hcl`;
   benchmarked;
   built for static musl;
   patched and re-run against the upstream suite with a new conformance test.
- `tree-sitter-hcl` 1.1.0:
   parsed all 2246 files and counted `ERROR` nodes;
   parsed 7 adversarial shapes at 4 sizes each in child processes;
   built for static musl.

Upstream suites run:
the `hcl-rs` workspace suite,
 243 passed and 0 failed across 23 binaries at the patched revisions,
248 passed across 24 binaries with the added conformance test.
The `tree-sitter-hcl` grammar suite was not run;
its robustness was measured directly through the Rust binding instead,
which is the boundary meow would use.
That omission is recorded rather than hidden.

## Score arithmetic

Computed by `~/temp/agent/hcl-evaluator-2026-09-17/scripts/score.ts`.

`hcl-edit` 0.9.7:
SC1 4 high,
 SC2 2 high,
 SC3 4 high,
 SC4 1 high,
 SC5 3 medium,
 SC6 3 high,
 SC7 4 high,
 SC8 3 high,
SC9 4 medium.
Earned 105 of 132,
 normalized 79.5.

`tree-sitter-hcl` 1.1.0:
SC1 1 high,
 SC2 3 medium,
 SC3 4 high,
 SC4 4 high,
 SC5 2 medium,
 SC6 2 medium,
 SC7 1 high,
 SC8 4 high,
SC9 2 medium.
Earned 80 of 132,
 normalized 60.6.

`hcl-rs` 0.19.8:
SC1 4 high,
 SC2 1 high,
 SC3 1 high,
 SC4 0 high,
 SC5 3 medium,
 SC6 3 high,
 SC7 4 high,
 SC8 2 high,
SC9 2 medium.
Earned 75 of 132,
 normalized 56.8.

Rating justifications for the values that carry the decision:

- `hcl-edit` SC2 is 2,
   not 4,
   because 32 of 2185 files change on write-back today;
   it is not 0 or 1 because both causes are understood,
   patched,
   and verified.
- `hcl-edit` SC4 is 1 because a process abort at depth 5000 is a serious concern,
   raised above 0 only because the failure is a stack overflow on absurd input,
   is reproducible,
   and is avoidable from outside the library.
- `tree-sitter-hcl` SC1 is 1 because accepting invalid input is the opposite of what a validator needs,
   raised above 0 because it never mis-parses valid input.
- `tree-sitter-hcl` SC7 is 1 because a C toolchain in the build is an open user question,
   asked but unanswered in the cache key hash vet,
   raised above 0 because the build nonetheless succeeded for static musl in the container.
  Correction on 2026-09-17:
   `doc/decision/monorepo-manager-all-rust.md` says the tool is written in Rust;
   it does not forbid a dependency that compiles C.
- `hcl-rs` SC4 is 0 because it panics on `5 % 0`,
   which is input a user can type.

## Sensitivity

Every test was run one input at a time by the same script:
each criterion weight raised and lowered across 1 through 5 (45 tests),
and every medium-confidence rating moved one step down and up (18 tests).

Result:
`hcl-edit` is first in all 63 tests.
The order of the two non-recommended finalists is not stable:
5 weight tests and 1 rating test swap `tree-sitter-hcl` and `hcl-rs`,
namely lowering SC2 or SC3 to 1 or 2,
 lowering SC4 to 1,
and moving `tree-sitter-hcl`'s medium-confidence SC2 from 3 to 2.
Those are exactly the criteria on which the two differ most,
so the swap is expected rather than a sign of an unstable rubric.

The recommendation therefore rests on a stable first place,
and the second and third places are reported as conditional:
`tree-sitter-hcl` is second when write-back and spans are weighted as frozen,
and `hcl-rs` is second when they are weighted down.
Stability was tested one input at a time and does not cover simultaneous changes.

## Pros and cons

### `hcl-edit` 0.9.7

Pros:
exact acceptance agreement with the reference over 2246 files;
spans on every node;
a tree that preserves comments and whitespace by construction;
five pure-Rust dependencies and zero `unsafe`;
9934 readable lines;
344064 bytes added;
the same tree serves evaluation,
 formatting,
 managed edits,
 and the language server.

Cons:
32 files change on write-back until the two patches land;
no error recovery,
 so a syntactically broken file yields one error and no tree;
a process abort at nesting depth 5000 with no knob;
a project whose commit history is 406 commits by one maintainer.

### `tree-sitter-hcl` 1.1.0

Pros:
the most robust parser measured,
 including on the input from its own open fuzzing issue;
native error recovery;
smallest binary addition at 184384 bytes;
51 reverse dependencies and heavy editor use.

Cons:
accepts 5 invalid files,
 so it cannot be the validator;
a C toolchain in the build,
 which is an open user question;
crates.io serves 1.1.0 while the repository tags v1.2.0;
open issues on the external scanner;
no comment-preserving write-back model,
 so managed edits and the formatter would be built twice.

### `hcl-rs` 0.19.8

Pros:
the same parser as `hcl-edit`;
a value tree and serde support that make small consumers short;
77 reverse dependencies;
the largest test suite of the three.

Cons:
12 of 21 semantic cases diverge from the reference;
a panic on remainder by zero;
numbers limited to `u64`,
 `i64`,
 and `f64` against a specification that requires at least 256-bit integers
and infinities;
no spans in evaluation errors;
its formatter deletes every comment and is not idempotent;
a sealed `Evaluate` trait and a bare function pointer table that cannot hold a closure.

## Complete ranking

1.  `hcl-edit` 0.9.7.
2.  `tree-sitter-hcl` 1.1.0,
     conditionally,
     under the frozen weights.
3.  `hcl-rs` 0.19.8,
     conditionally,
     under the frozen weights.

Adjacent-pair reasons.

- `hcl-edit` over `tree-sitter-hcl`:
   `hcl-edit` matches the reference exactly on acceptance and rejection over 2246 files
   while `tree-sitter-hcl` accepts 5 invalid ones,
   and `hcl-edit` needs no C toolchain,
   which is an open user question rather than a settled ban.
- `tree-sitter-hcl` over `hcl-rs`:
   under the frozen weights,
   write-back fidelity and spans dominate,
   and `hcl-rs`'s own write path deletes comments while its evaluation errors have no spans;
   this pair swaps when those two criteria are weighted down,
   as the sensitivity section records.

## Confidence and evidence limits

- The corpus is Terraform-shaped.
   No meow configuration exists yet beyond the synthetic inventory file,
   so conformance is proven against the language,
   not against meow's idioms.
- The `tree-sitter-hcl` grammar's own test suite was not run.
- Maintenance evidence is a point-in-time sample of the GitHub API on 2026-09-17.
- Binary sizes were measured for `x86_64-unknown-linux-musl` only;
   aarch64 sizes were not measured.
- Nothing here measures how long it takes to write meow's evaluator,
   and no such estimate is offered,
   per rule CK3.

## Recommendation

Adopt `hcl-edit` 0.9.7 as meow's HCL front end:
lexing,
 parsing,
 the comment-preserving tree,
 spans,
 and write-back.
Carry it with the two verified patches
(`data/hcl-edit-operator-decor.patch`,
 `data/hcl-edit-heredoc-dedent.patch`)
until equivalent fixes land upstream,
and re-run the 2246-file round-trip probe on every upgrade,
which takes under a second in the container.
Apply meow's own nesting pre-scan before handing bytes to the parser,
because the library aborts at depth 5000 and offers no limit.

Do not adopt `hcl-rs`'s evaluator or formatter.
Do not adopt `tree-sitter-hcl` for meow's own parsing;
it remains the right thing for editors that already bundle it,
and nothing here argues against that use.

The evaluator,
 the function library,
 and the formatter are meow code,
which the user's settled requirements already decided,
and the design for each is in the accompanying appendix.

## Adoption boundary

This report recommends;
it does not adopt.
Adoption needs a decision record under `doc/decision/`,
created only after the user accepts or delegates the decision,
 per rule DRR.
One preference remains open and is asked in the appendix:
patched dependency,
 owned parser,
 or unpatched dependency.

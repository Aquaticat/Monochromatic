# Monorepo manager handover

## Status

Design research;
no product code.
The user accepted a from-scratch,
single-file,
all-Rust tool with file-enforcer rewritten in Rust on 2026-09-16
([`doc/decision/monorepo-manager-all-rust.md`](../decision/monorepo-manager-all-rust.md)).
Probe installs are authorized except `rpm-ostree install`.
Every decision made in this work applies to meow 0.x only;
1.x and later may revisit it (user,
2026-09-17).
Research prompts and new decision records carry that scope.

Keep this handover current when requirements,
decisions,
evidence,
rejected designs,
in-flight work,
or the next action change.

## Where things live

- Requirements,
   design,
   decisions,
   risks,
   and open questions for the tool:
   [`doc/planning/monorepo-manager-from-scratch-design.md`](../planning/monorepo-manager-from-scratch-design.md).
- Hard requirements for any manager and the Mise removal ledger:
   [`doc/planning/mise-removal-coverage.md`](../planning/mise-removal-coverage.md).
- Market vet with no recommendable candidate:
   [`doc/audit/tech-monorepo-manager-vet-2026-09-16.md`](../audit/tech-monorepo-manager-vet-2026-09-16.md).
- Bazel versus from-scratch comparison:
   [`doc/planning/monorepo-manager-build-routes.md`](../planning/monorepo-manager-build-routes.md).
- Bazel route design,
   not viable:
   [`doc/planning/monorepo-manager-bazel-route-design.md`](../planning/monorepo-manager-bazel-route-design.md).
- Original Bazel developer-experience question:
   [`doc/research/bazel-migration-dx.md`](../research/bazel-migration-dx.md).
- Research appendices with probes and citations:
   [`doc/planning/monorepo-manager-route-research/`](../planning/monorepo-manager-route-research/).

## How the choice narrowed

Each step's evidence is in the linked documents.

1.  Mise is to be replaced because its documentation is insufficient,
    with no ETA.
2.  The market vet screened 732 entries;
    none passed,
    including after the user counted external wrappers as plugging in.
3.  The Bazel route hit disqualifying problems in design;
    the from-scratch route was recommended.
4.  Stack deep dives covered TypeScript on Node,
    Bun,
    and Deno,
    Rust core with TypeScript children,
    all Rust,
    the Kotlin shapes,
    Python,
    OCaml,
    and .NET.
    Go and Zig were excluded by the user.
5.  The user judged the Kotlin shapes,
    Bun,
    Deno,
    Python,
    OCaml,
    and .NET not worth further research.
6.  The user made single-file `./meow` shipping a hard requirement,
    then killed the TypeScript route because Node single executables are too big;
    a minimal probe measured 144 MiB.
    The Rust core with TypeScript children is out by the same reason,
    closed as settled because it needs Node at run time.

## In-flight work

- Finished on 2026-09-16:
   the all-Rust research,
   copied to `doc/planning/monorepo-manager-route-research/stack-all-rust-rewrite.md`
   and merged into "All-Rust tool" in the from-scratch design.
  Its configuration-hosting ranking is withdrawn:
   the user dropped the Turing-complete configuration requirement
   ("Configuration" and "Correction on 2026-09-16" in the design).
- Finished on 2026-09-17:
   declarative configuration research,
   copied to `doc/planning/monorepo-manager-route-research/stack-declarative-config.md`
   and merged into "Declarative configuration" in the design.
  It exposed a recording error:
   the docs said the configuration is "not Turing-complete",
   while the user only removed the requirement;
   corrected in `6a8ea0651`.
- Done on 2026-09-16 with the user's authorization:
   `rustup target add x86_64-unknown-linux-musl`;
   static musl daemon skeletons with XXH3 and with `gxhash` both built and ran.
- Accepted 2026-09-16:
   [`doc/decision/monorepo-manager-all-rust.md`](../decision/monorepo-manager-all-rust.md).
- Finished on 2026-09-17:
   the choosing-technology vet for meow's cache key hash,
   [`doc/audit/tech-meow-cache-key-hash-vet-2026-09-17.md`](../audit/tech-meow-cache-key-hash-vet-2026-09-17.md),
   merged into "Cache key hash vet result" in the design.
  It recommends `twox-hash` 2.1.4 XXH3-128 under the SIMD reading of "hardware acceleration";
   under the dedicated-instruction reading no non-cryptographic library passes.
  The user answered "SIMD counts",
   and `twox-hash` XXH3-128 was recorded in `doc/decision/monorepo-manager-cache-key-hash.md`
   before the user saw the brief.
  Issue #545 got a comment pointing at that result,
   since its body named this vet as the blocker.
- Withdrawn and reopened on 2026-09-17,
   after the briefs:
   that decision record was deleted (`git log` keeps it),
   because the user said "non-crypto isn't a requirement.
   I only said we don't necessarily need a crypto hash."
   and "Shipping x86-64-v3 and x86-64-v4 as separate builds is fine."
  Both change the vet's premises
   ("Cache key hash vet result" in the design).
  Before re-running the selection,
   the user was asked how much collision resistance weighs against throughput ("A",
   speed first)
   and which x86-64 levels block publishing ("v4 block only").
  The re-run vet started the same day.
  Also answered:
   "Yes to HCL" (recorded in the all-Rust decision record)
   and "Merge BFQ into DRR instead" (rule `DRR` in `AGENTS.md`).
  Issue #545 got its follow-up comment on 2026-09-17,
   superseding the two earlier ones,
   with the fingerprint-sized numbers that bear on the music player's own choice.
  The vet agent reported that the Write tool refused its Markdown drafts,
   so it wrote them through Bash,
   and that some of its Bash commands broke rule `1CB`.
- Stopped unfinished on 2026-09-17,
   with no files written:
   troubleshooting docs for `gxhash` defects,
   no longer useful once meow and the music player leave `gxhash`;
   the evidence stays in `gxhash-owned.md` and issue #545.
- Finished and merged on 2026-09-17:
   `probe-platforms.md` ("Platform probes"),
   `rust-structured-edits.md` ("Managed file editing"),
   and `gxhash-owned.md` ("Repository-owned gxhash").
- Probe artifacts removed on 2026-09-17:
   the QEMU source volume,
   six probe images,
   the Rust 1.84.0 toolchain,
   the custom-target sysroot symlink,
   finished probes' Cargo build directories in the scratchpad,
   and `~/temp/agent/structured-edits-target-2026-09-16/`.
  The aarch64 Rust targets stay.
- Opened issues #546 and #547 on 2026-09-17 for the user to file the prepared `xot` issue
   and post the prepared `kornelski/xml-rs#88` comment personally
   (drafts in `doc/troubleshooting/xml-attribute-whitespace-serialization.md`).
- Opened issue #545 on 2026-09-17,
   "music player must switch away from gxhash";
   the user said this session must not touch music player work.
- `ssh m1` was powered on by the user on 2026-09-17 for the hash measurement:
   Darwin arm64,
   16 GiB,
   8 cores,
   macOS 27.0,
   114 GiB free on the internal disk and 216 GiB on `/Volumes/MacData`,
   with a Rust toolchain already in `/Users/user/.cargo/bin`.
  Rule `HRM` still applies:
   write-heavy work goes on `/Volumes/MacData`.
- Opened issues #550,
   #551,
   and #552 on 2026-09-17 for the user to file the two `hcl-edit` defects
   and the `hcl-rs` evaluator divergences personally.
- Stopped unfinished on 2026-09-17:
   `btrfs-pinned-bytes.md` research,
   because the user dropped reflinks and the cache now records output pointers only.
- Also decided 2026-09-16 and recorded in the design:
   no pty opt-in,
   `gxhash128` keys,
   cache contents and failure caching,
   pointer-only outputs,
   eviction by a size cap plus 30-day age,
   flaky retry reporting,
   and rule `FLG` in `AGENTS.md`.
- Decided 2026-09-17 and recorded in "Declarative configuration" in the design:
   the configuration may be Turing-complete,
   HCL syntax is lightly endorsed,
   rules writing outside a repository live in a per-user configuration,
   the forbidden-strings rules compile with the published scanner,
   meow never generates `mise.toml` while file-enforcer keeps generating it for now,
   and meow is built in its own git worktree.
- Also decided 2026-09-17:
   meow replaces Mise only once it supports the full platform matrix,
   0.x guarantees only Linux,
   meow does not own Meta Package Manager's lifecycle,
   aarch64 musl ships static-pie from a custom target,
   local glibc builds use the host while releases follow `cargo-publish.yml`,
   new TOML inline tables use the TOML 1.1 trailing comma,
   and edits need not keep untouched bytes or CRLF.
- Finished under the `troubleshooting-doc` skill on 2026-09-17,
   committed and indexed under "Comment-preserving structured edits in Rust" in `doc/troubleshooting/README.md`:
   `toml-edit-comment-loss.md`,
   `taplo-toml-1-1-inline-table-trailing-comma.md`,
   `xml-attribute-whitespace-serialization.md`,
   `json-five-unterminated-block-comment.md`,
   `jsonc-parser-json5-defaults.md`,
   and `biome-json-crates-exact-pins.md`.
  Source citations for the `json-five`,
   `jsonc-parser`,
   and Biome policy findings were re-read in the agent's clones.
- Opened issues #548 and #549 on 2026-09-17,
   following the user's reminder-issue answers for #546 and #547,
   for the user to file the prepared `json-five` block comment issue
   and the `jsonc-parser` `allow_comments` issue personally.
  No Biome filing:
   biomejs/biome#5151 already covers the exact pins,
   and Biome's `CONTRIBUTING.md` asks that contributor communication not be AI-written.
  The `jsonc-parser` loose defaults are documented upstream behavior and stay unfiled.
- Installs are authorized for this work,
   except `rpm-ostree install`.
- Stopped unfinished on 2026-09-16:
   the design of a TypeScript daemon with a Rust native addon;
   no appendix was written.

## Process notes

- Research agents contacting registries or documentation sites send a generic User-Agent with no personal identifiers.
  On 2026-09-16 one crates.io request carried the user's email address as a contact;
   the user was told,
   and later prompts required a generic User-Agent.
- Probe paths cited as "in the session scratchpad" are not durable;
   the recorded commands and outputs are the evidence.
- Runtime and library documentation problems are recorded but do not cull options for building the tool;
   monorepo manager candidates were culled on any documentation confusion.
- Incumbent shapes are not requirements:
   on 2026-09-16 the configuration-hosting research treated `file-enforcer.config.ts`'s Turing-complete shape,
   built under time constraints,
   as something to preserve,
   and the user corrected it.

- Corrected by the user on 2026-09-17:
   "I haven't been presented with the brief on how you recommend XXH3-128 from twox-hash,
   nor HCL."
  The `twox-hash` adoption followed only a short summary above the reading question,
   treating the "SIMD counts" answer as acceptance,
   and the HCL evaluator research started without an HCL brief.
  Both briefs were then presented,
   with questions on keeping the `twox-hash` adoption,
   keeping HCL with its running research,
   and a proposed `AGENTS.md` rule `BFQ`.

## Commits

Milestones,
all 2026-09-16;
`git log --oneline -- doc/planning/monorepo-manager-from-scratch-design.md doc/planning/monorepo-manager-route-research`
lists the rest.

- `5f524b08d`:
   vet finished with no recommendable candidate.
- `647a2ccbb`:
   build routes proposed and ranked.
- `185aa6493`:
   Bazel and from-scratch route designs written.
- `4daaae8e9`:
   first ranking after designing every stack option.
- `cdf341565`:
   crate-level Rust research corrected the `unsafe` conclusion.
- `b4d6e1823`:
   leading stacks re-ranked after library-level research.
- `36754f0ff`:
   single-file shipping made a hard requirement.
- `d3af113d4`:
   TypeScript route killed over single-executable size.
- `bcf373479` and `4241732d5`:
   documents brought up to the all-Rust route.
- `652c171c0`:
   all-Rust configuration-hosting research merged.
- `2ae2c67b5`:
   declarative configuration,
   `gxhash`,
   and the CPU-capability warning recorded.
- `1e55e3335` (2026-09-17):
   JSON crate troubleshooting docs landed.
- `4fdf58b84` (2026-09-17):
   cache key hash vet merged into the design.

## Next action

Finished on 2026-09-17:
 design research for the HCL evaluator,
 function library,
 formatter,
 and language server,
 copied to `doc/planning/monorepo-manager-route-research/hcl-tooling.md`
 and merged into "HCL tooling" in the design,
 with vet reports `tech-meow-hcl-front-end-vet-2026-09-17.md`
 and `tech-meow-language-server-framework-vet-2026-09-17.md`
 and three troubleshooting docs committed.
It recommends a patched `hcl-edit` under meow's own evaluator,
 a curated OpenTofu-named function set,
 meow's own formatter,
 and `lsp-server`.
Its brief went to the user with five questions.
Answered on 2026-09-17:
 patched `hcl-edit` under meow's own evaluator,
 and functions with unpredictable results allowed but making their evaluation uncacheable with detailed warnings,
 both recorded in
 [`doc/decision/monorepo-manager-hcl-front-end.md`](../decision/monorepo-manager-hcl-front-end.md);
 all three upstream defects get reminder issues.
Answered the same day:
 the `meow::` namespace for meow-only functions,
 "Ship no formatter",
 `lsp-server` for the language server,
 and "Emit every line as a json,
 error or warning or not.",
 which dissolved the diagnostic-renderer question and added "Output format" to the design.
Nothing from the HCL research is left open.
Corrected before merging:
 the research called a C toolchain forbidden by the all-Rust decision record,
 which only says the tool is written in Rust;
 whether a dependency may compile C is an open user question,
 also raised by the hash vet.
The re-run cache key hash vet finished on 2026-09-17:
 [`tech-meow-cache-key-hash-vet-2026-09-17-600031ed.md`](../audit/tech-meow-cache-key-hash-vet-2026-09-17-600031ed.md),
 merged into "Cache key hash re-run vet result" in the design,
 with `doc/troubleshooting/rust-hash-crate-build-and-test-quirks.md` committed.
It recommends `twox-hash` 2.1.4 XXH3-128 again,
 now over a new finalist `rscrypto` by 1.5 points,
 with cryptographic candidates 8 to 15 times slower on the weight-5 criteria.
Its one user question was whether to power on the m1 to decide `twox-hash` against `rscrypto` by measurement.
The user answered on 2026-09-17:
 "I just powered on my m1 mac.
 Please measure.",
 and the measurement ran there the same day
 (`c4f5f0d3d` and `95143e348` update the report in place).
`twox-hash` stays first at 85 of 92,
 `rscrypto` second at 83.5,
 while `hashcrew` and `xxhash-rust` swapped third and fourth;
 no sensitivity test changes the winner any more.
The remaining proxy is Darwin against Linux aarch64,
 which a rented Arm Linux run would close;
 the user declined that and answered "Accept twox-hash",
 recorded in
 [`doc/decision/monorepo-manager-cache-key-hash.md`](../decision/monorepo-manager-cache-key-hash.md).
m1 state after the run,
 verified from this session:
 only the machine's own toolchain is installed
 and no probe processes are left;
 the agent's scratch tree stays on `/Volumes/MacData`,
 and three macOS probe quirks are documented.
Spot-checked before merging:
 `rscrypto` was published 2026-05-02 with about 1,100 recent downloads (crates.io API,
 2026-09-17).
The C toolchain question the HCL research raised is closed by this vet's measured bound,
 so it was withdrawn from the user's question set.

Finished on 2026-09-17:
 design research for the per-user `meow` configuration,
 copied to `doc/planning/monorepo-manager-route-research/per-user-config.md`
 and merged into "Per-user configuration" in the design.
It recommends an XDG path with an explicit override,
 per-attribute declared scope for layering,
 repository proposals accepted by the per-user file for outside writes,
 a restricted mode until a repository root is trusted,
 two-level cache keys,
 and one daemon per repository root.
Its brief went to the user with four questions,
 all answered on 2026-09-17 and recorded in
 [`doc/decision/monorepo-manager-per-user-config.md`](../decision/monorepo-manager-per-user-config.md):
 repository proposals accepted by the per-user file,
 trust "Go with the logic in our cli-git",
 per-user tasks in a separate non-shadowing kind,
 and a switch that defaults to reading the file everywhere.
The trust answer replaced the research's restricted mode:
 `doc/decision/cli-git-policies-platform.md` and
 `package/git-policy/cli/src/allowed-worktree-dirs.ts` were read,
 so meow gets explicit `trust`,
 `untrust`,
 and `status` subcommands,
 exact-byte snapshots rather than a content hash,
 a registry under the account home rather than an XDG path,
 and blocking of every configuration-loading command until trust exists.
The research used no clones and wrote no troubleshooting docs;
 it reported three rule `1CB` slips,
 and it noted that `git config --list --show-origin` printed a credential URL that it did not reproduce anywhere.

1.  When it lands,
    start the last item under "Design work not yet started" in the design's "Open questions":
    how `vm-builder` replaces its `exec` import from file-enforcer's `/ts` subpath.
2.  For each research result,
    copy it into `doc/planning/monorepo-manager-route-research/`,
    verify its load-bearing claims,
    merge it into the from-scratch design,
    and commit.
3.  Ask the user every flagged question it raises in the same turn,
    with pros,
    cons,
    and a ranking;
    the user asked on 2026-09-16 that flagged items never wait in documents.
4.  Record accepted choices in `doc/decision/` only after the user accepts them.

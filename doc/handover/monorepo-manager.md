# Monorepo manager handover

## Status

Design research;
no product code.
The user accepted a from-scratch,
single-file,
all-Rust tool with file-enforcer rewritten in Rust on 2026-09-16
([`doc/decision/monorepo-manager-all-rust.md`](../decision/monorepo-manager-all-rust.md)).
Probe installs are authorized except `rpm-ostree install`.

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
- Running,
   each writing to the session scratchpad:
  - `probe-platforms.md`:
     the four-target build matrix,
     QEMU runs on aarch64,
     no-AES behavior,
     a startup CPU-check prototype,
     and a reproduction of gxhash issue #111.
  - `gxhash-owned.md`:
     upstream algorithm notes,
     reimplementation versus fork,
     output compatibility,
     optimizations,
     and bounded benchmarks.
  - `rust-structured-edits.md`:
     comment-preserving JSONC,
     TOML,
     and XML editing in Rust against the repository's TypeScript editors.
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

## Next action

1.  As each running research file lands,
    copy it into `doc/planning/monorepo-manager-route-research/`,
    verify its load-bearing claims,
    merge it into the from-scratch design,
    and commit.
2.  Ask the user every flagged question it raises in the same turn,
    with pros,
    cons,
    and a ranking;
    the user asked on 2026-09-16 that flagged items never wait in documents.
3.  Record accepted choices in `doc/decision/` only after the user accepts them.

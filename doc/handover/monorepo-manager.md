# Monorepo manager handover

## Status

Design research only;
no code,
installs,
or decision records.
As of 2026-09-16 the only remaining route is a from-scratch,
single-file,
all-Rust tool with file-enforcer rewritten in Rust.
The user has not accepted a route or stack.

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
    open to veto.

## In-flight work

- A research agent is designing the all-Rust tool:
   configuration-hosting variants,
   byte-identical output for structured edits,
   rewrite scope,
   and single-binary build and size.
  It writes `stack-all-rust-rewrite.md` in the session scratchpad,
   which does not survive the session.
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

## Next action

When the all-Rust research lands:

1.  Copy it to `doc/planning/monorepo-manager-route-research/stack-all-rust-rewrite.md`.
2.  Merge its findings and a full ranking of the configuration-hosting variants into
    "Current stack direction" in the from-scratch design,
    per rule `YKZ`.
3.  Update the design's "Open questions" and this handover,
    then commit.
4.  Present the ranking to the user with pros and cons;
    write a decision record only after the user accepts.

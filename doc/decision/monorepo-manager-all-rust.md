# The monorepo manager is a single-file all-Rust tool

## Status

Accepted 2026-09-16 by the user,
answering "Do you accept the all-Rust stack for meow 0.x (Rust approved for this tool,
 file-enforcer rewritten in Rust)?"
with "Accept all-Rust".
`meow` is a placeholder name.
Design:
[`doc/planning/monorepo-manager-from-scratch-design.md`](../planning/monorepo-manager-from-scratch-design.md).
Session state:
[`doc/handover/monorepo-manager.md`](../handover/monorepo-manager.md).
Supersedes `package/dev-script/file-enforcer/DECISION.rust-migration.md` for the tool's file enforcement.

## Context

- Mise is being replaced because its documentation is insufficient.
- No market tool met the requirements
   ([`tech-monorepo-manager-vet-2026-09-16.md`](../audit/tech-monorepo-manager-vet-2026-09-16.md)),
   and the Bazel route hit disqualifying problems
   ([`monorepo-manager-bazel-route-design.md`](../planning/monorepo-manager-bazel-route-design.md)).
- Hard requirements for the from-scratch tool include:
   file-enforcer functionality,
   a watch daemon with RPC inspection and control,
   cgroup sandboxing,
   and shipping as one file a user runs directly,
   with run-time unpacking acceptable.
- A minimal Node single executable with top-level await measured 144 MiB,
   and the user killed every shape that ships Node for that size.
- The user judged the Kotlin shapes,
   Bun,
   Deno,
   Python,
   OCaml,
   and .NET not worth further research,
   and excluded Go and Zig.
- `DECISION.rust-migration.md` rejected a Rust file-enforcer because its consumer surface is a TypeScript builder API,
   its no-op cost is recomputation,
   and its residual cost is file I/O.
  None of those reasons addresses single-file shipping.

## Decision

- The tool is written in Rust,
   and file-enforcer's functionality is rewritten in Rust inside the same binary.
- Rust is approved for this tool,
   for the approval question in `doc/planning/load-bearing-code-languages.md`.
- Supported platforms,
   whose issues block publishing:
   Linux on x86_64 and aarch64,
   each built both glibc-linked and as a static musl binary,
   because musl has known performance problems (user,
   2026-09-16).
- Unsupported operating systems and architectures may still have built code paths;
   issues in those paths do not block publishing (user,
   2026-09-16).
- The tool takes over from Mise only once it supports the full platform matrix,
   including macOS and Windows;
   Mise is then removed entirely.
  0.x guarantees good support only on Linux (user,
   2026-09-17).
- The root `mise.toml` is hand-maintained (user,
   2026-09-17).
- The tool does not own Meta Package Manager's lifecycle (user,
   2026-09-17).
- As many builds as possible ship;
   `x86-64-v3` and `x86-64-v4` ship as separate builds (user,
   2026-09-17).
- Configuration syntax is OpenTofu-shaped HCL,
   accepted after the format brief ("Yes to HCL",
   user,
   2026-09-17).

Decided the same day and recorded in the design:
the configuration language no longer needs to be Turing-complete and may be (user,
 2026-09-17),
and the tool warns clearly when the CPU lacks required capabilities.
Content hashing used `gxhash` until collision findings on 2026-09-17;
its replacement is being selected,
and cryptographic hashes are eligible (user,
 2026-09-17).

## Consequences

- `DECISION.rust-migration.md` is superseded;
   the TypeScript file-enforcer keeps running until the Rust tool replaces it.
- `package/dev-script/vm-builder` must replace its `exec` import from file-enforcer's `/ts` subpath,
   and the `file-enforcer-perf` fixture,
   a `prefer-readonly-parameter-type` fixture read,
   and the `sync:files` tasks need migration.
- Superseded on 2026-09-17 with `gxhash`:
   the AES-specific startup check.
  Every build raised above its target's baseline,
   such as `x86-64-v3`,
   needs a startup check for the features it was compiled with.
- Each shipped build comes as glibc and static musl binaries,
   including the separate `x86-64-v3` and `x86-64-v4` builds;
   which x86-64 levels block publishing is still open.

## Rejected

Evidence for each is in the design's "Tech stack options" and its research appendices.

- TypeScript on Node,
   a TypeScript daemon with a Rust addon,
   and a Rust core with TypeScript file-enforcer children:
   single-file size.
- Embedding a JavaScript,
   Lua,
   Starlark,
   Rhai,
   Rune,
   or WebAssembly host for a Turing-complete configuration:
   the user removed the Turing-complete configuration requirement.
- Kotlin,
   Bun,
   Deno,
   Python,
   OCaml,
   .NET,
   Go,
   and Zig:
   excluded by the user.

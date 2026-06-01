# Why not Cargo workspace

This project does not add a repository-root Cargo workspace spanning the Rust packages.

## Why this is out of scope

Cargo workspaces centralize profile ownership. Cargo recognizes `[profile.*]` sections only in the workspace root
manifest and ignores them in member manifests, so each member loses package-local control over release and dev profile
policy. Root-level package overrides exist, but they still make the root manifest know every app's exceptions.

That is the wrong ownership boundary here. The Rust packages do not share one build policy:

- `packages/cli/forbidden-strings/Cargo.toml` has load-bearing release settings: `panic = "unwind"` and
  `overflow-checks = true` preserve fail-closed scanner behavior around `resharp` panics and arithmetic overflow.
- `packages/cli/forbidden-strings/fuzz/Cargo.toml` declares its own package-local workspace and pins
  `panic = "unwind"` for fuzzing, so libFuzzer can capture and minimize crashes.
- `packages/desktop-app/player` builds inside a Fedora Podman container because it depends on system development
  libraries such as PipeWire, Opus, Clang, Slint, and GUI runtime pieces that should not be installed on the host.

A root Cargo workspace would make the convenient command shape look shared while the actual build environments remain
package-specific. App packages can depend on different system libraries, and those app builds must stay in Podman or
another disposable environment anyway. A shared Cargo workspace would therefore add root-level coupling without removing
the per-package container boundary.

## What we use instead

- Keep Rust packages standalone unless a specific package-local sub-workspace is useful, as with the
  `forbidden-strings` fuzz harness.
- Put Cargo tasks in each package's `mise.toml`, beside the package that owns the profile and environment constraints.
- Use Podman in the package task when that package has system dependencies that should not touch the host.
- Revisit only with a concrete cross-package Rust workflow that measurably benefits from a shared lockfile, target
  directory, or workspace command, and only after accounting for profile ownership and containerized builds.

## Source note

The [Cargo workspace reference] documents the profile constraint: `[profile.*]` sections are only recognized in the
root manifest and ignored in member crate manifests.

[Cargo workspace reference]: https://doc.rust-lang.org/cargo/reference/workspaces.html

# pnpm supportedArchitectures: why we list multiple platforms

## Context

We use pnpm with `pnpm install --frozen-lockfile` in CI (GitHub Actions,
 Docker).
Several dependencies ship native binaries via `optionalDependencies` that declare
`os`,
 `cpu`,
 and `libc` constraints:

- `@rolldown/binding`
- `@oxlint/binding` and `@oxlint-tsgolint`
- `@typescript/native-preview`
- `@tursodatabase/database`
- `sharp` / `@img/sharp-libvips-*`

## Problem

By default pnpm records in `pnpm-lock.yaml` only the optional-dependency variants
that match the host running `pnpm install`.
 A developer on macOS (darwin-arm64)
who commits the lockfile produces a file that lacks the `linux-x64-gnu` entries.
When CI on `ubuntu-latest` later runs `pnpm install --frozen-lockfile`,
 pnpm
cannot find the required platform binary in the lockfile and the install fails
with an outdated-lockfile or missing-package error.

## Decision

Keep `supportedArchitectures` in `pnpm-workspace.yaml` listing the platforms we
actually use across the team and CI:

- `os`:
   darwin,
   linux,
   current
- `cpu`:
   x64,
   arm64,
   current
- `libc`:
   glibc,
   musl,
   current

This forces pnpm to write every matching optional-dependency variant into the
lockfile,
 making it portable from any developer machine to CI without
regeneration.

## Tradeoff

The pnpm virtual store (`node_modules/.pnpm`) contains native binaries for
platforms other than the current host.
 On a typical linux-x64 machine this
adds roughly **900 MB** of unused artifacts (e.g. darwin-arm64,
 musl,
win32 variants).
 The actual `node_modules` symlinks still point only to the
host-matching binary,
 so runtime behaviour is unaffected.

## Alternatives considered

### 1. pnpm 10.14+ CLI flags (`--os`, `--cpu`, `--libc`)

We could remove the workspace-level key and pass `--os=linux --cpu=x64`
only in CI.
 This would shrink local `.pnpm` stores but requires every CI
pipeline and Dockerfile to remember the flags,
 and local lockfile
generation would still be platform-specific.

**Deferred.
** Revisit if pnpm ever stores platform variants in the lockfile
automatically without downloading them to the local store.

### 2. Generate lockfile from CI

Have CI commit the lockfile after running `pnpm install` on Linux.
 This
would make the lockfile linux-centric and macOS developers would have to
avoid running `pnpm install` locally without `--no-frozen-lockfile`.

**Rejected.
** It breaks the normal workflow where developers add deps locally
and commit the lockfile.

### 3. Remove `supportedArchitectures` entirely

This is the pnpm default.
 It would mean every developer's local lockfile is
host-specific and CI would break whenever a native-dependency package is
added or updated.

**Rejected.
** Explicitly opted out because of the frozen-lockfile failure mode
described above.

## Consequences

- Disk usage of `node_modules/.pnpm` is ~1.2 GB instead of ~200 MB.
- `pnpm install` takes slightly longer because more tarballs are fetched.
- Lockfile remains portable across macOS and Linux,
   x64 and arm64,
   glibc
  and musl,
   without manual intervention.

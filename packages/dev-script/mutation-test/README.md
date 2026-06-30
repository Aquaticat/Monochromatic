# mutation-test

Reusable mutation-test orchestration for monorepo packages.
It runs Stryker inside one restricted Podman container per source file,
with dependencies baked into a local runtime image and current source copied
into a writable work tree at container startup.

## Usage

```bash
mise run //packages/dev-script/file-enforcer:test:mutation -- src/io/glob-mirror.ts
mise run //packages/dev-script/file-enforcer:test:mutation -- --full-suite
```

The task prints the dynamic production-source count,
 runtime image tag,
report directory,
 weighted score,
 raw mutant counts,
 and survivor or timeout
locations.

## Design constraints

- Podman only,
   with no Docker fallback.
- No `tsx`;
   the repo-pinned latest Node runs erasable TypeScript directly.
- No checked-in script file;
   the test sequencer is an inline Node program.
- Stryker runs with `inPlace: true` inside a writable `/work` copy.
- Stryker's TypeScript checker is enabled by default for accurate
  `CompileError` classification.
- Bun is intentionally absent from the runtime image while the repository
  migrates away from it;
   selected package tests should run fixture config files
  through Node.
- Aggregation is weighted by raw mutant counts,
   never by averaging per-file
  percentages.

## Useful flags

- `--full-suite`:
   run every package unit test for each source file.
- `--dry-run-only`:
   run Stryker's dry run without mutation testing.
- `--workers <n>`:
   set outer per-source-file container concurrency.
- `--memory <limit>`,
   `--cpus <n>`,
   `--pids-limit <n>`:
   tune container caps.
- `--selinux-relabel`:
   append `:Z` to Podman volume mounts on SELinux hosts.
- `--typescript-performance-mode`:
   allow Stryker's faster,
   less accurate
  TypeScript checker mode.
- `--skip-image-build`:
   use the computed runtime image tag without building it.

## Sidecar test inclusion

Test selection also includes sibling sidecar packages automatically.
A sidecar is a directory named `<package>.<concern>` beside the package under test
(for example `jsonc-edit.fuzz`, `jsonc-edit.conformance`),
holding non-runtime tooling kept out of the runtime package so a whole-package run only mutates
real runtime files.
Its `*.unit.test.ts` files are added to every source file's killer set,
expressed relative to the package root (for example
`../jsonc-edit.fuzz/src/round-trip.property.unit.test.ts`).
They import the package under test through its workspace `/ts` subpath,
which the container resolves through a direct relative symlink to the mutated `/work` source,
so they kill mutants too.
Packages with no such siblings are unaffected,
so single-package selection is unchanged.

## Runtime image

`src/runtime-image.ts` tags local images by `pnpm-lock.yaml` hash and host
platform.
 The image uses `runtime/Containerfile`,
 starts from `fedora:latest`,
installs the repo-pinned latest Node and pnpm through
mise,
 copies the repository into `/baked`,
 and runs `pnpm install --frozen-lockfile`
so isolated package `node_modules` trees are available without mounting host dependencies.

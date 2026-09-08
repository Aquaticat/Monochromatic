---
"@monochromatic-dev/module-fs-path": minor
---

Root discovery is one walker driven by marker values.
`findRoot({ marker, cwd?, fs? })` and `findRootCached({ marker, cwd? })` replace `findMiseMonorepoRoot`,
 `findGitRepoRoot`,
 `findPnpmWorkspaceRoot`,
 `findPackageRoot`,
 and their cached variants.
Shipped markers:
 `MISE_MONOREPO`,
 `GIT_REPOSITORY`,
 `PNPM_WORKSPACE`,
 and the factories `packageNamed`,
 `fileNamed`,
 `directoryNamed`;
 a custom marker is one `{ name, matches }` object.
Every failed walk rejects with `RootNotFoundError`,
 which carries `marker` and `startDir`;
 `GitRepositoryRootNotFoundError` is gone.
`createMemoryRootFilesystem({ files, directories, links })` builds a `RootFilesystem` over a tree held in memory,
 for tests and callers without a disk;
 the `RootFilesystem` and `RootMarker` types and the `ABSENT` sentinel are exported.
`findRootCached` memoises per marker name and start directory,
 resolved at call time,
 so a caller that names its directory never receives another directory's answer.
Package-root discovery moved to the root entry as `packageNamed`;
 `./node` now ships only the ensure and empty helpers.
The `[monorepo]` header in `mise.toml` now matches through CRLF line endings,
 trailing spaces,
 and a trailing comment.
`PNPM_WORKSPACE` accepts only a regular file named `pnpm-workspace.yaml`,
 where the old finder accepted any entry.

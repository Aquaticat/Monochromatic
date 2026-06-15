# cli-git pluggable git policies platform

## Status

Stub.
The decision is recorded here; this document is intentionally unrefined and will be filled in later.

## Decision

Make `packages/cli/git` a pluggable git policies platform.
Git policy enforcement becomes pluggable policies hosted by `cli-git`, rather than separate hook-runner tooling.

Deprecate `hk`, the git hook runner, as part of this move.

## Context

To be written.
`packages/cli/git` already hosts git guards, such as the linked-worktree and bulk-add guards referenced in `AGENTS.md`.
This decision consolidates git policy there and retires `hk`.

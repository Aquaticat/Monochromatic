# `@monochromatic-dev/module-fs-id`

Resolve a colon-free identity for the filesystem or volume containing a path.
The module prefers reboot-stable operating-system volume identifiers and degrades to an explicit runtime-only identity
when stable metadata is unavailable.

## Install

The package is workspace-private while cli-git integration is under development.
Workspace consumers declare:

```json
{
  "dependencies": {
    "@monochromatic-dev/module-fs-id": "workspace:*"
  }
}
```

## Use

```ts
import { resolveFsId, } from '@monochromatic-dev/module-fs-id';

const resolution = await resolveFsId({ path: process.cwd(), });
console.log(resolution.value,);
console.log(resolution.stable,);
console.log(resolution.source,);
```

A stable result uses one of:

- Linux filesystem UUID from unprivileged `findmnt`;
- macOS Volume UUID from `diskutil`;
- Windows volume serial from `vol`.

A preferred-command or preferred-output failure falls back to:

- Linux `f_fsid` from GNU `stat`;
- macOS device number from BSD `stat`;
- Windows runtime device number from Node `stat`.

Degraded results set `stable: false`,
include `reason`,
and emit a tagged warning.
They still distinguish a different mounted volume at the same path,
but the identity may change after reboot.
Unsupported platforms and total preferred-plus-fallback failure throw.

## Identity grammar

Generated values use a source-qualified grammar such as:

```text
fs-uuid_1bb3d23e-...
volume-uuid_1234abcd-...
volume-serial_1a2b-3c4d
f-fsid_a281dfd5d0534daf
device-number_2049
```

Values contain lowercase ASCII letters,
digits,
hyphen,
period,
and one source separator underscore.
They never contain colon,
slash,
backslash,
whitespace,
or traversal segments.
`isFsId` validates this generated shape.
Consumers still use reversible encoding when mapping a complete identity into filesystem path components.

## Memoization

`resolveFsId` memoizes by canonical absolute path for the current process.
Different canonical paths never share a cache entry,
so paths on different mounted volumes cannot be confused.
Rejected resolutions are evicted and may be retried.

`createFsIdResolver` accepts explicit adapters and creates an independent cache.
It is the internal seam used by platform fixtures and consumers that need controlled operating-system effects.

## Security scope

Filesystem identity prevents a trust record for one volume from matching another volume mounted at the same path.
It is not an authorization mechanism on its own.
Cli-git combines it with canonical config path,
exact byte snapshots,
registry permissions,
and explicit consent.

The module does not accept environment-selected commands,
platforms,
or identity values.
Windows command text contains only a validated drive letter.

## Verification

Package completion requires:

```text
mise run //packages/module/fs-id:build
mise run //packages/module/fs-id:lint
mise run //packages/module/fs-id:lint:types
mise run //packages/module/fs-id:test:unit
```

Cross-platform CI exercises preferred resolution on real Linux,
macOS,
and Windows runners and records the source and stability fields without treating the concrete machine identifier as a
fixture constant.

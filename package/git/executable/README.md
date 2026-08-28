# @monochromatic-dev/git-executable

Resolve a native Git executable without re-entering the workspace Git policy wrapper.

The resolver promotes common platform Git locations only when `PATH` exposes them,
then scans remaining candidates in shell order.
It recognizes Windows `PATHEXT`,
skips scripts that delegate to `@monochromatic-dev/git-policy-cli`,
and accepts ELF,
PE,
Mach-O,
and universal Mach-O executables from their headers.

Successful resolutions are cached by their effective absolute candidate sequence.
Concurrent calls for the same sequence share one lookup.
Failed lookups are not cached,
so installing Git or changing candidate files allows a later call to retry.

Workspace consumers import TypeScript source:

```ts
import { resolveRealGit, } from '@monochromatic-dev/git-executable/ts';

const gitPath = await resolveRealGit();
```

Tests can inject `PATH`,
platform,
`PATHEXT`,
working directory,
and common paths through `ResolveRealGitOptions`.
Empty and relative `PATH` entries resolve against the supplied working directory.

## Development

Run package tasks through mise:

```console
mise run //package/git/executable:buildAndTest
mise run //package/git/executable:lint
mise run //package/git/executable:lint:types
```

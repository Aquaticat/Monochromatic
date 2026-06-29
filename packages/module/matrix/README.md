# @monochromatic-dev/module-matrix

Test matrix runner.
Runs test files across a cartesian product of OS,
 user context,
 and JS runtime
using podman containers or directly on the host.

## Usage

```ts
import { matrix, } from '@monochromatic-dev/module-matrix';

await matrix({
  os: ['container:ubuntu', 'container:fedora',],
  user: ['root', 'user',],
},);
```

This replaces manual container orchestration loops with a single function call.
The package handles container lifecycle,
 prerequisite installation,
runtime setup,
 user creation,
 and result collection via `describe`/`it`
from `@monochromatic-dev/module-test`.

## API

### `matrix(options)`

Generates a cartesian product of `files x os x user x runtime`,
filters out excluded combinations,
 and executes each via the appropriate backend.

All combinations run concurrently by default.
Each combination is fully isolated (separate container or separate process),
so concurrency is safe without additional coordination.

**Parameters:
**

- **`os`** (required):
   array of OS specifications with protocol prefix.
  - `container:`:
     podman container (e.g. `'container:ubuntu'`,
     `'container:fedora'`)
  - `host:`:
     run directly on the host,
     no container (e.g. `'host:'`)
  - `vm:`:
     reserved for mvm,
     not yet implemented

- **`files`**:
   array of file paths to execute inside each environment.
  Defaults to discovering `*.unit.matrix.test.ts` in the current directory.

- **`user`**:
   array of user contexts.
   `'root'` runs as root,
  `'user'` creates a non-root user (uid 1000) with passwordless sudo.
  Defaults to `['root']`.

- **`runtime`**:
   array of JS runtimes to install.
  Supported:
   `'bun'`,
   `'deno'`.
   Defaults to `['bun']`.

- **`exclude`**:
   array of partial match objects to exclude from the cartesian product.
  All specified fields must match for a combination to be excluded.
  Each field accepts an exact value or a predicate function.

- **`concurrency`**:
   maximum number of combinations to run concurrently.
  Defaults to `4`.
   Caps how many containers or host processes execute at once
  to avoid saturating CPU and memory on large matrices.

  Set to `1` for sequential execution (debugging or resource-constrained hosts).

## Concurrency

All combinations launch concurrently (one podman container or host process each),
capped at `concurrency` (default 4) simultaneous executions via `p-limit`.
This is safe because each combination runs in its own isolated environment.

For large matrices,
 increase or decrease `concurrency` to match available resources:

```ts
await matrix({
  os: ['container:ubuntu', 'container:fedora', 'container:alpine',],
  user: ['root', 'user',],
  runtime: ['bun', 'deno',],
  concurrency: 8,
},);
```

## Protocols

### `container:`: podman containers

Runs test files inside ephemeral podman containers.
Handles prerequisite installation,
 runtime installation,
 and user creation.

```ts
await matrix({
  os: ['container:ubuntu', 'container:fedora',],
  user: ['root', 'user',],
  runtime: ['bun',],
},);
```

### `host:`: direct execution

Runs test files directly on the host machine.
No container,
 no prerequisite installation,
 no user creation.
The specified runtime must already be installed and available on PATH.

The `user` axis still generates combinations (for labeling and matrix completeness)
but does not affect execution;
 the process runs as the current user.
Use `exclude` to filter out inapplicable user combinations.

```ts
await matrix({
  os: ['host:',],
  user: ['root', 'user',],
  runtime: ['bun',],
  exclude: [
    {
      os: 'host:',
      user: function notUser(user,) {
        return user !== 'user';
      },
    },
  ],
},);
```

### Mixing protocols

Container and host entries can coexist in the same matrix:

```ts
await matrix({
  os: ['host:', 'container:ubuntu', 'container:fedora',],
  user: ['root', 'user',],
  runtime: ['bun',],
  exclude: [
    {
      os: 'host:',
      user: function notUser(user,) {
        return user !== 'user';
      },
    },
  ],
},);
```

This runs 5 combinations:
 1 host (user/bun) + 4 container (2 OS x 2 users).

## Supported distros

The package manager is detected from the distro name:

- **apt**:
   ubuntu,
   debian
- **dnf**:
   fedora,
   centos,
   rhel,
   rocky,
   alma
- **apk**:
   alpine
- **pacman**:
   arch

## Supported runtimes

- **bun**:
   in containers,
   installed via `curl -fsSL https://bun.sh/install | bash`;
   on host,
   must be on PATH
- **deno**:
   in containers,
   installed via `curl -fsSL https://deno.land/install.sh | sh`;
   on host,
   must be on PATH

## What the package handles per combination

### Container combinations

1. Detect package manager from distro name (fedora becomes dnf)
2. `podman run --rm -v ${monorepoRoot}:/workspace:Z fedora:latest sh -c "..."`
3. Inside the container:
   - Install prerequisites (curl,
      unzip,
      optionally sudo and bash)
   - If `user` context:
      create non-root user with passwordless sudo
   - Install the selected runtime
   - Execute each file with the runtime
4. Report pass/fail through `describe`/`it` from `module-test`

### Host combinations

1. Spawn the runtime binary with the test file path
2. Report pass/fail through `describe`/`it` from `module-test`

## Errors

- `discoverTestFiles` throws `"No matrix test files (*.unit.matrix.test.ts) found in ${cwd}"`
  when no files match the default discovery glob and no explicit `files` option was provided.
- `matrix()` throws `"vm: protocol not yet implemented"` when any `os` entry uses the `vm:` protocol.
- `parseOs` throws when the OS specification is missing a protocol prefix or uses an unknown protocol.
- `detectPackageManager` throws when the distro name does not match any known distro.

## File naming convention

Inner test files are named `*.unit.matrix.test.ts`.
The standard `test:unit` mise task discovers `*.unit.test.*` and skips these.
Test orchestrators discover them via the `files` option or default glob.

## Consumer example

Before (218-line orchestrator):

```ts
// mise.container-test.ts -- manual matrix, podman args, result collection
const MATRIX = [
  { image: 'ubuntu:latest', asRoot: true, preInstall: '...', },
  // ... 4 entries with duplicated install commands
];
for (const entry of MATRIX) {
  // build command, spawn podman, collect results...
}
```

After:

```ts
import { matrix, } from '@monochromatic-dev/module-matrix';

await matrix({
  os: ['container:ubuntu', 'container:fedora',],
  user: ['root', 'user',],
},);
```

## Excluding combinations

### Exact match

```ts
await matrix({
  os: ['container:ubuntu', 'container:fedora', 'container:alpine',],
  user: ['root', 'user',],
  exclude: [
    { os: 'container:alpine', user: 'user', },
  ],
},);
```

This runs 5 combinations instead of 6,
excluding Alpine with non-root user.

### Predicate functions

Each field in an exclude entry accepts a function predicate
that returns `true` when the combination should be excluded:

```ts
await matrix({
  os: ['host:', 'container:ubuntu',],
  user: ['root', 'user',],
  exclude: [
    {
      os: 'host:',
      user: function notUser(user,) {
        return user !== 'user';
      },
    },
  ],
},);
```

## Dependencies

- `@monochromatic-dev/module-test`:
   `describe`/`it` for execution and reporting
- `@monochromatic-dev/module-logger`:
   tagged logger
- `nano-spawn`:
   process execution (podman and host runtimes)
- `find-up`:
   monorepo root detection

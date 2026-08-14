# cli-git 0.0.1 declares Node 22.18 support but its built artifact needs Node 24 language and APIs

## Symptom

`package/git-policy/cli/package.json` declares:

```json
{
  "engines": {
    "node": "^22.18.0 || >=24.11.0"
  }
}
```

The unchanged built package cannot be imported by Node 22.18.0.
Node's ESM parser emits:

```text
SyntaxError: Unexpected identifier 'output'
```

The affected artifact line is an `await using` declaration:

```js
await using output = await open(snapshotPath, "w", PRIVATE_FILE_MODE$4);
```

A source-level cli-git import can get past that bundled parse boundary,
but then Node 22.18.0 emits another error:

```text
TypeError: Error.isError is not a function
```

CAC did not introduce either operation.
The unchanged cli-git baseline and the disposable CAC integration both fail the built import.

## Root cause

### Production source uses Node 24 language and API surfaces

Production cli-git contains explicit resource management declarations,
including:

- `package/git-policy/cli/src/management.ts` in `runManagementCommand`;
- `package/git-policy/cli/src/worktree-copy/entry-compare.ts`;
- `package/git-policy/cli/src/worktree-copy/lifecycle.ts`;
- trust registry,
  transaction,
  and direct-fix modules.

Production cli-git and shared caught-value code also call `Error.isError`,
including:

- `package/git-policy/cli/src/bin.ts`;
- `package/git-policy/cli/src/worktree-copy/entry-compare.ts`;
- `package/git-policy/cli/src/worktree-copy/journal-lock.ts`;
- `package/module/caught-value/src/index.ts`.

The [Node 24.0.0 release notes][node-24] identify explicit resource management and `Error.isError` as features
added with Node 24's V8 13.6 update.

### Build targeting follows repository Browserslist output

`package/config/rolldown/src/index.node.ts` resolves its transform target through
`browserslistTargets({ runtime: 'node' })` and gives that target to Rolldown.
The measured generated target for this build lists Node 26 releases.
Rolldown therefore preserves language and API use that Node 26 accepts;
it does not derive output compatibility from the consuming package's `engines.node` field.

The final artifact consequently retains `await using`.
No build step polyfills `Error.isError`.

### Manifest and artifact contracts diverged

The manifest still advertises a Node 22 branch while source and output use features first shipped in Node 24.
Package-manager engine metadata does not change parser support or build output.

## Verification

### Exact environment

The lower-bound probe used official image `docker.io/library/node:22.18.0-slim`:

```text
resolved digest: sha256:0d130e2ee18e88e1561375276daced6bff032539200173f2daf48c2e33f38ff5
image ID: 955b467cb9a2a941cb181f7cf1d2405c1dd24b4566a3598b7eae7ecca1a769d1
architecture: amd64
OS: linux
```

The container had no network,
a read-only root,
2 GiB memory,
2 CPUs,
a 128-process ceiling,
and a 1,024-file-descriptor ceiling.

### Runnable built-artifact harness

Build the package through its repository task:

```sh
mise run //package/git-policy/cli:build
```

Then import the public application artifact under Node 22.18.0:

```sh
podman run \
  --memory=2g \
  --cpus=2 \
  --pids-limit=128 \
  --ulimit nofile=1024:1024 \
  --rm \
  --network none \
  --read-only \
  --volume "$PWD:/work:ro" \
  --workdir /work \
  docker.io/library/node:22.18.0-slim \
  node --input-type=module --eval \
  "await import('file:///work/package/git-policy/cli/dist/final/node/index.mjs')"
```

Observed result:

```text
exit=1
SyntaxError: Unexpected identifier 'output'
```

The unchanged baseline stderr SHA-256 is
`37b72db335be0c716f8b24248cf7cddd0bb082017358e89c89b00af6d3f18a47`.
The CAC-integration artifact produced the same diagnostic at a shifted bundle line;
its stderr SHA-256 is
`02ca3774d5b3beadc967a14d6e88d842db192665a035b914549a7c2990327f1a`.

### Source-level confirmation

The 52-case CAC integration harness under Node 22.18.0 exited `1` in shared logger initialization:

```text
TypeError: Error.isError is not a function
```

This second failure confirms that removing only the `await using` syntax would not restore the declared runtime floor.

### Positive control

Linux/Node 26.7.0 imported the candidate artifact with no stderr,
exposed `definePolicy` as a function,
ran authored management and trust help,
and returned exit `2` for invalid trust,
check,
and fix options.
The maintained Linux/Node 24.18.0 built-trust consumer and lifecycle benchmark also executed the packed candidate
successfully.

### Working catalog

- Node 26.7.0 typed parity,
  candidate package import,
  built management help,
  invalid-usage contracts,
  type checking,
  and unit execution.
- Node 24.18.0 built-trust consumer and maintained lifecycle benchmark.

### Failing catalog

- Node 22.18.0 unchanged baseline package import:
  `await using` syntax error.
- Node 22.18.0 CAC candidate package import:
  same syntax error.
- Node 22.18.0 source-level CAC parity harness:
  missing `Error.isError`.

## Remediation options

### Raise cli-git's declared floor to Node 24.11.0 (recommended)

Pros:

- makes package metadata truthful for current source and built output;
- matches the verified Node 24.18.0 built consumer and benchmark plus the Node 26.7.0 import and command probes;
- avoids replacing widespread explicit resource management and error classification.

Cons:

- removes the currently advertised Node 22 branch;
- requires all consumers to use the Node 24 branch already present in the engine range.

This is the minimal verified alignment:
the unchanged packed artifact executes in the Node 24.18.0 lifecycle benchmark and fails import on Node 22.18.0.
The package is unpublished,
so changing its declared floor is a design correction rather than a published compatibility break.

### Preserve Node 22 with an engine-derived build and compatibility layer

Pros:

- retains the stated Node 22.18 consumer range;
- makes output targeting follow package support instead of the repository's current Node target.

Cons:

- requires proving Rolldown correctly downlevels every explicit resource management path;
- requires replacing or compatibility-wrapping every runtime `Error.isError` call;
- needs rebuilt import,
  CLI,
  cleanup,
  exception,
  trust,
  worktree,
  and platform tests on Node 22;
- is not validated by this investigation.

Ranking:
raising the floor is first because it matches the measured artifact and existing source design with a verified runtime.
Preserving Node 22 is second because it retains broader support but requires an unbuilt cross-package compatibility change.

## What does not work

- Adding CAC does not fix cli-git's existing artifact syntax.
  CAC itself supports Node `>=20.19.0`.
- Changing only `engines.node` does not transpile output.
- Polyfilling only `Error.isError` does not make Node 22 parse `await using`.
- Removing only `await using` does not provide `Error.isError`.
- Node's TypeScript type stripping does not transform an already built MJS artifact.
- Upstream CAC Windows and Node 22 test passes do not validate the enclosing cli-git artifact.

## Upstream filing artifact

### Upstream filing decision

1. **Is it really upstream's fault?**
   No.
   Node 22 rejects features that Node's release notes identify with Node 24,
   while cli-git advertises Node 22 and targets newer output.
2. **Can upstream fix it?**
   No external fix is required.
   The repository owns its engine declaration,
   build target,
   and compatibility choices.
3. **Are they supporting this use case?**
   Not applicable.
   Node 24 supports the used features;
   Node 22 is the package's own claimed floor.
4. **Would the repository welcome our contribution?**
   Not applicable because the relevant repository is this project.
5. **Will they likely fix it?**
   Not applicable to Node or CAC.
6. **Have we prototyped a minimal compatible fix?**
   The minimal metadata alignment is verified by the Node 22 failure,
   Node 24.18.0 built consumers,
   and Node 26.7.0 import and command probes.
   A true Node 22 compatibility implementation has not been prototyped.

Do not file an issue against Node or CAC.
Track any engine-floor or downleveling decision in this repository.

[node-24]: https://nodejs.org/en/blog/release/v24.0.0

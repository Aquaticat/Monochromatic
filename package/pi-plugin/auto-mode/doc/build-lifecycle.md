# Build and release lifecycle

## Purpose and interface

`native/build.ts` builds a fresh native release and publishes the stable `dist/native` command target.
`native/build-input.ts` validates the qualified upstream source and installed package version.
`native/build-emission.ts` emits upstream packages and links their installed dependencies.
`native/contract/integration/native-batch/prepare.ts` applies owned native transformations.
`native/build-activation.ts` publishes the verified release through atomic link replacement.

The native command depends on this module because the host needs complete-group execution seams
that the installed third-party extension interface does not supply.
The package transforms its own qualified source copy rather than editing installed upstream files.

Upstream TypeScript remains in the verified checkout used by the compiler.
`native/build-emission.ts` compiles from that checkout directly into the fresh release's `dist` directories
and copies non-TypeScript assets from the same source.
The emitted package metadata and qualification manifest remain with the runtime.
This removes the second source tree from each release without changing the compiler or native transformations.
The change is awaiting byte comparison against the qualified runtime baseline and consumer verification.

## Invariants and retained releases

The source revision and installed upstream version must match the build's qualification.
Native transformations reject unexpected source structure.
Generated imports bind to one release's maintained policy implementation.
Publication occurs after verification.

Earlier release paths remain stable for running sessions.
Deleting a previous release merely because the active link changed could break a later dynamic import
in a session that still owns the old release.
The initial footprint contains repeated native releases because each build retains these immutable paths.
This is an identified storage cost,
not proof that every retained release remains in use.

The `--owned` build reuses the already emitted qualified Pi graph,
then regenerates owned transformations.
`native/build-reuse.ts` shares unchanged files with the previous release after CLI verification
and before publication.
It pins the previous release once,
compares device,
mode,
size,
and complete SHA-256 contents,
then atomically replaces only the new release's matching file with a hard link.
Changed files retain independent inodes.
It does not follow dependency symlinks or rewrite an old release.
The latest checked build shares 1,479 files totaling 11,813,141 bytes.

## Alternatives and verification

Overwriting the active directory would invalidate running module identities.
Editing installed upstream output would detach source qualification from deployment.
Rewriting a file shared with an earlier release could corrupt an active session.
Generation completes in a fresh release before identical files are shared;
later builds do not rewrite those paths.
Any deduplication must preserve independent immutable module paths and generated import identity.
Sequential file comparison bounds hashing and file-descriptor use.
Missing previous files are ordinary non-reuse cases;
other filesystem failures stop publication.

`build:native`,
`build:native:owned`,
`test:native:build-activation`,
and `test:native:build-imports` exercise generation,
publication rollback,
and import rewriting.
The installed command replay verifies the published consumer.
`native/build.unit.test.ts` publishes disposable successive releases,
checks an identical license file shares its inode,
checks changed CLI files remain independent,
and invokes the previous command after publication.
Its inode assertion failed before reuse was implemented,
then passes with the full package units.

Task names use `mise run //package/pi-plugin/auto-mode:<task>`.

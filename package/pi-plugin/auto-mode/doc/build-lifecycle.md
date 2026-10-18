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
Release `native-release-FcmP01` contains 1,031 regular files totaling 8,225,739 bytes,
compared with 1,499 files totaling 12,743,268 bytes in `native-release-J4fNNL`.
All 507 qualified SDK runtime modules and assets remain byte-identical across the releases.
The 18-mode native lifecycle catalog and disposable publication/rollback test pass;
the package type check also passes.

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
The 2026-10-17 checkpoint `native-release-qWSxFz` shares 1,000 files totaling 7,518,255 bytes.
It contains 1,030 regular files totaling 8,211,396 bytes.
The emitted graph records five computed import sites and finds no missing static targets.
Its 794 conservatively reachable files total 6,099,319 bytes.
Contract fixtures and generation inputs remain because native tasks load them directly;
literal graph absence does not establish that they can be deleted.

Cleanup dry-run lists ignored cache,
dist,
and node_modules trees.
Root `HEAD`,
`config`,
`hooks`,
`objects`,
and `refs` do not exist despite matching ignore patterns.
Live Node/Pi process inspection and a complete repository package-consumer scan precede maintenance.
Maintenance removes 43 inactive releases and retains active `native-release-qWSxFz`
plus verified `native-release-mHAoem`.
Dependency links and source are preserved.
This is reviewed maintenance rather than automatic eviction of a running session's output.

## Process lifetime evidence

The 2026-10-18 cleanup audit exposes behaviors that invalidate a command-name-only process search.
The bounded replay mounts Node as `/fixture-node`.
Pi's qualified `dist/native/pi/coding-agent/dist/cli/setup.js` assigns `process.title` from `APP_NAME`,
which can replace the original module arguments visible through Linux `/proc/<pid>/cmdline`.
The repository is also accessible through paths that resolve to the same directory.
A search restricted to executable basenames or one literal repository path can therefore miss a running consumer.

The corrected audit examines all readable process command lines,
canonical and configured repository paths,
and the qualified package's configured application title and RPC title.
Executable,
working directory,
release references,
and disposable-home inode identify matched processes without printing their complete arguments.
The positive control finds both running configured-host replays under their `/fixture-node` aliases.
An empty result is usable cleanup evidence only after that positive control and after the replays terminate.
Unreadable processes and consumers whose release cannot be established remain explicit uncertainty;
do not delete their possible release while they run.

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

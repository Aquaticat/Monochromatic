# Native host integration

This directory maintains the native runtime,
source collectors,
judgment consumer,
and Pi source transformations previously exercised in the private integration workspace.
The package extension entry remains unchanged while native delivery is completed.

`contract/source-provenance.json` records the original relative paths,
source repository revision,
and SHA-256 hashes before relocation.
Entries marked `previous-generated-input` are snapshots of earlier generated owned helpers.
They are build inputs here;
their original generators and historical results are not retroactively changed.
The `input` directories preserve those snapshots separately from newly generated Pi modules.
Imports were relocated to this package graph without changing policy decisions.

The maintained build emits the qualified Pi 1.1.0 source and owned transformations to `dist/native`.
`mise run //package/pi-plugin/auto-mode:build:native` builds that artifact;
`build:native:owned` rebuilds the owned transformations against an existing source emission.
The candidate CLI entry is `dist/native/cli.mjs`.
It routes native manager selection,
services,
session construction,
replacement,
and disposal through the original owners.
Resource reload retains its original project-trust resolver and refreshes the policy capture.

The current CLI bootstrap designates the working directory's `AGENTS.md` with user authority.
Its semantic admission remains unconfigured,
so this candidate is not the completed production replacement.
The native lifecycle fixtures exercise actual CLI manager selection,
services,
reload,
cancelled replacement,
new session,
in-memory fork,
persisted resume,
and disposal retry without external provider requests.
Complete lint verification,
installed host activation,
production semantic qualification,
and genuine human approval remain outstanding.

The dedicated `auto-mode-native` dependency catalog preserves the parser releases used by those fixtures.
It leaves the repository's other parser consumers on their existing catalog.
Named catalog syntax follows the [pnpm catalog documentation](https://pnpm.io/catalogs).

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

The maintained build and CLI integration are in progress.
These files do not yet establish a runnable installed host,
complete lint verification,
production semantic qualification,
or genuine human approval.
The existing native acceptance fixtures are retained for verifying the relocated artifact.

The dedicated `auto-mode-native` dependency catalog preserves the parser releases used by those fixtures.
It leaves the repository's other parser consumers on their existing catalog.
Named catalog syntax follows the [pnpm catalog documentation](https://pnpm.io/catalogs).

# File destinations

## Consumer contract

Default Node logging first tries the nearest ancestor `node_modules/.monochromatic` directory.
A missing project or a failed project-file probe falls back to persistent user state.
The fallback is verified before one console notice identifies the destination and why it was needed.
The notice uses a direct host console because logging through the sink itself would recurse.

An explicit `createFileSink({ directory })` argument or nonempty `MONOCHROMATIC_LOG_DIRECTORY`
selects a strict destination.
Failure disables that file sink and reports the error;
it never redirects caller-selected diagnostics to another location.
An empty string preserves default discovery.

On Unix systems,
fallback files use `$XDG_STATE_HOME/monochromatic/log`,
or `~/.local/state/monochromatic/log` when that variable is missing,
empty or relative.
The [XDG base directory specification] requires absolute environment paths and identifies logs as persistent state.
On macOS,
the destination is `~/Library/Logs/monochromatic`.
On Windows,
it is `%LOCALAPPDATA%\monochromatic\Log`,
with `~/AppData/Local` as the local application-data fallback.
Those platform layouts follow the existing ecosystem [env-paths implementation].
The package does not add a dependency to resolve these paths.
The repository's `module-conf-fork` owns config paths,
which are a different storage lifetime from log state.

## Responsibility boundaries

`src/sink/file-project.ts` owns ancestor discovery and preserves its existing exported test seam.
`src/sink/file-state.ts` resolves per-user paths without filesystem work at import.
`src/sink/file-destination.ts` owns project-first selection and visible fallback.
`src/sink/file-open.ts` exclusively creates and round-trips one file before publishing it to the append queue.
`src/sink/file.ts` owns instance-local verification and serialized record admission.
`src/sink/file-append.ts` retains batching and write completion ownership.

Discovery remains lazy on first use.
Concurrent verification shares one promise and one file.
The browser and neutral artifacts do not import these Node modules.
Directory creation uses mode `0700` and new files use `0600` where the platform honors Unix modes.
Existing directory permissions are not changed.

## Evidence and remaining checks

Regression commit `301671d3e2` precedes the implementation.
The old built artifact fails project fallback,
no-project fallback and user-state failure diagnostics,
while writable-project and strict explicit-destination controls pass.
The log is `logger-default-fallback-red.log` in the session's private verification directory.
Post-change build,
types,
lint,
full tests and a real read-only mount consumer remain required before release.

[XDG base directory specification]: https://specifications.freedesktop.org/basedir/latest/
[env-paths implementation]: https://github.com/sindresorhus/env-paths/blob/main/index.js

# Codex Bash resource limits

Native Rust helper for Codex's Bash `PreToolUse` hook.
It verifies Linux cgroup controls and prepends a membership write to the original command.
If attachment fails,
the shell exits before executing that command.

`codex-bash-limit --initialize <absolute-parent-cgroup>` starts the configured slice if needed
and creates its `codex` child.
`codex-bash-limit --hook <absolute-parent-cgroup>` consumes the native hook event on stdin
and emits a command rewrite.
Errors exit with status 2,
which Codex treats as a blocked hook call.

## Development

```sh
# Repository root
mise run //package/codex-plugin/bash-limit:build
mise run //package/codex-plugin/bash-limit:test
mise run //package/codex-plugin/bash-limit:lint:types
```

Tests are Rust integration tests run by nextest.
They invoke the native binary and execute its rewritten shell commands against disposable fixtures.

The [implementation record](../../../../doc/decision/codex-shell-worker-limits.md)
records resource values,
installation,
and measured overhead.

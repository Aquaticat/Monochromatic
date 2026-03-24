# dprint-plugin-exec Troubleshooting

## Exec plugin silently does nothing

### Problem

The `exec` section in a dprint config defines commands to run after formatting,
but the commands never execute.
No errors appear in normal output.
Debug logging (`dprint fmt --log-level debug`) shows the exec plugin instance is created
but never formats any file -- the `"Formatted file"` log entry lacks the `(Plugin N/M)`
annotation that multi-plugin chaining produces.

### Root cause

dprint's plugin name resolution has two paths
(source: `crates/dprint/src/plugins/name_resolution.rs:54-88`):

1.  **Associations path** (lines 57-64):
    iterates all plugins with `associations` globs,
    collects every match into a vector, and returns the full list.
    This is the only path that enables multi-plugin chaining.

2.  **Extension fallback** (lines 77-84):
    when no association matches, looks up the file extension and
    returns the **first** plugin that registered that extension.
    The loop body returns a single-element vector immediately:
    ```rust
    return vec![plugin_name.clone()];
    ```

When multiple plugins claim the same extension (e.g. malva and exec both claim `.css`),
the extension fallback picks whichever plugin was registered first -- determined by the
order in the `plugins` array.
The exec plugin always loses because it is listed last.

### Solution

Add dprint-level `"associations"` to **every** plugin that should participate in
the chaining, not just exec.
Both the formatter and exec need associations for the same glob patterns.
Plugins matched via associations all run, in registration order:

```jsonc
// dprint config
"malva": {
  "associations": ["**/*.css", "**/*.scss", "**/*.less", "**/*.sass"],
  // ... malva options
},
"exec": {
  "associations": ["**/*.css"],
  // ... exec options
}
```

With this config, a `.css` file matches both malva and exec via associations.
malva runs first (listed earlier in `plugins`), then exec chains its output.

### Gotcha: include-only associations exclude extension matches

When a plugin has associations that are **include-only** (no negation patterns),
the `is_not_associations_excluded` guard (`name_resolution.rs:90-96`) rejects
any file that matches the plugin by extension but **not** by association.
This means adding `"associations": ["**/*.css"]` to malva would silently **break**
formatting for `.scss`, `.less`, and `.sass` files -- malva would refuse to handle them
because they match its extensions but not its associations.

The fix is to list **all** extensions the plugin handles in its associations:

```jsonc
"associations": ["**/*.css", "**/*.scss", "**/*.less", "**/*.sass"]
```

### Debug verification

Run `dprint fmt --log-level debug <file>` and look for the plugin count annotation.
Single-plugin formatting prints:
```
Formatted file: path/to/file.css in 0ms
```

Multi-plugin chaining prints:
```
Formatted file: path/to/file.css in 0ms (Plugin 1/2)
Formatted file: path/to/file.css in 312ms (Plugin 2/2)
```

The annotation is emitted at `crates/dprint/src/format.rs:335-336`.

### Why this project moved away from exec

Even with associations configured correctly, the exec plugin has fundamental
incompatibilities with certain tools.
The `format` task in `mise.toml` now runs dprint first,
then stylelint and oxlint in parallel as separate processes.

## Exec plugin is incompatible with in-place file fixers

### Problem

Configuring `oxlint --fix {{file_path}}` with `"stdin": false` in exec causes:
```
Error formatting path/to/file.ts. Message: Child process exited with code 1:
```

Even when oxlint successfully auto-fixes some issues (visible by running `oxlint --fix`
directly), dprint reports the formatting as failed.

### Root cause

The exec plugin's file mode (`"stdin": false`) does **not** mean "modify the file in-place."
It means "don't pipe file content to stdin."
The result is still read from **stdout** regardless of the stdin setting.

The format flow in `handler.rs:162-253`:

1.  Spawns the command with `stdin: Stdio::null()` and `stdout: Stdio::piped()`
2.  Captures the command's stdout as formatted content
3.  Waits for the child process to exit
4.  If exit code is 0: returns captured stdout as the new file content
5.  If exit code is non-zero: returns an error, discarding everything

This creates three incompatibilities with `oxlint --fix`:

**Incompatibility 1: output destination.**
oxlint writes fixes to the file on disk and writes diagnostic messages to stdout/stderr.
The exec plugin would capture diagnostic text from stdout and treat it as the "formatted"
file content, corrupting the file.

**Incompatibility 2: exit code semantics.**
oxlint exits 1 when any unfixable errors remain, even after successfully auto-fixing others.
The exec plugin requires exit code 0 (`handler.rs:299-314`):
```rust
if exit_status.success() {
    return Ok(ok_text);
}
Err(anyhow!("Child process exited with code {}: {}", ...))
```

There is no option to accept non-zero exit codes.

**Incompatibility 3: in-memory chaining.**
When multiple plugins chain (e.g., typescript formatter then exec),
dprint passes the in-memory formatted result from the previous plugin to the next.
But in file mode, the command receives a `{{file_path}}` that still points to the
**original on-disk content** -- it never sees the previous plugin's output.
This means the typescript formatter's changes are invisible to oxlint.

### What does not work

- Setting `"stdin": false` and expecting the tool to modify the file in-place.
  exec always reads stdout as the result.
- Ignoring the exit code.
  There is no `"allowNonZeroExitCode"` option in exec plugin 0.6.0.
- Piping via stdin (`"stdin": true`).
  oxlint does not support reading source from stdin
  (no `--stdin` or `--stdin-filename` flags).

### Solution

Run oxlint outside dprint as a separate step.
The `format` task in `mise.toml` chains them:

```toml
[tasks.format]
run = ["dprint fmt", { tasks = ["format:stylelint", "format:oxlint"] }]
```

dprint runs first, then stylelint and oxlint run in parallel.
This avoids the stdout/exit-code/in-memory chaining problems entirely.

### Caveat: format:oxlint skips type-aware rules

The `format:oxlint` task runs from the monorepo root without `--type-aware`.
oxlint's type-aware mode resolves the nearest `tsconfig.json` from the working directory,
and the root `tsconfig.json` does not include each package's `src` directory
(see [oxlint troubleshooting](TROUBLESHOOTING.oxlint.md#type-aware-mode-requires-per-package-execution)).
Running type-aware from the root would silently miss type information.

A proper fix would require per-package fan-out
(like the `lint:oxlint` task template does via `mise '//packages/...:lint:oxlint'`),
but adding that complexity to the format pipeline is not worth the marginal gain --
type-aware auto-fixable rules are rare, and the lint task already catches them.

### Tools that work with exec

Tools that read from stdin and write the formatted result to stdout are compatible:

- `stylelint --fix --stdin --stdin-filename {{file_path}}` (stdin mode)
- `prettier --stdin-filepath {{file_path}}` (stdin mode)
- `shfmt` (stdin mode, reads stdin by default)

The key requirements are:
exit code 0 on success, and formatted content written to stdout.

## cacheKeyFilesHash shows null in resolved config

### Problem

Running `dprint output-resolved-config` shows `"cacheKeyFilesHash": null`
for each exec command, even though the referenced files exist:

```json
{
  "executable": "pnpm",
  "args": ["exec", "stylelint", "--fix", "--stdin", "--stdin-filename", "{{file_path}}"],
  "cwd": "/path/to/repo",
  "cacheKeyFilesHash": null
}
```

### Root cause

This is expected behavior, not a bug.

During config resolution (`configuration.rs:153-156`), each command's hash is
extracted via `.take()` and collected into a separate vector:
```rust
if let Some(cache_key_files_hash) = command_config.cache_key_files_hash.take() {
    cache_key_file_hashes.push(cache_key_files_hash);
}
```

`.take()` replaces the value with `None`, so the serialized per-command config
always shows `null`.
The individual hashes are combined into the **global** `cacheKey` at the top of
the exec config section:
```json
{
  "cacheKey": "a6c9dbc6...",
  "commands": [...]
}
```

### Solution

No action needed.
To verify cache key files are being read, check the global `cacheKey` field.
If `cacheKey` is non-null, the files were hashed successfully.
If a file cannot be read, a diagnostic is emitted
and config resolution returns early (`configuration.rs:249-253`).

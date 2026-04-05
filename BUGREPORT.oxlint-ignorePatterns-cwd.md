**Note:** The monorepo has since migrated from `.oxlintrc.json` to `oxlint.config.ts`.
The bug report below is preserved as-is since it documents a real upstream issue.

---

# oxlint bug: `ignorePatterns` resolved from CWD instead of config file directory

**oxlint version:** 1.55.0
**Severity:** incorrect file filtering when `-c` config is in a different directory than CWD

## Summary

`ignorePatterns` in `.oxlintrc.json` are documented as
"resolved from the configuration file path"
([config-file-reference](https://oxc.rs/docs/guide/usage/linter/config-file-reference)),
but the CLI resolves them from CWD instead.
This causes patterns like `**/test-fixture/**` to silently stop working
when oxlint is invoked from a subdirectory with `-c` pointing to a config elsewhere.

## Minimal reproduction

```
repo/
  .oxlintrc.json          # { "ignorePatterns": ["**/test-fixture/**"] }
  packages/
    test-fixture/
      my-pkg/
        src/
          file.ts         # has a lint violation
```

```bash
# From repo root -- works correctly (file ignored, 0 files linted)
cd repo
oxlint -c .oxlintrc.json packages/test-fixture/my-pkg/src/file.ts
# -> Found 0 warnings and 0 errors. Finished on 0 files.

# From subdirectory with -c -- BROKEN (file linted, violation reported)
cd repo/packages/test-fixture/my-pkg
oxlint -c /absolute/path/to/repo/.oxlintrc.json src/file.ts
# -> Found errors.

# Auto-discovery from subdirectory is also broken
cd repo/packages/test-fixture/my-pkg
oxlint -c /absolute/path/to/repo/.oxlintrc.json
# -> Lints all files, ignorePatterns has no effect
```

## Root cause

`apps/oxlint/src/lint.rs:326` passes `&self.cwd` (CWD from `env::current_dir()`)
as the root directory for `LintIgnoreMatcher`:

```rust
// lint.rs:61
cwd: env::current_dir().expect("Failed to get current working directory"),

// lint.rs:326
let ignore_matcher =
    { LintIgnoreMatcher::new(&base_ignore_patterns, &self.cwd, nested_ignore_patterns) };
```

`LintIgnoreMatcher::new` builds a `GitignoreBuilder` rooted at `base_root`:

```rust
// crates/oxc_linter/src/config/ignore_matcher.rs:22
let mut builder = GitignoreBuilder::new(base_root);
```

`GitignoreBuilder::new(root)` resolves all patterns relative to `root`.
When `root` is CWD (e.g. `packages/test-fixture/my-pkg/`),
the discovered file path `src/file.ts` is matched against `**/test-fixture/**`
relative to that CWD. Since `src/file.ts` does not contain `test-fixture/`,
the pattern never matches.

When `root` is the config file's parent directory (the repo root),
the path becomes `packages/test-fixture/my-pkg/src/file.ts`,
which correctly matches `**/test-fixture/**`.

The **LSP implementation gets this right** --
`apps/oxlint/src/lsp/server_linter.rs:225` uses `root_path` (workspace root,
which is where the config lives) instead of CWD:

```rust
// server_linter.rs:225
LintIgnoreMatcher::new(&base_patterns, &root_path, nested_ignore_patterns),
```

## Suggested fix

Use the config file's parent directory instead of CWD:

```rust
// lint.rs:325-326, before:
let ignore_matcher =
    { LintIgnoreMatcher::new(&base_ignore_patterns, &self.cwd, nested_ignore_patterns) };

// after:
let config_dir = root_config
    .path
    .parent()
    .unwrap_or(&self.cwd);
let ignore_matcher =
    { LintIgnoreMatcher::new(&base_ignore_patterns, config_dir, nested_ignore_patterns) };
```

Falls back to CWD when no explicit config file is provided
(in which case `root_config.path` defaults to the auto-discovered config in CWD,
so `parent()` already equals CWD).

## Impact

Any monorepo that runs per-package lint tasks from subdirectories
(e.g. mise, moon, turborepo, nx) with a shared root `.oxlintrc.json`
will have all `ignorePatterns` silently ignored.
This is especially common in monorepo setups like:

```toml
# mise task template
[task_templates."lint:oxlint"]
run = "oxlint --type-aware -c {{vars.monorepo_root}}/.oxlintrc.json"
```

where each package's lint task runs from the package directory.

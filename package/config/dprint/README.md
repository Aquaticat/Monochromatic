# config-dprint

Ready to publish.

Shared [dprint](https://dprint.dev/) configuration for Monochromatic repositories.

## What it configures

- **Line width**:
   90 characters,
   LF line endings,
   2-space indentation
- **TypeScript**:
   semicolons,
   single quotes,
   trailing commas,
   hanging parameters
- **CSS** (Malva):
   single quotes,
   short hex colors,
   trailing commas
- **Markup** (HTML/Astro/Vue):
   single quotes,
   1 attribute per line
- **YAML**:
   single quotes,
   no indented block sequences
- **TOML**:
   default settings with optional leading spaces in comments
- **JSON**:
   trailing commas in `tsconfig.json` and editor settings
- **Post-format linting**:
   handled by mise `format` tasks,
   not a dprint Exec plugin

## Usage

Create a `dprint.json` in your project root:

```json
{
  "extends": ["./node_modules/@monochromatic-dev/config-dprint/index.json"]
}
```

See `example.dprint.json` for a working reference.

## Why `dprint` is not a package dependency

The `dprint` binary is managed by [mise](https://mise.jdx.dev/) (pinned in the
workspace's `mise.toml`),
 not by pnpm.
 This package therefore does **not**
declare `dprint` as a `peerDependency` or `dependency`,
 and the root
`package.json` does not depend on it either.

The reason:
 the npm distribution of `dprint` is a Node wrapper that re-execs
the real native binary,
 adding multi-second startup overhead per invocation
even when the native binary itself returns in under 100ms. Running `dprint`
through mise bypasses the wrapper.
 See
[`TROUBLESHOOTING.dprint.md`](../../../doc/troubleshooting/dprint.md#bug-1-dprint-installed-as-a-workspace-dev-dependency-causes-5-second-startup-overhead)
for the full diagnosis and measurements.

To enforce this decision,
 `pnpm-workspace.yaml` includes the override
`'dprint': '-'`.
 Any attempt to add `dprint` as a direct or transitive
dependency will be stripped at install time.
 If you find yourself reaching for
that addition,
 read the troubleshooting doc first;
 the workflow already covers
the cases that motivate it.

## VSCode dprint extension setup

The VSCode dprint extension resolves the `dprint` binary from `PATH` at
extension activation.
 Because the binary lives under `~/.local/share/mise/...`
(not in the workspace's `node_modules/.bin/`),
 the extension cannot find it on
some setups (notably WSL,
 where the extension server starts before login-shell
rc files run).

Point the extension at the mise-managed binary in `.vscode/settings.json`:

```json
{
  "dprint.path": "${userHome}/.local/share/mise/shims/dprint"
}
```

Or,
 if you prefer a workspace-relative override,
 run `mise which dprint` and
paste the absolute path.
 Reload the VSCode window after editing.

See
[`TROUBLESHOOTING.dprint.md`](../../../doc/troubleshooting/dprint.md#bug-2-dprint-vs-code-extension-cannot-find-dprint-in-wsl-with-pnpm-isolated-installs)
for the full diagnosis and alternative workarounds.

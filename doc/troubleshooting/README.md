# Troubleshooting Guide

This troubleshooting guide has been organized into focused categories for easier navigation and maintenance.

## Categories

### [TypeScript & Configuration](typescript.md)

Issues related to TypeScript configuration,
 dprint,
 and other development tools:

- TypeScript path warnings with dprint
- [Learning Rust canonical HTML conflicts with dprint and Stylelint](dprint.md#bug-4-learning-rusts-canonical-compact-html-conflicts-with-repository-formatting-policy)
- Stylelint and postcss-html resolution
- Type predicate assignment errors with complex conditional types

### [Testing](testing.md)

Problems with test execution and test suite organization:

- Duplicate describe blocks causing missing or misattributed test output
- Test suite organization best practices

### [Editor Setup](editors.md)

Editor installation and configuration issues:

- VS Code development container setup
- Helix editor installation on Debian/Ubuntu
- Editor-specific configuration problems

### [Dependencies & Package Management](dependencies.md)

Package management and dependency resolution problems:

- pnpm workspace configuration issues
- Dependency resolution conflicts
- [Pi update allowScripts warnings](pi-update-allow-scripts.md)

### [Performance Optimization](performance.md)

Performance-related issues and optimizations:

- Build preparation optimization strategies
- WSL performance improvements
- File system vs binary execution trade-offs

### [Configuration Snippets](configuration.md)

Useful configuration examples and snippets:

- GitHub MCP server configuration
- Caddy build commands with extensions
- Other tool configurations

### [Configuration Format Issues](toml.md)

Problems with configuration file formats and why TOML can be problematic:

- TOML table repetition and silent overwrites
- Configuration debugging nightmares
- Better alternatives to TOML (JSON,
   YAML,
   JSON5)
- Real-world examples of TOML-caused production incidents

### [Figma and browser automation](figma-browser-automation.md)

The WebGL wall:
 why AI agents cannot meaningfully automate Figma through browser tools:

- Canvas content is invisible to DOM inspection and browser automation
- Figma MCP covers node structure but not comments,
   prototypes,
   or annotations
- No automated solution exists for prototype review or comment extraction
- Workarounds require human-in-the-loop screenshotting

### [pi-safeguard](pi-safeguard.md)

Security guardrail false positives and judge model selection:

- `pathSignals` flags every file as a system path when home is under `/var/home/` (Fedora,
   NixOS)
- pi-budget-model fails to find a judge model when the active model is the latest major version

### [Pi goal stale global blocker](pi-goal-stale-global-blocker.md)

Retired `@narumitw/pi-goal` behavior and migration:

- paused or interrupted goals block unrelated built-in and custom tools
- cached package files are not active configuration
- migrate globally to repository-owned `@monochromatic-dev/pi-goal`

### [C-Like Comment Syntax](c-like-comments.md)

Issues with C-style comment syntax that affect multiple programming languages:

- Block comment nesting limitations and why `/* */` comments cannot be nested
- Commenting out code that contains existing block comments
- IDE comment features and best practices
- Language-specific comment syntax differences

### [Aquascope connectors in Firefox](aquascope-firefox-connectors.md)

Aquascope interpreter connector lines can disappear in Firefox:

- Chromium paints generated LeaderLine SVG connectors while an observed Firefox view omits them
- Pointer dots and targets still describe the same embedded interpreter state
- Exact Firefox rendering mechanism remains unconfirmed

### [iOS Safari touch events](ios-safari-touch.md)

iOS Safari claims `touch-action: none` support but does not reliably honor it:

- `pointercancel` fires despite `touch-action: none` on the target element
- Long-press triggers system context menu instead of application gesture
- Three-part workaround:
   `touchstart`/`touchmove` preventDefault,
   `pointerdown` preventDefault,
   `-webkit-touch-callout: none`
- Twelve years of WebKit bug 133112 and counting

### [Bundling](bundling.md)

Client-side bundling issues where Node.
js code leaks into browser bundles:

- `node:` protocol dynamic imports cause CORS errors in browser consoles
- Environment guards for dual-target modules

### [dprint-plugin-exec](dprint-exec.md)

Why the exec plugin silently does nothing and why certain tools are incompatible:

- Plugin name resolution selects only one plugin per extension;
   chaining requires `associations`
- Include-only associations exclude extension matches for unlisted extensions
- Exec reads stdout as formatted content;
   in-place file modifiers (oxlint --fix) are incompatible
- `cacheKeyFilesHash: null` in resolved config is expected (hash is moved to global `cacheKey`)

### [mise watch](mise-watch.md)

mise watch flag forwarding bugs and dev-mode restart suppression:

- `mise watch` silently drops `--no-meta` and `-J` (filter-prog) flags
- Unnecessary restarts on metadata-only or same-content file writes
- Server restart generates fresh auth token,
   breaking client reconnection

### [Bash and CLI](bash.md)

Bash shell and CLI tool quirks that cause confusing behavior:

- `2>&1 > file` splits stderr and stdout instead of merging them,
   producing interleaved output that misrepresents execution order
- rg `--glob` finds files but `-l` with a content pattern does not -- content-vs-filename search confusion
- [GitHub CLI implicit repository lookup invokes a PATH-shadowed Git wrapper](gh-implicit-repository-git-wrapper.md)

### [CLI bin entries](cli-bin.md)

Problems with CLI tools installed via `node_modules/.bin/`:

- Missing shebang causes Unix to fall back to `/bin/sh`,
   triggering ImageMagick `import` hangs
- Cross-platform shebang and `.cmd` wrapper interaction

### [VSCode-Specific](vscode.md)

VSCode-specific troubleshooting (already exists):

- Multiple workspace instances in WSL
- Remote development setup
- VSCode extension issues

## Quick Links

For common issues:

- **Slow builds?
  ** → [Build performance](performance.build.md)
- **Test failures not showing?
  ** → [Duplicate describe blocks](testing.md#duplicate-describe-blocks-causing-missing-or-misattributed-test-output)
- **TypeScript path warnings?
  ** → [dprint configuration](typescript.md#typescript-path-warnings-with-dprint)
- **Learning Rust HTML fails dprint and Stylelint?
  ** → [Canonical HTML source-policy conflict](dprint.md#bug-4-learning-rusts-canonical-compact-html-conflicts-with-repository-formatting-policy)
- **`Cannot find name` for DOM types in a non-browser package?
  ** → [All packages must extend config-typescript/dom](typescript.md#all-packages-must-extend-config-typescriptdom)
- **Type errors from `node_modules` JSR packages?
  ** → [JSR `.ts` files and `skipLibCheck`](typescript.md#jsr-packages-ship-ts-source-files-that-skiplibcheck-cannot-skip)
- **Configuration not working as expected?
  ** → [TOML issues and alternatives](toml.md#silent-overwrites-the-configuration-killer)
- **Figma automation not working?
  ** → [The WebGL wall](figma-browser-automation.md)
- **CORS errors for `node:` imports in browser?
  ** → [node: protocol in bundles](bundling.md#node-protocol-imports-cause-cors-errors-in-browser-bundles)
- **CLI hangs with ImageMagick errors?
  ** → [Missing shebang](cli-bin.md#cli-command-hangs-on-unix-with-imagemagick-errors)
- **pi-safeguard blocks every file?
  ** → [pathSignals false positive on /var/home](pi-safeguard.md#pi-safeguard-flags-every-file-under-varhome-as-a-system-path)
- **Unrelated Pi tools blocked after `/goal` interruption?
  ** → [Retired goal package blocker](pi-goal-stale-global-blocker.md)
- **Aquascope pointer lines missing in Firefox?
  ** → [Aquascope connector discrepancy](aquascope-firefox-connectors.md)
- **Touch gestures broken on iPhone?
  ** → [iOS Safari touch-action betrayal](ios-safari-touch.md)
- **dprint exec plugin not running?
  ** → [Plugin silently does nothing](dprint-exec.md#exec-plugin-silently-does-nothing)
- **Dev server restarts on every save?
  ** → [mise watch flag dropping + content-hash filter](mise-watch.md)
- **Output order looks wrong with `2>&1 > file`?
  ** → [Redirect ordering splits streams](bash.md#2>&1--file-splits-stderr-and-stdout-producing-interleaved-output)
- **rg missing files with spaces in paths?
  ** → [Content-vs-filename search confusion](bash.md#rg---glob-finds-files-but--l-with-a-content-pattern-does-not)
- **GitHub issue commands fail in the repository's Git wrapper?
  ** → [Pass explicit repository context](gh-implicit-repository-git-wrapper.md)
- **`pi update` reintroduces `@google/genai`,
   `koffi`,
   or `protobufjs`?
  ** →
  [Pi update allowScripts warnings](pi-update-allow-scripts.md)

## Contributing

When adding new troubleshooting content:

1. Choose the most appropriate category file
2. Follow the existing format with clear problem/solution structure
3. Include reproduction steps and root cause analysis when possible
4. Update this index file if adding new categories

# Monochromatic

A TypeScript and Rust monorepo (148 workspace packages plus 18 standalone Rust crates)
for developer tooling,
coding-agent infrastructure,
custom linters,
desktop applications,
web applications,
and infrastructure automation.

## Highlights

**Minimal MCP server**:
[`mcp-stdio`](package/mcp/stdio/) implements Model Context Protocol
revision 2026-07-28 over stdio,
with three runtime dependencies:
one workspace module,
`valibot`,
and `@valibot/to-json-schema`.
The official `@modelcontextprotocol/sdk` pulled 5.8 MB and 17 dependencies
at audit time (Express,
Hono,
jose,
OAuth,
rate limiting,
SSE);
this package implements only JSON-RPC 2.0,
`server/discover`,
`tools/list`,
and `tools/call`.

**Coding-agent infrastructure**:
[`claude-code-plugin`](package/claude-code-plugin/) packages Claude Code hooks and plugins
(guardrail,
statusline,
bash output filtering,
session spawning,
housekeeping),
and [`pi-plugin`](package/pi-plugin/) does the same for the Pi coding agent
(advisor,
guardrail,
morph-compact,
model selection).
Harness-agnostic logic (session discovery,
usage projection,
shell-command analysis,
terminal titles) lives in
[`agent-harness-shared`](package/agent-harness-shared/).

**Pluggable Rust linter**:
[`linter/rust`](package/linter/rust/) is a Rust linter written in Rust
whose rules ship as plugins
([`rust-linter-plugin/builtin`](package/rust-linter-plugin/builtin/))
over shared crates
([`rust-linter-core`](package/rust-module/rust-linter-core/),
[`rust-linter-pattern`](package/rust-module/rust-linter-pattern/)).
It enforces the repo's per-file code-line budget (`max-lines`)
and rustdoc coverage (`require-rustdoc`) across all crates.
A sibling Gradle-based Kotlin linter lives in
[`linter/kotlin`](package/linter/kotlin/).

**Policy-aware git tooling**:
[`git-policy-cli`](package/git-policy/cli/) wraps git with policy guards
(rejecting bulk staging and pathspec-less commits,
guarding worktree removal) behind a side-effect-free policy authoring API.
[`cli/forbidden-strings`](package/cli/forbidden-strings/) is a gitignore-aware Rust scanner
for banned tokens and leaked credentials,
with a coverage-guided [`cargo-fuzz` harness](package/fuzz/forbidden-strings/).

**Custom Oxlint plugins**:
[`oxlint-tsdoc`](package/oxlint-plugin/tsdoc/) enforces TSDoc correctness
across 20+ rules with fixture-based tests,
replacing the slow eslint-plugin-jsdoc integration that previously required ESLint.
[`oxlint-no-restricted-syntax`](package/oxlint-plugin/no-restricted-syntax/)
encodes monorepo-specific AST rules (no arrow functions,
no switch statements,
destructured params for functions taking two or more arguments)
that Oxlint's lack of AST selectors demands as dedicated rule implementations,
alongside [`stylistic`](package/oxlint-plugin/stylistic/),
[`prefer-readonly-parameter-type`](package/oxlint-plugin/prefer-readonly-parameter-type/),
and [`test-import`](package/oxlint-plugin/test-import/) plugins.

**Wayland-native desktop applications**:
[`desktop-app/file-manager`](package/desktop-app/file-manager/) is a native file manager
presenting a Niri-like horizontal strip of columns on GTK4,
with native Wayland drag-and-drop.
[`desktop-app/terminal`](package/desktop-app/terminal/) is a Slint terminal
backed by Ghostty's libghostty-vt core.
[`cli/nested-wayland-session`](package/cli/nested-wayland-session/) hosts one Wayland client
fullscreen on the GPU (dmabuf) path for GUI testing,
screenshotting the framebuffer and injecting synthetic input
over a Unix-socket control API.

**True-peak music player**:
[`music-player`](package/music-player/) normalizes playback to -1 dBTP
with an attenuate-only gain derived from Catmull-Rom inter-sample peak estimation.
The meter and policy identity live in a shared Rust core
([`truepeak-core`](package/music-player/truepeak-core/))
consumed by a Slint desktop app and a Kotlin Android app.

**Security-audited dependency selection**:
[`AUDIT.md`](doc/audit/README.md) documents source-code audits with dates and verdicts
for every non-trivial dependency.
Framework selection rejected Elysia after discovering an RCE vulnerability chain
through `new Function()` code generation
([GHSA-8vch-m3f4-q8jf](https://github.com/advisories/GHSA-8vch-m3f4-q8jf))
and measuring a 45x performance regression (3,853 vs 175,951 req/s)
when AOT compilation was disabled.
See [`PHILOSOPHY.tool-choices.md`](doc/philosophy/tool-choices.md) for the full
analysis of h3 vs Elysia vs Hono.

**Monorepo-aware CSS build tool**:
[`build-tool-css`](package/build-tool/css/) resolves `@import` through
`package.json` exports mappings and `node_modules`,
processes custom `@mixin`/`@apply` syntax,
and generates CSS strings for Shadow DOM injection,
all without native binaries.

**OpenTofu firewall automation**:
[`config-tofu`](package/config/tofu/) dynamically aggregates CIDR ranges
from 7 CDN sources (Cloudflare,
CloudFront,
Fastly,
GitHub,
YouTube,
Ubuntu ASN,
Coolify),
summarizes them to minimize Hetzner firewall rule count,
and caches ASN lookups for 30 days with graceful fallback to expired cache
on fetch failure.

**Custom typeface from SVG geometry**:
[`typeface-aquaticat`](package/typeface/aquaticat/) parses a master glyph strip SVG,
expands stroked outlines into filled contours using polygon offset math,
assembles an OpenType font via opentype.js,
and converts to WOFF2 through fonttools.

**Inference canary (paused)**:
[`inference-canary`](package-paused/dev-script/inference-canary/) runs five
code-generation probes against LLM models in parallel,
each executing inside a locked-down Podman container (no network,
read-only filesystem,
256 MB memory,
15 s timeout) and scored across correctness,
lint quality (oxlint),
and type safety (tsc),
with statistical threshold detection (mean - 2*stddev) flagging model degradation.

## Initial setup

### Prerequisites

Install [Mise](https://mise.jdx.dev/) (task runner and tool version manager).
All other tools (Node,
pnpm,
dprint,
Rust nightly,
Java,
and Bun for explicit Bun islands) are installed automatically by Mise.

### Clone and bootstrap

```sh
git clone https://github.com/Aquaticat/Monochromatic.git
cd Monochromatic
```

On first entry,
Mise warns about missing tools.
Trust the configuration so Mise evaluates environment variables,
templates,
and the `enter` hook:

```sh
mise trust
```

Trusting the monorepo root implicitly trusts all descendant `mise.toml` files
under `package/`.
See [mise trust docs](https://mise.jdx.dev/cli/trust.html)
for details on what this enables and why it is required.

The `enter` hook is a `bootstrap` task that runs `mise install` then `mise upgrade`,
so entering the trusted directory installs and updates the pinned tools
automatically;
it is plain cross-platform Mise with no separate task-runner shell to install
first.
Then install dependencies and build all packages:

```sh
mise run prepareAndBuild
```

## Essential commands

All builds and tasks use `mise run`.
Never invoke raw tools (`tsc`,
`tsdown`,
`bun test`,
`oxlint`,
`cargo`) or package manager scripts (`npm run`,
`pnpm exec`) directly.

```sh
# Build all packages
mise run build

# Run all tests (unit + browser + e2e)
mise run test

# Build then test (use this after editing source)
mise run buildAndTest

# Build and test a specific file
mise run buildAndTest -- package/module/async-time/src/wait.unit.test.ts

# Lint all files (oxlint, dprint, stylelint, markdown, rust, detekt)
mise run lint

# Format all files
mise run format

# Full validation: format, build, test
mise run validate

# Watch mode
mise run watch:build
mise run watch:test
```

Run a task in a specific package with the monorepo path prefix:

```sh
mise run //package/module/async-time:test:unit
mise run //package/webapp-productivity/done:build
```

## Project structure

```text
package/
  agent-harness-shared/     Shared agent-harness plugin logic (session discovery,
                              usage projection, shell-command analysis)
  build-tool/               Build tooling (CSS processor)
  claude-code-plugin/       Claude Code plugins and hooks (guardrail, statusline,
                              bash-output-filter, claude-spawn)
  cli/                      CLI tools (mvm, vmsync, terminal-exec, fy, rgffplay,
                              markdown-lint, mutation-test, unused-export,
                              WireGuard helpers, forbidden-strings scanner,
                              nested Wayland compositor)
  config/                   Shared configurations (cosign, dotfiles, dprint, oxlint,
                              rolldown, stylelint, tofu, typescript, lfs-r2-worker)
  desktop-app/              Desktop applications (GTK4/Qt/Electron file managers,
                              Slint terminal, Electron infrastructure)
  desktop-daemon/           Background services (hall-monitor)
  dev-script/               Developer utilities (file-enforcer, catalog-tighten,
                              deps-cube, page-weight, vm-builder, watch-restart)
  figma/                    Figma and Penpot tooling (kiwi parser, to-penpot converter)
  fuzz/                     Coverage-guided fuzzing harnesses (forbidden-strings)
  git-policy/               Policy-aware git wrapper, policy authoring API,
                              forbidden-strings policy
  intellij-plugin/          IntelliJ plugins (islands-black theme)
  kwin/                     KWin scripting (key-helper script and service)
  learning/                 Learning exercises (rust)
  linter/                   Custom linters (pluggable Rust linter, Kotlin linter)
  mcp/                      Model Context Protocol servers (stdio framework, mvm)
  module/                   Core TypeScript libraries (logger, test harness, observable,
                              memoize, css/jsonc/toml editing, image diff, kv-store)
  music-player/             True-peak-normalizing music player (shared Rust core,
                              Slint desktop app, Kotlin Android app)
  ownership-marker/         Ownership boundary markers (foreign-borrowed)
  oxlint-plugin/            Custom Oxlint plugins (tsdoc, no-restricted-syntax,
                              stylistic, prefer-readonly-parameter-type, test-import)
  pi-plugin/                Pi coding-agent plugins (advisor, guardrail, statusline,
                              spawn, morph-compact, search-fetch)
  pi-shared/                Shared Pi plugin logic (model selection, model review)
  rolldown-plugin/          Rolldown/tsdown plugins (import-attributes)
  runtime-error/            Runtime error reproductions (bun)
  rust-linter-plugin/       Rule plugins for the Rust linter (builtin)
  rust-module/              Rust libraries (forbidden-regex, rust-linter-core,
                              rust-linter-pattern)
  shim/                     API-compatible dependency shims
  ssg/                      Static site generator for aquati.cat
  stub/                     Dependency blocklist stubs
  test-fixture/             Test fixtures for CSS imports, oxlint rules, and toml-edit
  typeface/                 Custom fonts (aquaticat geometric typeface)
  webapp-productivity/      Productivity apps (done, doodle widget, rss, wc)
package-paused/             Paused packages (inference-canary, monochromatic stylesheet,
                              webapp-forge, webapp-search, webapp-edu, editord)
package-deprecated/         Deprecated packages retained for reference
```

## Technical stack

- **Task runner**:
  [Mise](https://mise.jdx.dev/) with Node (`shell = "node --input-type=module-typescript -e"`) for cross-platform task logic
- **Runtime**:
  [Node.js](https://nodejs.org/) for TypeScript task and CLI execution.
  Bun stays installed only for explicit Bun islands,
  such as the hall-monitor standalone compile task and runtime-error fixtures.
- **Package manager**:
  [pnpm](https://pnpm.io/) workspaces with catalog dependency management and isolated node_modules
- **Bundler**:
  [tsdown](https://tsdown.dev/) (Rolldown-based)
- **Languages**:
  TypeScript 7 with native `tsc` for type checking;
  Rust on the nightly toolchain as standalone crates without a root Cargo workspace
  (see `.out-of-scope/cargo-workspace.md`);
  Kotlin on Gradle for the Android app,
  IntelliJ plugin,
  and Kotlin linter
- **Linters**:
  Oxlint (with custom JS plugins for TSDoc and restricted syntax),
  the in-repo pluggable Rust linter plus Clippy,
  detekt,
  Stylelint,
  Harper (prose)
- **Formatter**:
  dprint (orchestrates all formatters including oxlint auto-fix)
- **Testing**:
  `@monochromatic-dev/module-test` unit files executed through Node-based `mise run` tasks,
  Playwright in Podman for browser and e2e tests,
  `cargo-fuzz` for coverage-guided fuzzing
- **HTTP framework**:
  [h3](https://h3.dev/) for server applications
- **Desktop UI**:
  GTK4,
  Slint,
  and Electron
- **Infrastructure**:
  OpenTofu,
  Hetzner Cloud,
  Caddy,
  Podman

## Platform support

Development targets Linux (Fedora).
Use WSL2 on Windows:
some tools (e.g. Zellij) have no native Windows support.

## License

[LGPL-3.0-or-later](LICENSE) for code,
with root package metadata also declaring
[CC-BY-SA-4.0](LICENSES/CC-BY-SA-4.0.txt) for shareable documentation and content.

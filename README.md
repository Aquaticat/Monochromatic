# Monochromatic

A TypeScript monorepo (96 packages) for web applications,
 design systems,
developer tooling,
 AI integrations,
 local agent tooling,
 and infrastructure automation.

## Highlights

**Minimal MCP server**:
[`mcp-stdio`](package/mcp/stdio/) implements Model Context Protocol
revision 2026-07-28 over stdio,
with one workspace dependency and nothing from outside the repo.
The official `@modelcontextprotocol/sdk` pulls 5.8 MB and 17 dependencies
(Express,
 Hono,
 jose,
 OAuth,
 rate limiting,
 SSE);
this package implements only JSON-RPC 2.0,
 `server/discover`,
`tools/list`,
 and `tools/call`.

**Inference canary**:
[`inference-canary`](package-paused/dev-script/inference-canary/) runs five
code-generation probes (CSV parser,
 expression evaluator,
 CSS mixin transpiler,
stack interpreter,
 task scheduler) against 8 LLM models in parallel.
Each probe executes inside a locked-down Podman container (no network,
read-only filesystem,
 256 MB memory,
 15 s timeout) and scores across
correctness,
 lint quality (oxlint),
 and type safety (tsc).
Statistical threshold detection (mean - 2*stddev) flags model degradation
before it affects development.

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

**Custom Oxlint plugins**:
[`oxlint-tsdoc`](package/oxlint-plugin/tsdoc/) enforces TSDoc correctness
across 20+ rules with 23 fixture-based tests,
 replacing the slow
eslint-plugin-jsdoc integration that previously required ESLint.
[`oxlint-no-restricted-syntax`](package/oxlint-plugin/no-restricted-syntax/)
encodes 13 monorepo-specific AST rules (no arrow functions,
 no switch statements,
require destructured params for 2+ args) that Oxlint's lack of AST selectors
demands as dedicated rule implementations.

**Monorepo-aware CSS build tool**:
[`build-tool-css`](package/build-tool/css/) resolves `@import` through
`package.json` exports mappings and `node_modules`,
 processes custom
`@mixin`/`@apply` syntax,
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
[`typeface-aquaticat`](package/typeface/aquaticat/) parses a master glyph strip
SVG,
 expands stroked outlines into filled contours using polygon offset math,
assembles an OpenType font via opentype.
js,
 and converts to WOFF2 through
fonttools.

## Initial setup

### Prerequisites

Install [Mise](https://mise.jdx.dev/) (task runner and tool version manager).
All other tools (Node,
 pnpm,
 dprint,
 and Bun for explicit Bun-only packages) are installed automatically by Mise.

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
 `oxlint`) or package manager scripts (`npm run`,
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
mise run //package/module/async-time:test
mise run //package/webapp-productivity/done:build
```

## Project structure

```text
package/
  audit/                    Compliance audits (1 package)
  build-tool/               Build tooling (CSS processor)
  claude-code-plugin/      Claude Code plugins and shared hook source (10 packages)
  cli/                      CLI tools (git wrapper, mvm, vmsync,
                              terminal-exec, cli-fy, rgffplay)
  config/                   Shared configurations (dprint, oxlint,
                              stylelint, tofu, tsdown, typescript)
  desktop-daemon/           Background services (editord, hall-monitor)
  dev-script/               Developer utilities (file-enforcer, inference-canary,
                              catalog-tighten, page-weight, task utilities)
  figma/                    Figma and Penpot tooling (kiwi parser, to-penpot converter)
  mcp/                      Model Context Protocol servers (stdio, nvim, mvm)
  module/                   Core libraries (functional utilities, test harness,
                              logger, path helpers, image diff, TOML editing)
  pi/                       Pi coding-agent extensions and utilities
  rolldown-plugin/          Rolldown/tsdown plugins (import-attributes)
  runtime-error/            Runtime error reproductions (bun)
  shim/                     API-compatible dependency shims
  stub/                     Dependency blocklist stubs
  stylesheet/               Design system (monochromatic CSS framework)
  test-fixture/             Test fixtures for CSS imports and oxlint rules
  typeface/                 Custom fonts (aquaticat geometric typeface)
  webapp-content/           Content sites and demos
  webapp-edu/               Education web applications
  webapp-forge/             Forge server, seed data, and stress tooling
  webapp-productivity/      Productivity apps (done, doodle widget, rss)
  webapp-search/            Search apps (ai-tree, exa-search)
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
- **Language**:
   TypeScript 7 with native `tsc` for type checking
- **Linters**:
   Oxlint (with custom JS plugins for TSDoc and restricted syntax),
   Stylelint,
   Harper (prose)
- **Formatter**:
   dprint (orchestrates all formatters including oxlint auto-fix)
- **Testing**:
   `@monochromatic-dev/module-test` unit files executed through Node-based `mise run` tasks,
   Playwright in Podman for browser and e2e tests
- **HTTP framework**:
   [h3](https://h3.dev/) for server applications
- **Infrastructure**:
   OpenTofu,
   Hetzner Cloud,
   Caddy,
   Podman

## Platform support

Development targets Linux (Fedora).
 Use WSL2 on Windows:
 some tools
(e.g. Zellij) have no native Windows support.

## License

[LGPL-3.0-or-later](LICENSE) for code,
 with root package metadata also declaring
[CC-BY-SA-4.0](LICENSES/CC-BY-SA-4.0.txt) for shareable documentation and content.

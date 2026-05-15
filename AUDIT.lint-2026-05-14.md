# AUDIT.lint-2026-05-14

Inventory of lint issues across the workspace, partitioned by what was auto-delegated to spawn-claude children vs. what needs your judgment. Generated 2026-05-14 from per-package runs of `mise run //packages/<pkg>:lint`.

## Workspace scale

- 87 packages with a `lint` task
- ~50 packages with non-zero warnings/errors (after the build-tool/css cascade fix in commit a10df401)
- Approximately 3,300 total warnings + 230 errors across the workspace
- Single largest rule: `stylistic(no-mixed-operators)` (~1,900 occurrences workspace-wide; 301 in editord alone, 206 in messages-demo, 119 in webapp-forge/server)
- Single largest package: `dev-script/deps-cube` (602 warnings, 28 different rules touched)

## Auto-delegated (no input needed)

Children were spawned to fix everything below mechanically, following the recipes already encoded in `AGENTS.md`.

Note: rule names appear with their plugin namespace exactly as oxlint reports them. `no-restricted-syntax(<name>)` is the project's local plugin.

| Rule                                                                                                                                                                                                                                                                                                                                    | Pattern                                       | Remediation children apply                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stylistic(no-mixed-operators)`                                                                                                                                                                                                                                                                                                         | `a === b \|\| c === d`, `a > 0 && b !== null` | wrap each comparison in parens                                                                                                                                                    |
| `no-restricted-syntax(no-function-root-let)`                                                                                                                                                                                                                                                                                            | `let x = …;` at function-body root            | refactor to const/ternary/Array.reduce; IIFE; helper-extract; otherwise `oxlint-disable-next-line` with justification per CLAUDE.md                                               |
| `no-restricted-syntax(no-module-root-let)`                                                                                                                                                                                                                                                                                              | `let x = …;` / `export let x` at module root  | Map/Set/memoize/IIFE-to-const; otherwise disable + justification                                                                                                                  |
| `no-restricted-syntax(require-destructured-params)`                                                                                                                                                                                                                                                                                     | `function f(a, b) {…}`                        | refactor to `function f({a, b}) {…}` and update ALL call sites workspace-wide (children own their package's source plus any cross-package callers, retrying on `.git/index.lock`) |
| `tsdoc(multiline-blocks)`                                                                                                                                                                                                                                                                                                               | TSDoc layout                                  | reflow per oxlint-tsdoc rules                                                                                                                                                     |
| `tsdoc(tag-lines)`, `tsdoc(valid-types)`, `tsdoc(require-param)`, `tsdoc(require-returns)`                                                                                                                                                                                                                                              | TSDoc tag/format issues                       | mechanical TSDoc fixes                                                                                                                                                            |
| `tsdoc(require-example)`                                                                                                                                                                                                                                                                                                                | exported decl missing `@example`              | write a good, realistic example with concrete domain values (no `foo`/`bar` placeholders)                                                                                         |
| `eslint(prefer-template)`, `prefer-destructuring`                                                                                                                                                                                                                                                                                       | string concat, manual destructuring           | convert to template literal / destructure                                                                                                                                         |
| `stylistic(argument-per-line)`, `(param-per-line)`, `(tuple-per-line)`, `(array-element-per-line)`, `(export-per-line)`, `(type-property-per-line)`                                                                                                                                                                                     | multi-item one-liners over the line cap       | split onto own lines                                                                                                                                                              |
| `eslint-plugin-unicorn(prefer-string-raw)`, `(no-zero-fractions)`, `(numeric-separators-style)`, `(number-literal-case)`, `(consistent-function-scoping)`, `(prefer-global-this)`, `(prefer-query-selector)`, `(prefer-string-replace-all)`, `(prefer-dom-node-remove)`, `(prefer-add-event-listener)`, `(no-array-callback-reference)` | misc unicorn rules                            | apply each rule's canonical fix                                                                                                                                                   |
| `eslint(no-duplicate-imports)`, `(no-await-in-loop)`, `(no-magic-numbers)`, `(new-cap)`, `(init-declarations)`, `(require-await)`, `(no-alert)`, `(prefer-destructuring)`                                                                                                                                                               | misc core eslint rules                        | apply canonical fix; for `no-magic-numbers` import from `@monochromatic-dev/module-numeric-const` (`MS_PER_DAY`, `BYTES_PER_KIB`, `HTTP_*`, fractions, etc.) and add it as a dep  |
| `typescript-eslint(no-unsafe-call)`, `(no-unsafe-assignment)`, `(no-unsafe-argument)`, `(no-unsafe-return)`, `(no-unsafe-member-access)`, `(strict-boolean-expressions)`, `(no-non-null-assertion)`, `(no-confusing-void-expression)`, `(prefer-nullish-coalescing)`                                                                    | type narrowing                                | add narrowing/cast; for genuinely-untyped third-party data use `nonNullishOrThrow` from `@monochromatic-dev/module-or-throw` or disable + justification                           |
| `eslint(max-lines)`                                                                                                                                                                                                                                                                                                                     | file exceeds line cap                         | split per CLAUDE.md `index.ts → barrel re-export` pattern                                                                                                                         |
| `eslint-plugin-promise(avoid-new)`                                                                                                                                                                                                                                                                                                      | manual Promise constructor                    | rewrite to async function or use `wait()` from `@monochromatic-dev/module-async-time`                                                                                             |
| `eslint-plugin-import(unambiguous)`, `(no-unassigned-import)`                                                                                                                                                                                                                                                                           | top-level statement issues                    | apply canonical fix                                                                                                                                                               |
| `no-restricted-syntax(no-promise-catch)`, `(require-queryselector-generic)`                                                                                                                                                                                                                                                             | local plugin rules                            | apply per rule docs                                                                                                                                                               |

If a child encounters something that genuinely cannot be remediated (true mutual exclusion, requires API change spanning packages, etc.), it appends to `/tmp/audit-needs-input/<pkg>.md` instead of touching the file, and the file ends up listed in **Open questions** below at the end of this run.

## Already fixed by parent (sequentially, before fan-out)

| Commit                                                                           | Why couldn't a child handle it                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `a10df401` fix(build-tool/css): migrate from module-es/ts/path to module-fs-path | Cross-package import cascade: build-tool/css's TS2307 was leaking into 3 downstream packages (inference-canary-viewer, messages-demo, done-postcss). Fixing in a child while parallel children worked on downstream packages would have raced; phantom type errors in their lint reports would have wasted spawn cycles. |

## Policy decisions (you answered while I was setting up)

| Question                                                           | Your answer                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. 1,900 `no-mixed-operators` workspace-wide — fix or relax?       | **Fix all mechanically by adding parens.**                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2. `tsdoc(require-example)` — minimal stubs or real examples?      | **Write good examples.** Children invest in realism.                                                                                                                                                                                                                                                                                                                                                                                                 |
| 3. `no-magic-numbers` on time/byte math — local consts or disable? | **Import from `@monochromatic-dev/module-numeric-const`.** Already has `MS_PER_DAY`, `BYTES_PER_KIB`, `HTTP_NOT_FOUND`, `HALF`, etc. Add it as a dep where needed.                                                                                                                                                                                                                                                                                   |
| 4. `require-destructured-params` workspace-wide — defer or do it?  | **Do it workspace-wide. Be creative.** Children rename signatures and update every caller across the workspace, retrying on `.git/index.lock`. 21 of 255 declarations are exported with cross-package callers (`applyMixins`, `defineTool`, `createMcpServer`, `jsx`, `el`, `createTaskCard`, `requireParam`, etc.); each child that owns one of those sources is told to update callers in other packages too. The remaining 234 are package-local. |

Cross-package caller maps live at `/tmp/rdp-survey/cross-pkg.txt` (21 entries with target file lists) and `/tmp/rdp-survey/internal-only.txt` (234 entries).

## Why this many issues?

The workspace appears to have recently accumulated stricter lint rules without a backfill sweep. ~3,300 warnings is not a "few stragglers"; it's a backlog. After this sweep, consider a CI gate so the count stays at zero.

## Per-package counts (after a10df401)

For your reference when reviewing diffs. Numbers are `warnings / errors` from oxlint, plus `T:N` for TS type errors.

```text
build-tool/css                72 / 7   (T:3 → 0 after a10df401)
cli/fy                          2 / 0
cli/git                         5 / 0
cli/mvm                        21 / 8
cli/rgffplay                    7 / 0
cli/terminal-exec              51 / 0
cli/vmsync                     21 / 4
config/oxlint-no-restricted-syntax    90 / 2
config/oxlint-stylistic        41 / 0
config/oxlint-tsdoc            83 / 1
desktop-daemon/editord        358 / 0
desktop-daemon/hall-monitor     7 / 2
dev-script/catalog-tighten     21 / 4
dev-script/deps-cube          602 / 0
dev-script/file-enforcer       37 / 18
dev-script/inference-canary   126 / 42
dev-script/inference-canary-viewer    61 / 14   (T:3 → 0 after a10df401)
dev-script/page-weight         30 / 3
dev-script/task-util           66 / 10
dev-script/vm-builder           4 / 0
dev-script/watch-restart       39 / 0
mcp/mvm                         7 / 1
mcp/nvim                       38 / 4
mcp/stdio                      17 / 7
module/es                     203 / 48
module/fs-path                 36 / 0
module/hyperscript             10 / 0
module/image-diff              29 / 0
module/logger                  23 / 0
module/matrix                  11 / 0
module/numeric-format           6 / 0
module/or-throw                42 / 0
module/test                    24 / 0
module/token-count              3 / 0
module/zip-writer               7 / 1
pi/auto-mode                  111 / 37
pi/morph-compact               80 / 17
pi/terminal-title               6 / 11
rolldown-plugins/import-attributes    32 / 0
shim/proper-lockfile            3 / 0
typeface/aquaticat             36 / 7
webapp-content/messages-demo  276 / 22   (T:3 → 0 after a10df401)
webapp-content/ssg-test       112 / 6
webapp-edu/paper2vn           228 / 26
webapp-forge/seed              25 / 3
webapp-forge/server           146 / 12
webapp-forge/stress             3 / 2
webapp-productivity/done       66 / 11
webapp-productivity/done-postcss   50 / 11   (T:3 → 0 after a10df401)
webapp-productivity/doodle-widget    121 / 0
webapp-productivity/rss        29 / 0
webapp-productivity/syllable-break-demo    12 / 0
```

## Process notes

- Orchestrator: `/tmp/lint-orchestrator/run.sh`. Tails `/tmp/lint-orchestrator/progress.log` for live status.
- Child prompt template: `/tmp/lint-orchestrator/prompt.txt`. Substitutes `{PKG}` and `{PKG_FLAT}` per package.
- Per-package lint output captured at: `/tmp/lint-all-pkgs/<pkg_flat>.out`.
- Max 16 children in flight (per your cap).
- Spawn state files: `~/.claude/spawn-results/spawns/{spawnId}.json`; flip to `status:stopped` on completion, then renamed to `.reported` once consumed by the parent.
- Each child commits its own diff in a conventional `fix(<pkg>): lint sweep` commit, so the history reads as one commit per package.
- Children may NOT edit: root configs (`AGENTS.md`, `CLAUDE.md`, `.claude/`), workspace-level package.json or pnpm-workspace.yaml, `file-enforcer.config.ts`, or any package other than their own.

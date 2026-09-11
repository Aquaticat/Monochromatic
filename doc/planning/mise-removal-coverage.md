# Mise removal coverage

Status:
 draft.
Full removal is the intended endpoint,
but is not yet recommended because replacement owners remain unselected and unverified.
Keeping Mise only for tool provisioning and locking is a transitional checkpoint,
not the target state.

## Trigger and correction

The initial assessment recommended narrowing Mise before assigning every consumed responsibility to an owner.
That skipped the question that determines whether removal is viable:
what supplies each capability after Mise is gone?

This ledger records current owners,
proposed boundaries,
selection status,
parity evidence required before cutover,
and behavior that may be retired intentionally.
It is not a technology selection or adoption decision.

## Measured scope

Measurements used tracked files plus `mise tasks --all --hidden --json` from the repository root.

- 178 active Mise configuration files contain 9,422 newline-delimited lines.
- Root `mise.toml` declares 37 tools;
  `mise.lock` contains 38 tool entries that must be reconciled during a provisioning audit.
- Mise reports 1,811 effective tasks from 169 source files.
  This count includes inherited templates and is configuration-surface evidence,
  not a count of independent migration units.
- 9 of 14 tracked GitHub workflow files reference Mise.
- 160 active `package.json` files contain one script entry,
  the placeholder in `package/figma/to-penpot/package.json`.
- Effective task metadata contains 39 tasks with declared dependencies,
  133 with usage specifications,
  and no tasks with sources,
  outputs,
  post-dependencies,
  wait-for dependencies,
  or task-local tools.
- Task metadata reports no `raw` or `interactive` task properties,
  but `mise run --raw secrets:edit` is a documented CLI override and remains an interactive contract.

## Coverage ledger

### Tool acquisition, versions, and bootstrap prerequisite

Current owner:
 Mise `[tools]`,
backends,
shims,
`mise.lock`,
`mise install`,
and `mise upgrade`.

Evidence:
 `mise.toml:27-211`,
`mise.lock`,
`.github/workflows/npm-release.yml`,
and package Containerfiles.
The declarations span runtime toolchains,
language-package backends,
release artifacts,
Rust components,
JDK and Android tooling,
and platform-specific binaries.

Proposed owner:
 unselected focused tool manager or composition of focused installers.
One manually installed bootstrap prerequisite must be able to provision the runtime needed by later layers.

Selection status:
 blocked on a choosing-technology audit.
Do not assume one manager must cover every backend,
and do not assume ecosystem-native managers compose into a cross-platform solution.

Parity gate:
 a disposable clean home on every supported operating system installs the committed versions,
checks supported artifact integrity and provenance,
applies tool options and components,
exposes executables to shells and child processes,
and performs explicit updates without unrelated installations.

Intentionally retired behavior:
 none selected.
Floating `latest` requests require an explicit reproducibility decision.

### Task discovery and execution

Current owner:
 Mise monorepo discovery,
task templates,
target-path names,
arguments,
aliases,
working directories,
dependency execution,
and output handling.

Evidence:
 `mise.no-env.toml`,
active package `mise.toml` files,
and `doc/decision/mise-task-node-invocations.md`.
`mise.no-env.toml:282-343` already implements repository-owned discovery filtering,
bounded fanout,
and failure collection inside Node scripts that invoke Mise recursively.

Proposed owner:
 unselected focused task runner.
Executable task logic should expose ordinary argument-vector and exit-status contracts rather than depend on Mise templates,
`MISE_TASK_NAME`,
or `mise tasks` discovery.
Thin Mise adapters may remain during migration.

Selection status:
 blocked on candidate discovery,
source audit,
and representative runtime validation.

Parity gate:
 preserve package namespaces,
partial invocation,
paths containing spaces,
sequential and parallel groups,
missing optional package builds,
intentional failure tolerance,
tests continuing after build failure where required,
retained failure causes,
machine-readable task listing,
and correct aggregate exit status.
`package/dev-script/task-util/src/build-and-test.unit.test.ts` is part of the acceptance boundary.

Intentionally retired behavior:
 no task feature is selected for retirement.
Unused Mise task features do not need replacement unless a current caller outside task metadata is found.

### Watching and process lifecycle

Current owner:
 several different paths.
Some packages invoke `mise watch`,
root `watch:*` tasks fan out through Mise,
and file-enforcer owns its own `--watch` mode.

Evidence:
 `package/kwin/key-helper/mise.toml`,
`package/ssg/aquati.cat/mise.toml`,
`package/webapp-productivity/done/mise.toml`,
and root watch templates.

Proposed owner:
 direct watcher processes or a focused task runner,
selected per current behavior rather than by blanket translation.

Selection status:
 unselected.

Parity gate:
 verify watched roots,
ignore rules,
restart versus parallel behavior,
argument forwarding,
signal delivery,
child cleanup,
and terminal restoration.

Intentionally retired behavior:
 none selected.

### Environment, PATH, and shell activation

Current owner:
 Mise tool environments,
root and package `[env]` sections,
`[vars]`,
configuration precedence,
and optional shell activation.
`file-enforcer.config.ts:652-720` generates root PATH entries from installed workspace bins.

Evidence:
 `mise.toml:1241-1325` and package environment sections.
The active project has four top-level `[env]` sections and six `[vars]` sections.
The root enter hook is commented out,
so its bootstrap-on-entry description does not prove current automatic execution.

Proposed owner:
 unselected explicit environment launcher for tasks and CI.
Automatic directory-entry activation is a separate preference and receives a separate owner only if retained.

Selection status:
 blocked on deciding whether ambient shell activation is required.

Parity gate:
 preserve root and package precedence,
working-directory behavior,
PATH ordering,
workspace executable discovery,
tool-produced variables,
and clean-clone operation before workspace dependencies exist.
Test direct shell,
IDE,
task,
and CI consumers separately.

Intentionally retired behavior:
 automatic shell activation is undecided,
not implicitly retired.

### Secrets, redaction, and interactive editing

Current owner:
 Mise loads optional encrypted `.env.local.json` through its rops integration,
marks values for output redaction,
and injects them into commands.
SOPS and age own editing and cryptographic primitives.

Evidence:
 `mise.toml:1241-1248` and the `secrets:edit` task.

Proposed owner:
 retain SOPS and age as primitives;
select or build a narrow child-environment launcher for decryption and injection.
Output redaction,
command echoing,
and interactive terminal passthrough are separate responsibilities.

Selection status:
 launcher unselected and behavior unverified.
Identity provisioning currently references `~/.config/mise/age.txt` and needs a Mise-independent location decision.

Parity gate:
 disposable canary secrets prove optional-file absence,
invalid ciphertext failure,
missing identity failure,
child-only injection,
stdout and stderr redaction,
error redaction,
interactive editor access,
signal handling,
and absence of plaintext files.
Never use real credentials for this gate.

Intentionally retired behavior:
 none selected.

### CI integration

Current owner:
 `jdx/mise-action`,
Mise caches,
job-scoped `mise install`,
`mise exec`,
and `mise run`.
Six workflows disable automatic installation to prevent unrelated root tools from being installed.

Evidence:
 `.github/workflows/npm-release.yml:35-83` and the other Mise-using workflows.
The npm release workflow also writes resolved Node and pnpm directories to `$GITHUB_PATH` for later third-party actions.

Proposed owner:
 the selected tool provisioner plus the selected task and environment interfaces.
CI should request only each job's tools.

Selection status:
 blocked by those selections.

Parity gate:
 all nine workflows preserve cache keys,
release-age policy,
locked versions,
PATH across steps,
job permissions,
secret masking,
and the same user-facing task behavior as local execution.

Intentionally retired behavior:
 none selected.

### Repository-root discovery

Current owner:
 `MISE_MONOREPO` in `@monochromatic-dev/module-fs-path` and its consumers.

Evidence:
 `package/module/fs-path/src/root-marker.ts` plus consumers in application,
CLI,
build,
test,
and VM code.
The package already exports `PNPM_WORKSPACE` and `GIT_REPOSITORY`,
but those markers represent different boundaries.

Proposed owner:
 select the marker separately for each caller's domain.
A package-workspace boundary and a Git-checkout boundary are not interchangeable.

Selection status:
 caller classification pending.

Parity gate:
 cover nested workspaces,
Git worktrees whose `.git` is a file,
source archives,
missing markers,
nearest-marker behavior,
and cached lookup behavior.

Intentionally retired behavior:
 the Mise-specific marker can retire only after every caller has a semantically correct replacement.

### Editors, VM images, and containers

Current owner:
 Mise shims and install paths appear in IntelliJ configuration;
the development VM installs Mise and seeds its global configuration;
Containerfiles use Mise for selected runtime setup.

Evidence:
 `.idea/dprintProjectConfig.xml`,
`.idea/opentofu_settings.xml`,
`.idea/misc.xml`,
`package/config/dotfiles/`,
`package/dev-script/vm-builder/Containerfile`,
and `package/cli/mutation-test/runtime/Containerfile`.

Proposed owner:
 selected tool provisioner paths or stable project-local wrappers.
Existing Containerfiles and VM-builder code remain machine-setup owners,
not a new task runner.

Selection status:
 blocked by tool-provider selection.

Parity gate:
 editor linting,
formatting,
JDK selection,
OpenTofu integration,
VM construction,
and container runtime paths work without user-specific hardcoded locations.

Intentionally retired behavior:
 Mise schema and IDE-plugin configuration may retire after all `mise.toml` files retire.

### File-enforcer provisioning policy

Current owner:
 file-enforcer generates root `mise.toml`,
queries `mise registry`,
and excludes Mise-installable tools from other package-manager provisioning paths.

Evidence:
 `file-enforcer.config.ts`,
`package/dev-script/file-enforcer/src/package/manager-defs.ts`,
and
`package/dev-script/file-enforcer/src/package/mise.generate-index.ts`.

Proposed owner:
 the provisioning inventory and generator for the selected tool-provider composition.

Selection status:
 blocked by tool-provider selection.

Parity gate:
 generated files remain deterministic,
required system packages are not filtered out accidentally,
and no tool is omitted because a retired registry formerly claimed ownership.

Intentionally retired behavior:
 Mise-registry filtering retires only with a replacement classification rule.

### Agent policy, guardrails, filters, tests, and documentation

Current owner:
 repository policy requires `mise run`;
agent guardrails recognize its command form;
output filters classify Mise warnings;
fixtures require a Mise executable;
README and troubleshooting documents teach Mise commands.

Evidence:
 `AGENTS.md:844-879`,
`package/agent-harness-shared/shell-command-analyzer/`,
`package/pi-plugin/guardrail/`,
`package/claude-code-plugin/source/src/handler/bash-output-filter/`,
and Mise-specific test fixtures.

Proposed owner:
 selected task command grammar,
tool diagnostics,
and migration documentation.
Historical troubleshooting evidence remains historical and should not be rewritten as current instructions.

Selection status:
 blocked by final interfaces.

Parity gate:
 command analysis permits the new safe forms,
blocks their unsafe variants,
filters only diagnostics proven safe to suppress,
and all user-facing instructions name executable commands that pass at the consumer boundary.

Intentionally retired behavior:
 Mise-specific noise transforms and command exceptions should retire when no active producer remains.

### Upstream features not consumed by tracked project configuration

Searches of tracked root and package configuration and source found no active `[bootstrap.*]`,
`mise bootstrap`,
Mise MCP,
Mise OCI,
or Mise dependency-management invocation.
The root task named `bootstrap` is a project task that runs `mise install` and `mise upgrade`,
not Mise's machine-bootstrap subsystem.

Proposed owner:
 none.
Unused upstream capabilities require no replacement.

Parity gate:
 repeat the search across the final tracked tree and inspect user-global configuration separately before claiming machine-wide removal.

Intentionally retired behavior:
 these unconsumed project capabilities may remain absent.

## Safe migration sequence

1. Select and validate task and environment boundaries while Mise remains installed.
2. Move executable logic behind ordinary process interfaces that do not require Mise discovery,
templates,
or environment variables.
Keep thin Mise adapters so existing callers continue working.
3. Run representative TypeScript,
Rust,
Android,
desktop,
watch,
deployment,
and secret paths through both interfaces in disposable fixtures.
4. Migrate CI,
editor paths,
root discovery,
file-enforcer policy,
agent tooling,
and documentation only after their new owners pass their parity gates.
5. Select and validate tool provisioning early,
but cut it over after task and environment consumers no longer require Mise semantics.
6. Remove Mise configuration and installation only after a clean-machine exercise passes without it.

Every step is an independently useful checkpoint.
Keeping Mise solely for tool acquisition,
version selection,
and locking is an acceptable transition state while the final provisioning replacement is validated.

## Removal gates

Full removal remains blocked until all conditions hold:

- Every ledger entry has a selected owner or an explicitly accepted retirement decision.
- Every selected external technology completes the choosing-technology process.
- Clean disposable environments pass on every supported operating system and CI runner.
- Local and CI invocations use one verified task contract.
- Secret and interactive terminal tests pass with synthetic credentials.
- Tool integrity,
provenance,
version locking,
and update behavior meet or exceed the current contract.
- IDE,
VM,
container,
agent,
and source-level consumers no longer depend on active Mise behavior.
- A broad search finds no active Mise invocation outside preserved historical evidence.
- The rollback path has been exercised before deleting the Mise files.

## Unresolved preferences

The following user choices can change the architecture and candidate set:

- Keep or retire automatic directory-entry environment activation.
- Prefer one focused cross-language tool manager or several ecosystem-native installers.
- Preserve floating tool requests or replace them with reviewed update automation and exact locks.

Full removal of the Mise binary is the accepted endpoint assumption for candidate discovery.

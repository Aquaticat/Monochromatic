# file-enforcer alternatives audit

## Scope

This audit compares `packages/dev-script/file-enforcer` with tools discoverable from
`mise registry` that could plausibly be used to keep derived files synchronized.
The registry was captured with `mise registry` on 2026-06-15 into
`/tmp/agent/mise-registry-2026-06-15.txt`;
it contained 815 entries.

The screen promoted tools that can render,
update,
apply,
watch,
or validate files.
General CLIs,
cloud tools,
package managers,
and unrelated linters were not treated as alternatives.
The serious candidates were cloned under `/tmp/agent/file-enforcer-audit-20260615/`
with `gh repo clone <repo> <path> -- --depth 1`.

SaaS vendor vetting is not applicable here:
all candidates considered as alternatives are open-source local CLIs or libraries.
No closed-source SaaS tool is recommended.

## Baseline: what file-enforcer does for this repo

`file-enforcer` is not only a template renderer.
The root `file-enforcer.config.ts` is executable TypeScript that currently:

- copies `AGENTS.md` into generated `CLAUDE.md` with repo-specific prefacing text;
- generates root `mise.toml` from `mise.no-env.toml` plus computed package bin paths;
- seeds a gitignored forbidden-string appendix and concatenates the scanner config;
- resolves Browserslist targets through the installed `browserslist` package;
- patches JetBrains LSP4IJ settings;
- mirrors canonical skills to legacy agent directories;
- rejects forbidden root `CONTEXT.md` while registering it for watch mode.

Implementation evidence:

- `packages/dev-script/file-enforcer/src/cli.ts` finds `file-enforcer.config.ts`,
imports it,
and optionally starts watch mode.
- `packages/dev-script/file-enforcer/src/io/cat.ts` records reads and glob expansions.
- `packages/dev-script/file-enforcer/src/io/write.ts` implements `overwrite`,
`overwriteIfNotExists`,
`overwriteEach`,
atomic writes,
and skip-if-identical behavior.
- `packages/dev-script/file-enforcer/src/io/write-lazy.ts` and `src/io/staleness-*.ts`
implement persisted staleness entries for lazy builders.
- `packages/dev-script/file-enforcer/src/watch/*.ts` implements chokidar-backed reruns,
protected-destination classification,
and serial rerun queuing.
- `packages/dev-script/file-enforcer/src/pipeline/{json,toml,xml,transform}.ts`
provides structured transforms beyond byte concatenation.
- `packages/dev-script/file-enforcer/src/package/*.ts` implements system package discovery
for packages that mise cannot manage.

Measured local test surface on 2026-06-15:
`packages/dev-script/file-enforcer/src` contains 71 production `.ts` files,
51 `*.unit.test.ts` files,
seven `*.property.unit.test.ts` files,
and one container test file.
`packages/dev-script/file-enforcer/mise.toml` also defines `fuzz` and container-isolated
`test:mutation` tasks.
`docs/decisions/file-enforcer-fuzzing.md` records the fast-check property-test decision
and the JSON defects those properties found.

A replacement must therefore cover five things at once:

- programmable local generation;
- tracked source reads and content-stable writes;
- structured JSON,
TOML,
XML,
glob,
and platform helpers;
- watch-mode reruns plus managed-destination protection;
- low-friction use inside this monorepo without moving logic to shell glue.

No alternative from the registry covers all five.

## Recommendation

Keep `file-enforcer` as the repo's derived-file synchronizer.

Use these tools only as complements:

- `updatecli` for dependency,
version,
and policy update pipelines that may open SCM changes;
- `go-task/task` when a package needs source/generate/status task orchestration;
- `gomplate`,
`copier`,
or `cookiecutter` for project or template scaffolding;
- `vendir` for vendored external directories;
- `cue`,
`pkl`,
`ytt`,
`dhall`,
or `jsonnet` for structured configuration languages;
- `yq`,
`dasel`,
`taplo`,
or `tombi` for narrow structured-file edits or validation;
- `watchexec`,
`pre-commit`,
or `lefthook` to invoke file-enforcer,
not replace it.

No replacement candidate became a finalist.
For that reason this audit source-read and maintenance-checked serious alternatives,
but did not run each upstream project's full test suite.
A future migration decision to any one candidate requires a second vetting pass that builds it,
runs its full validation,
and exercises this repo's integration boundary.
The incumbent finalist,
`file-enforcer`,
is validated by this repo's own package tasks.

## Registry screen

### Serious candidates cloned and audited

These entries from `mise registry` survived the capability screen and were cloned:

- `updatecli`,
from `aqua:updatecli/updatecli`;
- `boilerplate`,
from `aqua:gruntwork-io/boilerplate`;
- `gomplate`,
from `aqua:hairyhenderson/gomplate`;
- `copier`,
from `pipx:copier`;
- `cookiecutter`,
from `pipx:cookiecutter`;
- `chezmoi`,
from `aqua:twpayne/chezmoi`;
- `vendir`,
from `aqua:carvel-dev/vendir`;
- `cue`,
from `aqua:cue-lang/cue`;
- `go-jsonnet`,
from `aqua:google/go-jsonnet`;
- `dhall`,
from `aqua:dhall-lang/dhall-haskell`;
- `pkl`,
from `aqua:apple/pkl`;
- `ytt`,
from `aqua:carvel-dev/ytt`;
- `dasel`,
from `aqua:TomWright/dasel`;
- `yq`,
from `aqua:mikefarah/yq`;
- `taplo`,
from `aqua:tamasfe/taplo`;
- `tombi`,
from `aqua:tombi-toml/tombi`;
- `watchexec`,
from `aqua:watchexec/watchexec`;
- `just`,
from `aqua:casey/just`;
- `task`,
from `aqua:go-task/task`;
- `pre-commit`,
from `aqua:pre-commit/pre-commit` and `pipx:pre-commit`;
- `lefthook`,
from `aqua:evilmartians/lefthook` and `go:github.com/evilmartians/lefthook`.

### Registry entries screened out as narrow adjuncts

These registry tools overlap only as command runners,
formatters,
validators,
or transform primitives.
They can be invoked by file-enforcer or by a hook/task runner,
but they are not derived-file
synchronizers by themselves:

- task runners:
`make`,
`cargo-make`,
`mage`,
`cmdx`,
`mask`,
`xc`;
- formatters and linters:
`dprint`,
`prettier`,
`biome`,
`yamlfmt`,
`editorconfig-checker`,
`ls-lint`,
`yamllint`,
`actionlint`,
`shellcheck`,
`shfmt`,
`ktlint`,
`hadolint`,
`golangci-lint`,
`staticcheck`,
`cfn-lint`,
`tflint`,
`kube-linter`,
`protolint`,
`regal`;
- policy and schema validators:
`conftest`,
`opa`,
`jsonschema`,
`checkov`,
`dependency-check`;
- transform primitives:
`jq`,
`gojq`,
`sd`,
`dasel`,
`yq`;
- configuration package helpers:
`jsonnet-bundler`,
`jb`,
`helm`,
`helmfile`,
`kustomize`,
`ksops`,
`vals`.

`dasel` and `yq` appear in both lists because they are useful enough to source-read,
but their final role is still adjunct,
not replacement.

## Candidate comparisons

### Updatecli

Verdict:
serious complement,
not replacement.

Updatecli is the most important alternative in this audit.
Its homepage describes it as a tool that applies file update strategies,
and its introduction describes an update pipeline with `source`,
`target`,
and `condition`
concepts for automating dependency,
version,
and configuration updates.
That is genuinely adjacent to file-enforcer.

Evidence inspected:

- docs fetched from `https://www.updatecli.io/` and
`https://www.updatecli.io/docs/prologue/introduction/`;
- clone:
`/tmp/agent/file-enforcer-audit-20260615/updatecli__updatecli`;
- `pkg/core/pipeline/target/main.go` applies resource targets,
optional transformers,
SCM checkout,
commit,
and push behavior;
- `pkg/plugins/resources/file/target.go` can create or update files,
render a Go template with Sprig functions,
replace by regexp,
and skip when content is already current;
- `pkg/plugins/resources/yaml/target.go` updates YAML targets through configured engines;
- `.github/workflows/go.yaml` builds,
runs lint,
short tests on pull requests,
scheduled full tests,
e2e tests,
and Codecov upload.

Maintenance and quality:
GitHub metadata sampled on 2026-06-15 reported 930 stars,
latest release `v0.118.0` on 2026-06-02,
and repository activity on 2026-06-14.
A recent issue sample showed maintainer involvement on two of five sampled issues,
with two additional maintainer-authored issues.
The PR sample was dominated by bot update PRs.
Source search found no broad fuzz,
property,
or mutation harness,
only a fuzz-crasher regression-style test under plugin utilities.

Fit against this repo:

- Stronger than file-enforcer for dependency update pipelines,
remote sources,
conditions,
SCM commits,
and PR-oriented automation.
- Weaker for this repo's current generated files because configuration is declarative manifest data,
not arbitrary TypeScript with local imports and direct function calls.
- No equivalent to file-enforcer's read tracker,
staleness manifest for lazy builders,
watch-mode managed-destination protection,
JetBrains settings patcher,
or package-index helpers.
- Good future candidate for dependency update PRs;
not a reason to replace file-enforcer.

### Go Task

Verdict:
strongest task-runner overlap,
still not a replacement.

Evidence inspected:

- clone:
`/tmp/agent/file-enforcer-audit-20260615/go-task__task`;
- `task.go` and `cmd/task/task.go` run task definitions;
- `watch.go` implements watch reruns;
- `internal/fingerprint/task.go`,
`sources_checksum.go`,
`sources_timestamp.go`,
and `status.go`
implement `sources`,
`generates`,
checksum,
timestamp,
and status checks;
- `.github/workflows/test.yml`,
`lint.yml`,
and `security.yml` exist;
- source search found 23 Go test files plus `testdata`.

Maintenance and quality:
A GitHub sample found maintainer comments on two sampled issues and maintainer reviews
on three sampled PRs.
No Go fuzz,
property,
or mutation harness was found.

Fit against this repo:
Task overlaps with staleness and watch semantics,
but the work still happens inside shell commands.
It does not provide file-enforcer's TypeScript transform API,
tracked read/write model,
atomic destination protection,
or structured TOML/XML/JetBrains helpers.
It is a complement for package-level command orchestration.

### Gomplate

Verdict:
complement for pure template rendering.

Evidence inspected:

- clone:
`/tmp/agent/file-enforcer-audit-20260615/hairyhenderson__gomplate`;
- `gomplate.go`,
`template.go`,
`render.go`,
and `config.go` implement CLI execution,
template gathering,
parsing,
rendering,
and output writing;
- `.github/workflows/build.yml` covers build,
test,
integration,
Linux architectures,
and Windows;
- fuzz functions exist in `crypto/crypto_fuzz_test.go` and `strings/strings_fuzz_test.go`.

Maintenance and quality:
GitHub metadata sampled on 2026-06-15 reported 3,162 stars,
latest release `v5.1.0` on 2026-05-02,
and same-day repository activity.
Three of five sampled issues had maintainer comments.
Sampled PRs did not show maintainer interaction.

Fit against this repo:
Gomplate is good when the problem is rendering templates from data sources.
It does not model this repo's TypeScript config,
staleness manifest,
structured TOML/XML edits,
package-index helpers,
or managed-destination watch protection.

### Copier

Verdict:
complement for versioned project-template lifecycle.

Evidence inspected:

- clone:
`/tmp/agent/file-enforcer-audit-20260615/copier-org__copier`;
- `copier/_main.py` implements copy,
update,
template rendering,
and update application;
- `copier/_template.py` loads template configuration;
- `tests/test_copy.py` and `tests/test_updatediff.py` cover copy and update behavior;
- `.github/workflows/ci.yml` runs pytest coverage,
pre-commit,
and Python/OS matrices.

Maintenance and quality:
GitHub metadata sampled on 2026-06-15 reported 3,413 stars,
latest release `v9.15.2` on 2026-06-12,
and same-day activity.
Five of five sampled issues had maintainer comments.
One of five sampled PRs had maintainer involvement.
No Hypothesis,
fuzz,
or mutation tooling was found.

Fit against this repo:
Copier is stronger than file-enforcer for updating projects generated from versioned templates.
It is too template-repository-oriented for current root config generation,
and replacing file-enforcer with Copier would move local monorepo logic into template conventions
without solving watch protection or staleness.

### Vendir

Verdict:
complement for vendored external directories.

Evidence inspected:

- clone:
`/tmp/agent/file-enforcer-audit-20260615/carvel-dev__vendir`;
- `pkg/vendir/cmd/sync.go` and `pkg/vendir/directory/directory.go` implement sync;
- `pkg/vendir/directory/staging_dir.go` replaces directories from staging;
- fetchers live under `pkg/vendir/fetch/*/sync.go`;
- `.github/workflows/test-gh.yml` runs build,
unit,
e2e,
and binary build;
- `hack/test.sh` and `hack/test-e2e.sh` provide local validation paths.

Maintenance and quality:
GitHub metadata sampled on 2026-06-15 reported 373 stars,
latest release `v0.46.0` on 2026-06-10,
and recent activity.
Three of five sampled issues had maintainer comments.
Five of five sampled PRs had maintainer involvement.
No fuzz,
property,
or mutation harness was found.

Fit against this repo:
Vendir should be considered if a future file-enforcer job is actually vendoring an external tree.
It is not a general file generator for `CLAUDE.md`,
`mise.toml`,
Browserslist output,
or JetBrains settings.

### Boilerplate

Verdict:
one-shot scaffolding tool,
not replacement.

Evidence inspected:

- clone:
`/tmp/agent/file-enforcer-audit-20260615/gruntwork-io__boilerplate`;
- `cli/boilerplate_cli.go`,
`templates/template_processor.go`,
`render/render_template.go`,
and `manifest/` implement template processing and rendering;
- `.github/workflows/ci.yml` runs lint,
spelling,
tests,
Windows tests,
and build;
- `integration-tests/examples_test.go` renders examples and compares expected output.

Maintenance and quality:
GitHub metadata sampled on 2026-06-15 reported 342 stars,
latest release `v0.16.0` on 2026-05-13,
and May repository activity.
The sampled issues and PRs did not show maintainer interaction by GitHub association.
No fuzz,
property,
or mutation harness was found.

Fit against this repo:
Boilerplate can generate a project or folder from templates,
but it does not provide an ongoing reconcile loop,
source tracking,
destination protection,
or arbitrary TypeScript orchestration.

### Cookiecutter

Verdict:
project scaffolder,
not replacement.

Evidence inspected:

- clone:
`/tmp/agent/file-enforcer-audit-20260615/cookiecutter__cookiecutter`;
- `cookiecutter/main.py` and `cookiecutter/generate.py` implement context generation,
file generation,
and directory rendering;
- `.github/workflows/tests.yml` runs lint and pytest across OS/Python matrices;
- tests cover generation,
hooks,
replay,
VCS,
and zip inputs.

Maintenance and quality:
GitHub metadata sampled on 2026-06-15 reported 24,941 stars,
latest release `v2.7.1` on 2026-03-04,
and April repository activity.
Sampled issues and PRs did not show maintainer interaction by GitHub association.
No Hypothesis,
fuzz,
or mutation tooling was found.

Fit against this repo:
Cookiecutter is appropriate for creating a new project from a template.
It is not designed for continuous derived-file enforcement inside an existing monorepo.

### Chezmoi

Verdict:
strong desired-state engine for dotfiles,
not repo replacement.

Evidence inspected:

- clone:
`/tmp/agent/file-enforcer-audit-20260615/twpayne__chezmoi`;
- `internal/cmd/applycmd.go`,
`internal/cmd/config.go`,
`internal/chezmoi/sourcestate.go`,
and `internal/chezmoi/targetstateentry.go`
implement apply behavior;
- `.github/workflows/main.yml` runs CodeQL,
distro tests,
OS tests,
race tests,
lint,
and checks;
- developer docs describe unit,
virtual filesystem integration,
testscript,
distro,
and OS tests.

Maintenance and quality:
GitHub metadata sampled on 2026-06-15 reported 20,200 stars,
latest release `v2.70.5` on 2026-06-03,
and June activity.
Three of five sampled issues had maintainer comments.
Five of five sampled PRs had maintainer involvement.
No fuzz,
property,
or mutation harness was found.

Fit against this repo:
Chezmoi is excellent for applying a source-state directory to a user's home directory.
This repo needs generated artifacts inside the worktree,
not personal dotfile deployment.

### Structured configuration languages: Cue, Pkl, ytt, Dhall, and Jsonnet

Verdict:
complements for structured configuration,
not replacements.

Evidence inspected:

- `cue` clone:
`/tmp/agent/file-enforcer-audit-20260615/cue-lang__cue`;
`cmd/cue/cmd/export.go`,
`cmd/cue/cmd/eval.go`,
`internal/encoding/encoder.go`,
and `cue/context.go` implement evaluation and export.
- `pkl` clone:
`/tmp/agent/file-enforcer-audit-20260615/apple__pkl`;
`pkl-core/src/main/java/org/pkl/core/EvaluatorImpl.java`,
`pkl-cli/src/main/kotlin/org/pkl/cli/commands/EvalCommand.kt`,
and `pkl-cli/src/main/kotlin/org/pkl/cli/OutputUtils.kt` implement evaluation and output.
- `ytt` clone:
`/tmp/agent/file-enforcer-audit-20260615/carvel-dev__ytt`;
`pkg/cmd/template/cmd.go`,
`pkg/workspace/library_execution.go`,
`pkg/yamltemplate/template.go`,
and `pkg/yttlibrary/overlay/api.go`
implement YAML templating and overlays.
- `dhall` clone:
`/tmp/agent/file-enforcer-audit-20260615/dhall-lang__dhall-haskell`;
`dhall/src/Dhall/Main.hs`,
`dhall/src/Dhall/Eval.hs`,
`dhall-json/src/Dhall/JSON.hs`,
`dhall-yaml/src/Dhall/Yaml.hs`,
and `dhall-toml/src/Dhall/DhallToToml.hs` implement evaluation and encoders.
- `go-jsonnet` clone:
`/tmp/agent/file-enforcer-audit-20260615/google__go-jsonnet`;
`vm.go`,
`interpreter.go`,
`cmd/jsonnet/cmd.go`,
and `yaml.go`
implement evaluation and multi-output writing.

Maintenance and quality:

- Cue had 6,143 stars,
release `v0.16.1` on 2026-04-08,
and one to two maintainer comments in each of three sampled issues.
`cue/fuzz_test.go` defines `FuzzStandaloneCUE`,
and CI runs broad Go validation.
- Pkl had 11,411 stars,
release `0.31.1` on 2026-03-26,
197 Java/Kotlin test files,
and no fuzz/property harness found.
- ytt had 1,853 stars,
release `v0.55.1` on 2026-06-01,
CI for build/test/all/binaries,
and limited `gofuzz` use in tests.
- Dhall had 965 stars,
release `1.42.2` on 2025-01-19,
strong QuickCheck coverage,
and active maintainer reviews in sampled PRs.
- go-jsonnet had 1,831 stars,
release `v0.22.0` on 2026-03-24,
CI covering Go and shared jsonnet tests,
but weak recent public issue support in the sample.

Fit against this repo:
These tools make sense when generated output is primarily structured data.
They do not replace the file-enforcer runtime model:
we would still need a wrapper to decide which files to read,
where to write them,
when to skip unchanged writes,
how to watch/protect outputs,
and how to call repo-specific TypeScript helpers.
Pkl is the closest conceptual language replacement,
but adopting it would rewrite the root generator rather than remove the need for an enforcement layer.

### Data editors and TOML tools: yq, dasel, taplo, and tombi

Verdict:
narrow complements.

Evidence inspected:

- `yq` clone:
`/tmp/agent/file-enforcer-audit-20260615/mikefarah__yq`;
`cmd/evaluate_sequence_command.go`,
`pkg/yqlib/stream_evaluator.go`,
`pkg/yqlib/operator_assign.go`,
and `pkg/yqlib/write_in_place_handler.go`
implement evaluation and in-place writes.
- `dasel` clone:
`/tmp/agent/file-enforcer-audit-20260615/TomWright__dasel`;
`internal/cli/run.go`,
`api.go`,
`execution/execute_assign.go`,
`selector/parser/parser.go`,
and `parsing/writer.go` implement selectors and writes.
- `taplo` clone:
`/tmp/agent/file-enforcer-audit-20260615/tamasfe__taplo`;
`crates/taplo-cli/src/commands/format.rs`,
`crates/taplo/src/parser/mod.rs`,
`crates/taplo/src/formatter/mod.rs`,
and `crates/taplo/src/dom/rewrite.rs`
implement TOML formatting and limited DOM rewriting.
- `tombi` clone:
`/tmp/agent/file-enforcer-audit-20260615/tombi-toml__tombi`;
`rust/tombi-cli/src/app/command/format.rs`,
`crates/tombi-parser/src/parser.rs`,
`crates/tombi-formatter/src/formatter.rs`,
and `crates/tombi-ast-editor/src/editor.rs`
implement TOML parsing,
formatting,
and schema-aware editing.

Maintenance and quality:

- yq had 15,547 stars,
release `v4.53.3` on 2026-06-06,
Go test workflows,
OSS-Fuzz regression tests in source,
and weak recent sampled maintainer response.
- dasel had 7,975 stars,
release `v3.11.0` on 2026-05-19,
race-enabled Go tests,
and maintainer comments on two to three sampled issues.
- taplo had 2,301 stars,
release `0.10.0` on 2025-05-23,
CI for formatter checks,
`cargo test`,
`toml-test`,
and MSRV,
but no recent sampled maintainer responses.
- tombi had 975 stars,
release `v1.1.3` on 2026-06-09,
`cargo nextest`,
`toml-test`,
and strong sampled maintainer issue response.

Fit against this repo:
These are useful inside a generator or task.
They cannot express the whole sync graph,
and they do not provide tracked sources,
protected destinations,
or a programmable monorepo API.
For TOML specifically,
this repo already uses `@monochromatic-dev/module-toml-edit`
through file-enforcer to preserve comments and unmutated whitespace in splice mode.
`tombi` is worth watching as a TOML-tooling complement because its maintenance signal is stronger than Taplo's.

### Watchers and hook runners: watchexec, pre-commit, lefthook, and just

Verdict:
wrappers or gates,
not replacements.

Evidence inspected:

- `watchexec` clone:
`/tmp/agent/file-enforcer-audit-20260615/watchexec__watchexec`;
`crates/cli/src/lib.rs`,
`crates/lib/src/watchexec.rs`,
`crates/lib/src/sources/fs.rs`,
and `crates/lib/src/action/worker.rs`
implement watch and action behavior.
- `pre-commit` clone:
`/tmp/agent/file-enforcer-audit-20260615/pre-commit__pre-commit`;
`pre_commit/main.py`,
`pre_commit/commands/run.py`,
`pre_commit/commands/hook_impl.py`,
and `pre_commit/commands/install_uninstall.py`
implement hook installation and execution.
- `lefthook` clone:
`/tmp/agent/file-enforcer-audit-20260615/evilmartians__lefthook`;
`cmd/run.go`,
`internal/command/run.go`,
`internal/command/install.go`,
and `internal/run/controller/controller.go` implement hook execution.
- `just` clone:
`/tmp/agent/file-enforcer-audit-20260615/casey__just`;
`src/main.rs`,
`src/run.rs`,
`src/subcommand.rs`,
`src/executor.rs`,
and `src/recipe.rs`
implement command-runner behavior.

Maintenance and quality:

- watchexec has mature cross-platform watch code and CI,
but no fuzz/property/mutation setup found.
- pre-commit has extensive pytest coverage and strong sampled maintainer issue response.
- lefthook has Go tests and integration tests,
with maintainer response in sampled issues.
- just has a Rust fuzz target under `fuzz/fuzz_targets/compile.rs` and broad CI.

Fit against this repo:
These tools can run file-enforcer:
for example as a commit hook,
CI gate,
or generic watch wrapper.
They cannot replace the file-enforcer API because they do not define generated content or structured transforms.
`watchexec` overlaps only with watch triggering,
while file-enforcer also knows which paths are sources and which destinations are protected.

## Gaps and risks in the incumbent

The audit did not find a replacement,
but it did surface areas where file-enforcer is narrower than alternatives:

- It is private to this repo and has no external user base;
external tools have broader portability pressure.
- It is Bun/Node/TypeScript-shaped;
Pkl,
Cue,
Dhall,
and ytt offer language-level validation models.
- It has no SCM PR workflow;
Updatecli is better for automated dependency update proposals.
- Its watch mode is local only;
hook runners and CI gates are still needed to prevent stale generated files from entering commits.
- Its package installer intentionally filters out mise-installable tools;
the Repology plus mise registry generation path is powerful but repo-specific.

These are not replacement reasons for the current workload.
They are boundary lines for future use:
if a file-enforcer job becomes dependency-update automation,
external vendoring,
or pure structured-data validation,
move that slice to the purpose-built tool.

## Decision

Keep file-enforcer for repo-local derived files.
Document rejected alternatives here so they are not re-proposed as replacements:

- Updatecli:
real adjacent alternative for update pipelines,
rejected as a direct replacement
because our current workload is local TypeScript-derived artifact synchronization with watch protection.
- Task:
useful orchestration complement,
rejected as a direct replacement because generated content
would still live in shell commands and side scripts.
- Gomplate,
Copier,
Cookiecutter,
Boilerplate:
useful template/scaffold tools,
rejected for continuous monorepo enforcement.
- Vendir and Chezmoi:
desired-state tools for different domains,
rejected for root generated artifacts.
- Cue,
Pkl,
ytt,
Dhall,
Jsonnet:
useful configuration languages,
rejected as replacements because they need an outer enforcement runner.
- yq,
dasel,
taplo,
tombi:
useful edit/format tools,
rejected as replacements because their scope is single-file or single-format.
- watchexec,
pre-commit,
lefthook,
just:
useful wrappers,
rejected as replacements because they run commands rather than define derived-file semantics.

If the user later chooses a specific migration slice,
write or update a decision document under `docs/decisions/` for that chosen tool.

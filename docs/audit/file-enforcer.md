# file-enforcer alternatives audit

## Scope and method

This audit compares `packages/dev-script/file-enforcer` against tools from `mise registry`
that could plausibly keep derived files synchronized.
The registry capture was produced on 2026-06-15 with:

```bash
mise registry > /tmp/agent/mise-registry-2026-06-15.txt
```

The capture contained 815 registry entries.
`mise registry` provides tool names and backends,
not descriptions.
I screened the full list by name and backend for tools that render,
update,
apply,
watch,
validate,
format,
or transform files.
General cloud CLIs,
package managers,
language runtimes,
Kubernetes administration tools,
secret managers,
media tools,
and unrelated developer utilities are outside the file-enforcement problem.

This is a screened audit,
not a claim that every one of the 815 registry entries is itself a file-enforcer alternative.
The serious and adjacent candidates that survived the screen were cloned under
`/tmp/agent/file-enforcer-audit-20260615/` with:

```bash
gh repo clone <owner/repo> /tmp/agent/file-enforcer-audit-20260615/<owner>__<repo> -- --depth 1
```

SaaS vendor vetting is not applicable:
all candidates considered as alternatives are open-source local CLIs or libraries.
No closed-source SaaS tool is recommended.

## Incumbent shape

`file-enforcer` is executable TypeScript for repo-local derived files.
The root `file-enforcer.config.ts` currently:

- copies `AGENTS.md` into generated `CLAUDE.md` with repo-specific prefacing text;
- generates root `mise.toml` from `mise.no-env.toml` plus computed package bin paths;
- seeds a gitignored forbidden-string appendix and concatenates scanner rules;
- resolves Browserslist targets through the installed `browserslist` package;
- patches JetBrains LSP4IJ settings;
- mirrors canonical skills to legacy agent directories;
- rejects forbidden root `CONTEXT.md` while registering it for watch mode.

Implementation evidence:

- `packages/dev-script/file-enforcer/src/cli.ts`:
config discovery,
config import,
and `--watch` startup.
- `packages/dev-script/file-enforcer/src/io/cat.ts`:
tracked reads and glob expansion.
- `packages/dev-script/file-enforcer/src/io/write.ts`:
`overwrite`,
`overwriteIfNotExists`,
`overwriteEach`,
atomic writes,
and skip-if-identical behavior.
- `packages/dev-script/file-enforcer/src/io/write-lazy.ts` and `src/io/staleness-*.ts`:
persisted staleness entries for lazy builders.
- `packages/dev-script/file-enforcer/src/watch/*.ts`:
chokidar-backed reruns,
protected-destination classification,
and serial rerun queuing.
- `packages/dev-script/file-enforcer/src/pipeline/{json,toml,xml,transform}.ts`:
structured transforms beyond byte concatenation.
- `packages/dev-script/file-enforcer/src/package/*.ts`:
system package discovery
for packages that mise cannot manage.

Measured on 2026-06-15,
`packages/dev-script/file-enforcer/src` contains:

- 71 production `.ts` files;
- 51 `*.unit.test.ts` files;
- seven `*.property.unit.test.ts` files;
- one container test file.

`packages/dev-script/file-enforcer/mise.toml` also defines `fuzz` and container-isolated
`test:mutation` tasks.
`docs/decisions/file-enforcer-fuzzing.md` records the fast-check property-test decision
and the JSON defects those properties found.

A replacement must cover all of this:

- programmable local generation;
- tracked source reads;
- content-stable writes;
- structured JSON,
TOML,
XML,
glob,
and platform helpers;
- watch-mode reruns;
- managed-destination protection;
- low-friction use inside this monorepo without moving logic into shell glue.

No registry candidate covers all of those requirements.

## Conclusion

Keep `file-enforcer` as the repo's derived-file synchronizer.

Use other tools only for narrower jobs:

- `updatecli`:
dependency,
version,
and policy update pipelines that may open SCM changes.
- `go-task/task`:
package-level task orchestration with source and generated-file checks.
- `gomplate`,
`copier`,
`cookiecutter`,
`boilerplate`:
template rendering or scaffolding.
- `vendir`:
vendored external directories.
- `cue`,
`pkl`,
`ytt`,
`dhall`,
`jsonnet`:
structured configuration languages.
- `yq`,
`dasel`,
`taplo`,
`tombi`:
narrow structured-file edits,
formatting,
or validation.
- `watchexec`,
`pre-commit`,
`lefthook`,
`just`:
wrappers that can invoke file-enforcer.

No replacement candidate became a migration finalist after source-fit screening.
For that reason this audit source-read and maintenance-checked serious alternatives,
but it did not run every upstream project's full validation suite.
If a future task proposes migrating a specific slice to one candidate,
that migration needs a separate adoption vet:
build the candidate,
run its full validation,
and exercise this repo's integration boundary in a disposable fixture.

This document is an audit,
not a final migration decision document.
If the user later chooses a specific tool or migration slice,
record that choice under `docs/decisions/`.

## Registry screen

### Cloned serious and adjacent candidates

- `updatecli`:
`aqua:updatecli/updatecli`.
- `boilerplate`:
`aqua:gruntwork-io/boilerplate`.
- `gomplate`:
`aqua:hairyhenderson/gomplate`.
- `copier`:
`pipx:copier`.
- `cookiecutter`:
`pipx:cookiecutter`.
- `chezmoi`:
`aqua:twpayne/chezmoi`.
- `vendir`:
`aqua:carvel-dev/vendir`.
- `cue`:
`aqua:cue-lang/cue`.
- `go-jsonnet`:
`aqua:google/go-jsonnet`.
- `dhall`:
`aqua:dhall-lang/dhall-haskell`.
- `pkl`:
`aqua:apple/pkl`.
- `ytt`:
`aqua:carvel-dev/ytt`.
- `dasel`:
`aqua:TomWright/dasel`.
- `yq`:
`aqua:mikefarah/yq`.
- `taplo`:
`aqua:tamasfe/taplo`.
- `tombi`:
`aqua:tombi-toml/tombi`.
- `watchexec`:
`aqua:watchexec/watchexec`.
- `just`:
`aqua:casey/just`.
- `task`:
`aqua:go-task/task`.
- `pre-commit`:
`aqua:pre-commit/pre-commit` and `pipx:pre-commit`.
- `lefthook`:
`aqua:evilmartians/lefthook` and `go:github.com/evilmartians/lefthook`.

### Registry entries screened out as narrow adjuncts

These tools can be invoked by file-enforcer or by a hook/task runner,
but they do not synchronize arbitrary derived files by themselves.

- Task runners:
`make`,
`cargo-make`,
`mage`,
`cmdx`,
`mask`,
`xc`.
- Formatters and linters:
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
`regal`.
- Policy and schema validators:
`conftest`,
`opa`,
`jsonschema`,
`checkov`,
`dependency-check`.
- Transform primitives:
`jq`,
`gojq`,
`sd`,
`dasel`,
`yq`.
- Configuration package helpers:
`jsonnet-bundler`,
`jb`,
`helm`,
`helmfile`,
`kustomize`,
`ksops`,
`vals`.

`dasel` and `yq` appear in both lists because they were useful enough to source-read,
but their final role is adjunct.

## Clone evidence

Each cloned candidate was inspected at these commits:

- `TomWright/dasel`:
`abc1e1d5305bca0bb709979cdf16f467a378fa21`,
commit date 2026-05-19,
source <https://github.com/TomWright/dasel>.
- `apple/pkl`:
`a9c98e439626ed9619e6244a063fddfc19a74574`,
commit date 2026-06-11,
source <https://github.com/apple/pkl>.
- `carvel-dev/vendir`:
`a7fb189b2a1d1be30ccdf0049ae62b17d83240bc`,
commit date 2026-06-03,
source <https://github.com/carvel-dev/vendir>.
- `carvel-dev/ytt`:
`38ea8974e5a300c412c7283b418d8927528120aa`,
commit date 2026-06-05,
source <https://github.com/carvel-dev/ytt>.
- `casey/just`:
`d7f5d6198e643c6cbca482bfab7e38f77bdd74c4`,
commit date 2026-06-15,
source <https://github.com/casey/just>.
- `cookiecutter/cookiecutter`:
`c88fbe921c97c58b65f1883ba90a0ab53cc91b34`,
commit date 2026-03-04,
source <https://github.com/cookiecutter/cookiecutter>.
- `copier-org/copier`:
`b80196e5e075eaa1810323b1dc5836f9698d418b`,
commit date 2026-06-12,
source <https://github.com/copier-org/copier>.
- `cue-lang/cue`:
`61bcbc9232e939ed496c62900d43b86d301aeab6`,
commit date 2026-06-14,
source <https://github.com/cue-lang/cue>.
- `dhall-lang/dhall-haskell`:
`848efeac703dbe26f6bc148732e4bfd196b3c4f4`,
commit date 2026-06-08,
source <https://github.com/dhall-lang/dhall-haskell>.
- `evilmartians/lefthook`:
`b9549b88451254a37a9dbbfeeb85e606dcbd33f3`,
commit date 2026-06-08,
source <https://github.com/evilmartians/lefthook>.
- `go-task/task`:
`24a3ccdf42043a2cced5b24f67cefcf902995ef3`,
commit date 2026-06-07,
source <https://github.com/go-task/task>.
- `google/go-jsonnet`:
`567b61ac4a6c23546a62d79324bb4aaed6bdc941`,
commit date 2026-03-24,
source <https://github.com/google/go-jsonnet>.
- `gruntwork-io/boilerplate`:
`d1d56ece8405ebc40d3e4770faa85db2505820ef`,
commit date 2026-05-12,
source <https://github.com/gruntwork-io/boilerplate>.
- `hairyhenderson/gomplate`:
`12b6736b47f7a7e9963f4be3ca5150aa3f57f60a`,
commit date 2026-06-08,
source <https://github.com/hairyhenderson/gomplate>.
- `mikefarah/yq`:
`5cf0adcc5b1f05537c68234dba216e9a0882a705`,
commit date 2026-06-09,
source <https://github.com/mikefarah/yq>.
- `pre-commit/pre-commit`:
`1553b465fd7ea42321ae0d04d1b41e706b89ae45`,
commit date 2026-05-19,
source <https://github.com/pre-commit/pre-commit>.
- `tamasfe/taplo`:
`b673b44df2773db8673a00df2e7654b769f7fde7`,
commit date 2026-03-11,
source <https://github.com/tamasfe/taplo>.
- `tombi-toml/tombi`:
`9d68d00e3d0de69d3fd061e7da14a54e3f76610b`,
commit date 2026-06-13,
source <https://github.com/tombi-toml/tombi>.
- `twpayne/chezmoi`:
`4ca579b2333cdc7b66593b25598613293a40de9f`,
commit date 2026-06-09,
source <https://github.com/twpayne/chezmoi>.
- `updatecli/updatecli`:
`8deb2563286f8c0388fc594e0528e2fa2523060c`,
commit date 2026-06-14,
source <https://github.com/updatecli/updatecli>.
- `watchexec/watchexec`:
`9d8e3443f8e15017f245dba74eec27efe623940e`,
commit date 2026-05-05,
source <https://github.com/watchexec/watchexec>.

## Candidate comparisons

### Updatecli

Verdict:
serious complement,
not replacement.

Updatecli is the most important adjacent alternative.
Its homepage says it applies file update strategies,
and its introduction describes `source`,
`target`,
and `condition` stages for automating dependency,
version,
and configuration updates.
Sources:
<https://www.updatecli.io/> and <https://www.updatecli.io/docs/prologue/introduction/>.

Evidence inspected:

- `pkg/core/pipeline/target/main.go`:
resource targets,
transformers,
SCM checkout,
commit,
and push behavior.
- `pkg/plugins/resources/file/target.go`:
file creation and update,
Go template rendering with Sprig,
regexp replacement,
dry-run diffs,
and unchanged-content skip.
- `pkg/plugins/resources/yaml/target.go`:
YAML target updates through configured engines.
- `.github/workflows/go.yaml`:
build,
lint,
short pull-request tests,
scheduled full tests,
e2e tests,
and Codecov upload.

Maintenance screen:
GitHub metadata sampled on 2026-06-15 reported 930 stars,
release `v0.118.0` on 2026-06-02,
and repository activity on 2026-06-14.
A five-issue sample showed maintainer involvement on two issues,
plus two maintainer-authored issues.
The PR sample was dominated by bot update PRs.
Source search found no broad fuzz,
property,
or mutation harness.

Fit:

- Stronger than file-enforcer for dependency update pipelines,
remote sources,
conditions,
SCM commits,
and PR-oriented automation.
- Weaker for current root generation because the config is manifest data,
not arbitrary TypeScript with local imports and direct function calls.
- Missing file-enforcer equivalents for read tracking,
lazy staleness manifests,
watch-mode destination protection,
JetBrains settings patching,
and package-index helpers.

### Go Task

Verdict:
strongest task-runner overlap,
still not replacement.

Evidence inspected:

- `cmd/task/task.go` and `task.go`:
task execution.
- `watch.go`:
watch reruns.
- `internal/fingerprint/task.go`,
`sources_checksum.go`,
`sources_timestamp.go`,
and `status.go`:
source,
generated-file,
checksum,
timestamp,
and status checks.
- `.github/workflows/test.yml`,
`lint.yml`,
and `security.yml`:
validation workflows.

Maintenance screen:
A GitHub sample found maintainer comments on two sampled issues
and maintainer reviews on three sampled PRs.
No Go fuzz,
property,
or mutation harness was found.

Fit:
Task overlaps with staleness and watch semantics,
but generated content still lives in shell commands or side scripts.
It does not provide file-enforcer's TypeScript transform API,
tracked read/write model,
atomic destination protection,
or structured TOML/XML/JetBrains helpers.

### Gomplate

Verdict:
complement for pure template rendering.

Evidence inspected:

- `gomplate.go`:
CLI execution.
- `template.go`:
template gathering.
- `render.go`:
parsing and rendering.
- `config.go`:
configuration.
- `.github/workflows/build.yml`:
build,
test,
integration,
Linux architecture,
and Windows validation.
- `crypto/crypto_fuzz_test.go` and `strings/strings_fuzz_test.go`:
Go fuzz functions.

Maintenance screen:
GitHub metadata sampled on 2026-06-15 reported 3,162 stars,
release `v5.1.0` on 2026-05-02,
and same-day repository activity.
Three of five sampled issues had maintainer comments.

Fit:
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

- `copier/_main.py`:
copy,
update,
template rendering,
and update application.
- `copier/_template.py`:
template configuration loading.
- `tests/test_copy.py` and `tests/test_updatediff.py`:
copy and update behavior.
- `.github/workflows/ci.yml`:
pytest coverage,
pre-commit,
and Python/OS matrices.

Maintenance screen:
GitHub metadata sampled on 2026-06-15 reported 3,413 stars,
release `v9.15.2` on 2026-06-12,
and same-day activity.
Five of five sampled issues had maintainer comments.
One of five sampled PRs had maintainer involvement.
No Hypothesis,
fuzz,
or mutation tooling was found.

Fit:
Copier is stronger than file-enforcer for projects generated from versioned templates.
It is too template-repository-oriented for current root config generation,
and it does not solve watch protection or staleness.

### Vendir

Verdict:
complement for vendored external directories.

Evidence inspected:

- `pkg/vendir/cmd/sync.go`:
sync command.
- `pkg/vendir/directory/directory.go`:
directory sync.
- `pkg/vendir/directory/staging_dir.go`:
staging replacement.
- `pkg/vendir/fetch/*/sync.go`:
source fetchers.
- `.github/workflows/test-gh.yml`:
build,
unit,
e2e,
and binary build.
- `hack/test.sh` and `hack/test-e2e.sh`:
local validation paths.

Maintenance screen:
GitHub metadata sampled on 2026-06-15 reported 373 stars,
release `v0.46.0` on 2026-06-10,
and recent activity.
Three of five sampled issues had maintainer comments.
Five of five sampled PRs had maintainer involvement.
No fuzz,
property,
or mutation harness was found.

Fit:
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

- `cli/boilerplate_cli.go`:
CLI entry.
- `templates/template_processor.go`:
template processing.
- `render/render_template.go`:
rendering.
- `manifest/`:
manifest support.
- `.github/workflows/ci.yml`:
lint,
spelling,
tests,
Windows tests,
and build.
- `integration-tests/examples_test.go`:
example rendering and expected-output comparison.

Maintenance screen:
GitHub metadata sampled on 2026-06-15 reported 342 stars,
release `v0.16.0` on 2026-05-13,
and May repository activity.
The sampled issues and PRs did not show maintainer interaction by GitHub association.
No fuzz,
property,
or mutation harness was found.

Fit:
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

- `cookiecutter/main.py`:
main generation flow.
- `cookiecutter/generate.py`:
context generation,
file generation,
and directory rendering.
- `.github/workflows/tests.yml`:
lint and pytest across OS/Python matrices.
- `tests/`:
generation,
hooks,
replay,
VCS,
and zip coverage.

Maintenance screen:
GitHub metadata sampled on 2026-06-15 reported 24,941 stars,
release `v2.7.1` on 2026-03-04,
and April repository activity.
Sampled issues and PRs did not show maintainer interaction by GitHub association.
No Hypothesis,
fuzz,
or mutation tooling was found.

Fit:
Cookiecutter is appropriate for creating a new project from a template.
It is not designed for continuous derived-file enforcement inside an existing monorepo.

### Chezmoi

Verdict:
strong desired-state engine for dotfiles,
not repo replacement.

Evidence inspected:

- `internal/cmd/applycmd.go`:
apply command.
- `internal/cmd/config.go`:
apply arguments.
- `internal/chezmoi/sourcestate.go`:
source-state reading and applying.
- `internal/chezmoi/targetstateentry.go`:
target-state entry application.
- `.github/workflows/main.yml`:
CodeQL,
distro tests,
OS tests,
race tests,
lint,
and checks.

Maintenance screen:
GitHub metadata sampled on 2026-06-15 reported 20,200 stars,
release `v2.70.5` on 2026-06-03,
and June activity.
Three of five sampled issues had maintainer comments.
Five of five sampled PRs had maintainer involvement.
No fuzz,
property,
or mutation harness was found.

Fit:
Chezmoi is excellent for applying a source-state directory to a user's home directory.
This repo needs generated artifacts inside the worktree,
not personal dotfile deployment.

### Structured configuration languages

Verdict:
complements for structured configuration,
not replacements.

Candidates:

- Cue:
`cmd/cue/cmd/export.go`,
`cmd/cue/cmd/eval.go`,
`internal/encoding/encoder.go`,
and `cue/context.go` implement evaluation and export.
- Pkl:
`pkl-core/src/main/java/org/pkl/core/EvaluatorImpl.java`,
`pkl-cli/src/main/kotlin/org/pkl/cli/commands/EvalCommand.kt`,
and `pkl-cli/src/main/kotlin/org/pkl/cli/OutputUtils.kt` implement evaluation and output.
- ytt:
`pkg/cmd/template/cmd.go`,
`pkg/workspace/library_execution.go`,
`pkg/yamltemplate/template.go`,
and `pkg/yttlibrary/overlay/api.go` implement YAML templating and overlays.
- Dhall:
`dhall/src/Dhall/Main.hs`,
`dhall/src/Dhall/Eval.hs`,
`dhall-json/src/Dhall/JSON.hs`,
`dhall-yaml/src/Dhall/Yaml.hs`,
and `dhall-toml/src/Dhall/DhallToToml.hs` implement evaluation and encoders.
- go-jsonnet:
`vm.go`,
`interpreter.go`,
`cmd/jsonnet/cmd.go`,
and `yaml.go` implement evaluation and multi-output writing.

Maintenance screen:

- Cue had 6,143 stars,
release `v0.16.1` on 2026-04-08,
broad Go CI,
and `cue/fuzz_test.go` defining `FuzzStandaloneCUE`.
- Pkl had 11,411 stars,
release `0.31.1` on 2026-03-26,
197 Java/Kotlin test files,
and no fuzz/property harness found.
- ytt had 1,853 stars,
release `v0.55.1` on 2026-06-01,
build/test/all/binary CI,
and limited `gofuzz` use in tests.
- Dhall had 965 stars,
release `1.42.2` on 2025-01-19,
strong QuickCheck coverage,
and active maintainer reviews in sampled PRs.
- go-jsonnet had 1,831 stars,
release `v0.22.0` on 2026-03-24,
Go plus shared-jsonnet CI,
and weak recent public issue support in the sample.

Fit:
These tools make sense when generated output is primarily structured data.
They do not replace the file-enforcer runtime model:
we would still need a wrapper to decide which files to read,
where to write them,
when to skip unchanged writes,
how to watch/protect outputs,
and how to call repo-specific TypeScript helpers.
Pkl is the closest conceptual language replacement,
but adopting it would rewrite the root generator rather than remove the need for an enforcement layer.

### Data editors and TOML tools

Verdict:
narrow complements.

Candidates:

- yq:
`cmd/evaluate_sequence_command.go`,
`pkg/yqlib/stream_evaluator.go`,
`pkg/yqlib/operator_assign.go`,
and `pkg/yqlib/write_in_place_handler.go` implement evaluation and in-place writes.
- dasel:
`internal/cli/run.go`,
`api.go`,
`execution/execute_assign.go`,
`selector/parser/parser.go`,
and `parsing/writer.go` implement selectors and writes.
- taplo:
`crates/taplo-cli/src/commands/format.rs`,
`crates/taplo/src/parser/mod.rs`,
`crates/taplo/src/formatter/mod.rs`,
and `crates/taplo/src/dom/rewrite.rs` implement TOML formatting and limited DOM rewriting.
- tombi:
`rust/tombi-cli/src/app/command/format.rs`,
`crates/tombi-parser/src/parser.rs`,
`crates/tombi-formatter/src/formatter.rs`,
and `crates/tombi-ast-editor/src/editor.rs` implement TOML parsing,
formatting,
and schema-aware editing.

Maintenance screen:

- yq had 15,547 stars,
release `v4.53.3` on 2026-06-06,
Go test workflows,
OSS-Fuzz regression tests in source,
and weak recent sampled maintainer response.
- dasel had 7,975 stars,
release `v3.11.0` on 2026-05-19,
race-enabled Go tests,
and maintainer comments on sampled issues.
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

Fit:
These are useful inside a generator or task.
They cannot express the whole sync graph,
and they do not provide tracked sources,
protected destinations,
or a programmable monorepo API.
For TOML specifically,
this repo already uses `@monochromatic-dev/module-toml-edit` through file-enforcer
to preserve comments and unmutated whitespace in splice mode.
`tombi` is worth watching as a TOML-tooling complement because its maintenance signal
is stronger than Taplo's.

### Watchers and hook runners

Verdict:
wrappers or gates,
not replacements.

Candidates:

- watchexec:
`crates/cli/src/lib.rs`,
`crates/lib/src/watchexec.rs`,
`crates/lib/src/sources/fs.rs`,
and `crates/lib/src/action/worker.rs` implement watch and action behavior.
- pre-commit:
`pre_commit/main.py`,
`pre_commit/commands/run.py`,
`pre_commit/commands/hook_impl.py`,
and `pre_commit/commands/install_uninstall.py` implement hook installation and execution.
- lefthook:
`cmd/run.go`,
`internal/command/run.go`,
`internal/command/install.go`,
and `internal/run/controller/controller.go` implement hook execution.
- just:
`src/main.rs`,
`src/run.rs`,
`src/subcommand.rs`,
`src/executor.rs`,
and `src/recipe.rs` implement command-runner behavior.

Maintenance screen:

- watchexec has mature cross-platform watch code and CI,
but no fuzz/property/mutation setup found.
- pre-commit has extensive pytest coverage and strong sampled maintainer issue response.
- lefthook has Go tests and integration tests,
with maintainer response in sampled issues.
- just has a Rust fuzz target under `fuzz/fuzz_targets/compile.rs` and broad CI.

Fit:
These tools can run file-enforcer as a hook,
CI gate,
or generic watch wrapper.
They cannot replace the file-enforcer API because they do not define generated content
or structured transforms.
`watchexec` overlaps only with watch triggering,
while file-enforcer also knows which paths are sources and which destinations are protected.

## Incumbent gaps

The audit did not find a replacement,
but it did surface boundaries where a purpose-built tool is better:

- Updatecli is better for dependency update PRs and SCM actions.
- Vendir is better for vendoring external directories.
- Task is better for command orchestration with source and generated-file checks.
- Cue,
Pkl,
Dhall,
Jsonnet,
and ytt are better language-level models for pure structured configuration.
- Hook runners are better commit and CI gates.

Those boundaries do not match the current root `file-enforcer.config.ts` workload.
Keep file-enforcer for repo-local derived artifacts,
and move only future slices that fit those narrower tools.

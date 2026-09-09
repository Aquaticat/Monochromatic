# Bash usage boundary and issue 308

## Status

Investigated 2026-09-09 at `3a4fdb7601c9644368b1d9185b9482c7c26e193d`.
This records findings and proposed issue framing,
not an adopted Bash exception or authorization to rewrite workflows.

The question is whether Bash earns its place in repository-owned automation,
not which new shell or runtime to adopt.
No replacement dependency selection was undertaken.

## Finding

No project-specific requirement or accepted exception was found that justifies Bash
for the scope decision in [issue 308].
There are reasons for a shell to remain at command-launch and externally defined interfaces.
Those reasons do not justify putting path classification and error policy in shell scripts.

The issue correctly identifies a fail-open defect.
Its acceptance criteria do not require a Bash implementation.
The missing architectural question is why this repo-owned decision is written in Bash at all.
Changing language alone would not fix the defect:
an implementation in any language can turn an unavailable comparison into a successful skip.

## What the history establishes

Commit `9e87f64d1d131a22a84167c12678886c52455d22` introduced the scope step on 2026-06-11.
Its message explains the need to skip unrelated merge-group verification while retaining a successful check,
and says it mirrors the changed-file guard in `forbidden-strings.yml`.
It does not explain choosing Bash.

The prohibition was already present:
`git grep --line-number 'Never write bash/powershell scripts' 9e87f64d1 -- AGENTS.md`
finds it at historical line 964.
This is not merely a new policy applied retroactively.

The comparison against issue 308's audit revision,
`4d1d66a0e2440f4402ea1eb454db6e49aacfbc48`,
shows that path renames and sidecar coverage changed,
but the failure-converting expression remains at
[`.github/workflows/toml-edit-fuzz.yml`](../../.github/workflows/toml-edit-fuzz.yml):71:

```bash
# .github/workflows/toml-edit-fuzz.yml
changed=$(git diff --name-only --diff-filter=ACMRT origin/main...HEAD || true)
```

No fix or fresh execution of this scope step was performed during this investigation.

## Evidence across the repository

### Workflow volume and configuration

A line-based inventory of every `.yml` in `.github/workflows` found:

- 14 workflow files.
- 95 `run:` entries.
- 6 explicit `shell: bash` declarations,
  all in `cargo-publish.yml`.
- 6 explicit `shell: node {0}` declarations across
  `cli-git-performance.yml`,
  `cli-git-trust.yml`,
  and `kotlin-linter-publish.yml`.
- 23 block or folded `run:` entries.

These are source counts,
not execution frequencies or a claim that every implicit shell is Bash.
The inventory trims each source line and counts `run:`,
`run: |`,
`run: >-`,
and `shell:` prefixes.
Runner operating system and job defaults determine implicit execution.

### Parallel implementations and their contents

[`.github/workflows/cli-git-performance.yml`](../../.github/workflows/cli-git-performance.yml):37
already performs a pre-install decision under `shell: node {0}`.
Its body reads JSON,
invokes Git with an argument array,
validates inputs,
and writes `GITHUB_OUTPUT`.
This is relevant precedent for the same kind of scope decision,
not merely the presence of a Node dependency somewhere in the repo.

A real hosted run executed that step successfully before any mise or dependency installation.
The log records `shell: /usr/local/bin/node {0}`.
See the [runner source and execution evidence](../troubleshooting/github-actions-shell-selection.md).
Thus pre-install execution is a real constraint,
but it does not establish a Bash requirement on this runner.

[`.github/workflows/kotlin-linter-publish.yml`](../../.github/workflows/kotlin-linter-publish.yml):36
uses the same invocation for version detection;
its later Node steps validate artifacts and upload a publication.
Those are additional implementations,
not independently verified success claims in this investigation.

[`mise.no-env.toml`](../../mise.no-env.toml):258 documents the existing task boundary:
default platform shells for command launching,
explicit Node execution for logic.
The accepted [mise Node invocation decision](../decision/mise-task-node-invocations.md)
distinguishes pure forwarding from actual orchestration.
It governs mise tasks,
not an independently adopted Actions-wide policy.

### Comments and unfinished work

The comments in `toml-edit-fuzz.yml` explain the skip behavior and bootstrap order,
not an exception for the scripting language.
The release-archive comments in
[`.github/workflows/cargo-publish.yml`](../../.github/workflows/cargo-publish.yml):209
explain archive formats and optional README copying,
not why Bash must own those decisions.

A search of `.github` for `TODO`,
`FIXME`,
`HACK`,
`shellcheck`,
and `actionlint` found no matches.
This does not prove that workflow scripting is tested or that external checks are absent.

### Suppressions and exceptions

[`.github/workflows/logger-fuzz.yml`](../../.github/workflows/logger-fuzz.yml):67
contains the same `git diff ... || true` expression.
It is a separate affected workflow,
not evidence that changing toml-edit fixes logger.

No `continue-on-error` entries were found in `.github`.
The error conversion in issue 308 happens inside the script instead.

[`package/dev-script/file-enforcer/generator/entrypoint.sh`](../../package/dev-script/file-enforcer/generator/entrypoint.sh)
is repo-authored Bash that starts PostgreSQL,
initializes a schema,
and dispatches a Python program.
Its [`Containerfile`](../../package/dev-script/file-enforcer/generator/Containerfile)
copies and selects that script as the entrypoint.
It is another first-party scripting island,
not automatically an externally imposed exception just because its commands are third-party programs.

Paused scripts and historical reproduction scripts also exist.
Their presence is inventory evidence,
not approval to use them as templates for new automation.

### Stated policy and existing documentation

[`AGENTS.md`](../../AGENTS.md) `SCR` prohibits Bash/PowerShell scripts.
`CM2` says mise task logic uses Node.
Neither rule supplies a Bash exception for CI.

[`doc/todo/cli-tools.md`](../todo/cli-tools.md):186 explicitly rejects shell scripts.
Its suggested `mise.<action>.ts` placement is historical and contradicts current `SCR`;
it must not be copied as current implementation guidance.

[`doc/todo/forbidden-strings.md`](../todo/forbidden-strings.md):237
also rejects a native Git hook plus grep script because of the Bash prohibition.

[`doc/philosophy/agents.md`](../philosophy/agents.md):114 discusses an agent's command-shell assumptions.
[`doc/troubleshooting/bash.md`](../troubleshooting/bash.md) explains redirect ordering.
Neither is a rationale for authoring CI decision logic in Bash.

Searches covered `doc/decision`,
the broader `doc` tree,
`AGENTS.md`,
workflow contents and history,
using Bash,
shell,
POSIX,
bootstrap,
CI scripting,
and exception terms.
The conclusion is no justification found in those sources,
not that undocumented author intent can be disproved.

## Which reasons survive scrutiny?

- **Host command launching:**
  a workflow step such as `run: mise install node pnpm` can leave the host's launcher alone.
  Its tradeoff is continued dependence on that host interface.
  It does not require adopting Bash as the language for decisions.
- **Bootstrap availability:**
  avoid requiring project dependencies before deciding whether to install them.
  This is legitimate,
  but the hosted Node execution evidence shows it does not force Bash here.
  A replacement must still declare its runtime floor and avoid premature workspace imports.
- **Existing shell interfaces:**
  interactive shell configuration and third-party launcher contracts are different from
  repository-owned workflow algorithms.
  Retention would require naming the actual boundary,
  not labeling every subprocess call unavoidable.
- **Familiar CI conventions and copied examples:**
  these explain how the current code arose.
  They do not override the documented scripting prohibition.
- **Ubuntu-only execution:**
  portability is not a functional requirement of this particular job.
  That removes one possible objection to Bash,
  but supplies no positive need for it.

No blanket claim that Bash must disappear from the operating system,
agent tools,
containers,
or transitive dependencies follows from these findings.

## Proposed issue framing

Keep issue 308's correctness contract,
while making the implementation boundary explicit:

> Make toml-edit scope detection a tested repo-owned program,
> not inline shell decision logic.
> An unavailable change comparison must fail the check,
> never become a successful no-op.

The evidence supports applying the existing no-shell-script policy,
not inventing an accepted exception to preserve this implementation.
The exact program location and bootstrap-compatible invocation remain implementation work.
The already-used Node boundary is evidence against necessity,
not a completed new technology selection.

Preserve the current acceptance criteria:

- A failed comparison fails the step and workflow.
- Only a successful comparison proving no relevant paths may skip verification.
- Validate or fetch the intended base explicitly.
- Cover relevant changes,
  irrelevant changes,
  and an unavailable base.
- A genuine no-op leaves the required merge-queue check successful.

Before implementation,
make base identity,
relevant deletions,
renames into and out of scope,
unusual path bytes,
and agreement with the workflow's declared path set explicit.
Do not assume a runtime change repairs these semantics.
Test the entrypoint through the workflow boundary after local regression coverage.

## Proposed documentation clarification

Clarify existing `SCR` in `AGENTS.md`,
rather than adding a competing rule:
its script prohibition includes inline YAML/TOML bodies and shell command strings that implement logic,
not just files named `.sh`.
Keep the command-launch distinction explicit in the rationale.

Any requested exception should document its exact consumer,
why the permitted program cannot meet that consumer's requirements,
verification,
and when to revisit it.
No such exception is adopted here.

The issue,
workflow code,
and agent instructions are unchanged by this investigation.

[issue 308]: https://github.com/Aquaticat/Monochromatic/issues/308

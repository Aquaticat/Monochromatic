# GitHub CodeQL default setup on 2026-08-19 scans every ruleset-protected branch and amplifies push runs

## Symptom

GitHub Actions shows repeated CodeQL runs named `Push on translation-repair-rebased` after each commit to that branch.
At the 2026-08-19 observation point, the Actions API had reached its 1,000-run response cap for the week beginning
2026-08-12, and the latest 1,000 runs contained 483 CodeQL push runs across `main` and
`translation-repair-rebased`.

The branch-specific symptom is not an error message.
It is a sequence of successful or concurrent runs that the user did not intend to buy faster hardware merely to repeat:

```text
Push on translation-repair-rebased
Analyze (javascript-typescript)
Analyze (c-cpp)
Analyze (actions)
```

The surface pattern that triggers it is:

- a push to any branch;
- repository ruleset `9126851` targets `~ALL` branches;
- that ruleset makes the branch protected;
- CodeQL default setup scans each push to every protected branch.

Changing from a GitHub-hosted runner to a Namespace labeled runner changes where these jobs execute.
It does not change when default setup creates them.

## Root cause

### The repository protects every branch

The live ruleset response on 2026-08-19 identifies ruleset `9126851` as `Copilot review` and includes every branch:

```console
$ gh api repos/Aquaticat/Monochromatic/rulesets/9126851 \
  --jq '{name,enforcement,conditions,rules}'
{
  "conditions": {
    "ref_name": {
      "exclude": [],
      "include": ["~ALL"]
    }
  },
  "enforcement": "active",
  "name": "Copilot review",
  "rules": [
    {
      "parameters": {
        "review_draft_pull_requests": true,
        "review_on_push": true
      },
      "type": "copilot_code_review"
    }
  ]
}
```

The branch API confirms that both the default branch and the working branch are protected:

```console
$ gh api repos/Aquaticat/Monochromatic/branches/translation-repair-rebased \
  --jq '{name,protected}'
{"name":"translation-repair-rebased","protected":true}

$ gh api repos/Aquaticat/Monochromatic/branches/main \
  --jq '{name,protected}'
{"name":"main","protected":true}
```

### Default setup treats every protected branch as a push target

GitHub's documentation source at commit `a34bf588b9e6eff791e173fdd3a726dfab26f888` states the trigger directly.
`content/code-security/concepts/code-scanning/setup-types.md:16-20` says:

```md
Default setup ... will be scanned using ...:

* On each push to the repository's default branch, or any protected branch.
* When creating or committing to a pull request based against the repository's default branch,
  or any protected branch, excluding pull requests from forks.
* On a weekly schedule.
```

The live configuration confirms that this repository uses default setup:

```console
$ gh api repos/Aquaticat/Monochromatic/code-scanning/default-setup
{
  "state": "configured",
  "languages": [
    "actions",
    "c-cpp",
    "javascript",
    "javascript-typescript",
    "typescript"
  ],
  "query_suite": "extended",
  "schedule": "weekly",
  "runner_type": "standard"
}
```

The resulting chain is:

1. Ruleset `9126851` applies to `~ALL` branches.
2. `translation-repair-rebased` becomes protected.
3. A commit is auto-pushed to that branch.
4. CodeQL default setup creates one workflow run because the push target is protected.
5. The run fans out into the detected language jobs.
6. Another pushed commit starts another run without canceling the prior run.

### A runner-provider change does not alter the chain

GitHub does allow default setup to use a labeled runner.
`content/code-security/how-tos/find-and-fix-code-vulnerabilities/manage-your-configuration/edit-default-setup.md:27-35`
contains:

```md
Optionally, to use labeled runners ... select **Labeled runner**.
Then, next to "Runner label," enter the label of an existing self-hosted or GitHub-hosted runner.
```

That setting only selects a runner label.
The trigger remains the protected-branch behavior in `setup-types.md:16-20`.
Namespace's migration guide likewise describes changing the job's `runs-on` label,
not changing GitHub event generation
(https://namespace.so/docs/solutions/github-actions/migration).

The earlier hypothesis that a faster runner provider could remove the run flood was wrong.
A faster runner can shorten a generated job, but no cited Namespace feature suppresses the push event,
changes CodeQL default-setup triggers, or cancels an older GitHub workflow run.

## Verification

### Versions and evidence points

- GitHub.com service observed on 2026-08-19.
- GitHub documentation commit: `a34bf588b9e6eff791e173fdd3a726dfab26f888`.
- Repository ruleset: `9126851`.
- CodeQL default setup update timestamp: `2026-07-20T15:49:57Z`.
- Working-branch example run: `32279201781`.
- Default-branch example run: `32204388026`.
- Scheduled example run: `32250832355`.

### Runnable probe

Run from this repository with a GitHub CLI identity that can read Actions and repository rules:

```console
cd -- /var/home/user/Monochromatic

gh api repos/Aquaticat/Monochromatic/rulesets/9126851 \
  --jq '{name,enforcement,conditions,rules}'

gh api repos/Aquaticat/Monochromatic/branches/translation-repair-rebased \
  --jq '{name,protected}'

gh api repos/Aquaticat/Monochromatic/code-scanning/default-setup

gh run view 32279201781 \
  --json workflowName,createdAt,updatedAt,conclusion,jobs,url
```

### Expected patterns

- A push to `main` starts CodeQL because `main` is the default branch.
  Run `32204388026` is the positive control.
- The weekly schedule starts CodeQL independently of pushes.
  Run `32250832355` is the positive control.
- Each run contains separate `actions`, `c-cpp`, and `javascript-typescript` analysis jobs.

### Run-amplifying patterns

- A push to `translation-repair-rebased` starts CodeQL because the all-branch ruleset marks it protected.
  Run `32279201781` is a completed example.
- Closely spaced pushes create overlapping workflow runs because default setup exposes no repository workflow file in which
  to add a concurrency group.
- Selecting a labeled runner routes the same generated jobs elsewhere and preserves their trigger count.

## Verified workarounds

No workaround was applied to the live repository during this review.
The request asked whether a provider migration would solve the problem, so changing repository security configuration would
have exceeded the review scope.

GitHub documents two applicable configuration capabilities, but this repository has not exercised either after-state yet:

- Advanced setup permits defining workflow triggers
  (`content/code-security/concepts/code-scanning/setup-types.md:68-74`).
- Workflow-level `concurrency` can cancel a running member of the same group with `cancel-in-progress: true`
  (`data/reusables/actions/actions-group-concurrency.md:7-20`).

A candidate advanced-setup shape is therefore:

```yaml
name: CodeQL

on:
  push:
    branches:
    - main
  pull_request:
    branches:
    - main
  schedule:
  - cron: '0 12 * * 3'

concurrency:
  group: codeql-${{ github.ref }}
  cancel-in-progress: true
```

This is a documented configuration path, not a verified patch for this repository.
It needs a disposable branch or other controlled rollout before adoption.
Its tradeoff is ownership of the CodeQL workflow and trigger policy instead of GitHub's generated low-maintenance default.

Narrowing ruleset `9126851` from `~ALL` to selected branches is another documented configuration direction,
but it would also narrow Copilot review policy.
That semantic tradeoff makes it a separate repository-governance decision, not a CI-only workaround.

## What does not work

### Migrating default setup to a faster labeled runner

This can reduce duration if the selected machine performs better.
It retains every protected-branch trigger and therefore does not remove redundant runs.
Namespace also introduces a separate paid or sponsorship-gated compute allocation.

### Increasing concurrency alone

More concurrent slots drain a burst faster but execute the same number of analyses.
For this repository, GitHub's public standard runners are free,
while Namespace's standard pricing meters compute and gates Windows runners behind Team or higher
(https://namespace.so/pricing.md).

### Adding path filters to default setup

Default setup does not expose a repository workflow file.
GitHub directs users who need custom workflow triggers to advanced setup at
`content/code-security/concepts/code-scanning/setup-types.md:68-74`.

### Splitting the repository

A split would change repository-level event boundaries,
but the trigger amplification originates in an all-branch protection rule combined with documented default-setup behavior.
Changing repository topology is not required to change either input.

## Upstream filing artifact

### Upstream filing decision

- **Is it really upstream's fault?** No.
  GitHub documents the protected-branch trigger explicitly.
  The surprising volume comes from this repository applying a protection-producing ruleset to `~ALL` branches.
- **Can upstream fix it?** GitHub could add default-setup concurrency controls,
  but no defect was established in the documented behavior.
- **Are they supporting this use case?** Yes.
  GitHub supports default setup, labeled runners, and advanced setup for custom triggers.
- **Would the repository welcome the contribution?** No issue is needed.
  Searches of open and closed `github/docs` issues and pull requests for
  `default setup protected branch ruleset scans every push` found no duplicate,
  but the current documentation already states the decisive behavior.
- **Will they likely fix it?** Not applicable.
  There is no demonstrated documentation error or service defect to fix.
- **Have we prototyped a minimal fix compatible with their architecture?** No.
  The relevant change belongs in this repository's CodeQL or ruleset configuration,
  not in GitHub's documentation source.

`.out-of-scope/` contains no GitHub Actions or CodeQL exemption.
The upstream-filing gate still stops at the first constraint because this is expected behavior.
There is nothing additive to file or comment upstream.

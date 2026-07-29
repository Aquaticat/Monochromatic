# GitHub Actions at docs revision e1e4aa9 starts unrelated cli-git performance runs on every main push

## Symptom

`.github/workflows/cli-git-performance.yml` starts the complete packed lifecycle benchmark for every push to `main`,
even when a commit changes only an unrelated document or package.

The latest 500 runs returned by GitHub on 2026-07-29 contained 499 `push` runs and one `pull_request` run.
Every run had a `failure` conclusion.
Of the 499 push revisions,
498 were available in the local Git history for path classification.
The proposed dependency and infrastructure scope matched 39 revisions and did not match 459 revisions.
This is a classification of that 498-run sample,
not a claim about every historical run.

The current red state has a second repository-local cause.
The package was renamed to `@monochromatic-dev/git-policy-cli`,
but the workflow still asks pnpm to install the old `@monochromatic-dev/cli-git...` dependency closure.
Run `30440155739` consequently reached the build without `rolldown` and emitted:

```text
sh: 1: rolldown: not found
Error: fanout child tasks failed: //package/git-policy/cli:build:js:node
```

## Root cause

### Every main push is an explicit trigger

`.github/workflows/cli-git-performance.yml:3` to `9` declares `push` with only a branch filter:

```yaml
on:
  pull_request:
    branches: ['main']
  merge_group:
    branches: ['main']
  push:
    branches: ['main']
```

There is no `paths` filter.
The job at `.github/workflows/cli-git-performance.yml:14` to `16` also has no condition:

```yaml
jobs:
  lifecycle-latency:
    runs-on: ubuntu-latest
```

GitHub is therefore following the repository's configuration.
The workflow was introduced by commit `7244d1b94f75488b9a018c8ed36aa5c803676bc5`,
whose commit body explicitly said it would run the benchmark "on every mainline change.
"

GitHub's documentation source was inspected at `github/docs@e1e4aa937308f21c411c248b4966873536bb0cba`.
`data/reusables/actions/workflows/triggering-a-workflow-paths1.md:1` to `3` identifies path filtering as the supported
restriction for `push` and `pull_request`:

```md
When using the `push` and `pull_request` events, you can configure a workflow to run based on what file paths are changed.

Use the `paths` filter when you want to include file path patterns or when you want to both include and exclude file path patterns.
```

The same source at line `11` states that branch and path restrictions are conjunctive:

```md
If you define both `branches`/`branches-ignore` and `paths`/`paths-ignore`, the workflow will only run when both filters are satisfied.
```

The observed behavior is not a GitHub Actions defect.
The repository configured a broad `push` trigger and omitted the documented filter.

### The merge-group trigger has no current repository role

The `main` branch protection response currently has an empty `required_status_checks.checks` array.
The only active repository ruleset is `Copilot review`;
it does not require this workflow or configure a merge queue.

GitHub's documentation source,
`data/reusables/actions/merge-group-event-with-required-checks.md:1`,
explains the relevant role of `merge_group`:

```md
If your repository uses GitHub Actions to perform required checks or if you require workflows via organization rulesets on pull requests in your repository, you need to update the workflows to include the `merge_group` event as an additional trigger.
```

That condition does not hold for this repository today.
Keeping `merge_group` would add work if a merge queue were enabled later,
but it provides no current protection.

### The package rename left the install selector stale

`package/git-policy/cli/package.json:3` declares the current package name:

```json
"name": "@monochromatic-dev/git-policy-cli"
```

`.github/workflows/cli-git-performance.yml:39` to `40` still selects the removed name:

```yaml
- name: Install cli-git dependency closure
  run: mise exec node pnpm -- pnpm install --frozen-lockfile --filter @monochromatic-dev/cli-git...
```

Commit `b18e8836b6cd070a3fa03aaa1295c048994ff06e` renamed the package and updated workflow paths,
but its workflow diff did not update this filter.
The failure is emitted later because the filtered install command completes without providing the build tool,
then `mise run //package/git-policy/cli:perf:lifecycle-latency` invokes `rolldown`.

## Verification

### Version and harness

- Repository revision first inspected:
  `bbbeb340b785fb16629fcf76fdf7c235b6dbd9c8`.
- GitHub documentation source:
  `github/docs@e1e4aa937308f21c411c248b4966873536bb0cba`.
- Workflow:
  `.github/workflows/cli-git-performance.yml`.
- Failed run inspected:
  [run 30440155739][failed-run].

Retrieve the trigger and recent-run evidence with:

```sh
gh api repos/Aquaticat/Monochromatic/branches/main/protection
gh api repos/Aquaticat/Monochromatic/rulesets --paginate
gh run list \
  --repo Aquaticat/Monochromatic \
  --workflow cli-git-performance.yml \
  --limit 500 \
  --json databaseId,event,headSha,createdAt,updatedAt,conclusion
gh run view 30440155739 \
  --repo Aquaticat/Monochromatic \
  --log-failed
```

### Runs that belong in the automatic scope

- A change under `package/git-policy/**` can change the benchmarked CLI.
- A change to a bundled workspace dependency can change CLI lifecycle latency.
- A change to the build configuration,
  package-manager resolution,
  tool lock,
  or performance workflow can change the artifact or harness.
- A manual dispatch is useful after runner-image incidents or when validating a proposed budget.

### Runs outside the automatic scope

- Revision `bbbeb340b785fb16629fcf76fdf7c235b6dbd9c8` changed only
  `doc/planning/prefer-readonly-return-substitution.md`,
  but started run `30440155739`.
- Revision `98b3f8f3c3149d258960cae813186589e52cf2ce` changed only the
  `prefer-readonly-parameter-type` plugin and its test,
  but started run `30438732081`.
- Revision `84021bbb4a67cc36b5273905be36c9e499bc75bf` changed `cli-markdown-lint`,
  but started run `30436916736`.

These inputs cannot change the packed cli-git artifact,
its direct workspace dependencies,
or the lifecycle harness.

## Verified workarounds

### Scope pull-request and main-push runs by affected paths

This is the recommended policy for the repository's present development flow.
The latest 500-run API window contained 499 push runs and one pull-request run,
so removing `push` would remove nearly all observed automatic enforcement.
A path-scoped main push retains that enforcement without running for every unrelated commit.

Apply this trigger and package-filter patch:

```diff
diff --git a/.github/workflows/cli-git-performance.yml b/.github/workflows/cli-git-performance.yml
--- a/.github/workflows/cli-git-performance.yml
+++ b/.github/workflows/cli-git-performance.yml
@@
 on:
   pull_request:
     branches: ['main']
-  merge_group:
-    branches: ['main']
+    paths:
+    - 'package/git-policy/**'
+    - 'package/module/async-time/**'
+    - 'package/module/caught-value/**'
+    - 'package/module/fs-id/**'
+    - 'package/module/fs-path/**'
+    - 'package/module/logger/**'
+    - 'package/ownership-marker/foreign-borrowed/**'
+    - 'package/config/rolldown/**'
+    - 'package/config/typescript/**'
+    - 'pnpm-lock.yaml'
+    - 'pnpm-workspace.yaml'
+    - 'mise.toml'
+    - 'mise.no-env.toml'
+    - 'mise.lock'
+    - '.github/workflows/cli-git-performance.yml'
   push:
     branches: ['main']
+    paths:
+    - 'package/git-policy/**'
+    - 'package/module/async-time/**'
+    - 'package/module/caught-value/**'
+    - 'package/module/fs-id/**'
+    - 'package/module/fs-path/**'
+    - 'package/module/logger/**'
+    - 'package/ownership-marker/foreign-borrowed/**'
+    - 'package/config/rolldown/**'
+    - 'package/config/typescript/**'
+    - 'pnpm-lock.yaml'
+    - 'pnpm-workspace.yaml'
+    - 'mise.toml'
+    - 'mise.no-env.toml'
+    - 'mise.lock'
+    - '.github/workflows/cli-git-performance.yml'
+  workflow_dispatch:
@@
-      run: mise exec node pnpm -- pnpm install --frozen-lockfile --filter @monochromatic-dev/cli-git...
+      run: mise exec node pnpm -- pnpm install --frozen-lockfile --filter @monochromatic-dev/git-policy-cli...
```

The path behavior is backed by GitHub's current workflow syntax and by classification of recent repository revisions.
The patch itself remains a recommendation and has not been deployed.
After applying it,
manually dispatch one run and require a green benchmark before treating the stale-filter correction as complete.
A green run is needed because the current log proves the first missing tool,
not that no later failure exists.

Tradeoffs:

- The path list must be maintained when the CLI's workspace dependency closure changes.
- Any `pnpm-lock.yaml` or `pnpm-workspace.yaml` change triggers the workflow,
  including changes that ultimately affect only another package.
  This favors avoiding false negatives over maximum filtering precision.
- A relevant pull request followed by its merge can produce both a pull-request run and a main-push run.
  The main-push run is retained because direct main pushes dominate the observed workflow history.

### Use pull requests plus manual dispatch only

Remove both `push` and `merge_group`,
retain the filtered `pull_request`,
and add `workflow_dispatch`.

Tradeoff:
this avoids the duplicate post-merge run,
but direct changes to `main` receive no automatic performance check.
That conflicts with the repository's observed 499-to-one push versus pull-request run mix.

### Add a periodic trend run only when trend monitoring is a requirement

A weekly `schedule` can detect runner-image or toolchain drift even when relevant source does not change.
Use a minute away from the start of the hour because
`github/docs@e1e4aa9:data/reusables/actions/schedule-delay.md:1` warns that high-load schedules may be delayed or dropped.

Tradeoff:
a schedule adds runs unrelated to commits,
can detect a regression after it lands,
and does not identify the introducing revision.
No current requirement calls for periodic trend data,
so it should not be part of the default patch.

### Preserve a future required check with a lightweight always-reported job

The current workflow is not required.
If it becomes required later,
do not leave a required workflow behind a trigger-level path filter.
GitHub documents at
`content/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks.md:53` to `59`
that a path-filtered required workflow remains pending and blocks merging.
At that point,
trigger a lightweight required workflow for every pull request,
use change detection to condition the benchmark job,
and let the lightweight required job report success after either a benchmark pass or an intentional skip.

Tradeoff:
every pull request would still create a workflow run,
but only relevant changes would allocate the benchmark runner and container work.

## What does not work

- `concurrency` can cancel superseded runs,
  but each unrelated push still satisfies the trigger.
- A documentation-only `paths-ignore` list does not exclude unrelated package changes and grows as new unrelated areas appear.
  An allow-list models the benchmark's dependency boundary directly.
- Manual dispatch alone turns an enforced budget into an optional check.
- Pull-request-only automation does not fit the observed direct-main workflow unless that development policy changes first.
- A schedule alone delays regression detection and weakens attribution to the introducing change.
- Keeping `merge_group` for a check that is not required and a queue that is not configured adds no current coverage.
- Fixing only the stale pnpm selector stops `rolldown: not found`,
  but leaves the every-main-push trigger unchanged.
- Adding only `paths` leaves the workflow red because it preserves the stale pnpm selector.

## Upstream filing artifact

### Upstream filing decision

No `.out-of-scope/` entry names GitHub Actions event path filtering or this workflow's trigger scope.
Open and closed `github/docs` issues and pull requests were searched for the path-filter and required-check behavior.
No upstream report is needed because the current documentation already describes the observed behavior.

1. **Is it really upstream's fault?**
   No.
   The repository explicitly requests every push to `main` and omits `paths`.
2. **Can upstream fix it?**
   No product defect was established.
   The fix belongs in this repository's workflow configuration.
3. **Are they supporting this use case?**
   Yes.
   GitHub documents `paths` for `push` and `pull_request`,
   plus `workflow_dispatch` for manual runs.
4. **Would the repo welcome our contribution?**
   Not applicable because the deciding upstream documentation is correct.
5. **Will they likely fix it?**
   No upstream change is needed.
6. **Have we prototyped a minimal fix compatible with their architecture?**
   Yes at the consumer configuration boundary.
   The patch adds documented path filters,
   removes the currently unused merge-group trigger,
   adds manual dispatch,
   and corrects the stale package selector.
   It is source-reviewed and path-classified but still requires one hosted green run after deployment.

### Filing artifact

~~~md
Do not file as-is.

There is no GitHub Actions defect to report.
Monochromatic configured an unfiltered push trigger and retained a stale package selector after renaming cli-git.
The correction belongs in `.github/workflows/cli-git-performance.yml`.
~~~

[failed-run]: https://github.com/Aquaticat/Monochromatic/actions/runs/30440155739

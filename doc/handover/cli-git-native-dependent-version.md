# cli-git native dependent-version planner

## Purpose and how to respond

This records the native Rust planning core of `mono/dependent-version-bump`
and the proof that it plans what the incumbent TypeScript planner plans.
The owner decided on 2026-10-05 that the dependent-version ripple ends with one implementation,
in the native wrapper:
the release task will call `git cli-git fix`,
and the TypeScript planning code under `package/git-policy/repository/src` is deleted at cutover
(`doc/planning/cli-git-rust-open-decisions.md`, section "TypeScript utilities beside the wrapper").
This branch builds the planner and the equivalence evidence.
It does not wire the planner into the policy engine;
section "What the wiring step needs" lists what that later step must do.

What to inspect:

- the intentional differences, each with its reason,
  in section "Intentional differences";
- the choices open to veto,
  in section "Choices open to veto";
- the differential results and positive controls,
  in section "Proof of equivalence".

How to respond:
a veto of a choice or of an intentional difference names its heading;
the planner then changes to match the incumbent at that point,
and the differential harness proves it.

## What changed

### Planner modules

All files are in `package/git-policy/cli/src/native/`,
each with a sibling `*_tests.rs`,
registered in `lib.rs`.
Nothing outside them calls them yet.

- `dependent_version_content.rs`:
  the content seam (`WorkspaceContent`, `TrackedPath`, `TrackedMode`)
  and the failure types (`ContentUnavailable`, `PolicyIncomplete`, `PlanError`) with their complete diagnostics.
- `dependent_version_paths.rs`:
  which tracked paths are workspace manifests,
  the registry configuration,
  and a package's non-test source.
- `dependent_version_manifest.rs`:
  strict UTF-8 and strict JSON reading of a manifest's name,
  version and dependency names.
- `dependent_version_release.rs`:
  the patch bump of a plain release and `JSON.stringify` quoting.
- `dependent_version_text.rs`:
  the byte-preserving rewrite of the top-level version.
- `dependent_version_publishable.rs`:
  publishable names from `package/config/pnpr/config.yaml`.
- `dependent_version_imports.rs`:
  the module-specifier scan.
- `dependent_version_graph.rs`:
  the dependency walk and the bump plan.
- `dependent_version_states.rs`:
  every manifest at both states and the raised names.
- `dependent_version_bundled.rs`:
  which development dependencies each dependent bundles.
- `dependent_version_plan.rs`:
  `plan_workspace_bumps`,
  the planner behind both entry points,
  with exact bytes before and after each bump.
- `dependent_version_policy.rs`:
  `find_dependent_bumps`,
  the trigger rule,
  the candidate rule and the findings.

Test-only modules:
`dependent_version_test_support.rs` (an in-memory workspace that records reads),
`dependent_version_fixture_json.rs` and `dependent_version_fixture_cases.rs`
(the native side of the differential harness),
and `dependent_version_differential_tests.rs`.

### Differential harness

The driver is `package/git-policy/cli/bin/dependent-version-differential.mjs`,
run as `mise run //package/git-policy/cli:native:differential:dependent-version -- <record | check | corpus>`.
Its modules in the same directory, all named `dependent-version-<role>.mjs`:

- `incumbent` and `incumbent-reader`:
  the incumbent side and its fake policy context.
- `unit-scenarios`,
  `unit-functions`,
  `unit-graph`,
  `unit-workspaces`
  and `unit-workspace-parts`:
  the transcribed unit-test scenarios.
- `generator`,
  `workspace`,
  `generator-parts`,
  `manifest-text`,
  `malformed`
  and `random`:
  the seeded generator.
- `repository`,
  `repository-samples`
  and `repository-cases`:
  the real repository.
- `native`:
  the native side,
  in place or in a planted copy.
- `probes` and `report`:
  predictions,
  plants and the per-class comparison.
- `types`:
  the shapes both sides read and write.

Each lints with 0 findings under the package's Oxlint configuration.
The committed shared fixture is
`package/git-policy/cli/src/native/dependent_version_fixtures/unit_cases.json`.

### Fuzz target

`package/git-policy/cli.fuzz` has a fifth target,
`dependent_version`,
described in that package's `README.md` under "`dependent_version`".

### Dependencies

No dependency was added.
Manifests are parsed with `monochromatic-jsonc-edit`,
which the crate already links.
No `Cargo.lock` changed.

## The planner

### Content seam

`WorkspaceContent` has three methods:
`tracked_paths` (every tracked path with its mode, in the provider's order),
`candidate_bytes(path)`,
and `base_bytes(path)`,
which answers nothing when the base lacks the path.
The planner selects manifests,
the configuration and source files from the listing itself,
so the provider needs no pathspec support.
It reads every manifest at both states,
the configuration only once a version was raised,
and source files only of dependents whose development edges could carry a raised version.

### Failure kinds

`PlanError::ContentUnavailable` is a read the provider could not answer;
the engine reports it as `content-unavailable`.
`PlanError::PolicyIncomplete` is content the planner read but cannot use,
reported as `policy-incomplete`:
a manifest or the configuration that is not UTF-8,
a manifest that is not JSON,
a manifest without a string name or with a non-string version,
a version the rewrite cannot find as parsed,
or two manifests with one package name.
A dependent whose version is not a plain release is not a failure:
the plan ends with `PlanOutcome::Unsupported`,
which the policy reports as one `dependent-version-unsupported` finding,
as the incumbent does.

### Retained behavior

Every rule the ledger section "Dependent-version propagation" names is kept:
the trigger rule
(a forwarded command other than `commit` plans nothing;
`git cli-git check` and `git cli-git fix` plan whatever the command word),
the candidate rule
(only a modified `package/<category>/<name>/package.json` starts planning),
the raised rule
(a version that differs from the base,
including one removed,
counts as raised;
a manifest new at this state,
or without a version at the base,
raises nothing),
the walk through unpublished packages and cycles,
the stale rule
(publishable,
versioned,
reached and not itself raised),
the bundled-edge rule,
the publishable-name line scan,
the name order of findings,
and the finding codes and messages verbatim.
The incumbent's order of failures is kept:
every manifest is decoded before any is parsed,
and a manifest's base text is parsed before its current text.

## Proof of equivalence

### How the comparison works

Both planners read the same cases and write one canonical JSON text per case:
keys in a fixed order,
no spaces,
strings quoted as `JSON.stringify` quotes them,
and every byte string (paths, original and patched manifest bytes) as lower-case hexadecimal.
Equal texts are equal results.
A workspace case is evaluated twice by each side over the same content:

- the plan,
  through the incumbent's `planWorkspaceBumps` with the release task's reader semantics
  (`bump-dependents-worktree.ts`: lenient UTF-8,
  a byte-order mark kept),
  and through the native `plan_workspace_bumps`;
- the policy,
  through the incumbent's `findDependentBumps` over a fake policy context shaped like the unit tests' `contextOf`,
  whose reader is the policy's own (strict UTF-8, a byte-order mark stripped),
  and through the native `find_dependent_bumps`.

The plan result holds the raised names and,
per bump,
the name,
directory,
both versions,
the manifest path,
and the exact bytes before and after.
The policy result holds every finding's code,
message,
path and patch,
whose before and after bytes are read back from the incumbent's unified diff.
A failure compares by class
(`syntax`, `shape`, `decode`, `unavailable`, `graph`, `other`)
and,
for shape problems,
by the incumbent's `ManifestShapeError` message verbatim;
the parsers' own syntax messages differ by design and are not compared.

The incumbent is the TypeScript source,
imported unchanged through `@monochromatic-dev/git-policy-repository/ts` and run by `node`.

### Inputs

#### Unit-test scenarios

Every scenario of the incumbent's five dependent-version unit-test files is transcribed in
the `unit-*` modules:
61 cases,
from function-level ones (`patchBumpVersion`, `planDependentBumps`, `readManifestDependencyFacts`,
`replaceManifestVersion`, `importsPackage`, `isNonTestSourcePath`, `readPublishableNames`)
to workspace ones (`findDependentBumps` and `bumpWorktreeDependents`).
Each keeps its unit test's own assertion,
which the driver applies to the incumbent's result before recording it,
so a transcription mistake fails before any comparison.
The `record` subcommand writes the results to the committed fixture
`src/native/dependent_version_fixtures/unit_cases.json`;
`check` requires the incumbent to reproduce that file;
the native gate test `dependent_version_differential_tests::unit_fixtures_match_the_incumbent` reads the same file.
Two incumbent tests are not planner scenarios and are not transcribed:
the plugin registration test
(the native trigger table in `policy_trigger.rs` pins the triggers)
and the constructor of `WorktreeBumpConflictError`
(the native release path is `git cli-git fix`,
whose conflict handling is the engine's `patch-conflict`).

#### Real repository

The driver reads this worktree at `HEAD` with `/usr/bin/git ls-tree` and `cat-file`,
read-only and bypassing the wrapper:
every tracked path with its mode,
and the bytes of every workspace manifest,
the registry configuration and every file under a package's `src/`.
It samples packages from the actual graph,
four per category:
leaf packages (no manifest names them),
the most depended-on packages (by runtime fields),
private packages that something depends on,
and packages reached only through bundled development imports whose importer is published.
Each case raises one sample's minor version as a pre-forward commit of that manifest;
one more raises one sample of each category together,
and one more runs that raise as the release workflow's `direct-fix`.

#### Generated workspaces

The `generator` module and its parts,
seeded with Mulberry32.
Each workspace has 2 to 10 packages with random edges of every field kind
(so cycles,
self edges and edges to names without a manifest occur),
workspace protocol variants,
unpublished packages,
names that order differently in UTF-16 and UTF-8,
source files of every extension with every specifier form and decoys
(comments,
plain strings,
prefix look-alikes,
`reimport`,
`myrequire`,
test files,
files that are not source,
bytes that are not UTF-8),
unusual manifest formatting
(indentation of 0, 2 or 4 spaces or tabs,
CRLF,
no final newline,
spaces before the colon,
shuffled keys,
a nested `publishConfig.version`,
`"version"` as a value),
new,
renamed and reformatted manifests,
raised,
removed and already bumped versions,
every lifecycle point,
deleted candidates,
manifests that are executable,
symbolic links or submodules,
and at most one malformed manifest per workspace
(a comment,
a trailing comma,
single quotes,
a missing comma,
truncation,
a scalar or array root,
a numeric name,
a non-string version,
a duplicated version key whose first value differs).

#### Probes

One feature per workspace whose result is meant to differ,
25 workspaces per feature,
each difference checked against its prediction in the `probes` module:
`bom`,
`huge-patch`,
`duplicate-name`,
`unpaired-surrogate-name`,
`deep-nesting`,
`non-utf8-manifest`,
`non-utf8-config`.

### Results

Evidence directory
`package/git-policy/cli/target/verification/dependent-version-DufJ5h`
(`cases.jsonl`, `ts-results.jsonl`, `rust-results.jsonl`, `report.json`),
seed `20261006`,
on the tree of commit `0d7318ff2`:

- Unit-test scenarios:
  61 cases,
  61 identical.
- Real repository at `0d7318ff2`:
  17 cases
  (the import-only category had three qualifying packages),
  17 identical;
  10 plan bumps
  (between 1 and 80 dependents each;
  the three import-only samples are reached only through bundled development imports and plan 1, 2 and 8),
  7 raise a package nothing published reaches.
- Generated:
  2,000 cases,
  2,000 identical.
  The incumbent's outcomes:
  744 plans with bumps,
  650 raised without a bump,
  216 nothing raised,
  213 unsupported versions,
  91 syntax failures and 86 shape failures of the plan;
  646 policy runs with stale findings,
  192 with an unsupported finding,
  1,003 without a finding,
  81 syntax and 78 shape failures.
- Probes:
  175 cases,
  23 identical
  (the feature did not reach the plan),
  152 differences,
  all matching their prediction,
  0 unexplained.
  Differences per feature:
  `bom` 25,
  `huge-patch` 13,
  `duplicate-name` 19,
  `unpaired-surrogate-name` 25,
  `deep-nesting` 25,
  `non-utf8-manifest` 25,
  `non-utf8-config` 20.

The harness was rewritten to the package's lint rules after a first run
(evidence `dependent-version-avWftA`, commit `926a93a40`);
that run was also free of unexplained differences,
with a generated corpus that differed in detail.

No difference was found outside the probes.

### Positive controls

Each planted defect was built in a disposable copy of the crate
(`--plant`),
and the same corpus was compared again:

- `wrong-component`
  (the minor component bumped instead of the patch):
  10 unit,
  10 repository,
  731 generated and 23 probe cases reported
  (evidence `dependent-version-ZZ6zuR`).
- `skip-peer-dependencies`
  (`peerDependencies` dropped from the runtime fields):
  1 unit,
  254 generated and 4 probe cases reported;
  no repository case,
  since no workspace manifest here names a workspace package under `peerDependencies`
  (evidence `dependent-version-ZYkRJh`).
- `skip-bundled-edges`
  (confirmed bundled edges dropped from the walk):
  2 unit,
  9 repository,
  162 generated and 4 probe cases reported
  (evidence `dependent-version-H7Ux9B`).

The driver exits 1 whenever a difference is unexplained.

### Intentional differences

Each is a defect or an unbounded case of the incumbent that the ledger does not mark as retained behavior.
Each has a probe,
or a direct measurement where the incumbent cannot run.

#### A byte-order mark is kept

The policy's strict `TextDecoder` strips a leading byte-order mark,
so the incumbent's patch rewrites the manifest without it,
and its patch's original side does not match the tracked bytes.
The release task keeps the mark and `JSON.parse` then refuses the manifest.
The native planner parses after one mark and keeps it in both the original and the patched bytes.
Probe `bom`.

#### The patch increment is exact

`String(Number(component) + 1)` rounds a patch component at or above 2^53 through a double.
Measured with `node` on the incumbent's `patchBumpVersion`:
`1.0.9007199254740991` becomes `1.0.9007199254740992` (correct),
`1.0.9007199254740992` stays `1.0.9007199254740992`,
`1.0.9007199254740993` becomes `1.0.9007199254740992`, a lower version,
and `2.3.999999999999999999999` becomes `2.3.1e+21`.
The native increment adds one to the decimal digits at any size.
Probe `huge-patch`.

#### Two manifests with one name are refused

The incumbent maps names to manifests last-wins,
so two bumps of one name share the later manifest's text:
equal versions give two findings for one path,
different ones a `ManifestShapeError`,
and the earlier manifest's bundled edges are replaced by the later one's.
The native planner refuses with `policy-incomplete`,
naming both manifests,
once a version was raised and the configuration exists,
which is where the incumbent starts using names.
Probe `duplicate-name`.

#### A package name with an unpaired surrogate is refused

`"name": "a\ud800"` is a JavaScript string but not Rust text,
and no npm package can carry it.
The native planner refuses such a name as a shape problem.
A dependency key with an unpaired surrogate is dropped:
it can name no workspace package,
since such a name is refused.
A version with an unpaired surrogate is kept as UTF-16 code units and quoted as the incumbent quotes it.
Probe `unpaired-surrogate-name`.

#### Manifests nest at most 511 containers

`monochromatic-jsonc-edit` refuses a 513th open container,
and the parser wraps the text in one array.
`JSON.parse` has no such bound.
Probe `deep-nesting`.

#### An empty package name terminates

`importsPackage` with an empty name never advances its `indexOf` cursor:
`timeout 10 node` on `importsPackage({ sourceText: "import 'x';", packageName: '' })` exited 124,
while the same call with `'x'` printed `true` and exited 0.
The incumbent reaches it when a workspace package is named `""`,
another package lists it under `devDependencies`,
and that package has source files.
The native scan applies its stated rule at every position:
`import ''` imports the empty name.
The generator never produces an empty name,
because the incumbent would not return.

#### Source files are selected by a literal prefix

The incumbent lists a package's source files with the pathspec `:(glob)<directory>/src/**`,
so a directory name holding glob magic selects other paths.
Measured with Git 2.55.0 in a disposable repository holding `package/module/[ab]/src/index.ts`
and `package/module/a/src/index.ts`:
`git ls-files ':(glob)package/module/[ab]/src/**'` printed only `package/module/a/src/index.ts`,
which the incumbent's own prefix check then discards,
so the package's own source is never scanned.
The native planner selects `<directory>/src/` by literal prefix.
The fake context in the harness matches paths literally,
so no generated case shows this difference;
the generator uses no glob magic in directory names.

#### The order of dependency names

`Object.keys` lists integer-like keys first;
the native reader keeps source order.
No result of the plan depends on that order,
and no unit scenario uses such a key.

### Differences between the incumbent's two entry points

These are differences inside the incumbent,
which the single native planner resolves the way the policy does.
The release task (`bump:dependents`) reads manifests leniently:
a manifest whose bytes are not UTF-8 is decoded with replacement characters,
can parse,
and is then written back with those characters,
while the policy refuses it;
probe `non-utf8-manifest` shows the policy results identical and the release plan differing.
The same holds for the registry configuration
(probe `non-utf8-config`)
and for a byte-order mark
(section "A byte-order mark is kept").
Once the release task runs `git cli-git fix`,
it refuses those inputs instead of rewriting them.

## Gates

### Container gate

`GIT_POLICY_NATIVE_IMAGE_TAG=dependent-version mise run //package/git-policy/cli:native:test:container`
on commit `b8afd3d74`:
524 unit tests passed
(442 before this branch, 82 added),
1 ignored
(`corpus_from_environment`, which only the driver runs),
37 binary-level tests passed,
and Clippy with warnings denied passed.
Evidence `package/git-policy/cli/target/verification/native-bva1QD`.

### Mutation

Pending.

### Fuzzing

Pending.

## Choices open to veto

### Two manifests with one name

Refused with `policy-incomplete` once a version was raised and the configuration exists.
The alternative is the incumbent's last-wins mapping,
which yields duplicate findings or a shape failure.

### The exact patch increment

The alternative is to report a patch component at or above 2^53 as unsupported,
as npm's `semver` rejects components above `Number.MAX_SAFE_INTEGER`.

### The empty package name

The scan applies its rule at every position.
The alternative is to treat an empty name as never imported.

### Undecodable manifests and configuration are `policy-incomplete`

The bytes were read,
so the input is present;
the planner's machinery cannot use it.
The alternative is `content-unavailable`.

### One unsupported dependent stops the plan

Retained from the incumbent:
the policy then reports only that dependent,
and the stale findings of the others appear once it is bumped by hand.

### A manifest whose base text does not parse stops the plan

Retained from the incumbent:
a commit that repairs a broken manifest is refused by this policy
until the policy is skipped for that commit.

### The provider lists every tracked path

The seam has no pathspec;
the planner selects paths itself.
In this repository that is 11,443 paths per planning run,
and planning starts only for a commit that modifies a workspace manifest.

## What the wiring step needs

- A second failing `policy_engine::PolicyOutcome` variant for `policy-incomplete`
  and one more arm in `run_policy_stage`,
  as recorded in `cli-git-native-policy-engine.md`,
  section "The failure code of a policy that could not finish follows its cause".
- An arm for `PolicyId::DependentVersionBump` in `policy_checks::ShippedChecks` that:
  builds a `DependentRequest` from the trigger,
  whether the forwarded subcommand is `commit`,
  and the lifecycle's candidates with their change kinds;
  supplies a `WorkspaceContent` that answers from the candidate layer
  (the tracked paths of the candidate state with their modes,
  candidate-state bytes,
  and base bytes: `HEAD`,
  or the preparation base inside a commit transaction);
  and maps `PlanError::ContentUnavailable` to `content-unavailable`
  and `PlanError::PolicyIncomplete` to `policy-incomplete`,
  with `plan_error_message` as the text.
- A conversion of each `DependentFinding` to a `PolicyFinding`
  (`code`, `message`, `path` as text, `fix_available` when `patch` is present)
  and of its `ManifestBump` to a full-content patch of a tracked file that may not be a candidate,
  at that file's exact revision and mode,
  from `original` to `replacement`;
  the engine's added-path rules then decide whether it applies
  (`SPEC.md`, the paragraphs on patches that name a tracked file that is not a candidate,
  and section "Added paths").
- `cli-git.config.jsonc` must list `mono/dependent-version-bump`:
  the native registry gives it `Off` unless listed.
- The release task:
  `changeset:version` runs `git cli-git fix --all --policy mono/dependent-version-bump`
  instead of `bump:dependents`.
  The direct fix's candidates must include the manifests `changeset version` left modified in the worktree.
  The task's optional base-revision argument has no equivalent in the policy path;
  the base is `HEAD`.
- The differential harness can then compare the wired policy:
  a provider over a disposable repository would replace the in-memory workspace.

## Shared lines touched in files this branch does not own

- `package/git-policy/cli/src/native/lib.rs`:
  module declarations inserted after `pub mod rule_add_explicit;`
  (twelve modules,
  and four test-only modules after `pub mod dependent_version_policy;`).
- `package/git-policy/cli.fuzz/Cargo.toml`:
  one `[[bin]]` block for `dependent_version`,
  after the `wrapper_controls` block.
  File-enforcer manages this file;
  `mise run sync:files` left the block unchanged.
  The same run rewrote root `mise.toml` and `package/config/pnpr/config.yaml`
  from the local package set;
  that drift is unrelated and was not committed.
- `package/git-policy/cli.fuzz/src/lib.rs`:
  one module declaration at the end.
- `package/git-policy/cli.fuzz/bin/container.mjs`:
  one entry in `targets`.
- `package/git-policy/cli.fuzz/bin/planted-controls.mjs`:
  one `import` line and one spread line at the end of `plants`.
- `package/git-policy/cli.fuzz/README.md`:
  a new section "`dependent_version`" before "Controls".

## Not verified

- The wiring does not exist,
  so the ledger's consumer-level test
  (three manifests in the standard fixture,
  a commit of one raised manifest)
  has not run.
- The incumbent ran over a fake policy context,
  not the wrapper's candidate layer,
  and its pathspecs were matched literally;
  section "Source files are selected by a literal prefix" is the one place real pathspec semantics differ.
- The release workflow end to end
  (`changeset version`, then the direct fix)
  was not run.
- Only Linux was exercised.

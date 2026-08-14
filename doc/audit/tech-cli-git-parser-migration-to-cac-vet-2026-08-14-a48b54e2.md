# Technology vet: cli-git parser migration to CAC

Status:
 in progress.
 Lifecycle phase is serious alternative.
 Started and last updated on 2026-08-14.

Subject:
 cli-git parser migration to CAC.

Decision scope:
 assess whether CAC is practical for any or all repository-owned parser roles in
`@monochromatic-dev/git-policy-cli`.
Do not evaluate other external CLI parser technologies.

Governing skill:

- Commit is `a05818ad70a40e5769a36de669697ba109891b31`.
- SHA-256 is `393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`.

Compatibility fingerprint:
 `a48b54e274b6d6bda3057027fbcc2ced424ea8c0a00b03a2ce868425a534f986`.

Active audit owner:
 Pi session `01a00016-a9a0-747d-8174-191632f05b8e`.

Prior compatible report:
 none found.
The incompatible broader-scope report is
`doc/audit/tech-cli-git-parser-migration-to-cac-vet-2026-08-14.md`.
It stopped before external evidence collection when the user limited this audit to CAC.

## Context

The user asked whether migrating cli-git to CAC is practical,
then explicitly limited this session to CAC.
CAC is interpreted as the open-source npm CLI framework.
The target is `package/git-policy/cli/`.
The incumbent is inspected only as CAC's replacement-parity baseline.
No other external CLI parser technology will be discovered,
screened,
audited,
scored,
or ranked.
This report is an evaluation,
not adoption authority.
Product code,
dependencies,
configuration,
lockfiles,
and decision records remain unchanged.

The target no longer uses a third-party CLI framework.
Repository history shows that Optique was removed on 2026-07-15 by commits
`1e53f52e02989b152576c0683f6f228b24c40140`,
`4879a44e6a2460ab3c2531744e24a1f2aef27aeb`,
and
`be3c522375d9c2652f44921c7396233c93c2397d`.
The incumbent is therefore the repository-owned parser set.

The current parsing surface has separate roles:

- `src/parse-global-options.ts` locates Git's effective subcommand and applies chained `-C` semantics;
- `src/management-parser.ts` implements the closed `git cli-git` namespace;
- `src/parser/argv.ts` parses declared subsets of Git argv while retaining undeclared options;
- sibling parsers model Git-specific abbreviations,
  short clusters,
  option arity,
  last-option-wins toggles,
  pathspecs,
  and implicit branch creation.

The detailed incumbent inventory and live execution state are in
`doc/handover/cli-git-cac-migration.md`.

## Classification

The incumbent is repository-owned inspectable local technology.
External parser candidates must be inspectable open-source local technologies.

Applicable overlays:

- incumbent dependency replacement;
- high-trust execution,
  because the package shadows `git`,
  classifies and transforms commands,
  and gates safety policies;
- human auditability,
  because parser facts determine whether Git is blocked,
  transformed,
  or forwarded;
- multi-platform behavior across Linux,
  macOS,
  and Windows.

The native,
Wasm,
and prebuilt overlay applies only when a candidate introduces such a boundary.
A candidate with no such boundary records it as not applicable with inspected dependency evidence.
The managed-service,
SaaS,
privacy,
residency,
and browser overlays do not apply because parsing is local and receives argv rather than hosted or browser data.

## Hard constraints

A candidate and its proposed integration shape must satisfy every constraint:

- compatible inspectable open-source license;
- source-to-package provenance;
- no unaudited native,
  Wasm,
  generated,
  downloaded,
  or prebuilt runtime boundary;
- package Node range `^22.18.0 || >=24.11.0`;
- Linux,
  macOS,
  and Windows support;
- one self-contained MJS artifact and side-effect-free package import;
- exact pathspec and raw argv fidelity until cli-git explicitly owns a transformation;
- fail-closed guarded Git command classification;
- complete management grammar,
  output routing,
  early-help,
  and exit contracts from `package/git-policy/cli/SPEC.md`;
- relevant upstream and cli-git consumer-boundary validation;
- wrapper-added `wide-commit` latency at or below the maintained 925-millisecond ceiling.

## Frozen criteria

No priority ordering was supplied,
so every criterion has weight 1:

- net removal of repository-owned parser and adapter code;
- human auditability of parsing and forwarding;
- runtime and bundle overhead;
- direct and transitive runtime dependency surface;
- TypeScript inference and declaration compatibility;
- help and diagnostic control without process-global interception;
- upstream maintenance and release health;
- migration and regression-test burden;
- future management-command extensibility;
- fit with the existing pure-parser plus process-adapter seam.

Each criterion uses the rating scale from 0 through 4.
The maximum score is 40.
Hard-gate failures stay outside arithmetic.
No unresolved preference exists before evidence collection.

## Frozen discovery schedule

This is a CAC-only capability audit rather than a category selection.
Search results naming another parser are out of scope and will not become candidates.

### Npm registry

Use the official npm registry package and search APIs with default relevance order and no negative filter.
Run each literal lookup or query:

- exact package metadata for `cac`;
- exact version metadata for the current `cac` release;
- registry search `cac cli`;
- registry search `cac command line parser`.

Continue each search query until the registry reports exhaustion or two consecutive complete pages add no new CAC provenance,
package,
or taxonomy evidence.

### GitHub

Use the repository named by official npm metadata.
Inspect its code,
license,
releases,
CI,
security policy,
contribution policy,
issues,
pull requests,
and organization ownership.
Run these literal GitHub searches scoped to that repository where the API supports scope:

- `allowUnknownOptions`;
- `--`;
- `rawArgs`;
- `process.exit`;
- `help`;
- `TypeScript`;
- `Node 22`;
- `Windows`.

For tracker maintenance,
inspect every issue created or updated in the last twelve months when at most twenty exist,
otherwise the ten most recently updated issues.
Inspect the ten most recently updated pull requests by the same method.

### Broader web

Use the configured web search provider for each literal query:

- `CAC npm TypeScript CLI framework official`;
- `CAC allow unknown options parse argv`;
- `CAC double dash passthrough raw argv`;
- `CAC process exit help behavior`;
- `CAC CLI framework Git argv`;
- `CAC npm security vulnerability`.

The provider exposes no page cursor through this harness.
Record that limit and follow claims back to npm or CAC's repository.
Do not evaluate another parser surfaced by these searches.

### This repository

Run uncapped searches for:

- lowercase whole-word `cac`;
- uppercase whole-word `CAC`;
- `@optique` and `Optique` for migration history;
- `parseArgv` and `tryParseArgv`;
- `management-parser`;
- `argv` plus `parser`.

Inspect matching manifests,
catalog entries,
lockfile entries,
source,
tests,
troubleshooting records,
plans,
decisions,
audits,
and handovers.

### Expansion round

After the initial schedule:

1. Collect every new CAC synonym or feature term from official metadata.
2. Append one de-duplicated CAC-only query round to each applicable source.
3. Freeze the expanded schedule.
4. Record later terms without adding queries.

## Query ledger and saturation

### Npm registry initial schedule

Exact metadata lookups resolved `cac` latest and `cac@7.0.0` through the official registry.
They identified version 7.0.0,
MIT licensing,
Node `>=20.19.0`,
the repository `cacjs/cac`,
and the signed npm tarball.

The search `cac cli` reported 346,631 results.
The first 50-result page contained `cac`.
The complete pages at offsets 50 and 100 added no CAC package,
provenance source,
or taxonomy evidence.

The search `cac command line parser` reported 593,845 results.
The first 50-result page contained `cac`.
The complete pages at offsets 50 and 100 added no CAC package,
provenance source,
or taxonomy evidence.

These broad totals contain other technologies that are excluded by the user's CAC-only scope.
No result became another candidate.
The two-page CAC evidence saturation rule is met for both registry searches.

### GitHub schedule

Official npm metadata named `https://github.com/cacjs/cac`.
The source clone is
`~/temp/agent/cac-2026-08-14` at signed release tag `v7.0.0`,
commit `77f602fcb2d1e75d24f5ecd94d5bf667acaa857a`.

Uncapped clone searches completed for:

- `allowUnknownOptions`;
- literal `--` handling;
- `rawArgs`;
- `process.exit`;
- help;
- TypeScript;
- Node 22;
- Windows;
- `mri`;
- numeric coercion;
- unused args.

The search schedule located the parsing,
validation,
help,
type,
test,
CI,
and release paths.
It also located current tracker reports for numeric coercion and multi-word commands.
No recursively expanded technology query was added.

### Broader web initial schedule

The six initial searches consistently resolved the official npm package,
`cacjs/cac`,
release `v7.0.0`,
source files,
and current issues.
The security query added independent package-security indexes,
but primary GitHub Advisory Database searches found no advisory whose affected npm package is exactly `cac` or `mri`.

The web provider exposes no page cursor.
Registry and repository evidence independently established package identity and source coverage.
Other parser names in results were excluded without screening under the user's CAC-only scope.

### Repository schedule

Uncapped whole-word searches found no lowercase `cac` or uppercase `CAC` reference outside the new assessment documents.
The target package declares no CAC dependency.

The `parseArgv`,
`tryParseArgv`,
and `management-parser` searches located the current replacement boundary.
The Optique history sanity search found 182 matches across package and documentation scope,
including current historical comments and prior decisions.
The source and package manifest confirm that Optique is no longer a runtime dependency.

### Expansion round

Official metadata added the terms `Command And Conquer`,
`mri`,
`rawArgs`,
`allowUnknownOptions`,
numeric coercion,
and unused args.

The registry expansion query `cac command and conquer mri` reported 1,643,715 results.
Its first 50-result page contained `cac`.
The complete pages at offsets 50 and 100 added no CAC evidence.

The GitHub expansion searched every added term in the pinned clone and current tracker.
The web expansion ran:

- `CAC mri numeric coercion option values issue`;
- `cacjs CAC allowUnknownOptions rawArgs mri`;
- `cacjs CAC unused args v7`;
- `cacjs CAC Command And Conquer CLI package provenance`.

It corroborated issue `cacjs/cac#165`,
issue `cacjs/cac#162`,
the v7 unused-argument release change,
the official release,
and npm provenance.
The expansion round is frozen.

### Terminal discovery result

CAC-only discovery is saturated with the one user-named candidate.
The source classes identify no second CAC package or independent implementation.
Category-wide alternative saturation is intentionally excluded by the user's explicit scope.

## Candidate ledger

### Incumbent parity baseline

Discovery source:
 current repository manifest,
source,
tests,
history,
and user request to assess replacement.

Role:
 replacement-parity baseline only.
It is not an external technology candidate in this CAC-only audit.

Screening result:
 not applicable.
Its current behavior and maintained tests define what CAC integration must preserve.

### CAC 7.0.0

Discovery source:
 user-named candidate,
then official npm metadata and `cacjs/cac` release `v7.0.0`.

Base category:
 inspectable open-source local technology.

Overlays:
 incumbent replacement,
high-trust,
human auditability,
and multi-platform.
The native,
Wasm,
and prebuilt overlay is not applicable to the published runtime after inspecting the tarball and inlined parser source.

Screening result:
 serious alternative.

Screening evidence:

- MIT license text is present in source and tarball;
- npm metadata declares Node `>=20.19.0`,
  compatible with cli-git's narrower Node range;
- published metadata declares no runtime,
  optional,
  or bundled dependency;
- the build statically inlines `mri` 1.2.0,
  whose MIT source is separately inspectable;
- the tarball has five files,
  41,198 unpacked bytes,
  no lifecycle script,
  one 19,503-byte ESM runtime,
  and one 4,871-byte declaration file;
- npm integrity is
  `sha512-tixWYgm5ZoOD+3g6UTea91eow5z6AAHaho3g0V9CNSNb45gM8SmflpAc+GRd1InC4AqN/07Unrgp56Y94N9hJQ==`;
- measured tarball SHA-512 is
  `b62c566209b9668383fb783a51379af757a8c39cfa0001da868de0d15f4235235be3980cf1299f96901cf8645dd489c2e00a8dff4ed49eb829e7a63de0df6125`;
- npm publish and SLSA attestations bind that digest to `cacjs/cac`,
  tag `v7.0.0`,
  commit `77f602fcb2d1e75d24f5ecd94d5bf667acaa857a`,
  and `.github/workflows/release.yml`;
- GitHub's advisory database returned no exact affected-package record for npm `cac` or the inlined `mri`.

Capability and consumer parity remain pending,
so no hard-gate conclusion or recommendation follows from screening.

## Evidence records

### Incumbent repository checkpoint

Candidate and revision:
 repository-owned parsers at
`54ad78083e8baf95c62d3b0682843967722c563d` before assessment documentation commits.

Claim and relevance:
 the incumbent is not one generic parser boundary.
The parser directory has twenty production TypeScript files and 3,953 physical lines,
while management parsing is one closed subset.
A migration must name which role it replaces before code-removal claims are meaningful.

Gate:
 replacement parity and human auditability.

Status:
 pass for inspectability;
validation remains pending.

Primary evidence:

- `package/git-policy/cli/src/management-parser.ts`;
- `package/git-policy/cli/src/parser/argv.ts`;
- `package/git-policy/cli/src/parser/branch-create.ts`;
- `package/git-policy/cli/src/parser/commit.ts`;
- `package/git-policy/cli/SPEC.md:500-566`;
- `doc/decision/cli-git-policies-platform.md:318-343`.

Outcome:
retain as replacement-parity baseline for CAC validation.

### CAC package identity and provenance

Candidate and version:
 `cac@7.0.0`,
release tag `v7.0.0`,
commit `77f602fcb2d1e75d24f5ecd94d5bf667acaa857a`.

Claim and relevance:
 exact source and published artifact are identifiable and inspectable.
This establishes the source-to-package boundary required before runtime validation.

Gate:
 open-source license,
provenance,
inspectability,
and reproducibility.

Status:
 pass for targeted screening;
rebuild comparison remains pending.

Primary evidence accessed 2026-08-14:

- `https://registry.npmjs.org/cac/7.0.0`;
- `https://registry.npmjs.org/-/npm/v1/attestations/cac@7.0.0`;
- `https://github.com/cacjs/cac/releases/tag/v7.0.0`;
- clone `~/temp/agent/cac-2026-08-14` at the pinned commit;
- tarball `~/temp/agent/cac-artifact-2026-08-14/cac-7.0.0.tgz`.

Relevant source excerpts:

```ts
// cacjs/cac package.json:22-26
"engines": {
  "node": ">=20.19.0"
}
```

```ts
// cacjs/cac tsdown.config.ts:3-12
export default lib(
  {
    inlineDeps: ['mri'],
  },
  {
    inputOptions: {
      resolve: {
        alias: {
          mri: 'mri/lib/index.mjs',
```

Outcome:
advance CAC to targeted source and runtime validation.

### CAC source and test surface checkpoint

Candidate and version:
 `cac@7.0.0` plus inlined `mri@1.2.0`.

Claim and relevance:
 the production parser is compact enough to audit but its declared dependency count understates the inlined MRI boundary.

Gate:
 human auditability,
dependency surface,
and test quality.

Status:
 targeted evidence collected;
final rating pending execution.

Primary evidence accessed 2026-08-14:

- CAC clone has six production TypeScript files and 960 physical source lines;
- a rough blank-and-comment exclusion leaves 728 lines;
- CAC has one 211-line test file with fifteen test calls;
- no fuzzing or mutation harness is present;
- coverage is configured through a reusable workflow;
- the most recent sampled Codecov report on merged PR `#172` reported 66.06 percent line coverage;
- MRI adds 119 source lines and 446 test lines across twenty-three test calls;
- CAC CI builds and tests Node 22,
  24,
  and 25 on Ubuntu and Windows;
- Deno receives a separate Ubuntu example run;
- CAC's own workflow does not run a macOS job.

Outcome:
source is inspectable,
but cli-git's macOS requirement must be validated at the consumer boundary and upstream test breadth remains a scored concern.

### CAC lexical-preservation source trace

Candidate and version:
 `cac@7.0.0` with inlined `mri@1.2.0`.

Claim and relevance:
 CAC does not preserve every option lexeme and token role required by cli-git's current Git-region parser.
The behavior is implemented in MRI and then normalized again by CAC.

Gate:
 replacement parity,
fail-closed Git classification,
and human auditability.

Status:
 scored concern for management-only use;
potential hard failure for Git-region replacement pending artifact reproduction.

Primary source:
 clone `~/temp/agent/mri-2026-08-14` at `v1.2.0`,
commit `e73e9f9d5b02124d14ac17dac2c4801687d3e99a`,
and CAC clone at the pinned candidate commit.

MRI converts an untyped option value to a number whenever unary plus produces a non-NaN number
(`src/index.js:5-11`):

```js
function toVal(out, key, val, opts) {
  var x, old=out[key], nxt=(
    !!~opts.string.indexOf(key) ? (val == null || val === true ? '' : String(val))
    : typeof val === 'boolean' ? val
    : !!~opts.boolean.indexOf(key) ? (val === 'false' ? false : val === 'true' || (out._.push((x = +val,x * 0 === 0) ? x : val),!!val))
    : (x = +val,x * 0 === 0) ? x : val
```

MRI treats a following dash-led token as another option rather than a value
(`src/index.js:89-95`):

```js
name = arg.substring(j, idx);
val = arg.substring(++idx) || (i+1 === len || (''+args[i+1]).charCodeAt(0) === 45 || args[++i]);
arr = (j === 2 ? [name] : name);
```

CAC supplies MRI aliases and boolean names but no `string` option,
then applies optional transforms after MRI has already changed the value
(`cacjs/cac src/utils.ts:48-69`,
`src/cac.ts:282-331`).
An upstream `type: [String]` transform therefore cannot restore a lost leading plus or zero.
Open issue `cacjs/cac#165` reports the same 7.0.0 numeric coercion,
and its 2026-06-17 comment reports the leading-plus loss with `type: [String]`.

CAC stores the caller's full argv reference in `rawArgs` at `src/cac.ts:192`.
A consumer can reparse that array,
but doing so recreates the parser logic the dependency was meant to replace.

Outcome:
artifact and adapter probes must distinguish management-only use from Git-region use.
A broad migration cannot claim lexical preservation merely because `rawArgs` remains accessible.

### CAC boolean-name source trace

Candidate and version:
 `cac@7.0.0`.

Claim and relevance:
 option declarations normalize kebab-case names before MRI receives boolean metadata.
This can make a boolean spelling consume the following token,
which is unsafe for Git's many kebab-case flags.

Gate:
 replacement parity and fail-closed Git classification.

Status:
 potential hard failure for Git-region replacement pending artifact reproduction.

Primary source:

```ts
// cacjs/cac src/option.ts:27-39
this.names = removeBrackets(rawName)
  .split(',')
  .map((v: string) => {
    let name = v.trim().replace(/^-{1,2}/, '')
    if (name.startsWith('no-')) {
      this.negated = true
      name = name.replace(/^no-/, '')
    }
    return camelcaseOptionName(name)
  })
```

`getMriOptions` then registers only those normalized names
(`src/utils.ts:48-69`).
Open PR `cacjs/cac#169` demonstrates `--include-locked` consuming the following positional and adds raw-name tracking,
but it has no review or merge as of 2026-08-14.

Outcome:
current 7.0.0 source has no configuration that registers raw kebab spelling as MRI's boolean key.
Consumer-side scanning can work around it only by retaining owned token-role logic.

### CAC process and type boundary

Candidate and version:
 `cac@7.0.0`.

Claim and relevance:
 CAC permits caller-supplied argv and throws typed runtime errors,
but help output and public result typing do not match cli-git's pure parser seam directly.

Gate:
 process integration,
TypeScript compatibility,
and human auditability.

Status:
 scored concern;
management adapter validation pending.

Primary source:

- `parse(argv, { run: false })` accepts explicit argv at `src/cac.ts:174-190`;
- parsing mutates `rawArgs`,
  `args`,
  `options`,
  and matched-command state at `src/cac.ts:192-232`;
- command events dispatch during parsing at `src/cac.ts:211-224` even when `run` is false;
- built-in help is checked before command validation at `src/cac.ts:234-253`;
- help and version write through `console.info` at `src/command.ts:239-254`;
- unknown-option,
  required-value,
  and unused-argument checks run only from `runMatchedCommand` at `src/cac.ts:341-352`;
- shipped `ParsedArgv.options`,
  `OptionConfig`,
  actions,
  and `runMatchedCommand` use `any` in `dist/index.d.ts`.

Outcome:
a management-only adapter can avoid process exit and pass explicit argv,
but exact help must remain caller-owned and cli-git must project CAC's `any` result through its own validated type boundary.

### Maintenance audit

Candidate and version:
 `cac@7.0.0` and repository activity through 2026-08-14.

Claim and relevance:
 releases and maintainer-authored work resumed in 2026,
while behavior reports and external fixes receive limited public tracker response.

Gate:
 maintenance and release health.

Status:
 scored concern,
not a hard failure.

Primary evidence:
 GitHub API issue,
pull-request,
release,
commit,
and timeline data captured under
`~/temp/agent/cac-artifact-2026-08-14/`.

Findings:

- version 7.0.0 was published on 2026-02-27;
  the preceding stable release,
  6.7.14,
  was published on 2022-08-29;
- the repository had 36 commits from 2025-08-14 through the query date;
  31 used maintainer Kevin Deng's email,
  while the remaining five each used a different author email;
- five issues were created or updated in that period,
  so every one was inspected;
- those issues received no maintainer comment in the measured period;
  issue `#151` received one maintainer closure action after its fix reached 7.0.0;
- current numeric-coercion issue `#165` and multi-word-command issue `#170` have no assignee,
  label,
  milestone,
  or maintainer response;
- the ten most recently updated pull requests were inspected;
- maintainer `sxzz` merged PR `#172` 958 seconds after creation and merged PR `#171` 504,640 seconds after creation;
- PR `#171` received one maintainer approval;
- current behavior-fix PRs `#169` and `#173` have no review;
- no security policy,
fuzz harness,
or mutation harness is present;
- the issue template welcomes bug reports,
feature requests,
and reproduction links and states no ban on outside or AI-assisted contributions.

Outcome:
maintenance is concentrated in one current maintainer and releases reach npm,
but unresolved behavior fixes and absent public triage lower confidence for integration-specific defects.

## Execution manifests

### Published-artifact behavior matrix

Candidate:
 `cac@7.0.0`.

Pinned artifact:
 `~/temp/agent/cac-artifact-2026-08-14/cac-7.0.0.tgz`,
SHA-512
`b62c566209b9668383fb783a51379af757a8c39cfa0001da868de0d15f4235235be3980cf1299f96901cf8645dd489c2e00a8dff4ed49eb829e7a63de0df6125`.

Top-level command:

```text
podman run --memory=2g --cpus=2 --pids-limit=128 --ulimit nofile=1024:1024 --rm --network none --read-only ... node /probe/behavior-probe.mjs
```

Reachable candidate command tree:
 import one extracted ESM file and call its in-process parsing API.
The source path contains no filesystem,
network,
process-execution,
plugin,
native,
Wasm,
or generated-command call.
The harness does not call an action that performs external work.

Inspected files:
 CAC `src/*.ts`,
MRI `src/index.js`,
published `dist/index.js`,
source and published manifests,
and tarball contents.

Expected reads:
 read-only Node image,
read-only harness,
and read-only extracted CAC package.

Expected writes:
 bounded anonymous container state only;
read-only root plus a 64 MiB `/tmp` tmpfs.

Subprocesses:
 Podman runtime and one Node process.
Candidate code spawns none.

Network:
 disabled.

Image:
 local `docker.io/library/node:24-slim`,
Node `v24.18.0`,
image ID `2f35c3d18013b7d65e31c40f0602e4c0a65a18efc65c16e2b98497f13f4da921`,
digest `sha256:d45d78e7929b46875bbd4e29bea672d5bc48186c6c3588306521c815e78352d6`.

Credentials and environment:
 no home mount,
no repository mount,
no ambient credential environment,
and no network.

Outputs:
 one JSON object containing exact results for positive controls,
management grammar cases,
Git-region parity cases,
help behavior,
event dispatch,
and error classes.

Success condition:
 process exits zero,
every catalog case produces a captured result,
and positive controls prove the harness distinguishes expected values.

Failure condition:
 import failure,
uncaptured throw,
missing case,
unexpected external effect,
resource limit,
or nonzero process exit.

Stop condition:
 any undeclared read,
write,
subprocess,
network,
native,
or Wasm boundary requires manifest revision before continuing.

## Hard-gate exits

None yet.

## Validation results

Not started.

## Score arithmetic

Not started.
Only validated finalists will be scored.

## Sensitivity

Not started.

## Pros and cons

Not started.

## Ranking

No CAC practicality conclusion exists before discovery,
hard-gate confirmation,
validation of each viable CAC integration shape,
scoring,
and sensitivity analysis finish.
Other external parser technologies are out of scope.

## Evidence limits

The historical Optique timing in repository history is motivation for a latency gate,
not evidence about CAC.
The current audit has not yet inspected CAC source or reproduced candidate behavior.

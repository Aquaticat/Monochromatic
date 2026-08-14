# cli-git command-line argument parser replacement vet report

- Status: in progress
- Lifecycle phase: discovered
- Subject: cli-git command-line argument parser replacement
- Decision scope: evaluate `jackspeak`, `type-flag`, and `argue-cli` as replacements for cli-git's handwritten
  Git argv region parser and management parser; evaluate no unnamed alternative
- Start date: 2026-08-14
- Last updated: 2026-08-14
- Governing skill: `.agents/skills/choosing-technology/SKILL.md`
- Governing skill commit: `a05818ad70a40e5769a36de669697ba109891b31`
- Governing skill SHA-256: `393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`
- Compatibility fingerprint: `a184aef37ab9cd54b2c0c28a9c662b6957497ef1c031852a589555c05b0bd8bb`
- Active audit owner: Pi process `298127`
- Prior compatible report: none found under `doc/audit/`

## Context

Cli-git is a published ESM package targeting Node `^22.18.0 || >=24.11.0`.
Its PATH-shadowing `git` executable parses partially declared Git option surfaces before policy decisions that can block or
transform destructive operations (`package/git-policy/cli/package.json:1-45` and
`package/git-policy/cli/README.md:1-22`).

The incumbent `parseArgv` implementation has eight production consumer modules and eleven production call sites,
measured with repository-wide import and call searches on 2026-08-14.
The implementation is 415 physical lines and its direct unit test is 333 physical lines.
Those physical counts include project-required TSDoc and formatting.
The relevant boundary is behavior rather than raw file length:

- exact aliases grouped under one result key;
- repeated flag counts and ordered repeated option values;
- options recognized after positionals;
- bare `-` retained as positional and `--` treated as the option terminator;
- declared separated values allowed to start with `-`;
- declared `--name=value` values recognized;
- partially declared Git grammars allowed to retain unknown plain and joined options;
- unknown joined options never reclassified as pathspecs;
- missing declared values refused;
- strict management commands able to reject unknown options and positionals.

These behaviors are implemented in `package/git-policy/cli/src/parser/argv.ts:27-412` and pinned in
`package/git-policy/cli/src/parser/argv.unit.test.ts:60-330`.
Commit parsing also normalizes attached short-option values and performs a separate Git-arity pathspec scan because no
partial option schema can know every unknown Git option's arity
(`package/git-policy/cli/src/parser/commit.ts:188-280`).

The handwritten parser replaced `@optique/core` after a measured wrapper case with one thousand pathspecs spent
2.56 seconds of 4.24 seconds building discarded no-match diagnostics.
The replacement reduced that complete wrapper case to 0.89 seconds.
This historical measurement is recorded in commit `4879a44e6a2460ab3c2531744e24a1f2aef27aeb`.
It is not yet a current candidate benchmark.

Keeping the incumbent is a parity baseline required by the replacement overlay.
It is not added to the user-limited alternative set and will not be scored as a named alternative.

## Classification and overlays

Each named candidate is one inspectable open-source local technology.
The following overlays apply to each:

- incumbent dependency replacement;
- high-trust execution, because parse facts gate Git safety policies;
- human auditability;
- multi-platform Node use on Linux, macOS, and Windows.

The SaaS, sensitive-data, native, Wasm, browser, and managed-service gates are not applicable unless source inspection
finds such a boundary.

## Hard constraints

- Candidate is exactly `jackspeak`, `type-flag`, or `argue-cli`.
- Source and published-artifact provenance are inspectable.
- License is compatible with cli-git's LGPL-3.0-or-later distribution.
- ESM works on Node `^22.18.0 || >=24.11.0` without native, Wasm, or prebuilt runtime code.
- Supplied argv parsing does not mutate ambient environment or require ambient `process.argv`.
- Replacement removes the incumbent token scan rather than recreating an equivalent handwritten scan in an adapter.
- Declared value options accept separated dash-led values and joined equals values, and expose missing values as failure.
- Parsing accepts declared options after positionals and preserves repeated flag counts and option-value order.
- Parsing preserves exact `--` termination and bare `-` positional behavior.
- Partial Git schemas retain unknown plain and joined options without rejecting valid forwarded Git syntax or treating a
  joined option as a pathspec.
- Unknown plain options preserve cli-git's tentative consumption of one following non-option token.
- Management parsing can reject unknown options and unexpected positionals.
- Parser behavior avoids per-pathspec diagnostic work that recreates the measured Optique slowdown.

A candidate that needs a small result-shaping adapter can pass.
A candidate that needs a second argv scanner to restore these semantics has not replaced the incumbent parser and fails.

## Frozen scoring rubric

Every criterion has default weight 1 because the user specified no outcome-changing preference:

- semantic coverage beyond the hard minimum;
- replacement completeness and adapter simplicity;
- runtime performance on representative short and long argv;
- human auditability and runtime dependency surface;
- TypeScript and package integration fit;
- maintenance, release, and provenance confidence.

Each validated finalist will receive a 0 to 4 rating with evidence and confidence.
Hard-gate failures remain outside arithmetic.
Sensitivity will raise each default weight independently from 1 through 5,
vary every medium-confidence and low-confidence exact rating by one point,
and test every evidence range endpoint.

Unresolved preferences: none at context freeze.
If sensitivity exposes a controlling non-measurable preference,
the report will ask only for that preference and will not force a winner.

## Query schedule

The user fixed the candidate set.
Searches may discover evidence or comparison vocabulary but cannot add or evaluate another package.
The supplied npmx pages were fetched first to confirm package identity and exact stable-version leads.
The evidence-discovery schedule then froze as follows.

### Package registry and ecosystem index

- `https://npmx.dev/package/jackspeak`
- `https://npmx.dev/package/type-flag`
- `https://npmx.dev/package/argue-cli`
- exact npm registry metadata and tarball integrity for `jackspeak@4.2.3`
- exact npm registry metadata and tarball integrity for `type-flag@4.5.0`
- exact npm registry metadata and tarball integrity for `argue-cli@3.1.0`

Filters: exact package and stable version only.
Sort: not applicable.
Pagination: exact records have no cursor.

### Repository host

- exact release tag and source revision for each package;
- repository metadata, releases, security policy, workflows, and default branch;
- issues created or updated from 2025-08-14 through 2026-08-14;
- ten most recently updated pull requests when at least ten exist, otherwise every available pull request in that period;
- maintenance publication path from tag to npm artifact.

Filters: exact repository and access-date window.
Sort: updated descending for issues and pull requests.
Pagination: continue to exhaustion for samples of at most twenty issues and ten pull requests.

### Broader web evidence

Initial literal queries:

- `jackspeak 4.2.3 unknown options pass through`
- `type-flag 4.5.0 unknown flags forwarding`
- `argue-cli 3.1.0 readOptions unknown options`
- `jackspeak type-flag argue-cli comparison`

One expansion round from vocabulary in the supplied documentation:

- `jackspeak stopAtPositional util.parseArgs strict unknown options`
- `type-flag ignore unknown-flag option terminator missing value`
- `argue-cli setArgs readOptions internal state option terminator`

Filters: no package exclusion filters.
Sort: provider relevance.
Pagination: provider result set, with result count recorded after execution.
The expansion round is frozen; later vocabulary will not add searches.

### This repository

- exact imports and calls of `parseArgv` and `tryParseArgv`;
- parser tests and command-specific adapters;
- package runtime and bundling constraints;
- parser replacement history and measured regression evidence;
- prior audit, decision, planning, and troubleshooting references.

Filters: `package/git-policy/cli` plus repository documentation.
Sort and pagination: not applicable to repository text and history searches.

## Candidate ledger

### jackspeak

- Discovery source: user-supplied <https://npmx.dev/package/jackspeak>, accessed 2026-08-14
- Version lead: `4.2.3`
- Repository: <https://github.com/isaacs/jackspeak>
- Base category: inspectable open-source local technology
- Overlays: replacement, high-trust, human-auditability, multi-platform
- Clone: `~/temp/agent/jackspeak-2026-08-14`
- Pinned revision: `a58b42f39e2fb04b28b8169005a5ddbc3302730e`, tag `v4.2.3`
- Screening state: discovered; hard-gate evidence pending

### type-flag

- Discovery source: user-supplied <https://npmx.dev/package/type-flag>, accessed 2026-08-14
- Version lead: `4.5.0`; the `5.0.0-beta.18` prerelease is outside the stable-version scope
- Repository: <https://github.com/privatenumber/type-flag>
- Base category: inspectable open-source local technology
- Overlays: replacement, high-trust, human-auditability, multi-platform
- Clone: `~/temp/agent/type-flag-2026-08-14`
- Pinned revision: `6e0c46911ea64c829459a27bfaf1b45e8e335869`, tag `v4.5.0`
- Screening state: discovered; hard-gate evidence pending

### argue-cli

- Discovery source: user-supplied <https://npmx.dev/package/argue-cli>, accessed 2026-08-14
- Version lead: `3.1.0`
- Repository: <https://github.com/TrigenSoftware/Argue>
- Base category: inspectable open-source local technology
- Overlays: replacement, high-trust, human-auditability, multi-platform
- Clone: `~/temp/agent/argue-cli-2026-08-14`
- Pinned revision: `45db68f4acce979d0ba725ae83e320a0e906165a`, tag `v3.1.0`
- Screening state: discovered; hard-gate evidence pending

## Evidence records

### Repository context record R1

- Candidate: incumbent parity baseline at repository revision
  `b92e07dfde48ee7793d464d9ab4866e09e97bde1`
- Claim: replacement must preserve partial Git grammar behavior rather than only parse a conventional closed CLI schema
- Relevance: parse facts gate policy enforcement and command transformation
- Gate: replacement parity and high-trust overlay
- Status: hard constraint
- Primary source: `package/git-policy/cli/src/parser/argv.ts:215-412`, accessed 2026-08-14
- Tests: `package/git-policy/cli/src/parser/argv.unit.test.ts:60-330`
- Consumer source: `package/git-policy/cli/src/parser/commit.ts:188-280` and
  `package/git-policy/cli/src/management-parser.ts:175-265`
- Outcome: requirements frozen before candidate ratings

### Repository performance record R2

- Candidate: incumbent parity baseline at commit `4879a44e6a2460ab3c2531744e24a1f2aef27aeb`
- Claim: discarded per-nonmatch diagnostics caused a measured long-pathspec regression in `@optique/core`
- Relevance: candidate parsing must not repeat that failure shape
- Gate: replacement parity and scored performance concern
- Status: historical evidence, current reproduction pending
- Primary source: commit message and diff for `4879a44e6a2460ab3c2531744e24a1f2aef27aeb`, accessed 2026-08-14
- Counterevidence limit: the recorded 0.89 second result measures the complete wrapper, not parser-only cost or current hardware
- Outcome: benchmark shape retained; historical timings will not be used as candidate scores

## Execution manifests

No candidate code has been installed or executed.
Source clones were created for static inspection only.
Execution manifests will be added after lifecycle scripts, test commands, generated commands, and subprocess boundaries are
inspected.

## Hard-gate outcomes

Pending source, provenance, license, platform, and semantic inspection.

## Validation results

Pending.

## Score arithmetic and sensitivity

Pending finalist validation.

## Pros and cons

Pending equal-depth validation.

## Ranking and recommendation

No recommendation yet.
Recommendation is withheld until every named survivor completes hard gates, source audit, execution validation, scoring,
and sensitivity analysis.

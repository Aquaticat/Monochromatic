# Technology vet: unified linter configuration deep merge

Status:
 complete.
Lifecycle phase:
 recommended under the frozen hard constraints;
 discovery saturated,
 every crate failed HC1 at validation,
 and the only survivor is the in-linter baseline function
 ("Recommendation").
One hard-constraint reading is unresolved and could change the candidate set
 ("Unresolved preferences").
Not adopted:
 no decision record exists.

Subject:
 unified linter config deep merge.

Decision scope:
 select how `monochromatic-lint` merges the `rules` maps of every configuration block that applies to a linted file,
 in block order,
 with deepmerge-ts default semantics over HCL values parsed by `hcl-edit`:
 a crates.io crate or a function inside the linter.

Start date:
 2026-09-23.

Last updated:
 2026-09-23.

Governing skill:

- Commit `a05818ad70a40e5769a36de669697ba109891b31`
   (last commit touching `.agents/skills/choosing-technology/SKILL.md`;
   `.claude/skills/choosing-technology/SKILL.md` has identical bytes).
- SHA-256 `393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`.

Compatibility fingerprint:
 `61fbaf71d5c58cc8f7d4ee482a037cb4461f950e4c47272b900e54c7f87ed675`.
Fingerprint input and lock tooling:
 `~/temp/agent/deep-merge-vet-2026-09-23/scripts/vet-fingerprint-lock.ts`.

Active audit owner:
 Claude Code session `75bdb615-8f19-477e-94d0-2b3fe90e3c7f` (subagent),
 lock `~/temp/agent/technology-vet-locks/1d0216e1bbd169ba07fa03716a282a5daea8289a75970685769559dcfb95a328.lock`.

Prior compatible report:
 none.
When this audit started,
 no file in `doc/audit/` started with `tech-unified-linter-config-deep-merge-vet-`.
Related:
 [`tech-meow-hcl-front-end-vet-2026-09-17.md`][meow-hcl-vet]
 selected `hcl-edit` 0.9.7,
 which this decision takes as given.

Process deviations recorded up front:

- The report was written after the evidence was collected,
   not created at threshold crossing and updated phase by phase.
  Every command,
   script,
   and output it cites is kept under `~/temp/agent/deep-merge-vet-2026-09-23/`.
- The skill asks for a commit after each phase;
   the request for this audit said "Do not commit",
   so nothing was committed.
- The first compile-timing run was aborted by an SELinux relabel collision
   (a second container mounted the same scratch tree with `:Z`),
   and its partial data was set aside unused
   (`data/timing-aborted-run1.jsonl`);
   every later container used the shared `:z` label.

## Context

Measured or read on 2026-09-23.

- The user decided,
   in round 7 of [`doc/handover/unified-linter.md`](../handover/unified-linter.md),
   that rule settings merge with deepmerge-ts semantics:
   "Use the deepmerge-ts <https://github.com/RebeccaStevens/deepmerge-ts> semantic.
   I assume there is such a crate in Rust too."
- Configuration is HCL,
   parsed with `hcl-edit` 0.9.7,
   in OpenTofu's one-label block form,
   one block per ESLint configuration object (handover,
   "Adopted by the agent from settled answers").
- The user asked to "Prioritize faster compile and iteration times during this early stage" (handover,
   round 4).
- `hcl-edit` was adopted for span-preserving parsing,
   and meow's vet weighted source spans 4 of 5
   ([`tech-meow-hcl-front-end-vet-2026-09-17.md`][meow-hcl-vet],
   SC3).
- The rule-setting shape is still open (round 8:
   always an object,
   an object plus a normalized string shorthand,
   or ESLint's array form).
- The linter ships as one crate,
   published to crates.io and as GitHub release assets for eight targets
   (`.github/workflows/cargo-publish.yml`,
   matrix lines 167 to 186),
   and runs in mise tasks,
   CI,
   and cli-git commit hooks.
- The repository's Rust crates are `LGPL-3.0-or-later` (`package/linter/rust/Cargo.toml:15`).

### Parallel systems in this repository

- The incumbent Rust linter hand-writes its configuration merge:
   `package/rust-module/rust-linter-core/src/config/resolve.rs:381-444`
   concatenates sequences,
   merges maps key by key,
   and replaces a rule's whole setting through `rules.extend(nearer.rules)`.
- The Markdown linter (`package/cli/markdown-lint/src`) has no configuration merge;
   `rg --ignore-case 'merge|deepmerge|extend'` finds only Git LFS attribute strings and `extends Error`.
- No `Cargo.lock` under `package/` names a merge crate;
   `serde_json` and `indexmap` each appear in 12 of the 19 lockfiles.
- No `package.json` in the repository depends on deepmerge-ts.

### Peer linters

GitHub code search `fn deep_merge` in Rust (100 results) found linters that hand-write this merge
rather than depend on a crate:

- oxlint:
   `oxc-project/oxc` `crates/oxc_linter/src/config/settings/mod.rs:158-176`
   (default branch `4e77d59bc02f9218b4bb6b89ca08b4f21dd21380`),
   18 lines over `serde_json` maps;
   arrays and scalars are replaced.
- fallow:
   `fallow-rs/fallow` `crates/config/src/config/parsing.rs:61-78`
   (`58e3bd25b8d1c8269578f4d01a5ea41a9020319a`);
   objects merge,
   arrays and scalars are replaced.
- herb:
   `marcoroth/herb` `rust/herb-config/src/merge.rs:3-41`
   (`595f7ac545e55d3110074b82c48088643b008abd`);
   arrays concatenate only under `include` and `exclude`.

None of the three uses a merge crate,
and none concatenates arrays under every key as deepmerge-ts does.

## Classification

Base category:
 inspectable open-source local technology.

Overlays:

- high-trust execution in a CI runner or hook,
   because the linter runs in CI and in cli-git commit hooks;
- human auditability,
   which that overlay requires;
- multi-platform claim,
   because the linter ships for eight targets.

No candidate has a native,
 Wasm,
 or prebuilt boundary:
 every candidate is Rust source.
No sensitive data crosses the merge.
There is no incumbent dependency,
 so the replacement parity overlay does not apply.

## Frozen hard constraints

- HC1:
   reproduces deepmerge-ts 8.0.2 default `deepmerge(...)` results on every probe case over HCL-shaped values,
   without the linter reimplementing the merge.
  The oracle calls `deepmerge(...blocks)` once over all applying blocks,
   because that is how deepmerge-ts merges several objects.
- HC2:
   every dependency is published on crates.io,
   because the linter is published there.
- HC3:
   license permits distribution inside an `LGPL-3.0-or-later` binary.
- HC4:
   pure Rust that builds for the eight release targets with no C toolchain.
- HC5:
   inspectable source at the audited version.
- HC6:
   no panic on any probe case.

## Frozen soft criteria and weights

Weights are 1 through 5 and were frozen before any rating was assigned.

- SC1,
   weight 5:
   compile-time cost and dependency weight added to the linter.
  Explicit user preference (round 4).
  Rating rubric,
   frozen with the weight,
   on the clean dev-profile build time a candidate adds over `hcl-edit` alone
   (the median over rounds of the candidate's time minus the baseline's in the same round),
   less the noise band:
   4 adds no package;
   3 at most 1 s past the band and no proc macro;
   2 at most 3 s past the band,
   or a proc macro;
   1 more than 3 s past the band,
   or a subsystem unrelated to merging (YAML,
   HTTP,
   regular expressions);
   0 more than 10 s past the band.
  Refrozen after the first sensitivity pass,
   with thresholds unchanged:
   the measure became CPU time from the container's cgroup instead of wall time,
   because other workloads on the host widened the wall-time band ("Compile cost").
- SC2,
   weight 4:
   source spans kept for diagnostics.
  Derived from the adoption of `hcl-edit` for span-preserving parsing,
   meow's SC3 weight of 4,
   and `AGENTS.md` DGT;
   the sensitivity analysis tests weights 1 through 5.
- SC3,
   weight 1:
   maintenance and release health.
- SC4,
   weight 1:
   human auditability of the code the linter trusts for merge semantics.
- SC5,
   weight 1:
   integration fit with the `hcl-edit` value tree.

Maximum:
 `5 * 4 + 4 * 4 + 1 * 4 + 1 * 4 + 1 * 4 = 48` points.

## Unresolved preferences

- UP1,
   n-ary or pairwise:
   deepmerge-ts merges several inputs in one call,
   and that call differs from folding two-input merges block by block
   ("N-ary versus pairwise").
  Every crate found merges two values at a time.
  HC1 as frozen follows the deepmerge-ts call.
  If the user accepts the pairwise fold,
   four crates pass HC1 and the outcome changes
   ("Conditional result under a pairwise HC1").
- UP2,
   asked only under the pairwise reading:
   whether keeping `hcl-edit` spans,
   or adding no dependency,
   is a hard constraint.
  The skill admits a custom implementation only when every existing tool fails a named hard constraint.

## deepmerge-ts default semantics as verified

Source:
 `gh repo clone RebeccaStevens/deepmerge-ts ~/temp/agent/deepmerge-ts-2026-09-23 -- --depth 1`,
 head `17fc99cb2961ae59c41a40f1837d88397b97ad9e` (2026-09-03).
`git diff --stat v8.0.2 HEAD -- src/` is empty,
 so `src/` equals tag `v8.0.2` (`cbfd03b6984e255b16acc5ce1f3e2531ec2030a7`,
 2026-08-21),
 the npm `latest`.
The npm tarball `deepmerge-ts-8.0.2.tgz` has integrity
 `sha512-uqbvqLUMrc6p0MO+WBRtTxY55hmyh94WRwI5a++PZe54X+bfVh59FSN7uWCBCW1CCVjzjnrwzfI8zidE2obMMw==`,
 equal to the registry's `dist.integrity`,
 with an SLSA provenance attestation.
License:
 `BSD-3-Clause`.
Paths in this section are relative to the clone.

1.  One call merges every input together:
     `deepmerge(...objects)` passes the whole list to `mergeUnknowns` once
     (`src/deepmerge.ts:31-35`,
     `106-114`).
2.  Filtering:
     the default `filterValues` removes `undefined` and keeps `null`
     (`src/defaults/general.ts:88-94`;
     `docs/API.md:76`).
    Since 6.0.0,
     "undefined will no longer replace defined values by default" (`CHANGELOG.md:189`,
     `200`),
     and the README example keeps `prop1: "changed"` over a later `prop1: undefined`
     while a key whose only value is `undefined` stays present as `undefined`
     (`README.md:110-133`).
    The round 7 note in the handover that "`undefined` overwrites" is therefore out of date.
    HCL has no `undefined`,
     so this rule never fires for the linter.
3.  Counts:
     no value left returns `undefined` (`src/deepmerge.ts:170-172`);
     one value is returned as it is,
     without cloning (`182-191`).
4.  Depth:
     `maxDepth` defaults to 1000 (`src/deepmerge.ts:145-148`);
     at or past it the last value wins (`178-180`).
5.  Classification (`src/utils.ts:21-43`):
     `null` and every primitive are `NOT`;
     arrays are `ARRAY`;
     records are plain objects,
     meaning prototype `null` or `Object.prototype`,
     or an object whose constructor prototype passes the `isPrototypeOf` check (`119-162`);
     `Set` and `Map` have their own kinds;
     everything else,
     such as `Date` or a class instance,
     is `OTHER`.
6.  Mixed kinds:
     when the first value is `NOT` or `OTHER`,
     or any value's kind differs from the first value's kind,
     the whole list goes to `mergeOthers` and the last value wins whole
     (`src/deepmerge.ts:193-226`,
     two-value path `198-200`,
     three-or-more path `212-216`).
    A record meeting a non-record is therefore replaced by whichever comes later
     (`tests/deepmerge.test.ts:162`,
     `210`,
     `234`,
     `245`).
    No subset of same-kind values is merged when any value differs.
7.  `null` is an ordinary leaf:
     it replaces a record,
     and a later record replaces it (`tests/deepmerge.test.ts:279`,
     `290`).
8.  Records:
     keys are the union of own enumerable string keys and own enumerable symbol keys,
     in first-appearance order (`src/utils.ts:65-85`,
     `95-100`);
     each key is merged over only the records that own it
     (`src/defaults/vanilla.ts:111-120` for two records,
     `144-151` for more;
     ownership test `propertyIsEnumerable` in `src/utils.ts:109-111`).
    Inherited and non-enumerable properties are ignored (`tests/deepmerge.test.ts:504`).
    A `__proto__` key is written with `Object.defineProperty` as an own data property
     (`src/defaults/vanilla.ts:99-105`,
     `166-172`;
     `tests/deepmerge.test.ts:669`),
     so it never changes a prototype.
    JavaScript enumerates integer-like keys first in ascending order,
     which reorders such keys in the output (probe case 30).
9.  Arrays concatenate one level deep with `values.flat()`:
     elements are neither merged nor de-duplicated (`src/defaults/general.ts:152-160`).
10. Sets form a union (`src/defaults/general.ts:170-185`).
    Maps merge by key,
     and the values under one key are merged recursively (`src/defaults/vanilla.ts:189-229`;
     `CHANGELOG.md` 8.0.0,
     "support deep map value merging"),
     so the request's "later winning" for Maps describes releases before 8.0.0.
    HCL has neither kind.
11. Everything else takes the last value (`src/defaults/general.ts:195-204`).

For HCL literals this means:
 strings,
 numbers,
 booleans,
 and `null` are leaves where the last value wins;
 tuples concatenate;
 objects merge key by key;
 and any change of kind among one key's values makes the last value win outright.

### N-ary versus pairwise

The oracle ran both `deepmerge(...blocks)` and the left fold `blocks.reduce((a, b) => deepmerge(a, b))`.
They differ in probe cases 23,
 24,
 and 25:

- case 23,
   blocks set `r` to `"off"`,
   then `{a = 1}`,
   then `{b = 2}`:
   n-ary `{"r":{"b":2}}`,
   fold `{"r":{"a":1,"b":2}}`;
- case 24,
   `{a = 1}`,
   `{b = 2}`,
   `[1]`,
   `[2]`:
   n-ary `{"r":[2]}`,
   fold `{"r":[1,2]}`;
- case 25,
   `null`,
   `{a = 1}`,
   `{b = 2}`:
   n-ary `{"r":{"b":2}}`,
   fold `{"r":{"a":1,"b":2}}`.

The n-ary rule looks at every value one key received across all blocks:
 one change of kind anywhere makes the last value win.
A fold resets at each change of kind,
 so it merges the trailing run of same-kind values.
The two agree whenever that trailing run has one value,
 including every two-block merge.
No binary merge API reproduces the n-ary rule without the caller walking the trees first.
deepmerge-ts has no test for the three-value mixed-kind path;
 the behavior comes from `src/deepmerge.ts:193-226` and the oracle run.

### Consequences for the round 8 rule-setting shape

Measured on the oracle,
 not a recommendation:

- Object settings give ESLint's severity-only behavior:
   `{severity = "error", max = 120, ignore = ["url"]}` then `{severity = "warn"}`
   merges to `{severity = "warn", max = 120, ignore = ["url"]}` (case 19).
- A string shorthand after an object drops the object:
   `{severity = "error", max = 120}` then `"warn"` gives `"warn"` (case 7),
   so a shorthand must be normalized to `{severity = "warn"}` before merging to keep the options.
- ESLint's array form concatenates:
   `["error", {max = 300}]` then `["warn"]` gives `["error", {"max":300}, "warn"]` (case 20).
- Option arrays accumulate across blocks and keep duplicates (cases 2 and 4);
   a later block cannot remove an element.
- `null` survives as a value (cases 11,
   13,
   14,
   16,
   and 32),
   so the linter still has to say what a `null` setting means.

## Discovery protocol

### Frozen query schedule

Source class 1,
 the category registry,
 crates.io (`/api/v1/crates`,
 sort relevance,
 100 per page,
 User-Agent `monochromatic-vet-research`):

1.  free text `deepmerge`,
     `deep merge`,
     `merge json`,
     `merge serde`,
     `merge config`,
     `merge values`,
     `json merge patch`,
     `hcl merge`,
     `layered configuration`;
2.  keywords `merge`,
     `deep-merge`,
     `deepmerge`;
3.  expansion round,
     from taxonomy terms the ledger produced (`coalesce` from figment,
     `provenance` from cfgmatic-merge and usage-config,
     `object merge` from object-merge,
     `merge strategy` from deepmerge's policies):
     free text `object merge`,
     `json deep merge`,
     `merge strategy`,
     `config provenance`,
     `coalesce config`;
     keywords `json-merge`,
     `merging`,
     `config-merge`.

Source class 2,
 the repository host,
 GitHub through `gh`:
 repository searches `deepmerge` (Rust),
 `deep merge` (Rust),
 `merge json` (Rust),
 and `deepmerge-ts` (any language);
 code searches `deepmerge-ts` in Rust files and `fn deep_merge` in Rust files.

Source class 3,
 the broader web:
 "rust crate deep merge serde_json Value concatenate arrays like deepmerge-ts",
 "deepmerge-ts equivalent in Rust crate",
 "rust configuration deep merge arrays append crate layered config provenance spans",
 and "hcl-edit OR hcl-rs merge two HCL bodies deep merge objects rust".

Source class 4,
 this repository:
 `Cargo.lock` and `package.json` files,
 `package/rust-module/rust-linter-core`,
 `package/cli/markdown-lint`,
 `doc/audit/`,
 `doc/decision/`,
 and the handover.

### Recorded queries

Raw records:
 `~/temp/agent/deep-merge-vet-2026-09-23/data/crates-queries-initial.jsonl`
 and `crates-queries-expansion.jsonl`,
 run 2026-09-23 local time (2026-09-24T01:36Z to 01:44Z).
Reported total,
 then rows returned and pages fetched:

- `q=deepmerge`:
   7,
   7 rows,
   1 page,
   exhausted.
- `q=deep merge`:
   1070,
   1000 rows,
   10 pages.
- `q=merge json`:
   5515,
   1000 rows,
   10 pages.
- `q=merge serde`:
   2034,
   1000 rows,
   10 pages.
- `q=merge config`:
   5097,
   1000 rows,
   10 pages.
- `q=merge values`:
   5746,
   1000 rows,
   10 pages.
- `q=json merge patch`:
   892,
   892 rows,
   9 pages,
   exhausted.
- `q=hcl merge`:
   32,
   32 rows,
   1 page,
   exhausted.
- `q=layered configuration`:
   10251,
   1000 rows,
   10 pages.
- `keyword=merge`:
   190,
   190 rows,
   2 pages,
   exhausted.
- `keyword=deep-merge` and `keyword=deepmerge`:
   0 each.
- `q=object merge`:
   2789,
   1000 rows,
   10 pages.
- `q=json deep merge`:
   752,
   752 rows,
   8 pages,
   exhausted.
- `q=merge strategy`:
   1357,
   1000 rows,
   10 pages.
- `q=config provenance`:
   1813,
   1000 rows,
   10 pages.
- `q=coalesce config`:
   483,
   483 rows,
   5 pages,
   exhausted.
- `keyword=json-merge`,
   `keyword=merging`,
   `keyword=config-merge`:
   0,
   1,
   and 0.

crates.io answers HTTP 400 for page 11 of a free-text search,
 so 10 pages is the provider cap.
6083 distinct crates were seen.
No filter removed a row from the records.
For reading,
 `scripts/screen-pages.ts` listed rows whose name or description matches a merge-like pattern (565 crates);
 that pattern hides a crate that merges without saying so,
 and it did hide figment,
 whose description does not mention merging.
The saturation check therefore ran over every row,
 not the filtered view.

### Saturation

`scripts/page-rule.ts` marks the pages where a screening survivor (a candidate promoted to targeted evidence) appears.
Every query was exhausted or reached two consecutive pages that added no survivor before the page cap:

- exhausted:
   `q=deepmerge`,
   `q=json merge patch`,
   `q=hcl merge`,
   `keyword=merge`,
   `q=json deep merge`,
   `q=coalesce config`,
   and the empty keyword queries;
- saturated at pages 2 and 3:
   `q=layered configuration`,
   `q=config provenance`;
- saturated at pages 3 and 4:
   `q=deep merge`,
   `q=merge json`,
   `q=merge config`,
   `q=merge strategy`;
- saturated at pages 4 and 5:
   `q=merge serde`,
   `q=object merge`;
- saturated at pages 6 and 7:
   `q=merge values`.

After a saturating pair,
 only already-known survivors appeared (figment on page 5 of `q=merge values`;
 tanzim,
 cfgmatic-merge,
 and tanzim-merge on pages 4,
 5,
 and 7 of `q=config provenance`).
Relevance ranking therefore places known survivors late,
 and a survivor past page 10 cannot be ruled out;
 the skill's rule was met before the cap,
 so the class is recorded as saturated,
 with that limit stated.

GitHub repository searches returned 1,
 6,
 5,
 and 4 repositories,
 each below one page,
 so exhausted.
Web searches surfaced `object-merge`,
 `cfgmatic-merge`,
 `usage-config`,
 `k8s-openapi`'s `DeepMerge` trait,
 and `ts-merger`.

Terminal discovery result:
 saturated,
 with 20 serious alternatives promoted to targeted evidence plus the in-linter baseline.

## Candidate ledger

### In-linter baseline

- Source:
   class 4 (the incumbent hand-writes its merge,
   and so do oxlint,
   fallow,
   and herb).
- Category:
   a function in the linter over borrowed `hcl-edit` expressions,
   77 non-blank,
   non-comment lines in the probe
   (`~/temp/agent/deep-merge-vet-2026-09-23/probe/rust/baseline/src/main.rs`,
   from `MAX_DEPTH` through `merge_records`).
- Screening:
   survivor;
   eligible only if every crate fails a named hard constraint.

### `deepmerge` 0.1.0 and `deepmerge-derive` 0.1.0

- Source:
   class 1 (`q=deepmerge`),
   named in the request.
- Metadata:
   published 2025-09-10,
   `MIT OR Apache-2.0`,
   497 downloads,
   0 reverse dependencies,
   no release in the past year,
   repository `jdx/deepmerge`.
- Screening:
   survivor.

### `figment` 0.10.19

- Source:
   named in the request;
   class 1 rows (`q=merge json` page 2) hidden by the reading filter.
- Metadata:
   published 2024-05-17,
   `MIT OR Apache-2.0`,
   39426765 downloads,
   514 reverse dependencies,
   no release in the past year.
- Screening:
   survivor.

### `cfgmatic-merge` 5.0.1

- Source:
   class 1 (`q=deep merge` page 2) and class 3.
- Metadata:
   published 2026-04-12,
   `MIT OR Apache-2.0`,
   790 downloads,
   4 reverse dependencies,
   14 releases in the past year,
   repository on `gitlab.opentc.ru`.
- Screening:
   survivor.

### `rskit-codec` 0.2.0-alpha.3

- Source:
   class 1 (`q=deep merge` page 1).
- Metadata:
   published 2026-08-02,
   `MIT`,
   1380 downloads,
   1 reverse dependency,
   pre-release,
   repository `kbukum/rskit`.
- Screening:
   survivor.

### `json_value_merge` 2.0.1

- Source:
   class 1 (`q=merge json` page 1) and class 3.
- Metadata:
   published 2025-01-10,
   `MIT OR Apache-2.0`,
   3592561 downloads,
   18 reverse dependencies.
- Screening:
   survivor.

### `merge-struct` 0.1.0

- Source:
   class 1 (`q=deep merge` page 1).
- Metadata:
   published 2022-08-08,
   `Apache-2.0`,
   76211 downloads.
- Screening:
   survivor.

### `serde_json_merge` 0.0.7

- Source:
   named in the request;
   class 1 (`q=merge json` page 1).
- Metadata:
   published 2026-08-26,
   license file with MIT text (crates.io shows "non-standard"),
   52478 downloads.
- Screening:
   survivor.

### `serde_merge` 0.1.3

- Source:
   named in the request;
   class 1 (`q=merge serde` page 1).
- Metadata:
   published 2021-12-30,
   `Apache-2.0`,
   2284845 downloads.
- Screening:
   survivor.

### `config` 0.15.26

- Source:
   named in the request;
   class 1 (`q=layered configuration` page 1).
- Metadata:
   published 2026-09-21,
   `MIT OR Apache-2.0`,
   115471025 downloads,
   1576 reverse dependencies.
- Screening:
   survivor.

### `json-patch` 4.2.0

- Source:
   named in the request for contrast;
   class 1 (`q=merge json` page 1).
- Metadata:
   published 2026-04-30,
   `MIT/Apache-2.0`,
   107842326 downloads.
- Screening:
   survivor,
   pending the RFC 7396 check.

### `tanzim-merge` 0.21.0 with `tanzim` 0.28.0 and `tanzim-value` 0.12.0

- Source:
   named in the request;
   class 1 (`q=deepmerge`).
- Metadata:
   published 2026-07-31,
   `MIT`,
   485 downloads,
   16 releases in the past year;
   `tanzim-value` describes "Located configuration values".
- Screening:
   survivor.

### `merge` 0.2.0 with `merge_derive` 0.2.0

- Source:
   named in the request;
   class 1 (`q=merge values` page 1).
- Metadata:
   published 2025-04-10,
   `Apache-2.0 OR MIT`,
   2886270 downloads,
   35 reverse dependencies,
   repository on sourcehut.
- Screening:
   survivor,
   pending a category check.

### Other serious alternatives read at source

- `feuilletage` 0.1.3 (class 1,
   `q=merge strategy`),
   layered configuration with provenance.
- `serde-toml-merge` 0.3.11 (class 1,
   `q=merge serde`).
- `merge-yaml-hash` 0.4.0 (class 1,
   `q=merge values`).
- `c4-config` 0.5.0 and `trail-config` 0.5.1 (class 1,
   `q=deep merge`),
   loaders that describe deep merging.
- `usage-config` 6.11.1 (class 1 and class 3),
   layered configuration with provenance.
- `object-merge` 0.1.0-alpha1 (class 3),
   "Traits useful for recursively merging document-like objects".

### Screening exits

Each crate in this subsection left at screening,
 on its registry description,
 with the reason named.

- RFC 7396 merge patch,
   which removes a key on `null` and replaces arrays by specification,
   failing HC1:
   `json-merge-patch`,
   `serde-patch`,
   `jadipa`,
   `babbel_json`,
   `yuuka`,
   `json_merge_patch_gen`.
- Typed struct merging through a trait or derive,
   with no merge for a dynamic value tree (category mismatch):
   `merge2`,
   `conflate`,
   `merg`,
   `merged`,
   `merge-hashmap`,
   `merge-structs`,
   `merge-it`,
   `struct-merge`,
   `combine-structs`,
   `converge`,
   `mergeme_derive`,
   `merge-rs-derive`,
   `optionable`,
   `struct-patch`,
   `schematic`,
   `confique`,
   `tinkr_config`,
   `k8s-openapi` (`DeepMerge` for Kubernetes types).
- Configuration loaders with no public value-tree merge (category mismatch):
   `twelf`,
   `serfig`,
   `confyg`,
   `star-toml`,
   `confy-rs`,
   `kick-rs-config`,
   `config-kit`,
   `stratify`,
   `anycms-config`,
   `mofa`,
   `clapfig`,
   `mogh_config`,
   `merge_config_files`,
   `smart-config`,
   `conflux-config`,
   `imagegen-bridge-config`.
- Other formats or operations (category mismatch):
   `ini-merge` (INI files),
   `conmig` (YAML layering by declared identity),
   `yaml-merge-keys` (the YAML `<<` key),
   `use-config-layer` ("shallow" layering),
   `aura-merge`,
   `suture-merge`,
   `tate`,
   and `weave-core` (three-way merges),
   `automerge` (a CRDT),
   `admerge` (file concatenation),
   `ts-merger` (time-series file aggregation).
- Everything else that matched the reading pattern was a Git,
   PDF,
   media,
   stream,
   iterator,
   sorting,
   or unrelated "layer" crate.

## Targeted evidence

Every crate was read from its published archive,
 downloaded from `static.crates.io` and checked against the SHA-256 the crates.io API reports
 (`scripts/fetch-crates.ts`;
 archives and checksums in `~/temp/agent/deep-merge-vet-2026-09-23/crates/`).
Paths in this section are relative to each archive root.

### Candidates whose source matches deepmerge-ts two values at a time

- `deepmerge` 0.1.0
   (SHA-256 `6753c66c1ac85dcf7bd530e01eadd3e6e099f4ad611254961c00d9385530598e`,
   VCS `5e1dc16e1339625e37c021352fe5ebf59b39567a`):
   `src/handlers/serde_json.rs:52-178` implements `DeepMerge<P>` for `serde_json::Value`;
   under `DefaultPolicy` (`src/policy.rs:489-547`:
   maps `Overlay`,
   sequences `Append`,
   scalars and mismatched kinds `Replace`,
   condition `Always`)
   objects merge recursively,
   arrays append,
   and every other pair takes the right-hand value,
   `null` included.
  The `serde_json` feature needs no proc macro;
   the default `derive` feature adds `deepmerge-derive`,
   2144 lines of proc-macro code by the same author.
- `figment` 0.10.19
   (SHA-256 `8cb01cd46b0cf372153850f4c6c272d9cbea2da513e07538405148f95bd789f3`):
   `src/coalesce.rs:26-35` merges under `Order::Admerge` by recursing into two dictionaries,
   extending two arrays,
   and otherwise taking the incoming value;
   `src/coalesce.rs:37-50` merges maps key by key.
  Its value model has no `null`;
   `null` becomes `Value::Empty` (`src/value/value.rs:27-42`),
   and the probe shows it returns as `null`.
  Each value carries a `Tag` naming the provider that supplied it (`src/value/tag.rs:17`;
   `Figment::find_metadata`,
   `src/figment.rs:819`),
   which gives block-level provenance,
   not byte spans.
- `cfgmatic-merge` 5.0.1
   (SHA-256 `d1cdde51191b5e5eba533343dd853062a5c4c42fe0784e903a35aded2fe08664`):
   with `MergeBehavior::Deep` and `ArrayMergeStrategy::Append`,
   `src/merge.rs:203-257` recurses into objects,
   `263-300` appends arrays,
   and everything else is replaced (`replace_value`,
   line 134).
  The defaults are shallow merging and array replacement (`src/options.rs:31-37`,
   `75-80`),
   so both options must be set.
  `merge_layers_with_report` records the winning layer per JSON pointer (`src/report.rs:180-240`),
   which gives block-level provenance,
   not byte spans.
- `rskit-codec` 0.2.0-alpha.3
   (SHA-256 `8dff062e62250cc3aff68bda2d4a8b7376a96e133fe5f0dcb0ffd5da22ab3cc6`):
   `merge_with` (`src/value/merge.rs:36-72`) recurses into objects,
   concatenates arrays when the caller's per-key closure returns `ArrayStrategy::Concat`,
   and lets the overlay win otherwise.
  A top-level array pair is always replaced (`key.map_or(ArrayStrategy::Replace, ...)`,
   line 61),
   which the linter never reaches because `rules` is an object.
  The merge lives in a codec crate that also depends on YAML (`serde_norway`,
   `unsafe-libyaml-norway`),
   `http`,
   and `bytes`.

### Candidates whose source deviates from deepmerge-ts

- `json_value_merge` 2.0.1:
   an array followed by an object pushes the object into the array
   (`src/lib.rs:150-152`).
- `merge-struct` 0.1.0:
   a later `null` is ignored (`src/lib.rs:96`),
   and an array followed by an object pushes the object (`src/lib.rs:93-95`).
- `serde_json_merge` 0.0.7:
   the default merge never overwrites with `null` (`src/merge/mod.rs:160-161`)
   and pushes any non-array value into an earlier array (`155-158`).
  `merge_by_recursive` accepts a caller policy,
   but that closure is the merge the linter would be writing.
  It depends on `fancy-regex` and turns on `serde_json`'s `preserve_order`.
- `serde_merge` 0.1.3:
   `mmerge` is `left_map.extend(right_map)` on the top level only (`src/lib.rs:20-28`);
   nested objects are replaced.
- `config` 0.15.26:
   `Expression::set` recurses into tables and replaces every other value,
   arrays included (`src/path/mod.rs:149-169`).
- `json-patch` 4.2.0:
   `merge` is RFC 7396;
   `null` removes the key and arrays are replaced (`src/lib.rs:666-683`).
- `tanzim-merge` 0.21.0:
   `DeepMerge` defaults to replacing arrays
   and removes a key whose overlay value is `null` (`src/lib.rs:264-305`,
   lines 274-276 and 290-292);
   array concatenation is available,
   but `null` removal is not configurable.
  Its `LocatedValue` keeps a location per value,
   which was the closest match to span retention found.
- `feuilletage` 0.1.3:
   the default merge replaces arrays (`src/merge.rs:61-120`);
   appending needs a `__toappend` key suffix (`src/value.rs:900-911`),
   which pushes the whole new value as one element.
- `serde-toml-merge` 0.3.11:
   TOML has no `null`,
   and a kind mismatch is an error (`src/lib.rs:67-85`).
- `merge-yaml-hash` 0.4.0:
   only hashes recurse;
   arrays are replaced (`src/lib.rs:140-157`).
- `merge` 0.2.0:
   a trait plus field strategies for structs (`src/lib.rs:161-163`,
   `244-266`);
   `merge_derive` rejects anything but a struct (`src/lib.rs:54-57`),
   and no dynamic value type implements the trait,
   so the linter would write the value merge itself.
- `object-merge` 0.1.0-alpha1:
   `Merge` fills what `self` leaves unspecified from a template (`src/lib.rs:5-10`),
   the opposite direction,
   with no dynamic value type.
- `c4-config` 0.5.0:
   its `deep_merge` is `pub(crate)` and replaces arrays (`src/format/mod.rs:304-317`).
- `trail-config` 0.5.1:
   `merge_values` is private and works on YAML values (`src/config/merge.rs:331`).
- `usage-config` 6.11.1:
   the only merge is a private YAML helper (`src/files.rs:953`).

### Execution-independent checks for the conditional finalists

- HC2:
   every package in each probe's `cargo tree` is on crates.io.
- HC3:
   every license in the four graphs is `MIT`,
   `Apache-2.0`,
   `BSL-1.0`,
   `Zlib`,
   `Unicode-3.0`,
   or `Unlicense`,
   alone,
   in disjunction,
   or (`unicode-ident`) in conjunction,
   all compatible with an `LGPL-3.0-or-later` binary
   (`probe/results/*.tree.txt`,
   `probe/results/metadata-summary.json`).
- HC5:
   all sources read from the verified archives.
- `unsafe`:
   `rg '\bunsafe\b'` finds none in the source of `deepmerge`,
   `figment`,
   `cfgmatic-merge`,
   `rskit-codec`,
   or the baseline;
   `rskit-codec` pulls in `unsafe-libyaml-norway`,
   a translation of libyaml into unsafe Rust.

## Maintenance audit

Sampled 2026-09-23 with `gh` and the GitLab REST API,
 inspecting every issue updated in the last 12 months when there were at most 20,
 and the 10 most recently updated pull or merge requests.

- `deepmerge`
   (`jdx/deepmerge`,
   clone `~/temp/agent/deepmerge-jdx-2026-09-23`):
   2 commits in total,
   both on 2025-09-10 by one author;
   one release;
   no issue ever filed;
   2 pull requests,
   a Renovate onboarding closed unmerged
   and the author's own `chore: set dev profile debug to 1`,
   open since 2026-05-03;
   every CI run failed;
   0 reverse dependencies.
  Classification:
   low-signal tracker in a project whose release fails its own tests;
   no maintenance activity reached a release in the last 12 months.
- `figment`
   (`SergioBenitez/Figment`,
   clone `~/temp/agent/figment-2026-09-23`):
   last commit 2024-09-12,
   last release 0.10.19 on 2024-05-17.
  All 5 issues updated in the last 12 months were read:
   #148 "Maintenance status?"
   holds the only maintainer comment (2026-04-18,
   "I do intend to continue maintaining the crate"),
   and other commenters announced the forks `figment2` and `compote`;
   #139,
   #129,
   and #152 have no maintainer comment;
   #4 is an old closed issue.
  The 10 most recently updated pull requests are 8 open external ones,
   the oldest from 2024-07,
   and 2 closed unmerged;
   one (#116,
   opened 2024-07) carries a maintainer review,
   and none was merged.
  Adoption is the highest of any candidate (39426765 downloads,
   514 reverse dependencies).
  Classification:
   responsive in words,
   inactive in code and releases for two years.
- `cfgmatic-merge`
   (`gitlab.opentc.ru/opentc/rust-cfgmatic`,
   project 19,
   created 2026-02-01):
   the last 10 commits date from 2026-04-12 to 2026-09-14,
   by one author name under two identities (87 and 6 commits),
   plus two merge requests from a second account merged on 2026-09-13,
   from branches named `codex/...`.
  The repository's `main` already bumped to 6.0.0 with breaking changes
   ("feat!:
   make configuration loading deterministic and diagnostics value-free"),
   unreleased;
   crates.io shows 14 releases in the past year,
   and every reverse dependency is another `cfgmatic` crate.
  The issues endpoint returned none,
   and a `git clone` over HTTPS hung.
  Classification:
   active single-maintainer project with frequent breaking majors and no external users.
- `rskit-codec`
   (`kbukum/rskit`,
   clone `~/temp/agent/rskit-2026-09-23`,
   created 2026-04-20):
   42 commits by one author name and 2 by the account `kbukum`,
   plus Dependabot;
   the 10 most recently updated pull requests are self-merged on the day they were opened,
   with one Dependabot update open;
   0 stars;
   pre-release versions only.
  Classification:
   active single-maintainer alpha,
   no external review.
- In-linter baseline:
   no upstream;
   maintained with the linter itself,
   which the user chose to self-maintain (handover,
   round 1).

Maintainer concentration is one person for every crate candidate.

## Execution manifests

Host:
 Linux 7.2.0 x86_64,
 podman.
Scratch root:
 `~/temp/agent/deep-merge-vet-2026-09-23/` (mode 700 parent),
 mounted into containers as `/work`;
 no real home directory,
 no repository mount,
 no credentials.
Every container ran with `--memory 2g --cpus 2`,
 and every build,
 test,
 and probe ran with `--network none`.

### Oracle

- Image:
   `docker.io/library/node:26-slim@sha256:7400141a84821c75c81651e9af3d087895e63b8daa51322f7a734c48ecaddc52`
   (Node 26.8.2).
- Code executed:
   `probe/ts/run.mjs` and the integrity-checked `deepmerge-ts` 8.0.2 `dist/index.mjs`,
   which has no imports and no process,
   filesystem,
   or network access (`rg 'import |require\(|process\.|fetch\('` on the file).
- Command:
   `podman run --rm --network none --memory 2g --cpus 2 --read-only`
   `--volume <scratch>/probe:/probe:ro node /probe/ts/run.mjs`;
   exit 0;
   output `probe/oracle.jsonl`.

### Rust probes

- Image:
   `docker.io/library/rust:slim@sha256:a2de23e559fd8afd260d22beb00f3987073ea0dcc2ba2646cccdaeda6a62a095`
   (rustc 1.98.1).
- One standalone package per candidate under `probe/rust/`,
   each depending on `hcl-edit =0.9.7`,
   `serde_json 1` (except the baseline),
   and the candidate pinned exactly;
   the shared input code in `probe/rust/common/` parses `probe/cases.hcl`,
   which `probe/gen-hcl.mjs` writes from `probe/cases.json`.
- Phases (`scripts/probe-cargo.ts`):
   `cargo generate-lockfile && cargo fetch --locked` with network and a private `CARGO_HOME`,
   where no build script runs;
   then `cargo tree`,
   `cargo build --release --offline --locked`,
   and the probe binary,
   all with network off.
- Build scripts that ran,
   read before the build:
   `serde_core`,
   `serde`,
   `serde_json`,
   `zmij`,
   `proc-macro2`,
   `quote`,
   `thiserror` 1 and 2,
   `figment`,
   and `uncased`.
  Each only runs `$RUSTC --version` or a compile probe and writes under `OUT_DIR`
   (`rg 'Command|fs::|env::var'` over each `build.rs`).
- Proc macros that ran:
   `serde_derive` (`cfgmatic-merge`,
   `json-patch`,
   `rskit-codec`,
   `serde_merge`)
   and `thiserror-impl` (`cfgmatic-merge`,
   `json-patch`,
   `serde_merge`).
- Cross-target checks (`scripts/check-targets.ts`):
   an image derived from the same `rust:slim` by `rustup target add` for the seven non-host targets
   (`localhost/deep-merge-vet-targets:1`,
   built with network),
   then `cargo check --offline --locked --target <target>` with network off.
- Upstream suites (`scripts/upstream-tests.ts`):
   `cargo fetch` with network,
   then `cargo test --offline --locked` with network off,
   in each published archive.
  Test graphs:
   `deepmerge` 54 packages with proc macros `darling_macro`,
   `deepmerge-derive`,
   and `serde_derive`;
   `figment` 37 with `clap_derive` and `serde_derive`;
   `cfgmatic-merge` 51 with `serde_derive`,
   `thiserror-impl`,
   and `zerocopy-derive`;
   `rskit-codec` 27 with `serde_derive`
   (`data/upstream-tree-*.txt`).
  Extra dev-dependency build scripts were `libc`,
   `getrandom`,
   `rustix`,
   and `zerocopy`,
   each a compiler probe.
  `deepmerge-derive` (2144 lines) has no `std::fs`,
   `std::process`,
   `std::net`,
   or `std::env` use.
- Timing (`scripts/timing.ts`,
   `scripts/timing-cpu.ts`,
   `scripts/timing-incremental.ts`):
   the same image and limits,
   builds with `--offline --locked` into fresh target directories.

Deviations:

- Fetch phases and the derived image build used the network;
   nothing executed third-party code during them except `cargo` and `rustup`.
- A `git clone` of `gitlab.opentc.ru/opentc/rust-cfgmatic` hung;
   it was stopped by process ID,
   and the GitLab REST API was used for the maintenance audit instead.
- The aborted first timing run is described in "Process deviations recorded up front".

No undeclared command,
 write,
 or network endpoint appeared.

## Validation results

### Probe cases and oracle

`probe/cases.json` holds 33 cases,
 each a list of `rules` maps in block order,
 covering nested objects,
 arrays,
 duplicate and empty arrays,
 object against scalar in both orders,
 object against array in both orders,
 `null` against object,
 scalar,
 and array in both orders,
 scalar replacement,
 the severity-only object override,
 ESLint's array form,
 three and four blocks with and without a change of kind,
 a key absent from a middle block,
 a single block,
 key order,
 integer-like keys,
 and a `__proto__` key.
Every Rust probe parses the same `probe/cases.hcl` with `hcl-edit`,
 so every candidate sees HCL literals,
 not JSON.

Equality is JSON value equality with object key order ignored (`probe/compare.mjs`);
 key order is reported separately.

### Positive controls

The probe was shown able to report a difference before any null result was trusted:
 `config` failed 8 cases,
 `json-patch` 13,
 and `serde_merge` 12,
 each matching its source reading (arrays replaced,
 RFC 7396,
 and shallow merging).

### Results against `deepmerge(...blocks)`

Exact mismatches,
 case by case,
 expected then actual (`probe/comparison.json`):

- In-linter baseline:
   0 of 33.
- `deepmerge` 0.1.0,
   `figment` 0.10.19,
   `cfgmatic-merge` 5.0.1,
   and `rskit-codec` 0.2.0-alpha.3,
   each 3 of 33,
   the same three:
  - case 23:
     expected `{"r":{"b":2}}`,
     got `{"r":{"a":1,"b":2}}`;
  - case 24:
     expected `{"r":[2]}`,
     got `{"r":[1,2]}`;
  - case 25:
     expected `{"r":{"b":2}}`,
     got `{"r":{"a":1,"b":2}}`.
  Each matches the pairwise fold on all 33 cases.
- `json_value_merge` 2.0.1,
   5 of 33:
   cases 23,
   24,
   and 25 as for the four pairwise-exact crates,
   plus case 10,
   expected `{"r":{"a":1}}`,
   got `{"r":[1,2,{"a":1}]}`,
   and case 33,
   expected `{"r":[3]}`,
   got `{"r":[1,2,{"a":1},3]}`.
- `merge-struct` 0.1.0,
   9 of 33:
   cases 10,
   23,
   24,
   25,
   and 33 as for `json_value_merge`,
   plus the `null` cases 11 (expected `{"r":null}`,
   got `{"r":{"a":1}}`),
   13 (expected `{"r":null}`,
   got `{"r":"error"}`),
   14 (expected `{"r":{"list":null}}`,
   got `{"r":{"list":[1]}}`),
   and 16 (expected `{"r":{"a":null}}`,
   got `{"r":{"a":{"b":1}}}`).
- `serde_json_merge` 0.0.7,
   9 of 33:
   the same cases as `merge-struct`,
   except that case 14 gave `{"r":{"list":[1,null]}}`.
- `config` 0.15.26,
   8 of 33:
   cases 2,
   3,
   4,
   5,
   20,
   and 27 replace arrays
   (for example case 2,
   expected `["a","b","b","c"]`,
   got `["b","c"]`;
   case 20,
   expected `["error",{"max":300},"warn"]`,
   got `["warn"]`),
   plus cases 23 and 25.
- `json-patch` 4.2.0,
   13 of 33:
   the six array cases listed for `config`,
   cases 23 and 25,
   and the `null` cases 11,
   13,
   14,
   16,
   and 32,
   where the key disappears (for example case 11,
   expected `{"r":null}`,
   got `{}`).
- `serde_merge` 0.1.3,
   12 of 33:
   cases 1 to 6,
   19 to 22,
   27,
   and 31,
   each needing a merge below the top level,
   for example case 19,
   expected `{"md/line-length":{"severity":"warn","max":120,"ignore":["url"]}}`,
   got `{"md/line-length":{"severity":"warn"}}`.

No candidate panicked or returned an error on any case (HC6).

Key order:
 the baseline keeps first-appearance order,
 as deepmerge-ts does for non-integer keys.
The `serde_json` based candidates sort keys,
 because `serde_json` without `preserve_order` uses a `BTreeMap`,
 except `serde_json_merge`,
 which turns `preserve_order` on.
For integer-like keys (case 30),
 JavaScript orders `"2"` before `"10"` before other keys,
 and the baseline keeps `"10"`,
 `"b"`,
 `"2"`,
 `"a"`;
 the comparison could not see this difference,
 because `JSON.parse` reorders integer-like keys again.

### Spans in the baseline

The baseline returns borrowed `hcl-edit` expressions,
 so every leaf and every concatenated element still answers `Span::span()`.
Case 19 in `probe/results/baseline.jsonl`:
 `md/line-length.severity` resolves to `probe/cases.hcl` line 150 (the second block),
 while `max` and `ignore` resolve to line 147 (the first block).
Case 20 resolves the three concatenated elements to lines 155,
 155,
 and 158.
The `serde_json` candidates receive values converted by `probe/rust/common/to_json.rs`,
 which drops every span.

### Platforms

`cargo check` passed for all eight release targets
 (`x86_64` and `aarch64` Linux GNU and musl,
 macOS,
 and Windows MSVC)
 for the baseline,
 `deepmerge`,
 `figment`,
 `cfgmatic-merge`,
 `rskit-codec`,
 and `json_value_merge`.
Only Linux x64 was executed;
 no macOS or Windows host was available,
 and none of the four crates or the baseline has platform-conditional code in its merge path.

### Upstream suites

- `deepmerge` 0.1.0,
   `cargo test --all-features --no-fail-fast`:
   31 failures in the published release,
   all in the derive and struct-policy paths:
   `prelude_compile_test` 2,
   `proptest_derive` 3,
   `struct_policy_working` 4,
   `typed_attributes` 7,
   `typed_attributes_advanced` 5,
   and 10 doc tests.
  The consumed surface passes:
   `--no-default-features --features std,serde_json --lib --test serde_json_tests`
   gives 29 and 13 passing tests.
  Upstream CI (`gh run list --repo jdx/deepmerge`) failed on all four runs,
   including the release commit `5e1dc16e1` on 2025-09-10.
- `figment` 0.10.19,
   `cargo test --all-features --no-fail-fast`:
   all passed,
   including 142 doc tests.
- `cfgmatic-merge` 5.0.1,
   `cargo test --all-features --no-fail-fast`:
   all passed (15,
   16,
   and 13).
- `rskit-codec` 0.2.0-alpha.3,
   `cargo test --all-features --no-fail-fast`:
   all passed (34 and 1).

No fuzzing or mutation harness exists in `deepmerge`,
 `figment`,
 or `cfgmatic-merge`;
 `deepmerge` has `proptest` suites,
 and the `rskit` repository has a `fuzz/` directory that does not cover the codec's merge
 (`rg --files-with-matches merge` under `fuzz/` returned nothing).

### Compile cost

Clean builds in fresh target directories,
 5 interleaved rounds,
 dev and release profiles,
 wall time inside the container (`data/timing.jsonl`,
 `scripts/timing-summary.ts`).
Other sessions ran four `cargo fuzz` containers on the same host during the rounds,
 so each figure is reported as a median with its range,
 and each candidate is also compared with the baseline built in the same round (paired difference),
 which cancels load that affects a whole round.

Noise band,
 frozen as the largest spread of repeated builds of any single unchanged probe:
 3.52 s for dev builds and 10.52 s for release builds.

Clean dev build,
 median (range),
 then paired added time over the baseline:

- baseline (`hcl-edit` only):
   4.42 s (3.58 to 4.62);
   9 packages.
- `serde_json` reference (`hcl-edit`,
   `serde_json`,
   and the conversion,
   no merge crate):
   5.55 s (3.78 to 6.43);
   +1.20 s;
   13 packages.
- `deepmerge`:
   6.49 s (5.65 to 9.05);
   +2.07 s;
   14 packages,
   no proc macro.
- `json_value_merge`:
   6.77 s (5.15 to 6.88);
   +2.14 s;
   14 packages,
   no proc macro.
- `figment`:
   7.53 s (5.79 to 8.58);
   +3.10 s;
   17 packages,
   no proc macro.
- `cfgmatic-merge`:
   11.32 s (8.50 to 12.02);
   +7.25 s;
   21 packages,
   proc macros `serde_derive` and `thiserror-impl` with `syn`.
- `rskit-codec`:
   12.16 s (9.86 to 13.16);
   +7.74 s;
   27 packages,
   proc macro `serde_derive`,
   plus YAML,
   `http`,
   and `bytes`.

Clean release build,
 median,
 then paired added time:
 baseline 8.20 s;
 `serde_json` reference +2.19 s;
 `deepmerge` +3.39 s;
 `json_value_merge` +3.32 s;
 `figment` +6.40 s;
 `cfgmatic-merge` +8.42 s;
 `rskit-codec` +11.79 s.

Wall time did not separate `deepmerge`,
 `json_value_merge`,
 and `figment` from one another,
 and the first sensitivity pass showed the conditional order hanging on that difference
 ("Sensitivity").
As decisive evidence,
 CPU time was measured from each container's own cgroup (`usage_usec` in `/sys/fs/cgroup/cpu.stat`)
 around a clean dev build,
 3 interleaved rounds (`scripts/timing-cpu.ts`,
 `data/timing-cpu.jsonl`);
 CPU time counts only work inside the container.
Its noise band is 1.13 s.
Median (range),
 then paired added CPU time over the baseline:

- baseline:
   3.60 s (3.58 to 4.72).
- `serde_json` reference:
   6.19 s (6.12 to 6.61);
   +2.53 s.
- `deepmerge`:
   6.17 s (6.07 to 6.39);
   +2.59 s.
- `json_value_merge`:
   6.18 s (5.85 to 6.33);
   +2.59 s.
- `figment`:
   7.82 s (7.52 to 7.85);
   +3.94 s.
- `cfgmatic-merge`:
   11.13 s (11.10 to 11.29);
   +7.54 s.
- `rskit-codec`:
   13.26 s (12.99 to 13.42);
   +9.68 s.

`deepmerge` and `json_value_merge` cost the same as `serde_json` plus the conversion;
 the crates themselves add nothing measurable.
`figment` adds about 1.4 s of CPU time more,
 outside the noise band.

The edit-rebuild loop (`scripts/timing-incremental.ts`,
 3 rounds:
 touch `src/main.rs` after a one-second wait on a warm target directory,
 rebuild,
 and confirm cargo recompiled the probe in 21 of 21 runs)
 took 0.14 s to 0.19 s for every probe,
 apart from one cold 0.64 s baseline run.
The merge choice therefore does not change the edit-rebuild time of the linter's own code;
 it changes clean builds only,
 such as CI,
 a fresh clone,
 or `cargo clean`.

Of the time a `serde_json` based candidate adds,
 about 2.5 s of CPU time is `serde_json` and the conversion,
 which the linter pays anyway if it adopts `serde_json` for its JSONL output;
 that choice is not made yet.

## Hard-gate outcomes

- In-linter baseline:
   passes HC1 (0 of 33 mismatches),
   HC2 (only `hcl-edit`'s graph),
   HC3,
   HC4 (`cargo check` on all eight targets),
   HC5,
   and HC6.
  Survivor.
- `deepmerge`,
   `figment`,
   `cfgmatic-merge`,
   and `rskit-codec`:
   fail HC1 (cases 23,
   24,
   and 25);
   pass HC2 to HC6.
  Exit under the frozen HC1;
   finalists under a pairwise HC1.
- `json_value_merge`,
   `merge-struct`,
   `serde_json_merge`,
   `config`,
   `json-patch`,
   and `serde_merge`:
   fail HC1 under both readings (they mismatch the pairwise fold too).
- `tanzim-merge`,
   `feuilletage`,
   `serde-toml-merge`,
   `merge-yaml-hash`:
   fail HC1 from source (`null` deletion,
   array replacement,
   or no `null`),
   under both readings.
- `merge`,
   `object-merge`,
   `c4-config`,
   `trail-config`,
   `usage-config`:
   no public merge for a dynamic value tree,
   so the linter would reimplement the merge (HC1,
   category mismatch).

Terminal result under the frozen constraints:
 saturated discovery with one survivor.
The skill admits the custom implementation because every existing tool fails HC1.

## Scoring

### Under the frozen HC1

The baseline is the only validated finalist.

- SC1,
   weight 5:
   4,
   high confidence;
   adds no package (`probe/results/baseline.tree.txt` lists only `hcl-edit`'s 9).
- SC2,
   weight 4:
   4,
   high;
   every leaf and every concatenated element keeps its span ("Spans in the baseline").
- SC3,
   weight 1:
   3,
   medium;
   no upstream to decay,
   but the linter owns the function and its tests.
- SC4,
   weight 1:
   4,
   high;
   77 lines in the repository.
- SC5,
   weight 1:
   4,
   high;
   works on `hcl-edit` expressions directly,
   with no conversion.

```text
# doc/audit/tech-unified-linter-config-deep-merge-vet-2026-09-23.md
5 * 4 + 4 * 4 + 1 * 3 + 1 * 4 + 1 * 4 = 47
47 / 48 * 100 = 97.9
```

With one finalist,
 no one-at-a-time test can change an order;
 the 27 tests run by `scripts/score.ts` over `data/ratings-primary.json` confirm that.

### Conditional result under a pairwise HC1

If the user accepts a block-by-block fold of two-value merges (UP1),
 `deepmerge`,
 `figment`,
 `cfgmatic-merge`,
 and `rskit-codec` pass HC1 (0 of 33 against the fold oracle),
 and every other hard constraint,
 so they become the finalists;
 the baseline would then need a named hard constraint that they fail (UP2).
Their ratings (`data/ratings-conditional.json`):

- `figment`:
   SC1 2 (medium:
   +3.94 s of CPU time,
   2.81 s past the band,
   no proc macro);
   SC2 2 (high:
   block-level provenance through `Tag`,
   no spans);
   SC3 1.5 (low-signal range 1 to 2:
   dormant two years,
   highest adoption,
   maintainer's stated intent);
   SC4 1 (medium:
   3958 lines,
   and the merge runs through its own serde value model,
   providers,
   and profiles);
   SC5 2 (medium:
   provider and extraction round trip,
   dictionary-only top level).
- `deepmerge`:
   SC1 2 (medium:
   +2.59 s of CPU time,
   1.46 s past the band,
   all of it `serde_json` and the conversion,
   no proc macro);
   SC2 1 (high:
   no provenance);
   SC3 0.5 (low-signal range 0 to 1:
   the release fails 31 of its own tests,
   CI never passed,
   no activity);
   SC4 2 (medium:
   2024 lines of policy machinery around a 204-line `serde_json` handler);
   SC5 3 (medium:
   one call per block on `serde_json::Value`).
- `cfgmatic-merge`:
   SC1 1 (high:
   +7.54 s of CPU time and proc macros);
   SC2 2 (high:
   winning layer per JSON pointer);
   SC3 1.5 (low-signal range 1 to 2);
   SC4 2 (medium:
   1227 lines);
   SC5 2 (medium:
   both defaults must be overridden,
   and layers carry priorities).
- `rskit-codec`:
   SC1 1 (high:
   +9.68 s of CPU time,
   YAML and HTTP crates);
   SC2 1 (high);
   SC3 1.5 (low-signal range 1 to 2);
   SC4 2 (medium:
   a 47-line merge inside a 711-line codec crate with a same-author dependency);
   SC5 3 (medium).

```text
# doc/audit/tech-unified-linter-config-deep-merge-vet-2026-09-23.md
figment        5 * 2 + 4 * 2 + 1 * 1.5 + 1 * 1 + 1 * 2 = 22.5   22.5 / 48 = 46.9
deepmerge      5 * 2 + 4 * 1 + 1 * 0.5 + 1 * 2 + 1 * 3 = 19.5   19.5 / 48 = 40.6
cfgmatic-merge 5 * 1 + 4 * 2 + 1 * 1.5 + 1 * 2 + 1 * 2 = 18.5   18.5 / 48 = 38.5
rskit-codec    5 * 1 + 4 * 1 + 1 * 1.5 + 1 * 2 + 1 * 3 = 15.5   15.5 / 48 = 32.3
```

For comparison only,
 the baseline scores 47 of 48 under the same weights.

Low-signal endpoints:
 `figment` 22.0 to 23.0 (45.8 to 47.9);
 `deepmerge` 19.0 to 20.0 (39.6 to 41.7);
 `cfgmatic-merge` 18.0 to 19.0 (37.5 to 39.6);
 `rskit-codec` 15.0 to 16.0 (31.3 to 33.3).

## Sensitivity

`scripts/score.ts` runs 53 one-at-a-time tests on the conditional finalists:
 each weight from 1 through 5,
 each medium-confidence rating one step each way,
 and both endpoints of each low-signal range.

First pass,
 with SC1 measured in wall time (`data/ratings-conditional-walltime.json`:
 `figment` and `deepmerge` both SC1 3):
 `figment` 57.3,
 `deepmerge` 51.0,
 `cfgmatic-merge` 38.5,
 `rskit-codec` 32.3,
 and 5 of 53 tests changed the order,
 three of them through the SC1 ratings of `figment` and `deepmerge`,
 whose wall-time difference sat inside the 3.52 s band.
The controlling input was gathered as CPU time ("Compile cost"),
 the rubric was refrozen on that measure,
 and the matrix was rerun.

Second pass (`data/ratings-conditional.json`),
 with the scores in "Conditional result under a pairwise HC1";
 11 of 53 tests change the order:

- SC1 weight 1,
   2,
   or 3,
   and SC3 weight 3,
   4,
   or 5:
   `figment` > `cfgmatic-merge` > `deepmerge` > `rskit-codec`;
- SC4 weight 5:
   `deepmerge` > `figment` > `cfgmatic-merge` > `rskit-codec`;
- SC5 weight 5:
   `deepmerge` > `figment` > `rskit-codec` > `cfgmatic-merge`;
- `figment` SC1 down to 1:
   `deepmerge` > `cfgmatic-merge` > `figment` > `rskit-codec`;
- `deepmerge` SC1 down to 1:
   `figment` > `cfgmatic-merge` > `rskit-codec` > `deepmerge`;
- `deepmerge` SC1 up to 3:
   `deepmerge` > `figment` > `cfgmatic-merge` > `rskit-codec`.

The winner changes with SC4 or SC5 at weight 5,
 when `figment`'s SC1 rating moves down,
 or when `deepmerge`'s moves up;
 the second and third places change with SC1's or SC3's weight.
Settling it needs the user's weights for SC3,
 SC4,
 and SC5,
 which are unspecified,
 and SC1 ratings that sit within one rubric step of a threshold.
The conditional ranking is unstable,
 so under a pairwise HC1 this audit recommends none of the four until those inputs are settled.
Stability does not cover simultaneous changes to several inputs.

## Pros and cons

### In-linter baseline

Pros:

- the only candidate that reproduces `deepmerge(...blocks)`,
   0 of 33 mismatches,
   including the three n-ary cases;
- adds no package,
   so clean builds stay at `hcl-edit`'s cost;
- every merged leaf and array element keeps its `hcl-edit` span,
   so a diagnostic can name the block and line that supplied a bad option;
- 77 lines the repository owns,
   which can follow the round 8 decision
   (for example normalizing a string shorthand into `{severity = ...}` before merging)
   without a fork.

Cons:

- the repository owns its correctness:
   the 33 probe cases must become unit tests,
   and the `maxDepth` path is untested;
- it is custom code,
   admitted only because every crate failed HC1;
- JavaScript's ordering of integer-like keys is not reproduced,
   and deepmerge-ts's `undefined`,
   `Set`,
   and `Map` rules have no HCL counterpart.

### `figment` 0.10.19

Pros:

- matches the pairwise fold on all 33 cases;
- the most adopted of the four conditional finalists,
   and its whole suite passes;
- block-level provenance per value;
- no proc macro.

Cons:

- fails the n-ary cases;
- no commit for two years,
   and none of the latest ten pull requests merged;
- the merge is reached through providers,
   profiles,
   and extraction,
   3958 lines;
- spans are lost,
   and the top level must be a dictionary.

### `deepmerge` 0.1.0

Pros:

- matches the pairwise fold on all 33 cases;
- the lightest graph of the four conditional finalists,
   with no proc macro once `derive` is off;
- its `serde_json` tests pass.

Cons:

- fails the n-ary cases;
- the published release fails 31 of its own tests and its CI has never passed;
- one release,
   no reverse dependencies,
   one maintainer;
- spans and provenance are lost.

### `cfgmatic-merge` 5.0.1

Pros:

- matches the pairwise fold with `Deep` and `Append`;
- records the winning layer per JSON pointer;
- its suite passes.

Cons:

- fails the n-ary cases;
- defaults (shallow,
   replace arrays) are wrong for this use;
- adds 7.54 s of CPU time and two proc macros to a clean dev build;
- one maintainer on a self-hosted GitLab,
   with an unreleased breaking 6.0.0.

### `rskit-codec` 0.2.0-alpha.3

Pros:

- matches the pairwise fold;
- a short,
   readable merge with a per-key array strategy;
- its suite passes.

Cons:

- fails the n-ary cases;
- a pre-release codec crate that brings YAML,
   `http`,
   and `bytes`,
   adding 9.68 s of CPU time;
- one maintainer,
   self-merged pull requests;
- spans are lost.

## Ranking

Under the frozen constraints:

1.  in-linter baseline;
2.  `figment`;
3.  `deepmerge`;
4.  `cfgmatic-merge`;
5.  `rskit-codec`;
6.  `json_value_merge`;
7.  `config`;
8.  `merge-struct`;
9.  `serde_json_merge`;
10. `serde_merge`;
11. `json-patch`.

Adjacent reasons:

- baseline over `figment`:
   the baseline passes HC1 and `figment` fails cases 23 to 25.
- `figment` over `deepmerge`:
   both fail HC1 on the same cases;
   the conditional score is 46.9 against 40.6,
   but four sensitivity tests reverse it,
   so this step is provisional.
- `deepmerge` over `cfgmatic-merge`:
   same HC1 failure;
   40.6 against 38.5,
   reversed when SC1's weight is 3 or less,
   when SC3's weight is 3 or more,
   or when `deepmerge`'s SC1 rating moves down.
- `cfgmatic-merge` over `rskit-codec`:
   38.5 against 32.3,
   reversed when SC5's weight rises to 5.
- `rskit-codec` over `json_value_merge`:
   3 mismatches against 5,
   and `json_value_merge` also fails the pairwise fold.
- `json_value_merge` over `config`:
   5 mismatches against 8.
- `config` over `merge-struct`:
   8 against 9.
- `merge-struct` over `serde_json_merge`:
   both 9;
   `merge-struct` adds 6 packages,
   `serde_json_merge` 14 including a regular-expression engine.
- `serde_json_merge` over `serde_merge`:
   9 against 12.
- `serde_merge` over `json-patch`:
   12 against 13.

The source-only exits and screening exits are unranked;
 each has its exit reason in "Targeted evidence" or "Screening exits".

## Confidence and evidence limits

- HC1 rests on 33 cases chosen before any candidate ran.
  They cover every HCL value kind and every deepmerge-ts branch HCL can reach,
   but they are not exhaustive;
   no property-based comparison was run.
- The oracle is deepmerge-ts 8.0.2;
   a later release could change these semantics,
   and the linter would not follow it automatically.
- Only Linux x64 executed;
   the other seven targets were type-checked,
   not linked or run.
- Compile times were measured while other sessions ran fuzzers on the host;
   wall-time differences below 3.52 s and CPU-time differences below 1.13 s do not order candidates,
   and the SC1 ratings of `figment` and `deepmerge` sit within one rubric step of a threshold.
- crates.io caps free-text searches at 10 pages;
   the saturation rule was met before the cap,
   but relevance ranking placed known survivors past the saturating pages.
- `cfgmatic-merge`'s repository could not be cloned;
   its maintenance evidence comes from the GitLab API.
- The baseline was validated as a probe,
   not as linter code;
   integration with rule option validation is not measured.

## Recommendation

Under the frozen hard constraints:
 write the merge as a function inside `monochromatic-lint`,
 over borrowed `hcl-edit` expressions,
 following the probe's baseline (`probe/rust/baseline/src/main.rs`),
 and port the 33 probe cases with their deepmerge-ts results as unit tests.
No crate reproduces deepmerge-ts:
 every crate found merges two values at a time,
 and four of them match deepmerge-ts only in that pairwise form.
The function adds no package,
 while every crate route adds at least 2.5 s of CPU time to a clean dev build
 (all of it `serde_json` and the conversion for the lightest)
 and drops the spans that `hcl-edit` was chosen for;
 the edit-rebuild loop is the same either way.

Points the port has to settle,
 not measured here:
 reject duplicate keys inside one HCL object (the probe takes the first);
 reject object keys that are not identifiers or string literals,
 and values that are not literals;
 and say what a `null` rule setting means,
 since deepmerge-ts keeps it as a value.
If the user picks the pairwise fold under UP1,
 a function of the same shape would merge the trailing run of same-kind values on a change of kind
 instead of taking the last value;
 that variant was neither built nor probed.

This is a recommendation,
 not adoption.

## Open questions for the user

1.  UP1:
     should several applying blocks merge like one `deepmerge(...blocks)` call (frozen,
     recommended in "Recommendation")
     or like a fold of two-block merges?
    They differ only when one key's values change kind and then continue with two or more same-kind values,
     as in cases 23 to 25.
    Pros of the n-ary rule:
     it is literally deepmerge-ts,
     and one change of kind makes the last setting win whole,
     which is easy to explain.
    Cons:
     it rules out every crate.
    Pros of the fold:
     four crates qualify.
    Cons:
     it is not what deepmerge-ts does with three or more inputs.
    Ranking:
     n-ary over fold,
     because the user chose deepmerge-ts's semantics and the fold changes results the user can observe.
2.  UP2,
     only if the fold is chosen:
     is keeping `hcl-edit` spans,
     or adding no dependency,
     a hard constraint?
    Without one,
     the skill requires choosing among the four crates,
     whose order is not stable yet.
3.  Round 8 is already asked;
     does its answer change once the measured consequences are known?
    An object setting keeps options under a severity-only override,
     a bare string after an object drops them,
     and ESLint's array form concatenates into `["error", {...}, "warn"]`
     ("Consequences for the round 8 rule-setting shape").

[meow-hcl-vet]: tech-meow-hcl-front-end-vet-2026-09-17.md

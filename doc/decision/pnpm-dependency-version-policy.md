# pnpm dependency version policy

## Decision

Use version specifiers according to dependency role.
Do not keep every external dependency on an unbounded `>=` floor,
and do not pin every specifier indiscriminately.

- Put exact versions in the default catalog for private application dependencies
  and build, test, development, and repository tooling dependencies.
- Keep `workspace:*` for internal workspace dependencies.
- Give external runtime dependencies emitted by unbundled published packages
  tested, bounded compatibility ranges.
  Keep these separate from exact workspace-tooling entries when one package needs both roles.
- Give peer dependencies explicit tested compatibility ranges.
  Do not exact-pin peers or treat `*` as a durable compatibility claim.
- Treat overrides as policy constraints rather than ordinary direct dependencies.
  A security floor, compatibility cap, removal, substitution, or audited exact artifact
  should use the narrowest specifier that expresses that constraint.
- Keep committing `pnpm-lock.yaml` and installing it frozen in CI.

This is a policy decision only.
It does not authorize a bulk manifest rewrite without classifying packed package output first.

## Why

Exact catalog values do not materially improve the reproducibility of the current frozen install.
The committed lockfile already records resolved versions,
and pnpm 11.15.1 reported that a frozen dry run across all 143 active workspace projects
would make no changes.

Exact values improve a different boundary:
they prevent a fresh resolution or deliberate lockfile regeneration
from selecting a newer direct dependency until its catalog entry changes.
That matters here because [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml)
sets `resolutionMode: highest` and every default-catalog entry is an unbounded `>=` range.

Ranges still belong at consumer compatibility boundaries.
Pnpm replaces `catalog:` with the catalog's exact specifier during `pnpm pack` and `pnpm publish`.
An exact default catalog therefore becomes an exact downstream runtime dependency
unless publishable packages use a separate compatibility range.

## Repository evidence

Measurements at commit `c30c3a1c3` on 2026-07-23 found:

- 143 active manifests in the root and `package/*/*` workspace set.
- 442 `catalog:` references and 620 `workspace:*` references.
- No direct external exact, caret, or tilde specifiers in those manifests.
- 26 non-catalog peer specifiers, all `*`.
- 137 default-catalog entries, all `>=` floors.
- No Renovate or Dependabot configuration.

The existing [`catalog:tighten`](../../package/dev-script/catalog-tighten/README.md) dry run found:

- 30 installed versions above their declared floors.
- 72 installed versions equal to their floors.
- 6 catalog entries present only transitively.
- 29 catalog entries absent from the active install.

The proposed floor changes included major-version movement,
such as `execa` 9 to 10 and `@tursodatabase/database` 0.6 to 0.7.
This shows that the tool records whichever highest version resolved as a new minimum.
It does not establish that the repository supports the previous minimum,
nor that a published package supports every future major.

The committed [`pnpm-lock.yaml`](../../pnpm-lock.yaml) is the parallel reproducibility mechanism.
CI's [`publish` workflow](../../.github/workflows/publish.yml)
installs with `--frozen-lockfile`.
The workspace also delays new releases for one day,
enforces `trustPolicy: no-downgrade`,
restricts dependency build scripts,
and records tarball URLs.
These controls reduce update and artifact risk,
but they do not turn an unbounded manifest range into an explicit upgrade decision.

The current publish workflow's extant npm targets do not declare third-party catalog runtime dependencies.
That limits immediate downstream impact,
but other non-private packages do declare them and may become publish targets later.
A disposable pnpm 11.15.1 pack probe confirmed that catalog value `>=1.2.3`
was emitted as `>=1.2.3`, while catalog value `4.5.6` was emitted as `4.5.6`.

A targeted search of the catalog tooling and dependency policy files found no relevant
`TODO`, `FIXME`, skipped test, or unexplained suppression that changes this conclusion.
The TypeScript suppressions in `catalog-tighten` are scoped parsing and external-API assertions,
not exceptions to the version policy.

## Options

### Role-aware exact pins and ranges

Pros:

- Every repository dependency upgrade becomes an explicit catalog and lockfile review.
- Fresh resolution cannot silently move direct tooling or private runtime dependencies.
- Published packages retain meaningful consumer compatibility contracts.
- Workspace links and policy overrides keep their distinct semantics.

Cons:

- Every dependency must be classified before migration.
- Exact entries need an owned update process because no dependency updater is configured.
- Published compatibility ranges need lower-bound and boundary testing.

### Keep all catalog entries as unbounded floors

Pros:

- Existing `catalog:tighten` workflow remains unchanged.
- Fresh resolution automatically adopts any version above the floor after supply-chain checks pass.

Cons:

- A lockfile regeneration can cross major versions without a catalog edit.
- Published manifests claim compatibility with untested future majors.
- Tightening from the installed version confuses resolution history with minimum-version support.

### Pin every specifier

Pros:

- The rule is mechanically simple.
- Direct package versions cannot move without manifest edits.

Cons:

- Exact peer dependencies overconstrain hosts.
- Exact published runtime dependencies can force duplicate installations and consumer conflicts.
- Exact `workspace:` replacements or security constraints would erase useful protocol and policy meaning.

Ranking: role-aware policy > current unbounded floors > pin everything.
The role-aware policy ranks first because it improves explicit repository upgrades
without exporting exact pins as universal compatibility contracts.
The current policy ranks above pinning everything because its consumer ranges remain flexible,
even though they are too broad and its update boundary is implicit.

## Migration conditions

Before changing catalog values:

1.  Enumerate actual publish targets and inspect each packed manifest.
2.  Separate exact repository-only entries from published compatibility entries.
3.  Define and test peer and published-runtime support windows.
4.  Replace `catalog:tighten` for exact entries with a stale-version reporter or controlled updater.
    Never derive a claimed compatibility floor only from the installed version.
5.  Add an owned dependency-update cadence or automation that runs the relevant package tests
    and reviews both catalog and lockfile changes.
6.  Regenerate the lockfile through pnpm and verify a frozen install at the consumer boundary.

## Primary pnpm sources

- [Catalogs and publish-time replacement][pnpm-catalogs]
- [Settings: lockfiles, resolution mode, save prefix, release age, and trust policy][pnpm-settings]
- [Install and frozen-lockfile behavior][pnpm-install]
- [Supply-chain guidance][pnpm-supply-chain]

[pnpm-catalogs]: https://pnpm.io/catalogs
[pnpm-install]: https://pnpm.io/cli/install
[pnpm-settings]: https://pnpm.io/settings
[pnpm-supply-chain]: https://pnpm.io/supply-chain-security

# pnpm dependency version policy

## Decision

Keep the current `>=` catalog-floor policy.
Do not migrate the repository's direct dependencies to exact versions.

Use exact catalog entries only as documented exceptions
when one specific artifact is intentionally required.
Before publishing any package with an unbundled third-party runtime dependency,
give that dependency a tested bounded compatibility range.
Keep peer dependencies on tested compatibility ranges rather than exact versions.

This decision supersedes the initial exact-pin recommendation in commit `af0e0e2c6`.
That recommendation overvalued protection during lockfile regeneration
and did not establish a benefit large enough to justify changing the repository's update model.

## Deciding reason

Exact direct-dependency pins do not satisfy a currently unmet requirement.

The committed [`pnpm-lock.yaml`](../../pnpm-lock.yaml) already records exact versions
for direct and transitive dependencies.
CI installs that graph with `--frozen-lockfile`.
Pnpm 11 also verifies the recorded artifact integrity
and fails rather than silently accepting a tarball whose bytes no longer match the lockfile.

Changing catalog entries from `>=x.y.z` to `x.y.z` would therefore install
exactly the same graph during ordinary development and CI.
It would add a second copy of each direct dependency's selected version,
but it would not pin transitive dependencies outside the lockfile.

The one additional protection is narrow:
if the lockfile is deleted or deliberately regenerated,
an exact catalog entry keeps that direct dependency at one version.
Its transitive graph can still move within upstream ranges.
Lockfile deletion or regeneration is already a visible repository change,
and the complete recovery mechanism is restoring or reviewing the committed lockfile,
not partially reproducing it through direct pins.

That partial fallback does not justify changing 137 catalog entries,
replacing the repository's floor-maintenance tool,
and requiring a catalog edit for every direct update.

## Repository evidence

Measurements at commit `c30c3a1c3` on 2026-07-23 found:

- 143 active manifests in the root and `package/*/*` workspace set.
- 442 `catalog:` references and 620 `workspace:*` references.
- 137 default-catalog entries,
   all `>=` floors.
- 26 non-catalog peer specifiers,
   all `*`.
- No Renovate or Dependabot configuration.

A pnpm 11.15.1 frozen dry run covered all 143 workspace projects
and reported that the lockfile was current and a real install would make no changes.
This is the ordinary install boundary exact catalog entries would be expected to improve,
but there was no unresolved version selection at that boundary.

The existing [`catalog:tighten`](../../package/dev-script/catalog-tighten/README.md) dry run found:

- 30 installed direct versions above their declared floors.
- 72 installed direct versions equal to their floors.
- 6 catalog entries present only transitively.
- 29 catalog entries absent from the active install.

Those results do not prove that exact pins are needed.
They show that a deliberate lockfile update selected newer versions
and that the floor-maintenance tool can report the resulting catalog changes.
The installed versions remain fixed by the lockfile until another reviewed update occurs.

[`pnpm-workspace.yaml`](../../pnpm-workspace.yaml) also configures:

- `minimumReleaseAge: 1440` with strict enforcement.
- `trustPolicy: no-downgrade`.
- An allow-list for dependency build scripts.
- Tarball URLs in the lockfile.
- Documented security overrides and package substitutions.

These are the repository's update and supply-chain controls.
Exact direct pins would not replace any of them.

## Publication boundary

Pnpm replaces `catalog:` with the catalog's specifier during `pnpm pack` and `pnpm publish`.
A disposable pnpm 11.15.1 pack probe confirmed that catalog value `>=1.2.3`
was emitted as `>=1.2.3`,
 while catalog value `4.5.6` was emitted as `4.5.6`.

The current publish workflow has 10 configured npm targets.
Seven still correspond to active packages,
and none of those seven declares a third-party runtime dependency through the catalog.
Three configured target names no longer correspond to active package names.
Therefore published third-party runtime ranges are not a present reason
for a repository-wide exact-pin migration.

If an unbundled publish target later gains a third-party runtime dependency,
its packed manifest needs a compatibility review.
An unbounded `>=` range may claim support for an untested future major,
while an exact range may overconstrain consumers and produce duplicate installations.
The correct response is a tested bounded range for that package,
not exact pins for unrelated private and development dependencies.

## Costs of exact pins

A repository-wide migration would:

- Duplicate every selected direct version between the catalog and lockfile.
- Require catalog and lockfile edits for every direct dependency update.
- Remove the current ability to resolve newer eligible direct versions during an intentional refresh.
- Make `catalog:tighten` ineffective for exact entries
  after the repository invested in its parser,
   install-layout support,
   tests,
   and portability work.
- Require a new updater or manual process even though no dependency-update bot is configured.
- Leave transitive update behavior unchanged outside the lockfile.

These costs are concrete.
The proposed gain applies only to an incomplete recovery path after discarding the lockfile.

## Options

### Keep catalog floors plus the frozen lockfile

Pros:

- One complete source of resolved direct and transitive versions.
- Existing update,
   security,
   and `catalog:tighten` workflows remain coherent.
- Intentional refreshes can adopt eligible updates and expose them in one reviewed lockfile diff.
- No additional updater is required.

Cons:

- A lockfile regeneration can select newer direct major versions under `resolutionMode: highest`.
- Future published runtime dependencies require a separate compatibility-range review.

### Exact-pin private and development dependencies

Pros:

- Direct dependencies cannot move during lockfile regeneration until the catalog changes.
- Direct upgrades become explicit in both catalog and lockfile diffs.

Cons:

- Ordinary frozen installs do not become more reproducible.
- Transitive dependencies remain dependent on the lockfile.
- Version data is duplicated and update maintenance increases.
- The existing floor-maintenance workflow must be replaced.

### Exact-pin every dependency role

Pros:

- One mechanically simple authoring rule.

Cons:

- Exact peer dependencies overconstrain hosts.
- Exact published runtime dependencies can cause consumer conflicts and duplicate installations.
- Workspace protocols and policy constraints lose their distinct meaning.
- It still does not replace the transitive lockfile.

Ranking:
 current floors plus frozen lockfile > selective exact direct pins > pin every role.
The current policy ranks first because it already fixes the complete graph
and exact direct pins add only partial lockfile-regeneration protection.
Selective pins rank above pinning every role because documented fragile dependencies
may legitimately require one artifact,
while peers and published compatibility contracts do not.

## Conditions for an exact-pin exception

An exact catalog entry is justified when all of these hold:

1.  A concrete incompatibility or artifact requirement names the accepted version.
2.  A range or compatibility cap cannot express the requirement safely.
3.  The entry carries a comment or linked decision explaining when the pin can be removed.
4.  The lockfile and relevant consumer tests are updated together.

## Primary pnpm sources

- [Catalogs and publish-time replacement][pnpm-catalogs]
- [Settings: lockfiles, resolution mode, release age, and trust policy][pnpm-settings]
- [Install and frozen-lockfile behavior][pnpm-install]
- [Supply-chain guidance][pnpm-supply-chain]

[pnpm-catalogs]: https://pnpm.io/catalogs
[pnpm-install]: https://pnpm.io/cli/install
[pnpm-settings]: https://pnpm.io/settings
[pnpm-supply-chain]: https://pnpm.io/supply-chain-security

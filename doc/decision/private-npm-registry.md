# Private npm registry for workspace packages

## Status

Accepted 2026-09-14.
Owner-authorized during the grilling recorded in `doc/planning/private-npm-registry.md`,
 which keeps the measured facts,
 rejected options,
 and the order in which answers changed.
Extends `doc/decision/npm-publishing.md`;
 public npmjs releases through changesets are unchanged.

## Context

Another owner project,
 `Aquaticat/labwc-config`,
 needs `oxlint-plugin-tsdoc`,
 `config-typescript`,
 and `module-or-throw`,
 which the owner judges below public-release quality.
The owner widened the goal to every workspace package.
On 2026-09-14 the workspace held 154 packages under `package/`,
 120 of them `"private": true`,
 and only `module-logger` and `module-fs-path` release to npmjs.

## Decisions

### Registry: pnpr on the Coolify host

- `@pnpm/pnpr` at npm dist-tag `next`,
   installed by the deployment itself,
   since `ghcr.io/pnpm/pnpr` has no `next` tag.
- Served at `https://pnpr.c.aquati.cat/`,
   behind the owner's self-managed Caddy.
- One hosted npm registry named `monochromatic-dev` claims `@monochromatic-dev/*`.
   There is no npmjs upstream.
- Reads are anonymous;
   publishes need authentication.
- Storage is a Coolify volume with no backup;
   losing historical versions is acceptable,
   and recovery republishes current versions.

### Consumers route only the scope

```ini
# consumer .npmrc
@monochromatic-dev:registry=https://pnpr.c.aquati.cat/~monochromatic-dev/
```

Through this route,
 npmjs-only versions and `@monochromatic-dev/mcp-nvim` are not installable.
pnpm 11 and later delay fresh versions by `minimumReleaseAge`,
 so consumers add `@monochromatic-dev/*` to `minimumReleaseAgeExclude`.

### Published set

- Every workspace package except those under `package/test-fixture/`,
   private ones included.
- A package publishes only if its manifest declares `exports`,
   `main`,
   `module`,
   or `bin`;
   128 packages qualified on 2026-09-14.
- `module-logger` and `module-fs-path` also publish here,
   packed separately from the npmjs release,
   so the same version's tarball bytes can differ between registries.
- A reviewed exclusion list silences packages that cannot build on GitHub-hosted runners.

### Tarball shape

- Packed with pnpm in a clean CI checkout holding no secrets.
- `"private": true` is removed from the packed manifest.
- `./ts` export subpaths are removed,
   the same rule as `doc/decision/npm-publishing.md`.

### Versions change only by manual bumps

- The publish workflow publishes every version pnpr does not have;
   a published version is never overwritten.
- `latest` moves only to a greater version.
- A cli-git commit policy bumps dependents by patch,
   transitively,
   in the same commit as a hand bump.
   An edge counts when the dependent reaches the bumped package through `dependencies`,
    `peerDependencies`,
    or `optionalDependencies`,
   or imports it from non-test source as a bundled `devDependency`.
- The changesets `version` job in `npm-release.yml` runs the same ripple before committing the Version Packages pull request.
- No CI backstop catches commits that bypass cli-git.

### Publishing workflow

- A dedicated GitHub Actions workflow on `main`,
   filtered to `**/package.json`,
    the generated pnpr config,
    and the workflow file,
   with `workflow_dispatch` for retries.
- Authentication is pnpr's OIDC workload credential;
   no token is stored.
   pnpr accepts only exact package names for OIDC trust
   (`pnpr/crates/pnpr/src/server/oidc.rs` at pnpm `f38f11e`),
   so the trust config lists every published name.
- The version-missing check reads anonymously,
   because the workload credential cannot read.
- Packages publish in dependency order;
   a build failure blocks that package and its dependents,
   the rest still publish,
   and the run fails naming the package.

### Configuration and deployment

- file-enforcer generates the pnpr config,
   including the package-name list and the exclusion list.
- The deployment lives in a workspace directory under `package/config/`
   and Coolify redeploys it from the public GitHub repository on push.
   A new package's first publish can fail until the redeploy lands;
   a later qualifying run retries it.
- The owner performs the Njalla A record,
   Coolify resource,
   and Caddy site block from `doc/runbook/deploy-pnpr-registry.md`.

### Packaging fix

`oxlint-plugin-tsdoc` moves its bundled workspace packages to `devDependencies`
 and declares `oxlint`,
 which its declarations import,
 as a peer dependency.

### Verification

From a throwaway consumer:

- Anonymous install and use of `oxlint-plugin-tsdoc` (loaded by oxlint),
   `config-typescript` (extended by `tsc`),
   and `module-or-throw` (called).
- Install of `module-logger` from pnpr.
- A publish without the OIDC credential is rejected,
   and the workflow's OIDC publish succeeds.

A GitHub issue tracks checking installability of the remaining published packages.

## Consequences

- A hand bump rewrites,
   in the same commit,
   the manifest of every dependent reached through runtime or bundled edges.
- pnpr is alpha software tracked through `next`,
   so any Coolify rebuild can pick up breaking changes.
- Each consumer adds the scope route itself;
   nothing here wires `labwc-config`.

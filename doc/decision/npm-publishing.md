# npm publishing for workspace packages

## Status

Accepted 2026-09-06.
Owner-authorized during the module-logger release grilling recorded in
`doc/planning/module-logger-release.md`.
Supersedes the "bundle private helpers into public artifacts rather than publishing them"
direction in `doc/handover/cli-git-policies-platform.md` and the framing of issue #338.

## Context

No package under `@monochromatic-dev` has ever been published to npm.
Five public manifests depend on the private `module-logger`,
so any of them published as-is would point consumers at a package that does not exist.
The old direction was to bundle the logger into each consumer's artifact.
That leaves the `dependencies` entries in place,
which pnpm rewrites to a version nobody can install,
and it makes every consumer carry a private copy of shared code.
Publishing the shared modules is the direction that scales.

## Decisions

### Publish shared modules; module-logger goes first

`module-logger` is the first package released,
as groundwork.
Its consumers in `module-test`,
`module-toml-edit`,
and `dev-script-watch-restart` keep working through workspace links;
`module-test` stays blocked on the private `module-fs-path` until that package gets the same treatment.

### Versioning and publishing tool: changesets

`@changesets/cli` with the `changesets/action` sub-actions,
vetted in `doc/audit/tech-changesets-release-tooling-vet-2026-09-06.md`.
Alternatives discovery was waived by the owner;
the fallback if changesets fails at the publish boundary is a hand-run publish from a pnpm-packed tarball.
`.changeset/config.json` is written by hand (`changeset init` is interactive with no flag),
with `access: public`,
`baseBranch: main`,
and every other option at its default,
so private packages are neither versioned nor tagged.

### Authentication: trusted publishing, never a stored token

npm trusted publishing (OIDC) authenticates every CI publish.
No `NPM_TOKEN` secret exists or will be created;
npm's own access-token guidance steers CI publishing away from Bypass-2FA tokens,
and `gh secret list` confirms none is stored.
Only the publish job holds `id-token: write`.

### Bootstrap: the first publish of each package is local and interactive

`npm trust` requires the package to already exist on the registry,
so trusted publishing cannot bootstrap.
The first version of each package is packed with `pnpm pack` (which rewrites `workspace:` specifiers and applies `publishConfig`)
and published with `npm publish <tarball> --access public` with provenance disabled,
authenticated by the owner's one-time password.
Immediately afterwards `npm trust github` registers the release workflow.
That first version has no provenance;
every later version does.
Runbook:
`doc/runbook/publish-npm-package-first-time.md`.

### The never-run `publish.yml` is deleted

It authenticated with a token that does not exist,
had no build step,
and listed ten packages nobody had readiness-checked.
The changesets release workflow replaces it.
Issue #307 closes by construction;
issue #306's build and tarball checks move to the release workflow.

### Published surface is the built artifact; `./ts` is stripped at publish

Node refuses `.ts` files under `node_modules`,
so a published `./ts` subpath serves bundler users only and is never exercised by this repo's tests.
`publishConfig.exports` overrides `exports` at publish time without the `./ts` entries;
in-repo `/ts` imports are unaffected because workspace links read the real `exports` field.
Workspace dependencies that the dist bundles move to `devDependencies`.

### Test files ship; compiler state does not

Test files stay in tarballs (mixed ecosystem practice:
zod and pino ship them,
fast-check does not).
`tsconfig.tsbuildinfo` leaves every tarball by redirecting `tsBuildInfoFile` outside `dist/final` in the shared TypeScript config.

### Runtime floor: `engines.node >=24`

Built artifacts call `Error.isError`,
which arrived with V8 13.6 in Node 24.0.0.
Declaring the floor beats a polyfill:
a Node 22 consumer fails at install with a clear message instead of at the first caught error.

### First version 0.1.0

Produced by a `minor` changeset from 0.0.1.
Caret ranges on 0.x treat every minor as breaking,
which matches the state of the contract.

## Consequences

- Public packages may depend on published workspace modules;
   the graph check proposed in issue #338 should reject only edges to packages still marked private.
- Every first publish is a manual owner step;
   every later publish is a merged "Version Packages" pull request.
- Consumers outside the workspace get the built artifact only.

# JSR upstream bugs

This project does not file or track JSR (`npm.jsr.io`, `jsr.io`) bugs as GitHub
issues, and does not invest in local workarounds for upstream JSR defects.

## Why this is out of scope

The workspace does not consume JSR-hosted packages. `PHILOSOPHY.tool-choices.md`
records the tool-selection decision under "Package registry: npm only, no JSR,
no GitHub deps"; this file covers the corresponding *issue-tracking* policy.

Once a registry is not in our dependency graph, its bugs cannot affect a build,
test, or deploy here. Filing tracking issues against JSR defects produces issue
clutter without changing any local outcome.

Three concrete defects motivated the original tracking; each is moot now that
the project does not pull from JSR:

- `npm.jsr.io` returns **502 Bad Gateway** on conditional GET (any request with
  `If-None-Match`). Tracked upstream at jsr-io/jsr#1323; only matters for
  package managers that send conditional headers from their HTTP cache.
- `npm.jsr.io` does not implement the version-specific packument endpoint
  (`GET /<package>/<version>`); only the full packument is served. Affects any
  package manager that prefers the per-version endpoint (vlt, others).
- Transitive contamination: npm packages published from JSR can embed
  `@jsr/*` transitive dependencies, which only resolve with explicit JSR scope
  routing configured in the package manager.

## What we do instead

- **For tool selection**: `PHILOSOPHY.tool-choices.md` is the canonical source;
  it lists npm-equivalent versions for JSR-hosted packages we used to import
  (`@optique/*`, `valibot`, `@cspotcode/outdent` aliased to `outdent`, etc.).
- **For historical record of the defects**: `TROUBLESHOOTING.jsr.md` and
  `TROUBLESHOOTING.vlt-jsr.md` retain the source-trace notes. Both carry a
  historical-context header noting the workspace no longer consumes JSR.
- **For new dependencies**: pick npm-registry sources; reject any candidate
  whose only distribution is JSR, or whose npm publication still pulls
  `@jsr/*` transitives.

## Examples of this category

The following local tracking issues were closed as out-of-scope per this policy:

- `#161` Track upstream JSR 502 on conditional GET (jsr-io/jsr#1323) for
  `bun install`

## Exception

If the workspace ever adopts a JSR-hosted package (no npm alternative, no
acceptable substitute), revisit. The trigger is a concrete dependency need
unmet by npm, not an upstream JSR improvement.

## Re-evaluation

If JSR ever becomes the only viable source for a tool the workspace depends on,
revisit by re-opening `PHILOSOPHY.tool-choices.md` first; tool-selection drives
the issue-tracking policy, not the other way round.

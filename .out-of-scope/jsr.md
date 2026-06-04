# JSR upstream bugs

This project does not file or track JSR (`npm.jsr.io`, `jsr.io`) bugs as GitHub
issues, and does not invest in local workarounds for upstream JSR defects.

## Why this is out of scope

The workspace does not choose JSR as a first-party package source.
`PHILOSOPHY.tool-choices.md` records the tool-selection decision under
"Package registry: npm only, no JSR, no GitHub deps"; this file covers the
corresponding issue-tracking policy.

A transitive dependency edge that an npm-published package routes through
`npm.jsr.io` is not direct workspace adoption of JSR. That edge belongs to the
selected npm package's dependency graph. If it causes a concrete local problem,
track or fix the selected npm package, replace that package, or patch that
package. Do not open standalone local tracking issues for the JSR service unless
the workspace deliberately starts selecting JSR-hosted packages itself.

Standalone JSR registry bugs are therefore not useful local GitHub issues. They
describe an upstream registry this workspace has not selected as a package
source; tracking them locally creates issue clutter unless a specific selected
npm package needs dependency work.

Three concrete defects motivated the original tracking; each remains out of
scope as a standalone JSR issue:

- `npm.jsr.io` returns **502 Bad Gateway** on conditional GET (any request with
  `If-None-Match`). Tracked upstream at jsr-io/jsr#1323; only matters for
  package managers that send conditional headers from their HTTP cache.
- `npm.jsr.io` does not implement the version-specific packument endpoint
  (`GET /<package>/<version>`); only the full packument is served. Affects any
  package manager that prefers the per-version endpoint (vlt, others).
- Transitive npm-proxy edges: npm packages can embed `@jsr/*` transitive
  dependencies that resolve through JSR's npm compatibility bridge. Treat these
  as properties of the selected npm package, not as direct workspace dependence
  on JSR.

## What we do instead

- **For tool selection**: `PHILOSOPHY.tool-choices.md` is the canonical source;
  it lists npm-equivalent versions for JSR-hosted packages we used to import
  (`@optique/*`, `valibot`, `@cspotcode/outdent` aliased to `outdent`, etc.).
- **For historical record of the defects**: `TROUBLESHOOTING.jsr.md` and
  `TROUBLESHOOTING.vlt-jsr.md` retain the source-trace notes. Both carry a
  historical-context header noting the workspace no longer selects JSR as a
  first-party package source.
- **For npm packages with `@jsr/*` transitives**: record the finding against the
  selected npm package when it matters locally. Replacement, patching, or package
  selection handles that dependency edge; JSR upstream tracking does not.

## Examples of this category

The following local tracking issues were closed as out-of-scope per this policy:

- `#161` Track upstream JSR 502 on conditional GET (jsr-io/jsr#1323) for
  `bun install`
- `#157` Track upstream JSR and vlt fixes for version-specific manifest
  endpoint 404 (vlt aspect mooted by the vlt-to-pnpm migration)

## Exception

If the workspace ever adopts a JSR-hosted package as a first-party dependency
(no npm alternative, no acceptable substitute), revisit. The trigger is a
concrete dependency need unmet by npm, not an upstream JSR improvement.

## Re-evaluation

If JSR ever becomes the only viable first-party source for a tool the workspace
depends on, revisit by re-opening `PHILOSOPHY.tool-choices.md` first;
tool-selection drives the issue-tracking policy, not the other way round.

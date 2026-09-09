# Rolldown import-attributes upstream status

This note assesses the public status of
[`rolldown/rolldown#2758`](https://github.com/rolldown/rolldown/issues/2758)
as of 2026-09-09.
It answers whether another project blocks the issue,
why the requested behavior remains incomplete,
what upstream work exists,
and whether a donation would change delivery.

## Verification basis

The evidence is primary:
the issue and its event timeline,
linked issues and pull requests,
the current Rolldown source at commit
[`9704b565076baf57b3703c98ebde973855506a68`](https://github.com/rolldown/rolldown/commit/9704b565076baf57b3703c98ebde973855506a68),
the project roadmap,
the contribution guide,
the team page,
the sponsor page,
and VoidZero's company announcement.

GitHub API queries supplied counts and relationship directions.
The relevant checks were:

```sh
gh issue view 2758 --repo rolldown/rolldown --json body,comments,labels,assignees,milestone
gh api repos/rolldown/rolldown/issues/2758/timeline --paginate
gh search prs '"import attributes"' --repo rolldown/rolldown --state open --limit 100
gh issue list --repo rolldown/rolldown --state open --assignee shulaoda --limit 100
gh search prs --repo rolldown/rolldown --author shulaoda --created '>=2026-07-01' --limit 100
```

**Evidence limit:**
GitHub cannot show private planning,
unpushed branches,
or how a company allocates employee hours.
Consequently,
"no public implementation pull request" is supported;
"nobody has started privately" is not.

## Current answer

The issue is not publicly blocked by another upstream dependency.
GitHub's dependency events run in the opposite direction:
`#2758` is recorded as blocking five open requests,
covering import bytes,
import text,
CSS import attributes,
Vite `resolveId` attributes,
and Vite `ModuleInfo.attributes`
([dependency timeline](https://github.com/rolldown/rolldown/issues/2758)).
No `blocked_by_added` event appears on `#2758`.

The public blocker is prioritization followed by unresolved feature scope.
A maintainer said on 2024-11-17 that the feature was on the timeline but not high priority,
and the issue remained labeled `on hold: awaiting more feedback`
until 2026-08-22
([issue thread](https://github.com/rolldown/rolldown/issues/2758#issuecomment-2481138757)).
The original request proposed merely ignoring attributes for bundled JSON imports.
The current title says "Support import attributes properly",
and linked requirements now include loader selection,
module identity,
plugin-hook data,
`ModuleInfo.attributes`,
text,
bytes,
and CSS
([Rolldown `#10407`](https://github.com/rolldown/rolldown/issues/10407),
[Vite `#14674`](https://github.com/vitejs/vite/issues/14674),
[Vite `#15411`](https://github.com/vitejs/vite/issues/15411)).

The status changed materially in 2026.
On 2026-03-17 the team assigned the `1.2` milestone and `scope: standards` label.
Its 2026 Q3 plan explicitly lists import attributes among the Vite 7 to Vite 8 migration blockers
and assigns that work area to `@shulaoda`
([Q3 plan](https://github.com/rolldown/rolldown/issues/10042)).
On 2026-08-22 the team removed the hold label and assigned `@shulaoda` to `#2758`;
on 2026-09-08 it renamed the issue to add "properly"
([issue timeline](https://github.com/rolldown/rolldown/issues/2758)).
As of the verification date,
there is still no open pull request whose title or body publicly identifies itself as implementing `#2758`
([open pull-request search](https://github.com/rolldown/rolldown/pulls?q=is%3Apr+is%3Aopen+%22import+attributes%22)).

## Work that has happened

The issue page understates nearby implementation work because the merged pull requests did not close or consistently reference `#2758`.

- [`#5794`](https://github.com/rolldown/rolldown/pull/5794),
  merged 2025-08-19,
  added an `ImportAttribute` representation and stored attributes per import record.
- [`#9796`](https://github.com/rolldown/rolldown/pull/9796),
  merged 2026-06-17,
  preserved attributes when rendering an external `export *`.
- [`#10479`](https://github.com/rolldown/rolldown/pull/10479),
  merged 2026-07-28,
  fixed two-argument dynamic imports that pointed at nonexistent output chunks.
  Its description explicitly calls meaningful bundled-module attributes,
  loader selection,
  per-attribute module identity,
  and conflict warnings a separate and larger change.

Those changes provide plumbing and correct adjacent output behavior,
but they do not implement the local use case.
At current `main`,
the scanner records a static import's `with` clause in `import_attribute_map`
but passes `None` for the import record's asserted module type
([`ast_scanner/mod.rs:902-923`](https://github.com/rolldown/rolldown/blob/9704b565076baf57b3703c98ebde973855506a68/crates/rolldown/src/ast_scanner/mod.rs#L902-L923)).
The loader can honor an independently supplied `asserted_module_type`
([`load_source.rs:13-49`](https://github.com/rolldown/rolldown/blob/9704b565076baf57b3703c98ebde973855506a68/crates/rolldown/src/utils/load_source.rs#L13-L49)),
but the scanner does not derive it from `with { type: ... }`.
The public `ResolveIdExtraOptions` still has `custom`,
`isEntry`,
and `kind`,
but no `attributes`
([`plugin/index.ts:223-246`](https://github.com/rolldown/rolldown/blob/9704b565076baf57b3703c98ebde973855506a68/packages/rolldown/src/plugin/index.ts#L223-L246)).

The compatibility test inventory quantifies the unfinished surface.
On 2026-05-19,
the upstream tracker listed nine unsupported esbuild import-attribute tests
and twenty-eight unsupported Rollup import-assertion or import-attribute tests
([compatibility tracker](https://github.com/rolldown/rolldown/issues/8688)).
This inventory predates some adjacent fixes,
so it is evidence of breadth rather than a current pass/fail count.

## Why it has taken this long

The issue was opened on 2024-11-15,
so the verification date is just under twenty-two months later,
not two full years.
The public history divides into two periods:

- From 2024-11-17 through early 2026,
  maintainers explicitly treated it as low priority and awaited more demand
  ([maintainer comment](https://github.com/rolldown/rolldown/issues/2758#issuecomment-2481138757)).
- In 2026,
  Vite 8 migration reports turned it into a roadmap item,
  but the complete requirement had grown beyond ignoring syntax.
  It now crosses loading semantics,
  module graph identity,
  output preservation,
  and Rollup-compatible plugin APIs
  ([Q3 plan](https://github.com/rolldown/rolldown/issues/10042),
  [`#10407` maintainer discussion](https://github.com/rolldown/rolldown/issues/10407#issuecomment-5065977136)).

This is not evidence of an idle project.
Rolldown says its team members work full time on the project
([team page](https://rolldown.rs/team)).
On the verification date,
`@shulaoda` had thirty-four open assigned Rolldown issues
([assigned-issue search](https://github.com/rolldown/rolldown/issues?q=is%3Aissue+is%3Aopen+assignee%3Ashulaoda))
and had opened seventy-two Rolldown pull requests since 2026-07-01,
sixty of which were closed or merged
([pull-request search](https://github.com/rolldown/rolldown/pulls?q=is%3Apr+author%3Ashulaoda+created%3A%3E%3D2026-07-01)).
These counts demonstrate competing work;
they do not measure hours or reveal internal priority decisions.

The best-supported capacity reading is therefore:
the team has funded engineering capacity,
but more prioritized work than that capacity can handle simultaneously.
VoidZero itself described its team as "already short-handed" before joining Cloudflare,
while also saying the Cloudflare arrangement lets the team keep focusing on its open-source projects
([VoidZero announcement](https://voidzero.dev/posts/voidzero-cloudflare)).

## Donation assessment

A USD 200 donation would support Rolldown,
but there is no public mechanism that converts it into delivery of `#2758`.
The official GitHub Sponsors recipient is the
[`@rolldown` organization](https://github.com/sponsors/rolldown).
Its stated USD 1,000 monthly goal funds hardware upgrades,
CI,
and testing devices.
The page does not offer issue bounties,
earmarking,
or priority commitments.
The repository contribution guide likewise describes discussion and pull-request paths,
not paid prioritization
([contribution guide](https://rolldown.rs/contribution-guide/)).

`@shulaoda` is the issue assignee and a full-time Rolldown team member,
but no personal GitHub Sponsors program is exposed at
[`github.com/sponsors/shulaoda`](https://github.com/sponsors/shulaoda).
Sending money to a different maintainer would not establish responsibility for this issue.

Therefore:

- If the intent is general project support,
  donate to [`@rolldown`](https://github.com/sponsors/rolldown),
  without expecting `#2758` to move because of that payment.
- If the intent is to purchase this outcome,
  do not treat an unsolicited donation as a bounty.
  First obtain maintainer agreement on the intended semantics and whether they will review a funded contribution.
  The contribution guide requires agreement before coding new features or public APIs
  ([contribution guide](https://rolldown.rs/contribution-guide/)).
  Only then could a separate bounty or contractor arrangement have a defined recipient and deliverable.

## Effect on this repository

[`Aquaticat/Monochromatic#137`](https://github.com/Aquaticat/Monochromatic/issues/137)
is intentionally a tracker.
Its acceptance criteria wait for an upstream release,
and its stated scope excludes forking Rolldown.
The repository already contains
`@monochromatic-dev/rolldown-plugin-import-attributes`
as the workaround.
Consequently,
the limited local activity is expected:
there is no authorized local upstream implementation to perform,
and the cleanup cannot occur until Rolldown supplies equivalent behavior.

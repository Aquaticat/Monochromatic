# Pi dynamic workflows replacement vet report

## Audit metadata

- Status: in progress
- Lifecycle phase: expansion schedule frozen; required GitHub source class blocked
- Subject: `pi-dynamic-workflows` replacement for `@narumitw/pi-subagents`
- Scope: evaluate whether `@quintinshaw/pi-dynamic-workflows` is safe and suitable to replace the installed
  `@narumitw/pi-subagents` Pi extension.
- Start date: 2026-07-10
- Last updated: 2026-07-10
- Governing skill commit: `3b6d1bd6ac0c6eb5704152ddb00e2b69ddcf653b`
- Governing skill SHA-256: `71c50a51d0f0086f789e350ef43824f8aead66435f9ab92d94aae751d16d8359`
- Compatibility fingerprint:
  `d6adb5e5bf6999a490f5b116b145b3fa4318ef611f18bf3d9cad01ff445299f2`
- Active audit owner: current Pi session; harness does not expose a stable session identifier
- Prior compatible report: none found under `docs/audit/`; the related
  `docs/handover/subagent-extension-audit.md` predates this candidate-specific report and does not carry a compatibility
  fingerprint.

## Compatibility fingerprint input

```json
{"baseCategories":["inspectable open-source local technology"],"decisionScope":"Evaluate whether @quintinshaw/pi-dynamic-workflows is safe and suitable to replace the installed @narumitw/pi-subagents Pi extension.","deployment":{"architecture":"x86_64","operatingSystem":"Linux","piVersion":"0.80.6","runtime":"Node 26.5.0"},"hardConstraints":["Complete observable child prompts, progress, tool calls, outputs, status, and errors in user-facing UI","Inspectable open-source execution path with compatible license and mapped build provenance","No ambient credentials or unbounded third-party execution during validation","Parent-set per-subagent timeout including parallel children","Read-only subagent capability enforced by explicit tool allowlist without ambient extensions","Runs on installed Pi 0.80.6 with Node 26.5.0 on Linux x86_64","User can interrupt every running foreground, parallel, and background child from the UI"],"incumbentName":"@narumitw/pi-subagents","incumbentVersion":"0.13.0","overlays":["high-trust execution in an agent extension","human auditability","incumbent dependency replacement"],"schemaVersion":1,"subject":"pi-dynamic-workflows replacement for @narumitw/pi-subagents","trustBoundary":"High-trust Pi extension that launches model agents with repository, filesystem, process, network, and credential-adjacent access."}
```

The fingerprint input uses NFC strings, sorted set-valued arrays, recursively sorted deployment keys, JSON canonical
serialization, and SHA-256 over the exact UTF-8 bytes.

## Context

### Measured deployment

- `/var/home/user/.pi/agent/settings.json` loads `npm:@narumitw/pi-subagents` globally.
- The installed manifest at
  `/var/home/user/.pi/agent/npm/node_modules/@narumitw/pi-subagents/package.json` identifies version `0.13.0`, MIT
  licensing, one runtime dependency on `typebox`, and source repository
  https://github.com/narumiruna/pi-extensions/tree/main/extensions/pi-subagents.
- The running host reports Pi `0.80.6`, Node `26.5.0`, Linux, and `x86_64`.
- The project-level `.pi/settings.json` deliberately contains no package list, so the replacement concerns the global Pi
  workflow rather than project configuration.
- The installed incumbent contains `1,980` physical lines across its TypeScript files, measured with `wc --lines`.
  Code-only size and cloned-source parity remain pending.

### Prior settled requirements

The related audit handover at `docs/handover/subagent-extension-audit.md` records requirements that remain applicable to
this replacement request:

- observable child prompts, progress, tool calls, outputs, status, and errors;
- user interruption for foreground, parallel, and background children;
- parent-selected timeout per child;
- a read-only capability profile;
- source, test, CI, dependency, maintenance, and integration inspection.

The current request names a replacement rather than reopening those requirements, so this audit carries them forward
instead of asking a rubber-stamp question.

### Component classification

- `@narumitw/pi-subagents`: inspectable open-source local technology.
- `@quintinshaw/pi-dynamic-workflows`: inspectable open-source local technology, pending source and artifact provenance
  confirmation.
- Active overlays: incumbent dependency replacement, high-trust agent execution, and human auditability.
- Managed service gate: not applicable because neither compared component is a hosted control plane.
- SaaS historical and operational gates: not applicable for the same reason.
- Proprietary local technology gate: not applicable because both named components publish source under an asserted MIT
  license; the license text and package-source parity still require confirmation.
- Sensitive-data compliance overlay: not separately active because the request sets no residency, retention, or regulated
  data requirement. Credential-adjacent execution remains covered by the high-trust overlay.
- Multi-platform overlay: not active as a hard requirement because the measured deployment is Linux `x86_64`. Any broader
  platform claim made by a finalist will still be checked before receiving score credit.
- Native, Wasm, generated-code, and prebuilt overlays: pending dependency and release-artifact inspection.

## Hard constraints

- Complete observable child prompts, progress, tool calls, outputs, status, and errors in user-facing UI.
- User interruption of every running foreground, parallel, and background child from the UI.
- Parent-set per-subagent timeout, including parallel children.
- Read-only subagent capability enforced by an explicit tool allowlist without ambient extensions.
- Inspectable open-source execution path with compatible license and mapped build provenance.
- Successful execution on installed Pi `0.80.6` with Node `26.5.0` on Linux `x86_64`.
- No ambient credentials or unbounded third-party execution during validation.

## Initial candidate ledger

### `@narumitw/pi-subagents` `0.13.0`

- Discovery source: installed global Pi package and local package lock.
- Base category: inspectable open-source local technology.
- Overlays: incumbent replacement baseline, high-trust agent execution, human auditability.
- Screening result: pending targeted parity audit; retained because replacement parity requires keeping the incumbent.

### `@quintinshaw/pi-dynamic-workflows` `2.12.1`

- Discovery source: user-named candidate; official repository
  https://github.com/QuintinShaw/pi-dynamic-workflows and npm registry record
  https://registry.npmjs.org/@quintinshaw%2Fpi-dynamic-workflows/latest.
- Base category: inspectable open-source local technology.
- Overlays: incumbent replacement candidate, high-trust agent execution, human auditability; native, Wasm, generated, and
  prebuilt status pending.
- Screening result: serious alternative pending hard-gate confirmation. The npm registry reports version `2.12.1`, MIT,
  one runtime dependency on `acorn`, and `100` published files. These are discovery facts, not trust evidence.

### Other alternatives

The prior handover records multiple open-source Pi subagent extensions and a minimal custom design. The frozen discovery
schedule will determine which remain category-fit alternatives for this narrower direct-replacement decision. No custom
implementation can be recommended unless every ready-to-use technology fails a named hard constraint.

## Preliminary evidence limits

- Repository and registry descriptions are promotional or metadata evidence. They do not establish behavior, provenance,
  safety, maintenance quality, or replacement parity.
- The GitHub page currently shows `121` stars, `38` forks, `84` commits, `34` tags, and release `2.12.1` dated 2026-07-10 at
  https://github.com/QuintinShaw/pi-dynamic-workflows. These counts are low-signal discovery context only.
- No candidate recommendation is made at this phase.

## Frozen criteria and weights

Hard gates remain outside arithmetic. Every surviving finalist receives each criterion at equal depth.

- Human auditability and attack-surface concentration, weight `5`: the prior audit explicitly prioritizes clarity and
  human auditability over feature breadth. Measure source lines and files, runtime and same-author dependencies, control
  flow, state and event boundaries, generated code, and where filesystem, process, network, and credentials concentrate.
- Incumbent-path parity, weight `1`: compare single, parallel, sequential, aggregation, custom agent, custom timeout,
  tool-capability, result-delivery, and operator-control paths actually exposed by the installed incumbent.
- Failure handling and lifecycle reliability, weight `1`: inspect timeout, cancellation, descendant cleanup, retry,
  malformed-event, persistence, resume, and concurrent-run behavior.
- Test and validation strength, weight `1`: inspect unit, integration, end-to-end, property, fuzz, mutation, platform,
  coverage, and required CI evidence, then reproduce relevant suites.
- Maintenance and release discipline, weight `1`: measure recent issue and pull-request handling, maintainer-authored work,
  release latency, version alignment, release provenance, and maintainer concentration.
- Resource and cost governance, weight `1`: inspect concurrency, agent-count, token, timeout, process, filesystem, and
  background-run bounds. Unused breadth receives no credit.
- Operator ergonomics beyond hard gates, weight `1`: compare transcript navigation, status detail, error diagnosis,
  steering, persistence visibility, and configuration clarity after the mandatory observability and interruption gates
  pass.
- Migration and reversibility, weight `1`: compare configuration change, agent-definition compatibility, stored state,
  coexistence conflicts, rollback, and whether replacing one tool changes the parent model's orchestration contract.

Each rating uses `0` through `4` and records high, medium, or low confidence. Unspecified priorities retain weight `1`.
The only elevated weight comes from the settled auditability preference. Candidate-specific evidence cannot change these
weights.

Maximum baseline score for every finalist is:

```text
(5 + 1 + 1 + 1 + 1 + 1 + 1 + 1) * 4 = 48
```

## Query schedule and discovery ledger

### Initial frozen schedule

No candidate-specific rating was assigned before this schedule was recorded.

#### npm registry

For each literal query, request results ordered by npm search quality from offset `0` in complete pages of `100`, then
continue until the registry is exhausted or two consecutive complete pages add no screening survivor:

- `pi subagent`
- `pi subagents`
- `pi dynamic workflows`
- `pi workflow orchestration`
- `@narumitw/pi-subagents alternative`
- `pi coding agent multi agent`

Record package name, version, repository URL, publisher, date, keywords, and screening status. A package without a mapped
public source repository fails the inspectability gate.

#### GitHub repositories, topics, code, and releases

For each literal repository query, order by `updated` descending with `100` results per page. Continue until exhaustion or
two consecutive complete pages add no screening survivor:

- `pi-coding-agent subagent in:name,description,readme`
- `pi-coding-agent subagents in:name,description,readme`
- `pi dynamic workflows in:name,description,readme`
- `pi workflow orchestration agents in:name,description,readme`
- `narumitw pi-subagents alternative in:name,description,readme`
- `topic:pi-package subagents`

For candidates discovered from repositories, inspect repository topics, package manifests, releases, organization
projects, and code references before screening promotion.

#### Broader web

Run each literal query through the configured Exa search with Linkup fallback. These providers expose a finite result set
rather than a page cursor in this harness, so record the returned count and complete the schedule at that result set:

- `Pi coding agent subagent extension`
- `Pi coding agent dynamic workflow extension`
- `Pi dynamic workflows alternative`
- `@narumitw/pi-subagents alternative`
- `Pi multi-agent orchestration extension npm GitHub`
- `Pi code mode subagents`

#### This repository and installed system

Run and record these literal local searches without result caps or negative-match filters beyond excluding dependency and
Git metadata where stated:

- fixed string `@narumitw/pi-subagents` across the repository;
- terms `pi-subagents`, `dynamic-workflows`, and `subagent` across `.agents`, `.pi`, `docs`, and manifests;
- candidate reports under `docs/audit/`;
- relevant decisions under `docs/decisions/`;
- parallel orchestration implementations under `packages/pi-plugins/`;
- installed package manifests and lock entries under `/var/home/user/.pi/agent/npm/`.

### Expansion round

The initial web and registry results introduced `taskflow`, `workflow engine`, `interactive subagents`, `code mode`,
`agent swarm`, and `workflow TUI`. The one allowed de-duplicated expansion round is now frozen:

#### npm registry expansion

- `pi taskflow`
- `pi workflow engine`
- `pi interactive subagents`
- `pi code mode subagents`
- `pi agent swarm`
- `pi workflow TUI`

Use the same quality-only ordering, page size, and stop rule as the initial npm schedule.

#### GitHub expansion

- `pi-taskflow in:name`
- `pi-workflow-engine in:name`
- `pi-interactive-subagents in:name`
- `pi-codeMode in:name`
- `pi-swarm in:name`
- `pi-loom in:name`

Use the same updated-descending ordering, page size, and stop rule as the initial GitHub schedule.

#### Broader-web expansion

- `Pi taskflow subagents`
- `Pi workflow engine subagents`
- `Pi interactive subagents extension`
- `Pi code mode subagents extension`
- `Pi agent swarm extension`
- `Pi workflow TUI extension`

No later taxonomy term will add another query.

### Initial query execution

#### npm registry pages

Each request used `size=100`, `quality=1`, `popularity=0`, and `maintenance=0` at
https://registry.npmjs.org/-/v1/search. Returned counts and registry-reported totals were:

- `pi subagent`: pages `1`, `2`, and `3` each returned `100`; total `14,187`.
- `pi subagents`: pages `1`, `2`, and `3` each returned `100`; total `14,068`.
- `pi dynamic workflows`: pages `1`, `2`, and `3` each returned `100`; total `177,682`.
- `pi workflow orchestration`: pages `1`, `2`, and `3` each returned `100`; total `104,204`.
- `@narumitw/pi-subagents alternative`: pages `1`, `2`, and `3` each returned `100`; total `32,042`.
- `pi coding agent multi agent`: pages `1`, `2`, and `3` each returned `100`; total `175,594`.

Every third page still introduced plausible public-source Pi orchestration packages. Examples new at page `3` included
`@kky42/pi-flow`, `pi-conductor`, `pi-workflow-engine`, `pi-agent-workflows`, `@aphotic/pi-mux-subagents`,
`pi-analyst-worker-orchestrator`, `pi-submarine`, `@adamjen/pi-interactive-subagents`, and `pi-fast-subagent`. The page
stop condition was therefore not met.

The initial npm pages also recovered the user-named candidate, incumbent, and prior-audit alternatives including
`pi-subagents`, `pi-crew`, `pi-taskflow`, `pi-swarm`, `pi-multiagent`, `pi-dynamic-workflows`,
`pi-dynamic-workflows-oc-style`, `@johnnywu/pi-subagents`, `@e9n/pi-subagent` through its repository, and
`@the-forge-flow/sub-agents-pi` through prior repository evidence. Numerous metadata-only packages lacked a public source
URL and failed inspectability immediately; examples include `pi-side-agents`, `@lebronj/pi-suite`, and
`@anishthite/pi-better-workflows`.

#### GitHub repository pages

Each request used `per_page=100`, `sort=updated`, and `order=desc` through the GitHub Search API:

- `pi-coding-agent subagent in:name,description,readme`: pages `1` to `3` each returned `100`; total `1,192`.
- `pi-coding-agent subagents in:name,description,readme`: pages `1` to `3` each returned `100`; total `1,195`.
- `pi dynamic workflows in:name,description,readme`: pages `1` to `3` each returned `100`; total `23,764`.
- `pi workflow orchestration agents in:name,description,readme`: pages `1` to `3` each returned `100`; total `12,067`.
- `narumitw pi-subagents alternative in:name,description,readme`: page `1` returned `3`; exhausted.
- `topic:pi-package subagents`: page `1` returned `15`; exhausted.

Using repository name, description, and topics only, the first three pages introduced `49` unique plausible Pi
subagent or orchestration repositories. Page `3` still added plausible repositories, including
`vnedyalk0v/pi-subagent-kernel`, `QuintinShaw/pi-dynamic-workflows`, and
`introspection-recipes/pi-multi-agent-research`, so the two-page no-survivor rule was not met.

GitHub's official current search documentation states that each search returns at most `1,000` results and searches at
most `4,000` matching repositories:
https://docs.github.com/en/rest/search/search?apiVersion=2022-11-28#about-search and
https://docs.github.com/en/rest/search/search?apiVersion=2022-11-28#search-scope-limits. Four frozen queries report
between `1,192` and `23,764` matches. The provider cap arrives before exhaustion, while new plausible candidates still
appear in sampled pages.

#### Broader-web result sets

The configured search returned `10` results for each frozen query, with no include or exclude filters. Across the sets it
found the user-named candidate and alternatives or comparable technologies including:

- `tintinweb/pi-subagents`, `mjakl/pi-subagent`, `jwu/pi-subagents`, `espennilsen/pi`, and the official Pi example;
- `QuintinShaw/pi-dynamic-workflows`, `Michaelliv/pi-dynamic-workflows`,
  `gtnotacoder/pi-dynamic-workflows`, `timbrinded/pi-workflow-engine`, and `heggria/taskflow`;
- `betaHi/pi-loom`, `5queezer/pi-subflow`, `joelhooks/pi-workflow-os`, and `umutbasal/pi-workflows`;
- `Tiziano-AI/pi-multiagent`, `KristjanPikhof/pi-agents-team`, `sandalsoft/pi-fleet`, and
  `Hor1zonZzz/pi-codeMode`;
- `davidsunglee/pi-mux-subagents`, `Whamp/pi-interactive-subagents`, and Catdaemon's subagent package.

These finite result sets are complete for the harness-visible provider response, not evidence that the broader web is
exhaustive.

#### Local source class

The uncapped local searches produced:

- `10` fixed-string incumbent matches across the repository;
- `112` broader subagent or workflow matches in `.agents`, `.pi`, `docs`, and manifests;
- `42` relevant report, decision, and handover paths;
- `854` orchestration-related matches under `packages/pi-plugins/`;
- `100` incumbent package and lock matches under `/var/home/user/.pi/agent/npm/`.

The local source class is exhausted for the frozen paths. The existing implementation at `packages/pi-plugins/spawn/`
and prior `docs/handover/subagent-extension-audit.md` evidence remain parallel-system inputs, not ready-made replacements.

### Discovery status

**Terminal status: blocked by an unenumerable required GitHub source.** GitHub's documented `1,000`-result return cap is
lower than four query totals, and sampled page `3` still adds plausible survivors. npm and independent broader-web
searches expose many additional alternatives but cannot enumerate the GitHub remainder. Exact-name, topic, registry,
web, and local searches are alternate paths already attempted; none proves that the capped GitHub tail contains no
screening survivor.

Under the governing selection workflow, this block forbids a replacement recommendation even if the named candidate's
security audit is otherwise favorable. The named candidate will still receive the requested targeted "funny business"
source and runtime audit; its result is an evidence finding, not an adoption recommendation.

## Evidence records

Pending targeted audits.

## Execution manifests

No third-party command tree has been executed for this report. Clone operations will use `/tmp/agent/`; any install, build,
test, or runtime execution will receive a manifest first.

## Hard-gate exits

None yet.

## Validation results

Pending.

## Score arithmetic and sensitivity

Pending validated finalists.

## Pros, cons, ranking, and recommendation

Pending completion of every applicable gate. Recommendation is deliberately withheld.

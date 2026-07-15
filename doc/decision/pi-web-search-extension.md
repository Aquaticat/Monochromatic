# Pi web search extension

Decision record for which Pi extension to use for web search and page fetching
in the Pi coding agent,
 replacing the currently installed `@aliou/pi-linkup`.

Status:
 no third-party package satisfies the hard constraints;
 decision is to
write our own lean Linkup-only extension.
 Build deferred at the user's request;
when implemented,
 the extension will live as a package in this monorepo under
`packages/` and install into `~/.pi/agent`.
 Build approach (fresh,
 recommended,
versus fork) still to be confirmed at that time.
Date:
 2026-06-18.

## Context-fork answers

- Replace,
   not augment.
   `@aliou/pi-linkup` is already installed (the `linkup`
  skill and the `linkup_web_search` / `linkup_web_answer` / `linkup_web_fetch`
  tools are active in the agent toolset),
   and the user wants to swap it out.
- Backend:
   Linkup only.
   The user holds a Linkup API key and uses no other paid
  search API.
   Candidates that cannot drive Linkup are out of scope.
- Priority:
   lean and auditable.
   This repo weighs human-auditability as a
  selection factor in its own right (see `AGENTS.md`),
   so code volume,
   runtime
  dependencies,
   and architecture shape rank alongside features.
- Hard constraint 1 (webanswer):
   the package must either have no webanswer
  ability at all,
   or expose a way to disable it.
   The user finds Pi's
  webanswer output low quality and does not want it exposed to the model.
- Hard constraint 2 (global blocklist):
   the package must support a global
  blocklist of sites that is always active,
   for example to block
  `badwikipedia.invalid` as a source.
   Per-call exclusion that the model must
  remember to pass does not satisfy this;
   the blocklist must apply to every
  search result and every fetch without per-invocation opt-in.
- Fallback,
   stated by the user before the audit:
   failing either hard
  constraint,
   the decision is to write our own.

The audit below establishes that every surveyed package fails hard constraint
2,
 and several also fail constraint 1 or the leanness priority.
 The fallback
applies.

## Shared upstream risk (non-differentiating)

Linkup (linkup.
so) is the search backend for the chosen direction and for
three of the four finalists.
 It is an opaque SaaS:
 no public record of
ownership,
 funding,
 outage history,
 or a status page was located.
 This is
shared across `pi-search-hub`,
 `pi-web-providers`,
 `pi-websearch-linkup`,
 and
`@aliou/pi-linkup`,
 so it does not differentiate them,
 but it is a real
dependency risk to re-check if Linkup changes ownership or terms.

## Decision

Write our own lean Linkup-only extension.
 No surveyed package satisfies both
hard constraints.

Hard-constraint matrix (citations in the per-candidate audit below):

- `pi-search-hub`:
   no webanswer (C1 satisfied);
   no blocklist of any kind (C2
  fails).
- `pi-web-providers`:
   webanswer disableable via `tools` mapping (C1
  satisfied);
   domain exclusion exists only as a per-call option,
   no global
  default (C2 fails);
   also fails the leanness priority (31458 lines,
   12 heavy
  SDK dependencies).
- `pi-websearch-linkup`:
   no webanswer (C1 satisfied);
   Linkup provider sends no
  domain filter at all and there is no config (C2 fails);
   also wrong harness
  namespace and no public source.
- `@aliou/pi-linkup` (incumbent):
   ships the webanswer the user dislikes with
  no per-tool disable (C1 fails);
   no blocklist (C2 fails).

Recommended build:
 a fresh,
 single-purpose extension with `web_search` and
`web_fetch` tools only (no `web_answer`),
 a global blocklist read from config
and applied to every result and every fetch,
 zero runtime dependencies (the
`typebox` peer only),
 targeting the `@earendil-works/pi-coding-agent` 0.79.
x
harness.
 The Linkup HTTP surface is two endpoints (`POST /v1/search`,
`POST /v1/fetch`),
 so reuse savings from forking are small relative to the
audit surface a fresh build removes.

Alternative build:
 fork `@aliou/pi-linkup`,
 drop the `web-answer` extension
from the package manifest,
 and add the blocklist.
 This reuses the tested
`LinkupClient` (see the incumbent audit) but inherits the `@aliou/pi-utils-ui`
same-author runtime dependency and 1486 lines of code the user would still
carry and trust.
 Confirm fresh versus fork before implementing (see
Follow-up).

## Auditability

The user prioritizes lean and auditable,
 and "write our own" was the stated
fallback,
 so the auditability comparison informed both the rejection of the
feature-rich candidate and the shape of the replacement.

- Code volume.
   `pi-websearch-core` is the leanest (588 lines,
   15 files);
  `@aliou/pi-linkup` is lean (1486 lines,
   17 files);
   `pi-search-hub` is
  moderate (7896 lines,
   45 files);
   `pi-web-providers` is large (31458 lines,
  66 files).
   A fresh build targets roughly 250 to 350 lines.
- Runtime dependencies.
   `pi-websearch-core` has none;
   `@aliou/pi-linkup` has
  one,
   the same-author `@aliou/pi-utils-ui`;
   `pi-search-hub` has two
  (`typebox`,
   `wreq-js`);
   `pi-web-providers` has twelve,
   including
  `@anthropic-ai/claude-agent-sdk`,
   `@google/genai`,
   `openai`,
   `cloudflare`,
  `@mendable/firecrawl-js`,
   `@perplexity-ai/perplexity_ai`,
   `@tavily/core`,
  `exa-js`,
   and `linkup-sdk`.
   Each same-author runtime dependency extends the
  audit beyond the candidate's own repo;
   `pi-web-providers` extends it across
  twelve vendor SDKs.
- Architecture shape.
   `@aliou/pi-linkup` and `pi-websearch-core` are flat and
  linear (one module per concern,
   top-to-bottom control flow).
   `pi-search-hub`
  is flat but multi-backend (17 backends,
   dispatch,
   scoring,
   cache).
  `pi-web-providers` is the most involved:
   per-tool provider routing,
   provider
  resolution,
   capability manifests,
   managed-tools syncing,
   and execution-policy
  defaults,
   requiring the reader to jump across many files to trace one call.
- Security-critical code concentration.
   `@aliou/pi-linkup` groups it into one
  `src/client.ts` plus `src/lib/env.ts`.
   `pi-websearch-core` groups it into
  `src/providers/linkup.ts`.
   `pi-web-providers` spreads credentials,
   network,
  and provider option handling across `src/providers/*`,
   `src/config.ts`,
  and `src/managed-tools.ts`.
- Test evidence.
   `pi-search-hub` has nine test files including `ssrf-guard`,
  `tls-fingerprint`,
   `cache-system`,
   `spillover`,
   and `content-negotiation`.
  `pi-web-providers` has provider tests under `test/` (for example
  `linkup-provider.test.ts`,
   `claude-provider.test.ts`).
   `@aliou/pi-linkup` has
  `client`,
   `env`,
   and `init` tests.
   `pi-websearch-core` has no tests.
   A fresh
  build should add blocklist unit tests with allowed and blocked fixtures.

## Candidate audit

### pi-search-hub (v2.3.3)

Cloned to `/tmp/agent/pi-search-hub-20260618`.

Maintenance:
- Repo `ronnieops/pi-search-hub`,
   22 stars,
   9 forks,
   1 open issue,
   last pushed
  2026-06-11,
   not archived.
   No SPDX license declared on GitHub.
- 16 npm releases between 2026-05-14 and 2026-06-11;
   latest `2.3.3` published
  2026-06-11.
   Very active cadence.
- Issue responsiveness verified:
   issues 12,
   13,
   15,
   16 closed 2026-06-09 to
  2026-06-11;
   PR 14 (Sofya backend) merged.
   Maintainer responsive,
   not just
  active.
- Downloads:
   1559 per month.
- Tests:
   nine `*.test.ts` files including `ssrf-guard`,
   `tls-fingerprint`,
  `cache-system`,
   `spillover`,
   `content-negotiation`,
   `gfm-support`,
  `sibling-probe`,
   `tool-persistence`,
   `parsers`.

Source audit (7896 lines across 45 TypeScript files):
- Registers exactly two tools:
   `web_search` (`extensions/search-hub.ts:67`)
  and `web_read` (`extensions/search-hub.ts:273`).
   No webanswer,
   no research,
  no summarizer,
   no curator.
   C1 satisfied.
- Config type `SearchConfig` (`extensions/types.ts`) exposes `defaultBackend`,
  `combine`,
   `selectionStrategy`,
   `reader`,
   `showStatus`,
   `cacheTtl`,
  `cacheMax`,
   `compact`,
   and a per-backend `BackendConfig` whose fields are
  `enabled`,
   `apiKey`,
   `timeout`,
   `maxResults`,
   `headers`,
   `instanceUrl`,
  `model`,
   `ddgsBackend`,
   `ddgsRegion`,
   `ddgsTimelimit`,
   `tokenBudget`,
  `depth`,
   `baseUrl`,
   `searchDepth`,
   `topic`.
   There is no `excludeDomains`,
  no `blocklist`,
   no domain filter of any kind.
   The `web_search` execute body
  runs backends and formats results without host filtering.
   C2 fails.
- Linkup is one of 17 backends (`extensions/backends/linkup.ts`),
   enabled via
  `backends.linkup`,
   so a Linkup-only configuration is possible.
- Runtime dependencies:
   `typebox`,
   `wreq-js`.
   Peers `@earendil-works/*`,
  matching this harness.

### pi-web-providers (v3.4.0)

Cloned to `/tmp/agent/pi-web-providers-20260618`.

Maintenance:
- Repo `mavam/pi-web-providers`,
   74 stars,
   12 forks,
   MIT,
   2 open issues,
   last
  pushed 2026-06-13,
   not archived.
   Best maintained of the set.
- 20 npm releases between 2026-03-09 and 2026-06-13;
   latest `3.4.0` published
  2026-06-13.
- Issue responsiveness verified:
   issues 22,
   30,
   31,
   32 all closed by maintainer
  `mavam` within the last month;
   external PR 20 (`nateberkopec`,
   lazy secret
  resolution) merged with review.
   Responsive.
- Downloads:
   1362 per month.
- Tests:
   provider tests under `test/` including `linkup-provider.test.ts` and
  `claude-provider.test.ts`.

Source audit (31458 lines across 66 TypeScript files):
- Registers `web_search` (`src/index.ts:399`),
   `web_contents`,
  `web_answer` (`src/index.ts:539`),
   and `web_research`.
- `web_answer` is disableable.
   The `tools` config mapping routes or disables
  capabilities (`src/config.ts` `parseToolProviderMapping`);
   setting
  `web_answer` to `"off"` (`src/index.ts:3402`,
   `3418` branch on
  `value === "off"`) and `registerWebAnswerTool` returning early when no
  single provider is mapped means the tool is not registered.
   README confirms
  tools can be turned off entirely.
   C1 satisfied.
- Domain exclusion is per-call only.
   `excludeDomains` and `includeDomains`
  appear solely as provider option schemas (`src/providers/exa.ts:50,55`,
  `src/providers/tavily.ts:57,62`,
   `src/providers/linkup.ts:86,91,141,146`)
  threaded from `searchOptions` into the Linkup body
  (`src/providers/linkup.ts:372-376`).
   The `settings.search` parser
  (`src/config.ts` `parseSearchSettings`) accepts only `provider`,
   `maxUrls`,
  and `ttlMs` and rejects unknown keys,
   so there is no global default
  exclude list.
   The `web_search` execute passes `params.options` straight
  through with no merge of a configured blocklist.
   C2 fails.
- Runtime dependencies:
   twelve vendor SDKs (`@anthropic-ai/claude-agent-sdk`,
  `@google/genai`,
   `@mendable/firecrawl-js`,
   `@openai/codex-sdk`,
  `@perplexity-ai/perplexity_ai`,
   `@tavily/core`,
   `cloudflare`,
   `exa-js`,
  `linkup-sdk`,
   `openai`,
   `parallel-web`,
   `valyu-js`).
   Fails the leanness
  priority.

### pi-websearch-linkup (v0.2.3)

No public repository.
 Audited from the published npm tarballs extracted to
`/tmp/agent/ws-linkup-extract` (the `pi-websearch-linkup` wrapper) and
`/tmp/agent/ws-core-extract` (its only dependency,
 `pi-websearch-core`).

Maintenance:
- `pi-websearch-linkup`:
   4 npm versions since 2026-03-28,
   latest `0.2.3`
  published 2026-06-10.
   Downloads 205 per month,
   zero dependents.
   Publisher
  `miclivs`.
- `pi-websearch-core`:
   588 lines across 15 files,
   no tests,
   no CI,
   no
  repository,
   no issue tracker.

Source audit:
- The wrapper (`.pi/extensions/websearch-linkup/index.ts`,
   35 lines) registers
  a single `web_search` tool.
   No webanswer.
   C1 satisfied.
- The Linkup provider (`pi-websearch-core` `src/providers/linkup.ts`) POSTs
  to `https://api.linkup.so/v1/search` with a body of `{ q, depth,
  outputType, includeImages }`.
   It sends no `excludeDomains` and the wrapper
  exposes no config at all.
   C2 fails.
- Peer dependencies are `@mariozechner/pi-coding-agent` and
  `@mariozechner/pi-tui`,
   the pre-acquisition namespace;
   this harness runs
  `@earendil-works/pi-coding-agent` 0.79.6,
   so the peers do not resolve
  without a compatibility shim.
- Tarball-only provenance.
   History cannot be inspected,
   future updates cannot
  be obtained,
   and there is no path to file issues.

### @aliou/pi-linkup (v0.11.0, incumbent)

Cloned to `/tmp/agent/pi-linkup-aliou-20260618`.

Maintenance:
- Repo `aliou/pi-linkup`,
   6 stars,
   1 fork,
   0 open issues,
   last pushed
  2026-06-10,
   MIT (per `package.json`).
   Latest `0.11.0` published 2026-05-08.
- Downloads:
   392 per month.
- Tests:
   `client`,
   `env`,
   `init`.
   Vitest.

Source audit (1486 lines across 17 TypeScript files):
- Package manifest declares four extensions:
   `web-search`,
   `web-answer`,
  `web-fetch`,
   `command-balance`.
   The `web-answer` extension
  (`src/extensions/web-answer/`) is the webanswer the user dislikes;
   it uses
  `LinkupClient.search` with `outputType: "sourcedAnswer"`,
   while `web-search`
  uses `"searchResults"` (`src/client.ts`).
   There is no per-tool toggle;
   the
  only way to suppress `web-answer` is to fork and remove it from the
  manifest.
   C1 fails as shipped.
- No blocklist and no domain exclusion.
   C2 fails.
- `LinkupClient` (`src/client.ts`) is clean:
   `BASE_URL =
  https://api.linkup.so/v1`,
   `search` (`/search`),
   `fetch` (`/fetch`),
  `getBalance` (`/credits/balance`),
   API key via `getLinkupApiKey`.
   This is the
  one piece worth reusing if the fork build path is chosen.
- Runtime dependency:
   `@aliou/pi-utils-ui` (same-author).
   Peers
  `@earendil-works/*` 0.74.0 (this harness is 0.79.6;
   peers are optional).

## Surveyed and rejected without a clone

- `@alfonzjanfrithz/pi-websearch` (v0.7.1):
   dependencies are HTML and PDF
  parsing only (`htmlparser2`,
   `domutils`,
   `dom-serializer`,
   `turndown`,
  `unpdf`),
   with no Linkup SDK.
   Not Linkup-based.
- `pi-web-access` (v0.10.7):
   dependencies are `@mozilla/readability`,
  `linkedom`,
   `turndown`,
   `unpdf`,
   `p-limit`,
   with no search SDK;
   uses Exa
  and Perplexity or Gemini (per its config),
   not Linkup;
   feature-rich
  (YouTube,
   PDF,
   GitHub clone,
   video).
   Not Linkup and not lean.
- `@bitcraft-apps/pi-web-tools` (v1.3.1):
   shell-only,
   no API keys,
   peers
  `@mariozechner/*` (old namespace).
   Not Linkup.
- `@ollama/pi-web-search` (v0.0.5):
   uses Ollama web search and fetch APIs,
   not
  Linkup.
- `@mammothb/pi-websearch` (v4.0.1):
   depends on `@mammothb/pi-shared` with no
  Linkup SDK,
   no public repository.
   Not Linkup.

## Rejected alternatives

### pi-search-hub

Pros:
 lean-ish runtime dependencies (`typebox`,
 `wreq-js`),
 correct harness
namespace,
 no webanswer tool,
 healthy maintenance (16 releases,
 responsive
issue handling,
 nine test files including an SSRF guard),
 Linkup available as
one backend.

Rejection reason:
 hard constraint 2.
 `SearchConfig` has no blocklist field and
`web_search` does no host filtering (`extensions/types.ts`,
`extensions/search-hub.ts`),
 so there is no way to keep
`badwikipedia.invalid` out of results.
 It also carries 17 backends and 7896
lines the user does not need for a Linkup-only setup.

### pi-web-providers

Pros:
 the only candidate that satisfies hard constraint 1 cleanly,
 because its
`tools` mapping can turn `web_answer` off entirely;
 best maintained;
 MIT;
Linkup supported with per-call `excludeDomains`.

Rejection reason:
 hard constraint 2.
 Domain exclusion is per-call only
(`src/providers/linkup.ts:372-376`,
 `src/config.ts` `parseSearchSettings`
rejects unknown `settings.search` keys),
 so there is no global always-active
blocklist.
 It also fails the leanness priority:
 31458 lines and twelve vendor
SDK runtime dependencies,
 with the most complex architecture of the set.

### pi-websearch-linkup

Pros:
 leanest Linkup-only surface,
 no webanswer,
 single `web_search` tool.

Rejection reason:
 hard constraint 2 (the Linkup provider sends no domain
filter and there is no config),
 compounded by a tarball-only audit with no
public repository and peer dependencies on the wrong (`@mariozechner`)
namespace.
 For a package that executes inside the coding agent,
 tarball-only
provenance is disqualifying regardless of code quality.

### @aliou/pi-linkup (incumbent)

Pros:
 lean (1486 lines),
 correct namespace,
 clean and tested `LinkupClient`,
active maintenance.

Rejection reason:
 hard constraint 1 (ships the webanswer the user dislikes with
no per-tool disable) and hard constraint 2 (no blocklist).
 This is the package
being replaced;
 the audit confirms neither gap is fixable in configuration
alone.

## Follow-up required

- Build is deferred at the user's request.
   When implemented,
   the extension
  lives as a package in this monorepo under `packages/` and installs into
  `~/.pi/agent` (matching how the incumbent is deployed).
   The build approach is
  still to be confirmed then:
   fresh lean extension (recommended,
   zero runtime
  dependencies,
   maximum auditability,
   "write our own" matches the user's
  framing) versus fork `@aliou/pi-linkup` (reuses the tested `LinkupClient` but
  inherits `@aliou/pi-utils-ui` and 1486 lines).
- Specify the blocklist config location and shape,
   for example
  `~/.pi/agent/extensions/web-search.json` with a `blocklist` array of host
  suffixes,
   applied to both `web_search` result filtering and `web_fetch` host
  refusal,
   always active.
   Match handling must be suffix-based so
  `badwikipedia.invalid` also blocks `www.badwikipedia.invalid`.
- After building:
   run typecheck,
   lint,
   and unit tests including blocklist
  fixtures with allowed and blocked hosts;
   verify at the user boundary by
  triggering `web_search` and `web_fetch` through Pi against a real Linkup
  query and confirming a blocked host is excluded;
   uninstall
  `@aliou/pi-linkup`.
- Re-open this decision if an upstream adds a global always-active blocklist
  (the only missing feature),
   if Linkup changes ownership or terms,
   or if the
  user's budget widens beyond Linkup.

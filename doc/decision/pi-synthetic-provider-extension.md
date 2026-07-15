# Pi Synthetic provider extension

Decision record for which third-party Pi extension to use for registering
Synthetic (synthetic.
new) as a model provider in the Pi coding agent.

Status:
 candidate selected (@benvargas/pi-synthetic-provider);
 installed,
replacing the previously installed @aliou/pi-synthetic.
Date:
 2026-06-18.

## Context-fork answers

- All three candidates wrap the same upstream SaaS (Synthetic's OpenAI-compatible
  inference API),
   so the differentiating axes are feature scope,
   maintenance
  signals,
   source provenance,
   security surface,
   and human auditability,
   not the
  model backend.
- Selection mode chosen by the user:
   "decide via audit",
   ranking all three on
  code quality,
   maintenance,
   and security after reading their source,
   rather
  than pre-committing to a feature tier.
- Feature scope:
   the user does not use the web search tool,
   quota warnings,
  live usage status bar,
   or sub-bar integration that @aliou/pi-synthetic adds.
  The provider,
   slash commands,
   and dynamic model discovery cover the workflow
  actually in use.
   This makes auditability the deciding axis:
   the features the
  larger candidate adds buy nothing for this user but add code they must carry
  and trust.
- @aliou/pi-synthetic was already installed in `~/.pi/agent/settings.json`,
   so
  the question is whether a leaner,
   more auditable challenger is strictly better
  given the unused features.
   The audit below establishes that it is.
- Open-source default applies (repo policy).
   All three are MIT-licensed,
   so the
  open-source vs proprietary carve-out is not in play.

## Shared upstream risk (non-differentiating)

Synthetic (synthetic.
new) is an OpenAI-compatible inference API for open-source
models,
 positioned as privacy-focused (zero-data-retention web search API,
zero-telemetry Octofriend assistant).
 It is a native provider for OpenCode,
Crush,
 GitHub Copilot,
 Claude Code,
 and Xcode Intelligence,
 so ecosystem
adoption is broad.

Corporate transparency is low:
 no clear public record of ownership,
 funding,
outage history,
 or a status page was found.
 This is a shared dependency for all
three extensions and does not differentiate them,
 but it means every choice
here carries an opaque-upstream risk that should be re-checked if Synthetic
changes ownership or terms.

## Decision

Use `@benvargas/pi-synthetic-provider` (v1.1.14) as the Synthetic provider
extension,
 replacing `@aliou/pi-synthetic`.

Both aliou and benvargas are clean,
 tested,
 actively maintained,
 and
source-audited.
 They differ on feature scope and on how hard the code is for a
human to verify.
 Because the user does not use the features that distinguish
aliou (web search,
 quota warnings,
 usage status,
 sub-bar integration),
 aliou's
larger surface buys nothing for this user while benvargas's dynamic-discovery
design covers every model the user has enabled.
 benvargas is the leaner,
zero-runtime-dependency,
 single-extension package a human can read top to bottom
and fully verify;
 aliou is roughly 2.3x the code with a runtime-dependency and
event-bus architecture the user would have to trust without benefit.
Auditability is the deciding axis (see that section).

The swap has been performed:
 `npm:@aliou/pi-synthetic` removed,
`npm:@benvargas/pi-synthetic-provider` installed in `~/.pi/agent/settings.json`
(version 1.1.14 resolved in `~/.pi/agent/npm/node_modules`).
 All five of the
user's `enabledModels` (`syn:large:text`,
 `syn:large:vision`,
`hf:zai-org/GLM-5.1`,
 `hf:moonshotai/Kimi-K2.6`,
 `hf:MiniMaxAI/MiniMax-M3`) are
confirmed `always_on=true` with `tools=true` on the live Synthetic `/models`
endpoint,
 so benvargas's dynamic fetch surfaces every one.

## Auditability

benvargas is easier for a human to audit than aliou.
 This is the axis that
flipped the selection,
 so the evidence is recorded here rather than inferred.

- Code volume:
   benvargas 1,172 non-test lines across 9 files;
   aliou 2,718
  non-test lines across 16 files.
   benvargas is a surface a human can finish
  reading;
   aliou is roughly 2.3x of it.
- Runtime dependencies:
   benvargas 0 runtime deps,
   1 peer;
   aliou 2 runtime deps
  (`@aliou/pi-utils-settings`,
   `@aliou/pi-utils-ui`,
   the author's own packages)
  plus 3 peers.
   Each same-author runtime dep extends the audit beyond the
  candidate's own repo:
   a human verifying aliou must also clone and read those
  utility packages,
   because `web-search/tool.ts` imports `ToolCallHeader` and
  `ToolFooter` from `@aliou/pi-utils-ui`.
   benvargas asks none of this.
- Architecture:
   benvargas `extensions/index.ts` is linear and obvious (register
  fallback,
   on `session_start` fetch live models and re-register,
   register two
  commands),
   one module per concern.
   aliou is event-driven:
   a `QuotaStore`
  ingests the `x-synthetic-quotas` header on `after_provider_response`,
  broadcasts via `SYNTHETIC_QUOTAS_UPDATED_EVENT`,
   and consumers subscribe and
  request refreshes via `SYNTHETIC_QUOTAS_REQUEST_EVENT`;
   there is also a
  config-loader with migrations,
   a `pendingMessages` migration queue,
   and a
  feature-registration handshake.
   Tracing aliou means jumping across 6 files;
  benvargas reads top to bottom.
- Security-critical code concentration:
   benvargas groups it into one obvious
  42-line `auth.ts` plus the network calls in `models.ts` and `quota.ts`.
   aliou
  spreads the same concerns across `lib/env.ts`,
   `web-search/tool.ts`,
   and
  `utils/quotas.ts`.
- Rendering surface:
   benvargas uses simple text output (`buildProgressBar`,
  `formatting.ts` 126 lines).
   aliou carries substantial TUI rendering
  (`web-search/tool.ts` 301 lines with `renderCall`/`renderResult`,
   and
  `command-quotas/components/quotas-display.ts` 255 lines).
- Both are clean on the same axes:
   `$SYNTHETIC_API_KEY` indirection,
   only
  `api.synthetic.new` calls,
   no `eval` / `new Function` / `child_process` /
  filesystem writes.

aliou is better documented for an auditor (76 tests including a live-API drift
test,
 an `AGENTS.md` describing the architecture).
 Tests and structure docs aid
intent once read;
 they do not make less code faster to finish reading.
 For
human auditability,
 benvargas ranks above aliou.

## Candidate audit

### @benvargas/pi-synthetic-provider (v1.1.14) - selected

Cloned to `/tmp/agent/pi-packages-benvargas` (subpackage at
`packages/pi-synthetic-provider`).

Maintenance:
- Repo github.
  com/ben-vargas/pi-packages is a monorepo of 9 Pi packages,
   87
  stars,
   9 forks.
   The synthetic-provider subpackage has 8 commits since
  2026-03-31,
   latest 2026-06-08 ("use env var reference for api key").
- 14 npm versions since 2026-01-29;
   latest 1.1.14 published 2026-06-08.
- Issue responsiveness verified across the monorepo:
   issue 19 (apiKey
  `$`-prefix deprecation) and issue 17 (claude-code-use tool problems) both
  closed with maintainer comments.
- Downloads:
   551/month.
- CI:
   green on all recent runs (`check:ci` runs biome and tsc,
   plus `test`).

Source audit (1,172 non-test lines across 9 TypeScript files):
- Single extension entry.
   Clean split into auth,
   models,
   quota,
   formatting,
  and command modules.
- Design:
   fetches models dynamically at `session_start` from the
  `/models` endpoint (always current),
   hardcoded fallback used only if the API
  is unreachable.
   Trusts API metadata for pricing and capabilities.
- Security:
   API key via `$SYNTHETIC_API_KEY` indirection and
  `getApiKeyForProvider`;
   only `api.synthetic.new` calls;
   no
  `eval`/`child_process`/fs writes.
   Uses `console.log` for "API key not
  configured" guidance,
   which is acceptable CLI UX,
   not telemetry.
- Tests:
   3 test files (index,
   commands,
   helpers).
   Vitest.
- Validation run:
   passed fully clean (exit 0).
- Dependencies:
   0 runtime deps,
   1 peer.
   Smallest transitive surface of the
  three.

Features (middle tier):
 provider with dynamic discovery,
 per-token cost
tracking parsed from the API,
 `/synthetic-models` and `/synthetic-quota`
commands,
 and hybrid/enhanced quota-system detection.
 No web search tool,
 no
live usage status bar,
 no quota warnings,
 no sub-bar integration.

### @aliou/pi-synthetic (v0.18.4) - rejected

Cloned to `/tmp/agent/pi-synthetic-aliou`.

Maintenance:
- Repo github.
  com/aliou/pi-synthetic,
   33 stars,
   6 forks,
   119 commits by aliou.
- 50 npm versions since 2026-01-29;
   latest 0.18.4 published 2026-06-14 (4 days
  before this audit).
   Release cadence is days to weeks.
- Recent commits show active model-catalog upkeep ("replace MiniMax-M2.5 with
  MiniMax-M3") and feature work ("offload large results to temp files" in
  web-search).
   Migrated to the earendil namespace on 2026-05-07.
- Issue and PR responsiveness verified:
   issue 61 (thinkingLevelMap scope) got 4
  maintainer comments;
   external PR 51 from @rnavarro (usage-status crash fix)
  merged with review.
   Responsive,
   not just active.
- Downloads:
   1,976/month (highest of the three).
- CI:
   every recent run green (CI and Publish workflows both `success`).

Source audit (2,718 non-test lines across 16 TypeScript files):
- Six independently disableable extensions (provider,
   web-search,
  command-quotas,
   sub-bar-integration,
   quota-warnings,
   usage-status) plus a
  shared config/service layer.
- Strong typing:
   strict TypeScript,
   typebox schemas,
   branded config types,
  named exports,
   `satisfies` usage.
- Security:
   credentials resolved through Pi `AuthStorage` with
  `$SYNTHETIC_API_KEY` indirection (never logged);
   web-search offloads large
  results to temp files namespaced with `randomBytes`;
   the only network calls
  are to `api.synthetic.new`;
   no `eval`,
   `new Function`,
   `child_process`,
   or
  filesystem writes outside the temp-file cache.
- Tests:
   76 tests across 5 files (quota-store,
   quota-warnings,
   quotas-severity,
  models drift-detection,
   provider index).
   Vitest.
- Validation run:
   typecheck passed,
   lint passed (27 files,
   no fixes),
   75 of 76
  tests passed.
   The single failure is the live-API drift test:
   the live
  Synthetic API returns `hf:zai-org/GLM-5.2`,
   not yet in `models.ts`.
   This is
  the drift test working as designed,
   not a defect,
   and the published 0.18.4
  package is unaffected.
- No fuzzing or mutation testing harness.
   Neither challenger has one either;
  not expected for a thin provider extension,
   but recorded as absent.
- Dependencies:
   2 runtime (`@aliou/pi-utils-settings`,
   `@aliou/pi-utils-ui`,
  both the author's own utility packages) plus 3 peers.

Features (richest of the three):
 provider with curated per-model
`thinkingLevelMap`,
 proxied-model filtering,
 and rotation-stable `syn:*`
aliases;
 zero-data-retention `synthetic_web_search` tool;
 `/synthetic:quotas`
command;
 live footer usage status;
 quota warnings with severity cooldowns;
sub-bar integration;
 `/synthetic:settings` config command.
 Each feature is
individually toggleable via `pi config`.

### @aarvay/pi-synthetic-provider (v1.0.1) - rejected

No clonable repository.
 Declared `repository` field points to
`github.com/aarvay/pi-packs`,
 which returns 404.
 Audited from the published
npm tarball extracted to `/tmp/agent/aarvay-tar/package`.

Maintenance:
- 1 npm version ever,
   published 2026-06-05 (13 days before this audit).
- Downloads:
   80/month.
- No repository,
   no CI,
   no tests,
   no releases,
   no issue tracker.
   aarvay's
  public GitHub repositories are all unrelated 2011 to 2023 projects (Elixir,
  Ethereum,
   Aavegotchi) with no Pi-package history.
   No path to report a bug
  or receive an update.

Source audit (single 287-line `index.ts`):
- The code itself is clean and well-written:
   bounded `fetchWithTimeout`
  (10s deadline),
   strict `parsePrice` regex,
   validated JSON shape,
   bounded
  overflow-detection regex,
   no telemetry,
   only `api.synthetic.new` calls,
   no
  `eval`/`child_process`/filesystem writes,
   no install scripts.
- This is a tarball-only audit.
   Provenance cannot be verified,
   history cannot
  be inspected,
   and future updates cannot be obtained.
   The benign file today
  is a one-shot publish with no track record.

Features (minimal):
 provider with dynamic discovery,
 hardcoded fallback,
 and
context-overflow normalization.
 No quota,
 no commands,
 no web search.

## Rejected alternatives

### @aliou/pi-synthetic

Pros:
 richest feature set,
 highest downloads (1,976/month),
 fastest release
cadence (50 versions),
 a live-API drift test,
 an author who writes the
canonical Pi custom-provider docs,
 CI green,
 well-tested (76 tests).

Rejection reason:
 the features that distinguish it (web search tool,
 live
usage status,
 quota warnings,
 sub-bar integration) are not used by this user,
so its 2.3x larger code surface and its two same-author runtime dependencies
buy nothing while raising the trust burden the user carries.
 Its event-bus
architecture and spread security-critical code are harder for a human to verify
than benvargas's flat single-extension layout.
 The one genuine advantage,
 the
curated per-model `thinkingLevelMap` and rotation-stable `syn:*` aliases,
 is
not load-bearing here:
 benvargas fetches models dynamically from the API and
all the user's `enabledModels` are `always_on`.
 When features go unused,
auditability should decide,
 and it favors benvargas.

### @aarvay/pi-synthetic-provider

Pros:
 the smallest code footprint of the three (287 lines,
 single file),
 zero
runtime dependencies,
 and the code itself is competently written with
sensible bounds (fetch timeout,
 strict parsing,
 bounded regex).

Rejection reason:
 no public source repository (declared repo returns 404),
 no
CI,
 no tests,
 a single npm version,
 no maintainer track record in the Pi
ecosystem,
 and no path to file issues or receive updates.
 A tarball-only audit
can confirm today's code is benign but cannot verify provenance or guarantee
any future update.
 For a package that executes inside the coding agent,
 that
is disqualifying regardless of code quality.

## Follow-up required

- benvargas hardcoded fallback gap (degraded mode only,
   when the Synthetic
  `/models` endpoint is unreachable at startup):
   the fallback lists Kimi-K2.6,
  GLM-5.1,
   MiniMax-M2.5 (not the user's MiniMax-M3),
   and Nemotron,
   and does
  not include the `syn:*` aliases.
   In normal operation the dynamic fetch
  surfaces all of the user's `enabledModels` (verified).
   If the user starts
  depending on MiniMax-M3 or a `syn:*` alias during an API outage,
   the fallback
  would not cover it;
   acceptable today given the API's observed availability.
- Re-check the shared upstream (Synthetic) if it announces a change of
  ownership,
   funding event,
   terms-of-service change,
   or outage pattern.
   The
  low corporate transparency recorded above is non-differentiating across the
  three candidates but is a real dependency risk.
- Re-open this decision if the user starts using features only aliou provides
  (web search,
   quota warnings,
   usage status),
   if benvargas goes unmaintained
  for more than one Synthetic model-rotation cycle,
   or if Synthetic's
  `/models` endpoint becomes unreliable enough that the fallback gap matters.

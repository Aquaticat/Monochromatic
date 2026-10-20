# Pi advisor DSH variant grilling

Purpose: record the design interview that gives `package/pi-plugin/advisor` a DSH variant
on a shared package,
and the decisions settled so far.
Status: interview complete.
Shared understanding confirmed on 2026-10-20 (Q13);
implementation is authorized and underway.
This file is also the working handover:
 commits, decisions since the interview, measured failures, and the queue
 live in Implementation progress.

## Request

Make the pi advisor package also have a DSH variant,
and use a shared package.

## Settled decisions

- Q1 Deliverable shape: the full triple mirroring `search-fetch`:
  `package/agent-harness-shared/advisor` (shared core),
  new `package/dsh-plugin/advisor` (DSH variant),
  `package/pi-plugin/advisor` rewired onto the core.
  Rejected: dsh consuming pi build output.
- Q2 Pi rewiring happens in the same series,
  deleting pi's private copies of moved modules.
- Q3 Fixes are allowed inside the move,
  not frozen to behavior identity.
  Attribution mitigation: every behavior pick lands with an updated test
  in the same commit.
- Q4 Day-one DSH surface: `advisor` tool plus `/advisor` command parity
  (all five subcommands: bare, `<slug>`, `status`, `off`, `on`).
  Anything DSH cannot express becomes a documented deliberate gap.
- Q5 Behavior picks when merged copies disagree: default to richer,
  no approval round,
  reported after the series in an end-of-series report with before/after per pick.
- Q6 Tie-break when richer is ambiguous: incumbent wins
  (repo's existing shared implementation when one exists,
  otherwise the information-preserving variant).
- Q7 Shared-core depth: middle.
  Pure modules plus the pi-ai-typed pipeline move behind narrow ports
  (model resolution, transcript source, theme tokens).
  Adapters keep registration, commands, pi-tui rendering, session plumbing.
- Q8 Config semantics: unified at today's paths,
  `~/.pi/agent/extensions/pi-advisor.json` global plus
  `.pi/extensions/pi-advisor.json` project.
  Both variants read the same files; pi-visible behavior stays untouched.

## Adopted without asking

- Package names follow SGD:
  `@monochromatic-dev/agent-harness-shared-advisor`,
  `@monochromatic-dev/dsh-plugin-advisor`.
- All new packages are `private: true`.
  Evidence: every precedent package measured private
  (`pi-plugin/advisor`, `pi-plugin/search-fetch`,
  `agent-harness-shared/search-fetch`, `pi-shared/model-selection`).
- Full behavior depth including hedging, overlap, deadline, and ledger.
  Forced by Q4 parity plus the report showing that machinery is host-neutral pure code.
- Extraction and pi rewiring land before the DSH adapter.
- Slopo issue 621 (shared fake pi extension host) stays out of this series,
  the narrow reading; proposed follow-up.
- Issue tracking follows the `pi-advisor-413` precedent:
  a planning doc plus a GitHub issue opened `needs-triage`.
- Verification runs on a disposable fixture profile first (THR),
  never the live profile.
- New packages get `README.md`, sibling-mirroring `mise.toml` tasks
  (`verify:extension` analogues),
  and `/ts` subpath exports (ST3).

## Facts the recommendations rest on

- `package/agent-harness-shared/search-fetch` plus `package/pi-plugin/search-fetch`
  plus `package/dsh-plugin/search-fetch` is the proven triple.
  `dsh-plugin/search-fetch` is a configuration-only DSH bundle
  (`cordis.patch.yml` mounting `@deepseek-ai/dsh-mcp-client`)
  with no `src/`.
- Advisor inventory: 67 `.ts` files, 13,040 lines.
  Pure (no pi imports) about 2,840 lines;
  pi-ai-typed pipeline about 1,600;
  host-coupled about 4,700
  (`pi-tui` rendering, `ModelRegistry` selection, `SessionEntry` context,
  `ExtensionAPI` registration).
- Advisor already consumes `@monochromatic-dev/pi-shared-model-selection`
  from 10 source files (scope resolution and default model selection).
- Host APIs used by the pi variant:
  `pi.registerTool`, `pi.registerCommand`, `pi.registerMessageRenderer`,
  `pi.on`, `pi.sendMessage`,
  `ctx.modelRegistry`, `ctx.waitForIdle`, `ctx.ui.notify`, `ctx.signal`.
- No in-repo DSH plugin authoring guide exists;
  the only DSH package is the config-only search-fetch bundle.
  `doc/audit/dsh-setup-gaps-2026-10-17.md:485-487` records that
  `dsh-commands` is a code-level `CommandRuntime` registry,
  so a workflow layer means writing a plugin,
  not dropping files in a directory.
- `plugin_manager` responds in the session that ran this interview
  (list returned 204 entries),
  so an end-of-work install is executable from the agent side.

## Settled decisions, later rounds

- Q9 `package/pi-shared/model-selection` moves and renames to
  `package/agent-harness-shared/model-selection`
  in this series, dir plus name plus consumers together
  (`pi-plugin/advisor`, `pi-plugin/goal`, the new core),
  keeping tiered exports and pi optional peers.
  Rejected: splitting tiers, leaving it in place,
  absorbing selection into the advisor core.
  `doc/todo/pi-shared-model-selection.md` gets rewritten to the new home.
- Q10 After disposable-profile verification passes,
  the advisor DSH bundle installs into the live DSH profile
  with `plugin_manager install_bundle`,
  reversible with `remove_bundle`,
  reported together with the behavior-pick list.
- Q11 Config convention collision resolved for the unified JSON file:
  the DSH plugin reads the same `~/.pi/agent/extensions/pi-advisor.json`
  and `.pi/extensions/pi-advisor.json` through the shared loader,
  its Cordis `Config` holds only structural fields,
  and its README records the deliberate deviation
  from the DSH "tunables in `cordis.patch.yml`" practice.
  Rejected: Cordis-config tunables (second source of truth),
  split across `dsh-settings` and files.
- Q12 Default reviewer choice without cost metadata:
  a `defaultReviewerModel` key in the unified config wins when set,
  otherwise the DSH variant ranks by largest `contextWindow` then name.
  The pi variant keeps its highest-expected-cost ranking when the key is unset.
  When the key is set it wins in both variants.
  Rejected: the pi-ai catalog cost side-table (the recommended option),
  fail-loudly without a model.
- Q12 amendment (user, 2026-10-20):
  `defaultReviewerModel` is set in the user's own global config
  `~/.pi/agent/extensions/pi-advisor.json` to `opencode-go/kimi-k3`
  (provider `opencode-go`, model `kimi-k3`, "Kimi K3",
  verified in `~/.pi/agent/models-store.json`),
  because the DSH LLM seam exposes no model cost metadata.
  Correction: an earlier draft of this record claimed the key
  ships as a schema default value;
  that claim is retracted.
  The schema key is optional with no baked-in default.
  Selection order: explicit tool `model` parameter,
  then `defaultReviewerModel` when resolvable in the current scope,
  then the variant fallback (pi highest expected cost,
  dsh largest `contextWindow` then name).
  Explicitly clearing the key, or naming a model absent from the scope,
  falls through to the variant fallback.
  Untouched by this request: pi `settings.json` `defaultProvider`
  and `defaultModel`, and any DSH profile default model.
  The config write is safe before the schema change lands:
  valibot `v.object` strips unknown keys,
  probed on the installed valibot where a parse of
  `{ a: 1, defaultReviewerModel: ... }` through `v.object({ a: v.number() })`
  succeeds and drops the extra key.
- Q13 Shared understanding confirmed by the user on 2026-10-20.

## DSH API probe findings (forced adoptions)

- Form: in-process Cordis plugin.
  `ctx.tools.register(defineTool(...))` and `ctx.commands.register(...)`
  both exist;
  the MCP-bundle form cannot express commands at all.
- Model calls: `ctx.llm.stream` plus `listProviders()`,
  the only supported path into provider adapters
  (dsh-llm README).
  Direct pi-ai import is rejected as a bypass
  of routes, credentials, retry, and session-log vocabulary.
- Command mapping: one `/advisor` handler parses its unstructured raw input
  (bare, `<slug>`, `status`, `off`, `on`);
  toggling maps to `ctx.tools.restrict`.
- Rendering: tool `output.render` produces `text` ContentBlocks
  with markdown riding inside text;
  no progress channel exists, so a tool call settles once
  and live progress text is a documented deliberate gap (Q4 clause).
- Transcript source for the DSH port: derived session message history
  through the session surface and `SessionProjection` state.
  Fallback if binding proves insufficient: the tool `question` parameter
  carries the content.
- Verification: fixture profile via `dsh --profile <fixture>`
  (`DSH_PROFILE`, `DSH_PROFILE_DIR`),
  checked with `cordis_inspect_query`;
  then the Q10 live install.
- Cost metadata: the LLM seam exposes none for text
  (`LlmModelInfo` is id, name, description, modalities);
  pi-ai catalogs do carry `cost: ModelCost`,
  which Q12 declined to use.

## Rejections on record

- Behavior freeze during extraction (Q3 recommendation),
  rejected in favor of fixes-in-move.
- Enumerated approval of behavior picks (Q5 recommendation),
  rejected in favor of default-to-richer with an after-report.
- Dsh variant consuming pi package build output (Q1),
  rejected as harness coupling.
- pi-ai catalog cost side-table (Q12 recommendation),
  rejected in favor of `defaultReviewerModel` plus context heuristic.

## Implementation progress

Authoritative task state,
 updated as work lands.

### Commits

- `b710410e81` `refactor(*): move model-selection to agent-harness-shared`:
  the Q9 move,
  dir plus name plus consumers (advisor, goal, thinking-default, model-retirement),
  the `mise.toml` PATH entry,
  the pnpr OIDC allowlist entry,
  a regenerated lockfile (rename-only,
  measured: no dependency version changed),
  and the WR6 note in `doc/todo/pi-shared-model-selection.md`.
- `c8d9af87d5` `fix(*): stub new pi-coding-agent 1.3.0 ExtensionAPI members in verify fakes`:
  TS2740 stubs in advisor,
  guardrail,
  and thinking-default `src/mise.verify-extension.ts`,
  mirroring the search-fetch fake.
- `3b9bb3ad6b` `fix(agent-harness-shared-shell-command-analyzer): parse unbash 6 TestLogical operands`:
  `visit-expression.ts` maps `operands`,
  dead `Time`/`Negation` branch removed in `visit-node.ts`,
  2-way and 3-way TestLogical cases added.
- `fce8efd40e` `fix(pi-plugin-current-time-context): fill hiddenTools and messageType in the test harness`:
  `pi-test-harness.ts` fixture updates for pi-coding-agent 1.3.0.
- `ad7a5a67b4` `fix(pi-plugin-terminal-title): narrow before_agent_start to its user variant`:
  handler reads `prompt` only on `messageType: 'user'`,
  custom runs skip the prompt title (new test case).
- `22f130ed5b` `fix(pi-plugin-model-retirement): regenerate the retirement table fixture for the 2026-10-15 catalog`:
  regenerated with the documented task after reviewing the retirement diff.
- `ea2812babc` `fix(cli-unused-export): adopt the yuku-analyzer 0.19.0 API`:
  `addFile` to `setFile`,
  `referencesOf` to `Binding.findReferences`,
  `Diagnostic.module` to `Diagnostic.path`.

### Decisions since the interview

- 2026-10-20 user directive: fix pre-existing failures too,
  not only this series' regressions.
- 2026-10-20 user directive: keep this handover current,
  updating it as work lands.
- 2026-10-20 user directive: use subagents aggressively,
  delegating independent workstreams in parallel.
- `defaultReviewerModel` stays user config only
  (`~/.pi/agent/extensions/pi-advisor.json`,
  value `opencode-go/kimi-k3`),
  never a schema default.
- 2026-10-20 user decision (flagged adoption approved):
  `defaultReviewerModel` selects the initial reviewer of a default call
  and keeps the serial fallback/overlap recovery semantics;
  only an explicit `model` argument or `<slug>` is exact.

### Pre-existing failures: measured, swept, fixed

Measured 2026-10-20 through package `lint:types` runs.
None of these files are in this series' diff,
and no dependency version moved in the move commit.

Fixed with the commits recorded in `### Commits`:

- `agent-harness-shared/shell-command-analyzer` (unbash 6.0.0 AST reshape),
  `pi-plugin/current-time-context`,
  `pi-plugin/terminal-title`,
  `pi-plugin/model-retirement` (catalog drift fixture),
  `cli/unused-export` (yuku-analyzer 0.19.0 API).

Full sweep 2026-10-20: 213 packages with a `lint:types` task,
170 pass,
43 fail.
Of the 43:
1 real API drift (`cli/unused-export`,
now fixed),
38 build-class (`translation-repair/*`,
`module/async-time`,
`module/logger`,
`module/test`;
missing or stale `dist`),
and 4 false positives (`config/typescript`,
`test-fixture/oxlint-*`,
whose `lint:types` tasks are commented out on purpose;
the sweep matched the comment text).

Delegated 2026-10-20 (subagents,
disjoint write scopes):

- extraction fork `40eef920`: `package/agent-harness-shared/advisor` (new)
  plus `package/pi-plugin/advisor` rewiring;
  lockfile and `config/pnpr` changes belong to this scope alone.
- docs subagent `94e9414e`: `doc/troubleshooting/*` only,
  the 2026-10 dependency API drift write-up.
- sweep subagent `25c55b61`: the 38 build-class packages only;
  parked until the repo-wide `mise run build` ends
  (no concurrent builds),
  lead wakes it on the build's completion.
  NOTE 2026-10-20: became unresumable after parking
  (`send_message` target not found);
  scope handed to replacement `bd3dc9b4`,
  which also takes its findings (the three `module/*` TS2305s were
  stale-dist artifacts,
  `translation-repair/source-scan` and `translation-repair/test-fixture`
  ship no `dist` by design).
  `bd3dc9b4` DONE 2026-10-20: all 39 packages pass `lint:types` after the
  rebuild,
  zero source drift,
  zero commits.
  Green validated with positive controls (deliberate TS2322 probes that
  made `lint:types` fail,
  then removed).
  Count correction: 35 `translation-repair` packages were red at sweep
  time (38 build-class total with the three `module/*`),
  not 36;
  `translation-repair/test-fixture` was green even then.
  `source-scan`'s red was missing dependency dists (TS2307 on
  `@monochromatic-dev/translation-repair-markup` and siblings).
- design subagent `1d3fe543`: DONE 2026-10-20,
  commit `f382400eab`: `doc/planning/pi-advisor-dsh-variant.md`
  (probed host API signatures,
  capability gaps each with a designed fallback).
  Probe corrections to the briefing:
  `LlmModelInfo` carries no `contextWindow`
  (only `LlmResolvedModelInfo.context.contextWindow` and
  `LlmDiscoveredModel.contextWindow?` do),
  and `package/dsh-plugin/search-fetch` is a configuration-only bundle;
  the in-process `apply(ctx)` precedent is `@deepseek-ai/dsh-tool-cordis`.
  Two shared-core prerequisites it specifies
  (queued as follow-up below,
  because running subagents cannot be steered in this harness:
  `send_message` rejects subagent ids with `active teammate not found`):
  optional `defaultReviewerModel` in `AdvisorConfigFileSchema`/`AdvisorConfig`
  with no schema default,
  and a ranking seam in `selectAdvisorModel`
  (pi expected cost versus DSH largest `contextWindow` then `name`,
  both supplied externally).
- docs subagent `94e9414e`: DONE,
  commit `601c69399e`:
  `doc/troubleshooting/deps-update-api-drift.md` (new class doc,
  unbash 6.0.0 / yuku-analyzer 0.19.0 / pi-ai catalog incidents,
  symptoms reproduced from a pre-fix worktree at `b710410e81`)
  plus two pi-1.3.0 sections in
  `doc/troubleshooting/pi-0-87-extension-api-breakage.md`.
- build-fixes subagent `63d2bd1d`: DONE 2026-10-20,
  three pre-existing build failures fixed
  (separate incidents,
  separate commits):
  `ba5bd66c30` `pi-plugin/auto-mode` placeholder `src/index.ts`
  (a ground-up rebuild commit `7ac15b19b4` deleted sources
  but left the entry and `./ts` export pointing at it),
  `ef4a659b18` `config/rolldown` canvg alias path
  (`src/stubs/` versus the real `src/stub/`;
  no canvg install needed,
  the app rasterizes to PNG and never uses jspdf's SVG path),
  `d21582c951` `doodle-widget` `src/build.ts` asset path
  (stale plural `src/assets/` after singularization),
  `1eee51ee2f` `desktop-app/terminal` libghostty-vt staging
  (root cause is output discovery,
  not build ordering:
  machine `~/.cargo/config.toml` relocates `[build] build-dir`,
  so `cargo metadata` `build_directory` must be searched
  alongside `target/`,
  in both dir layouts).
- follow-up subagent `9f07ca3d` (2026-10-20):
  correct the wrong diagnosis in
  `doc/troubleshooting/mise-dependency-freshness.md`
  (it called the staging failure build-order),
  and verify then repoint the stale plural
  `ZIG_GLOBAL_CACHE_DIR` in root `.cargo/config.toml`.
  Separate commits per incident.

The lead holds `doc/handover/` edits and cross-agent integration.

### 2026-10-20 worktree reset incident (extraction data loss)

Around 17:52-17:53 EDT,
a concurrent session's git merge/reset on `main`
(commits `949f319816`,
`d5169ed184`,
later `8b0860d75e`/`63991e9923`;
several sessions keep merging `origin/main`)
hard-reset the worktree and destroyed extraction fork `40eef920`'s
UNCOMMITTED work:

- destroyed: the staged `git mv` batch
  (36 core files plus 17 tests into `package/agent-harness-shared/advisor/src`)
  and the unstaged pi-adapter edits
  (`index.ts`,
  `tool.ts`,
  `types.ts`,
  `commands.ts`,
  `rendering.ts`,
  `status.ts`,
  `command-message.ts`,
  `verify-host.ts`,
  `operation-failure-accounting.ts`,
  `package.json`,
  `config/pnpr/config.yaml`,
  `pnpm-lock.yaml`);
- survived: `package/agent-harness-shared/advisor` root files
  (`package.json`,
  `mise.toml`,
  `tsconfig.json`,
  rolldown config),
  `src/{index,ports,transcript-test-fixture}.ts`
  (latest versions,
  lint-clean,
  property-style port signatures,
  closed `AdvisorThemeColor` token union),
  its `dist/` build and `node_modules` link,
  and `package/pi-plugin/advisor/src/run-context.ts`;
- the only stash (`3f1dfd8c8a`) is an unrelated 2026-08-05
  translation-repair autostash,
  not this work.

Recovery plan (fork `40eef920` is executing it):
redo the `git mv` batches,
re-apply the recorded edits verbatim from its event log,
and commit in small units immediately after each coherent batch
(GCE),
never at the end.
Then `pnpm install` for the lockfile,
file-enforcer,
verification,
README.

### Unknowns

- Resolved:
  the shell-command-analyzer TS2339s were the unbash 6.0.0 AST reshape,
  not the TypeScript toolchain or the ownership branding.
- Resolved:
  no source drift hid behind the 38 build-class `lint:types` failures;
  subagent `bd3dc9b4` verified all 39 packages green after rebuild
  (2026-10-20).

## Next action

Implementation,
 in this order (user directives 2026-10-20: fix pre-existing failures too;
 use subagents aggressively):

1. DONE,
   commit `b710410e81`: move `package/pi-shared/model-selection` to
   `package/agent-harness-shared/model-selection`
   (dir plus name plus consumers).
2. DONE: fix the measured pre-existing failures
   (`3b9bb3ad6b`,
   `fce8efd40e`,
   `ad7a5a67b4`,
   `22f130ed5b`,
   `ea2812babc`,
   `c8d9af87d5`)
   and sweep every package `lint:types`
   (213 packages,
   170 pass,
   43 red triaged as above).
3. IN PARALLEL (subagents,
   2026-10-20):
   extract the shared core `package/agent-harness-shared/advisor`
   and rewire `package/pi-plugin/advisor`
   (fork `40eef920`;
   redoing destroyed work per the worktree reset incident section,
   committing in small units);
   write the `doc/troubleshooting/` dependency API drift record
   (`94e9414e`);
   fix the 38 build-class reds
   (`25c55b61`).
4. Deferred (2026-10-20):
   `git merge --ff-only origin/main` to adopt the auto-push published
   merge `46a264639b`
   (auto-push moved `origin/main` after commit `fafac18a54`).
   Deferred because the extraction's staged renames make the worktree
   unsafe for a merge right now;
   run it once extraction lands and before further integration.
   Then fold the two design prerequisites into the extracted core
   (optional `defaultReviewerModel` field,
   `selectAdvisorModel` ranking seam),
   then build `package/dsh-plugin/advisor` (in-process plugin,
   tool plus `/advisor` command, unified config,
   `ctx.llm` backend, Q12 selection rule,
   `doc/planning/pi-advisor-dsh-variant.md` as the blueprint).
5. Tests, lint, and `mise` tasks for every new and moved package;
   behavior picks recorded per Q5 and Q6
   plus the 2026-10-20 reviewer-fallback decision
   (initial reviewer,
   serial fallback kept,
   explicit is exact).
6. Fixture-profile verification, then the Q10 live install.
7. READMEs, planning doc, GitHub issue (`needs-triage`),
   and this handover's completion record.

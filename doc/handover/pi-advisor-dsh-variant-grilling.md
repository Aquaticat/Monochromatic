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
- sweep subagent `25c55b61`: the 38 build-class packages only.

The lead holds `doc/handover/` edits and cross-agent integration.

### Unknowns

- Resolved:
  the shell-command-analyzer TS2339s were the unbash 6.0.0 AST reshape,
  not the TypeScript toolchain or the ownership branding.
- Whether any of the 38 build-class `lint:types` failures hide a real
  source drift behind the missing `dist`;
  the sweep subagent rebuilds before concluding.

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
   (fork `40eef920`);
   write the `doc/troubleshooting/` dependency API drift record
   (`94e9414e`);
   fix the 38 build-class reds
   (`25c55b61`).
4. Build `package/dsh-plugin/advisor` (in-process plugin,
   tool plus `/advisor` command, unified config,
   `ctx.llm` backend, Q12 selection rule).
5. Tests, lint, and `mise` tasks for every new and moved package;
   behavior picks recorded per Q5 and Q6.
6. Fixture-profile verification, then the Q10 live install.
7. READMEs, planning doc, GitHub issue (`needs-triage`),
   and this handover's completion record.

# DSH setup audit against Pi and Claude Code

Date:
2026-10-17.
Runtime:
DSH `0.2.1-alpha.4`,
profile `web`,
workspace `/var/home/user/Monochromatic`.

This audit compares the DeepSeek Harness (DSH) configuration on this machine
against the two other agent harnesses configured for the same workspace,
Pi (`~/.pi/agent/`) and Claude Code (`.claude/`).

Every claim below carries the measurement that produced it.
Where a claim could not be measured in this session,
the doc says so explicitly rather than inferring.

## Retraction of the first draft

A first draft of this audit was written earlier on 2026-10-17 and was wrong
in its four highest-severity findings.
It was written from `plugin_manager list_plugins` output alone,
without measuring the agent capability set those plugins were claimed to gate.
The corrections are recorded here because the draft's conclusions were acted on.

The draft claimed DSH had zero project-level skills.
False.
All 10 project skills were present in the DSH skill catalog from the first turn,
and loading `source-audited-report` resolved its base directory to
`/var/home/user/Monochromatic/.agents/skills/source-audited-report`.

The draft claimed the `AGENTS.md` rule set was not active in DSH.
False.
The rules were delivered through `CLAUDE.md`,
which `file-enforcer` generates from `AGENTS.md`.
The real defect is different and more serious,
and is documented in the instruction budget section.

The draft listed 19 "disabled core plugins" as missing capabilities.
False.
The agent tool surface measured 52 tools before those plugins were enabled
and 52 tools after.
Every tool the draft claimed was missing (`bash`,
`pwsh`,
`todo_write`,
`workflow`,
`create_goal`,
`get_goal`,
`update_goal`,
`exit_plan_mode`,
`subagent`,
`subagent_fork`,
`list_agents`,
`send_message`,
`spawn_teammate`,
`terminal_open`,
`session_search`,
`skill`) was already callable.

The draft claimed experimental bundles were "not installed".
False.
`~/.dsh/profiles/web/package.json` composes five of them under
`dsh.profile.bundles`,
and their rows reported `fiberPhase: "active"`
before any change was made.

Two smaller errors:
the draft said "400+" Claude Code allow entries
(the count is 583),
and it recommended connecting the `serena` MCP server without noticing that
Pi deliberately sets `"enabled": false` for it in `~/.pi/agent/mcp.json`.

## Why the plugin flags were misleading

`plugin_manager list_plugins` reports 203 entries.
Many rows showed `enabled: false, fiberPhase: null`,
which reads as "capability absent".
It is not.

`plugin_manager list_bundles` shows that the `@deepseek-ai/dsh-web-app` bundle
carries an `overrides` list naming 26 row ids,
including `tool-bash`,
`tool-pwsh`,
`tool-jobs`,
`tool-fs`,
`tool-fs-search`,
`skill-filesystem`,
`tool-skill`,
`command-goal`,
`tool-goal`,
`plan-mode`,
`compaction-basic`,
`command-compact`,
`tool-result-pruner`,
`tool-subagent-control`,
`tool-subagent-list-agents`,
`tool-subagent`,
`tool-subagent-fork`,
`workflow-ptc`,
`tool-workflow`,
`agent-instructions`,
`tool-todo`,
`tool-web`,
`tool-plugin-manager`,
`system-prompt`,
`tools`,
and `session-query-sqlite`.

A later bundle layer re-declares those rows,
so the `enabled: false` state on the `@deepseek-ai/dsh-base` row
does not describe what the agent can call.
The empirical check is `cordis_inspect_query` with `platform: host`,
`provider: Tool`,
`method: listTools`,
which returns the tools actually callable by the requesting agent.
That call returned 52 tools both before and after the enable sweep.

Consequence:
the 25 `disabled: false` entries now written into
`~/.dsh/profiles/web/cordis.patch.yml` are inert.
They do not harm anything,
but they are config churn that misstates what the profile does.
Reverting them is a live question for the owner,
not a settled fix.

## Instruction budget overflow drops AGENTS.md and injects Claude Code rules

Severity:
high.
This is the most consequential finding in the audit.

### The measurement

`@deepseek-ai/dsh-agent-instructions` is described in its own package metadata
as the "Workspace context loader for AGENTS.md/CLAUDE.md instruction files".
The `@deepseek-ai/dsh-base` bundle configures it with a byte cap at
`cordis.patch.yml:306` of that package:

```yaml
# @deepseek-ai/dsh-base/cordis.patch.yml:303-306
- id: agent-instructions
  name: '@deepseek-ai/dsh-agent-instructions'
  config:
    maxBytes: 65536
```

Measured file sizes in the workspace:

- `AGENTS.md`:
  32933 bytes,
  1450 lines
- `CLAUDE.md`:
  34962 bytes,
  1499 lines
- Combined:
  67895 bytes
- Cap:
  65536 bytes
- Overflow:
  2359 bytes

The DSH system reminder for this session states the outcome directly:
"Workspace instruction budget 65536 bytes:
omitted AGENTS.md",
followed by "Instructions from:
CLAUDE.md".

### Why deduplication does not save it

The plugin's own type documentation describes the intended collapse behavior
for `instructionFileCandidates`:
"every existing file loads,
with per-directory trimmed-content duplicates collapsed to the earliest candidate".

`CLAUDE.md` is not a trimmed-content duplicate of `AGENTS.md`.
`diff AGENTS.md CLAUDE.md` produces exactly one hunk,
`0a1,49`,
plus one trailing context line:
50 diff lines total.
`CLAUDE.md` is `AGENTS.md` verbatim with 49 lines prepended.
Because the content differs,
the dedup rule does not fire,
both files charge against the 65536 byte cap,
and the cap overflows.

The prepend is deliberate and documented in the repo.
`file-enforcer.config.ts:2223` carries the comment
"CLAUDE.md must literally contain AGENTS.md content
(Claude Code's @include is unreliable)",
with `dest: './CLAUDE.md'` at line 2225.

### Why the injected preamble is actively wrong under DSH

The 49 prepended lines are Claude Code operating rules.
Under DSH they are not merely irrelevant,
several are false
and contradict the DSH system prompt.

The preamble states that in-process subagents run inside the session,
that SendMessage steering is unreliable,
and that general-purpose subagents should only be fanned out
in interactive Claude Code sessions.
DSH ships `subagent`,
`subagent_fork`,
`list_agents`,
and `send_message`
as first-class tools,
and the DSH system prompt says the opposite about steering:
"use `send_message` to steer it while running".

The preamble instructs the agent to use `spawn-claude` outside sandbox
to launch a child Claude Code session.
`spawn-claude` is not a DSH tool.
It is `package/claude-code-plugin/claude-spawn` in this repo.

The preamble instructs the agent to consult a second model with
`timeout 3600 pi --model openai-codex/gpt-5.6-sol --print ...`.
That is the Pi CLI,
not a DSH surface.

The preamble warns never to publish agent-authored documents to claude.ai.
DSH has no claude.ai integration.
The DSH system prompt carries its own,
different publishing rule.

The preamble requires long background runs to be started as systemd user units
because "every session's Bash commands share one `claude-code-bash` cgroup,
and `systemd-oomd` kills it whole".
DSH has managed background jobs via `run_in_background` on `bash` and `pwsh`,
plus `job_list`,
`job_output`,
and `job_kill`.
The cgroup hazard described is specific to Claude Code's Bash tool.

Net effect:
a DSH agent in this workspace receives the full `AGENTS.md`
rule set,
which is correct and wanted,
plus 49 lines of another harness's operating instructions,
several of which directly conflict with the DSH system prompt it also receives.
The agent must resolve the conflict itself,
per turn,
with no stated precedence.

### Remediation options

Raising the cap is the smallest change and does not touch the repo generator.
It leaves the conflicting preamble in place:

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- id: agent-instructions
  name: "@deepseek-ai/dsh-agent-instructions"
  config:
    maxBytes: 131072
```

Making `CLAUDE.md` content-identical to `AGENTS.md` would let the plugin's
own dedup collapse the pair,
but `file-enforcer.config.ts:2223` records that Claude Code's `@include`
is unreliable,
which is why the duplication exists.
Removing it would regress Claude Code.

The clean fix is a third instruction file.
`instructionFileCandidates` is a configurable ordered candidate list,
so DSH can be pointed at a DSH-specific file while `AGENTS.md` and
`CLAUDE.md` remain as they are.
That requires knowing the default candidate order,
which is not exposed in the plugin's public type surface
and was not measured for this audit.

Unmeasured:
whether enabling the `agent-instructions` row in this session's
patch changed instruction loading at all.
The plugin already ran in turn one while its base row reported
`enabled: false`,
so the effective mount came from the web-app override.
Confirming this needs a fresh server start and a new session,
neither of which has happened.

## Fourteen user skills are invisible to DSH

Severity:
medium.

`~/.agents/skills/` holds 29 directories with a `SKILL.md`.
`~/.pi/agent/skills/` holds 26 entries,
and every one of them is a symlink into `~/.agents/skills/`,
so Pi and DSH read the same underlying store.
`pre-compact` is the only Pi entry with no `~/.agents/skills/` counterpart.

The DSH skill catalog for this session lists 15 of those 29.
The 14 it omits are `ask-matt`,
`grill-me`,
`grill-with-docs`,
`handoff`,
`implement`,
`improve-codebase-architecture`,
`setup-matt-pocock-skills`,
`teach`,
`to-questionnaire`,
`to-spec`,
`to-tickets`,
`triage`,
`wait-what`,
and `wayfinder`.

The cause is a single frontmatter field.
Scanning all 29 `SKILL.md` files for `disable-model-invocation`
produces a perfect correlation with zero counterexamples in either direction:

- 14 files set `disable-model-invocation: true`;
  all 14 are absent from the catalog
- 15 files omit the field;
  all 15 are present

DSH honors the field by excluding the skill from the model-visible catalog.
Pi surfaces the same skills through its own command path,
so they remain reachable there.
Under DSH they are unreachable,
because the `skill` tool can only load a name that appears in the catalog.

This is a real capability loss,
not a cosmetic one.
The hidden set is the workflow layer of the skill collection:
`handoff` compacts a conversation into a handover document,
`to-spec` turns a conversation into a tracker issue,
`to-tickets` splits a spec into tickets,
`triage` moves issues through a triage state machine,
`implement` executes a spec,
`ask-matt` routes between skills,
and `wayfinder` orients an agent in an unfamiliar area.
The DSH equivalents (`doc/handover/`,
GitHub Issues via `gh`,
`spawn_teammate`) exist but are not wired to these instructions.

Remediation is a design choice,
not a one-line fix.
Either DSH gains a user-invocable command surface for
`disable-model-invocation` skills,
or those skills lose the flag and accept model invocation,
or the workflow layer is re-expressed as DSH commands.
`include:commands` and `include:ui-commands` are both active,
so the third path has an existing home.

## No MCP server bridge is composed

Severity:
medium.

DSH ships an MCP client.
The `@deepseek-ai/dsh-mcp-client` package describes itself as
"MCP client bridge:
connects to MCP servers and registers their tools on ctx.tools".
It is not composed into the `web` profile.
Searching the 203 plugin entries returns no `mcp-client` row.
The only reachable paths to the package run through
`@deepseek-ai/dsh-acp` and `@deepseek-ai/dsh-acp-app`,
and both of those bundles report `enabled: false` in `list_bundles`.
`include:mcp-resources` is active but is a resource-exposure plugin,
not a server bridge.

What the other two harnesses have:

Claude Code's allow-list carries seven MCP tool namespaces,
counted by extracting `mcp__` prefixes from `.claude/settings.local.json`:
`nvim` (editor diagnostics),
`blender` (3D scene control),
`mvm` (virtual machine lifecycle),
`serena` (code intelligence and memory),
`claude_ai_linkup` (web research),
`morph` (semantic codebase search),
and `claude_ai_GitHub` (issue and code search).

Pi declares four servers in `~/.pi/agent/mcp.json`:
`browseros` and `linear` and `safari-mcp-stp` all marked
`"exposure": "deferred"`,
and `serena` marked `"enabled": false`.
The `safari-mcp-stp` entry reaches a macOS host over
`ssh -o BatchMode=yes m1`,
which ties it to the `HRM:` hazard rule
in `AGENTS.md` about that machine's 16 GiB cap.

Config hygiene finding on the Claude Code side:
`.claude/settings.local.json` sets
`enabledMcpjsonServers: ["slint-music-player", "slint-terminal"]`,
but no `.mcp.json` exists in the workspace.
A search to depth 3 excluding `node_modules` returned nothing.
Those two entries are stale.

Deferred exposure in Pi is the notable design idea DSH lacks.
Pi mounts the server's tools lazily,
so a four-server configuration does not charge its full tool schema
against every request.
DSH mounts all 52 tools unconditionally.
Pi also sets `defaultTools: ["+codemode", "+tool_search"]`,
which is the same context-economy motive.

## Five Claude Code lifecycle hooks have no DSH counterpart

Severity:
medium to high,
depending on how much the hooks are relied on.

`.claude/settings.local.json` configures four hook events
carrying five commands.
Each resolves to a package built in this repo under
`package/claude-code-plugin/`,
which holds 13 packages:

- `SessionStart` with matcher `startup|resume` runs `ccssh`,
  which is `session-start-housekeeping`:
  creates temp directories and cleans stale dist artifacts
- `UserPromptSubmit` runs `cccr`,
  which is `correction-reminder`:
  detects correction phrases and reminds the agent to re-verify
- `PreToolUse` with no matcher runs `ccgr`,
  which is `guardrail`:
  blocks general-purpose Agent calls and redirects to `spawn-claude`
- `PreToolUse` with matcher `Bash` runs `ccbof`,
  which is `bash-output-filter`:
  pipes Bash output through a filter that strips git boilerplate
- `Stop` runs `ccsr`,
  which is `stop-reminder`:
  reminds the agent to investigate before guessing and refuses premature stops

Searching the descriptions of all 304 `@deepseek-ai/dsh-*` packages in the
install tree for `hook`,
`lifecycle`,
`intercept`,
`pretool`,
`before tool`,
and `on tool` returns no user-extensible tool-call hook plugin.
The matches are unrelated:
`dsh-goal` (goal state lifecycle),
`dsh-client-connection` (RPC generation lifecycle),
`dsh-client-resources` (a React `useResource` hook),
`dsh-acp-app` and `dsh-sdk-app` (process lifecycle).

The nearest DSH primitives,
all active,
are
`include:commands`,
`include:command-feedback`,
`include:message-feedback`,
`include:repeat-tool-reminder`,
and `include:auto-review` from
`@deepseek-ai/dsh-experimental-auto-review`,
described as "Per-tool LLM authorization review for the
DeepSeek Harness Auto permission preset".

Mapping the five hooks onto those primitives:
`guardrail` is partially covered by `auto-review`,
since both gate a tool call before execution.
`bash-output-filter` has no counterpart,
and it is the one with a measurable context cost,
because it strips boilerplate from every Bash result.
`correction-reminder` and `stop-reminder` have no counterpart;
`repeat-tool-reminder` fires on repeated identical tool calls,
which is a different trigger.
`session-start-housekeeping` has no counterpart.

Note that `guardrail` and the `CLAUDE.md` preamble enforce the same
general-purpose-subagent ban from two directions.
That ban is a Claude Code constraint recorded in
`doc/decision/general-purpose-subagent-ban.md`.
It does not describe DSH,
where `subagent` and `subagent_fork` are supported.

## Model roster and credential handling

Severity:
medium for the roster,
and one security finding on the Pi side.

DSH configures two providers in `~/.dsh/profiles/web/cordis.patch.yml`,
exposing three models in total:
`qwen3.8-max` on `qwen-token-plan-individual`
(1000000 context,
131072 max tokens),
and `claude-haiku-5-5` (1000000 / 128000) plus `mimo-v2.6-pro`
(1048576 / 131072) on `opencode-go`.
The default is `qwen-token-plan-individual` with `qwen3.8-max`.

Pi's `~/.pi/agent/settings.json` lists 16 `enabledModels` across three
provider namespaces (`hyper`,
`synthetic`,
`openai`),
defaulting to `hyper/gemma-4-26b-a4b-it` with `defaultThinkingLevel: "high"`.
It loads 17 packages,
including two provider adapters
(`@benvargas/pi-synthetic-provider`,
`@charmland/pi-hyper-provider`)
and a local `openai-fast` plugin.

Pi's `~/.pi/agent/models.json` adds a fourth provider,
`llmgateway-devpass`,
with four models and per-model `thinkingLevelMap`
tables that map DSH-style reasoning levels onto provider-native ones.
It also carries `modelOverrides` adjusting `contextWindow` to 750000
for `gpt-6-luna`,
`gpt-6.1-sol`,
and `gpt-6-astra`.

Security finding,
and it runs against the direction of this audit:
`~/.pi/agent/models.json` stores the `llmgateway-devpass` API key in
plaintext in the `apiKey` field.
The file is mode `0644`,
world-readable.
DSH does not do this.
Its providers use `apiKeyEnv` indirection
(`QWEN_TOKEN_PLAN_INDIVIDUAL_API_KEY`,
`OPENCODE_GO_API_KEY`),
and its credential store `~/.dsh/.credentials.yaml` is mode `0600`.
This is a Pi defect worth fixing,
not a DSH gap.

Two genuine DSH gaps in this area.
The DSH patch declares no reasoning or thinking-level configuration for its
three models,
while Pi maps thinking levels per model.
And the `include:llm-deepseek` and `include:llm-deepseek-account` rows are
both active with no DeepSeek model appearing in the patch config,
so whatever they expose was not measured here.

## Subagent role definitions

Severity:
low to medium.

Pi defines three named subagent roles with explicit tool allow-lists in
`~/.pi/agent/pi-subagents-config.json`:
`scout` (read,
grep,
find,
ls,
web_fetch,
web_search),
`planner` (the same plus todo),
and `reviewer` (read,
grep,
find,
ls,
bash,
web_fetch,
web_search).
It also carries two agent prompt files,
`~/.pi/agent/agents/Explore.md` and `~/.pi/agent/agents/Plan.md`,
and a populated `~/.pi/agent/pi-subagents-state/` directory.

DSH's `spawn_teammate` and `subagent` take free-form prompts with no
tool restriction parameter.
`include:agent-preset-registry` is active and the patch sets
`default: standard` with `selectedDefault: cordis`,
and four preset rows are active (`preset-standard`,
`preset-ptc`,
`preset-minimal`,
`preset-cordis`),
but no per-role tool allow-list is configured.

The capability gap is least-privilege delegation:
Pi can spawn a read-only scout that cannot write or execute,
and DSH cannot express that today without authoring a preset.

## Permission model differences

Severity:
informational,
with one forward-looking risk.

Claude Code has accumulated 583 allow entries in
`.claude/settings.local.json`,
a deny list containing one entry (`Glob`),
and a sandbox block that is configured but switched off:
`enabled: false`,
with eight `filesystem.allowWrite` paths
(including `~/temp`,
`~/.local/share/mvm`,
`~/.cache/mise`)
and ten `excludedCommands` (`git`,
`docker`,
`bun`,
`spawn-claude`,
`mise`,
`tweakcc`,
`agent-browser`,
`vlt`,
`pnpm`,
`gh`).
It also sets `worktree.symlinkDirectories` to
`["package/cli/forbidden-strings/target"]` with `baseRef: "head"`,
`outputStyle: "default"`,
`autoMemoryEnabled: false`,
`spinnerTipsEnabled: false`,
and `prefersReducedMotion: true`.

DSH defines three presets in its patch and defaults to the widest:
`danger-full-access` with `approval: never`.
The `read-only` and `workspace-write` presets both use `approval: ask`.

This is a deliberate difference,
not a deficiency.
The forward-looking risk is that the 583-entry allow-list represents
accumulated operational knowledge about which commands are safe in this
workspace,
and DSH has no equivalent artifact.
If the DSH preset is ever narrowed to `workspace-write`,
there is no allow-list to migrate and every session starts from friction.

Pi's model here is different again:
`steeringMode: "all"`,
`followUpMode: "all"`,
plus `~/.pi/agent/trust.json` naming three trusted workspace paths.

## What DSH has that the others do not

The audit would be unbalanced without this.
Measured from the active plugin list:

- Agent Teams:
  `spawn_teammate`,
  `list_agents`,
  `send_message`,
  `wait_agent`,
  `interrupt_agent`,
  and a shared task board with compare-and-set revisions
  (`team_task_create`,
  `team_task_list`,
  `team_task_get`,
  `team_task_update`).
  Neither Pi nor Claude Code has a durable multi-agent board.
- Cross-session search:
  `session_search`,
  `session_event_search`,
  `session_trace`,
  `session_event_trace`,
  `session_event_read`,
  backed by `include:session-query-sqlite`.
- Persistent goal state with round limits and blocked-reason requirements:
  `create_goal`,
  `get_goal`,
  `update_goal`.
- Scripted multi-agent orchestration through the `workflow` tool.
- A declarative composition layer (`cordis.yml` plus `cordis.patch.yml`)
  with live introspection via `cordis_inspect_list` and
  `cordis_inspect_query`.
- Scheduled reminders with cron,
  weekly,
  daily,
  and fixed-rate timing.
- Spill-to-disk for large tool results,
  which is how the 52-tool schema dump
  and the `list_bundles` output in this audit remained usable.

## Priorities

1. Resolve the instruction budget overflow.
   DSH agents are currently receiving Claude Code's operating rules.
   Raising `maxBytes` is a one-line patch change and stops the omission;
   a DSH-specific instruction file is the correct fix.

2. Decide what to do about the 14 hidden workflow skills.
   These are the handoff,
   spec,
   ticket,
   and triage flows.
   Leaving them unreachable means DSH sessions cannot follow the same
   workflow vocabulary as Pi and Claude Code sessions.

3. Compose an MCP bridge if the seven Claude Code integrations matter.
   `@deepseek-ai/dsh-mcp-client` already exists in the install tree.
   Start with `morph` or `serena` for code intelligence,
   and copy Pi's deferred-exposure idea rather than mounting every
   server's schema eagerly.

4. Revert or keep the 25 inert `disabled: false` patch entries.
   They misstate what the profile does.
   Owner decision.

5. Port `bash-output-filter` behavior if Bash output volume is a context
   problem in DSH sessions.
   It is the one hook with a direct,
   measurable context cost.

6. Rotate the plaintext `llmgateway-devpass` API key in
   `~/.pi/agent/models.json` and move it to an environment variable.
   This is a Pi defect surfaced by the comparison.

7. Fix the stale `enabledMcpjsonServers` entries in
   `.claude/settings.local.json`,
   which name two servers with no
   `.mcp.json` behind them.

## Surfaces this audit did not exercise

Stated so the gaps are not mistaken for verified absences.

- No fresh server start or new session,
  so every claim about what a new
  session would load is inference from config,
  not observation.
- The default `instructionFileCandidates` order was not read from source.
- The models exposed by `include:llm-deepseek` and
  `include:llm-deepseek-account` were not enumerated.
- `.claude/settings.local.json` was read in full for structure but the 583
  allow entries were counted,
  not individually classified.
- The 13 `package/claude-code-plugin/` packages were identified by their
  `bin` names and package descriptions;
  their source was not read.
- Claude Code's installed plugins (`playground`,
  `plugin-dev`) and its
  marketplace catalog were not audited.
- Other harness directories present in the workspace (`.crush`,
  `.factory`,
  `.fallow`,
  `.serena`,
  `.opencodereview`,
  `.codex`) were listed but not
  examined.
  `.codex` is empty.
- Whether `~/.agents/skills/` and the workspace `.agents/skills/` are the
  only two DSH skill roots was not confirmed from source.

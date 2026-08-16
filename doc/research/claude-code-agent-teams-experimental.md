# Why Claude Code Agent Teams is still experimental

Agent Teams lets one Claude Code session spawn other full Claude Code sessions as teammates,
coordinated through a shared task list and a file-backed mailbox.
It shipped as a research preview and is still gated behind an opt-in environment variable.
This note answers why.

The question has three separable answers that are easy to blur together:
what "experimental" means mechanically in the shipped binary,
what Anthropic states is unfinished,
and what the release history and issue tracker show about stability.
Only the second is Anthropic's own account.
The others corroborate it or fail to.

## Verification basis

Facts below come from reading primary sources on 2026-08-16,
not from recall.

- Binary:
   Claude Code v2.1.233 at `/var/home/user/.local/share/claude/versions/2.1.233`,
  a Bun-compiled ELF of 324598064 bytes.
  Published to npm as `@anthropic-ai/claude-code@2.1.233` on 2026-08-14
  (`https://registry.npmjs.org/@anthropic-ai/claude-code`).
- Extraction method:
   `dd bs=1M skip=270` over the executable,
   then `strings --bytes 6`,
  producing 82219 lines and 33560290 bytes of printable text.
  The JavaScript bundle is minified,
  so identifier names are mangled and only string literals are verbatim.
- Documentation:
   [`https://code.claude.com/docs/en/agent-teams`][agent-teams-docs] and
  [`https://code.claude.com/docs/en/costs`][costs-docs],
   fetched 2026-08-16.
  The older `docs.claude.com/en/docs/claude-code/agent-teams` path now returns a 301 to the former.
- Release history:
   `anthropics/claude-code` `CHANGELOG.md` retrieved through `gh api`.
- Issue counts:
   GitHub `search/issues` through `gh api`,
   same date.

**Source quality note:**
the binary and the official documentation are primary.
The changelog is primary but curated by Anthropic,
 so absence of an entry is not absence of a change.
Issue-tracker counts measure user reports,
 not defect density,
and are the weakest evidence here.
No claim below rests on a secondary blog or aggregator.

## What "experimental" means mechanically

Enablement requires two independent conditions,
and the user controls only one of them.
From the extracted bundle,
the module exporting `isAgentSwarmsEnabled`:

```js
// claude-code 2.1.233, extracted bundle text
function udv(){return process.argv.includes("--agent-teams")}
function md(){
  if(!V.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS&&!udv())return!1;
  if(!rt("tengu_amber_flint",!0))return!1;
  return!0
}
```

The first condition is the documented opt-in:
`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`,
 or the undocumented `--agent-teams` argument.

The second condition is a feature flag,
and the flag is server-supplied.
`rt(name, fallback)` resolves through `fkr` to `eY().getFeatureValueWithSource(name, fallback)`,
and the same bundle embeds the GrowthBook client SDK,
defaulting its API host to `https://cdn.growthbook.io`,
with a startup span named `growthbook_init`
and a refresh interval read from `tengu_gb_refresh_interval_minutes`
(default 360 minutes,
 clamped to the range 5 to 360,
 jittered).
So `tengu_amber_flint` has a local fallback of `true`
but can be flipped by Anthropic without shipping a new binary,
and the CLI argument does not bypass it.

That is the concrete difference between this feature and a general-availability one:
Anthropic keeps a remote off switch over code that is already installed on every machine.

The settings panel classifies the feature the same way.
Its `Experimental` group is exactly
`["precomputeCompactionEnabled","timestamps","showStatusInTerminalTab","teammateMode","teammateDefaultModel"]`,
so both team-related settings sit beside other unfinished toggles rather than in `Advanced`.
The documentation adds that the per-session override
"is experimental and doesn't appear in `claude --help`".

## What Anthropic states is unfinished

The documentation page opens with a warning that the feature is
"experimental and disabled by default",
and closes with a section headed "Limitations" that begins
"Agent teams are experimental."
Those limitations,
 quoted from the [Agent teams documentation page][agent-teams-docs],
sort into classes that explain the gate better than the raw list does.

### State that does not survive the session

- "No session resumption with in-process teammates:
   `/resume` and `/rewind` do not restore in-process
  teammates.
   After resuming a session,
   the lead may attempt to message teammates that no longer exist."
- "One team per session:
   a session has exactly one team,
   scoped to that session.
  You can't create additional named teams or share a team across sessions."
- "Lead is fixed:
   the main session is the lead for its lifetime.
  You can't promote a teammate to lead or transfer leadership."

The resume limitation is the most consequential,
because it does not merely lose the teammates.
It leaves the lead holding names that no longer resolve,
and the documented remedy is for the human to notice and say so.

### Coordination that needs a human to close the loop

- "Task status can lag:
   teammates sometimes fail to mark tasks as completed,
   which blocks dependent tasks.
  If a task appears stuck,
   check whether the work is actually done and update the task status manually
  or tell the lead to nudge the teammate."
- "Shutdown can be slow:
   teammates finish their current request or tool call before shutting down."

A blocked dependent task is not a cosmetic problem:
task claiming is how teammates pick up work,
so a missed completion stalls the team rather than slowing it.

### Topology limits

- "No nested teams:
   teammates cannot spawn their own teammates.
   Only the lead can manage the team."
- "No background subagents from in-process teammates ... returns an error,
  because a teammate's background work can't outlive the lead's process."

### Environment and permission limits

- "Permissions set at spawn:
   all teammates start with the lead's permission mode.
  You can change individual teammate modes after spawning,
  but you can't set per-teammate modes at spawn time."
- "Split panes require tmux or iTerm2:
   the default in-process mode works in any terminal.
  Split-pane mode isn't supported in VS Code's integrated terminal,
   Windows Terminal,
   or Ghostty."

### The spillover nobody opts into

The sharpest reason to keep the feature off by default is not in the Limitations section.
Enabling Agent Teams changes ordinary delegation:

> "while agent teams are enabled,
>  a subagent that Claude names launches as a teammate,
> so teams can form even when you didn't ask for one."

And the two differ in how results come back.
The documentation states this as a two-item list followed by a separate sentence,
flattened here into one quote:

> "Subagents:
>  Claude receives the subagent's result when it completes."
> "Teammates:
>  the idle notification reports that the teammate stopped,
>  without its output."
> "An orchestration flow that waits on subagent results can stall."

So turning the flag on silently converts a reliable result-forwarding path into one that does not forward
results at all,
for delegation the user never framed as team work.
That is a behavior change to unrelated workflows,
which is a strong argument for opt-in independent of any bug.

### Cost

The [cost management documentation page][costs-docs] gives the only quantified figure Anthropic publishes:

> "Agent teams use approximately 7x more tokens than standard sessions when teammates run in plan mode,
> because each teammate maintains its own context window and runs as a separate Claude instance."

This is design,
 not defect.
It is still a reason to gate:
a feature that multiplies spend sevenfold under a common configuration cannot be on by default.

## What the shipped code shows

The binary enforces the documented topology limits rather than merely documenting them,
each with its own telemetry category.
Literals below are verbatim from the extracted bundle,
including their dash characters:

```text
subagent_nested_teammate
  Teammates cannot spawn other teammates — the team roster is flat.
  To spawn a subagent instead, omit the `name` parameter.

subagent_teammate_background_denied
  In-process teammates cannot spawn background agents.
  Use run_in_background=false for synchronous subagents.

Agent tool description, teammate branch
  `name` is unavailable here — teammates cannot spawn teammates.

/rename in a teammate session
  Cannot rename: This session is a teammate. Teammate names are set by the team leader.
```

The binary also carries a limit the documentation page does not mention:

> "Background agents and teammates are not supported for this credential kind.
> Run this from the main session,
> or switch the desktop app to a profile-based or API-key credential"

More telling are the paths where the code admits its own state can be wrong.
Three verbatim literals,
 again including their dash characters:

```text
getTeammateModeFromSnapshot called before capture - this indicates an initialization bug

The permission request could not be delivered to the team lead (mailbox write failed).
Retry the tool call.

Couldn't open a teammate pane — running in-process instead.
```

Initialization order is not guaranteed.
`getTeammateModeFromSnapshot` passes that first literal to the error reporter,
then captures the setting lazily and continues with the `"in-process"` default.
The bug is named in the shipped artifact and handled fail-soft rather than fixed.

Permission requests can be lost in transit.
Two call sites resolve the permission promise with the second literal.
Because teammate permission prompts surface in the lead session,
a failed mailbox write means a teammate blocks on an approval nobody will ever see.

Backend selection degrades silently by design.
The third literal is a warning notification,
 not an error,
so a session asking for split panes can end up in a different execution mode than requested.

The transport underneath is a per-recipient JSON file with a sibling lockfile:
`writeToMailbox` computes `${inboxPath}.lock`,
creates the inbox with `writeExclusive`,
and logs `"Failed to write to inbox for ..."` on failure.
The documentation confirms the layout as `~/.claude/teams/{team-name}/inboxes/{agent-name}.json`.

**Interpretation caveat:**
an error string proves that a condition is represented and handled.
It does not prove that the condition is frequent,
 severe,
or the reason Anthropic withholds general availability.
None of the extracted text states a GA criterion.

## How much the feature has churned

Measured against `anthropics/claude-code` `CHANGELOG.md`,
which covers 365 releases from 0.2.21 through 2.1.233:

- 36 changelog lines mention a teammate or an agent team,
   spread across 26 releases.
- 29 of those 36 are `Fixed` or `Improved`;
   7 add or change behavior.
- 9 of the 36 mention a crash,
   leak,
   hang,
   memory problem,
   or loop.

The first entry sets the baseline:

> 2.1.32:
>  "Added research preview agent teams feature for multi-agent collaboration
> (token-intensive feature,
>  requires setting `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)"

npm published 2.1.32 on 2026-02-05 and 2.1.233 on 2026-08-14,
so the feature has been in research preview for roughly six months.
Counting `## ` headings in the changelog,
 160 releases shipped after 2.1.32.

The fixes are not cosmetic.
Grouped by what broke:

- Memory retention:
   2.1.50 (completed teammate tasks never garbage collected),
  2.1.63 (long-running teammates retained all messages after compaction),
  2.1.69 (parent's full conversation history pinned for the teammate's lifetime).
- Crashes and loops:
   2.1.34 (crash when the setting changed between renders),
  2.1.114 (crash in the permission dialog on a teammate request),
  2.1.207 (crash loop from one malformed mailbox message,
   recurring every second
  until the file was deleted by hand).
- Whole-provider breakage:
   2.1.41 and 2.1.45 (teammates failing on Bedrock,
   Vertex,
   and Foundry).
- Message delivery:
   2.1.224 fixed `SendMessage` "reporting `Message sent` when the write to a teammate's
  inbox had actually failed".
- Enforcement gaps:
   2.1.69 fixed "teammates accidentally spawning nested teammates",
  2.1.98 fixed team members not inheriting the leader's permission mode
  under `--dangerously-skip-permissions`.
- Non-interactive hangs:
   2.1.71 fixed `--print` "hanging forever when team agents are configured".
- Encoding:
   2.1.145 fixed teammates with non-ASCII names "failing every API call
  due to invalid header encoding".

The architecture also changed under existing users mid-preview.
Release 2.1.178,
 published 2026-06-15,
 removed the `TeamCreate` and `TeamDelete` tools entirely,
replaced explicit teams with one implicit team per session,
and left `team_name` "still accepted but ignored".
The documentation still carries a compatibility note about that change.
An interface that was replaced two months ago is a plain reason not to promise stability yet.

A crude size proxy across the versions installed locally,
counting case-insensitive `teammate` matches in each executable:
1179 at 2.1.226,
 1234 at 2.1.227,
 1240 at 2.1.228,
 1244 at 2.1.232,
 1246 at 2.1.233.
`swarm` moves 133 to 152 over the same span.
**Data quality note:**
 string counts track bundled text,
 including prompts and error messages,
not code volume,
and almost all of the movement is one jump between 2.1.226 and 2.1.227.
Read this as "still actively edited in the last week",
 not as a growth rate.

## What users report

GitHub `search/issues` against `anthropics/claude-code` on 2026-08-16:

- 928 issues match "agent teams" anywhere,
   205 of them open.
- 969 match "teammate" anywhere,
   249 open.
- 410 have "agent team" in the title.
- 63 open issues have "teammate" in the title.

**Data quality note:**
 the "anywhere" counts include comment text
and overstate how many issues are actually about the feature.
The title-scoped counts are the tighter measure.
High counts also reflect usage,
 not just breakage.

More useful than the counts is what the recent open titles cluster around.
Sampling the 30 most recently created open issues with a title match,
the same failure keeps reappearing under different names:
a teammate finishes work and the result does not reach the agent waiting for it.

- Results discarded on completion:
   #84527 ("In-process teammate's final text is discarded on idle,
  coordinator gets a payload-less `idle_notification`"),
  #86090 (named background teammate's final message "never delivered to the parent"),
  #86070 (teammate system prompt contradicts itself on result delivery,
   "reports silently lost").
- Delivery timing:
   #85963 ("Teammates ignore message inbox until end of task"),
  #83788 (messages sent during the busy-to-idle transition "never processed"),
  #84494 ("batched 40-min deliveries"),
  #87009 (completion notifications "delayed by tens of minutes,
   require manual nudge").
- False success:
   #85949 (`SendMessage` to `team-lead` "false-succeeds into an orphaned inbox").
- Live and persisted state diverging:
   #86518 (`members[]` never pruned across `/clear`),
  #86174 (`ListAgents` returns empty while the team is alive),
  #85955 (`background_tasks` never clears idle `in_process_teammate` entries).
- Configuration silently dropped:
   #81852 (`tools:` allowlist "enforced for subagents
  but silently dropped for named agents"),
  #83533 (teammate does not inherit project MCP tools),
  #86006 (`model` override "silently ignored" for background teammate sessions).
- Hook coverage gaps:
   #82418 (`PermissionRequest` hooks "never dispatched for agent-teams teammates"),
  #82665,
   #86285.
- Isolation:
   #84493 reports that worktree binding is session-scoped,
  so "any in-process teammate's `EnterWorktree`/`ExitWorktree` silently repoints every other agent
  in the session".

The isolation report deserves separate mention.
Teammates are described as independent Claude Code sessions,
and a reader can reasonably assume they isolate like separate sessions do.
If worktree binding is session-scoped,
 they do not.

## Local corroboration, and its limits

This repository already records a finding about the same substrate.
`doc/decision/general-purpose-subagent-ban.md` states that
"Programmatic steering via `SendMessage` is unreliable;
 in the last test it did not work
even though it is documented to",
and that `spawn-claude` result forwarding "is unreliable and needs manual monitoring".
The generated `CLAUDE.md` preamble repeats the `SendMessage` finding to every session.

That document is about general-purpose subagents and `spawn-claude` child sessions,
not about Agent Teams,
and it must not be cited as evidence about teams.
What it does corroborate is narrower and still relevant:
the `SendMessage` and result-forwarding machinery that Agent Teams is built on
has been observed unreliable in this repository,
independently of the tracker reports above.

## What this evidence does not establish

Stated with the same confidence as the findings.

- No fetched source says which limitation blocks general availability.
  The documentation enumerates limitations without ranking them or naming exit criteria,
  and Anthropic publishes no GA date.
  Every causal claim in this note is about what "experimental" protects against,
  not about Anthropic's internal decision.
- The live value of `tengu_amber_flint` is unknown.
  The local fallback is `true` and the evaluator is the embedded GrowthBook client;
  no live evaluation was observed.
- Error strings prove handling,
   not incidence.
  No failure rate,
   no latency figure,
   and no scale limit appears in the extracted text or the docs.
- Team-size ceilings,
   mailbox queue bounds,
   and lock-contention behavior were not located.
  The documentation says "There's no hard limit on the number of teammates" and recommends 3 to 5,
  which is guidance,
   not a measured limit.
- No team was run.
  Every claim about the binary is static reading of minified bundle text,
  and identifier names in the quoted snippet are mangled.
- Issue numbers are cited from titles returned by the search API.
  Individual reports were not reproduced,
   and maintainer triage status was not checked.

## Assessment

"Experimental" on Agent Teams is doing three jobs at once,
and collapsing them into "it's buggy" loses the useful part.

It is a support contract.
The documented limitations are behaviors Anthropic is telling you to work around by hand:
notice that a task never got marked complete,
 notice that the lead is messaging teammates
that stopped existing at `/resume`,
 wait out a slow shutdown.
Shipping that as general availability would mean promising it works unattended,
 which it does not.

It is an operational control.
The second gate is a server-evaluated flag over already-installed binaries,
which means Anthropic can withdraw the feature from every machine without a release.
A feature you keep a remote off switch on is a feature you are not finished underwriting.

It is a cost warning.
Roughly sevenfold token usage in plan mode,
plus the fact that enabling teams silently converts named subagents into teammates,
means the flag changes both spend and the semantics of delegation the user never asked to change.

Underneath the support-contract job,
 the technical core is narrower than the limitation list suggests,
and it is not about whether models can collaborate.
It is that the mailbox and lifecycle layer does not reliably deliver:
results arrive as payload-less idle notifications,
sends report success when the write failed,
inbox reads lag until a turn ends,
and the persisted team record drifts from the live one across `/clear` and `/resume`.
The documented limitations,
 the changelog fixes,
 and the open tracker
all point at that same layer.
Until delivery is dependable,
 everything built above it inherits the doubt,
which is a sufficient reason to keep the feature opt-in
without needing any statement about Anthropic's roadmap.

## What this means for this repository

Recorded as context,
 not as a decision.

- Enabling `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` here would change existing behavior,
  not just add a capability.
  The `CLAUDE.md` preamble currently tells agents that in-process subagents
  "forward their results back to you reliably".
  With the flag on,
   a subagent Claude names launches as a teammate instead,
  and per the documentation the lead then gets an idle notification without the output.
  That preamble would become wrong.
- The repository's existing preference for in-process subagents over `spawn-claude`
  rests on reliable result forwarding.
  Agent Teams sits on the far side of that same tradeoff:
  richer coordination,
   weaker forwarding.
- The failure the tracker reports most often against teams,
  a completed agent whose output never reaches the coordinator,
  is the failure this repository already documented for `spawn-claude`.
  Adopting teams would reintroduce a monitoring burden that
  `doc/decision/general-purpose-subagent-ban.md` was revised to remove.

[agent-teams-docs]: https://code.claude.com/docs/en/agent-teams
[costs-docs]: https://code.claude.com/docs/en/costs

# Stop hook design alternatives for long autonomous sessions

Status: proposal, 2026-10-19. Nothing here is adopted; the current six-label check stays in place.
Companion record of the current design: `doc/troubleshooting/claude-code-opus-5-premature-turn-end.md`.

## Question

The current hook reads the final message, asks Luna which of six situations it describes, and blocks on three of them.
Each missed phrasing needs another label, and adding the sixth label shifted probability mass between the others.
The question was whether something better matches what is wanted in long, mostly autonomous sessions:
a turn ends only for a user-only decision asked through `AskUserQuestion`, an empty queue, an explicit pause,
or a background task that will wake the session.

## What happens after a stop

Method: every top-level end-of-turn stop of the 5.5 models in this repository's session transcripts (2,320 stops),
labelled with the current production question (2,318 labelled), joined to the first later top-level transcript event.
Transcripts record the wake source as `origin.kind`:
`task-notification`, `peer` (subagent hand-back), `human`, or `auto-continuation`.
Older transcripts without `origin` are counted as human.
Scratch scripts: `~/temp/agent/wake.ts`, `label-all.ts`, `tab.cjs`, `signals.ts`.

Stops by label at probability 0.60 or higher:
1,454 `waits_on_background_work`, 151 `work_closed`, 110 `waits_on_user`, 47 `announces_own_next_step`,
28 `leaves_open_work`, 23 `pauses_for_handoff`, and 505 below the cutoff.

Background waits, the largest group:

- 54% were woken by a task notification (median 1.3 min, 90th percentile 16.8 min).
- 25% were woken by a subagent hand-back (median 8.6 min, 90th percentile 52.8 min).
- 21% were woken by a human message (median 1.7 min).
- Only 82 of the 1,454 (5.6%) were woken by a human after more than 10 minutes, the stall candidates.

The stall candidates are concentrated: 6 sessions, 4 of them holding 80 of the 82.
Their gap has quartiles of 20, 31 and 55 minutes and a 90th percentile also of 55 minutes, about 72 idle hours in total,
against about 340 hours of waiting before the first wake across all background waits.
A human message after 10 minutes may be the user returning, not a rescue, so this is an upper bound on stalls.
None of the hook-visible proxies separates them from the waits that resolved on their own:
a subagent in the turn (21% against 20%), a background shell (28% against 40%),
a cron or wakeup ever created in the session (73% against 68%), pending tasks (88% against 93%).

Consequence: releasing a background wait is right for about 94% of them,
and blocking all waits would add roughly 1,400 forced turns to reach 82 stalls.
A prior expectation that resumption by notification is rare was wrong on this corpus.

Other labels, by first wake:

- `waits_on_user`: 85% human, median 0.8 min.
- `announces_own_next_step`: 66% no later event, 23% human.
- `leaves_open_work`: 57% human, 29% of the group after more than 10 minutes.
- `pauses_for_handoff`: 48% human after more than 10 minutes, as expected for a user who is away.
- No later event is right-censoring, not proof that stopping was right.

## Deterministic signals at the stop

Crude transcript tracking of `TaskCreate`, `TaskUpdate` and `TodoWrite`;
the real list state is not stored in transcripts.

- A task list had been used by 88% of stops, and had pending items at 81%.
- Pending items by label: 93% of background waits, 94% of announces, 78% of pauses, 68% of open-work stops,
   36% of `work_closed`, and 31% of `waits_on_user`.
- `doc/handover` had been touched in the session at 84% of stops.
- Pending tasks therefore separate "closed" and "user" stops from the rest only weakly,
   and 55 of the 151 `work_closed` stops had pending items (stale lists or false closes; not audited).

## Precedent

Fetched and read:

- Claude Code `/goal` (`https://code.claude.com/docs/en/goal`): a session-scoped prompt-based Stop hook.
   A small model reads the condition and the conversation after each turn; it calls no tools.
   Evaluation is skipped while a subagent or background shell runs, the result arrives as a new turn,
   and a check-in fires after 30 minutes of background waiting, then at doubled intervals, at most three idle ones.
   This is the same architecture as ours, with a user-stated condition instead of a fixed taxonomy.
- Claude Code Stop input (`https://code.claude.com/docs/en/hooks`): `background_tasks`, `session_crons`,
   `last_assistant_message`, and a cap that ends the turn after eight consecutive blocked continuations.
- Anthropic, effective harnesses for long-running agents
   (`https://anthropic.com/engineering/effective-harnesses-for-long-running-agents`):
   a JSON feature list whose `passes` field only testing may flip; sessions pick the highest-priority unfinished item.
   Prompt-level, with no programmatic stop condition. Names "declares victory too early" as a failure mode.
- False success in LLM agents (`https://arxiv.org/abs/2606.09863`): judges reading closing text reach AUROC 0.65 or less
   on tau2-bench and 0.54 on AppWorld traces; a lightweight TF-IDF detector reaches 0.83 and 0.95.
   Different domains from coding stops, so it motivates a test rather than predicting our result.
- Progress reporting (`https://arxiv.org/abs/2609.08589`): frameworks should not control task flow on the strength of
   model state reports alone. This weakens a declared-exit protocol used without verification.
- Codex issue 36596 (`https://github.com/openai/codex/issues/36596`): the same early-stop failure,
   no maintainer response; a user proposed a host-owned continuation policy; `/goal` helps users.

From search snippets only, unverified against the source: Ralph loop (blocks until a literal completion string appears,
with an iteration cap), Codex `/goal` completion audit (map requirements to evidence), Long-Horizon-Terminal-Bench
(a hidden verifier runs after each stop and resumes the session with feedback), OpenHands stuck detector
(repetition patterns, with false positives on legitimate polling), LangGraph (recursion limit as a backstop).

No harness found treats this as solved. The common move is external evidence or a stated condition, not prose alone.

## Designs

Independent design pass by a second model, given the files and the numbers above:

- Obligation ledger, no model: a durable list of obligations with completion predicates and closing evidence;
   release on explicit pause, on obligations that all wait for live wake-capable jobs, or on all closed with evidence.
   Needs a task-setup protocol; a session without a ledger is unknown, not empty.
- Evidence-grounded next-action judge: ask which listed operation is justified and executable now,
   from candidates generated locally out of unfinished tasks, failed gates and recorded next steps.
   Separates candidate recall from judge accuracy.
- Local stop-risk detector: regularized linear model over text and state features, with a declared false-block budget.
   Needs adjudicated labels; "a human woke it" is not a valid label.

Shared rules it proposed: scope the work to what the user authorized; a background release needs a wake contract,
not only a running status; an earlier `AskUserQuestion` does not permit a stop;
challenge each unchanged evidence state at most once; budget releases are unresolved safety exits, not completion.

## Options

Ranking: standing condition with evidence > keep as is plus audit > ledger > detector.

- Use `/goal` today in long sessions, with a condition such as an empty queue in the handover
   or a user-only blocker asked through `AskUserQuestion`. No build. Limits: typed per session, a small model reading only what the conversation
   surfaced, and it cannot see a handover file the agent did not print.
- Keep the six-label check, add nothing, and measure first. It is right about background waits and has the cheapest
   failure mode. Its precision on the 75 announce and open-work stops is unmeasured.
- Standing-condition check by Luna, the `/goal` shape inside the repo hook, with the condition read from the handover.
   Needs a bounded evidence packet beyond the final message, which is a privacy decision.
- Watchdog for stalls instead of a classifier: when a wait is released and `session_crons` is empty, block once with a
   reason to arm a 30-minute fallback wakeup. On this corpus it could touch at most 22 of the 82 stalls
   (27% had no cron ever) at the price of about 440 extra forced turns, so it does not pay.

## Experiment that decides

A blinded audit of about 400 stops (all 82 stall candidates, 47 announces, 28 open-work stops, a stratified remainder),
where a reviewer sees only what was available at the stop and names a specific authorized next operation,
a specific user-only question, a legitimate release condition, or insufficient evidence.
Run the same actionability question in two offline arms, final message only and final message plus a bounded local
state packet (about 2 KB), and compare recall at matched false-block rates.
If the packet helps materially, sending it is justified; if not, broader disclosure is not,
and the investment is local state tracking or a local detector.

## Limits of this study

- One user's repository sessions, 5.5-series models only; the label accuracy of Luna is itself unmeasured.
- Wake classification uses the first later event; a notification may belong to a different task than the wait.
- Hook inputs (`background_tasks`, `session_crons`) are not stored in transcripts,
   so task-level proxies are approximate.
- The installed `pi` command (the auto-mode native host) failed on 2026-10-19 with `Cannot find package 'cross-spawn'`
   from its active release directory under `package/pi-plugin/auto-mode/dist`; a stock `pi` from a sibling package's
   `node_modules/.bin` was used for the second-model pass. Not investigated: that package has concurrent changes.

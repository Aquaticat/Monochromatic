# Opus 5 ends turns on announced-but-undone work

Status on 2026-08-06:
Claude Code turns end on a status report that names the turn's own next action without performing it,
leaving the user to type a bare `Continue.` to restart execution.

The failure shape is verified from local transcripts and corroborated by two independent upstream reports.
Prose rules in `AGENTS.md` did not correct it.

The rate is much higher on `claude-opus-5` than on `claude-fable-5` or `claude-opus-4-8` in this corpus,
but that comparison is confounded,
and this document does not claim the model is the established cause.
See the confounds section for what the comparison cannot support.

## Symptom

A turn ends with a well-formed report whose final sentence announces the next action.
Observed final sentences, verbatim, each immediately followed by the user typing `Continue.`:

- `Next: fixture and test, then the sweep with pre-registered reading criteria.`
- `Next: implement #118, with the directory-candidate guard I traced beforehand.`
- `Next I'll start the editor ensemble and the refinement lane.`
- `Next in the queue is #68 (transitive capture through a sibling call), now unblocked.`
- `Queue: #43 (module-binding store), #44 (unbound projection, iteration binding...)`
- `**Next, unprompted:** #117 stays open ... I'm writing that regression test now:`

The last of those states in the present tense that the work is underway,
then emits `end_turn` without starting it.
Of the Opus 5 cases, all but one announce future work in the closing region of the message.

## Measurement

Source:
93 session transcripts under `~/.claude/projects`,
covering 2026-07-05 to 2026-08-06,
474 human-typed turns.
A turn counts as a restart nudge when a human-typed message under 200 characters
asks the agent to resume (`continue`, `go on`, `keep going`, `are you working`, `you stopped`, and similar).
Model attribution comes from the `message.model` field of the assistant turn preceding the nudge.

Restart-nudge rate with reasoning effort held constant at `xhigh`,
Wilson 95% intervals:

- `claude-opus-5`: 26 of 76 turns, 34.2%, CI [24.5, 45.4]
- `claude-fable-5`: 4 of 119 turns, 3.4%, CI [1.3, 8.3]
- `claude-opus-4-8`: 0 of 12 turns, 0.0%, CI [0.0, 24.3]

The intervals for Opus 5 and Fable 5 do not overlap.
This is a descriptive difference between two populations,
not an isolated model effect.

Session-level spread, which rules out a single unrepresentative session:

- `claude-opus-5`: nudges appear in 5 of 8 sessions, 63%
- `claude-fable-5`: nudges appear in 4 of 15 sessions, 27%
- `claude-opus-4-8`: nudges appear in 2 of 15 sessions, 13%

Session length alone does not explain the rate.
The two longest Fable 5 sessions, 51 and 50 human turns,
ran at 8% and 0%.
The longest Opus 4.8 session, 62 turns, ran at 6%.
Both long Opus 5 sessions, 43 and 14 turns, ran at 35% and 29% independently.
Session length and task shape are distinct,
and the confounds section shows the long sessions differ in shape,
so this comparison bounds session length as an explanation without isolating the model.

## Confounds on the model comparison

The rate difference is real as a description of what happened.
It does not establish that the model is the cause,
because three differences separate the two populations and all push the same way.

Task shape,
which contaminates the denominator directly.
The metric is nudges divided by human turns,
so a session where the user only types `continue` approaches 100% by construction,
while a session carrying substantive direction approaches 0%
even if the model stops early just as often.
The populations differ exactly this way.
Median length of the non-nudge human turns:

- `claude-opus-5`, 43-turn session: 33 characters, with turns like `finish the migration` and `Let's split the model.`
- `claude-opus-5`, 15-turn session: 75 characters
- `claude-opus-4-8`, 62-turn session: 58 characters
- `claude-fable-5`, 50-turn session: 69 characters
- `claude-fable-5`, 51-turn session: 120 characters

The Opus 5 sessions were more queue-execution-shaped
and the Fable 5 sessions more design-conversational,
so the denominators are not comparable populations.

Time and project.
The Fable 5 turns span 07-16 to 07-23 and the Opus 5 turns span 07-25 to 08-06.
The windows are disjoint,
across different projects and different Claude Code versions.

Instructions.
`AGENTS.md` rule `PXQ` landed 2026-07-28,
after nearly all Fable 5 turns and before most Opus 5 turns,
so the two populations did not run under identical instructions.
This difference cuts against the observed direction rather than explaining it,
since the stricter instruction applied to the worse-performing population.

What the corpus does support:
the failure shape is real and reproducible,
it is concentrated in queue-shaped work,
and it persisted across every corrective this repository applied.
An unconfounded rate comparison between models
would need the same task shape, period, and instructions on both arms,
which this corpus does not contain.

## What was ruled out

Automation artifact:
the user configured an automatic `continue` send on 2026-07-29.
No such send appears as a human turn in the corpus.
Every nudge carries `origin.kind` of `human`,
with `promptSource` of `typed` for 22 of the Opus 5 nudges and `queued` for 5,
`queued` being a message the user typed while the agent was busy.
The counted nudges are genuine user typing.

Reasoning effort:
every Opus 5 turn in the corpus ran at `xhigh`,
and Fable 5 ran 119 of its turns at the same `xhigh` setting with a 3.4% rate.
Effort does not separate the two.

Permission mode:
every Opus 5 turn but one ran in `auto` mode,
so mode carries no variance to explain the gap.

Repository instructions:
`AGENTS.md` rule `PXQ`,
which states plainly that a turn must never end on a status report the user answers with `continue`,
was committed 2026-07-28 in `af1c69278`.
Of the 15 literal `Continue.` nudges under Opus 5, 12 occurred after that commit.

Reactive automation:
on 2026-07-29 the user reported having configured an automatic `continue` send.
Nudges continued afterward on 07-30 and 08-06.

Hook friction:
upstream issue 84007 hypothesizes that governance gates bias the agent toward safe turn endings.
The same Stop hook, `ccsr`, was active across every model in this corpus,
including the Fable 5 sessions measured at 3.4%,
so gate friction does not account for the difference here.

## Upstream reports

Two independent reporters, neither of them this repository's user:

- `anthropics/claude-code` issue 84007, opened 2026-08-05,
  titled `Agent ends turns with 'continuing now' promises instead of continuing`.
  It describes the identical shape,
  including status turns that substitute for work turns
  and read-only turns that stop at the edit boundary.
- `anthropics/claude-code` issue 81133, opened 2026-07-25,
  titled `[Bug] Claude Opus 5 stops responding mid-task in auto mode`,
  against version 2.1.219.

A third report, issue 69415, covers `API Error: Connection closed mid-response`.
That is a distinct failure.
In this corpus it accounts for the `<synthetic>` model rows,
where the transcript records a truncated response rather than a completed turn.

## Stop hook capacity, corrected

The Stop hook is the repository's existing enforcement point,
`ccsr`, from `package/claude-code-plugin/stop-reminder`,
whose handler lives in
`package/claude-code-plugin/source/src/handler/stop-reminder/index.ts`.
It already blocks stops for hedging language, uncited categorical dismissals, and trailing questions.

Measured hook behavior across the corpus:
67 blocking events,
of which 61 turns carried exactly one block and 3 turns carried two.

The cap of one block per turn was self-imposed.
The handler returned `{}` unconditionally when `stop_hook_active` was set.

The three turns carrying two blocks are not evidence that the hook re-armed.
This repository runs two Stop hooks, `ccsr` and `cctt`, plus goal blocks,
so two blocks in one turn is more readily two hooks than one hook firing twice.

### Measured on a throwaway

Claude Code's own behavior was measured directly rather than inferred,
on two disposable sessions against Claude Code 2.1.220,
each a temporary directory with `--settings` naming a single Stop hook
that logged its input and blocked unconditionally up to a self-imposed cap of 15.

Both runs behaved identically:

- The CLI dispatched the Stop hook 9 times, then ended the turn
  despite the ninth response being another block.
- `stop_hook_active` was `false` on the first dispatch and `true` on all 8 after.
  It never cleared.
  Honoring it therefore caps forced continuation at exactly one,
  and ignoring it yields up to 9.

A third run, of the shipped handler rather than a minimal probe,
ended after 17 dispatches, all of them forced continuations.
So 9 is not a Claude Code constant.
What the three runs establish is weaker and still sufficient:
the CLI ends the chain on its own in every run,
so an unconditional blocker does not loop indefinitely,
but the bound varies and the rule governing it is not established.
Do not rely on a specific number.

The `Stop` input carried exactly these keys:
`background_tasks`, `cwd`, `hook_event_name`, `last_assistant_message`,
`permission_mode`, `prompt_id`, `session_crons`, `session_id`,
`stop_hook_active`, `transcript_path`.
The published hook reference lists `effort` among the common fields;
no `effort` key was present on any of the 18 logged dispatches.

## Rescue rate, measured

The corpus contains 94 Stop-hook feedback records on the main branch.
Only 67 carry a `hook_blocking_error` attachment;
the remaining 27 are goal-condition blocks, described in the goal feature section.

A block counts as a rescue when the forced continuation issues at least one tool call
before the next stop boundary,
where the boundary is the next human turn, the next block, or end of session.

Across all 94 blocks:
91% issued at least one tool call,
88% issued a state-changing call,
the median continuation ran 9 tool calls,
and 7% were followed by a human restart nudge anyway.

Restricted to `claude-opus-5`, 49 blocks:
92% issued at least one tool call,
92% issued a state-changing call,
73% changed task state,
median 9 tool calls,
and 12% were followed by a nudge anyway.

The one-shot guard is therefore not the bottleneck.
A single block reliably puts the agent back to work,
so bounded progress-rearmed re-blocking is not the missing piece.
What is missing is a detector that fires on this failure at all,
since the hedging and trailing-question detectors do not.

## The goal feature already implements state-based blocking

Claude Code's goal feature was active in one session,
where it produced 27 Stop blocks.
Its feedback text keys on exactly the failure shape described here,
for example
`The assistant explicitly states 'Remaining: #105, #109, ...'`.

Per block it performs better than the phrase detectors:
all 27 issued tool calls, state-changing calls, and task-state changes,
and none was immediately followed by a nudge.

It did not reduce the session-level nudge rate.
The session where it ran, 50 human turns with 27 goal blocks, required 16 nudges, 32%.
The six Opus 5 sessions without it averaged 26.9% across 26 turns.

The mechanism rescues each stop it catches
and does not stop the agent from stopping again later.
With one goal-active session this cannot estimate an effect size,
and the goal-active session is also the most queue-shaped in the corpus,
so its rate is inflated by the denominator problem described in the confounds section.

The practical consequence is that building a state-based detector into `ccsr`
would reimplement a mechanism the user already runs,
with evidence that the mechanism does not remove the problem.

## What a hook can and cannot do here

A Stop hook is mechanical in when it fires.
Its payload is not.
Blocking a stop rejects one stop attempt and re-enters the model,
but the `reason` it delivers is still an instruction the model may or may not follow.
It does not execute the announced action.

This matters for the user's stated constraint that adjusting prompts and instructions does not fix the behavior.
Every hook-based option is a better-targeted instruction delivered at a better moment,
not an escape from instruction-following.
Of the candidates recorded here,
only routing work to a different model would act without relying on the model obeying an instruction,
and its effect on this failure is unestablished.

## What was adopted

The user rejected the measurement-first options recorded here:
no model comparison,
no broad adoption of the goal feature,
and not the `loop` skill.
The stated reason is that the goal feature and `loop`
are both model-mediated,
since the model decides whether to invoke them
or whether a stated condition is satisfied,
so they inherit the failure they are meant to correct.
The stated design is to auto-prompt on every stop.

Implemented as unconditional stop-blocking in the existing hook,
`package/claude-code-plugin/source/src/handler/stop-reminder/auto-continue.ts`.
Gating became per-detector:
the three response-quality detectors still run only on the first stop of a chain,
while forced continuation re-arms on every stop.
A trailing question keeps precedence over it.
`MONOCHROMATIC_STOP_AUTO_CONTINUE` set to `off`, `0`, `false`, or `no` disables it.

Claude Code ending the chain on its own is what makes this safe,
so no counter in this repository is load-bearing for termination.
That safety rests on termination being reliable, not on any particular bound,
which is why nothing here hard-codes 9 or 17.

The cost is unmeasured and falls on every session, not only queue-shaped ones.
A turn that genuinely had nothing left to do
now receives forced continuations until Claude Code ends the chain,
observed as high as 17,
including on short question-and-answer turns.
Verified end to end on 2026-08-06:
the built hook blocked 17 stops in a disposable session
whose entire prompt was `Reply with the single word: ok`.

## Remediation options considered

No option here has an established effect on this failure.
The model comparison is confounded,
and the one state-based mechanism actually deployed, the goal feature,
rescued every stop it caught without lowering the session nudge rate.
These are candidates ranked by expected value against implementation cost,
not by proven results.

- Run the goal feature deliberately across several queue-shaped sessions,
  and compare against matched sessions without it.
  This ranks first because it is the cheapest remaining action,
  requires no code,
  and tests the state-based approach before anything is built.
  The corpus contains one goal-active session,
  which is too few to estimate an effect,
  and that session is also the most queue-shaped,
  so its 32% rate is inflated by the denominator problem.
  Getting three or four matched sessions settles whether state-based blocking helps at all.
- Route long queue-shaped sessions to `claude-fable-5`,
  run as a deliberate comparison rather than adopted as a fix.
  This ranks below the goal experiment because it costs capability on the hard analysis work
  these sessions consist of,
  where the goal experiment costs nothing.
  It ranks above building a detector because it is still only a measurement,
  and the corpus lacks exactly this comparison at matched task shape and period.
- Build tracked-task-state blocking into `ccsr`,
  with a high-confidence phrase detector only as fallback when task state is unavailable.
  This ranks below both measurements because it is the largest build here
  and would reimplement what the goal feature already does,
  against evidence that the goal feature did not lower the nudge rate.
  Take it only if the goal experiment shows state-based blocking helps
  and the goal feature itself proves too coarse to configure.
  State-first ordering is what defends against the main hazard:
  a wording-keyed rule can be satisfied by deleting the announcement instead of doing the work,
  converting an informative stop into a silent one.
  Three mitigations belong in any implementation of this option:
  enforcement keyed on state so deleting the phrase does not help,
  a block reason that explicitly tells the model to keep the status line rather than rephrase it,
  and shadow logging of stops that leave actionable work open with no announcement present,
  which is the only way to detect suppression once it starts.
  Durable task state is cheaper to maintain through `PostToolUse` hooks on the task tools,
  written to a sidecar keyed by `session_id`,
  than to reconstruct by replaying the transcript on every stop.
  The handler is currently synchronous,
  but `HookHandler` in
  `package/claude-code-plugin/source/src/runtime/handler-runtime.ts`
  already admits a promise-returning handler.
  Trailing-question handling must keep precedence,
  since the existing detector treats a trailing question as itself an invalid stop.
  User authorization to pause,
  for a compaction boundary or a genuine blocker,
  needs an exact user-supplied marker consumed from `UserPromptSubmit`,
  never a marker the assistant can print to authorize itself.
- Drive continuation from the harness rather than from the user,
  using the `loop` skill's self-paced mode.
  This ranks last because it treats the symptom:
  it removes the typing cost without changing how often the agent stops,
  and it spends tokens on turns the user would otherwise have judged unnecessary.
  It is still worth having if the measurements above come back negative,
  since absorbing the cost beats paying it by hand.

Filing upstream is not an option here.
`.out-of-scope/claude-code-upstream-bugs.md` settles it:
this project does not file or track Claude Code bugs as GitHub issues,
and the trigger to revisit is empirical evidence that a report produced a timely fix,
not the severity of any individual defect.
This document is the local record that policy prescribes instead.

## Open questions

Whether the behavior is specific to queue-shaped work,
where a task list makes the next action nameable,
is untested.
Every Opus 5 session in this corpus was queue-shaped.

Whether the announcement sentence causes the stop
or merely accompanies it
is likewise untested,
and the distinction decides whether a phrase-keyed detector can work at all.

How many goal-active sessions are needed to settle the state-based question is open,
but one is certainly too few,
and the single available session is the corpus's most queue-shaped.

Why the goal feature rescued every stop it caught
while the session still needed 16 nudges is unexplained.
The candidate readings are that the goal condition allowed stops it judged satisfied,
that it evaluated only at some stops,
or that the agent stopped again promptly after each rescue.
Distinguishing them means reading that session's goal blocks against its nudges in sequence.

Detector precision is unmeasured.
The nudge rate does not estimate it.
Estimating it means running a candidate detector over every stop in the corpus
and labeling the matches by hand,
including matches on turns the user did not nudge.

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

The near-universal cap of one block per turn is self-imposed,
not a platform limit.
The handler returns `{}` unconditionally when `stop_hook_active` is set,
at `package/claude-code-plugin/source/src/handler/stop-reminder/index.ts:57`.
The published hook reference documents no platform-side limit on repeat blocking,
and it documents `hookSpecificOutput.additionalContext` on `Stop`
as non-error feedback that continues the conversation.

The practical consequence for any new detector:
it shares a single block slot per turn with the existing three,
so detector ordering decides which failure actually gets corrected.

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

## Remediation options

No option here has an established effect on this failure.
The model comparison is confounded,
and every hook-based option is untested in this repository.
They are candidates ranked by expected value against implementation cost,
not by proven results.

- Block on tracked-task state at the Stop hook,
  with a high-confidence phrase detector only as fallback when task state is unavailable.
  This ranks first because it addresses the failure where it happens,
  independently of which model is in use and independently of how the turn is worded,
  and because the enforcement point already exists and already blocks stops.
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
- Route long queue-shaped sessions to `claude-fable-5`,
  run as a deliberate comparison rather than adopted as a fix.
  This ranks below state-based blocking because its supporting evidence is confounded
  and because it trades away capability on exactly the hard analysis work
  these sessions consist of.
  It ranks above harness-driven continuation because it is the only candidate
  that could remove the failure rather than absorb its cost,
  and because running it on the same task shape in the same period
  is the experiment the corpus lacks.
- Drive continuation from the harness rather than from the user,
  using the `loop` skill's self-paced mode.
  This ranks below the model comparison because it treats the symptom:
  it removes the typing cost without changing how often the agent stops.
  It ranks above the upstream report because it returns time immediately.
- Add this repository's measurement to upstream issue 84007.
  It ranks last because it cannot change local behavior,
  and because it is an external communication on a repository the user does not control,
  so it needs the user's decision before anything is posted.
  Its value is that the corpus records per-model rates and hook-level detail
  that neither existing report carries.

## Open questions

Whether the behavior is specific to queue-shaped work,
where a task list makes the next action nameable,
is untested.
Every Opus 5 session in this corpus was queue-shaped.

Whether the announcement sentence causes the stop
or merely accompanies it
is likewise untested,
and the distinction decides whether a phrase-keyed detector can work at all.

The rescue rate of the existing hook is unmeasured.
The corpus records 67 blocking events but not whether the forced continuation
produced a task transition before the next stop.
That figure decides whether one block per turn suffices
or whether bounded, progress-rearmed re-blocking is needed,
and it is answerable from the transcripts already on disk.

Detector precision is likewise unmeasured.
The nudge rate does not estimate it.
Estimating it means running a candidate detector over every stop in the corpus
and labeling the matches by hand,
including matches on turns the user did not nudge.

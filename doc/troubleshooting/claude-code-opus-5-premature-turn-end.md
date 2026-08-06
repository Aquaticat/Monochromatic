# Opus 5 ends turns on announced-but-undone work

Status on 2026-08-06:
Claude Code sessions running `claude-opus-5` end turns roughly ten times more often
on a status report that names its own next action without performing it,
compared with `claude-fable-5` and `claude-opus-4-8` under identical settings.
The user has to type a bare `Continue.` to restart execution.

This is a model-behavior finding measured from local transcripts,
corroborated by two independent upstream reports.
It is not a configuration defect in this repository,
and prose rules in `AGENTS.md` did not correct it.

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

Session-level spread, which rules out a single unrepresentative session:

- `claude-opus-5`: nudges appear in 5 of 8 sessions, 63%
- `claude-fable-5`: nudges appear in 4 of 15 sessions, 27%
- `claude-opus-4-8`: nudges appear in 2 of 15 sessions, 13%

Long queue-driven sessions are not the cause.
The two longest Fable 5 sessions, 51 and 50 human turns,
ran at 8% and 0%.
The longest Opus 4.8 session, 62 turns, ran at 6%.
Both long Opus 5 sessions, 43 and 14 turns, ran at 35% and 29% independently.

## What was ruled out

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
Of the candidates recorded here,
only routing work to a different model changes outcomes without relying on the model obeying an instruction.
Every hook-based option is a better-targeted instruction delivered at a better moment,
not an escape from instruction-following.

## Remediation options

Ranked by measured effect,
strongest first.
Only the first has a measured effect size in this corpus;
the rest are untested here and are recorded as candidates, not as recommendations proven to work.

- Route long queue-driven sessions to `claude-fable-5`.
  This is the only intervention with a measured effect,
  3.4% against 34.2% at identical effort, hooks, and instructions.
  Cost: a different capability profile on hard analysis work,
  which this corpus does not measure.
- Block on tracked-task state rather than on wording,
  with a high-confidence phrase detector only as fallback when task state is unavailable.
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
  This removes the typing cost without claiming to fix the underlying stop.
- Add this repository's measurement to upstream issue 84007.
  The measurement isolates the model variable,
  which neither existing report does.

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

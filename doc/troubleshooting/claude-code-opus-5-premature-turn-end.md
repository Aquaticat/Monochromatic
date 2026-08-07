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

Two counting bases appear in this document and they do not agree,
so every figure names which one it uses.
Model-attributed counting keeps only the human turns whose preceding assistant turn ran the named model.
Whole-session counting keeps every human turn in the transcript.
Sessions switch models, so the same session yields different totals:
the longest Opus 5 session is 43 turns with 15 nudges model-attributed,
and 50 turns with 16 nudges whole-session.
Figures in this section are model-attributed.
Comparing a figure from one basis against a figure from the other is not valid,
and doing so is the defect retracted in the goal feature section.

The session in which this investigation ran is excluded from every figure.
Its human turns are responses to the investigation rather than instances of the failure,
and it grew while being measured:
figures first recorded as 26 of 76 turns and 5 of 8 sessions
drifted to 27 of 82 and 5 of 9 within the same working session.
Excluding it makes the numbers reproducible.
Any rerun must exclude the session doing the rerunning.

Restart-nudge rate with reasoning effort held constant at `xhigh`,
Wilson 95% intervals:

- `claude-opus-5`: 27 of 80 turns, 33.8%, CI [24.3, 44.6]
- `claude-fable-5`: 4 of 119 turns, 3.4%, CI [1.3, 8.3]
- `claude-opus-4-8`: 0 of 12 turns, 0.0%, CI [0.0, 24.3]

The intervals for Opus 5 and Fable 5 do not overlap.
This is a descriptive difference between two populations,
not an isolated model effect.

Session-level spread, which rules out a single unrepresentative session.
A session counts for a model when any human turn in it was attributed to that model,
so a session running several models counts for each and the totals overlap:

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

Every model-attributed session of at least 14 turns is listed,
so the comparison is not a selected subset:

- `claude-opus-5`, 43-turn session: 33 characters, with turns like `finish the migration` and `Let's split the model.`
- `claude-opus-5`, 15-turn session: 75 characters
- `claude-opus-4-8`, 62-turn session: 58 characters
- `claude-fable-5`, 50-turn session: 69 characters
- `claude-fable-5`, 51-turn session: 120 characters
- `claude-fable-5`, 27-turn session: 155 characters

Session sizes here are model-attributed.
The gap between the bases is large for the second Opus 5 session,
which is 15 turns model-attributed and 82 whole-session,
so these sessions were heavily multi-model
and the medians describe the model-attributed slice rather than the session as a whole.

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
Counting only turns whose entire text is some spelling of `continue`,
a stricter set than the restart-nudge definition used elsewhere,
Opus 5 drew 16 of them and 13 came after that commit.
An earlier revision said 15 and 12,
which mixed a snapshot taken before the corpus was pinned
with a nudge set that also admitted `go ahead`.

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
  and ignoring it yields as many continuations as Claude Code allows,
  which is not a fixed number.

A third run, of the shipped handler rather than a minimal probe,
ended after 17 dispatches, all of them forced continuations.
So 9 is not a Claude Code constant.

A fourth run refines the claim.
Its hook blocked unconditionally up to a self-imposed cap of 30,
and its block reason told the agent to run one shell command before continuing.
It reached 31 dispatches with 31 `Bash` calls across 124 assistant turns,
and stopped only because the probe's own cap fired.

Claude Code does have a cap.
`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` is present in the 2.1.224 binary,
alongside the override message
`A hook blocked the turn from ending`.
An earlier revision of this document concluded no cap existed,
on the strength of the 31-dispatch run alone.

The cap bounds an idle loop, not a busy one.
The runs overridden at 9 produced no tool calls and repeated a one-word reply;
the run that reached 31 worked on every continuation.
So a hook that keeps a busy agent blocked is not bounded by the platform,
and must bound itself.
That is the case that costs real money,
which is why the depth guard stays even though the platform cap exists.

The `Stop` input carried exactly these keys:
`background_tasks`, `cwd`, `hook_event_name`, `last_assistant_message`,
`permission_mode`, `prompt_id`, `session_crons`, `session_id`,
`stop_hook_active`, `transcript_path`.

### Undocumented Stop fields

Two of those keys are absent from the published hook reference,
and one of them turned out to carry the signal this whole mechanism needed.

`background_tasks` is an array of objects shaped like this,
captured by dumping a live payload on 2.1.224
while a backgrounded shell command ran:

```json
[
  {
    "id": "b6ldjvy2v",
    "type": "shell",
    "status": "running",
    "description": "Sleep for 60 seconds in background",
    "command": "sleep 60"
  }
]
```

A `status` of `running` is the only reliable way a Stop hook can tell
that the session is waiting on something another turn cannot advance.
Without it the hook has no way to distinguish
an agent that stopped early from one that stopped because it is blocked,
which is exactly the confusion that produced the eleven-turn incident.

`session_crons` is an empty array when no scheduled jobs exist;
its populated shape is unmeasured.

Both are now declared in
`package/claude-code-plugin/hook-type/src/events-agent.ts`.
The published reference also lists `effort` among the common fields,
which was absent from every payload observed here.
The published hook reference lists `effort` among the common fields;
no `effort` key was present on any of the 18 logged dispatches.

## Rescue rate, measured

These figures come from a snapshot taken before forced continuation shipped,
and the investigating session contributed no blocks to it,
so they carry none of the drift the measurement section describes.
A rerun today would not reproduce them:
this repository's own hook now emits Stop feedback on every turn.

The corpus contains 94 Stop-hook feedback records on the main branch.
Only 67 carry a `hook_blocking_error` attachment;
the remaining 27 are goal-condition blocks, described in the goal feature section.

A block counts as a rescue when the forced continuation issues at least one tool call
before the next stop boundary,
where the boundary is the next human turn, the next block, or end of session.

Pooling every block hides the difference that matters,
so the figures are given by block type.
An earlier revision of this document reported only the pooled rates,
which overstated the case:
the goal blocks score perfectly on every metric and carry the pooled average.

Across all 94 blocks:
91% issued at least one tool call,
88% issued a state-changing call,
the median continuation ran 9 tool calls,
and 7% were followed by a human restart nudge anyway.

Split by what did the blocking:

- Goal-condition blocks, 27:
  100% issued a tool call,
  100% issued a state-changing call,
  100% changed task state,
  and none was followed by a nudge.
- `ccsr` text-detector blocks, 67:
  88% issued a tool call,
  84% issued a state-changing call,
  25% changed task state,
  and 10% were followed by a nudge anyway.

Restricted to `claude-opus-5`, 49 blocks, the same split is sharper:

- Goal-condition blocks, 27: 100% on every metric, none nudged again.
- `ccsr` text-detector blocks, 22:
  82% issued a tool call,
  82% issued a state-changing call,
  41% changed task state,
  and 27% were followed by a nudge anyway.

Neither figure is a clean prior for unconditional blocking,
which conditions on neither text nor state and had no instance in the corpus.
The text-detector rate is the more conservative of the two
and the closer analogue in that it also fires without consulting task state.

The one-shot guard is therefore not the main bottleneck,
though it is not irrelevant either.
A single block puts the agent back to work in the large majority of cases,
and on the closest analogue, Opus 5 text-detector blocks,
roughly one block in five produced no tool call
and roughly one in four was followed by a nudge regardless.
So bounded progress-rearmed re-blocking would recover something,
but it is second-order next to the larger gap:
no detector fired on this failure at all,
since the hedging and trailing-question detectors do not look for it.

An earlier revision said a single block "reliably" restores work
and concluded re-blocking was not the missing piece.
That sentence was written against the pooled rate
and was left standing when the pooled rate was disaggregated.

## The goal feature already implements state-based blocking

Claude Code's goal feature was active in one session,
where it produced 27 Stop blocks.
Its feedback text keys on exactly the failure shape described here,
for example
`The assistant explicitly states 'Remaining: #105, #109, ...'`.

Per block it performs better than the phrase detectors:
all 27 issued tool calls, state-changing calls, and task-state changes,
and none was immediately followed by a nudge.

It did not prevent the session from needing nudges.
The session where it ran took 16 restart nudges across its 50 human turns
despite 27 goal blocks.

An earlier revision of this document compared that against
a 26.9% average over the Opus 5 sessions without the feature.
That comparison is retracted.
It grouped sessions by dominant model while counting turns on a different basis per arm,
so the two rates were not measured the same way.
The corpus cannot support a goal-active against goal-absent rate comparison.

What survives is narrower:
the goal feature rescued every stop it caught,
and the one session that ran it still required 16 nudges.
The mechanism rescues each stop it catches
and does not stop the agent from stopping again later.

Any recomputation from here needs care,
because forced continuation now emits Stop feedback
that a text classifier cannot distinguish from a goal block.
Sessions after 2026-08-06 will show apparent goal blocks that are this repository's own hook.

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

### What this does not achieve

The stated goal was that auto-prompting on every stop would eventually finish the work.
Unconditional blocking does not reach that,
and the gap is structural rather than a tuning problem.

A Stop hook extends the current turn.
When the chain ends, at the depth limit or because the agent stopped producing work,
the session idles waiting for the user exactly as before.
So the mechanism converts one user turn into many agent turns;
it does not remove the need for the next user turn.
Raising the limit buys more agent turns per user turn
and never removes the last one,
which is why this gap is structural rather than a matter of tuning.

No hook can close that gap.
All 16 hook events fire in reaction to something already happening,
and every output field they carry
(`decision`, `reason`, `additionalContext`, `systemMessage`)
modifies the turn in progress.
None starts a turn.
The `prompt` field in `UserPromptSubmit` is input describing a prompt the user already submitted,
not an output that creates one.

Closing the gap therefore needs a driver outside the hook system,
something that submits a fresh prompt once the chain ends.
The `loop` skill is the in-harness form of that.
It was rejected as model-mediated,
which is accurate about its invocation:
the model decides to start it.
Its subsequent firings are scheduled by the harness rather than chosen by the model,
so the rejection applies to starting the loop and not to sustaining it.
That distinction is recorded because it decides whether the option is actually foreclosed.

### Releasing, not only bounding

The first version had a depth bound and no release condition,
which produced the opposite waste from a runaway.
Reported from a real session:
blocked on a long-running process with nothing else to do,
the hook forced eleven turns that each restated the same blocker,
until Claude Code's cap overrode it.

Three releases now apply, each read from state rather than from the response text
and none asking the agent whether it considers itself finished:

- A background task is running,
  so the session waits on something another turn cannot advance.
  `background_tasks` carries this on the `Stop` event
  and was missing from this repository's `StopInput` type until then.
- The previous forced continuation issued no tool call,
  so pushing bought prose rather than work.
  One push is the threshold because a second rarely recovers:
  of the blocks in this corpus whose push produced no tool call
  and were followed by another block,
  only 2 of 9 second pushes produced work, 22%.
  The sample is small,
  so that argues against pushing twice rather than establishing a rate.
  The accepted cost is that an agent answering a block with another announcement
  is released, which is the original failure slipping through;
  the other two releases do not have that weakness
  and cover the cases this one was added for.
- Every tracked task is finished,
  replayed from `TaskCreate` results and `TaskUpdate` calls.
  An absent task list is deliberately not treated as finished,
  since most sessions never create one.

The block reason also routes a decision-blocked agent to `AskUserQuestion`.
That tool waits for the user,
so it is the one exit that gets the agent what stopping was reaching for,
and the hook has nothing to refuse.
This reframes the mechanism from forbidding a stop
to naming the right tool for what the agent wanted.

### Bounding

Termination is shared with Claude Code rather than delegated to it.
The first version shipped without a bound,
on the belief that the CLI enforced one,
and that belief was wrong in the direction that mattered.
`continuation-depth.ts` now counts this hook's own feedback records
since the last human turn and allows the stop at the limit,
default 25,
overridden with `MONOCHROMATIC_STOP_AUTO_CONTINUE_MAX`.

Two implementation notes worth keeping,
both found by exercising the built hook rather than by unit tests:

- Each block writes its reason to the transcript twice,
  once as the feedback record fed back to the model
  and once inside a `hook_blocking_error` attachment.
  Counting both halves the effective limit.
  Verified live at a limit of 4, which produced exactly 4 blocks.
- Making the handler asynchronous broke the kill-switch tests,
  which had mutated `process.env` and now raced across the await.
  The policy was split into a pure function taking its inputs as parameters,
  so no test touches process state.

The cost falls on every session, not only queue-shaped ones.
A turn that genuinely had nothing left to do
now receives forced continuations up to the depth limit,
including on short question-and-answer turns.
Before the depth guard existed the ceiling was whatever the agent's own idleness produced,
which is what the 17-block figure below measures;
that figure describes the unbounded version and is kept as the record of it.
Verified end to end on 2026-08-06:
the built hook blocked 17 stops in a disposable session
whose entire prompt was `Reply with the single word: ok`,
where the agent visibly cast around for work that did not exist.

### First observation on a real session

The session that built this feature then ran under it,
which is the only observation of unconditional blocking on real work.
Measured from its own transcript through block 14,
at which point counting was deliberately stopped for the reason given below:
14 forced-continuation blocks,
against 3 human turns,
producing 13 commits.

The yield was not uniform,
and the shape of the decline is the useful part.
The first 10 blocks each produced a committed fix.
The finds included two wrong published figures,
a retracted comparison built on mixed counting bases,
an unpinned corpus that was drifting while being measured,
and several conclusion sentences left standing after the numbers beneath them were corrected.
Blocks 11 and 12 still found real defects,
including a retracted claim surviving in source rather than prose.
Block 13 found nothing:
every check it ran confirmed existing work was already correct.
Yield therefore fell to zero once the session's unexamined surface was exhausted,
after roughly a dozen blocks on an unusually deep backlog of unverified assertions.

Read carefully, because this cuts both ways.
The mechanism worked far better here than the disposable probe suggested,
and the reason is that this session had genuine unexamined surface:
a long analysis whose figures had been asserted from memory rather than re-derived.
A session without that surface is the `Reply with the single word: ok` case instead,
where the same hook produced 17 blocks and no work at all.
One session is not a rate,
and the agent measuring the benefit is the same agent that produced the defects,
so treat this as an existence proof that the blocks can be productive,
not as an estimate of how often they are.

The practical reading for tuning:
the mechanism converts unexamined surface into commits until that surface is gone,
then costs a full model turn per stop to confirm there is nothing left.
Neither the benefit nor the cost is constant,
and which dominates is a property of the session rather than of the hook.

### Self-referential yield, a hazard worth naming

Block 14 found a real defect:
this section's own figures had drifted,
because the section was written at block 10 and the blocks kept coming.
That defect existed only because the mechanism was running.

This is a failure mode distinct from a false positive.
A false positive produces no work.
A self-referential block produces work that is genuine,
committed,
and caused entirely by the blocking,
so it is indistinguishable from real yield by any measure taken from commits.
An agent recording its own forced-continuation statistics
will therefore find fresh work at every block forever,
and each fix will look justified.

Counting was stopped at block 14 for this reason,
and the figures here are deliberately not maintained.
Anyone evaluating a stop-blocking mechanism on commit counts
should exclude commits that only update the evaluation.

## Remediation options considered

This section is a historical record of what was weighed before the decision,
kept because the reasoning stays useful if the adopted approach is revisited.
None of it is a live recommendation.
Every option here was either rejected by the user or superseded by what was adopted,
and each carries its disposition.

No option here had an established effect on this failure.
The model comparison is confounded,
and the one state-based mechanism actually deployed, the goal feature,
rescued every stop it caught while its session still needed 16 nudges.
The ranking below weighed expected value against implementation cost,
not proven results.
It was written before the goal rate comparison was retracted,
so where a bullet leans on that comparison the lean is noted rather than silently repaired.

- **Rejected.** Run the goal feature deliberately across several queue-shaped sessions,
  and compare against matched sessions without it.
  Ranked first at the time because it was the cheapest remaining action,
  required no code,
  and tested the state-based approach before anything was built.
  The corpus contains one goal-active session,
  which is too few to estimate an effect,
  and that session is also the most queue-shaped.
  The 32% figure this bullet originally cited belongs to the retracted comparison
  and is not evidence for or against the option.
  Getting three or four matched sessions settles whether state-based blocking helps at all.
- **Rejected.** Route long queue-shaped sessions to `claude-fable-5`,
  run as a deliberate comparison rather than adopted as a fix.
  Ranked below the goal experiment because it costs capability on the hard analysis work
  these sessions consist of,
  where the goal experiment costs nothing.
  Ranked above building a detector because it is still only a measurement,
  and the corpus lacks exactly this comparison at matched task shape and period.
- **Superseded** by unconditional blocking, which needs no task state at all.
  Build tracked-task-state blocking into `ccsr`,
  with a high-confidence phrase detector only as fallback when task state is unavailable.
  Ranked below both measurements because it is the largest build here
  and would reimplement what the goal feature already does.
  The ranking also cited evidence that the goal feature did not lower the nudge rate;
  that evidence is retracted,
  and what remains is only that its one session still needed 16 nudges.
  Its guidance still applies if unconditional blocking proves too blunt
  and a narrower trigger is wanted,
  since narrowing the trigger is exactly what this option describes.
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
- **Rejected.** Drive continuation from the harness rather than from the user,
  using the `loop` skill's self-paced mode.
  Ranked last because it treats the symptom:
  it removes the typing cost without changing how often the agent stops,
  and it spends tokens on turns the user would otherwise have judged unnecessary.
  Rejected on the same ground as the goal feature,
  that the model decides whether to invoke it,
  so it inherits the failure it is meant to correct.

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
Session shape was examined only for the sessions of at least 14 turns,
so the claim that the Opus 5 sessions were queue-shaped
covers those and not all 8.

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

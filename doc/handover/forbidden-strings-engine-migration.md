# Handover: forbidden-strings engine migration orchestration

Updated:
 2026-07-16, after #392 closed and #382 (publish) completed.

Fresh milestones (details in State of play):

- #392 done in two commits (`25fd8b9c6` sweep plus gate widening,
  `260823a4a` unwrap-to-expect);
  the engine's all-targets clippy gate is GREEN again.
- #382 done:
  `forbidden-regex` 0.1.0 is LIVE on crates.io
  (manual bootstrap publish from the authorized session),
  the maintainer configured trusted publishing,
  and commit `4b502af20` adds the fr- workflow lane.
- Remaining in flight:
  #376 only.
  Grace timer FIRED;
  orchestrator stop procedure was aborted because the user directly told
  the agent to clean up and commit ASAP;
  it reports back imminently with a design decision to resolve,
  which the user believes is answerable from what is already written
  (resolve by citation, do not reopen).
  Engine crate and workflow are free;
  bench sidecar still occupied by #376.
Assume nothing else survived compaction;
 this file plus the planning doc are the resume points.

## Canonical references

- Decisions and rationale:
  `doc/planning/forbidden-strings-engine-migration.md`
  (all grilled decisions, adopted defaults, measured facts, issue map).
- Port review (lands with #376):
  `doc/planning/forbidden-strings-rule-port-review.md`.
- Issues #375 through #390 are the migration;
  #391 and #392 are session spin-offs.

## User-issued orchestration policies (verbatim intent)

- Subagents get tiny, well-defined tasks;
  the main session stays orchestrator and never implements large slices itself.
- Model class per task difficulty:
  sonnet for mechanical sweeps,
  opus for bounded judgment work,
  fable for genuinely hard design.
- Escalation policy:
  if a class's output is not up to par,
  bump the class for future similar tasks.
  Persistence of this policy is tracked in #391 (needs-triage);
  do not add it to `AGENTS.md` (user vetoed, too specific).
- The user is authenticated on crates.io and authorized publishing
  `forbidden-regex` from this machine;
  the orchestrator (not a subagent) runs the actual `cargo publish`.
  Trusted publishing config comes after the first version exists.
- Handover duty:
  update this file at every milestone (agent completion, publish, escalation).

## Subagent supervision (no timeouts exist)

- The Agent tool has NO timeout parameter (verified against the tool schema
  2026-07-16);
  the #376 and #377 agents were launched unbounded.
  The user is aware and chose not to kill or relaunch them.
- Available levers:
  completion notifications fire automatically when an agent stops;
  `TaskStop` terminates a running agent manually;
  `TaskList`/`TaskOutput` inspect status.
- Prompt-embedded stop conditions are the only per-task budget mechanism.
  Prompts so far include scoped ones
  (stop-and-report on max-lines, report-not-fix on new lint families)
  but no overall effort budget.
- Policy for every future launch:
  include a soft budget line in the prompt,
  for example "if this exceeds roughly five hundred tool calls or you hit a
  wall, stop and report state instead of pushing on".
  The user set the calibration:
  forty is extremely low;
  five hundred is about right.
- If an agent looks stalled (no completion notification for an unreasonable
  span), inspect via `TaskList` and stop it with `TaskStop` rather than
  launching a duplicate into the same crate.

## Hard sequencing constraints

- Never two agents concurrently in the same crate
  (auto-commit on main plus auto-push makes same-crate churn collide).
- Agents commit with explicit scoped pathspecs
  (repo git guards reject bulk staging)
  and put `Closes #N` in the final commit body once acceptance criteria verified;
  auto-push closes the issue.
- On push race:
  `git pull --rebase`, push again.

## State of play

Done:

- #375 engine clippy sweep plus metadata.
  Commit `4106b66a0`, pushed.
  All 367 lib errors fixed mechanically;
  221 tests pass;
  `cargo package` verified.
  Scope note:
  roughly 80 more implicit_return hits in test modules
  (lib-only mise clippy task misses them);
  now covered by #392.
- #377 batch API contract.
  Commit `b69611f78`, pushed, spot-checked.
  API: `RegexSet::line_matches(buf, starts) -> Vec<(usize, usize)>`
  in `src/regex/batch.rs`;
  naive per-line `matches()` loop;
  output ordering line-ascending, `matches()` order within a line;
  preconditions documented not validated;
  5 new tests (226 total).
  Deviation note:
  an AWS-shaped test literal tripped the forbidden-strings commit gate;
  resolved with the byte-escape convention integration tests already use
  (`\x50` final byte);
  no git-policy files touched.
- #378 single-sweep fast path.
  Commit `4575442f3`, pushed.
  `line_matches` now calls `sweep_candidates(buf, starts)` once on the
  caller's buffer (zero copy);
  private `resolve_matches(line, has_seed)` gates only the seeded group;
  line-start and seedless groups untouched (deferred to #381);
  ordering contract preserved;
  new test proves a seed spanning a line boundary does not match;
  227 tests pass, all gates clean.
- #379 differential fuzz target.
  Commit `72e830f3d`, pushed.
  Target `fuzz_line_matches` plus `RulesetAndBuffer` generator
  (mixed `\n`/`\r\n`, forced empty lines, optional unterminated final line,
  `starts` built in lockstep);
  independent naive recomputation as the oracle;
  33k bounded runs clean, no artifacts;
  no engine-crate files touched.

Running (completion notifications arrive automatically):

- #376 rule-file port, opus.
  Bench sidecar plus data files plus repo-root append file plus review doc.
  Settled semantics in the issue:
  512 quantifier caps,
  `/m` drops,
  rule 172 curl-anchor drop,
  line-number alignment preserved,
  strict compile, zero drops,
  gitignored local files untouchable.
  ATTENTION:
  the user observed this agent doing more than instructed
  (adjacent legitimate work, so tolerated)
  and granted a 20-minute grace window from that observation;
  a background sleep timer fires at expiry.
  At expiry, if no completion notification has arrived:
  inspect via `TaskList`,
  stop via `TaskStop`,
  evaluate whatever it committed,
  and relaunch the remainder with a narrower prompt.
  Lesson recorded on #391:
  soft budgets and precise prompts are the only bounding mechanism.
- #392 follow-up sweep, sonnet, engine crate:
  convert 60 test-code `Result::unwrap()` sites to `.expect()` with messages.
  First #392 agent landed `25fd8b9c6`
  (60 implicit_return fixes, gate widened to `--all-targets`)
  and correctly stopped on the foreign `disallowed_methods` family;
  triage decision posted to #392 from root `clippy.toml` reason text plus
  sibling-crate precedent (expect, never suppress).
  CAUTION: the widened engine `lint:clippy` gate is RED on main until this
  agent lands.
  Scope note posted to #385:
  widen the scanner crate's lib-only clippy task during the teardown.

Filed, not started:

- #392 test-module implicit_return sweep plus widening mise clippy to
  `--all-targets`;
  launch after #378 vacates the engine crate.
- #391 escalation-policy persistence decision (needs-triage, human).

## Planned launch order

1. On #377 completion:
   launch #378 (fast path, opus, engine crate)
   and #379 (differential fuzz target, sonnet, fuzz sidecar) in parallel.
2. On #378 completion:
   launch #392 (sonnet, engine crate;
   its widened gate then also covers test code added by #377/#378).
3. After #378 and #392:
   orchestrator publishes `forbidden-regex` 0.1.0 and extends
   `cargo-publish.yml` (#382).
   Publish is authorized;
   run it from this session.
4. On #376 plus #377 completion:
   launch #383 (scanner rule-compiler module, opus).
   Then #384 (scan path), then #385 (teardown), sequential, same crate.
5. After #385:
   #386 (fuzz retarget) and #387 (differential validation plus perf)
   and #388 (git-policy parser, after #384 in fact) as crates free up.
6. #389 cutover is ready-for-human:
   CI secret and contributor local appendix are maintainer-only;
   coordinate with the user, write the runbook via the runbook skill.
7. #390 hygiene last.
8. #380 (bench numbers) after #378;
   #381 (seedless routing) is bench-gated by #380 and may close wontfix.

## Model-class ledger (for the escalation policy)

- sonnet:
  #375 up to par (clean sweep, good scope note; 35 tool calls).
  #379 up to par (fuzz target, clean scope discipline; 34 tool calls).
- opus:
  #377 up to par (contract exactly as specced, spot-checked; 53 tool calls).
  #378 up to par (correctness argument articulated, boundary test added;
  30 tool calls).
  #376 pending verdict.
- No escalations recorded yet.

## Sequencing refinement discovered en route

#380 (bench coverage) is blocked in practice by #376, not only by #378:
the bench sidecar crate is where #376's port bin lives,
so #380 launches only after #376 completes.

## Verification duties that stay with the orchestrator

- Spot-check each agent's landed commit against the issue's acceptance criteria;
  reopen the auto-closed issue if deficient and relaunch one class up.
- The differential validation (#387) and the cutover (#389) are the
  fail-open safety nets;
  do not let schedule pressure skip them.

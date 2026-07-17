# Handover: forbidden-strings engine migration orchestration

Updated:
 2026-07-16, after launching #377 and filing #391/#392.
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
- #377 batch API contract, opus.
  Engine crate.
  Contract pinned in the issue:
  (buffer, ascending line starts) to (0-based line index, rule index) pairs,
  CRLF exclusion,
  final line unterminated,
  naive `matches()` delegation as the future oracle.

Filed, not started:

- #392 test-module implicit_return sweep plus widening mise clippy to
  `--all-targets`;
  blocked by #377 (same crate).
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
  #375 up to par (clean sweep, good scope note).
  No escalations recorded yet.
- opus:
  #376, #377 pending verdicts.

## Verification duties that stay with the orchestrator

- Spot-check each agent's landed commit against the issue's acceptance criteria;
  reopen the auto-closed issue if deficient and relaunch one class up.
- The differential validation (#387) and the cutover (#389) are the
  fail-open safety nets;
  do not let schedule pressure skip them.

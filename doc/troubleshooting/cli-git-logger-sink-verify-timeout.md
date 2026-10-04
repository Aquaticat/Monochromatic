# cli-git logger sink verify timeout

## Symptom

The original 2026-09-26 report recorded this line on every `git` command in that session.
Issue #573 also records repeated occurrences during commits on 2026-09-25.
The warning was not reproduced by ordinary current-checkout commits on 2026-10-04:


```text
logger internal error: sink verification failed for entry 3: Timed out after 5000ms: sink 3 verify
```

Git itself still completes,
 and commits land normally.
Long tool calls that budget tightly around `git`
 can still time out because the hook path waits out the verify window first.

## Emitter

`@monochromatic-dev/module-logger`,
 from `package/module/logger/src/create-logger.ts`:
 `verifyAndApply` runs each sink's `verify()` under `withHostTimeout`
 with `verifyTimeoutMs` (5000 ms),
 and a timed-out verify reports the internal error above,
 then drops that sink
 (`markEntryUnavailable`),
 so the records that sink would carry are lost for that process.

## Working diagnosis

Sink entry 3 is the fourth sink the cli-git hook logger configures,
 and its `verify()` never answers within 5 seconds in this environment.
The reporting session described the failure as persistent across invocations.
That observation does not establish whether host load contributed.

The original investigation did not identify the sink or emitting process.
The 2026-10-04 source trace identifies the Node default entry as the file sink,
but does not establish which verification operation exceeded its deadline.
A timeout also does not prove an operation is permanently hung.
This is a separate incident from
 [module-logger-quickjs-console](module-logger-quickjs-console.md),
 whose sink failures came from a QuickJS host without timers.

## Also seen under host load in `mise` / `node` runs

The same emitter fires outside the cli-git hook surface:
 plain `mise run //package/...:test:unit` and `node <file>.unit.test.ts`
 runs printed the identical line during a session where the host was
 swapping under concurrent mutation-test containers
 (`free -m` showed 39 GiB used and 30 GiB swap used),
 and the line vanished once the host load dropped.

This transient,
load-correlated observation remains separate from issue #573 until their process and trigger boundaries match.
An identical timeout diagnostic proves a shared reporting path,
not a shared root cause.
Do not saturate the host to recreate it;
any load experiment must use a bounded disposable container.

## Workarounds and rejected interpretations

No fix or workaround for the underlying verification delay is verified.
Increasing a command runner's timeout does not change the logger's 5000 ms limit.
Retrying starts another process with fresh sink verification;
the original assertion that a retry reused the timed-out logger was incorrect.
Before retrying a state-changing Git command,
inspect its result because the commit can have landed despite the warning.

Suppressing the warning or raising the verification deadline without identifying the delayed operation
would hide or postpone the symptom rather than establish its cause.

## Investigation for issue #573 on 2026-10-04

`package/module/logger/src/default-sinks.node.ts:37` constructs the Node default set in this order:

```ts
// package/module/logger/src/default-sinks.node.ts
return [
  createConsoleSink(),
  createSessionStorageSink(),
  createLocalStorageSink(),
  createFileSink(),
];
```

Entry 3 is therefore the file sink for a process using this default set.
The emitting process in the reported commit remains unidentified.

At baseline commit `d62bf6905`,
a disposable repository with its own `node_modules` completed both wrapper `status --short`
and an explicit-path `commit` with exit code 0 and empty stderr.
Both processes created JSONL files containing logger records.
This fixture did not load the repository policies,
so it is a negative control rather than a reproduction of the reported commit.
Current working-repository `status` and `log` commands also did not emit the warning.

A streaming directory enumeration counted 882885 entries in the working repository's
`node_modules/.monochromatic`.
That count alone does not establish latency or causation;
the failing process's actual sink directory must be identified first.
No existing log files were removed or changed by the enumeration.

Follow-up fixtures loaded `markdown/autofix`,
`mono/forbidden-root-context`,
and `security/forbidden-strings`,
using disposable Git repositories and homes on the host filesystem.
Both root and linked-worktree commits completed with exit code 0 and empty stderr.
The linked-worktree fixture invoked the actual shadow `git` executable.
The real documentation commit `10554b905` also completed without the warning.
These successful observations do not prove an intermittent incident is fixed.

The detector's positive control delayed only the file sink's `mkdir` by 5100 ms.
It captured the exact issue diagnostic and failed the probe as expected.
The trace identified the wrapper process,
its temporary log directory,
and the pending `mkdir`.
This validates timeout detection,
not the incident's root cause.

### Historical endpoint investigation

The owner requested bisection after the agent prematurely asked for a fresh reproduction.
The missed step was testing historical revisions before treating current non-reproduction as a blocker.

Candidate endpoints:

- `77992cfed`:
  first-parent revision before 2026-09-21,
  not yet a proven good revision.
- `d322d083e`:
  the recorded concurrent-commit decision commit associated with the report,
  not yet a failing executable probe.
  Its only change from its parent is the decision document,
  so its executable source matches its parent's.

`git diff d322d083e HEAD -- package/module/logger package/module/async-time` is empty.
The logger and timeout source did not change between that reported revision and this investigation.
Commit `ee58222bc` introduced the verification deadline on 2026-09-06,
before the issue's reported onset window.
The September 23 timerless-host changes remain a hypothesis to test,
not an established cause.

An isolated sparse worktree at `d322d083e` rebuilt the wrapper with
`mise run //package/git-policy/cli:build:js:node`.
Its configured root and linked-worktree commits also passed without the warning.
Historical source and package-local build configuration are used;
Node 26.10.0,
Git 2.55.0,
installed external dependencies,
and the forbidden-strings scanner are held constant.
This isolates source changes but does not recreate the full September 25 runtime environment.

Next action:
run rotated repeated endpoint trials,
then bisect only if their outcomes support a revision-dependent signal.
A single silent run must not classify an intermittent revision as good.
The positive-control delay must not classify revisions either:
it intentionally forces an otherwise valid timeout.

### Proposed agent instruction correction

Tighten `AGENTS.md`'s existing `CB1` rather than adding another overlapping rule:

```text
Before handing off, try bridges: shell, browser, compositor/IPC, expect/tokens, hardware CLI;
regressions: test historical endpoints, bisect with a validated signal. State attempts.
```

This is a proposal,
not an applied change to agent instructions.

## Open questions

- Which process emitted the reported timeout,
 and which actual directory did its file sink select?
- Which filesystem operation or scheduling delay exhausted verification's deadline?
- Does the failure follow this machine or every checkout?

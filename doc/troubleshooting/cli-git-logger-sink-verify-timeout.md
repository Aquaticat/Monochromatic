# cli-git logger sink verify timeout

## Symptom

Every `git` command in this worktree prints one console line:

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
The failure is persistent across invocations,
 not load-correlated:
 every `git` call in the session produced it.

What was not established:
 which sink is entry 3 in the hook's sink list,
 and why its `verify()` hangs
 (a wedged daemon,
 a contended lock,
 and a slow read-back are all consistent
 with the evidence collected).
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

Where the cli-git occurrence above was persistent across invocations,
 this variant was transient and load-correlated,
 so per symptom separation it stays a distinct occurrence until the
 user-visible boundaries match.
 The emitter path is the same
 (`package/module/logger/src/create-logger.ts:357`,
 `verifyAndApply`),
 which suggests one shared root cause:
 any sink whose `verify()` cannot answer within `verifyTimeoutMs`
 (5000 ms) is dropped with the internal-error line,
 whatever host the
 process runs on.

Reproduction shape:
 saturate the host (concurrent containers plus memory pressure),
 run any `*.unit.test.ts` through `node`,
 and watch stderr for `sink verification failed`.
 There is no upstream to file against:
 `@monochromatic-dev/module-logger` is this repository's own package,
 so the fix surface is its `verifyTimeoutMs` configurability and the
 stuck `verify()` identified in the open questions below.

## Workaround

Run `git` with generous tool timeouts and retry once on timeout.
The sink is dropped after the first 5 s,
 so a retried command is not slowed again inside the same process.

## Open questions

- Which sink is entry 3 in the cli-git hook logger configuration?
- Does `verify()` block on a socket,
 a lock,
 or a read-back?
- Does the failure follow this machine or every checkout?

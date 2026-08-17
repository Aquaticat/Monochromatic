# Chaining a command behind a long run

FOUND 2026-08-17 while chaining a second corpus audit behind a first,
so that both would execute on one build.
Both traps below cost real time and neither announced itself.

## `pgrep --full` matches the shell that is running the `pgrep`

This waits forever:

```sh
while pgrep --full 'node dist/final/node/rendering-audit-settled.mjs' > /dev/null; do
  sleep 15
done
echo 'never reached'
```

`pgrep --full` matches against the whole command line of every process,
and the wrapper shell running this loop has that pattern IN its own command line,
because the pattern is part of the script text the shell was invoked with.
So the loop always finds at least one match:
itself.

The failure is silent and looks exactly like the watched process never ending,
which is the thing you were worried about in the first place,
so the natural reaction is to wait longer.

What it looks like when you finally check:

```text
3703702 /bin/bash -c source /home/user/.claude/shell-snapshots/... rendering-audit-settled.mjs ...
```

A bash process, not a node process,
matching a pattern that names a node file.

### What to do instead

Capture the PID and watch that, which cannot match anything else:

```sh
mise run //package/module/translation-repair:rendering-audit-settled > run2.log 2>&1 &
WATCHED=$!
while kill -0 "$WATCHED" 2>/dev/null; do sleep 15; done
```

Or, if the PID is not available because the run was started elsewhere,
match on something the watcher's own command line cannot contain,
and exclude the watcher's own process group.
`kill -0` on a known PID is simpler and has no pattern to get wrong.

Then check the run actually SUCCEEDED before starting the next one.
A guard on the log's completion line costs nothing
and stops a failed first run from silently becoming a second one:

```sh
grep --quiet 'kept at' run2.log || { echo 'first run did not persist'; exit 1; }
```

## The run persists and then holds the process open for minutes

The audit wrote its results,
printed `kept at <path>`,
and did not exit for about another three minutes.
It held ten socket and pipe descriptors the whole time.

The first guess was that abandoned requests were holding sockets open,
because the log is full of lines like:

```text
[warn] runRenderingAudit hf:nvidia/...: abandoned 180000ms after quorum (AbortError)
```

THAT GUESS WAS WRONG,
and reading the deciding source rather than the symptom found the real cause.
`runStageRound` in `package/module/translation-repair/src/stage-round.ts`
does abort the stragglers,
through an `AbortController` every call in the round honors.
It is not leaking sockets.

It leaks a TIMER:

```ts
await Promise.race([
  Promise.allSettled(asks,),
  wait(graceMs,),
],);
abandon.abort();
```

`Promise.race` settles on the first result and does NOTHING to the loser.
When the roster answers before the grace expires,
which is the ordinary case,
`wait(graceMs)` is still pending.

And `wait` is a bare `setTimeout`
(`package/module/async-time/src/wait.ts`)
that returns no handle,
so nothing can clear it,
and does not call `unref`,
so it holds the event loop:

```ts
const { promise, resolve, } = Promise.withResolvers<undefined>();
setTimeout(function resolveAfterDelay(): void { resolve(undefined,); }, ms,);
return promise;
```

Every round therefore leaves one live timer behind.
The last round's timer is the one that matters,
and `graceMs` here is 180000,
which is the three minutes observed.

This is not specific to the audit.
Every stage round in the pipeline does it,
so any CLI that runs one can outlive its own work by up to the grace window.

Nothing is lost:
the run file is already written when `kept at` prints,
which is the point at which the results are safe.

### Why it matters anyway

-   Anything chained behind the run waits for the timeout, not for the work.
-   In a longer pipeline it reads as a hang,
    and the natural response is to kill it,
    which is harmless here only because persistence already happened.
-   A supervisor with a completion deadline can time out a run that finished.

### How to tell the two apart

If the log's last line is `kept at <path>` and the file exists,
the work is DONE and the process is merely lingering.
Waiting it out is safe and so is killing it.
If that line is absent, the process is still working.

That distinction is why the completion line is worth printing
with the path in it,
rather than relying on the exit code alone.

### The fix, which is not applied here

`wait` should return something cancellable,
or the race should clear the loser:

```ts
const cut = setTimeout(...,);
try { await Promise.race([...,],); } finally { clearTimeout(cut,); }
```

`unref` would also stop it holding the loop,
but it is the weaker fix:
it hides the leak rather than removing it,
and a timer that stops keeping the process alive
still fires on a process kept alive by something else.

Not applied at the time of writing because `stage-round.ts` is in the
PRODUCING path and the task that found this
(`#115`, the settled rendering audit)
is forbidden from changing anything there.
Tracked separately.

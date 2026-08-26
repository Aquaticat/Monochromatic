# Synthetic refuses every Charm-Hyper-only model with an `hf:` prefix error

Status:
OPEN as of 2026-08-25.
Filed as task `#235`.
The cause is NOT yet located in the source.

## The symptom, as an operator sees it

A run finishes.
It exits zero, prints no refusal line and no fault line, and settles every slice it was given.
Nothing in the summary says anything is wrong.

Under that, half the model roster produced nothing at all.

The tell in the log is a round line that reads the same every time:

```text
round: 5/10 heard
```

Five of ten, on every round, for the whole run.
A genuine provider wobble moves that number around.
A number that never moves is not a wobble, it is a class of model failing outright.

## What is actually happening

Synthetic is being asked to serve models it does not host,
and it says so plainly, once per call:

```text
SyntheticHttpError: provider API returned HTTP 400:
{"error":"Your model name should start with an hf: prefix; for example: ...
```

Synthetic serves models named with an `hf:` prefix.
Five of the ten seats in the roster are Charm Hyper endpoint labels,
which carry no such prefix, and Charm Hyper is the only provider that serves them:

```text
qwen3.8-max
minimax-m3
gemma-4-26b-a4b-it
deepseek-v4-pro-0813
deepseek-v4-flash-0731
```

Measured over one four-slice calibration,
those five failed on a hundred percent of their calls, 25 of 25 each,
and the five `hf:` models failed on none of theirs.
The split is exact.
It is not load, not credits, and not a rate limit;
it is the wrong provider being asked a question it cannot answer.

## Why the run does not fail, and why that is the worse half

Quorum is five voices of ten.
The five models that still work are exactly enough to meet it,
so every round stands, every slice settles, and the command reports success.

This is the multi-provider resilience from `#199` working as designed.
It was built so a provider going away could not stop a run, and it does not stop one.
What it was not built to do is notice that the loss is total and permanent
rather than momentary, and say so.

The result is a run that is completely well-formed and quietly worthless:
a ten-model calibration carried out by five models,
with no signal above `warn` that would tell a reader which one they are holding.

## How to check whether a run has this

Count the distinct values of the heard fraction across the run.
One distinct value, below the roster size, for every round, is this defect.

Attribute per model before concluding.
Anchor the search on the emitter's own template rather than on free text,
and print only the extracted fields:
run log lines carry model output, and this corpus must not be pasted anywhere.

The two anchors worth grepping are the provider's `hf:` prefix message
and the stream progress marker.
Counting both per model gives the failure rate per seat,
and this defect shows as a clean hundred percent on some seats and zero on the rest.

## Where to look for the cause

`package/module/translation-repair/src/budget-routing.ts`.

Its module note states the intended policy:
send everything to Synthetic until its per-model concurrency limit is reached,
then overflow to Charm Hyper, which has no such limit;
if Synthetic has run out of quota, use Hyper;
if both are dry at once, throw and end the run.

That policy has a hole exactly where this defect sits.
It describes what to do when a provider is unavailable,
and it promises that
"a model that no live provider serves is an outcome, not a throw".
Both are about availability.
Neither says what to do with a model that a live, healthy, funded provider
is structurally incapable of serving,
which is a different thing and is what these five models are to Synthetic.

Only the first sixty lines of that file had been read when this was written,
so the specific line that routes a bare label to Synthetic is still unidentified.
Read the body and then the call sites.

## What a fix has to do

Two separate things, and they should not be merged into one change.

1.  Never offer a model to a provider that cannot serve it.
    Serving capability is a property of the pair, not of the provider's health,
    so it has to be consulted before the availability logic runs, not inside it.

2.  Make a seat that is dark for a whole run loud at the end of the run.
    A per-call `warn` and a per-round fraction are both correct and both invisible.
    Something that reads the whole run must say which seats produced nothing,
    in the run's own closing summary.

The guard for the first belongs under `GFP`:
with Synthetic live and healthy, a non-`hf:` model must produce zero Synthetic calls,
and the test must be shown to fail once the fix is removed.

## Three instruments that lied while this was being diagnosed

Kept here because each cost real time, and each will cost it again.

1.  **Run log stamps are UTC; this machine runs EDT.**
    A line stamped `02:11:48` was written at `22:11:48` local.
    Read as local time, a live and healthy run looks like it died twenty hours ago.
    Compare against `date -u`.

2.  **Node reports `comm` as `node-MainThread` here, not `node`.**
    A `/proc/*/comm` scan matching exactly `node` returns nothing,
    which reads as proof the process is gone.
    Match a `node*` prefix, or match on `cmdline`.

3.  **`pgrep -f PATTERN` matches the shell running it.**
    A wait loop whose own command line contains the pattern never exits.
    This has caused three separate incidents in this work,
    one of which ended with a cleanup loop killing its own shell and returning exit 144.
    List the pids first, confirm the kind through `/proc/<pid>/comm`,
    then kill by number from a command that does not contain the pattern.

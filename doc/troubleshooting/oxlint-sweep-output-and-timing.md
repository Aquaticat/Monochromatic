# Reading a whole-repo oxlint sweep: output that lies quietly, and timings that do not mean what they say

Five behaviours met while measuring `mise run lint:oxlint` across the repository.
Each one produced a plausible wrong answer rather than an error,
 which is what makes them worth writing down.
Four are about reading the output;
 the fifth is about comparing two runs.

The rule under measurement was `prefer-readonly-parameter-type`,
 whose guarded failure mode is
minting a wrong read-only offer,
 so "the sweep looks clean" and "the sweep produced nothing
readable" must never be confusable.
Three of these five make exactly that confusion available.

## Bug 1: a NUL byte in the captured output makes `rg` skip the entire file

### Symptom

Extracting diagnostics from a captured sweep returned one line instead of 6795:

```sh
rg --no-line-number '^\s+[x!]\s' sweep.txt | sort > diag.txt
wc -l < diag.txt
# 1
```

A `diff` against the previous run then reported every one of the 6795 baseline lines as removed,
which reads exactly like a catastrophic regression in the rule.

### Root cause

The captured stream contained a NUL byte,
 in the observed case around offset 83,
 introduced when
the run was wrapped in `/usr/bin/time`.
`rg` classifies a file containing NUL as binary and refuses to print matches,
 emitting only:

```text
binary file matches (found "\0" byte around offset 83)
```

That notice goes to the same stream being piped,
 so a pipeline that counts lines counts the notice.

### Verification

```sh
rg --count 'Found .* warnings' sweep.txt        # says "binary file matches"
rg --text --count 'Found .* warnings' sweep.txt # says 1
```

### Verified workaround

Pass `--text` to every `rg` invocation that reads a captured sweep.
Do not rely on the absence of matches meaning the absence of diagnostics.

Prefer capturing the sweep without a wrapper.
Timing is available from oxlint's own trailer,
 which is more precise than wall time anyway:

```text
Finished in 58.3s on 2880 files with 480 rules using 16 threads.
```

### What does not work

Checking `wc -l` on the captured file.
It counts fine,
 because `wc` has no opinion about NUL;
 only the search step silently empties.

## Bug 2: counting read-only offers by a single-line search undercounts by eight

### Symptom

The recorded invariant for this repository is 35 offers.
A direct search answered 27,
 which looks like eight offers disappeared:

```sh
rg --count 'should be readonly' sweep.txt
# 27
```

Nothing had changed.
27 was nearly recorded as a regression from 35 that had not happened.

### Root cause

The diagnostic embeds the parameter name,
 and a destructured parameter's name is its whole
binding pattern,
 which spans lines:

```text
Parameter "{
  readonly value: string;
  ...
}" should be readonly: property type is writable.
```

A line-oriented search never sees `should be readonly` on the same line as `Parameter "`,
 so those
findings are invisible to it.
Eight of the 35 are shaped this way.

### Verified workaround

Count with a multiline pattern that tolerates a name spanning lines:

```sh
rg --text --multiline --count 'Parameter "(\{[^"]*)?[^"]*" should be readonly' sweep.txt
# 35
```

### What does not work

Counting lines that merely mention `readonly`.
That answers 1555,
 because every finding of every kind names the rule.

## Bug 3: exit status 1 means findings, not failure

### Symptom

A shell chain that captures a sweep and then processes it silently skips the processing:

```sh
mise run lint:oxlint > sweep.txt 2>&1 && rg --text '^\s+[x!]\s' sweep.txt | sort > diag.txt
# diag.txt is never written
```

### Root cause

The sweep exits non-zero whenever it reports errors,
 and this repository's sweep always reports
errors, currently 2893.
`&&` therefore never fires.

### Verified workaround

Sequence with `;` rather than `&&` after any step whose non-zero status is expected,
 and assert
on the output instead:

```sh
mise run lint:oxlint > sweep.txt 2>&1; rg --text --count 'Finished in' sweep.txt
```

## Bug 4: a sweep can end after the configuration build with no findings and no surviving process

### Symptom

A captured sweep contained the oxlint configuration build and then stopped:

```text
<DIR>/plugin-prefer-readonly-parameter-type.mjs    chunk │ size: 252.18 kB
✔ rolldown v1.2.0 Finished in 134.55 ms
```

No diagnostics, no trailer, no error.
`pgrep` found no oxlint or `tsc --api` process, and the journal recorded no out-of-memory kill.

### Root cause

Not established.
Observed once and not reproduced;
 an identical rerun completed normally.
Recorded because the failure is silent and its output is indistinguishable from a sweep still
running, which is what makes a blind rerun tempting.

### Verified workaround

Before rerunning, establish that nothing survived,
 rather than assuming it:

```sh
ps -eo pid,etimes,args --sort=etimes | rg --text 'oxlint|tsc --api'
journalctl --since "20 min ago" --no-pager | rg -i 'oom|killed process'
free -g
```

Only then rerun.
A blind rerun while a child is still alive competes for the same cache and the same cores,
 and
corrupts whatever it was meant to measure.

## Bug 5: single runs cannot resolve a difference smaller than about five seconds

### Symptom

Five separate changes were each credited with a three to six second effect,
 measured as one run
before against one run after.
None of those attributions survived.

### Root cause

The run-to-run spread was never measured.
Four warm sweeps of one unchanged build:

```text
57.3s   58.9s   59.3s   61.9s
```

The band is 4.6s,
 so every one of those attributions sat inside the noise.

### Verified workaround

Measure the band on an unchanged build first,
 then compare repeated runs of each configuration
rather than one of each.
Where a mechanism can be measured directly, prefer that over the sweep:
 the decoded-source cache
change was settled by a probe showing a project revisit at 98.6ms against 0.5ms,
 with a control,
which is evidence a wall-clock difference of nine seconds could not have supplied on its own.

This is recorded as `QNB` in `AGENTS.md`.
Note that `QJ1`, which forbids a quantitative claim without a measurement, does not catch it:
 the
measurement was taken, and the comparison was still meaningless.

## Related

- `doc/planning/oxlint-warm-sweep-attribution.md` holds the full measurement record,
 the pinned
diagnostic digests, and six withdrawn claims.
- `doc/troubleshooting/oxlint.md` covers type-aware mode resolving the wrong configuration from
the monorepo root, which is a different way for a sweep to look clean while checking nothing.

# Translation repair handover snapshot: 2026-09-06, part 08

Part 08 of [Translation repair handover snapshot: 2026-09-06](translation-repair-handover-2026-09-06.md),
whose index lists every part in order.

## The bleed and the six levers

The owner asked on 2026-09-09 where 200 USD went in a day and said to do everything to stop bleeding,
to always fix and relaunch,
and not to ignore that whatever reaches Hyper and Synthetic more efficiently makes those last longer.
The reckoning and the six levers are in the planning log under
"The owner asks where 200 USD went,
and six levers land".
In one breath:
every call on every provider carries a measured `max_tokens` (`completion-cap.ts`);
every round asks quorum plus one seat from a bench rotated by the prompt and the rest only when a voice is lost
(`stage-fanout-window.ts` for the sixteen `gatherStageVoices` stages,
`stage-windowed-rounds.ts` for the six that read their own round);
OpenRouter calls are price-sorted,
carry `cached=` on the `SPEND` line,
write a reckoned `SPEND ... estimated=abandoned` line for every abandoned stream,
and no longer serve Qwen3.8-27B or glm-5.3.
Three rules came with the window:
the coverage verdict's majority is over the seats asked;
a judge bench of four asks the whole bench,
since three halves cannot carry a unanimous self-written slate;
and the naturalness confirmation challenges exactly the seats the discovery asked,
at the discovery's quorum.
A fixture that scripts every seat says `fanOut: 'whole-bench'`;
a fixture that counts calls counts `firstRoundWindow({ benchSize, })`.
Mercury 2.5 judges since `fcc8ca197` (14 of 14 on the fidelity probe of 17:00 UTC),
wrote in both lanes from its calibration of 2026-09-09,
and writes the consolidation alone since the calibration of 2026-09-19 read it below the pooled null.

## How a pass is launched now

The plain invocation in
[`translation-repair-corpus-pass.md`](../runbook/translation-repair-corpus-pass.md) is the production launch:
a fresh `TRANSLATION_REPAIR_RUNS_DIR`,
no dial,
whichever provider keys are present (four since 2026-09-07;
any number dry or absent is normal operation,
the owner's words).
The log opens with `OVERLAP <entry> value=4 source=fallback` and `WRITER GRACE built in`.
Every dial still works for a measured arm.
The seven reading steps are in the 2026-09-04 snapshot and are unchanged.
Since 16:45 UTC on 2026-09-09 a pass runs from a frozen copy of the built `dist`
(`cp -r package/module/translation-repair/dist/final/node package/module/translation-repair/node_modules/.frozen-dist-<commit>`,
inside the package so the bundle's bare imports resolve;
the scratch launcher `launch-pass.mjs <runs-dir> <entry> <frozen-dir>` takes it as its third argument),
so building the next fix cannot change the pass under way.
Since 2026-09-26 the launcher runs under `systemd-run --user --scope --unit=pass-<run>`:
a pass started from a Bash command shares the `claude-code-bash` cgroup,
and systemd-oomd kills that whole cgroup under memory pressure,
which took hulicaijia21 down with a build beside it.
The target directory must not exist before the copy:
`cp -r` into an existing directory nests the build as `<frozen-dir>/node/`,
and the pass then runs whatever the top level already held.
That is how shi_Yumiaoya26 ran a build older than class one hundred twenty-three
from `.frozen-dist-67da525a2` on 2026-09-25.
So run `test ! -e <frozen-dir>` before the copy,
and after it grep the frozen top level for a string the newest fix adds.
The kill-and-relaunch rule is about the build a pass carries,
not the files on disk:
a fix that matters to the running entry still kills and relaunches it.
Since 2026-09-19 every launch sets `TRANSLATION_REPAIR_SLICE_OVERLAP=8`
(the log opens `OVERLAP <entry> value=8 source=TRANSLATION_REPAIR_SLICE_OVERLAP`;
the built-in default is still 4),
the setting that brought XingZ60 under the seven-hour ceiling.
The exit waiter is a scratch node script
(`wait-<run>.mjs`:
`process.kill(pid, 0)` every 15 s,
then the log's last TALLY and METERS lines once)
run as a background Bash task;
the owner dropped the cron fallback on 2026-09-17 ("You don't need a cron job"),
and the session still starts with `CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP=1`.

## The three checks

Named in every reading of this handover and defined here,
since the readings cite them by count and a reader who has not met them cannot run them.
They are the three additions the classes of 2026-09-08 made to the seven steps of the 2026-09-04 snapshot,
each read off the pass log and the shipped page:

1.  FRONT MATTER.
    The page's front matter equals the archive's byte for byte
    (the scratch `read-page.mjs` prints `frontMatterEqualsArchive`),
    under the owner's rule of 2026-09-08:
    the archive's front matter ships as it stands,
    and the lanes render slice zero only where the archive never translated it.
2.  FALSE START.
    Every `json false start` line in the log is a voice the reply ladder kept
    (the seventeenth class,
    `json-false-start.ts`);
    a `schema-mismatch` whose raw text opens `{` twice would mean the window or the shape has moved,
    and is a finding to chase rather than to record.
3.  ERROR FINISH.
    A `schema-mismatch` line naming `finish_reason=error` would mean the shape has moved
    (the eighteenth class);
    an `InStreamProviderError` line with `code unnamed` is that class caught and retried,
    which is the healthy reading.

## What to do next

As of 2026-10-12 (UTC),
the next action is the newest checkpoint's "NEXT":
merge the consistency pass's rebuild,
gate it,
and relaunch `TianqiChen666` as `TianqiChen66624` through the runbook's unit form.
The numbered items keep the queue as the sessions of 2026-09-08 to 2026-09-26 left it;
read each against its date.

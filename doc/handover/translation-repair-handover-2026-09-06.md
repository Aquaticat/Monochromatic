# Translation repair handover snapshot: 2026-09-06

Part of the [current translation repair handover](translation-repair.md).
The previous snapshot is
[`translation-repair-handover-2026-09-04.md`](translation-repair-handover-2026-09-04.md).

The owner returned with Synthetic refilled to a third and Hyper wet,
OpenRouter still uncharged,
and the instruction not to wait on it.
Before the first page,
two defaults that had never shipped a page became the configuration every shipped page had run,
the owner wrote one operating rule,
and the first pass on the plain invocation found the fifth defect class in 28.6 minutes.
The pipeline is still not production ready,
and the reason is recorded in
[`translation-repair-readiness-signal.md`](../planning/translation-repair-readiness-signal.md).

## Where the work stands

A pass is in flight:
`yulianNyanner` on the class-five fix,
launched 21:03:43 UTC as pid 3042501,
runs dir `~/temp/agent/yuliannyanner3-20260906`,
log `~/temp/agent/yuliannyanner3-20260906.log`.
When it exits,
read its page by the seven steps in the 2026-09-04 snapshot,
"How a pass is launched and read",
and write the reading into the planning log and the readiness signal.
If it is still running when this is read and the tree has moved past `cf1450162`,
the kill-and-relaunch rule applies.

The full unit suite emitted 934 `PASS` lines and zero `FAIL` lines on the class-five build.
oxlint 0 warnings and 0 errors,
types clean,
markdown lint clean on every line written today.

## Repository state

- Worktree:
  `/var/home/user/worktrees/translation-repair`.
- Branch:
  `translation-repair-rebased`,
  auto-push on.
- Tip:
  `cf1450162`.
- Corpus pinned at `a41fc607ea5a70d8a7625cc67d5ed8c444f53379` in `~/one-among-us/data`.
- Meters at 21:03 UTC:
  `synthetic=wet hyper=wet openrouter=wet syntheticWeekly=31.37% syntheticFiveHour=2750/2750`,
  Hyper 2686 credits,
  OpenRouter 0.32 USD.
  One stopped 28-minute attempt cost about 0.8 percent of the Synthetic week and 36 Hyper credits;
  no call reached OpenRouter,
  since routing spends Synthetic and Hyper first.

## What landed today

Newest first.

-   `cf1450162`,
    `3ab2d318a`:
    the fifth class recorded in the planning log,
    the readiness signal and the README status.
-   `259708e79` reads a slice under the grammar the document was read in,
    HTML comments masked to same-length whitespace,
    with guards `ebf6524de` shown to fail on the unfixed build.
-   `304e3ed98`,
    `bd83628b8`:
    the day's planning-log and readiness sections.
-   `7a2bdbedf` builds the writer rounds' 180000 ms window in,
    never shorter than the round window,
    by the owner's decision;
    guard neutralised 4 `FAIL`,
    restored 0.
-   `56c2ab488`,
    `0d2203abd`:
    the always-kill-and-relaunch rule in the package README,
    the runbook's launch and restore steps,
    the handover hub,
    the 2026-09-04 snapshot,
    and the run-continuity and overlap-dial handovers.
-   `e50be2299` keeps four slices in flight in the corpus pass by default,
    on the four matched pairs `#261` asked for,
    with guard `bb5e97e0e` shown to fail first;
    record `doc/decision/translation-repair-pass-overlap.md`,
    flagged for the owner's veto.

## The fifth class

Found by the first pass on the plain invocation,
not by a test.
`parse-document.ts` masks HTML comments before its strict MDX parse;
`readSliceSkeleton` in `translate-skeleton.ts` did not,
so every slice whose original carried a translator note was "an original that could not be read",
the deterministic floor answered `unknown`,
and both gates that consume the floor treat `unknown` as inadmissible.
The entry stopped at consolidation with nothing to ship after 742 calls.
17 of 92 sources carry a comment,
34 comment lines in all,
14 of them in `yulianNyanner`;
none of the three pages that shipped on 2026-09-04 had one.
The archive renders that entry's fourteen comment lines as twelve English comments,
so comment parity is not a rule the archive itself would pass,
and whether a candidate carries a note rendered is left to the judges as wording.

The pattern of 2026-09-04 held:
a class per new source shape,
none on a repeat.

## The two defaults and the rule

-   The corpus pass ran at overlap 1 by default while every page that shipped ran at 4 through a dial.
    The four matched pairs of 2026-08-27 and 2026-08-28 had already measured the effect
    (normalized wall down 0.09 to 0.27 against a 0.03 band,
    voices never worse);
    the 2026-09-01 hold had frozen the reading before it became a default.
    Moved to 4.
-   The writer rounds ran at 180000 ms through a dial while the built-in round window was 120000 ms.
    The straggler-grace record had reserved the question for the owner;
    asked with the four shipped logs' cut counts
    (writer-round cuts 4,
    6,
    11 and 20 against 28,
    35,
    26 and 135 reader-round cuts),
    the owner chose to build it in.
-   The owner's rule:
    ALWAYS KILL AND RELAUNCH.
    When source changes while a pass is running,
    kill the pass by pid,
    build,
    and relaunch the same entry into a fresh runs dir on the new build;
    a page finished on a superseded build is not readiness evidence;
    a known fix lands before the launch.
    The 19:53 launch was killed under it after 264 calls.
    The rule is deliberately not in the root `AGENTS.md`.

## How a pass is launched now

The plain invocation in
[`translation-repair-corpus-pass.md`](../runbook/translation-repair-corpus-pass.md) is the production launch:
a fresh `TRANSLATION_REPAIR_RUNS_DIR`,
no dial,
all three provider keys present.
The log opens with `OVERLAP <entry> value=4 source=fallback` and `WRITER GRACE built in`.
Every dial still works for a measured arm.
The seven reading steps are in the 2026-09-04 snapshot and are unchanged.

## What to do next

1.  Read the `yulianNyanner` page when pid 3042501 exits,
    with attention to what the page did with the fourteen source comments and the two double-quoted
    `PhotoScroll` lines,
    and record the reading.
2.  Run and read `Arita`,
    the other double-quoted-paths entry never run,
    after that reading rather than beside it,
    so a fix found in one reading does not kill two runs.
3.  Read for an unstarved consolidation:
    the refilled meters make one possible for the first time since 2026-09-02.
4.  The OpenRouter top-up is the owner's and expected within days;
    nothing waits on it while Synthetic and Hyper are wet.

## Standing constraints

Unchanged from the 2026-09-04 snapshot:
never echo an API key value or read `/proc/<pid>/environ`;
never set `thinking`,
`budget_tokens` or `reasoning_effort`;
never write `Closes #N`;
spent Candidate A through M prompts are never redispatched;
credentials,
API keys,
image bytes and raw provider requests and responses stay private,
and the owner has relaxed everything else until the project is finished.

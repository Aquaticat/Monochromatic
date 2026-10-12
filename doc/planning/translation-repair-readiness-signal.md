# Translation repair: the production readiness signal, and what it rests on

Proposal for the owner,
written 2026-08-26 ahead of the `AskUserQuestion` call the readiness task prescribes.
The signal is the owner's cue to disable branch protection temporarily so the corpus text committed along
the way can be sanitized (`doc/handover/translation-repair.md`,
"Corpus exposure is not a blocker").
This document is the evidence behind the question and the decisions the question bundles apart.

## Parts

This document is kept in parts of at most 1000 lines each,
split at its headings;
the list gives their order and the sections each part holds.
New text goes into the part holding its section,
and a part that would pass the limit is split into a new part listed after it.

- [Part 01](translation-repair-readiness-signal-part-01.md)
  - What "ready" rests on
  - What is known and not done
  - Sanitization inventory
  - The decisions the question keeps apart
  - The owner's answers (2026-08-26)
  - Since the answers (2026-08-26,
    updated the same day)
  - The owner's words on the goal,
    2026-09-04
  - What the 2026-09-04 pages showed
  - What the luxuanwen3 re-run of 2026-09-04 showed
  - What the luxuanwen3 re-run on the either-rendering build showed (2026-09-04,
    12:43 UTC)
  - What the two runs on the publisher fix showed (2026-09-04,
    13:51 UTC)
  - What the Uekawakuyuurei attempt on the pronoun build showed (2026-09-04,
    15:03 UTC)
  - What Uekawakuyuurei on the picture-fix build showed (2026-09-04,
    15:25 UTC)
  - What 2026-09-06 changed before the next page
  - What the first plain-invocation run showed (2026-09-06,
    20:21 UTC)
  - What the first page on the plain invocation showed (2026-09-06,
    21:03 UTC)
  - What the page on the class-six build showed (2026-09-06,
    22:10 UTC)
  - What the page on the class-seven build showed (2026-09-06,
    23:11 UTC)
  - What the page on the class-eight build showed (2026-09-07,
    00:12 UTC)
  - What the TLL1122 page showed (2026-09-07,
    01:11 UTC)
  - What the Huasheng attempt showed (2026-09-07,
    01:44 UTC)
  - What the Huasheng relaunch showed (2026-09-07,
    03:09 UTC)
  - What the third Huasheng launch showed (2026-09-07,
    08:43 UTC)
- [Part 02](translation-repair-readiness-signal-part-02.md)
  - What the fourth Huasheng launch showed (2026-09-07,
    15:43 UTC)
  - What the three hakureico launches of 2026-09-07 showed (21:00 to 22:00 UTC)
  - What the sixth hakureico launch showed (2026-09-08,
    00:38 UTC)
  - What the seventh and eighth hakureico launches on Bedrock alone showed (2026-09-08,
    01:49 and 02:19 UTC)
  - What the ninth hakureico launch on four wet providers showed (2026-09-08,
    11:27 UTC)
  - What the owner decided on the front matter (2026-09-08,
    13:15 UTC)
  - What the E2B calibration and the merge showed (2026-09-08,
    16:07 to 16:18 UTC)
  - What the tenth hakureico launch showed (2026-09-08,
    16:18 to 16:55 UTC)
  - What the eleventh hakureico launch showed (2026-09-08,
    16:56 to 18:21 UTC)
  - What the twelfth hakureico launch showed (2026-09-08,
    18:21 to 20:10 UTC)
  - What the yuki418330012 launch and the letter's landing showed (2026-09-08,
    20:18 to 22:10 UTC)
  - What the seventh yuki418330012 launch showed (2026-09-09,
    01:35 to 02:51 UTC)
  - What the nineteenth hakureico launch showed (2026-09-09,
    01:35 to 03:03 UTC)
  - What the twentieth hakureico launch showed (2026-09-09,
    03:21 to 04:28 UTC)
  - What the twenty-first hakureico launch showed (2026-09-09,
    04:39 to 06:13 UTC)
  - What the twenty-second hakureico launch showed (2026-09-09,
    06:20 to 07:46 UTC)
  - What the twenty-third hakureico launch showed (2026-09-09,
    08:01 to 09:31 UTC)
  - Where readiness stands on 2026-09-24
- [Part 03](translation-repair-readiness-signal-part-03.md)
  - What the fourth gqt launch showed (2026-09-09,
    08:01 to 09:46 UTC)
  - What the first noname launch showed (2026-09-09,
    09:50 to 11:45 UTC)
  - What the second noname and sixth Mio launches showed (2026-09-09,
    11:59 to 12:33 UTC)
  - What the third noname launch showed (2026-09-09,
    16:45 to 18:08 UTC)
  - What the Mio and hulicaijia launches showed (2026-09-09,
    18:20 to 20:30 UTC)
  - What the eighth Mio launch showed (2026-09-09,
    21:58 to 23:32 UTC)
  - Archive correction has current-stage evidence;
    audit and temporal context remain (2026-09-10)
  - Naming has current-stage evidence;
    archive and context work remains (2026-09-10)
  - The stored-review mismatch is fixed;
    wording follow-up remains (2026-09-10)
  - Mio12 preserves published verse but does not establish readiness (2026-09-10)
  - The verse remedy has passage-level evidence (2026-09-10)
  - The upstream verse remedy is being measured (2026-09-10)
  - The verse remedy is under review (2026-09-10,
    02:18 UTC)
  - What Mio10 showed (2026-09-10,
    00:15 to 01:36 UTC)
  - What the ninth Mio launch showed (2026-09-09,
    23:49 UTC to 2026-09-10,
    00:07 UTC)

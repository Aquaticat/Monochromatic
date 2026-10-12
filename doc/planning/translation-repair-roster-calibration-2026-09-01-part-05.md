# Roster calibration under the owner blocklist, 2026-09-01, part 05

Part 05 of [Roster calibration under the owner blocklist, 2026-09-01](translation-repair-roster-calibration-2026-09-01.md),
whose index lists every part in order.

## Decisions waiting on the owner

Collected here so a reader of the last section has the whole list;
each item's evidence lives in the
section or issue it names.

- Issue #473:
  recovery rounds for unreadable answers are served from the prompt-uniqueness cache in
  0 to 1 ms and never recover anything.
  Vary the prompt with the guard's complaint,
  or delete the round.
- Issue #474:
  an HTTP 429 (a concurrency limit on Synthetic) is read as a budget refusal and holds the
  provider dry for five minutes whatever its meter says;
  two holds at once end the pass and fail every
  remaining entry in under a second.
  Re-read the meter on 429 and back off briefly,
  or wait out the
  shorter hold,
  or at least state measured facts in the message.
  The fixed minimum vote weight of 2
  (`MIN_SELECTION_WEIGHT`),
  which a 4-of-8 ballot round reaches only when two full-weight ballots agree,
  belongs to the same decision.
- DECIDED 2026-09-02 09:0x UTC:
  the front-matter guard keeps structural checks only (commit `34e5c7ecd`,
  `doc/decision/translation-repair-front-matter-guard.md`).
  The owner's answer to the veto question was to
  its premise ("why are we caring about metadata being different vs Chinese source at all?"):
  the
  2026-08-28 trigger was a proxy for nothing,
  so the incumbent-fallback refusal and the night's standing
  machinery (daaf0ffa0,
  6f70a2085,
  1160ebb4c) are gone;
  the directory-id refusal now fires on the
  assembled page whether or not it equals the archive,
  narrowed by `6d85b619a` to pages whose source
  names the person differently (the census under "Advisor review at 09:30 UTC").
- DECIDED at the same time:
  unseat GLM-5.3-Flash from every judge role,
  keep its editor seat (commit
  `9a7d48354`,
  addendum in the seating decision doc);
  #473 is fixed by varying the recovery prompt with
  the complaint (commit `6323f05d8`,
  `RECOVERY_NUDGE` appended to the recovery round's messages);
  the
  slice 9 pronoun is a judge defect,
  not a policy (the source uses 她 sixteen times;
  commit `21757b86c`
  adds a `pronoun` line to the identity context and reads the house rule off the whole original);
  #474 options 1 and 2 are both implemented (commit `83e8dfa90`:
  a refusal
  re-reads the meter and holds a wet provider for 30 s rather than 300 s;
  a both-dry reading with a hold
  behind it waits out the shorter hold before ending the run).
- keyword233 is in the chain again (378 source characters in 9 blocks,
  the smallest of the four).
  XIEPT2
  is not:
  7365 source characters in 191 blocks against Toka_ls's 1532 in 62,
  about five times the
  source,
  and the publish test records its earlier attempt at four hours forty-eight minutes with no page
  kept.
  Under `FIT` (size runs to end within about an hour) that is the owner's call:
  a run of several
  hours,
  a different overlap,
  or a fresh week.
  Not a design decision,
  so no question is pending;
  the
  measurement is here for the veto.
- LANDED 2026-09-03 04:14 UTC:
  XIEPT2 at overlap 4 on Hyper alone in 129 minutes,
  paced at 1,000
  requests an hour,
  outside `FIT`;
  the pacer is the cost of one provider,
  and a run within the hour on
  Hyper alone needs either Synthetic's week back or a smaller shape (owner's call,
  veto invited).
- Reading findings on XIEPT2 (`doc/planning/translation-repair-xiept2-reading-2026-09-03.md`),
  each a
  policy or placement reading for the owner:
  the postscript's "took medication and breathed in gas"
  where the obituary block dropped both;
  the archive stub's `(To-Do)` placeholder kept as the page's
  first paragraph (fix the pass to drop placeholder-only archive paragraphs,
  or edit the stub);
  glosses
  from the archive's comments inserted inline (大证,
  WER) rather than as footnotes;
  semantic wrap applied
  per slice so the page alternates shapes.
- Provider-aware judge seat (task #33):
  Qwen3.8-27B is unseated from every judge round on Hyper's cut
  record but answered 25 of 28 select rounds on Synthetic;
  Kimi-K3 is the next candidate under the same
  rule (majority of select and contest rounds cut on Hyper,
  under half in critic and panel).

## Advisor review at 09:30 UTC: six proofs and five fixes before the chain

The reviewer read the transcript up to commit `c29003671` and named two defects,
three measurements
to make before Carena launched unattended,
and a list of smaller items.
The chain was stopped,
the
fixes landed as five commits with the whole suite green after each (`~/temp/agent/test-unit-fixes-20260902.log`,
exit 0,
oxlint 0 warnings,
types clean),
and the chain was requeued on the fixed tree.

- `b547e80ed`:
  the reading after a waited-out hold folded the routing refusal in a second time.
  With
  Hyper dry by meter and Synthetic refusing on a wet meter,
  the call waited out Synthetic's hold and then
  ended the run as both-dry,
  the mirror image of today's regime.
  The refusal is what the hold became;
  an
  expired hold is the provider coming back.
  Mirror tests in the hold-wait and router suites.
- `8fa961d2e`:
  `sourcePronounLines` counted 他们,
  其他,
  其他人,
  他人 and 她们 as pronouns and TA inside
  DATA or STATION.
  Positive control over the four pages after the fix:
  Toka_ls 她 20 (raw 20 她,
  1 他 all
  inside 其他 and 他人),
  XIEPT2 她 76 (raw 77 她 against 17 他,
  of which 9 他们,
  5 其他,
  3 他人),
  keyword233 她 9,
  Carena0442 她 110 (raw 111,
  6 他 of which 3 他们,
  1 其他,
  2 他人).
  No page emits TA.
- `6d85b619a`:
  the directory-id refusal fired on any assembled page whose visible name is the entry id.
  Census at the pinned commit:
  23 of 92 archives name the directory,
  and 8 of them (Anilovr,
  Arita,
  ArtsEpiphany,
  Hangmster,
  keyword233,
  Mio,
  mone,
  s5ehfr9) do so in the source too,
  because the handle is
  the person's name.
  The rule now refuses only where the source names the person differently;
  the other
  15 (Acheron,
  DarlinChit,
  dogesir_,
  donotexist_A,
  homoyamakaze,
  Huasheng,
  interrgned,
  Kotori,
  lintong,
  lxyddice,
  MioCardMeow,
  MocaKawai,
  noname,
  Weideriche_,
  XingZ60) are the #269 shape and stay refused
  until a lane renders the name.
  Without this,
  keyword233 would have been refused tonight.
- `b68bae845`:
  every refusal started its own meter reading;
  the pin pass saw eight 429s inside one
  second.
  A reading still in flight is now shared by refusals arriving during it.
  The 30 s backoff did
  not outlast the 31 s burst its own comment cited,
  so the backoff is now `BUDGET_FRESH_MS` (60 s):
  the
  hold expires with the reading that excused it.
- `4d7c47159`:
  rule `QDF` measured 211 characters after whitespace normalisation against `RLM`'s 200;
  trimmed to 181 (measured after the edit) by dropping a clause its first sentence already says.
  `QPW`
  measures 161.

One count to reconcile:
the house-rule commit,
the identity-context comment and its test say the Toka_ls
page uses 她 "sixteen times".
That figure was a line count (`rg -c`,
16 lines carry the character);
the
occurrence count is 20,
on the whole page and on the body alike,
and 20 is what the identity line now
states.
The two source wordings get corrected in the post-launch batch below.

GFP for all six behaviours,
each neutralised in source,
rebuilt,
its test run alone,
restored and rebuilt
(`~/temp/agent/gfp-20260902/`):
the router hold-wait test (3 FAIL lines with the wait skipped),
the
recovery-nudge test (2 with `RECOVERY_NUDGE` dropped),
the fold tests (2 and 2 with the refusal folded
back in),
the pronoun tests (4 with compounds and word bounds off),
the directory-id test (2 with the
source check dropped),
the coalescing test (2 with the in-flight check off).
All six pass on the restored
tree.

Measurements the reviewer asked for,
with what they change:

- The unseated rosters pass the judgeable-roster assertions (`assertJudgeableProducerRoster` for the
  translators against the wide seats and the roster against the late judges;
  the editor assertion
  against the wide seats),
  run through `node --input-type=module-typescript` against the source.
  Carena
  will not die at launch on a roster shape.
- `verify-published` reads only the runs directory (`resolveRunsDir`,
  `artifacts/`,
  `fixed/`) and never
  the corpus clone,
  so the earlier chain's Carena verify was not wrong;
  the clone variables are passed
  to it anyway so the shape is the same as the pass.
- Task 8 (bind the guard to an adjudicated incumbent win) is closed as superseded by the structural
  reduction;
  nothing in it is open.

Left as recorded,
not acted on:
the house-policy pronoun rule reaches Carena and keyword233 only;
the
Toka_ls rerun predates it.

The hold on source edits was lifted at 10:08 UTC after the owner asked why the named work had stopped:
the chain was stopped,
the work landed as whole commits with the suite green after each,
and the chain
was re-armed at 10:28 on `4cdc85f69` with Toka_ls still running (in consolidation since 10:07).

- `12ed82cee`:
  the owner's title rule as a house-policy bullet (official English title when one exists,
  the Life of Pi play,
  notes as established vocabulary,
  a web lookup as evidence);
  the notes both pages
  carry folded into the identity context,
  labelled by side and kind;
  every 《…》 work in the source
  looked up through Exa once and cached under the user's cache directory;
  the critic sheet told what the
  new line kinds license;
  the prepared-pair types moved to their own file at the line budget.
  Positive
  control over eight real entries:
  XIEPT2 18 lines (its archive's 17 comments,
  translation hint and
  glossary included),
  hulicaijia 17 lines and 2410 bytes (the largest block,
  riding every call of that
  entry),
  yulianNyanner 26 lines and 1914 bytes,
  Toka_ls and keyword233 two contributor-credit lines
  each,
  Carena0442 its two footnotes.
  GFP:
  the notes test fails with the collector emptied (2 FAIL
  lines),
  the lookup test fails with the cache read made a miss (2).
- `4cdc85f69`:
  the collapse key folds trailing spaces on blank and blank-quote lines before judging
  (65 pinned pages use Markdown hard breaks on content lines,
  saurikissa's archive 35 of them,
  so
  content lines keep theirs);
  the both-dry error states the meter states and holds it was decided on;
  the router's re-route comment reads holds;
  the pronoun record says twenty on sixteen lines.
  GFP:
  the
  collapse test fails with the fold removed (2),
  the hold-wait test with the measurement clause dropped
  (2).

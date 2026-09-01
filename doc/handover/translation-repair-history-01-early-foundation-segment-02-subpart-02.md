# Translation repair history: segment 2.2

Part of the [translation repair history index](translation-repair-history.md).

## Current stop condition

Historical evidence only.
Candidate M failed on 2026-09-01.
No historical next-action list authorizes a corpus run,
model call,
spent-prompt retry,
or successor implementation.

## Continued record

### Preserved chronological continuation

LARGE-ENTRY TAIL (2026-07-24,
   deterministic slice survey
slice-distribution.mjs):
   the corpus slice-count distribution is
median 8 but long-tailed -- aiyysk 77 slices,
   hulicaijia 65,
   shihai4h 45,
interrgned 43,
   NIGHT81473140 41,
   Xu_Yushu 35,
   XingZ60 31,
   Dethelly 24;
total 1129 slices over 92 entries.
   At ~5.5 min/slice the biggest need
multiple HOURS end to end,
   so ~10 entries cannot complete in ANY bounded
single-run cap.
   The 90-min cap settles the ~80 smaller entries;
   the tail
needs slice-level RESUMABILITY (cache completed slices,
   resume across
runs) -- a change to the pure function's contract (inject a slice cache,
like the client is injected).
   Flagged to the user as a decision before
building.
   Meanwhile run 006 relaunches so the bulk keeps settling;
   huge
entries waste one 90-min attempt then deprioritize (attempts already 1 for
Anilovr/Arita).
PASS 6 RUN 006 (2026-07-24,
   tip `47ba504a3`,
   3034s wall):
   3 dispatched,
   3
completed,
   0 failed.
   ArtsEpiphany unchanged (0 issues,
   8s,
   the placeholder
stub again);
   BI4PBV repaired (38 issues,
   37 accepted,
   36 resolved,
   5
findings,
   1437s);
   Barron12312 repaired (49 issues,
   46 accepted,
   46
resolved,
   2 findings,
   1590s).
   The per-entry cap did its job -- three
entries packed before the soft budget instead of one blocking the run.
7/92 settled.
   Run 007 launched.
USER PICK (2026-07-24):
   the large-entry tail is solved with SLICE-LEVEL
RESUMABILITY (chosen over a very high atomic cap or reducing per-slice
cost).
   Plan:
   inject an optional slice cache into repairTranslation (keyed
by deterministic slice content hash),
   persist each completed slice,
   resume
across runs;
   driver supplies a disk-backed cache under the runs dir.
   Build
next,
   additive so the bulk keeps running on current code meanwhile.
RESUMABILITY LANDED (2026-07-24,
   commit `bfc3f6449`):
   `SliceCache`
(`{ resumed: ReadonlyMap<hash, ChunkRepairOutcome>, persist(key,
serialized) }`) injected optionally into `repairTranslation`;
   the slice
loop keys each slice by `hashContent([chunkIndex, sourceText,
targetText])`,
   reuses a resumed outcome (zero model calls) or computes then
persists it.
   Driver helper `corpus-run/slice-cache-store.ts`
(openSliceCache / discardSliceCache) writes one JSON per slice under
`node_modules/.monochromatic/translation-repair-runs/slice-cache/<entry>/`,
guards each file (a half-write recomputes),
   and drops the dir on settle.
   A
huge entry (aiyysk 77 slices) now completes over several 90-min attempts
instead of losing all work each abort -- it deprioritizes between attempts
but caches ~16 more slices each.
   Persist takes a SERIALIZED STRING,
   not the
outcome object,
   because the repo BANS disabling
prefer-readonly-parameter-types (rule no-disable-prefer-readonly-
parameter-types);
   a string param sidesteps it,
   the pipeline owns
serialization,
   the driver writes bytes.
   Additive and result-preserving
(unit test:
   the resumed run makes 0 model calls and reproduces the fresh
result),
   so settled artifacts stay valid and NO restart.
RESTART NOTE (IMPORTANT):
   the slice-cache stores repairChunk OUTCOMES,
   so a
PIPELINE change makes it stale.
   The restart/wipe routine now clears THREE
things together:
   `artifacts/`,
   `attempts.json`,
   AND `slice-cache/`.
Content-hash keys already self-invalidate on a slicing change,
   but wipe all
three anyway.
   Verified format/lint/types/unit 0 and `--plan` runs.
   Run 007
was already in flight on pre-resumability code (per-entry cap,
   no cache);
it finishes normally,
   then run 008 launches with resumability.
PASS 6 RUN 007 (2026-07-24,
   tip `c4cfe103b`,
   3119s wall):
   1 dispatched,
   1
completed,
   0 failed.
   Chinatsu_Suzuki repaired (77 issues,
   77 accepted,
   all
77 resolved,
   4 findings,
   3119s ~52 min) -- an entry that would have hit
the old 45-min per-run cap but fits the 90-min per-entry budget;
   the cap
fix earned its keep.
   8/92 settled.
   Run 008 launched WITH resumability
active (tip after the resumability commits).
PASS 6 RUN 008 (2026-07-24,
   tip `ed5936126`,
   3079s wall,
   resumability
live):
   1 dispatched,
   1 completed,
   0 failed.
   Considerate_cat repaired (50
issues,
   41 accepted,
   40 resolved,
   11 findings,
   3079s).
   Resumability
cleanup verified in production:
   the slice-cache dir is empty after the run
because the settled entry's cache was discarded as designed.
   9/92 settled.
Run 009 launched.
PASS 6 RUN 009 (2026-07-24,
   tip `7c3cca379`,
   1634s wall):
   1 dispatched,
   1
completed,
   0 failed.
   CuspariaKLSY repaired (74 issues,
   70 accepted,
   all 70
resolved,
   6 findings,
   1634s).
   10/92 settled.
   Run 010 launched.
PASS 6 RUN 010 (2026-07-24,
   tip `d1d2f2c52`,
   2505s wall):
   2 dispatched,
   2
completed,
   0 failed.
   CutOceanHeyFis1 repaired (19 issues,
   19 accepted,
   18
resolved,
   5 findings,
   1182s);
   DarlinChit repaired (46 issues,
   40 accepted,
40 resolved,
   20 findings,
   1323s).
   12/92 settled.
   (Run 010's first launch
was killed by a transient harness hiccup right after the run-009 commit
landed;
   relaunched standalone.
   Going forward:
   commit foreground,
   launch
corpus-pass as its own background command.)
   Run 011 launched.
COVERAGE-BAR DECISION (2026-07-25,
   user-approved):
   task 30's completion bar
changed from "all 92 settled" to STRATIFIED REPRESENTATIVE COVERAGE
(~10/10/10 across small/medium/large size bands).
   Rationale:
   the M3 gate is
human-graded precision on a uniform 50-issue sample;
   12 settled entries
already yield hundreds of accepted issues,
   so sample SIZE was satisfied long
ago and the full-92 pass was never load-bearing for it.
   What the gate needs
is a REPRESENTATIVE sample,
   and the pool was skewed small -- 9 small / 2
medium / 1 large by page.md byte-size tertiles (small <=1.8KB,
   medium
1.8-3.6KB,
   large >=3.6KB up to 40.7KB),
   with the single large entry sitting
at the bottom of its band.
   The heavily-sliced large tail -- exactly where
the lockstep slicing fix most affects precision -- was un-sampled.
   Target:
~10 settled per band (need ~1 small,
   ~8 medium,
   ~9 large),
   large picks
spread across the band;
   then draw the 50-issue sample STRATIFIED by band.
The skew is a throughput artifact:
   small entries finish inside one run while
large ones consume it,
   so equal wall-clock settles many small + few large.
DRIVER FIX (same day,
   DRIVER-ONLY so NO restart/wipe -- repair outputs per
entry are identical):
   corpus-pass now sorts the small band LAST in `pending`
(`SMALL_PAGE_BYTES=1843`,
   measuring page-source bytes via TextEncoder),
then fewest-attempts within a band,
   so run budget flows to medium+large;
small still settles once larger bands are served (deprioritize,
   not
exclude).
   Verified format/lint/types 0/0/0 and `--plan` first-5 pending all
non-small (Everythings99 1859B .. Huasheng 7397B).
   Run 011 was already in
flight on the old order and finishes normally;
   run 012 onward uses the new
order.
   Task 30 subject/description updated to match.
PASS 6 RUN 011 (2026-07-25,
   tip `e032fa453`,
   hit the per-entry 90-min cap):
0 settled,
   still 12/92.
   Dethelly (6171B,
   large band) processed 13
chunks/slices then aborted at the hard ceiling (TALLY status=ERROR
aborted=true,
   Timeout).
   FIRST cap-abort since resumability landed:
   all 13
finished slices persisted to `slice-cache/Dethelly/` and the cache was
correctly RETAINED on abort (discard is success-only).
   This exposed an
ordering flaw -- `attempts[Dethelly]` incremented to 1 and the within-band
tiebreak was fewest-attempts-first,
   so Dethelly sorted BEHIND every
0-attempt non-small entry;
   run 012 would have started a fresh entry and
left the 13 cached slices idle,
   and every big-large entry would take one
partial attempt with none finishing,
   starving exactly the entries that most
need resume and defeating the "large spread across band" goal.
RESUME-FIRST FIX (driver-only,
   no restart):
   added `listResumableEntries`
(slice-cache-store.ts) returning ids whose cache dir holds >=1 finished
slice;
   corpus-pass now sorts those FIRST (before band,
   before attempts) so
an in-flight large document finishes before a fresh one starts.
   Safe against
livelock because `repairChunk` never throws -- every failure path (votes
stand / no claims / no envelopes / no surviving ops / lost voices) returns
an unchanged outcome that gets persisted,
   and a cap-abort always completes
>=1 new slice;
>the only residual (a deterministic pure-function throw at
some slice) would surface as a repeated same-entry ERROR and is caught by
per-run inspection,
>not silently absorbed.
>Verified format/lint/types 0/0/0
and `--plan` first=Dethelly,Everythings99,... (resumable sorts first).
VERIFICATION CAVEAT (do NOT overstate):
>only the PERSIST-on-abort half of
resumability is proven in production (the 13 files exist).
>The RESUME half
-- next run reads them back,
>skips them with ZERO model calls,
>continues on
new slices,
>settles,
>and DISCARDS the cache -- has never run.
>Run 012 is its
first real test.
>Watch run 012 for:
>Dethelly starts near-instantly,
>no
critic/panel/editor/checker calls on the 13 cached chunks,
>continuation on
chunk 13+,
>a settle,
>then `slice-cache/Dethelly/` GONE.
>Only after seeing
that is resumability end-to-end validated.
>Run 012 launched.
PASS 6 RUN 012 (2026-07-25,
>tip `90809eeed`,
>3958s wall ~66 min):
>1 settled,
13/92.
>RESUMABILITY END-TO-END VALIDATED IN PRODUCTION.
>Resume-first put
Dethelly at the front (START/--plan confirmed);
>the log shows `6 chunk
pairs, 24 slices`,
>the 13 cached slices (chunks 0-12) skipped with ZERO
stage/model logs,
>the FIRST critic stage firing at chunk 13,
>then
continuation through slice 23,
>then TALLY status=repaired (391 issues,
>373
accepted,
>364 resolved,
>100 findings).
>Post-settle the `Dethelly.json`
artifact is present AND `slice-cache/Dethelly/` is GONE (cache root empty):
the full skip->continue->settle->discard cycle observed.
>Both halves now
proven -- persist-on-abort (run 011) and resume+discard (run 012).
>The
resume-first ordering also proved correct:
>run 012 processed only Dethelly
(it started past the 25-min soft budget) and ended.
>Dethelly is large-band,
so large settled 1->2 (Chinatsu_Suzuki ~5.2KB,
>Dethelly ~6.2KB -- both
mid-large;
>bigger large entries still needed for band spread).
>Run 013
launched (no resumable entries remain,
>so it picks the first non-small
0-attempt entry by band order).
PASS 6 RUN 013 (2026-07-25,
>tip `54eb8c323`,
>1529s wall ~25 min):
>1 settled,
14/92.
>Everythings99 repaired (32 issues,
>31 accepted,
>31 resolved,
>1
finding);
>settled in one run,
>no cap,
>cache empty after.
>First non-small
0-attempt entry by the new band order (1859B,
>bottom of the medium band),
so medium settled 2->3.
>Bands now 9 small / 3 medium / 2 large.
>Run 014
launched.
PASS 6 RUN 014 (2026-07-25,
>tip `a70cb3592`,
>4867s wall ~81 min):
>1 settled,
15/92.
>Futajuhuacha repaired (5448B/large,
>248 issues,
>243 accepted,
>238
resolved,
>59 findings);
>settled in ONE run just under the 90-min cap,
>no
abort,
>cache empty after.
>Large settled 2->3 (a large entry that fits the
single-run budget -- only the biggest large entries, >~6-12KB,
>need resume).
Bands now 9 small / 3 medium / 3 large.
>Run 015 launched.
PASS 6 RUN 015 (2026-07-25,
>tip `3a119f095`,
>5194s wall ~87 min):
>1 settled,
16/92.
>Huasheng repaired (7397B/large,
>235 issues,
>227 accepted,
>226
resolved,
>40 findings);
>settled in ONE run right at the 90-min cap ceiling.
Large settled 3->4 (all four are mid-large 5.2-7.4KB;
>entries above ~7.4KB
will start capping and needing resume).
>Bands now 9 small / 3 medium / 4
large.
>OPERATIONAL NOTE:
>run 015's FIRST launch was chained onto the commit
with a bare `&` (untracked) -- no completion notification,
>and the tracked
watcher I added was itself killed after ~1 min.
>Fixed by killing the
untracked run (0 slices lost,
>killed mid-first-chunk on GLaDOSister;
>its
empty cache dir removed) and relaunching run 015 as its own
`run_in_background` task.
>GLaDOSister carries a wasted attempt=1 from that
kill,
>so it sorts one slot behind the 0-attempt entries (harmless,
>still a
needed medium).
>RULE:
>launch corpus-pass ONLY as a standalone tracked
background command,
>never a bare `&` chained after another command.
>Run 016
launched.
PASS 6 RUN 016 (2026-07-25,
>tip `8eddd3906`,
>4016s wall ~67 min):
>1 settled,
17/92.
>Jennife80677612 repaired (3859B/large-bottom,
>84 issues,
>78 accepted,
76 resolved,
>11 findings);
>one run,
>no cap.
>Large settled 4->5 (all five
still lower-large 3.9-7.4KB;
>bigger large entries still ahead).
>Bands now 9
small / 3 medium / 5 large.
>Run 017 launched.
PASS 6 RUN 017 (2026-07-25,
>tip `7719f975f`,
>~77 min effective on the third
launch):
>2 settled,
>19/92.
>KILL SAGA + resume-across-external-kill validated.
Run 017's first launch (tracked) ran ~16 min on Katerina,
>finishing chunks
0-2,
>then was KILLED (external,
>non-resource:
>load ~1.3,
>33Gi free,
>no OOM);
Katerina's 3 slices persisted.
>Relaunch died at START (~1 min,
>another
transient kill),
>zero progress,
>3 slices intact.
>THIRD launch survived ~77
min and settled TWO entries:
>Katerina RESUMED (`8 slices`,
>first completion
`chunk 3` -- the 3 cached chunks skipped with zero model calls,
>so resume is
now proven across an EXTERNAL KILL,
>not just a cap-abort;
>~18 min,
>70 issues
66 accepted 65 resolved) then Kotori fresh (~59 min,
>138 issues 129 accepted
126 resolved).
>Both are medium (Katerina 2.2KB,
>Kotori 2.4KB),
>so medium
3->5.
>LESSON:
>the intermittent background-task kills seen this session (runs
010/011 first launches,
>a watcher,
>run 017 x2) are HARMLESS under
resumability -- each costs at most the in-flight slice;
>on a `killed`
notification just relaunch and resume-first continues the entry.
>Recomputed
band totals over all 19 settled:
>small 9/30 (need ~1),
>medium 5/31 (need
~5),
>large 5/31 (need ~5);
>large still all lower-band 3.8-7.2KB,
>bigger
large entries (9-40KB,
>will cap and need multi-run resume) still ahead.
>Run
018 launched.
PASS 6 RUN 018 (2026-07-25,
>tip `0fa06bd7e`,
>3096s wall ~52 min):
>1 settled,
20/92.
>LCG_Akiball repaired (large,
>89 issues,
>83 accepted,
>82 resolved,
>8
findings);
>one run,
>no cap.
>Large settled 5->6.
>Bands now 9 small / 5 medium
/ 6 large (need ~1 small,
>~5 medium,
>~4 large).
>Run 019 launched.
PASS 6 RUN 019 (2026-07-25,
>tip `5063a3740`,
>4254s wall ~71 min effective;
first launch killed at START,
>0 loss,
>empty MTF_0615 cache dir removed):
1 settled,
>21/92.
>MeowBot233 repaired (medium,
>206 issues,
>198 accepted,
>198
resolved,
>23 findings);
>one run,
>no cap.
>Medium settled 5->6.
>Bands now 9
small / 6 medium / 6 large (need ~1 small,
>~4 medium,
>~4 large).
>Run 020
launched.
PASS 6 RUN 020 (2026-07-25,
>tip `55b0dd444`,
>2257s wall ~38 min):
>1 settled,
Mio status=blocked-non-translation (93 accepted issues,
>0 resolved).
>FALSE
BLOCK discovered and fixed (commit `398007d4c`).
>Mio's en page is a faithful
translation that ALSO translates its embedded images -- WeChat chat logs,
Twitter posts,
>and a final chat that the zh page.md carries only as
`<PhotoScroll>` photos,
>so that translated-image text has NO zh-markdown
counterpart.
>Its slices correctly drew non-translation votes (chunks
5,6,8-12,
>all 7/7),
>and at 5342 of 7778 target chars (69%) they tripped the
bare char-majority dominance rule and discarded the whole document,
>even
though chunks 0,1,2,7 are clean repaired translations.
>VERIFIED SYSTEMIC via
a scan of all 22 artifacts:
>Futajuhuacha and Huasheng each carry 8 standing
slices too (same as Mio) and only escaped because their standing chars
stayed under half;
>every entry with standing slices also has clean chunks
(Mio 5,
>Futajuhuacha 11,
>Huasheng 13,
>Dethelly 22,
>Kotori 10).
>This is the
4TH real-corpus non-translation block this session (Aniloviraw,
>AkiraComplex,
Arita,
>Mio) and ALL FOUR WERE FALSE;
>the only true positive ever is the
invented cat/"meow" pair.
>Discriminator:
>every false block held confirmed
good-translation content;
>the true positive held none.
>FIX (advisor-guided,
document-dominance layer ONLY):
>added `sliceAnchorsTranslation` (a
non-standing slice carrying an accepted target-anchored content critique) and
`assessNonTranslationDominance` now vetoes the block whenever ANY slice
anchors translation -- a threshold-free discriminator from 4-false-vs-1-true,
keeping the calibrated err-toward-not-blocking direction.
>Because the change
only flips the block branch and only toward NOT blocking,
>every "repaired"
entry is provably unchanged;
>ONLY Mio is stale (no full wipe,
>slicing
untouched so caches stay valid).
>Deterministic tests pass (Mio-shape
dominance regression + six anchor-probe cases);
>format/lint/types/build 0.
Live Mio re-validation CONFIRMED (sentinel-probe `bcgzdo82q`,
>~47 min):
PROBE Mio status=repaired (84 issues,
>82 accepted,
>45 findings) -- flipped
blocked->repaired exactly like Arita.
>The log shows the correct shape:
>chunks
0,1,2,3,4,7 repaired (clean anchors),
>chunks 5,6,8-15 still ship unchanged
per-slice (10 standing,
>even MORE than run 020's 8,
>yet no document block
because the anchors veto it).
>Stale Mio.json deleted and Mio's attempts entry
reset to 0 so it re-settles as a fair medium candidate during accumulation;
settled dropped to 21/92 (9 small / 6 medium / 6 large).
>Accumulation resumed
at run 021 (NO pass restart or wipe -- only Mio was stale).
>Surface the
4/4-false-block pattern in the milestone writeup -- it is a real finding about
this feature's value on this all-real-translation corpus.
PASS 6 RUN 021 (2026-07-25,
>tip `5baaa37c2`,
>2829s wall ~47 min):
>1 settled,
22/92.
>Mio RE-SETTLED status=repaired (88 issues,
>87 accepted,
>ALL 87
resolved,
>56 findings) under the anchor-veto fix -- the false block is gone
in the actual artifact pool,
>not just the probe.
>Picked first because its
attempts were reset to 0.
>Medium settled 6->7.
>Bands now 9 small / 7 medium
/ 6 large (need ~1 small,
>~3 medium,
>~4 large).
>Run 022 launched.
PASS 6 RUN 022 (2026-07-25,
>tip `3e905b1f3`,
>1864s wall ~31 min):
>1 settled,
23/92.
>Mizuki_Yuuki repaired (medium,
>59 issues,
>58 accepted,
>58 resolved,
>6
findings);
>one run,
>no cap.
>Medium settled 7->8.
>Bands now 9 small / 8
medium / 6 large (need ~1 small,
>~2 medium,
>~4 large).
>Large lags because its
bigger entries (9-40KB) need multi-run resume.
>Run 023 launched.
PASS 6 RUN 023 (2026-07-25,
>tip `1d670bc17`,
>2596s wall ~43 min):
>1 settled,
24/92.
>MushroomGuuuu repaired (MEDIUM band,
>1934B zh source;
>69 issues,
>62
accepted,
>62 resolved,
>8 findings,
>7 chunks);
>one run,
>exceeded 25-min soft
budget but settled within 90-min hard cap.
>Medium settled 8->9.
>Bands now 9
small / 9 medium / 6 large (small & medium at the ~10 bar;
>large needs ~4).
Advisor call (Opus 4.8):
>do NOT add ordering to force large -- runs are free
background work (user waived quota),
>6 large already yields ample large-band
accepted issues (MushroomGuuuu alone 62 >> the ~17 a stratified 50-sample
needs),
>so large=~10 is document-diversity polish,
>not sample-sufficiency;
also `corpus-pass` takes only `--plan`,
>no entry-id targeting arg,
>so forcing
large would mean new code through the lint gauntlet for negative ROI.
>Decision:
run naturally (eligible order interleaves medium/large;
>resume-first finishes
any that abort;
>no stall risk),
>and redirect ACTIVE effort to tasks 31/32
(judge crosscheck + stratified sample tooling) which are unblocked against the
24 already-settled entries -- only the final draw waits on band fill.
>Run 024
launched.
PASS 6 RUN 024 (2026-07-25,
>tip `87c13c925`,
>hit the 90-min HARD cap):
>0
settled,
>still 24/92.
>NIGHT81473140 (LARGE,
>12301B zh,
>the 9-40KB tail)
aborted at the hard cap after completing 22 cached slices;
>status=ERROR
aborted=true,
>attempts=1.
>This is the resume-first path working as designed --
the 22 finished slices persist,
>so run 025 resume-first-picks NIGHT81473140 and
continues from slice 22+ rather than restarting (degrade-and-persist + the
cap-abort-completes->=1-slice guarantee make this monotonic).
>First entry to
exercise the hard cap this pass;
>the biggest large entries will need multi-run
resume.
>Run 025 launched to resume it.
PASS 6 RUN 025 (2026-07-25,
>tip `72128f17b`,
>4978s wall ~83 min):
>1 settled,
25/92.
>NIGHT81473140 RESUMED and settled repaired (LARGE,
>12301B;
>123 issues,
105 accepted,
>105 resolved,
>42 findings) -- run 024's 22 cached slices skipped
with zero model calls,
>the remaining 19 of 41 total processed to settlement
inside the hard cap.
>First PRODUCTION proof of the multi-run-resume path
settling a hard-cap-aborted large entry end-to-end (earlier resume validation
was Dethelly,
>which had not hit the cap).
>Large settled 6->7.
>Bands now 9 small
/ 9 medium / 7 large (large needs ~3 more for the ~10 bar).
>Run 026 launched.
PASS 6 RUN 026 (2026-07-25,
>tip `5b0f818877`,
>2731s wall ~46 min;
>a first
launch was KILLED ~2 min in on Proselyte093 with 0 slices done -- intermittent
non-resource kill,
>empty cache dir removed,
>relaunched):
>1 settled,
>26/92.
SS3B_0016 repaired (MEDIUM,
>2040B;
>139 issues,
>135 accepted,
>135 resolved,
>6
findings).
>Medium settled 9->10,
>hitting the ~10 bar.
>This is the advisor-
sanctioned natural-ordering medium over-coverage (extra medium is data,
>not
waste;
>no ordering change to force large).
>Bands now 9 small / 10 medium / 7
large (large needs ~3 more).
>Run 027 launched.
PASS 6 RUN 027 (2026-07-25,
>tip `bbaea33dd`,
>hit the 90-min HARD cap):
>0
settled,
>still 26/92.
>Susiethegamer (LARGE,
>4557B,
>heavily sliced -- 19 slices
across 2 chunk pairs) aborted at the hard cap ONE slice short:
>18 of 19 cached.

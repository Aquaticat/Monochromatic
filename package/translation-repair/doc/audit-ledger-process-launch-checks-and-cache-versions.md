# Audit ledger: process mistakes, launch checks and cache versions

What went unchecked before a run launched:
the full suite,
the lint,
the cache versions,
the handover,
and the log's two streams.

Part of [Audit ledger](audit-ledger.md),
which lists every file of this record.

## M19: a suite run against a stale build after a mutation was restored

Status:
caught the same hour,
2026-09-27 (E1).
The package's `test:unit` task runs the tests against `dist` without building;
only `buildAndTest` builds first.
After a mutation check the source was restored with `git checkout --`
and the suite launched through `test:unit`,
so it ran against the mutant's build and reported its two guards failing.
Prevention:
every suite run goes through `buildAndTest`,
and so does any single test file run after a source change,
through `mise run build` first.

## M25: floors and sheets changed a cached stage's decisions with no cache version moved

Status:
corrected in `66703994a`,
which moved the translate cache to 15 and the consolidation cache to 20,
with the repair cache's version 33 account naming what rode inside it,
2026-09-27.
The translate and consolidation versions landed at 06:34 UTC (`bd98bdc70`);
after them the F-series floors,
the Han residue floor,
the sheets reading the declared names and house rules,
the reachable quorum and the A17 signer floor all changed what those stages ask or accept,
and none moved a number;
the repair lane had four more such changes after its version 32 (07:34 UTC).
No harm reached a page,
and only by luck:
no run cached a slice after 04:26 UTC that day.
Each version file says the bump is enforced by nothing and was missed before.
Prevention:
a commit that changes a floor,
a sheet,
a threshold or a settlement rule in the translate,
consolidation
or repair path names in its message which cache version it moves,
or why none moves;
and before any run launches,
the versions are checked against `git log` since each one last moved.

## M28: the M25 correction checked three of six cache versions

Status:
corrected in the commit that moved the lane contest to 6 and pairing to 3,
2026-09-28.
M25's check walked the translate,
consolidation and repair versions and stopped there.
The lane contest (version 5 since 2026-08-29) kept its number through changes to its sheet,
its eligibility floor,
its windows and its quorum,
and its ballots were cached under version 5 on fifteen days of changing sheets;
pairing (version 2 since 2026-08-29) kept its number through windowed rounds and bench-sized quorums;
refine (version 5 since 07:34 UTC on 2026-09-27) carried house-rule changes with no account.
Found while accounting for K13,
whose house-rule line reaches every one of those sheets.
The page-assembly Canadian pass is outside every key,
but the prose ranges it shares with the Han-residue floor are not;
that too was nearly missed.
Prevention:
M25's pre-launch check lists every `*CACHE_VERSION` constant in `src`
(`rg 'CACHE_VERSION[A-Z_]* = ' src`),
not the ones remembered,
and for each one runs `git log` since it last moved over every file its stage's sheet or floors import,
the shared house rules and prose ranges included.

The first pre-launch check under this rule,
2026-09-28,
run by `cache-account-audit.ts` over all six constants:
translate 15 and consolidation 20 set in `66703994a` (02:56 UTC on 2026-09-28),
repair 33 in `f2cd70ece` (02:41 UTC on 2026-09-28),
refine 5 in `30e66051e` (07:34 UTC on 2026-09-27),
lane contest 6 and pairing 3 in `d614a0c1d` (04:30 UTC on 2026-09-28).
Every one was set after the newest slice-cache file under the agent runs (04:26 UTC on 2026-09-27),
and none has been written since:
`TZ=UTC find ... -newermt '2026-09-27 04:27'` gives 0,
and its control at 04:20 UTC gives 18.
So no answer cached under an earlier question can be served under any current number,
and no version moves.
Of the 153 non-test source commits since the earliest of them,
37 are named by an account and 116 by none
(the script prints each with its subject and the versions set before it);
they ride inside every version by the same fact,
and each version's TSDoc now says so,
dated.
Rerun 2026-09-28 over seven constants,
with the page title lexicon's `PAGE_TITLE_CACHE_VERSION` 1 (`ea61cbd4c`)
added to the script and the repair version now 34 (`ef20e7978`):
`TZ=UTC find ... -newermt '2026-09-27 04:20'` gives the same 18 files,
all by 04:26 UTC that day,
and none since,
so every number still holds what it names.
The page title lines and X20's heading pairs reach the slices through the identity context,
which all five slice keys hash,
and never reach a pairing sheet,
whose key does not carry them.

The script moved into the package on 2026-09-29 as the read-only mise task `cache-account-audit`
(`corpus-run/cache-account-audit.ts`),
which reads every constant ending in `CACHE_VERSION` out of the tracked source instead of a typed list,
finds each setting as the newest commit that added the declaration on balance,
reads diff lines with the same declaration reader so a longer name or value holding one is told apart,
and compares times in unix seconds.
On that day's history it gives the script's answer:
the same seven settings,
353 source commits since `30e66051e`,
and the same 295 hashes named by no account.
Its readers have their own unit tests,
and 12 mutants of them are caught with a comment control surviving.
Moving it in found one gap:
the page title version had no account,
and its TSDoc said a span detector change moves it,
while `d9a306602` and `ee39e2ba5` changed the detector and left it at 1.
The key hashes every detected title with its count,
so a changed detection is a changed key;
the TSDoc now says only the sheet's wording and the choice move it,
names both commits as riding inside,
and records that no slice-cache file has been written since the value was set,
where a control time finds 494.

## M37: a key component added from a flag's name

Status:
happened 2026-09-28 in X11 (`c5ac38345`);
reverted in `6d9b361b4`,
whose guard pins the key unmoved.
`checkerSelfCertificationPermitted` was folded into the repair run shape
on the reading that it "decides who may check a refinement".
Every reader hands it to `assertCheckerIndependence`,
which only refuses a roster before anything is bought:
a roster it admits is asked and weighed the same either way,
and the checkers are keyed already.
The readers also default an absent flag to refused while the fold read only an explicit `false`,
which is how the mistake surfaced.
Prevention:
before a field goes into a key,
list every reader of it (`rg` for the field)
and name the question or weighting it changes for a run that goes ahead;
a field that only admits or refuses the run stays out,
with a comment saying why.

## M57: a cache-file check whose time this host's `find` refused, with its error discarded

Status:
happened 2026-09-29 during B22,
caught by its control before any account used it.
The rides-inside check for the declared-name fix ran
`find <runs> -path '*slice-cache*' -type f -newermt '2026-09-26 20:00 UTC' 2>/dev/null`
as its control and printed a count of zero.
This host's `find` is bfs,
which takes ISO 8601 times only and refuses `… UTC` as an invalid timestamp;
with its error discarded,
the refusal read as no file.
The control's zero,
where files had to exist,
exposed it,
and the checks rerun as `-newermt '2026-09-26T20:00:00Z'` found 495 files for the control
and none newer than the consolidation entry of 04:26:57 UTC on 2026-09-27.
Prevention:
step 4 of the pre-launch list in `mistake-prevention.md` names the ISO form,
and a check's error output goes to a file that is read,
never to `/dev/null`.

It recurred on 2026-09-30 (UTC),
checking that B42 rides inside the translate version:
`-newermt '2026-09-27 04:27:00 UTC'` printed zero,
and so did its control from midnight.
The error went to a file this time,
and the control's zero sent the check to it;
the ISO rerun found no file after the cutoff and 450 since 00:00 UTC that day.
The same form found 494 on 2026-09-29,
over the agent runs and the package's own runs directory both;
this paragraph inferred that 44 files of that window had left those roots,
and the control read 494 again on 2026-09-30
(M81),
so the inference does not hold.
A written step and a read error file did not stop the slip,
so the check itself is queued for `cache-account-audit`:
report the newest slice-cache file and a control count,
so an account needs no hand-written `find`.
It reports both since 2026-10-01 (UTC) (M81).

## M81: a cache-file count taken over a root holding a throwaway checkout and a copy payload

Status:
happened 2026-09-30 (UTC) during B43,
caught by listing the matches before any account used the count.
The rides-inside check for B43 ran over the agent runs,
where a throwaway worktree for B44's before-measurement had just been checked out
and the worktree-copy hook,
which ran out of memory,
had left a payload of copied run directories
(`~/temp/agent/.cli-git-worktree-copy-kwEhzq/payload/`).
`find -path '*slice-cache*' -newermt '2026-09-27T04:27:00Z'` printed 332 where every check since 2026-09-28 printed 0:
9 were the checkout's own source files named for the slice cache,
the rest were copies of cached records with fresh times,
and outside both the only match was a scratch output.
The same check had also named the package's runs as `package/module/translation-repair/runs` (split on 2026-10-18 into
the packages under `package/translation-repair`),
which does not exist
(bfs said so in the error file);
they live under the worktree's `node_modules/.monochromatic/translation-repair-runs*`,
where nothing was written after the cutoff or since midnight that day.
The control from midnight read 494 once the confounds were set aside,
the count of 2026-09-29,
so the 450 of the B42 check was not files leaving those roots,
as M57's recurrence paragraph inferred;
what the B42 check counted differently is not recorded.
Prevention:
a count over a root lists its matches before it is used,
names each root by where the runs are written (`runs-layout.ts`),
and leaves out checkouts and copy payloads;
`cache-account-audit` is to report the newest cache file and the control itself,
so an account needs no hand-written `find`.
It does since 2026-10-01 (UTC):
after the version accounts it prints how many slice-cache records it read under how many runs directories,
naming where it looked
(the default runs directory's parent,
the configured runs directory,
and each `--runs-under` directory,
searched four levels down outside hidden directories and dependency trees,
so a copy payload is never read),
then each directory that search could not list with the filesystem's reason
(its first run over the agents' scratch root stopped at an `EACCES`,
so a locked directory is now named as left out of the count instead of ending the audit),
then the newest record by its full path and time,
and how many cache versions were set after it.
The copy that ran out of memory and left its payload is issue #580,
filed against `cli-git`,
which owns the hook.

## M147: a launch whose stdout overwrote every line its stderr wrote

Status:
happened on 2026-10-11 (UTC),
by the lead's launch of TianqiChen66622;
the lines it lost cannot be recovered.
The pass ran as a systemd user unit given `StandardOutput=truncate:` and `StandardError=append:` on one file:
two descriptors,
stdout's writing at its own offset,
so every line stderr appended was overwritten.
The log kept 9,942 `info` lines and 2 `warn` lines
(the last two,
written after stdout's final write),
against TianqiChen66621's 101 `warn` lines written through a shell redirect;
every retry,
lost voice and failure message went with the rest,
among them whatever Bedrock answered the two Gemma seats on all 536 of their calls.
A read-only agent then read the silence as a pipeline defect ("no log line names the thrown message").
A control unit writing three lines to stdout and two to stderr kept only the three that way,
and all five in order with stderr left to inherit stdout's file.

Prevention:
`mistake-prevention.md`,
"Before a run launches",
step 8:
one descriptor for both streams,
read back from systemd right after the launch
(`StandardError=inherit`,
where the faulty form shows `StandardError=append`;
both shown on throwaway units the same day).
The runbook's launch step now gives the unit form.
The lead's named-test units drop their `StandardError=append:` part the same way.

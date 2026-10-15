# Audit ledger: process mistakes, agents and briefs in the reference, edge and prose mask rounds

What went wrong in the rounds from the review of n149 to the review of n156 (n150 to n157):
the rule breaches of each round,
as its author or reviewer disclosed them,
and two mistakes of the lead's own that ran through the whole stretch of work.
The entries before these are filed in
[Audit ledger: process mistakes, agents and briefs in the consistency fix rounds](audit-ledger-process-agents-and-briefs-consistency-fix-rounds.md),
which stopped at M209 because it would otherwise pass the line limit.

The work of these rounds is filed in
[Audit ledger: the consistency pass, what the refusal run steps over](audit-ledger-consistency-pass-what-the-refusal-run-steps-over.md),
[Audit ledger: the consistency pass, span edges as whole units](audit-ledger-consistency-pass-span-edges-as-whole-units.md),
[Audit ledger: the consistency pass, elisions, quoted numbers and pairing](audit-ledger-consistency-pass-elisions-quoted-numbers-and-pairing.md)
and
[Audit ledger: the consistency pass, the prose mask and slices parsed alone](audit-ledger-consistency-pass-the-prose-mask-and-slices-parsed-alone.md).

Written on 2026-10-15 (UTC) from the accounts of the rounds,
each of which lists its own breaches
(the reviews `s217/review.md`,
`s221/review.md`,
`s224/review.md` and `s227/review.md`,
the hand-backs `s219/handback-draft-items.md`,
`s219/handback-n151-rest.md`,
`s222/handback-n154.md`,
`s225/handback-n156.md` and `s218/handback-n152.md`)
and the lead's notes of 2026-10-14 and 2026-10-15.
The breaches of the docs round that wrote these entries are in its own hand-back and are not filed here.
The rounds are named as the neighbouring entries name them,
and a round name is not a task number.
The sizes of reads and outputs are the authors' own figures.

Part of [Audit ledger](audit-ledger.md),
which lists every file of this record.

## M210: breaches of the Read, output, pipe and edit-batch rules by the review of the reference round (n150)

Status:
happened on 2026-10-14 in the review that found B575 to B579,
B590 and B599;
every one disclosed by its author in the review (`s217/review.md`).

- Reads over 50 lines,
  about fifteen,
  of sources and outputs:
  `consistency-splice.ts` (100),
  `consistency-closing-marks.ts` (90 and 92),
  `restore-typography.ts` (152),
  `quote-neighbours.ts` (134),
  `nested-single-quotes.ts` (143),
  `consistency-run-steps.ts` (113),
  `consistency-paragraphs.ts` (124),
  `consistency-prose-text.ts` (70),
  `consistency-quote-references.ts` (52),
  `pass-consistency-decide.ts` (70),
  `pass-consistency-slices.ts` (70),
  `parse-slice-body.ts` (64,
  no limit given),
  and the probe outputs `v-typo.out` (100),
  `v-r2x.out` (60) and `v-typo2.out` (57).
- Terminal output over 50 lines twice:
  a search of the page option over `src/corpus-run` (about 90 lines),
  and a search with context in `v-r2.out` (about 100).
- Pipes and `head`,
  three times:
  one search piped into `head`,
  and one command piped into a search twice.
- Probes written as `.ts` and run with `node`,
  and non-exported helpers and the test fixtures imported from `src/` and not from `dist`,
  as the harness copy of the author of n149 did.
- The replay was started with `systemd-run --setenv` and `--property=StandardOutput=file:`
  and not with the shell redirect that the brief gave
  (same command,
  same log path).
- A Write created `v-r2.ts` with raw U+2028 and U+2029 in a regex,
  because the writer expanded the escapes,
  and a one-line script repaired it.
- Five Edits to `review.md` in one batch,
  and two Reads in one batch more than once (independent files).
- The review read the lead's notes to see what the rulings said;
  they are not on the list of forbidden files.

Prevention:
the same as M189 and M209.
Sources,
hand-backs and logs are read in ranges of at most 50 lines,
a probe that needs a helper that `dist` does not export says so in its hand-back,
and the brief names the exact form of the replay.
`mistake-prevention-shell-edits-commits-and-agents.md`,
"Shell commands" and "Briefs and hand-backs".

## M211: breaches of the Read, output, build and edit-batch rules by the reference round (n151)

Status:
happened on 2026-10-14 in the work of B575 to B579,
B590,
B574 (its outcome) and B599;
every one disclosed by its author in the hand-back (`s219/handback-n151-rest.md`),
and by the lead's notes.

- Terminal output over 50 lines several times,
  and Reads over 50 lines,
  about fifteen.
- Two commands that read `dist` at once.
- Two Edits to one file in one batch,
  about seven times.
- An Edit with a read,
  a lint run or a build of the same file in one batch,
  about five times.
- Polling:
  `rg --count` and `pgrep` over a running suite.
- Standard error written to a separate file.
  The lead checked the separate file for `[FAIL]` and found none.
- The hand-back file held only a pointer to the returned message,
  so the lead copied the message into `s219/handback-n151-rest.md`.

Prevention:
the same as M189 and M206.
A hand-back is a file with the whole account in it,
and a unit's output is captured on both streams.
`mistake-prevention-shell-edits-commits-and-agents.md`,
"Shell commands" and "Briefs and hand-backs".

## M212: breaches of the Read, output, edit-batch and search rules by the docs round of the ledger (n152)

Status:
happened on 2026-10-14 in the work of B549 to B574 and M201 to M209;
every one disclosed by its author in the hand-back (`s218/handback-n152.md`).

- Terminal output over 50 lines once:
  a count over the doc directory and the sources (about 130 lines).
- Seven Reads over 50 lines:
  the renamed fixes file (51),
  the hand-back of n144 (57),
  the lead's notes (54),
  the hand-back of n149 (69),
  the index by id (70),
  the guards prevention file (56) and a list of risky spans (52).
- Two Edits to one file in one batch
  (the heading and the paragraph of B540),
  an Edit and a command that reads the same file in one batch,
  and a command that read a file written in the same batch.
- Searches that recurse under named subfolders of the work tree:
  the doc directory,
  the sources of `w158`,
  and the old name of the renamed file across the package and the repository doc directory
  (the brief asked for the last).
  The lead had counted the doc-directory form as a breach for n145,
  and the author left the ruling to the lead.
- A script of exact replacements rewrote the line breaks of three docs
  where hand Edits were meant.
  The lead accepted it.

Prevention:
the same as M202.
`mistake-prevention-shell-edits-commits-and-agents.md`,
"Shell commands".

## M213: breaches of the Read, output, pipe and edit-batch rules by the review of the edge round (n153)

Status:
happened on 2026-10-14 in the review that found B580 to B584,
B591 to B594 and B600 to B601;
every one disclosed by its author in the review (`s221/review.md`).

- Reads with a limit over 50,
  eleven times:
  `consistency-closing-marks.ts` (125),
  `consistency-edge-marks.ts` (110),
  `restore-typography.ts` (110 and 90),
  `quote-neighbours.ts` (100),
  `consistency-unread-units.ts` (100 and 86),
  `consistency-quote-bounds.ts` (80 and 56),
  `renders-as-nothing.ts` (75),
  `v-r2.ts` (66),
  `nested-single-quotes.ts` (60),
  `pass-consistency-decide.ts` (60) and a diff file (52).
- Terminal output over 50 lines five times:
  a listing of the files of `src` (about 190 lines),
  two searches with context in a test file,
  a search of `v-r2x.out` (about 55 lines)
  and a search of `p-typo.out` (102).
- One pipe:
  a command piped into a search to see why a probe failed.
- Two Edits to one file in one batch:
  `p-containers.mjs` (twice),
  `p-invisible.mjs`,
  `p-docs2.mjs` and `review.md`.
- An Edit and a unit run that read the same file in one batch (`p-invisible.mjs`;
  the Edit failed and the unit ran on the old file).
- `--setenv=TMPDIR=S/tmp` added to the prescribed `systemd-run` line for the probes that run the pass fixtures,
  and `.ts` probes that import test fixtures and non-exported modules from `src/`,
  where the brief names `dist`.
- A search whose alternation was given as a path,
  which returned an error but still printed matching lines,
  and an `rg` flag that does not exist.

Prevention:
the same as M210.
A probe that cannot run from `dist` is named in the brief with the fixture it needs.
`mistake-prevention-shell-edits-commits-and-agents.md`,
"Shell commands" and "Briefs and hand-backs".

## M214: breaches of the Read, output, batch, chain and polling rules by the edge round (n154)

Status:
happened on 2026-10-15 in the work of B580 to B584,
B591 to B594,
B600 and B601;
every one disclosed by its author in the hand-back (`s222/handback-n154.md`).

- Reads with a limit over 50,
  about twenty-five:
  `consistency-edge-marks.ts` (90 and 90),
  `consistency-fold.ts` (110,
  120 and 120),
  `consistency-count.ts` (70),
  `consistency-quote-references.ts` (60),
  `consistency-run-steps.unit.test.ts` (62),
  `consistency-edge-marks.unit.test.ts` (72),
  `consistency-paragraphs.ts` (94),
  `restore-typography.ts` (100,
  112,
  122 and 62),
  `nested-single-quotes.ts` (120 and 69),
  `quote-neighbours.ts` (142 and 97),
  `pass-consistency-shipped-marks.unit.test.ts` (97,
  52,
  56 and 60) and `consistency-quote-bounds.unit.test.ts` (110).
  The figures are from the author's notes and a few may be off by a line or two.
- Terminal output over 50 lines:
  the first baseline runs of three probes printed fixture logs without a redirect;
  several searches of the red logs (about 60 and 27 lines);
  and a search of a green log that printed 37.7 KB,
  after which a Read of its last 14 lines showed one line of 28 KB.
- Two commands that read `dist` at once,
  twice
  (the baseline typography batch and the baseline batch of the run and bounds probes).
- Two Edits to one file in one batch:
  `consistency-whole-end.unit.test.ts` (five) and `consistency-run-steps.ts` (twice,
  in two batches).
- An Edit and a read of the same file in one batch
  (`renders-as-nothing.ts` with a test run,
  and `p-invisible3.mjs`).
- A `;` in one shell call
  (three `diff` commands and a count).
- A search with backticks inside double quotes,
  which failed twice with no effect.
- The hand-back file got several Edits that were not appends,
  and the last two fixes were two Edits to it in one batch.
- Polling:
  lines of a running suite log were counted,
  and the output of a running unit was read once.
- `cp`,
  `mkdir`,
  `diff` and `sha256sum` were used in the shell,
  with no pipe and no loop.

Prevention:
the same as M189 and M210.
`mistake-prevention-shell-edits-commits-and-agents.md`,
"Shell commands" and "How an agent waits".

## M215: breaches of the Read, output, flag and search rules by the review of the edge round (n155)

Status:
happened on 2026-10-15 in the review that found B585 to B589,
B595,
B596,
B602,
B603 and B606;
every one disclosed by its author in the review (`s224/review.md`).

- Reads with a limit over 50:
  `page-slice-rewrite.ts` (80),
  `consistency-whole-end.ts` (68),
  `consistency-run-steps.ts` (57),
  `quote-neighbours.ts` (70) and `p-w-edges3.out` (60).
- Terminal output over 50 lines four times:
  a listing of a probe output (about 130 lines),
  a search with context for an example (about 190),
  a listing of the ancestor `node_modules` (about 100)
  and a long listing of the probes of the review before (about 80).
- Short flags (`ls -la`),
  and a `sed --version` as a placeholder command,
  which is a `sed` call with no effect.
- The replay ran as a background shell command and not as a `systemd-run` unit.
- A search with `--glob` under `node_modules/.pnpm` of the work tree,
  a recursive search outside the scratch folder,
  which matched nothing,
  and a read of the modules of an ancestor `node_modules` by import in a probe.
- The lead's notes add an Edit with a read of one file;
  the review says that its probe files were edited one Edit per call.

Prevention:
the same as M210 and M189.
`mistake-prevention-shell-edits-commits-and-agents.md`,
"Shell commands".

## M216: breaches of the Read, output, batch, build and search rules by the prose mask round (n156)

Status:
happened on 2026-10-15 in the work of B585 to B589,
B596,
B602,
B603,
B606 and B607;
every one disclosed by its author in the hand-back (`s225/handback-n156.md`).

- Reads with a limit over 50:
  `restore-typography.ts` (100) and `consistency-fold.ts` (65).
- Terminal output over 50 lines five times:
  a listing of the files of a scratch folder,
  a deep listing of a data folder outside the work tree,
  a search of the probe copies for their output paths (about 100 lines),
  a probe run directly that printed 43 KB of fixture logs,
  and a search for word helpers over `src` (about 90 lines).
- Two Edits to one file in one batch:
  a probe,
  `typography-prose-mask.ts`,
  its unit test,
  `translate-slice-key.unit.test.ts` and `restore-typography.unit.test.ts`.
- An Edit and a read of that file in one batch:
  `typography-prose-mask.ts` with the lint run (the log was discarded),
  `restore-ellipsis.ts` with the build (rerun),
  and `consistency-shown-edge.ts` and `nested-single-quotes.ts` with a Read,
  three times.
- Two commands that read `dist` at once:
  the two counters,
  run as two units in one batch.
- A `;` in one shell call (a count and an `echo`).
- The task `cache-account-audit` depends on `build`,
  so it rebuilt `dist` from the source of that moment
  (it ran no probe and no test).
- A metadata `find` over the runs directory of the replay,
  for slice-cache files newer than the setting of the cache version and a control since January.
  No file was opened,
  but the brief says never to open files there,
  and the control found nothing,
  so the check proves nothing (B607).
- Backups of the guard demonstration were restored with `cp` into the source,
  inside the write boundary and checked by checksum.

Prevention:
the same as M189,
M210 and M214.
A task that builds is named as a build in the brief,
and a check that cannot show a positive control is not offered as evidence.
`mistake-prevention-shell-edits-commits-and-agents.md`,
"Shell commands" and "Tasks,
builds and bulk output".

## M217: breaches of the output, Read, batch and foreground rules by the review of the prose mask round (n157)

Status:
happened on 2026-10-15 in the review that found B597,
B598,
B604,
B605 and B608 to B615;
every one disclosed by its author in the review (`s227/review.md`).

- Terminal output over 50 lines three times:
  `git status --short` in the worktree (about 290 lines),
  the foreground run of a probe that printed its fixture logs (about 130),
  and a numbered listing of a test fixture with a count limit (70 lines).
- Reads with a limit over 50:
  the lead's notes (53),
  `quote-style-unify.ts` (60,
  twice),
  `consistency-shown-edge.ts` (71) and `translate-guillemets.ts` (85),
  and Reads of small output files with no limit given.
- Two Edits to one file in one batch (`p-opening-marks.ts`).
- A Write and a command that read the same file in one batch (`p-fragments.ts`).
- A run of more than a minute started in the foreground
  (`p-long-paragraph.ts`):
  the harness moved it to the background after 170 s,
  the review stopped it with the task-stop tool,
  and a bounded version ran as a `systemd-run` unit.
- `git show HEAD:<file>` redirected into the scratch folder,
  a git read with no git write.
- Probes that were not over a minute were started as units,
  which the review called harmless over-use of the unit form.

Prevention:
the same as M210 and M214.
A probe that may run over a minute is started as a unit with a bound from the first run.
`mistake-prevention-shell-edits-commits-and-agents.md`,
"Shell commands" and "How an agent waits".

## M218: ten fix rounds went by without a commit, each round's work left uncommitted in one worktree

Status:
happened from 2026-10-14 to 2026-10-15 in the lead's own handling of the rounds
(the lead's count in its notes:
"nothing has landed in ten rounds");
found by the lead while deciding to land,
and recorded by the lead.

Every round's tests and code stayed uncommitted in `w158`,
and the next round started on top of them.
The worktree held more than 230 changed entries by the report of n154 and about 290 by that of n157,
among them `mise.lock` and a handover document that n154 did not touch.
The cost showed in the reviews:
no build from before a change was kept,
so the reviews could not say whether a defect predates a round
(W3 of B602,
the shapes of B605,
the old scanner of B606 rebuilt from `HEAD`,
which is far behind the worktree and could not be proven byte-identical to the file as it was before n156),
baselines that were copies of the output of a build taken before the round and not a commit,
and guard experiments that restored files from backups in the scratch folder,
checked by checksum.
The rule `GCE` of the repository says that a work step is committed before the next one,
and that broken states are committed too.

Prevention:
each round's tests and code are committed before the next round starts,
even when a later round will change them,
and the brief of the next round names the commit it starts from.
`mistake-prevention-shell-edits-commits-and-agents.md`,
"Briefs and hand-backs".

## M219: the review loop was not stopped while four builds gave identical results

Status:
happened from 2026-10-14 to 2026-10-15 in the lead's decisions to launch another review after each fix round;
found by the lead on 2026-10-15,
after advice,
and recorded by the lead.

Four builds (n149,
n151,
n154 and n156) gave identical oracle grids (the runs `s216`,
`s220`,
`s223` and `s226`),
identical run sites (50),
identical replay rows and identical recounts of the elisions,
and the reviews of those builds still found new defects each time,
in code next to the code the round had changed
(seven in the review of n149,
eight in that of n151,
nine in that of n154 and eleven in that of n156).
The checks that measure what ships had said the same four times,
and the reach measured for the findings was zero pages,
or exposure at a few dozen places.
The lead judged that another round of fixes would be followed by another review of the same kind.
The lead stopped on 2026-10-15:
land now,
record the findings of the last review as decided and not yet landed (B597,
B598,
B604,
B605,
B609 to B615),
and build them after the launch as their own commits.

Prevention:
when the checks that measure what ships stay identical across builds
(oracle grids,
corpus counts,
replay)
and each review finds defects in adjacent code,
the corpus reach of what is open is measured,
the work is landed,
and the rest is fixed after the launch.
`mistake-prevention-shell-edits-commits-and-agents.md`,
"Briefs and hand-backs".

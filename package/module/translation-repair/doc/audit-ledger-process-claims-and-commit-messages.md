# Audit ledger: process mistakes, claims and commit messages

Claims written without their evidence,
in commit messages,
the ledger and notes.

Part of [Audit ledger](audit-ledger.md),
which lists every file of this record.

## M9: a ledger claim written from a summary rather than measured

Status:
corrected in P3.
P3 said rounds ran to the 360 s deadline;
the two runs it cited had no round past 181 s.
Prevention:
a timing or count in a finding is read off the log it cites before the finding is written.

## M16: a commit message claiming records not yet written, and a hash typed rather than resolved

Status:
corrected by a commit comment on `5ab33539f`.
Its message said A13,
A14 and K5 were already in the ledger;
they were recorded in the next commit.
The first attempt at that comment named a full hash typed out by hand,
which GitHub refused as no commit.
Prevention:
a commit message states only what `git show --stat` of that commit shows;
every hash is resolved with `git rev-parse` in the same command that uses it.
Once more on 2026-09-27,
in the page-agreement docs:
a hash no command had produced was written into this ledger as a red guard's,
and caught on reading the edit back,
before any commit.
Once more on 2026-09-28:
`c1dd889b5` said the preparation hook now takes `BenchSeating`
before any preparation hook existed (it came in `aa635056a`);
a commit comment on it corrects the message.
The same day `d00123df3` was typed `test` while it also changed production code
(`attestPassReferences`,
the injected reference reader,
`keepBench`);
a commit comment names the right type.
Prevention for the type:
read `git diff --cached --stat` before choosing it;
any file outside tests makes the commit more than `test`.
Once more on 2026-09-28:
`67243edae` wrote the audit's task-list number in its subject,
which on GitHub is an unrelated file-enforcer issue;
commit comment 202472839 corrects it.
Prevention for references:
a commit message names a GitHub issue only after `gh issue view` shows it is the one meant,
and never a task-list number.
Within the hour `3f29feb30` wrote the prevention doc's task-list number in its subject,
which on GitHub is an unrelated kwin-key-helper issue;
commit comment 202478725 corrects it.
A rule written an hour before did not stop it,
so the prevention doc now asks for a read of the message
for `#` followed by digits before every commit.
Once more on 2026-09-28:
`d01d359d1` gave its counts (44 places and five) from a tally kept while editing,
before the commit existed to count;
`git show --unified=0` of it counts 40 and 6,
and commit comment 202514782 corrects both.
Prevention for counts:
a number in a commit message comes from a command run on the staged diff,
in the same call that commits,
or the message says no number.
Hours later,
with that rule written,
`dd519a3b8` said its guard found seven log times with seconds;
the guard's output before the fix held 14,
fixed by 7 edits,
so the message counted edits and called them times.
Commit comment 202516691 corrects it.
The rule holds as written:
the count came from the edit script's "applied 7 edits" line,
not from a command on the staged diff.
A third time on 2026-09-29:
`c3abb83e4` said the first `--fix` run split "187 headings and a list"
where the block comparison it came from held 187 damaged places,
186 of them headings;
commit comment 202522217 corrects it.
The count was a total read as a subtotal,
which a count taken from a command still allows:
the message has to name what the command counted.
A fourth time on 2026-09-29:
`d090a0f0a` said the first five of its red guard cases fail,
where six fail against the build it was committed on;
commit comment 202537574 corrects it.
The five came from no command's output,
so the rule held and was not followed.
The same day,
three more:
`11d029fde`'s message lost an apostrophe to shell quoting
("The guard headers claim"),
and commit comment 202542820 gives the wording meant;
`edac4d209` said a mutant survived without its new case,
which was inferred from reading the tests rather than run,
and commit comment 202543210 says so;
and two hashes were typed into ledger B23 rather than resolved,
caught on reading the edit back,
before any commit.
Prevention:
a message with an apostrophe goes through `git commit --file` from a written file,
never a single-quoted shell argument;
a claim in a message is either a command's output or labelled an inference;
and every hash in a doc comes from `git log` output in the same step that writes it.
Once more on 2026-09-29,
caught before the commit:
the message file for `e22373347` named the commit that added `build:coverage` by a hash typed from memory,
and `git log -S build:coverage` gave `043697797` before the commit was made.
The same day `37e1dd8e8` said its cases covered every branch of the census,
which no census had measured (M66);
a commit comment corrects it.

## M22: a comment's claim carried into the ledger without reading the measurement it described

Status:
corrected,
2026-09-27 (E6).
The audit copied "a malformed archive competes as though it parsed" from a TSDoc paragraph into the ledger as E6,
and no one read `measurePatchedCandidate`,
where integrity is relative to the archive,
so the finding asked for a behaviour change that would have changed nothing on the archive's own row.
Prevention:
a finding drawn from a comment is confirmed against the code the comment describes before it is filed,
and a field's doc says what the code measures,
relative or absolute,
with the function that measures it named.

## M31: replay refusals classified as damage from claim category and tag shape

Status:
caught the same day,
2026-09-28,
before the owner question was answered;
the L4 entry is corrected.
The L4 replay's refusals were sorted into damage and fixes by their claim category and markup shape,
and the `DottedNumber` prop rewrites on number-format claims went down as damage,
in the ledger and in the owner question.
Compared with the corpus source page,
five of the six restore the source's own props.
Prevention:
a gate replay's refusals are classified against the source they are meant to protect
(is the lost atom the source's,
and is what the edit wrote the source's?)
before any is called damage;
a category name says what a critic claimed,
not what the edit did.

## M32: a fix that supplies context a model lacks, built without reading the sheet it goes on

Status:
caught the same day,
2026-09-28,
by a wire guard's surviving mutants;
reverted in `80a18dd53`.
L5's footnote item said no sheet shows footnote definitions,
and seven commits over 21 files threaded
whole-document footnote definitions into every lane's window on that premise.
One rendered sheet refutes it:
every footnote definition of both documents has been on every sheet since `12ed82cee`.
The wire guard's fixture case checked the window,
not the sheet,
so it certified the wrong object,
and `l5-render.mjs`,
the pattern that would have shown it,
already existed in the same session.
Prevention:
a fix that gives a model context it "lacks" starts by rendering the actual sheet for the case
and searching it for that content;
only an absence seen on the rendered sheet licenses the fix.

## M49: a commit message that named a cause before it was looked up

Status:
happened 2026-09-28 (B18);
corrected by a commit comment on `1c3286271` the same hour.
The message said the blank first lines were left when imports were written or removed.
`git blame` of each file's first line,
run after the push,
showed every one came in with its file's first commit,
and no import removal left one.
Prevention:
a commit message states only what its diff and the checks run show;
a cause goes in only after the command that shows it (blame,
log,
a probe) has run,
and otherwise the message says what changed and nothing about why it was there.

## M66: a commit message claiming every branch covered before any coverage run

Status:
happened 2026-09-29 in `37e1dd8e8`,
caught by the first whole-suite coverage census,
closed in `7253426c8`,
and the commit carries a correcting comment.
The message said its seven test files "cover the census modules branch by branch".
The census at `e22373347` named ten stretches in four of those modules
(five in `coverage-tally.ts`,
three in `coverage-lines.ts`,
one each in `coverage-file.ts` and `build-entries.ts`):
five branches no case reached,
four `??` fallbacks on indexes always in range,
and a test of a prefix every entry carries.
The claim came from reading the tests,
the very reading T8 exists to replace.
Prevention:
a claim that tests cover a module's branches is written only from a census of the claimed sources
(`mise run coverage-census -- <test files>`),
each loaded and holding no stretch,
in a census of format 2 or later (M67).

## M72: a commit message file written without the check that its name is unused

Status:
happened 2026-09-29 in B30's last group,
harmless.
The commit protocol writes each message to a file whose name no earlier message used,
checked with `ls` first;
`b30-consolidation-message.txt` was written without that check.
The Write tool refuses to overwrite a file it has not read,
which is what made it safe,
not the protocol.
Prevention:
the `ls` of the scratch folder runs before any message file is written,
whatever tool writes it.

## M74: describe blocks counted as test cases

Status:
happened 2026-09-29 in B30's record (`c48f674bc`),
found the same hour by B31's suite comparison,
corrected here and by a comment on that commit.
B30's entry and its commit message said the whole suite passed 1,384 cases,
reconciled against the census's 1,397 case by case.
The number is the log's PASS lines:
`module-test`'s `describe` logs one info line per block,
naming the block's passing cases,
and each case's own PASS record goes to debug level (`describe.ts`,
`it.ts`).
B31's run showed it:
two cases left a block that kept a third,
and neither the count nor the pairing of lines moved.
Earlier entries had it right ("1,309 PASS lines").
Prevention:
a suite count is written as describe blocks or PASS lines,
never as cases,
and a claim about removed cases is read off the diff of the test files,
not off the log's line count.

## M76: an inference about a census written as its output

Status:
happened 2026-09-30 (UTC) in `5e27208c7`'s message,
found the same hour on review,
and corrected by a comment on that commit.
The message said `census-wNMuym` listed the placement file as carried only by `coverage-census.mjs`.
`census.json` records no carrying bundle for an unloaded source;
the claim was inferred from that bundle standing among the unloaded ones
and from `coverage-census.ts` being the module's only importer at `6e631988b`.
The rule that a claim in a message is a command's output or labelled an inference was already written,
and the message did not apply it.
Prevention:
a census-derived claim names the `census.json` field or the report line it comes from before it is written;
a claim no field or line holds is labelled an inference.

## M77: a red commit's message summing its own run wrongly

Status:
happened 2026-09-30 (UTC) in `7360aae58`'s message,
found within the hour while reading the red run's assertion output,
and corrected by a comment on that commit.
The message said the run found "the listed three forwarding sites,
the parseArgs and JSON offset sites,
and four unlisted ones",
which sums to nine against the eight found;
the run's `actual` array held the comparison reader unnarrowed,
one of the four,
so only two listed forwarding sites were found as listed.
The listed entry also named `LaneComparisonError` for a reader whose callee throws `ArtifactComparisonError`,
a class name written from the plan rather than read from `compareLanes`.
Prevention:
a message describing a run's findings is written from the run's printed arrays,
each group counted against them,
and a class a guard lists for a site is read from the throw sites the site calls.

## M78: a batch record counting its edits as its stretches

Status:
happened 2026-09-30 (UTC) in `32427c9c8`'s message and the ledger paragraph it added,
found on review the same hour,
corrected by a comment on that commit and in the next docs commit.
The fifth batch's record said its 12 stretches were nine reachable and three removed;
`census-oRsK9f`'s rows give ten and two.
The count was taken from the list of edits,
which held a `nonNullishOrThrow` narrowing the census never listed as a stretch,
and counted two stretches on one line of the digest refusal as one case.
M77's rule,
to count against what the run printed,
was an hour old and not applied.
Prevention:
a batch's stretch counts are read from the baseline census's rows,
file by file,
and each stretch is placed in exactly one of reachable or removed;
an edit the census did not list is named apart.

## M82: commit scopes written as `translation-repair`, not the package's name

Status:
happened throughout the audit,
caught 2026-09-30 (UTC) while writing the ninth batch's record.
The repository's commit rule takes the scope from the package name less `@monochromatic-dev/`,
and `package.json` names this package `@monochromatic-dev/module-translation-repair`,
so the scope is `module-translation-repair`.
Of the last 400 subjects on the branch,
245 used `translation-repair` and 131 `module-translation-repair`
(`git log --format=%s --max-count=400`,
counted by type and scope);
the ninth batch's first eleven commits,
`8536b28e1` to `9e7469896`,
all used the short form,
and its last seven the full one.
No doc in the package or the handover prescribes the short form.
Nothing reads the scope,
so no commit is wrong in what it says,
and none is amended.
Prevention:
a commit's scope is read off `package.json`'s `name` before the first commit of a session,
and a message file is checked for it with the `#` and task-number checks.

## M84: a value quoted from memory in a message, and again in its correction

Status:
happened 2026-09-30 (UTC) in `65deb5167`'s message,
found the same day while drafting B66's entry,
and corrected by a comment on that commit,
whose first wording was wrong as well and was edited within minutes.
The message quoted the lane contest's finding as "below the 3 needed";
`LANE_CONTEST_QUORUM` is 2 (`lane-contest-stage.ts` line 49).
The comment first said the 3 belonged to the polish gate's twin of the finding;
`CONSOLIDATION_POLISH_GATE_QUORUM` is 2 as well (`consolidation-polish-gate-stage.ts` line 31),
and it was read only after the comment was posted.
M77's rule,
that a class a message names is read from the code,
covers a constant too,
and neither text applied it.
Prevention:
a constant a message or a comment names is read from its declaration in a command before the text is written,
and a correction is held to the rule it corrects.

## M91: a veto-open call about a writer's output made from the fixtures

Status:
happened 2026-10-01 (UTC) in `65dd1e6a8`,
found 13 minutes later measuring the stored listings,
and reversed in `ee2d57372` and `0ebf573a3`.
`65dd1e6a8` refused an exponent in a listing price,
calling it a veto-open call on the ground that the fixtures copy listings that write plain decimals.
The fixtures are this package's copies,
not the providers' output:
over the 28 stored listings,
LLM Gateway's catalogue writes `0.042e-6` twice,
a real price the rule left unlisted (ledger B73).
Prevention:
a call about what a writer writes is measured over that writer's stored output before it is made,
with a control the measurement must flag,
and the commit cites the measurement,
never the fixtures.

## M94: a commit message draft naming a lint finding at a commit that did not raise it

Status:
happened 2026-10-01 (UTC) during B75,
caught before the commit.
The draft of `1f37aa07d`'s message said max-lines fired at `97aeee2ca`;
the reader passed max-lines' 300 counted lines only once `1f37aa07d` itself laid it out one element per line,
and the message was rewritten to say so.
Prevention:
a message's claim about what a tool reported at a commit names the run that printed it,
as every claim in a message is command output or a labelled inference.

## M102: a commit message saying a case reached an arm before any census showed it

Status:
happened 2026-10-01 (UTC) in T8's twenty-first batch,
caught by the next census,
corrected by a comment on the commit and by `9244d67d3`.
`c17feba5b`'s message said its tail case reached both `sharedPrefixLength` running to the end of the shorter text
and `sharedSuffixLength` using all its room.
`census-Yh15Hq` at that commit still listed the second as cold:
the case's break sits in the shared prefix,
so `assembledOffsetOf` returns before the suffix is measured.
The claim came from reading the case against the code,
not from a run.
Prevention:
a message or record says a case reaches a stretch only after a census
(or a coverage read of that file) shows the stretch ran;
before that it says which stretch the case is written for.

Recurred the same day in the commit recording the batch's full suite:
its message file,
stating the source scans' result of 23 PASS lines and no FAIL line,
was written in the same parallel call that counted them.
The counts matched before the commit ran,
but the claim was written ahead of its evidence.
The prevention covers any count a message states:
the message is written after the call that shows the count returns.

## M106: a commit message reporting a clean Markdown lint the committed ledger failed

Status:
happened 2026-10-01 (UTC) in `cd10f83f6` (B99),
found by the Markdown lint run for B100,
fixed in the commit adding this entry
and corrected by a comment on `cd10f83f6`.
The message reported that Markdown lint found nothing in the ledger,
and the ledger it committed carries one semantic-line-breaks finding in B99's own entry
(two clauses on the line naming the root suite's children).
Which edit followed the lint run that came back clean was not established.
Prevention:
a commit message reports the lint of the bytes it commits:
the Markdown lint runs after a doc's last edit,
as the commit message's own check runs after the message's last write.

## M119: a Markdown lint started in one checkout that read another

Status:
happened 2026-10-05 (UTC) in `441de9d2b`,
found by the agent writing the next docs commit,
fixed in `5f4c38d96`
and corrected by a comment on `441de9d2b`.
That docs commit was written by an agent in a side checkout,
and its message reported that the Markdown lint found nothing in either doc.
The lint command the agent was given runs a script from the audit's scratch,
which holds the main checkout's path as a constant and reads the named files under it,
whatever directory it is started from.
Started in the side checkout,
it linted the branch as it stood before the agent's edits.
On the committed text the lint reports one `semantic-line-breaks` finding in each doc,
on the owner's quoted ruling.
M106 already says a message reports the lint of the bytes it commits;
here the bytes linted were another checkout's,
and the script's output named the files by their path under the root without naming the root.
Prevention:
a check run for a side checkout takes that checkout's root as an argument,
and its verdict is repeated only beside the root it read;
a script that holds a root as a constant is not handed to an agent working elsewhere.
A copy of the lint that takes the root first was written for the next docs commit,
and prints the linter's exit beside each file.
`mistake-prevention.md`,
"Commit messages".

## M125: the count of pass lines read as if it could show a failing case

Status:
recorded 2026-10-06 (UTC) from the lead's directive for this docs batch,
which lists a gate result read from a pass line while a fail line stood.
The lead's notes hold the fact behind it and no account of the reading,
so which result was read so is not established here.
The fact:
a suite with failing cases still prints a `[PASS]` line listing the cases that passed,
so the count of pass lines does not move when a case fails.
The whole unit suite printed 1,823 pass lines on the tree of `cebfcc122` with two red test files in it,
beside 10 fail lines,
and 1,823 on `040656c51`,
beside none (B291).
B277 had already shown that the count is of suites that print and not of cases.
Prevention:
a run is green when its count of `[FAIL]` lines is zero and its exit says so;
the count of `[PASS]` lines is quoted beside that and never in place of it.
A background command that ends in an `echo` of its exit code reports success whatever ran,
so its log is read.
`mistake-prevention.md`,
"Claims without their evidence".

## M129: a notes file for agents written before the fixtures it described were read

Status:
happened 2026-10-06 (UTC),
caught before any agent was launched on it.
The lead wrote a notes file for the next runner agents
saying three keyless fixtures removed the package's own variables from a child's environment.
One search then showed two of them removed the keys alone.
The file was corrected before launch.
Prevention:
a brief states of a file only what a read of that file showed in the same sitting.
`mistake-prevention.md`,
"Claims without their evidence".

## M130: a commit-message check whose match stopped the commit without a word

Status:
happened 2026-10-06 (UTC);
nothing was lost.
The lead's check of a commit message for task-list numbers matched its own sentence about the `source-scans` task,
where the word "task" stood directly before a count of pass lines.
The commit did not run,
and the only sign was the matching line in the output,
which the lead had to notice.
Prevention:
a check that stops a commit says that it stopped it,
and the commit's own result is read before the next step.
`mistake-prevention.md`,
"Commit messages".

## M131: two accounts of a check, one an agent's of a scan and one a commit message's of code unread

Status:
happened 2026-10-06 (UTC),
the first found by the lead's own scan run before `53e25b458`,
the second standing in `da8a963cc`.
The agent of the cluster of B288 reported that the source scans failed only on inventory lines its move changed.
On the lead's tree two scans failed on two lines:
the held `caught-value-text` key named another function than the report did,
since the agent moved the print after writing the paragraph;
and a local whose name was a position word failed the position-reference scan,
which the agent had read as the moved exemption alone.
Both were mended before the commit (B288).
The message of `da8a963cc` says `coverage-control-probe` builds its client before it reads `--only`,
"which a case pins".
That is the agent's account;
the lead had not read that code when the message was written,
and the message does not label it.
Prevention:
an agent lists each scan finding by its text,
never as a kind;
and a commit message labels as the agent's account whatever the lead has not read.
`mistake-prevention.md`,
"Claims without their evidence".

## M151: a lint log with no verdict was read as clean

Status:
happened on 2026-10-11 (UTC);
the commit stood after a rerun.
The docs commit `38780d0830` was recorded as Markdown-lint clean from a log
that held only the logger's sink timeout (T9) and no line from the linter.
The rerun on the same bytes exited 0 with no finding,
so the claim had no evidence when it was made.

Prevention:
a check's log counts only with its exit status and its own verdict line;
a log holding neither is no result.
`mistake-prevention.md`,
"Claims without their evidence".

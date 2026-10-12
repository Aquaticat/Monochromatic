# Audit ledger, part 55

Part 55 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Process mistakes in this audit, continued

### M38: stray marker lines in guard scripts, stripped by a pattern that ate indentation

Status:
happened 2026-09-28,
three times;
fixed in `6ebd37697` and before the other commits.
The scripts that wrote the X12 guards and the X14 seam test carried stray `"""` lines inside TSDoc blocks.
Two scripts removed them with `replaceAll('   """\n', '')`,
which on a nine-space line also took six spaces
of indentation from the line after,
leaving TSDoc closers at fifteen spaces:
one landed in `5acdd36c6`,
five more were caught before their commit by a search for over-indented closers.
No check reads indentation (X9),
and lint passed each time.
Prevention:
remove a stray line whole (`sed '/^\s*"""$/d'`),
never by a substring;
after any scripted edit,
search the touched files for over-indented `*/` lines and for the marker itself.

### M37: a key component added from a flag's name

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

### M36: a search for an entry id printed corpus lines

Status:
happened 2026-09-28 during H9;
nothing was written to a file or a commit.
Looking for which entry an H9 observation came from,
an `rg --only-matching` over the session transcript
took up to 120 characters after a corpus term,
and printed lines of the poem around it,
against the rule that probes print ids,
indices,
counts,
code points and markup only.
Prevention:
find an entry by `--files-with-matches` over the pinned clone,
or by `--count` first;
an `--only-matching` pattern never carries wildcard context around corpus text.

Recurred 2026-09-29 during D28,
again with nothing written to a file or a commit:
looking for provider balances in `TianqiChen66621.log`,
an `--only-matching` search with 60 characters of context either side of "spent"
printed three fragments of model reasoning that quote the page.
A run log carries the models' reasoning,
which quotes the corpus,
so the prevention covers run logs too:
search a run log by its line tags (`TALLY`,
`SEAT`) or its JSON keys,
never with wildcard context around an ordinary word.

Recurred again the same day during D32:
a probe listing placeholder links masked every non-ASCII character as its code point
but printed the ASCII link text around each,
which is page text (film and song titles).
A probe masks the text it prints,
not only its script:
print the markup and a length,
or a hash,
for any text a page wrote.

Superseded in part on 2026-10-05 (UTC),
when the owner ruled:
"I've allowed you to handle PII.
The corpus is public."
The lead's reading,
open to the owner's veto:
a probe need not mask corpus page text,
and a doc may quote it where the quotation helps.
What stands:
credentials and raw provider requests and replies stay private,
so a run log,
which carries provider replies,
is still searched by its line tags or its JSON keys;
the corpus stays out of the repository,
since it is unlicensed;
unit fixtures stay invented;
and a session transcript is still neither searched nor quoted,
since it holds more than the corpus,
so an entry is still found in the pinned clone.

### M35: a teardown that kept what only its consumers read, and an audit that listed the sites it saw

Status:
fixed under D16 and D20,
2026-09-28.
`cbedea357` removed the receipt,
replay and calibration layer by import closure,
which finds modules nothing reaches but not comments,
fields and test names inside modules that stay:
the surviving pairing modules kept describing the removed consumers,
and two fields survived that only those consumers read.
The audit then recorded that remnant as the two comments it had met (D5,
D16),
where the removed layer's vocabulary found the same framing across eight source files.
Prevention:
a removal is followed by a search of `src` for the removed layer's own words
(its module names and the concepts its commits introduced),
and by a census of every export and field whose only readers were removed,
tests included;
an audit finding about a remnant searches that vocabulary before it writes a site list.

### M34: a guard that looked for a word the message carries twice

Status:
caught by the mutation check,
2026-09-28 (P12);
the guard was tightened before the entry closed.
The all-dry refusal's guard asked whether the message said "Bedrock",
and the message says it twice:
once in the out-of-budget list the finding was about,
once in the refill sentence.
A mutant dropping Bedrock from the list passed.
Prevention:
a guard asserts on the clause that makes the claim,
not on the whole text;
before committing a guard of the form `includes(word)`,
`rg` the message for every other place the word appears.

### M33: a search capped with `head` read as complete

Status:
caught by the type check,
2026-09-28 (P4).
Removing `DEFAULT_JUDGE_MODEL_IDS`,
its users were listed with an `rg ... | head` that cut the list,
and `roster-reach.unit.test.ts`,
past the cap,
still imported it;
the build's type check named it,
and an uncapped search then showed no other user.
Prevention:
a search whose result decides what to change runs uncapped,
or with `--count` first;
`head` is for reading samples,
never for a census.
Again during D20,
capped by scope rather than by `head`:
the readers of the removed fields were searched in four named test files,
and the type check named `pair-blocks-evidence-identity.unit.test.ts` and `prepare-block-scope.unit.test.ts`.
A census searches the whole of `src`,
then narrows.
Again on 2026-09-30 (B52),
caught by the package's unused-imports scan:
the driver's import of `NaturalnessCompletenessError` was removed by a `sed`,
and the check of that removal,
`rg ... | head --lines=8`,
cut its output before the import's line,
so the import that the `sed` had missed read as gone.
`mise run source-scans` named it,
and it was removed with Edit before the commit.
A check of an edit's result is a census of that file too:
uncapped,
or `--count` first.

### M32: a fix that supplies context a model lacks, built without reading the sheet it goes on

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

### M31: replay refusals classified as damage from claim category and tag shape

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

### M30: quality calls put to the owner as design questions

Status:
caught by the owner,
2026-09-28;
the directive is recorded in `design-commitments.md`.
After the L4 replay,
the fix-shaped refusals and the L11 probe's role went to the owner as two option sets
with a recommended option that saved effort (keep the gate as built;
keep the probe in shadow).
Each set differed only in what ships,
so the answer was fixed by the goal:
"Do not try to save effort and just do the option that would result in best quality of the end result",
now a standing directive.
An earlier instance of the same shape:
the P9 question recommended deleting the re-ask,
and the owner chose to enable it.
Prevention:
before asking,
name what the options differ in;
if it is only the quality of the end result,
build the best option unasked and record why;
ask only when a quality choice conflicts with an earlier ruling or the options differ in something else.
Effort,
code size and wall clock never rank an option first.

### M15: a finding carried and a fix started against an owner ruling

Status:
corrected;
the ruling is now in `doc/design-commitments.md`.
A16 listed a triple newline as a defect,
and a seam-spacing guard was written for it,
though the owner had said extra newlines need no fixing,
since Markdown renders them alike;
the ruling was in no package doc,
so neither the audit that filed A16 nor the fix read it.
Owner,
2026-09-27:
"There is no need to eliminate extra newlines,
because markdown doesn't care.
I believe I said this before."
Prevention:
an owner ruling goes into `doc/design-commitments.md` (or its decision record) the turn it is given,
and a finding is checked against those commitments before any fix starts.

### M18: a count put to the owner that measured something narrower than the option it backed

Status:
corrected by re-asking,
2026-09-27 (A16c).
A question said a page had never disagreed with its artifact,
"0 of 214 pages across 372 run directories";
the script behind the number had compared which files exist and never judged a page against its artifact.
The owner chose on that premise;
judged,
77 of 214 disagree.
The ledger already said so:
F-2 recorded 77 of 209 pages that no longer reproduce by splice,
so a search of this file before asking would have caught the claim.
Prevention:
every number in a question option names the check that produced it,
and a claim about a state is backed by a run of the instrument that decides that state,
with its positive control,
before the question is asked;
and the ledger is searched for the state (`rg` over `doc/audit-ledger.md` and `doc/status.md`)
before any claim that it has never occurred.

### M17: a file split at the line cap, with comments elsewhere still naming the old file

Status:
corrected in `e52de1f23` (four references,
one more than first counted).
`pass-entry.ts` was split at its line budget and the write order moved to `pass-entry-persist.ts`,
yet `published-page-check.ts`,
`verify-published.ts` and a `publish-fixed.unit.test.ts` case name still
credit `pass-entry.ts` with it.
A reader sent there finds no write at all.
Prevention:
every split runs `rg` for the backticked old filename across `src`,
tests and `doc`,
and each hit that names a moved responsibility is repointed in the same commit.

### M16: a commit message claiming records not yet written, and a hash typed rather than resolved

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

### M14: a reproduction check committed without a positive control

Status:
corrected in `7c444de3e`,
with a commit comment on `2c4207912`.
The A12 fix compared the rebuilt identity with the recorded one,
checked only against a synthetic fixture,
and was committed before any stored artifact was run through it;
every stored artifact then read as moved,
mikaela17 among them though its rows matched slice for slice.
The same shape recurred one step later,
when the rendering audit's rows-plus-measurements check
was committed with the alignment findings in it and every reproduced carve still refused.
Prevention:
a check that classifies real artifacts runs over stored ones before its commit,
with at least one that must pass and one that must fail (QPC),
and every class it can print is read.
A related shape,
`<test A> | rg --count FAIL || <test B> | rg --count FAIL`,
never ran B when A went red (S10);
and `mise run --cd <package> build` once,
against CM5.
The first `;` one also hid which of two files failed,
since both counts printed as one number.
Prevention:
a report that should run after a failing command is `a || b`,
never `a ; b`;
two independent checks are two tool calls.
Once more on 2026-09-28,
in narration:
the X15 slice-cache check was announced with an empty-directory control
the command did not contain;
its second `find`,
printing the newest file's time,
served as one,
and the narration was corrected before the result was used.
Once more on 2026-09-30 (UTC) during B45:
`ls <removed worktree> ; git worktree list | rg --count <name>`,
confirming a removal with two checks joined by `;` where they belonged in two calls.
Once more that day during B45
(its arguments were not kept beyond the file the second search read):
two `rg` searches joined by `;`,
the second over a T8 triage file in the audit's scratch folder.

### M2: a wording change committed without the full suite

Status:
fixed in `0cf2017b3`.
`e8f0b0369` reworded house-policy sentences and bumped a cache version with single-file runs only;
three pins broke (the version 17 key literal,
the corner-bracket sentence,
the place-as-means sentence).
Prevention:
any sheet wording or cache version change runs the full suite right after its commit
(GCE puts the commit first) and before the next change builds on it,
and a version bump repins its key literal in the same commit.

### M3: a guard whose first red was a link failure

Status:
fixed by the prep export `refactor(module-translation-repair): export archiveStandInFor`.
`archive-dispute-standing.unit.test.ts` first failed because `archiveStandInFor` was not exported,
which says nothing about behaviour.
Prevention:
read each `[FAIL]` reason of a red run;
a missing export gets its own prep commit first.

### M4: a guard committed red with a lint warning

Status:
fixed in the following fix commit.
`88fdb1923` carried a `no-mixed-operators` warning
because the lint step sat in an `&&` chain whose `rg` succeeded on warnings.
Recurred on 2026-09-27:
the F-9 guard went in red with seven type errors,
because it passed `sourceText` to a floor that did not yet take it.
Prevention:
commit only after the lint line reads `Found 0 warnings and 0 errors`;
a guard that needs a new parameter gets a prep commit adding the parameter first.

### M5: a new condition guarded on one branch only

Status:
fixed (guard `88fdb1923`).
`bd98bdc70` refused the judged part of the incumbent whenever a target-only run was held out,
which refused an eligible stand-in with a trailing transcript;
the guard had no eligible stand-in with a held-out run,
and review found it.
Prevention:
a guard for a new condition covers every combination of the inputs it branches on,
with a positive control that must move.

### M6: edits attempted on files not read

Status:
recurring,
harmless (the tool refuses).
Twice more on 2026-09-27 (`tally-resolution.unit.test.ts`,
`roster-fixture.ts`),
both files viewed with `sed` rather than the Read tool.
Three times more on 2026-10-01 (UTC) during B75
(`required-providers.unit.test.ts`,
`probe-candidates.unit.test.ts`,
`mistake-prevention.md`),
each viewed with `rg` or `sed`.
Once more on 2026-10-01 (UTC) during B77 (`sheet-barrel.ts`).
Prevention:
read the region with the Read tool before editing it;
a `sed` or `rg` view does not count as a read.

### M7: an adopted reading parked in docs across a compaction

Status:
fixed (owner confirmed "English letters" on 2026-09-27).
The "kept in English letters" reading waited in the planning doc for a veto instead of being asked.
Prevention:
a reading adopted without the owner's answer is asked in the same turn.

### M8: asked the owner a measurable question

Status:
corrected;
measured,
and the bench reseated in L1.
The agent asked which model should fill the third checker seat,
offering gemma-4-31b,
Mercury 2.5,
a stop,
or no change,
when checker quality on the role's own sheet is measurable.
Owner,
2026-09-27:
"Why don't you measure?
Also Mercury 2.5 is really cheap so it's fine."
Measurement:
`~/temp/agent/audit-repair/checker-cases.mjs` builds 85 pairs from twelve runs
(a unanimous-fixed patch,
and the same issue against the unchanged archive,
where not-fixed is certain);
`checker-bench.mjs` and `checker-bench-raw.mjs` score each candidate on the resolution sheet.
The owner approved Mimo v2.6 Flash and Mimo v2.6 Pro on OpenRouter the same day,
then Solar Mini 4 (`upstage/solar-mini4`);
all three are among the candidates.
Solar Mini 4 is out of the checker seat on its first reading:
78 of 85 positives called fixed,
but only 7 of 85 unchanged archive texts called not-fixed,
so it calls almost any text fixed.
Result:
the ranked order in `RUN_CHECKER_ORDER` (L1).
The Mimo candidates were first scored by raw fetch without `zdr`;
through the run client Mimo v2.6 Flash reaches only DeepInfra,
its one zero-retention endpoint,
and scored 81 and 80 at 3.9 s median against 82 and 79 at 0.35 s.
A measurement for a seat is taken on the route the run uses.
Prevention:
a model-for-role choice is measured on that role's task before anything is asked;
only what a measurement cannot settle goes to the owner.

### M9: a ledger claim written from a summary rather than measured

Status:
corrected in P3.
P3 said rounds ran to the 360 s deadline;
the two runs it cited had no round past 181 s.
Prevention:
a timing or count in a finding is read off the log it cites before the finding is written.

### M10: lint run on changed files only

Status:
fixed in `13c3f51af`.
Every batch linted the files it touched,
so two `unicorn(consistent-function-scoping)` warnings from `0aa800ab4` (2026-09-03)
stood in `provider-budget.ts` and `openrouter-client.ts` for 24 days;
a whole-package run (`oxlint-wrapper.mjs src`,
1666 files,
about 30 to 50 s) showed them at once.
Prevention:
before a batch is called done,
lint the whole `src` tree and read its summary line.

### M11: a fix for one test defect written in the shape of another

Status:
fixed in `d76d2424a` and `a9230202d`.
The T6 fix made two tests assert that the second call finishes first,
and ordered the calls by 20 ms against 5 ms sleeps,
which is the T5 shape;
`consolidate-driver` then failed 1 of 8 at 0.2 CPU.
Twice more a comment stated how a check fails before any mutation showed it:
`e40ccf6d2` said a hanging voice ends at the exchange deadline (the fixture arms none,
so the bound could never fail),
and the gate comment said the case fails on the run deadline (the file exits 13 on the unsettled wait).
Both are corrected,
with commit comments on `e40ccf6d2` and `c10d62663`.
Prevention:
an ordering claim in a test is enforced by a gate,
never by a head start;
a comment that says how a check fails is written after the mutation that shows it.

### M12: a floor change committed with its own test file run, not the full suite

Status:
fixed in `b1dc34af2`.
The F-9 fix (the neutral-pronoun floor reads the original) ran only `translate-neutral-pronoun.unit.test.ts`;
`translate-validate.unit.test.ts` pinned the old behaviour and failed until the F-5 work ran it.
The ledger edit that moved M9 also cut M8 in two,
because the region was read short of M8's end;
M8's prevention sat under M11 until this entry's commit.
Prevention:
a floor change runs the full suite before its commit,
as M2 already asks of sheet wording;
a region is read to the next heading before text is inserted after it.

### M13: a pin search that quoted a whole clause

Status:
caught by the full suite before commit (`112b399a5`).
Before rewording `KEPT_SUBJECT_RULE` the search for pins quoted the clause "says that I (or that person)";
`source-subject-policy.unit.test.ts` pins it split across two string lines,
so the search found nothing
and the full suite failed on it.
Prevention:
search for a pin of a sentence by a fragment of four words or fewer,
and by each end of the sentence;
the full suite before commit (M2) stays the backstop.

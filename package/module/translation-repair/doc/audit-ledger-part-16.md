# Audit ledger, part 16

Part 16 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Docs and comments against code, continued

### D22: task-list numbers used as references across the package

Status:
fixed 2026-09-28,
found the same day while recording M48.
The owner's rule forbids task-list numbers in commit messages and docs,
because they resolve to unrelated GitHub issues.
A census (`~/temp/agent/audit-glossary-fix/hash-number-census.mjs`) found 588 of them in 331 package files:
368 in source files,
182 in test files,
21 in Markdown and 17 in `mise.toml` task descriptions,
126 distinct numbers from 36 to 474.
Of those checked against the repository's issues,
every one names unrelated work
(catalog readers,
a nested Wayland fixture,
webapp ports),
and the two real issues cited (576 and 577) are excluded.
The numbers also fail as internal references:
the transcripts show one number given to two or more different tasks in different sessions
(the number cited 58 times names both a picture-reader measurement and the relocation question),
so a reader cannot recover which was meant.
No rendered model-facing sheet carries one (38 sheets,
0 found;
a control line is found).
Fix:
each reference becomes what it named,
from its own context:
a ledger entry,
a doc heading,
a commit,
or the prose that already states the finding,
with the number dropped.

What was done:

-   The 21 in Markdown (`3f75cd9e6`)
    became a landing commit,
    a date,
    or nothing where the sentence already named the thing.
-   Every one in source and tests went in three batches
    (`7bab9b40e`,
    `6cb3826e6`,
    `f1c0b37d2`).
    A script dropped the 71 pure-attribution asides,
    a parenthesized number after a word,
    and printed the 5 in other positions for a hand edit;
    the rest were rewritten one by one from each sentence,
    after reading the task record the number named
    (stored task lists,
    per session)
    to find what it meant.
    Where one work item was cited many times it became one name:
    the relocation finding,
    the window trial,
    one-sided slicing,
    the settled audit,
    the timing work,
    the judge-quality bench,
    the directory-id shape.
-   The 17 in `mise.toml` were task descriptions opening with a number;
    each now opens with its verb.
-   Seven printed lines carried one
    (the settled-audit report and page heading,
    the relocation candidates line,
    the undecided-subject note,
    the slice-cost report,
    and the two run-timing notes),
    found by parsing every string literal rather than by line shape;
    only the package's own tests read them,
    and those moved with them.
-   Citations sitting beside a claim the work had since overtaken were corrected there:
    the equal-count fast path was measured and kept
    (a roster agreed with index order on all 56 equal-count entries);
    the insertion producers landed on 2026-08-23,
    so no comment says they are still to come;
    the translate lane runs from the document driver,
    so the per-slice selection field is not blocked;
    the corpus pass keeps four slices in flight since 2026-09-06;
    undecided subjects are the artifact's `pending-human-decision`;
    `assertPlacementLayout` is what validates bounds and ordering at assembly;
    and the degeneration bar says its revisit is due,
    since aborted streams now keep what they delivered.
-   One citation named a deferred fix with nowhere else to live:
    `displacement-ratio.ts` records a baseline computed per adjacency with the pair excluded
    as the honest fix for its endogenous estimator,
    and now says the fix is recorded there.
    It is measurement tooling,
    and its conclusion survives all three baselines it states,
    so it stays deferred.

Guard:
`src/task-list-numbers.unit.test.ts` (`1f11f17b8`)
reads the package's source,
tests,
docs,
README and `mise.toml`
for the census's shape,
allows only the GitHub issues it lists
(576 and 577 at first,
578 and 579 since they were cited,
each checked with `gh issue view`),
and asserts each is still cited.
Its fixtures come first.
A citation planted at the end of the README failed the package case,
naming that line,
and the README was restored from the commit.

### D23: package docs never read by the repository's Markdown linter

Status:
fixed 2026-09-28,
found while recording M53.
The repository lints Markdown with `@monochromatic-dev/cli-markdown-lint` (`mise run lint:markdown`).
Over the package's 11 Markdown files it reported 3,344 findings:
3,343 `semantic-line-breaks`
(a line break belongs after a prose break point,
so each clause stands on its own line)
and one `MD034`
(a bare URL,
in this ledger's MQM citation).
Every finding was fixable,
and the linter's `--fix` cleared all of them.
Rendered with micromark before and after,
with whitespace runs collapsed,
all 11 files render the same except that citation,
which is now a link;
the comparison first reported exactly that difference,
so it can see one.

### D24: the README's provider section counted a culled model and named a candidate by a label the ledger reuses

Status:
fixed 2026-09-28,
found re-reading the section against the code after the provider changes.
The section said Bedrock serves four models here;
four cards name a Bedrock id (`model-cards.ts`),
but `hf:openai/gpt-oss-120b` carries `owner-culled` and left every role on 2026-09-24,
which the same section says two sentences earlier,
so three are in use.
It also cited "A2's 432-second" serial run with no source,
where this ledger's A2 is a page-assembly finding;
the run is Candidate A2 in `doc/planning/translation-repair-interface-candidates-a-d.md` at the repository root,
now named.
Every other claim in the section holds against the code:
`SYNTHETIC_PER_MODEL_CONCURRENCY` is 5 (`synthetic-client.ts`),
Synthetic serves two roster models (GLM-5.3-Flash is `synthetic-withheld`,
gpt-oss-120b `owner-culled`),
Hyper,
OpenRouter and Bedrock set no per-model ceiling (`Number.POSITIVE_INFINITY` in each client),
and `PROVIDER_ORDER` is Synthetic,
Bedrock,
Hyper,
OpenRouter (`provider-name.ts`).

### D25: clock times with no zone came back after D12

Status:
fixed 2026-09-28,
found the same day during the D12 census.
D12 made every Markdown clock time carry a zone,
by hand and with no guard.
A scan of the living docs
(package source,
docs and README,
the decision records and the current handovers)
for a clock time no zone follows
finds 198,
some of them ranges that state the zone once
("02:35 and 02:45 UTC").
Most are the cache-version histories written for M28 on 2026-09-28,
which give commit times as `git log` prints them
(`66703994a` was written as 22:56 EDT on 2026-09-27,
which is 02:56 UTC on 2026-09-28)
and slice-cache file times as `find` prints them,
both in local time.
Fix:
resolve each time from its source
(the commit,
the file,
the log line)
to UTC with its zone,
and guard every living doc against a zone-less clock time.

What was done:

-   `c94b5cba4` gave 157 clock times in 17 files their zone
    (counted from its diff:
    157 zone-less times left and 157 zoned ones came in,
    file by file).
    Commit times and slice-cache file times were read again from git and the files in UTC
    (`TZ=UTC` with a local-format date),
    and moved from local EDT to UTC;
    times read from run logs,
    meters and owner messages were already UTC
    (checked against the hakureico,
    settle-default and TianqiChen66621 logs and the transcripts)
    and now say so.
-   The guard found 14 more,
    all times with seconds that the first scan's pattern skipped,
    and `dd519a3b8` gave them their zone in 7 edits:
    three ranges and two single times in source comments,
    one in this ledger,
    two in the current handover snapshot,
    and a three-line log excerpt in the multi-provider record,
    now a fenced `text` block under "(log times,
    UTC)".
    Its message counted them wrong;
    commit comment 202516691 corrects it.
-   One time in the multi-provider record has no recoverable zone
    (02:53;
    the zone it was observed in was never established);
    it now says so,
    and the guard accepts that stated phrase and nothing looser.

Guard:
`src/clock-time-zones.unit.test.ts` (`dd519a3b8`)
reads the package's source comments
(parsed,
so string literals and fenced examples are skipped),
docs and README,
the translation-repair decision records,
the handover index and the snapshot it links,
and fails on a clock time with no `UTC`,
`EDT` or `Z` after it,
unless a range states the zone once after its second end.
Its fixtures come first.
A time planted at the end of the README failed the package case with one finding,
and the README was restored from the commit.

### D26: task-list numbers in the repository-level translation-repair docs

Status:
fixed 2026-09-29,
found 2026-09-28 while closing D22,
whose census covered the package directory only.
The same shape stands 120 times in the translation-repair decision records,
157 times in the planning docs
and 929 times in the handovers,
most of those in the archived history segments.
The current handover's open-work line also lists task-list numbers without the sign,
a form the D22 guard does not read.
Fix:
the living docs as D22 did;
the archived segments,
which their index keeps byte for byte,
get a note on the index saying what those numbers name;
and the D22 guard's scope,
or a sibling,
reaches the living repository-level docs.

What was done:

-   The living set is the one `src/living-docs.test-fixture.ts` locates:
    the decision records,
    the canonical handover and the snapshot it links,
    and the two planning docs that handover links as current
    (the readiness signal and the OpenRouter pass log).
    Every number was read against the task record of the session that wrote it:
    the earlier session's stored list,
    and for the current session's early numbers,
    which its list no longer holds,
    the transcript's creation record.
    D22's names were reused where the work is the same,
    and not where one number meant different work
    (108 was the window trial in one session and a selection rerun in the other).
-   `e4a862372` named the work behind 117 citations in 16 decision records,
    `e58bcfb52` behind 4 in the snapshot,
    and `5a5611f4e` behind 25 in the two planning docs
    (each count from its staged diff).
    Three owner quotations kept their numbers:
    the choice of option 1 of 2026-09-19,
    checked against the transcript,
    and the two decision-sheet answers of 2026-08-16
    (the judge-quality bench first,
    and landing the record of who won each slice),
    checked against the sheet's history,
    where the owner wrote them;
    a fourth quotation cites real issue 563,
    and the pass log cites real issue 556.
    A fifth "quotation" was the sheet's own record,
    not the owner's words,
    and became a paraphrase.
-   The snapshot's open-work line listed this session's task numbers,
    and two open items lived nowhere else:
    they became X21 and B21,
    and the line now points at the ledger's open and recurring entries.
-   The sections the living docs carry from the sessions of 2026-09-10 to 2026-09-15
    cite that tracker's own items as "task N" and as bare numbers.
    They keep them as written,
    under a note in each doc saying whose numbering it is
    and that the planning records those sections link describe each item;
    renaming an abandoned plan's items one by one would risk misnaming the evidence
    and still leave the linked records numbered.
    For the same reason the guard does not read the unsigned form.
-   `73a5254cc` put the note for the archived documents on the document map,
    which indexes every archive family,
    with a pointer on the history index.
    Those documents are pinned by their split audits and keep their numbers.

Guard:
`e6051a966` extends `src/task-list-numbers.unit.test.ts` to the living set,
allowing the listed owner quotations verbatim
(one occurrence each,
so the same number cited again beside a quotation is still found)
and issue 556,
and asserting both lists still occur.
The clock guard reads its repository docs through the same fixture
(the planning docs join it with D29).
Three planted controls each failed the new case and were restored from the commit:
a citation in a decision record,
a listed quotation no doc holds,
and a current planning doc nothing links.
A mutant of `citations` that never sees a quotation on its line
failed the quotation fixture case and the repository case.
The full suite passed on the result
(0 FAIL,
1,309 PASS lines;
the harness prints a PASS line for some cases only).

### D27: the repository-level translation-repair docs have never passed the Markdown linter

Status:
fixed 2026-09-29,
found 2026-09-28 when a `--fix` run over the census's edits reflowed about 13,000 lines
(reverted;
the census committed its date edits alone).
The repository's `lint:markdown` walks the whole tree,
and over the translation-repair decision records,
planning docs and handovers it reports 13,871 `semantic-line-breaks` findings
and a handful of heading findings (MD025,
MD026).
Fix:
the living docs as D23 did
(`--fix`,
then a rendered comparison showing nothing but line breaks moved);
the archived segments are kept byte for byte,
so they need an exclusion the linter supports
or a recorded reason they stay as they are.

What was done:

-   `c3abb83e4` ran the linter's `--fix` over the 48 living documents;
    36 changed,
    and each renders the same block for block
    (`~/temp/agent/audit-glossary-fix/render-blocks.mjs`,
    which lexes each file with marked and compares every top-level block with HEAD,
    shown first to report a planted list item),
    except the reader-protection record,
    whose second top-level heading (MD025) became a second-level one with its subsections a level below.
-   The first run damaged the two living documents that hold astral characters:
    186 headings split into heading and paragraph and one list turned loose in the pass log,
    and a break after an ordered-list marker in the snapshot.
    The linter converts Sätteri's offsets twice after an astral character (issue 559);
    a cat-themed reproduction with 18 or more emoji before a heading shows the same split,
    and it is recorded on that issue.
    Both files were reverted and fixed with each astral character mapped to a single-unit private-use character for the run
    (`astral-safe-fix.mjs`),
    then compared block for block.
    The 649 findings the linter still reports on them are the same defect's:
    copies with the astral characters mapped out report none.
-   `4cd2914ec` did the same for the 27 translation-repair documents outside the living set that no split audit pins
    (audits,
    older planning records,
    runbooks and troubleshooting docs),
    and the linter reports nothing on them.
-   The pinned families
    (history segments,
    dated snapshots,
    run-continuity parts,
    interface-candidate files)
    carry one finding,
    at line 382 of the 2026-08-29 snapshot,
    and keep it:
    their split audits pin their bytes,
    and the linter excludes files only through `.gitignore` and a built-in directory list,
    neither of which can hold a committed archive.
    Outside translation-repair the tree-wide lint reports 56,657 findings in 177 files,
    so `lint:markdown` gates nothing today.

### D28: the document map's current status stopped at 2026-09-06

Status:
fixed 2026-09-29,
found the same day while scoping D26.
`doc/handover/translation-repair-document-map.md` opens with a "Current status" section
that still describes the legacy pipeline as read on 2026-09-04 and 2026-09-06
and names the 2026-09-06 snapshot as the place to start,
while the package has since been audited and rebuilt through this ledger.
Fix:
rewrite the section from the current handover and the package README,
each claim checked against the code or a log,
and have it point at the package docs that now carry the current state.

What was done:

-   The map's "Current status" now carries its date,
    the providers,
    the audit in progress and where its record lives,
    and the last pass with why none has launched since.
    Each claim was read from its source:
    the pass log's section on TianqiChen66621's read for the run and its class,
    the owner's words from the pass log's audit section,
    `PROVIDER_ORDER` as the README states it,
    and the absence of a later pass from `~/temp/agent`,
    where no run log or runs directory is newer than `TianqiChen66621.log`,
    and from the pass log,
    ledger and snapshot,
    none of which names a class one hundred eighty-eight.
-   Its reading list starts at the current snapshot's checkpoints and "What to do next",
    adds this ledger,
    the prevention doc and the README's list of package docs,
    and names the pass log's newest heading with the date it was read rather than its place,
    since the pass log runs oldest first to the Mio23 launch of 2026-09-16 and newest first after it.
-   Three more stale claims on the same two pages:
    the map said no new pass is authorized,
    where the index has said since `c4e65a545` (2026-09-04) that corpus runs on the legacy pipeline are authorized;
    the map said the handover links three dated snapshots,
    where the index links four historical ones and the current one;
    and the index described the snapshot as it stood on 2026-09-06
    and put the kill-and-relaunch rule in the package README,
    whose section of that name moved to `doc/configuration.md` with the README's split (`bc0050366`,
    2026-09-16).
-   Every relative link in the two files resolves
    (`~/temp/agent/audit-glossary-fix/local-links.mjs`,
    53 links,
    shown first to report a planted missing file and a missing fragment).

No guard can tell a current status paragraph from a stale one,
so the prevention is a habit,
recorded under M55,
which found the snapshot's own next steps stopped the same way.

### D29: zone-less clock times in the living planning docs

Status:
fixed 2026-09-29,
found the same day while widening the guards to the living repository-level docs for D26.
`src/living-docs.test-fixture.ts` counts the readiness signal and the OpenRouter pass log as living,
since the current handover links both as current,
but the clock guard does not read them yet:
a scan approximating the guard (`~/temp/agent/audit-glossary-fix/zoneless-files.mjs`,
which agrees with the guard on a decision record the guard passes)
finds 404 zone-less times in the pass log and 4 in the readiness signal.
Fix:
as D25 did,
resolve each from its source
(a run log prints UTC;
`git log` and `find` print local time),
write its zone,
and add both docs to the clock guard's read.

What was done:

-   The scan found 408 zone-less times at the fix
    (`~/temp/agent/audit-glossary-fix/d29-zoneless.txt`),
    all in sections whose headings date them.
    Each was read against the run logs,
    whose stamps are UTC
    (`d29-verify2.mjs`):
    a time was looked up in the logs its own section names,
    the logs of the entry its heading names dated that day or the next,
    and the run log its heading names,
    both as written and four hours later,
    which is where an EDT wall time would read in UTC.
    318 matched only as written.
    A first pass against every log at once was set aside:
    across 1,013 logs about one second in eight carries some stamp,
    so a lone match four hours off proves nothing.
-   The other 90 were read one by one
    (with the doc's prose masked so no page text was printed):
    the hakureico passes of 2026-09-08,
    whose headings name no entry,
    matched in that day's hakureico logs as written and not four hours later;
    `hulicaijia8`'s bounds matched as written on the day before its section's date;
    the launch times of `XingZ625` and `XingZ624` agree with their tallies' durations only as UTC
    (a 02:21 UTC launch plus 6h54m ends before the 09:40 UTC read,
    where four hours later would end after it),
    and `XingZ607`'s phases only as UTC with its seven-hour deadline at 21:39 UTC;
    and the rest name a run by the UTC time of its heading (the page of 21:03 UTC),
    add a duration to a UTC time,
    or sit inside a section whose other times the logs confirm.
    None was local but one:
    a systemd-oomd kill the pass log quoted from the journal as local time,
    now 01:19:47 UTC with the journal's 21:19:47 EDT beside it,
    which agrees with the pass's death at 01:19 UTC two lines earlier.
-   `c7d0f34b0` wrote the zones:
    a script appended " UTC" after each time and its seconds,
    leaving the first end of a direct range to its second end,
    and a line-by-line check found the diff otherwise unchanged
    (`d29-diffcheck.mjs`);
    the one cross-date range heading carries UTC on both ends,
    since the guard pairs a range only when one time follows the other.

Guard:
`src/clock-time-zones.unit.test.ts` reads both planning docs through the living-docs fixture
and asserts the pass log is among what it reads.
A zone-less time planted in each failed it with the site named,
and it passed again once both files were restored from the commit.

### D30: the runbooks and troubleshooting docs sat outside the living set

Status:
fixed 2026-09-29,
found the same day while linting the translation-repair documents outside the living set for D27.
The runbooks and troubleshooting docs are the references a pass is run and debugged by,
yet D25 and D26 read neither:
they carried 37 task-list citations and 6 zone-less clock times,
and the corpus-pass runbook quoted a tool message the tool no longer prints.
What was done:

-   Each citation was named from the earlier session's task record,
    or replaced by the commit that landed it (`b6ea1cc51`,
    `fd4f7546f`);
    issue 541,
    which the root-order troubleshooting doc links,
    is real and stays.
    A recorded monitor alarm that quoted a task number became a paraphrase,
    since the monitor was the session's own script.
-   Times the same record states in UTC now say so,
    and the typography fix's landing was checked against `846f9ff6d`
    (04:34 UTC).
    Two times in the run-invalidation doc were a predicted overnight launch whose zone was never set;
    `pass13` in fact stopped at 17:14 UTC by the watcher's log,
    so the sentences now say what happened in words,
    without a clock time.
-   The runbook's quoted `NO ROUND LINE` message now matches `run-timing-report.ts`.
-   A scan for stray backticks and asterisks in the rendered text,
    over every translation-repair doc outside the pinned archives
    (`~/temp/agent/audit-glossary-fix/stray-contexts.mjs`),
    found literal backticks where code was meant:
    in the invisible-characters doc,
    two bare triple backticks and a `git grep` pattern whose span closed at its first escaped backtick;
    in the package audit,
    two spans that closed the same way,
    and a third stray that was their knock-on.
    A backslash does not escape a backtick inside a CommonMark code span;
    each now uses a longer backtick run as its delimiter,
    and the linter's `--fix` then broke the prose those spans had hidden.

Guard:
`src/living-docs.test-fixture.ts` adds the runbooks and troubleshooting docs as a kind,
the task-list-number guard reads them with issue 541 allowed,
and the clock guard reads them.
A citation planted in the corpus-pass runbook failed the first,
a zone-less time planted in a troubleshooting doc failed the second,
and both files were restored from the commit.

### D31: task-list numbers written as words, which no guard reads

Status:
fixed 2026-09-29,
found the same day while scoping D28.
The D22 and D26 guard reads the sign followed by digits,
and D26 left the word form ("task N") unread on purpose,
for the sections the living docs carry from the sessions of 2026-09-10 to 2026-09-15,
which keep that tracker's numbers under a note.
Outside those sections the word form stands three times,
each a tracker number written after the word:
the package README's redesign constraints cite the redesign by its number (forty-one;
`cbdcb84f8`,
2026-08-30),
which another session's tracker gave to different work on 2026-09-11;
the round-three grading runbook names the decision on its silent refiner lane by its number (sixty-four)
and calls it still open,
though a later history segment records the same number closed on 2026-08-12
by a parser fix for the same model's schema mismatch
(whether both name one tracker's item is to be read from the session record);
and the native-runtime bundling troubleshooting doc names its launch probe by its number (forty-seven).
The README's same paragraph also says the shipped pipeline stays non-conforming "until replacement lands",
where the direction decision of 2026-09-01 keeps the replacement closed.
Fix:
name each from its session's record,
correct the runbook's open decision and the README's replacement,
and have the guard read the word form outside the noted sections.

What was done:

-   The README's paragraph now names the finite redesign,
    says it stopped on 2026-09-01 and stays closed under that day's direction decision,
    and says the shipped pipeline was not rebuilt to the constraints:
    the two bounded errors they name exist nowhere in `src`.
-   The runbook's decision is the one the earlier session's stored task record
    and both history segments describe:
    whether the refiner's schema-mismatch was a provider window,
    closed on 2026-08-12 by a parser fix for a channel marker ahead of Kimi-K3's JSON;
    the runbook now says so and links the history section that records it.
-   The troubleshooting doc's sentence says what the probe checks,
    and the snapshot's note on the takeover sections no longer quotes one of their numbers as its example.

Guard:
`src/task-list-numbers.unit.test.ts` reads a number written after "task" or "tasks",
in any case,
across the package and the living repository-level docs,
and skips three listed stretches,
each from the heading that opens a takeover-era section under its note to the heading after it;
the living-docs case asserts every listed heading still stands.
Restoring the four docs from before the fix made it report the four sites and nothing else.

### D32: link markup quoted as prose rendered as links that lead nowhere

Status:
fixed 2026-09-29,
found the same day while checking the links D28 added.
A page's link markup written into prose without a code span,
such as a title linked to a placeholder `url` or an ellipsis,
renders as a live link to a file that does not exist.
Fifteen stood:
thirteen in the OpenRouter pass log,
one in the current snapshot and one in the Toka_ls reading of 2026-09-02,
found by rendering every translation-repair doc with marked and checking every relative link target
(`~/temp/agent/audit-glossary-fix/rendered-links.mjs`,
shown first to report a planted missing file and a missing fragment).
No linter rule reads a link's target,
and the link audit of 2026-09-01 was never rerun.
The pinned archives render no dead link.
`3e16a16ae` put each in a code span,
or,
inside a quotation that spans lines,
escaped its opening bracket.

Guard:
`src/living-doc-links.unit.test.ts` parses the living repository-level docs,
the package's docs and its README with the package's own Markdown parser,
so a code span or an escaped bracket renders no link and is never read,
and fails on a relative link,
image or link definition whose file does not exist,
or whose fragment names no heading of the Markdown doc it points at
(by GitHub's heading id,
a repeated heading suffixed).
Restoring the three docs from before `3e16a16ae` made it report the fourteen sites it reads
(the Toka_ls reading is not a living doc),
and five mutants of its own checks
(fragments into other docs,
fragments into its own doc,
the repeated-heading suffix,
images,
and absolute URLs)
were each caught.
The full suite passed with it
(0 FAIL,
1,310 PASS lines,
the new case among them).

### D33: references by position in comments and test names

Status:
fixed,
2026-09-29,
guard `position-references.unit.test.ts`
(red `38f1472aa`,
widened red `8ecf892ba`,
widened `9426d91be`,
its last mutant closed in `228eafd01`,
code spans read as CommonMark reads them in `0bc2e00f8`).
The repository rule is to name the thing a text points at,
never its position:
a reference by position names nothing once a paragraph,
a case or a line is added between the two.
The first search found six such references in the package,
and B24's account paragraphs added two more (M60).
The census found hundreds.

The census read what the task-number guard reads:
the package's source,
tests,
docs,
README and task file,
and the 59 living repository-level docs.
Positional words matched 296 phrases in the package and 79 in the living docs,
of which the first guard's shapes named 232 and 39 outside its exemptions
(a reference verb or a listed structure noun before "above" or "below",
a parenthesised position,
a sequence noun before "before this" or "after it",
"earlier in this file" and its kin,
"the former" and "the latter").
Each was read in place and rewritten to name its target
(`dc111e3eb`,
`d447225d3`,
`c57ded55c`,
`6254d0e9d`,
`01fccf6eb`,
`2787dbf2a`):
a case by its leading phrase,
code by its identifier,
a doc section by its heading,
and a file's own cases as "the cases in this file".

The noun list missed most of the family.
A scan for "above" or "below" ending a phrase,
filtered to the guard's own files,
led to 67 more edits (`217251b42`),
and a prototype of a wider shape to 128 more (`fc53cda23`):
"the estimate below",
"the walk below",
"the rethrows below",
"the standing directive below",
"the golden hash below".
So the guard now reads any word before a position as pointing,
unless that word marks a comparison,
a bound or a placement (`POSITION_MARKERS`:
"at or above",
"unbounded below",
"far above",
"sits above",
"stands above"),
or what follows compares ("below which",
"below quorum"),
names ("above `limit`",
"below {@link ...}",
a quoted heading)
or forms a compound ("a below-threshold vote",
while "the above-mentioned" still points).
A naming character counts only after a space,
so the backtick closing a printed template (`` the credits above` ``) names nothing,
and in Markdown a position inside a code span is left,
read against the line as written
and closed as CommonMark closes a span,
on the next backtick run of the opening run's length.
The first version counted backticks for parity,
and this entry's own quote of a closing backtick,
written as a double-backtick span,
read as outside until `0bc2e00f8`.
A physical position ending a phrase ("slept below" at a sentence's end) reads as a pointer by design;
outside exempt page text,
the texts the guard reads hold none.
Exemptions carry their reasons in two fixtures:
sheet text in `position-references-sheet-exemptions.test-fixture.ts`
(model-facing and grader-facing sheets,
and the task text tests hand a sheet builder),
and in `position-references-exemptions.test-fixture.ts` page text,
Unicode character names,
comparisons and orders in time the shapes cannot tell apart,
quoted log lines,
and the guard's own lists and examples.
Ten repository-level docs outside the guard's set are D27 archives and were left as written.

Mutation check (`d33-shape-mutants.json`,
ten mutants):
nine caught on the first run.
The survivor read a code span's offset from the joined line;
a case whose span opens with the phrase catches it (2 assertions) in `228eafd01`.
The span rule's own check (`d33-span-mutants.json`,
five mutants) caught all five:
parity reading by 3 assertions,
closing on any run by 2,
an unmatched run opening a span by 2,
and the two earlier code-span mutants by 4 and 2.
Full suite on `228eafd01`:
1356 `[PASS]` lines,
0 `[FAIL]`,
exit 0.
Full suite again on `0bc2e00f8`,
with this entry's doc edits in the tree:
1356 `[PASS]` lines,
0 `[FAIL]`,
exit 0.

Found while rewriting,
each fixed in the commit that met it:

- Pointers that pointed the wrong way:
  the round-three grading runbook's "the command below" (the `score-agreement` command stands before it),
  `document-readings.ts`'s "the driver above" (`readDocumentPictures` stands after it),
  `draw-sample.ts`'s "the reconcile below" (the check lives in `draw-entry-load.ts`),
  a consolidation-driver test's "the resumption case below" (that case precedes it),
  and the runaway-call decision's "this section" standing at the end of another section.
- `translation-repair-unread-signals.md` credited "genuinely absent rather than discarded" to `256520df7`'s message,
  which is about the stage-call sub-kind;
  the words are `eab15a03c`'s.
- M1's "the same form recorded above once already" meant a form that entry records twice.
- The corpus-pass runbook's sample of the spend report's floor line kept "in no figure above"
  after `d447225d3` changed the code,
  and `d447225d3`'s message overstated which printed lines it changed
  (a commit comment corrects it).
- `translate-assemble-refusals.unit.test.ts`'s "every case before this" stood in the file's first case
  and meant the cases written before it.

## Found while fixing

### X1: the translate lane stopped the entry on a rejected slate over an archive the floor refuses

Status:
fixed with the fifteenth addendum's translate-lane extension (sixteenth addendum).
`translate-stage.ts` treats an archive failing the floor as an absent incumbent;
two rejected production rounds rethrew `TranslateAbsenceError`,
and `translate-slice-attempt.ts` rethrows it for a content slice,
so the entry stopped.
Guard:
`slate-decline-ships-by-preference.unit.test.ts` (the translate stage case).

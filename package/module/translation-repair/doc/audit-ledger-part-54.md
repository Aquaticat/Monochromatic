# Audit ledger, part 54

Part 54 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Process mistakes in this audit, continued

### M62: a copy-check case whose candidate passed validation without the check

Status:
happened 2026-09-29 in `e4cfae398`,
caught by B26's mutation batch,
corrected in `f0ddd425d`,
and the commit carries a correcting comment.
The case offered a merged candidate against a page that had lost the same heading,
where validation finds the candidate valid,
so the model was never asked with or without the copy check;
the commit message said validation "would otherwise ask the model about the heading it lacks".
The older "REPRODUCED THE INCUMBENT" case had the same shape since it was written.
This is M53's and M58's class again:
a case that fails on nothing its branch decides.
Prevention:
a case guarding a short circuit is read against what happens without it,
by a mutant that removes the short circuit,
before its commit says what it guards;
the fixture's page is named in the test file with why it makes the candidate fail (`HEADED_PAGE`).

### M61: a comparison key that assumed its parts never throw and move nothing twice

Status:
happened 2026-09-29 while writing B26's fix,
caught before its commit.
The first `wordingKey` read every text through `foldSoftBreaks`,
which parses the document and throws `FrontMatterParseError` on a fenced block whose YAML does not parse,
as its own TSDoc says;
the repair turn's copy check reads a model's reply before any floor,
so a comparison that never threw could have stopped a slice.
The key's own front-matter case threw on its first run.
The same draft dropped the lane wraps' byte check after the wrap
on the strength of the wrap moving nothing on a second application,
which had been measured over twelve passages and never over the stored runs.
Prevention:
before a comparison reads text through a function,
that function's thrown errors are read and each gets a defined answer
(`pageLayout` lays such a text out as written);
a property a change relies on is measured over the stored records first
(the wrap moved 1,876 of 7,462 distinct stored texts and none on a second pass),
or the change is written so it does not rely on it
(the lane wraps compare the wrapped text).

### M60: account paragraphs that pointed at the paragraph before them, and a status B24 left stale

Status:
happened 2026-09-29 in B24's fix commits,
corrected in B26's.
Two cache-account paragraphs,
one each in `translate-document-contract.ts` and `consolidate-key.ts`,
ended "Same cache check as the paragraph before",
a reference by position that B26's own paragraph,
added after them,
would have repointed.
B24 also left B21's status naming only families one and two as read.
Prevention:
`mistake-prevention.md`,
"References in code and docs";
closing a B21 family updates B21's status in the same commit.

### M59: error classes added and marked with only their own tests run

Status:
happened 2026-09-29,
caught by the full suite after B24 and B25,
fixed in `2ea511960`.
`735566798` marked `CacheAccountLogError` and `CacheAccountReadError` safe to print,
and `5bf2388ff` added `ReferenceLineHeadError`,
which writes its own sentence;
each commit ran its own test files and no full suite ran between them.
`message-names-only.unit.test.ts` reads every class in `src`,
so it failed on all three:
two marked classes the inventory did not list,
a `line` part it did not name,
and a class writing its own sentence with neither the marker nor a withheld reason.
This is M12's class again:
a change whose guard is a package-wide scan,
tested only where it was written.
Prevention:
every source commit's test run includes the package-wide source scans
(`message-names-only`,
`dead-functions`,
`duplicate-bodies`,
`tsdoc-example-scan`,
`fixed-length-cuts`,
`clock-time-zones`,
`task-list-numbers`,
`living-doc-links`
and `log-root-scan`),
and a ledger entry is closed only after a full suite has passed on its last commit.

Recurred 2026-09-29 in the coverage census (`f81b58992` to `5fb0af40e`),
with the prevention written and not followed:
four census error classes marked safe to print,
and a copy of the Han residue floor's private line-start helper,
each commit running only its own test files.
The census's first whole-suite run refused on five FAIL markers from `message-names-only` and `duplicate-bodies`;
`e22373347` fixed both.
The scans now run as one task,
`mise run source-scans`,
which builds and runs all fifteen that read the whole of `src` or the docs
(the nine named,
with `position-references`,
`caught-errors-kept`,
`exported-function-names`,
`floor-inputs-stated`,
`text-accumulators` and `rendered-sheets-census`);
its first run passed all fifteen.

Recurred 2026-10-01 (UTC) during B75,
with the task written and not run:
`97aeee2ca` wrote "answers it as below zero" in `command-line.ts`'s region comment,
which `position-references.unit.test.ts` reads as a reference by position,
and none of B75's source commits ran `source-scans`;
the scan failed first on the docs commit's guard run,
naming that line and the same phrase in the B75 entry.
Both now say "under zero",
B73's wording for a count typed with a minus sign.
The task's first run then failed `message-names-only.unit.test.ts` as well:
it listed five sites forwarding a caught error's text into a marked class,
and `97aeee2ca` had removed one,
the coverage census's own `parseArgs` catch.
`5a3e38037` fixes both;
`source-scans` then exits 0 with all 20 suites passing.
The prevention stands:
`mise run //package/module/translation-repair:source-scans` runs before each source commit,
beside its named tests.

Recurred 2026-10-01 (UTC) at the close of T8's twentieth batch,
through a gap in the rule itself:
the rule named source commits,
and the batch's docs commit `fb16c5128` ran only the Markdown linter.
Its B84 entry said a commit comment "gives the count above",
which `position-references.unit.test.ts` reads as a reference by position;
the full suite on `7b61bb928` failed that one package-wide case.
The clock-time,
task-list-number,
living-doc-link and position-reference scans read the docs as well as `src`,
so a docs commit can fail them as readily as a source commit.
Prevention:
`source-scans` runs before every commit that touches the package's source,
docs,
README or task file,
and the task's description and `mistake-prevention.md` now say so.

### M58: a red case whose fixture could not reach the check it was said to pin

Status:
happened 2026-09-29 in B24's introduced-defect screen red guards (`c8d3f480e`),
caught when the fix left the case red,
corrected in `74a55e92b`,
and the red commit carries a correcting comment.
The restatement case gave its region no issue ids,
and the screen collects prior quotes only from the issues a region names,
so the case could never reach the accepted issue's quote:
it was red before the fix and stayed red after it.
The red commit's message nonetheless said the case "pins the second fold once the first holds",
a claim no mutant had tested.
This is M29's and M56's class again,
now in a commit message as well as a test.
Prevention:
a message says a case pins a branch only after the mutant that removes the branch has been caught;
before that it says what the case fails on today,
and a case that must pass a precondition to reach its branch
is read against that precondition in the code before it is committed.
Again in T8's fifteenth batch (`2d3b02c45`),
caught while writing the fix rather than after it:
B69's red case for a record that is not a JSON object used an array,
which `isJsonRecord` lets through to be probed for fields,
so after the fix it would have reached the format-version check
and been refused with that check's reason rather than pinning its own.
The fix commit (`a56cde819`) made the record a JSON string and says why in the case,
and the red commit carries a correcting comment.
The prevention's last clause covers it:
the red case's input was not read against the guard it passes first.

### M57: a cache-file check whose time this host's `find` refused, with its error discarded

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

### M56: a red guard whose comment case never reached the comment path

Status:
happened 2026-09-29 in X22's red guard (`deb3406b2`),
caught by the mutation check the same hour and corrected.
The case meant to show the floor still reads a paragraph carrying an HTML comment
set the comment between the two dollar signs,
where the formula swallows it as math text,
so the formula formed whether or not comments were cut,
and the mutant that kept comments survived.
The path the cut protects is a comment outside the formula,
which the strict grammar refuses unless the comment goes first;
the case now puts it there,
and the mutant is caught.
Prevention:
the M29 rule already asks that each red case fail for the reason its label names;
a case covering a pre-processing step is paired with the mutant that removes that step
before the guard is called complete.

### M55: the handover's next steps still called a read page unread

Status:
happened 2026-09-28,
found 2026-09-29 while fixing D28,
and fixed the same day.
TianqiChen66621's page was read against the source on 2026-09-28,
its class was fixed,
and the pass log recorded both,
but the current snapshot's "What to do next" still said the page was not yet read
and still listed reading it as a next step;
its "Where the work stands" had no checkpoint after 2026-09-24,
and its repository state named a tip from 2026-09-16.
A session starting from the handover would have read the page again,
or taken the checkpoint of 2026-09-24 for where the work stands.
The document map's current status (D28) had stopped the same way three weeks earlier.
Prevention:
a page read,
an owner ruling built or a change of plan updates the snapshot's "What to do next" in the same sitting,
before the next piece of work,
and its newest checkpoint when the next steps change;
the map's "Current status" moves with them when what it states has changed.
The prevention doc's "Current-state docs" holds the rule,
and its launch checklist asks for it.

### M54: doc commits that never ran the Markdown linter

Status:
happened across the audit;
found 2026-09-28 (D23) and fixed the same hour.
Every commit to this ledger,
the prevention doc and the package's other docs was checked by reading,
by a search for task-list numbers,
and sometimes by a render,
but never by the repository's Markdown linter,
which the repository's lint task runs over every Markdown file.
Prevention:
a Markdown change runs `mise run lint:markdown <files>` before it is staged,
and a `--fix` is rendered against the committed version before it is committed.

### M53: a test committed for a defect it never reached

Status:
happened 2026-09-28 (B18);
`94dca38d8`'s test,
fixed by `d107043be` the same hour.
The test for gloss placement beside a combining accent put the accented handle in a signature,
where the pass never establishes a signer's rendering,
so it placed nothing under either build;
the commit named a defect its own test could not show,
and a mutant restoring the old edge test survived it.
The fixture checks run for the address,
refusal and line switches against the pre-letter build
(`.cache/dist-before-letters/`) were skipped for this one.
Prevention:
a test added for a defect is run against the build before the fix,
and must fail there,
before the fix is committed;
a test that passes on both builds is rewritten until it reaches the path.

### M52: a positive control applied by line number after an edit moved the line

Status:
happened 2026-09-28 (B18);
caught because the control read 0,
and rerun.
The suicide floor's control rewrote its stem with `sed` addressed by line 53,
read from the file before the switch's import grew by three lines;
the `sed` matched nothing,
the harness reported no difference,
and a null control is no control.
Rerun by pattern with the replacement counted first,
the control made 21 of 131 pairs differ.
Prevention:
a control edit is addressed by the text it changes,
never by a line number,
and the command counts the changed text (`rg --count-matches`) before the measurement runs.

### M51: a command batched with the write it read

Status:
happened 2026-09-28 (B18);
no harm,
caught the same minute.
A new mutation spec was written in the same batch as the command that ran it;
the spec's name already existed from B4,
the write was refused because the old file had not been read,
and the runner ran the old spec,
which mutated and restored page-assembly files and reported on them.
Against the rule that a call depending on another's output waits for it (repository rule EDR).
Prevention:
a command reading a file written in the same response runs in a later call,
and each new scratch spec takes a name not used before (`ls` the name first).
Again on 2026-09-29 (D30):
a ledger edit and the commit of that ledger went out in one batch;
the edit was refused (the file had changed since it was read),
and the commit found nothing staged and failed,
so no wrong commit landed.
Minutes later,
recording this,
the lint of that ledger ran in the same batch as the edit it read,
and happened to run after it.
The edit and any command that reads its result,
commit or lint,
go in separate responses.
Again on 2026-09-29 (D33),
and this time a wrong commit landed:
the red commit's message file took a name an earlier commit had used,
its write was refused because the old file had not been read,
and the commit in the same batch took the old message,
so `8ecf892ba` carries the first guard commit's message.
A commit comment gives the intended one.
The name check the prevention asks for (`ls` the name first) was skipped;
a message file for a commit now takes a name no earlier file has.
Again on 2026-09-30 (T8's seventh batch),
four times,
with no wrong outcome landing:
the lint for `9fbc8c19d` ran in the batch of the build it read
(rerun after the build,
as that commit's message says);
a build ran in the batch of the edit it read
(rebuilt after);
a named-test run ran in the batch of the write of its list file
(its log shows every listed file ran);
and a commit comment was posted in the batch of the write of its body
(the posted body,
fetched back,
matches the file but for the trailing newline the fetch adds).
The lint and the build were rerun after their writes;
the test run and the comment were checked after the fact,
and passed only because their writes happened to land first.
Again on 2026-09-30 (T8's thirteenth batch),
twice,
with no wrong outcome landing:
a lint ran in the batch of the edit it read
(it found none of the three warnings the unedited file raised,
so it read the edit),
and a commit comment was posted in the batch of the write of its body
(fetched back,
the posted body matches the file).
Again in the fourteenth batch,
once:
a commit message's check for `#` and task numbers ran in the batch of the message's write;
its output carried no missing-file error,
so it read the written file.
Rerunning that check afterwards also covered the two B67 messages,
which had not been checked before their commits;
none of the three held a match.
Again during B70's docs on 2026-09-30,
once:
an edit to a scratch note and the `sed` inserting that note into this ledger went out in one batch;
a search afterwards found the edited wording in the ledger,
so the edit happened to land first.
Again during B73 on 2026-10-01 (UTC),
twice,
with no wrong outcome landing:
a commit message's check for `#` and task numbers ran in the batch of the edit to that message
(rerun after the edit,
no match),
and the stamp probe ran in the batch of its own write
(rerun alone after;
its output is the one `a381f9da1` cites).
Again during B75 on 2026-10-01 (UTC),
twice,
with no wrong outcome landing:
the check of `1241086aa`'s message for `#` and task numbers ran in the batch of the message's write
(rerun alone after,
no match),
and a search confirming the "under zero" rewording ran in the batch of the `sed` that made it
(its output showed the new wording,
so the edit landed first).
Again during B78 on 2026-10-01 (UTC),
four times,
with no wrong outcome landing:
three times while writing the fix,
an edit and a command reading it in one batch,
with the lint,
the named test run and the source scans that `8204394fc` cites all run in later calls,
after the last edits to the files it changed (their logs are newer than those files);
and once when the check of `e2b0962fd`'s message for `#` and task numbers ran in the batch of the message's write
(it printed no missing-file error,
so it read the file;
rerun alone,
no match).
Again during T8's twentieth batch on 2026-10-01 (UTC),
four times,
with no wrong outcome landing:
the lint of the handover ran in the batch of the edit it read,
while this entry was being written
(rerun alone,
no finding);
the check of `339ce9118`'s message for `#` and task numbers ran in the batch of the message's write
(rerun alone,
no match);
the read of a lint log ran in the batch of the lint that wrote it
(the lint rerun alone printed the same "Found 0 warnings and 0 errors.");
and a named test run ran in the batch of the edit adding the case it ran
(rerun alone,
no FAIL line).
Once more in that batch the check came after the commit:
`70c8c8918`'s message was written and committed in one call,
and its check,
run next,
found no match.
Again during T8's twenty-second batch on 2026-10-01 (UTC),
once,
with no wrong outcome landing:
the named test run for B89's red cases ran in the batch of the edit adding them
(rerun alone,
the same three cases failed and their suite with them).
Once more in that batch:
the lint of the ledger ran in the batch of the edit to B91's entry it read
(rerun alone,
no finding).
Again during B100 on 2026-10-01 (UTC),
once,
with no wrong outcome landing:
the package lint ran in the batch of the edit to `translate-slice-guards.unit.test.ts` it read
(rerun alone,
"Found 0 warnings and 0 errors.").
Again during B101,
once:
the ledger's Markdown lint ran in the batch of the edit to B101's entry it read
(rerun alone,
no findings).
Again during B102,
once:
the named run of the new scan and its lint went out in the batch of the edit to its fixture case's name
(rerun alone,
every file exit 0 with no FAIL line,
and "Found 0 warnings and 0 errors.").
The prevention stands as written:
the edit or write,
then,
in a later response,
the command that reads it.
Since recording each instance has not stopped them,
a proposal for the owner:
a hook that refuses a Bash call sent in the same response as a Write or Edit,
as issue #579 asks the guardrail hook to refuse `;` chains.
Not filed yet;
the final report of this audit puts it to the owner.

### M50: a mutation runner that read a crashed test run as a survivor

Status:
happened 2026-09-28 (B18);
the runner fixed the same hour.
`mutants.ts` (`~/temp/agent/audit-glossary-fix/`) counted `[FAIL]` lines only.
A mutant giving the casing scan an ASCII-only continue test made it loop forever on a word opening with `Â`;
the test process died of memory exhaustion before printing any verdict,
and the runner reported the mutant SURVIVED.
Reproduced by hand,
it was a hang,
not a survivor,
and it exposed a real hazard in the scan (fixed in `f4aa85d9a`).
Earlier survivors were each closed by an added test,
so no past verdict let a gap stand;
a crash read as a survivor only ever cost an unneeded test.
The runner now counts a non-zero exit,
a signal or a timeout (180 s) as a failure and names it,
and a control that reproduces the hang reads as caught (SIGABRT).
Prevention:
a harness's verdict counts only outcomes it can observe;
a run that ends without a verdict is a result of its own,
never read as a pass,
and each harness gets one control per outcome it reports.

### M49: a commit message that named a cause before it was looked up

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

### M48: a census of a rule that searched the names of functions holding it

Status:
happened 2026-09-28 (audit area six,
letter predicates);
found when the prose-scanner switch widened its search.
The ASCII letter merge replaced 11 local copies,
found by searching for named predicates and their bodies,
and the plan for switching prose scanners to Latin letters was drawn from the same list.
The same test written inline was never searched:
`(character >= 'a') && (character <= 'z')` inside a larger function,
character-code ranges (`align-blocks.ts`),
literal alphabets and digit strings,
case-fold tests (`lower !== upper`),
and regex classes and properties (`\p{L}`).
A search by shape found inline letter tests in 13 more source files and a test file,
among them prose scanners the plan lacked
(`reading-refusal.ts`,
`assembly-content-survival.ts`,
`lexical-restoration.ts`,
`line-structure-guard.ts`,
`archive-italic-spans.ts`),
plus digit and hex tests,
and further definitions of a word character
(`\p{L}\p{N}` in `declared-name-survival.ts`,
cased letters by regex in `quote-neighbours.ts`,
cased letters by case fold in `canadian-date-parts.ts`,
`handle-gloss-place.ts` and `prose-ranges.ts`).
It also found three `opensTag` definitions that disagree on which character after `<` opens a tag.
Prevention (the prevention doc's copies family):
a census of a rule searches every way the rule can be written,
not the names of functions known to hold it:
range comparisons on characters and on character codes,
literal alphabets,
case-fold comparisons,
and regex classes and properties,
each query with a positive control.
The shape search itself then missed the negated form,
`(character < '0') || (character > '9')`,
which held four whole-text digit tests and a lower-case letter test (`baed88f59`);
a search for reversed operands (`'0' <= character`) and for character-code arithmetic found none,
while its control pattern matched 2.
So every shape is searched in both its asserted and its negated spelling.

### M47: a type declared while the same shape was already exported under the same name

Status:
happened 2026-09-28 (B11),
fixed in the next commit.
`index-pair-list.ts` declared `IndexPair { source, target }` for the shared correspondence-list guard,
in a change whose whole purpose was removing copies;
`pair-agreement.ts` already exported that type by that name.
Prevention (the prevention doc's copies family):
before declaring a type or helper,
search for its name and for its shape (`rg 'type <Name>\b'`,
and the field names together),
and reuse what is there.

### M46: a commit whose type check ran before its last edit

Status:
happened 2026-09-28;
`010e36bc5` failed the package's type check,
fixed by `84c748aba`.
The type check ran after the guard's first edits;
the barrel export added last collided with an existing export,
and lint and the tests passed,
so nothing caught it before the commit,
which named no breakage.
Prevention:
lint,
type check and the named tests run after the final edit of a commit,
in that order,
and a commit follows only a clean run of all three.

Recurred 2026-10-01 (UTC) in T8's twenty-first batch,
with a commit message rather than a type check:
`9c007f857`'s message was checked for task and issue numbers,
then a line was appended to it and the commit ran in the same call,
so the check never read the text that was committed.
The committed message read afterwards (`git log -1 --format=%B`) holds none.
Prevention:
the message check is one of the checks that run after the final edit;
any write to a message file starts the check again,
and the commit goes in a call of its own.

### M45: a lint over an empty file list read as clean

Status:
happened 2026-09-28 while fixing X19;
caught by the next command's output.
The file list for the lint came from `git status --short -- .` run in the package directory,
which cli-git's `require-root` guard refused,
so the list was empty;
the lint that read it printed "Found 0 warnings and 0 errors".
The earlier run over the same empty list had printed findings in exactly the changed files,
so the wrapper with no file argument lints something wider,
and a clean result from it says nothing about the list.
Prevention:
a command that consumes a generated list prints the list's line count in the same call first
(`wc --lines`),
and git runs from the repository root (the M1 family's git rule).
The same hour the slice-cache age check (M28) wrote its output to `slice-cache-newer.out` under the tree it searched,
a name its own `-path '*slice-cache*'` matched,
and printed one file written "today";
reading the path showed it was the output itself,
before any conclusion was drawn.
Prevention:
a probe writes its output outside the tree it searches,
or under a name its pattern cannot match.

### M44: a detector that said one order and kept another, guarded by a fixture that could not tell

Status:
happened 2026-09-28 in H16's `page-title-spans.ts`;
fixed in `d9a306602`.
`repeatedTitleSpans` said it listed titles by first appearance,
and tallied every heading,
then every HTML heading,
then every 《》 and 【】 span,
wherever each stood.
Its order test used 《》 alone,
one marker kind,
so it passed either way:
the M42 family,
a guard whose fixture
cannot reach the difference its label names.
The same file copied a private code-point counter,
with a `character !== ''` guard that a `for…of` over a string
can never fail,
from `page-name-glossary.ts` and `corpus-name-index.ts`,
beside a shared `codePointCount` (`code-points.ts`) that says it exists so no copy drifts;
`67243edae` removes all three copies and the three private copies of the Han test.
The rewrite then slipped a regex into the heading reader (RG1),
caught on reading the diff before lint.
Prevention:
before writing a helper,
`rg` the package for one that does the job
(`rg 'function \w*(codePoint|Han|heading)' src`);
an order claim is tested with a fixture mixing every source the order draws from.


### M43: a unit test run under the run's keys reached the live web

Status:
happened 2026-09-28 with H16's red guard;
fixed structurally in `d82dfe559` (X19).
The guard drove `preparePassEntry` end to end with an original naming a title,
and nothing in the test said which of the preparation's reads leave the process.
The suite inherits every decrypted key from the root `mise.toml`,
so the preparation's own lookup bought a search and wrote a record to the real cache (X19).
The same hazard had been met once before and handled in one test only,
by asserting its fixture named no title (`pass-footnote-lifecycle.unit.test.ts`).
Prevention:
a new test that drives a production entry point lists the reads that entry point makes
outside the process (`process.env`,
`fetch`,
`homedir()`,
a pinned corpus) before it first runs,
and hands each a fixture;
a seam that reaches the network or a real cache is required,
never optional,
so the type checker refuses a test that forgets it.


### M42: red guards whose fixtures never reached two of the sites they guarded

Status:
happened 2026-09-28 in X12's preparation half;
the guards rebuilt in `d00123df3`.
`f891b358e` guarded four call sites.
Its pairing fixture had sections of equal shape,
so no section round was bought,
and its hook handed one constant roster,
so a block round reusing an earlier seating passed;
its seam fixture paired every archive block,
so the review never ran.
Every guard went red before the fix and green after it,
which proved only that some site was fixed:
the M29 family,
a red that says nothing about the site its label names.
Prevention:
a guard over several sites asserts that each site is reached
(one assertion per site,
as `sectionRoundAsked` and `blockRoundAsked` now are),
and a hook under test hands a different roster at each call,
so reusing an earlier reading fails.
Once more the same day,
in the X14 pictures seam:
`f865f524a` held Synthetic throughout,
so the first seating was never asked,
and nothing showed the injected OCR was the one read;
`35684e182` adds a case with no hold and counts the stand-in's reads.
Prevention,
added:
a case under a constant hold exercises only the re-seat;
the first seating needs a case with no hold,
and an injected dependency needs its own call counted.

### M41: a mutation spec that left out the test pinning the mutated table

Status:
happened 2026-09-28 in X12's preparation half;
the mutant was caught once the file was listed.
The first preparation spec mutated the `preparation` row of `BENCHES_BY_PHASE`
but listed only the preparation's own tests;
`corpus-run/run-seats-wait.unit.test.ts`,
which pins the whole table since `c2adcfdbf`,
was not among them,
so the mutant survived and read as a gap in the guards.
Prevention:
for every mutant,
search the tests for the mutated token and list every file naming it;
report a survivor only after that search.

### M40: a source file with raw NUL bytes, skipped by every line search

Status:
fixed in `aacf919eb`,
2026-09-28.
`prepare-section-round.ts` carried two raw NUL bytes as its key separator since `3e93519df` (2026-08-23),
so `rg` and `grep` treated it as binary and printed one "binary file matches" notice in place of its lines.
Every line search over `src` since then got that notice,
or nothing once piped through a filter;
X13's fix edited the key beside the raw bytes without noticing them,
and this audit's outline of the file came back empty until an unfiltered search printed the notice.
Prevention:
a "binary file matches" notice from a search over source is a finding,
never noise.
A scan for control bytes other than tab,
newline and carriage return
(`rg --text --files-with-matches '[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]'`,
positive-controlled on a scratch file)
found no other file in the package outside `node_modules`,
`dist` and `.cache` after the fix,
and belongs in the pre-launch checklist.

### M39: a key change committed on a census of callers, and a commit message and its correction garbled

Status:
happened 2026-09-28 in X13;
the missed test fixed in `b84c2384c`,
the messages corrected by a commit comment.
Before `fea6e4688` the census of what reads the pairing keys searched for calls to the key builders.
Two of the tests it found also derive the key by hand,
which surfaced only when they went red;
`corpus-run/pass-footnote-lifecycle.unit.test.ts` calls no builder and joins the key material itself,
so it went red only in the full suite.
Afterwards a search for tests joining the version and a separator returned one of those three,
while a search for every test hashing with `createHash('sha256'` found all four hashing tests:
the M33 lesson again.
The message of `b84c2384c` then carried a garbled phrase,
and the first correction comment on it
carried a placeholder where a hash belonged;
the comment was edited to the resolved hash.
Prevention:
census a key by the material it hashes (`createHash`,
the version constant,
the separator),
never by the names of its builders,
and sanity-check a search that returns nothing with a broader one.
Read a commit message back before committing,
and resolve every hash a message or comment names with `git log`.

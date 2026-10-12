# Audit ledger, part 24

Part 24 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B57: a page link's text read back to any bracket, across lines and links

Found by the tenth coverage batch (census-VW2tHL),
reading `title-reference-locate.ts:196`,
the arm where no `[` stands before the page's link.
`locateLink` read the link text as everything after `lastIndexOf('[', middle)`,
with no bound,
so a page link to the title's destination that lost its opening bracket
took the text back to any earlier `[` in the slice,
and the unify pass rewrote all of it to the heading's rendering.
A probe over the built package
(`~/temp/agent/audit-glossary-fix/title-ref-probe.mjs`,
cat-themed fixtures):
a footnote definition line ahead of such a link on the page became part of the link text and was deleted,
and so was an earlier link on the same line.
At the pin none of the page links to the 22 destinations the originals link a Han heading title to is malformed
(`b57-link-census.mjs`,
over the 214 settled pages whose entry the pin holds).

Fixed (`571e47c64` red,
`fdceec645`):
`linkTextBefore` reads leftward from the link's `](` to the nearest `[`
and reads no link where a newline or another link's `]` comes first,
or where no `[` does,
so the reference falls through to the other shapes and is reported unplaced if none holds it.
Removing the break check failed the two red cases alone.
The reading moved with the link search into `title-reference-link.ts` under B59.

Recurrence:
a span read back from an anchor is bounded by the syntax it belongs to,
here the line and the brackets of one link,
and a test gives it a malformed neighbour.

### B58: a glossed title's lead-in words rewritten away

Found by the tenth coverage batch,
reading `title-reference-unify.ts:342`,
the arm where a glossed run is too long to be the title.
`rewriteLocated` read the run before a Han gloss (`Title (标题)`) as the title
whenever it had at most two words more than the heading's rendering
(`RUN_SLACK`,
added in `2f8bcfe93` with no reason given for the two),
and rewrote the whole run,
so the words leading into the title went with it:
in the probe the credits `—— Yunmao, from Afternoon Cat Talk (午后猫语)`
and `—— Yunmao, sung in Afternoon Cat Talk (午后猫语)`
both became `—— Yunmao, Afternoon Cat Murmurs (午后猫语)`.
At the pin 2 glossed references to a Han heading title stand on the 214 pairable settled pages,
neither opening with a small letter
(`b57-gloss-run-census.mjs`).

Fixed (`344e1b79a` red,
`ae29c52fa`):
`leadInEnd` starts a glossed run's title at its first word that does not open with a small letter,
since English title case capitalizes a title's first word,
and the rewrite keeps the words before it;
small is `isSmallLetter`'s general category,
read by whole code point.
`RUN_SLACK` is gone:
a capitalized word leading in ("——From Afternoon Cat Talk") cannot be told from a title's first word,
so a glossed title with more words than the heading's rendering is reported rather than rewritten,
and a run whose every word opens small is reported with its own reason.
That a longer English rendering of the same title is now reported where it was rewritten
is a quality call open to veto:
no word is dropped unseen,
at the cost of one more finding to read.
Forcing the lead-in to none failed the lead-in and all-small cases;
restoring the two words of slack failed the capitalized case alone.

Recurrence:
a tolerance constant states the evidence for its value,
and a rewrite of a span whose edge is guessed keeps the words outside the guess or reports it.

### B59: the link and gloss searches read only the first occurrence

Found with B57 and B58,
by probe against the locator's own rule:
a slice offering two spans of one shape is reported,
not guessed at.
The bracket and quote searches kept it;
the link search took the page's first link to the destination,
and the gloss search the first `(title)`.
So where the original links the destination from another word as well as the title
(`[这里](url)` and `《[title](url)》`),
the page's first link,
"here",
was rewritten to the title,
and a slice glossing the title twice unified the first gloss only.
At the pin no destination the originals link a Han heading title to is linked twice in an original or on a page,
and no page glosses a heading title twice.

Fixed (`b926e5c9c` red,
`04788c132`):
`locateLink` (now in `title-reference-link.ts`) counts the links to the destination in the original and on the page,
takes the page's link at the title link's place where the counts agree,
and reports the reference ambiguous where they do not;
`locateGlosses` reads every gloss,
since each names the title;
and the rewrite (now in `title-reference-rewrite.ts`) returns the span it replaces,
so the renderings of one reference are each rewritten against the same text and spliced in one pass.
The two moves kept `title-reference-locate.ts` and `title-reference-unify.ts` under `max-lines`.
Taking the first link and the first gloss again failed the three red cases alone.

Recurrence:
a search whose module promises to report two spans of one shape counts its hits before taking one.

### B60: a title two headings render alike dropped as ambiguous

Found by the tenth coverage batch,
reading `title-reference-unify.ts:197` and `:209`,
the arm that drops a title two headings share.
`renderedHeadings` dropped every such title "as ambiguous",
which it is only where the headings render it apart;
rendered alike,
a reference to either has one rendering to take,
and the drop left it unrewritten.
At the pin no original heads a Han title twice.

Fixed as a quality call open to veto (`a90f7fd98`):
a shared title is kept where its renderings agree,
read through the typography fold (B24),
and dropped where they differ;
`RenderedHeading` carries every slice heading the title,
the pass skips all of them,
and the finding names them.
Comparing the renderings without the fold failed the agreeing case alone.

Recurrence:
a rule that drops a case "as ambiguous" states what makes it ambiguous and keeps the cases where that does not hold.

### B61: the census reading counts only the baseline's stretches

Found by the eleventh coverage batch,
reading `census-5PAw2O` against `census-BF4g7o`.
`baselineStatusesOf` (`corpus-run/coverage-census-baseline.ts`) reads each baseline stretch as ran,
still cold or not loaded,
and in a reading of every source `editedClaimsOf` names only the edited sources the baseline holds a stretch in.
So two kinds of cold stretch are counted nowhere:
one in an unedited source that overlaps no baseline stretch,
code the baseline's run reached and this run did not,
and one in a source added since the baseline.
A batch whose change left code cold would read clean.
At `census-5PAw2O` three stretches of the first kind stand,
`with-timeout.ts` 57 to 59 and `create-logger.ts` 240 to 247 and 366 to 373,
and the printed reading shows none of them;
comparing per-file counts in a scratch script (`t8-batch8-file-diff.mjs`) showed them,
and that comparison misses a stretch going cold where another in the same file ran.

Fixed (`48c580d16` red,
`5ebe2ab62`,
and `4304d167d` for the sort's line order):
`coldSinceOf` names each stretch of this run holding a line no baseline stretch of its source held,
read line by line,
so a stretch reaching past the baseline's lines or across the gap between two is named too,
with whether the baseline loaded its source;
the reading prints each as "cold since then",
and in a reading of every source `editedClaimsOf` reads the sources either census holds a stretch in.
Through the built package,
`census-5PAw2O` read against `census-BF4g7o` holds 4 stretches cold since then:
the three of the first kind,
and `error-format.ts` 31 to 58,
of which the baseline held only lines 41,
49,
50 and 52.
Reading only the baseline's sources in `editedClaimsOf` failed the added-source case alone;
reading a stretch as held where any one of its lines was failed the reaching-past case alone.
The census at `eafa894be` (`census-tBNOKA`) printed "cold since then 0"
and left one cold stretch in the reading itself,
the sort's line order,
which `4304d167d` cased;
without the order that case alone failed.
A review found the reading still named code no source map places
(`5af5eeec8` red,
`ce32e438d`):
the census records it as `(unmapped) <bundle>`,
lines 0 to 0,
so a rebuild that renames the bundle gives unchanged code a new source,
and `census-BF4g7o` read against `census-VW2tHL` named six such stretches cold since then.
The reading leaves unmapped code out,
since it has no lines to compare and the census's own report counts it,
and the name now has one writer and one reader (`unmappedSourceOf`,
`isUnmappedSource`);
without the check that case alone failed.

Recurrence:
a comparison of two runs reads each side for what the other cannot say.

### B62: the census asks git about edits inside the package only

Found with B61.
`sourcesEditedSince` (`corpus-run/coverage-census-commit.ts`) runs `git diff --name-only --relative` from the package directory,
which lists no path outside it,
and with no claimed sources asks about `.` alone.
The census reads the sources of other packages and dependencies the suite loads as well
(61 files at `census-5PAw2O`,
among them `module-logger`'s,
`module-async-time`'s and `cli-markdown-lint`'s),
so an edit to one of them since the baseline leaves its baseline stretches matched by line against code that moved,
the misreading `d27a89dd0` fixed for the package's own sources.
No reading so far was touched:
the oldest census file in the cache was taken at `e22373347` (2026-09-29),
and between no two consecutive census files does a commit edit a source outside the package that the earlier one holds a stretch in
(`b62-other-edits.mjs`,
41 pairs;
its `git diff` lists the logger's files across `ddccea85d`,
the control).

Fixed (`fff46159d` red,
`eafa894be`):
`sourcesEditedSince` names every file of the work tree changed since the commit,
relative to the package as the census names sources,
and its `sources` parameter is gone,
since every reading asks after the sources it reads.
The red case found a second fault in the same call:
read line by line,
a name git quotes (one holding a double quote,
a newline or a Han letter) came back quoted,
octal escapes and all,
and matched no source;
git's output is now read NUL-separated,
which git prints verbatim.
Through the built package,
the check against `ddccea85d~1` names the seven `module-logger` files git lists across that commit.
Limiting the diff to the package failed the whole-tree case alone,
and so did splitting its output on newlines.
One narrower gap of the same kind stays,
by choice:
`packageCommit` reads a tree as clean from `git status` under the package alone,
so a baseline taken while another package's source held uncommitted edits,
later discarded,
would match that source's baseline stretches against code that differed when the census ran.
Reading the whole tree for cleanliness would refuse a census whenever any file of the work tree outside the package is dirty,
however unrelated.

Recurrence:
a question put to git covers everything its answer is read against,
and its output is read NUL-separated.

### B63: a draw's manifest never names the pool's build

Found by the twelfth coverage batch,
reading `corpus-run/pool-generation.ts` beside the census it reads.
`poolGeneration` looked each kept name up in `eligible.digestByEntry`.
The draw hands it `keepEligible`'s result,
artifact file names (`whiskers.json`),
while `artifact-eligible.ts` `mapDigests` keys that lookup by the census's entry ids (`whiskers`),
so no lookup matched,
and every real draw's sample manifest recorded `unrecorded: no kept entry recorded a pipeline digest`,
the gap the module's region comment says it closes.
The unit fixture keyed its lookup by file name too,
agreeing with the defect rather than with the lookup's contract
("keyed by entry id",
`EligibleEntries.digestByEntry`).
A search of the package directory,
the main checkout's package directory and the cache found no sample manifest outside test fixtures
(`t8-batch12-plan.md`),
so by inference no graded sheet carries the wrong record.

Fixed (`568e78912` red,
`0ad52495e`):
the names are typed `ArtifactFileName` and looked up by their entry id (`entryIdOfArtifact`);
the fixture keys entry ids,
and a case drives the chain the draw runs
(`listArtifactFiles`,
`censusByGeneration`,
`selectEligible`,
`keepEligible`,
`poolGeneration`) over two placed artifacts.
Looking the name up as it came failed four of the fixture's cases.

Recurrence:
a lookup is fed the key its builder used,
and an entry's file name and its id are distinct types;
a fixture standing in for a lookup another module builds is paired with one case that drives that module.

### B64: four readers took any `*.json` name as an artifact

Found by the twelfth coverage batch.
The census (`readdirArtifacts`,
then in `artifact-placement.ts`) and the scheduler (`pass-settled.ts`) list only regular files named `*.json`,
after the drift `pass-settled.ts`'s region comment records,
where a directory or a symlink called `Mittens.json` marked Mittens settled.
Four readers of an artifacts directory never took that check:
`settled-carve.ts` `listSettledEntryIds`,
the rendering audit's run sets (`rendering-audit-settled-input.ts`,
whose loose layout did check),
`published-tree-listing.ts` `settledEntryIds` (read by `verify-published.ts` and `pass-republish.ts`)
and `editor-standing-read.ts`.
There a directory or a symlink named like an artifact became a settled entry,
stopped the archive reading with EISDIR,
or was read a second time;
run by hand over an archive holding one artifact,
a directory and a symlink,
the built `editor-standing-read` printed `artifacts=3`.
Five other readers took the census's lister and filtered its names by the suffix again
(`score-probe.ts`,
`attribution-read.ts`,
`damage-sample.ts`,
`draw-sample.ts`,
`pass-schema-census.ts`),
four more sliced the suffix off by hand
(`keepEligible`,
`assertArtifactProvenance`,
`loadEntry`,
`collectTwoLaneShippedRegions`),
and the artifacts directory's name was spelled out in ten files,
two of them as their own constants.

Fixed (`cc74ef7f5` and `7e1305ec6` red,
`daa5af787`,
then `8860dc52c` and `a60c1ad38` with no behaviour change):
`corpus-run/artifact-file-name.ts` owns what names an artifact and where it lives:
the `ArtifactFileName` type and its guard,
`entryIdOfArtifact`,
`artifactFileNameOf`,
`listArtifactFiles` (regular files only,
filtered by the suffix),
`artifactFilesIn` (the same,
reporting an absent directory),
`ARTIFACTS_DIR` and `artifactsDirOf`;
every reader lists through it,
and every name is built and read back through it.
`runs-layout.ts` owns the slice-cache and prompt-payload directory names,
which the cap census's skip list now reads,
and `prepareRunsLayout` has its first test.
Letting a non-regular file through the lister failed six test files
(`artifact-file-name`,
`settled-carve`,
`rendering-audit-settled-input`,
`published-tree-listing`,
`editor-standing-read`,
`pass-settled`).

Checked since (B65):
the ledger,
the published tree,
the probe runs and the slice cache each took an entry their writer never wrote,
and every listing now goes through one module.

Recurrence:
a rule about what a directory holds lives in one module every reader lists through,
and a new reader of that directory starts from that module;
a name spelled in two files becomes a constant one of them owns.

### B65: readers of the run's other directories took entries their writer never wrote

Found answering B64's open question,
by reading every directory listing in library source
(`rg 'readdir|opendir|Dirent|glob'`,
test files and fixtures aside).
Six readers took an entry of the wrong kind,
or a write still in flight,
as a record:

- `ledger-directory.ts` `readLedgerDirectory` attempted every name.
  The recorder writes each contest through `writeFileAtomic`,
  whose temporary name is `<name>.<pid>.partial` beside the target,
  so a report listing the ledger mid-write,
  or after a crash between write and rename,
  read that file as a contest
  (a whole one read as a round,
  a cut one counted among the refused contests,
  which the report calls contests the run recorded).
  A directory named like a contest was refused the same way,
  and a symlink to one counted that contest twice.
- `published-tree-listing.ts` `publishedEntryIds` listed the people directory by name and looked for each name's page;
  a regular file there raised ENOTDIR out of the listing,
  and so out of `verify-published`,
  whose owner rule is to print its findings and ship,
  and a symlink to an entry directory counted that page under a second name.
- `rendering-audit-settled-runs.ts` `newestRun` took a directory named like a later run as the newest run.
- `slice-cache-namespace.ts`:
  a directory named like one of a lane's slices raised EISDIR out of the cache open,
  stopping the entry,
  and the discard's `rm` raised on it too.
- `slice-cache-store.ts` `listResumableEntries` resumed an entry with progress a second time under a symlink's name.
- `entry-reattempt.ts` `countCachedSlices` counted a directory named like a slice as progress.

Every case but one needs an entry no pass writes,
placed by hand;
the ledger's partial file is the one an ordinary crash leaves,
and a report run mid-write can meet.
Reading the listings also found the copies B64's rule is about:
`artifactFilesIn` and its `ArtifactListing` union (B64's own) repeated `namesIn` and `DirectoryReading`;
three readers repeated a listing that reads an absent directory as empty
(`ledger-directory.ts`,
`slice-cache-dir-read.ts` `readDirectoryNames`,
`declined-entries.ts`);
`declined-entries.ts` and the rendering audit's layout listing each filtered a `withFileTypes` listing by hand;
the ledger directory's name was spelled in `candidate-ledger.ts` and `ledger-report.ts`;
and the slice suffix in `slice-cache-namespace.ts` and `entry-reattempt.ts`.
`declined-entries.ts` (ledger A9b),
`pipeline-digest.ts` and the rendering audit's layout listing already checked each entry's kind.

Fixed (`e987110a1` red,
`467ab6c48`,
then `6583c32c4` with no behaviour change):
`corpus-run/directory-listing.ts` decides what kind of entry a reader takes:
`namesOfKind` lists regular files or directories by the entry's own type,
so a link is neither and is never followed;
`presentNamesOfKind` reads an absent directory as holding none;
`readingOf` reports an unreadable directory by its filesystem code,
and `namesIn` and `artifactFilesIn` both read through it.
Each reader takes the kind its writer makes,
and the ledger takes only names `ledgerFileName` writes (`isLedgerFileName`).
The ledger directory's name and the slice suffix each have one owner
(`LEDGER_DIR`,
`isSliceFileName`).
`directory-listing-scan.unit.test.ts`,
now among the source scans,
fails on any directory-listing import from `node:fs` or `node:fs/promises`,
and any namespace,
default or dynamic import of them,
outside the listing module and the two walkers it names with why
(`pipeline-digest.ts`,
`cap-census.ts`).
Letting every kind through `namesOfKind` failed the B65 cases for an entry that is not the kind asked for in six test files
(the slice cache's open case unseen behind its file's first failing describe),
both kind cases of `directory-listing.unit.test.ts`,
and the older case for a plain file under the slice-cache root,
whose ENOTDIR catch the fix removed;
letting `.partial` names through the ledger failed the in-flight case alone;
a stray `readdir` import in `ledger-directory.ts` failed the scan's package case.

Recurrence:
a reader lists through `directory-listing.ts` and names the kind of entry its writer makes,
then filters by the name its writer gives a record,
so a write still under its temporary name is never read;
the scan refuses any other listing.

### B66: lane messages printed a count before a fixed plural

Found by the thirteenth coverage batch,
reading `lane-slice-coverage-error.ts` beside the cases its cold sentences lacked.
A repeat fault prints how many entries a list claims and how many distinct indices they hold,
and the distinct count is 1 whenever two entries share one index,
so the sentences read "under 1 distinct indices" and "over 1 distinct slices".
`lane-slice-sets.unit.test.ts` asserted "lane reports 2 unfilled slices under 1 distinct indices",
agreeing with the defect.
The contest driver's log of the claims shown to the judges read "1 corroborated damage claims" for one claim.
By inference from `refusalText`'s callers,
the coverage error's message reaches only log lines and stored records,
and the driver's line is the run log,
so no model was shown either wording.

Fixed (`da74173a1` red,
`65deb5167`):
each count in those sentences takes the word `wordForCount` (`count-word.ts`) chooses,
and the number of decisions reads through `howOften`.
The lane contest's finding "heard N usable ballots,
below the 2 needed to settle"
and the polish gate's twin of it are left for the family's own change,
since both are stored in artifacts and move together.
`65deb5167`'s message quotes that finding with a 3;
both quorums are 2,
and a comment on the commit says so (M84).
Taking the fix back out failed the three red cases,
each with its describe,
and nothing else.

Open:
the same shape stands elsewhere
(the slice cache's "discarding N cached slices",
whose test's header quotes "discarding 1 cached slices",
the census report's own "1 stretches,
1 lines",
and the lane contest's and polish gate's usable-ballot findings);
the family is classified and fixed as one change,
red first,
with the sites a model reads apart from those a person reads.

Recurrence:
a count in a message takes the word `wordForCount` chooses,
or `howOften` for a number of times,
and a case pins the count of 1.

### B67: the container deficit found a container's tag by searching for its text

Found by the fourteenth coverage batch,
reading `insertion-container-deficit.ts` beside its cold arm for a tag the search could not find.
`insideContainer` cuts one half of a container at the container's own tag,
so the deficit counts only the blocks inside it.
It took the tag from `maskLoneContainerTags`,
which records each tag's offsets but returned only its kind,
name and text,
and then searched the slice for that text:
`indexOf` in the opening half,
`lastIndexOf` in the closing half.
A whole element of the same name in the same half slice
(a closed `<details>` pair before the container's opener,
or after its closer)
holds the same text,
so the search found it instead and counted its blocks as the container's.
Where the original's and the archive's copies of that element differ in blocks,
the difference moves this container's deficit:
in the red cases,
a container the archive renders whole admitted an absent passage.
Whether a pinned page has such a half slice is not measured.

Fixed (`1af921d31` red,
`ad58185f7`):
`LoneContainerTag` carries `startOffset` and `endOffset`,
and the deficit cuts after the first lone opener of the container's name
and before the last lone closer,
at those offsets.
Cutting at the text search again failed the two red cases and their describe,
and nothing else.

Recurrence:
a reader that needs where a tag or token stands reads the offset its finder recorded;
searching the text again for what was found is a second finder,
which finds the first or last copy of the text rather than the one found.

### B68: the container deficit counted blocks by blank-line split

Found by the fourteenth coverage batch,
reading the same file as B67.
`countBlocks` counted the blocks one side writes inside a container as runs of non-blank lines.
The package's rule for a question about what a container holds is to ask the parse the floor reads
(`mistake-prevention.md`,
"Structure read off the parse",
after B42),
and a blank-line split disagrees with it wherever the two texts write one block differently.
In the red cases,
a list written loose in the original and tight in the archive admitted an absent passage into a container the archive renders whole,
the same list tight in the original and loose in the archive refused one the archive lacks,
and a fenced block with a blank line inside admitted one as well.
Whether a pinned page has such a container is not measured:
none of the 56 settled artifacts in the worktree's run directories carries an admission finding,
nor the coverage finding every admission writes,
so the artifacts do not record them,
and the logs that print them are mixed with unit-test logs.

Fixed (`8ec62ce62` red,
`19eb118ab`):
`insertion-container-blocks.ts` reads each slice's side,
cut to the part inside the container,
with `readSliceSkeleton`,
and counts its top-level blocks.
A passage costs the blocks the container counted for its slice,
so the deficit and what it is spent on are one measure.
A half the parse refuses leaves the container uncounted,
admitting nothing,
with a finding naming the side,
the slice and the parser's detail
(`insertion-container-deficit-unread`);
both documents parse whole,
so that arm is not expected,
and it is a finding rather than a stop because a run always ships.
The count gives up one thing,
recorded as a choice:
a list the archive renders with two of its three items reads one block against one,
which is the roster's carried and partly-carried verdicts' business.
Counting by blank-line split again failed the three list and fence cases and nothing else.
The census after the fix (`census-VmhQQH`,
1,467 passes,
taken clean)
reads against `census-o4RZ7w`:
ran 0,
still cold 1,164,
cold since then 0,
not loaded 6,
and per-file counts compared between the two census files change nowhere;
both container modules are loaded and hold no cold stretch.

Closed in B100:
this entry left three readers open
(`displacement-ratio.ts` `contentBlockCount`,
`line-structure.ts` `isLineStructured`,
`translate-address-drop.ts` `blocksOf`)
and the target-only run;
a census found two more in the page passes,
and the fix found the suicide floor reading the same split.

Recurrence:
a count of what a passage holds reads the parse the floor reads,
and one measure serves both sides of a comparison and what the comparison is spent on.

### B69: the prompt payload store's refusals named nothing that refused

Found by the fifteenth coverage batch,
reading `prompt-payload-store.ts` beside the cold stretches of its refusals.
Every refusal the store raised read `prompt payload read failed for <digest>`
(or `write`),
whichever of its checks refused:
a record that could not be opened,
text that was not JSON,
another format version,
each field of the stored reply,
or a write the filesystem refused.
The error declares its message names-only,
so that message is all a `TALLY` line prints (`refusalText`),
and the cause it carried for a filesystem or parse failure was never shown.
An operator could not tell a corrupted record from a format change from a full disk,
and the one refusal case
(reply text 7)
asserted the class alone,
so it passed whichever check fired.

Fixed (`2d3b02c45` red,
`a56cde819`):
the error carries a `reason`,
in its message after the digest and as a field,
naming a JSON path in the record,
the envelope,
the format version this build reads
(never the stored one),
or a filesystem code from `failureName`.
Its TSDoc says what to do about one:
where the record lives,
that a read refusal stops every later run too,
that deleting the record asks the provider again at that call's cost,
and that a write refusal lost a reply already bought;
the README points there beside its other `INCOMPLETE` sentence.
The parse has a narrow `try` of its own,
through `requireJsonSyntaxRefusal`,
so the wide catch that rethrew the store's own refusal went.
Taking the reason out of the message again failed the 14 red cases and nothing else.
Two red expectations were corrected in the fix commit:
the not-JSON reason no longer names `SyntaxError`,
the only class that narrowing lets through,
and the not-an-object record became a JSON string,
since `isJsonRecord` lets an array through to the version check (M58;
the red commit carries a correcting comment).
`f7838ffb3` then asserts each refusal as `tallyErrorText` prints it,
whole,
so the reason is shown to survive the line's cap.

Recurrence:
a marked class names what refused,
since its message is all an operator sees;
one sentence for several checks also lets a case pass on the wrong check.

### B70: folds that copied what they had built at every step

Found by the sixteenth coverage batch,
which rewrote `scanNearest` (`pair-sections-steps.ts`) as a loop:
a `reduce` whose step returned its answers so far spread into a new list,
so each step cost as much as every step before it,
the quadratic shape rule ITR in `AGENTS.md` rules out.
Nothing read that shape:
`text-accumulators.unit.test.ts` sees only a `let` begun as text and grown in a loop.
A scratch probe (`fold-copies-probe.mjs`) over the 1,068 production files
read 159 `reduce` calls and flagged 16 folds and one loop,
with controls:
the pre-refactor `scanNearest` and a synthetic file of every shape were reported,
and a numeric sum and an appending fold were not.
The guard written from it found three more loops the probe's rule missed.

The guard's 19 findings sort four ways.
Seven copied a list that grows with the input,
among them `stripStubMarkersWithOrigins` (`archive-stub.ts`),
which copied every line kept so far at each line of a page
while its summary called the pass linear.
Four spliced text one edit at a time,
last first,
at offsets into the original:
patch operations,
italic titles,
a list's gaps,
and a URL's trailing marks shed one slice at a time.
Six are sequential or bounded and are named in the guard with why:
four whose each step reads what the step before wrote
(the archive block repair,
name glosses,
seeded errors,
the slice splice),
two folds over fixed tables,
the merged regions `grownSpans` checks each run against,
and `collectRounds`' next-round queue,
rebuilt once per round and bounded by `maxRetryRounds`.
A spread inside a record of fixed fields is not read,
since it costs the same at every step.

One splice was a defect in output,
not only in cost.
`italicizeSlice` (`archive-italic-title-restore.ts`) reads curly and straight quotes,
which can nest.
With a title quoted inside a quoted title,
the inner went in first,
its form read its two spaces as one,
and the outer then cut at its original end,
one unit past its closing quote,
taking the mark after it;
its findings also named the inner rewrite the outer had overwritten.

Fixed (`42d7a0f08` red guard,
`be0897f00` the growing lists,
`f033d19e8` red case for the nested titles,
`66b77b040` the splices):
each growing list is a loop that appends,
removing in place where a step removes;
the splices go through `spliceDisjointEdits` (`disjoint-splice.ts`),
which sorts by start,
copies each untouched run once,
and refuses two edits that share a unit or a start (`OverlappingEditsError`),
since each caller builds its edits apart;
the italic pass keeps a nested span only where it opens first
and names only the spans it writes;
and the URL trim steps back to its cut and slices once.
The whole unit suite at `66b77b040` prints 1,472 PASS lines and no FAIL line.
With the old copying fold put back in `respaceList`
the guard's package case failed
("expected [ …(9) ] to deeply equal [ …(8) ]"),
and with the helper's refusal disabled
its two refusal cases failed and nothing else;
both were restored.
The first whole-suite run of the splice change failed the message inventory alone,
since the new error class was unlisted;
it is marked and listed in the same commit.

Reading the italic pass for the splice left one finding open.
`protectedRanges` (`prose-ranges.ts`) reads emphasis as prose,
so a quoted title inside an emphasis span is rewritten in asterisks there too.
Parsed with `mdast-util-from-markdown` 2.0.3
(`italic-in-emphasis-probe.mjs`,
cat-themed inputs),
the result inside `*…*` or `_…_` is an emphasis node inside an emphasis node,
and inside `**…**` an emphasis node inside a strong one.
Inside emphasis the title then shows in the same italics as the words around it,
and the quotes that set it apart are gone
(an inference from the default styling:
the local site checkout holds only `data`,
so its stylesheet was not read).
B72 measured it over the pinned corpus and closed it,
with the archive side's reading of italics.

Recurrence:
a fold or loop over the input never copies what it has built;
it appends,
and several edits into one text are written in one pass from offsets into that text.
`fold-copies.unit.test.ts` fails on a new one,
and an exemption names why a fold's copies are bounded or are its meaning.

### B71: the slice-cost reader read counts nobody wrote

Found by T8's seventeenth batch,
reading the two cold throws in `slice-cost-read.ts`.
`readLine` checked every field in one loop,
then read each again through `provenWhole` and `provenMember`,
which threw when the loop had not checked the field;
no line could reach those throws,
and the file's own note said it validated and built together.
Its count check was `Number(raw)` and `Number.isInteger`,
and `Number` reads an empty text as 0,
`0x1F` as 31,
`1e3` as 1000
and a leading sign,
so a `chunk=`,
`sourceChars=` or `ms=` field that `armSliceCost` never wrote
(it writes `String` of an integer)
became a count in a row.
A digit run past the largest integer a double holds exactly read as a neighbouring number.

Measured over every stored `SLICE-COST` line under `node_modules/.monochromatic` and the audit's scratch folder
(`b71-scan-count.mjs`,
1,395,824 lines,
37,183 distinct):
174 carry a count field that is not plain digits,
and every one is source or test text,
not a logged value:
the writer's template in built bundles and their maps,
the reader tests' own fixtures,
and ledger excerpts
(`b71-scan-values.mjs` lists each value).
The positive control,
five planted lines,
flagged the four malformed ones and not the fifth.
So no stored pass log carries a count this reader misread.

Fixed (`774710cb0` red,
`3da144aed`):
each field is read once into its value or a named refusal
(`memberField`,
`countField`),
and the row is built from those readings;
a count is read only when its text is ASCII digits
(`isAsciiDigits`)
that `Number` reads as a safe integer,
and an empty field is named `empty` in the reason.
With the digit check put back to `Number` alone,
the red case failed and nothing else;
restored.
A signed value is refused although the writer could write `ms=-3`:
it measures the slice as a difference of `Date.now()` readings,
the wall clock,
which a clock step can move backward mid-slice
(the elapsed-time family,
found in T8's seventeenth batch record and closed by B78,
after which the meter reads a clock no step moves).
A negative duration is not a measurement,
and the dropped reason names it.
The package's other number reads from text are the same family,
open there and closed by B73.

Recurrence:
a reader of text it wrote itself accepts only the spelling its writer writes,
and reads each field once.

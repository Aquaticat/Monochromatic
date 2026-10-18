# Audit ledger: page assembly and the corpus-run driver

Findings in the page-assembly passes and the driver that runs a corpus pass.

Part of [Audit ledger](audit-ledger.md),
which lists every file of this record.

## Page assembly and the corpus-run driver

Probes:
`~/temp/agent/audit-assembly/`
(`replay2.out`,
`categorize.out`,
`chain-probe.out`,
`fixtures.out`,
`seats-probe.mjs`,
`tally-check.out`,
`findings.txt`).
Replaying stored decisions through the current reader reproduces 93 recent pages byte for byte;
the other 41 differ only by typography code that changed after they ran.

### A1: an archive "Under Construction" placeholder ships, replacing a source heading on 8 pages

Status:
fixed in `6a0a8cbf6`.
`archive-stub.ts` now reads a paragraph under blockquote markers and inside one code span,
and knows the token `under construction`.
A census over the 92 archives strips exactly two paragraphs,
XIEPT2 line 8 `(To-Do)` and XingZ60 line 358;
dogesir_'s "To be continued!"
(the person's own words) and mikaela_khara's 未完待续 are no placeholders and stay.
XingZ60's archive ends at 三句承题,
so the source sections after it are source-only and left to pairing.
`corpus-run/archive-stub.ts` knows `to-do`,
`todo`,
`tbd`,
`wip` in one bracket layer;
XingZ60's archive writes ``>>> `Under Construction` ``,
all 17 shipped XingZ60 pages carry it,
and 8 have no rendering of the source heading 七句破题.

### A2: a Han handle left in English prose (with F-3)

Status:
fixed with F-3;
the shape is refused at validation,
and the identity line no longer offers the Han as English.
shihai4h1 and shihai4h2 shipped "Wrong,\n小柿子."

### A3: CRLF from a model wording ships inside an LF page

Status:
fixed in `f582157a9`.
`corpus-run/line-ending-fold.ts` folds every replacement first in the page-assembly guard,
before any other pass reads it,
and records each changed slice as a row the page carries.
mikaela17 lines 223 to 225 end in `\r`;
`foldCarriageReturns` runs only at the corpus read.

### A4: archive link destinations rewritten to the source's Chinese-site ones

Status:
fixed by the page-assembly pass `corpus-run/archive-destination-restore.ts`;
owner,
2026-09-27,
"Archive's English":
where the archive links the English counterpart of the original's destination,
the page keeps the archive's destination.
Measured:
12 archive-only destinations in 92 entries,
3 of them localized (two zh.wikipedia to en.wikipedia,
one source.android.google.cn to source.android.com) and 2 differing only by www.
shihai4h2 links PTSD to zh.wikipedia where the archive links en.wikipedia;
aiyysk links source.android.google.cn where the archive links source.android.com.

The pass pairs the links of a slice whose original and archive carry equal counts by position,
and keeps a replacement only where the original destination appears nowhere on the archive page,
the archive destination nowhere in the original,
and the original destination is replaced one way.
Over 92 entries it reads six replacements:
the three localizations,
a `www.` host,
twitter.com to x.com,
and a moved path on one host,
the last three the same kind of deliberate archive choice,
kept under the same answer and open to the owner's veto;
a swap of two destinations both sides carry (noname3031) is left alone.
Replayed over settled artifacts it changes shihai4h s21,
aiyysk s76 and s77,
and luxuanwen3 s1.

### A5: seats with no wet provider are seated anyway

Status:
kept by decision;
its costs fixed under P3 and L1.
`corpus-run/run-seats.ts` `seated()` returns true on `NO_PROVIDER`;
TianqiChen66620 seated Qwen3.8-27B and glm-5.3 with no provider serving them,
logged 360 `NoProviderForModelError` lines,
and counted both in every quorum denominator.
This is the owner's rule of 2026-09-09 (`doc/decision/translation-repair-short-bench-share.md`,
"The rule"):
a seat no wet provider serves stays on the judge benches,
so the quorum and the `stage-short-bench` findings mark a page decided on a thin bench.
Withholding it would hide exactly that.
Its costs were the round-0 place a refusal spent (P3,
fixed)
and the checker bench it left short (L1,
fixed);
what remains is the log volume of one refusal line per ask.

### A6: the handle-gloss pass moves a link title's translation onto a handle

Status:
fixed in `2c6e42c27`.
A parenthesis holding a bracket,
a nested parenthesis,
a backtick,
a tag or `://` is no gloss,
and that appearance stands as the writer left it.
The first fixture was vacuous (the authority step never read the linked signer);
the positive control led to a prose-link fixture,
which reproduced the bug.
The fixed-point test passes on the old build too,
so it guards the property only.
Reading replaced slices only is by design:
the archive's own text is never rewritten.
`handle-gloss-place.ts` accepts any same-line parenthesis,
link text included,
reads only replaced slices,
and is not at a fixed point when run twice.

### A7: deterministic page refusals are labelled `ERROR` and re-attempted

Status:
fixed in `b11fd5409`.
`entry-error-outcome.ts` omits `CollapsedHeadingError`,
`UnparseablePageError`,
`PublishedPageDisagreesError`,
`UnansweredContestSliceError` and `SliceSpliceError` from the stopped set.

### A8: the README says an unfilled passage fails the entry; the code ships it as a gap

Status:
fixed in `d721449e2`.
The README now says an unfilled passage ships as a recorded gap and an outage stops the entry `INCOMPLETE`.

### A9: the `DONE` line undercounts on a resume into a directory holding a decline

Status:
fixed in `ead0a2d98` (prep `517facb2d`,
guard `4127bfdcb`).
The pass skipped entries with an artifact or a decline,
then reported artifacts after the run less the size of that set.
The guard went red on the old formula with 0 where the run finished two entries,
and -1 where it finished none on a runs dir holding one decline.
`corpus-run/pass-finished.ts` reads the finished set the same way before and after the run
and counts the ids new to it.

### A9b: the decline listing reads an unlistable directory as no declines

Status:
fixed in `150819e64` (guard `325f2d732`,
found while fixing A9).
`declinedEntryIds` returned no declines on any listing failure (EACCES,
ENOTDIR),
which would re-run every declined entry and drop it from `verify-published`'s count,
and it counted a directory named like a record,
the drift `pass-settled.ts` already records for artifacts.
It now lists with file types and throws `DeclinedEntriesUnreadableError` on every failure but absence.

### A10: `TALLY` `pageChanged` reads before typography

Status:
fixed in `e0354d62d` (guard `48c573f20`).
The `TALLY` now reads each slice through `wouldShipTextPerSlice`,
as the publisher does.
Replayed over the stored artifacts:
hulicaijia31 34 to 31 and hulicaijia20 41 to 40,
the audit's page counts;
TianqiChen66610 and TianqiChen66614 unchanged.
The test fixture now states `archiveText` and `pageAssembly`,
which the contract requires.

### A11: logging gaps

Status:
fixed.
The slice cache persists atomically and warns on a file that does not parse (`972682353`,
guard `03af65966`).
The attempt store warns on each reset and each count read as zero,
and writes atomically (`b9d5c8009`,
guard `e68733836`).
`src/log-context.ts` (moved on 2026-10-18 to `package/translation-repair/typography/src/log-context.ts`) (`907805225`)
carries an `AsyncLocalStorage` context:
the pass runs each entry under its name and pipeline,
and the repair,
translate,
contest and consolidation drivers run each slice under its lane and index (`99c35e526`).
Every module root logger reads it (`842c1feff`),
the repair and translate lane loggers add the slice to every line,
and ledger rounds record it and are written atomically (`fdcd003ef`).
Guards:
three calls queued behind one `p-limit` slot each write a `SPEND` line naming their own slice (`d0e912a0c`),
so the provider queue keeps the context;
the lanes' lines at overlap 2 (`d14346bb4`);
a ledger round's context (`2e5d2ab38`);
and a source scan that fails on a plain module root (`07151e084`),
which finds all 41 on the tree before `842c1feff`.
The consolidation driver's slice body was indented against its nesting (the X9 shape) and is now indented to it.
Client-layer loggers carry no entry
(3279 of 5914 lines of `TianqiChen66616.log`,
`SPEND` lines among them);
the repair and translate lanes' lines carry no slice under overlap;
`slice-cache-namespace.ts` swallows a `SyntaxError`;
`attempt-store.ts` resets a malformed attempts file silently and writes it non-atomically;
ledger records carry no entry,
slice,
lane or generation.

### A12: `rebuildPreparation` silently fails to reproduce a folded entry

Status:
fixed in `7c444de3e` (prep `f46f5a7b7`,
guard `27e9ec7ea`).
mikaela15 records 34 slices and rebuilds to 32 with nothing named.
Attributed:
mikaela15 settled at `caac222a6`,
before `a43c5d88d` (class one hundred twelve) read an interior gap
unplaced on both sides as one merge;
its section 2 leaves original blocks 3 to 7 unpaired,
which the run carved as source-only slices and today's slicer merges.
The artifact also records the carve after the carried-insertion fold,
and nothing records the fold:
TianqiChen66614 rebuilds with position 13 moved (its log folds slice 15 into 14 and shifts 14's original into 13).
`RebuiltPreparation` claimed an empty gap list meant the run's own carve;
it now carries `reproduction`,
read off the recorded rows (`artifact-two-lane-rebuild-rows.ts`),
naming the first departure.
`2c4207912` first read it off the recorded identity,
which called every settled artifact moved
(see A12b);
a commit comment on it records the correction.
Over stored artifacts:
mikaela16,
mikaela17 and TianqiChen66610 reproduce;
mikaela15 (32 of 34),
hulicaijia31 (71 of 72) and TianqiChen66614 (position 13) move.

### A12b: the rendering audit refuses every settled artifact

Status:
fixed in `da9ca20b0` and `487146cd2` (guard `ce97e60a2`,
repin `d280961b0`;
found while fixing A12).
`verifySettled` required the recorded preparation identity,
which also hashes the declared names as the run's build worded them,
and the recorded alignment findings,
which include the roster pairing rounds' own (mikaela16's six);
a rebuild reproduces neither,
so mikaela16,
mikaela17 and TianqiChen66610,
whose rows match slice for slice,
all printed `REFUSED` on `preparation.identity`.
A rebuild is now verified by its rows and by `verifyArtifactMeasurements`
(slice count,
document sizes,
alignment pairs,
each lane's slice count);
the identity and findings checks stay in `verifyArtifactAgainstPreparation` for a preparation the run itself built.

### A13: the consolidation cache key omits the dispute note and the declared name pairs

Status:
fixed in `c8f2a2af3` (prep `bcf31dae2`,
guard `69d47d61f`).
Identity and reference context are in the run shape already,
and the dispute note has been in the slice key since X5.
The declared name pairs reached the key only through the identity context,
which renders the same front matter name and alias fields in other words;
`consolidateRunShape` now takes them as a required parameter and folds them in when there are any.

### A14: stale comments and README claims

Status:
fixed in `55d895820`.
"As the page will carry it" (README,
`canadian-forms.ts`,
`page-slice-rewrite.ts`) is true since the K5 rounds,
so those lines stand.
"No stage assembles a document",
"as the page will carry it" for withdrawn slices,
"every appearance is in view",
"four stores",
"as the stage left them",
and every pass rewrite logged as "trimmed".

### A15: withdrawn-slice siblings of K5

Status:
fixed with K5 in `3497e0041`.
A withheld container half enters the rounds as a withdrawn row does,
and a row a pass writes for it wins over the withholding;
cross-slice passes now decide on the page the guard leaves.
`restoredOnly` does not exclude `halves.withheld`;
cross-slice passes decide on a page the footnote guard may still change.

### A16: low items

Status:
fixed (A16a to A16c);
the write order is kept by design.
A lane wording's triple newline ships:
not a defect.
Owner,
2026-09-27:
"There is no need to eliminate extra newlines,
because markdown doesn't care",
recorded in `doc/design-commitments.md` (moved on 2026-10-18 to `package/translation-repair/doc/design-commitments.md`).
Measured before the ruling:
30 of 272 published pages carry a run of three newlines,
most where the archive does too;
a wording whose trailing newline the archive span lacks adds one at the seam (XingZ616 slice 78),
and one that drops it joins no paragraphs (the page still carries the separator).
Asked the same day,
the owner kept the A3 carriage-return fold.

#### A16a: the runs lock judged liveness by pid alone

A lock left by a killed pass named a pid the kernel later hands to any process,
and after a reboot pids start again from the bottom;
the lock then read as held by that unrelated process,
and the refusal told the operator the holder was alive.
Fixed in `ebf768e66` (prep `dc6826f6b`,
red guard `0eac33216`):
the lock records host,
boot,
pid namespace and start ticks (`process-identity.ts`),
is taken over only on positive evidence (a later boot,
a free pid,
another start time),
holds when another namespace or machine took it,
and the refusal states how it judged (`runs-lock-holder.ts`).
Every one of the 96 locks on disk predates the fields and judges as gone by pid,
as the old code did;
all of them come from killed runs,
since every run directory holding an artifact had released its lock.
That fix compared hostnames before boot ids,
and `os.hostname()` can change within one boot (DHCP,
`hostnamectl`),
after which every stale lock on the machine would read as another machine's and hold forever.
Fixed in `25ae252a1` (red guard committed just before it):
a boot id is random per boot,
so equal boot ids prove the same machine,
and the hostname decides only between a later boot here (gone) and another machine (held).
This host's static and kernel hostnames agree today (`bazzite`),
so no lock here met that order.

#### Write order: kept by design

The page is written before the artifact,
because a pass skips an entry once its artifact exists,
so publishing first makes "done implies published" true by construction (`publish-fixed.ts`,
`pass-entry-persist.ts`).
A crash between the two writes leaves a page no artifact records;
none exists among the 214 pages in 372 run directories (a planted page was found,
as a positive control).
The owner then ruled that a run always ships (`doc/design-commitments.md` (moved on 2026-10-18 to
`package/translation-repair/doc/design-commitments.md`)),
so such a page ships and is reported,
never refused.

#### A16b: the verifier exits 1 on findings

Status:
fixed in `354f6bae7` (red guard `bd7c555b7`),
`6898f1768` and `e52de1f23`.
The verifier exits 0 on every finding and 2 only for a run it cannot read,
each finding line names the pass that repairs it,
and a disagreement over an artifact another build settled prints `READ BY ANOTHER BUILD`.
Driving the built CLI for the guard found a further defect:
`publishedEntryIds` listed entry directories,
not page files,
so an entry whose page was gone read as published,
paired as matched,
and printed `REFUSED by Error` instead of `SETTLED AND NEVER PUBLISHED`;
it now lists entries by their page file.
The `DECLINED AND PUBLISHED ANYWAY` line promises that the next pass removes the page,
and a declined entry is never visited again,
so the pass's republish step now removes every page standing for a declined entry (`6898f1768`).
The runbook's expected lines had drifted from the real output (`declined=<n>`,
the closing line's wording)
and now match it;
the three `pass-entry.ts` references (M17) and a fourth,
`artifact-two-lane-project.unit.test.ts` naming it as the artifact builder's only caller,
now name `pass-entry-persist.ts` and `pass-entry-artifact.ts`.
Earlier state,
kept for the record:
Owner,
2026-09-27:
`verify-published` prints every finding and exits 0,
keeping exit 2 for a run it could not read at all.
Its messages also promise what no longer holds once a pass republishes
(`SETTLED AND NEVER PUBLISHED ... A resumed pass skips it`),
and three comments name `pass-entry.ts` as the home of the write order,
which moved to `pass-entry-persist.ts` when that file was split at the line cap.
It also calls a page "disagreed" when only the reader moved:
run over every stored page on 2026-09-27 it reports 77 of 214,
all of them pages that agreed with the build that wrote them (A16c).
Where the artifact's `pipelineDigest` is not the verifier's own build,
a disagreement is today's reading of an older settlement and must say so.

#### A16c: no pass republishes a missing or disagreeing page

Status:
fixed in `3872729e1` (guard `498ddff1b`,
shared fixture `ae21bcbf8`)
and,
for the decline,
`f98b2d87f` (prep `791e23e17`,
red guard `2224ea2d7`).
Before any entry runs,
`pass-republish.ts` judges every settled page with `page-agreement.ts`,
the verifier's own judgement since `2ce0e9f07`,
and `page-republish.ts` re-carves each missing or disagreeing one with the artifact's recipe,
over the archive the artifact stored,
and republishes it;
a moved carve or a publish-time page check leaves the page and logs the class name.
The step sits after the `--plan` return and the build-generation guards.
A decline removes a leftover page before it writes its record.
Over scratch copies of all 214 stored pages:
137 agree,
51 are republished and every one then agrees
(49 differ from the old page only in typography,
2 by a blank line at a seam),
23 are left by the front-matter check,
2 by the destination check and 1 by a corpus read.
A first version spliced into the corpus copy instead of the stored archive;
the census caught it (shihai4h came out 9 characters short,
and 23 carves read as moved),
since the pass reshapes the archive before it carves (`passArchiveText`,
a heading relabel,
`repairArchiveBlocks`).
At the user boundary,
a real `corpus-pass --only mikaela_khara` in a scratch copy of mikaela17 with its page deleted,
nothing pending,
rewrote the page,
spent nothing and exited 0,
and `verify-published` then found 1 of 1 pages carrying every wording at the expected length.
Earlier state,
kept for the record:
Owner,
2026-09-27:
a pass starting in a runs directory rewrites from its artifact any page that is missing
or that differs from what the artifact says ships.
Following from that rule and the archive-note rule,
a decline removes a page an earlier crash left for the entry.
The first answer rested on a count that had only checked pages exist (M18).
The agreement census,
`page-agreement.ts` over the 214 stored pages with the build of 2026-09-27:
137 agree at their weighed length and 77 disagree,
and the extracted verdict matches the old composition on all 214.
None of the 77 predates `c36d597b5` (2026-08-24),
which refuses a disagreeing page before it is written,
so each agreed with its own build.
The would-ship reader applies `restoreTypography` at read time,
and two fixes of 2026-09-26 changed it:
`768408d1d` sets closing punctuation inside a quote (class 181),
`f4adc4c9f` curls a nested quotation as a pair (class 147).
By where each missing wording first departs from its page:
33 only by punctuation the reader now sets inside a closing quote,
20 only by a quote it now curls,
16 by both;
6 carry every wording and are a character long or short,
and 2 depart elsewhere too (a straight double quote,
and one letter).
Told this,
the owner chose again that a pass rewrites such pages to the running build's reading
(`doc/design-commitments.md` (moved on 2026-10-18 to `package/translation-repair/doc/design-commitments.md`)).

### A17: a handle every writer left in Han ships romanised with no literal meaning

Status:
fixed in `7ec9669bd` (red guard `4945f97cd`),
found while fixing T3.
`translate-signer-handle.ts` is a text floor in `validateTranslatedSlice`,
on the parsed and the grammar-free path:
at a signature the original signs in Han,
with no Latin rendering on the aligned archive signature and no declared pair,
a candidate left in Han,
or writing the handle reading with no meaning in parentheses
(letters alone,
so spacing,
capitals and tone marks do not matter),
is sent back naming the reading to gloss.
The Han residue floor (`078939ac7`,
after this entry was filed) already refused Han in prose,
but excused Han the archive also carries,
and asked for no meaning.
Measured over 262 stored artifacts:
45 of the 51 page signers the archive never rendered in Latin
shipped with no meaning anywhere,
shihai4h's runs of 2026-09-26 among them.
Replayed over 671 signature rows the floor refuses 0 of 480 archives,
48 of 670 translate-lane texts,
2 of 480 repair-lane texts and 60 of 670 shipped wordings.
A first census read each signer through `Signature.nameStart` and `nameEnd` as offsets into the slice;
they are offsets into the signature's line,
so it counted 75 of 82 over wrong names
until the floor's own guard failed on the same misreading (M24).

Found as:
The owner's rule of 2026-09-22 is pinyin as one capitalised word with the literal meaning in parentheses
at the first appearance.
`contributor-name-restore.ts` romanises a handle the page left in Han,
and `handle-gloss-place.ts` places only a gloss some writer wrote,
since it cannot invent a meaning;
so when every writer left the handle in Han the page ships the bare pinyin.
No floor refuses a candidate that leaves a handle in Han
(`translate-untranslated.ts` refuses only a whole slice returned untranslated),
so the writers are never asked for the gloss.
The fix belongs at the writers:
a floor naming the declared handle a candidate left in Han.

### A18: the rendering audit rebuilds a carve over the corpus copy, not the archive the run carved

Status:
fixed in `c7f534353` (red guard `83f35d955`),
at the root:
`rebuildPreparation` carves over the archive the artifact stored,
and over the corpus copy only for an artifact written before that text was stored,
so the rendering audit,
`carveSettled` (F-6) and republishing all carve as the run did.
Re-carving all 265 stored artifacts with the fix:
246 reproduce the run's rows and 15 move,
each with a cause already recorded (mikaela15's class 112 slicer change,
TianqiChen666's unrecorded fold,
and the August pairing experiments),
and 4 cannot be read (3 artifacts that do not parse,
1 corpus read);
hulicaijia31 now reproduces.
The A12 guard had stood in for a moved carve with an archive that gained a paragraph,
which the stored archive now overrides;
it now changes the original instead.
Found while fixing A16c.
`readArtifactSubjects` in `rendering-audit-settled-input.ts` reads the archive English at the artifact's commit
and carves over it,
but a pass reshapes the archive before it carves (`passArchiveText`,
a heading relabel,
`repairArchiveBlocks`),
and the artifact stores the text it carved.
The same mistake in the first republish read 23 of 77 stored carves as moved and left shihai4h's page 9 characters short;
carving over the stored archive reproduced all 23.
The audit's own reproduction check reports the moved carves as departures from the run
(hulicaijia's `71 slices rebuilt where the run recorded 72` among them),
so the rendering audit refuses artifacts whose carve it would reproduce.

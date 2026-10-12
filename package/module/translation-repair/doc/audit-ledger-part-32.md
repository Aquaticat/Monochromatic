# Audit ledger, part 32

Part 32 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B154: a contributor label or list item with spaces read the spaces, or the link, as the name

Red in `df0bcb85a`,
fixed in `ba243b3c3`.

Found 2026-10-05 (UTC),
checking B126's fix for the same shape.
`contributorForm` (`contributor-name-authority.ts`) took the text after a list marker as it stood
and the label between `[` and `](` as it stood.
A label of spaces read as the name `" "`,
a padded label as `" Whisker "`,
and a marker followed by two spaces left a space before `[`,
so `*  [Pebble](https://example.test/pebble)` read as its whole markup,
B126's shape again.

The fix:
the spaces after a marker are dropped,
and the label is trimmed,
so a label of spaces is empty and dropped as B126's empty label is.
Three cases hold the three inputs.
A reference link such as `[Whisker][w]` still reads as markup;
only the parse can tell whether it shows as a link.

No cached decision changes,
measured over the pinned corpus with the built package:
a digest of the forms each of 92 entries declares is byte-identical before and after,
and no entry holds an untrimmed or link-carrying form.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse".

### B155: a decisions reply refusal carried an undefined cause, and a mistyped field read as missing

Red in `df0bcb85a`,
fixed in `ba243b3c3`.

Found 2026-10-05 (UTC),
reading the MiMo trial's production diff once the trial was merged.
The trial gave `DecisionReplyShapeError` a `cause`
and passed `{ cause, }` to `Error` whether or not one was supplied,
so every refusal but the parse failure carried an own `cause` of `undefined`.
Beside it,
`readDecisionReplyBody` reported an `answers` that is an array,
or a `model` that is a number,
as missing.

The fix:
the constructor spreads `cause` only when one is supplied,
as `CreditsShapeError` does,
and a present but mistyped field reads `answers is not an object` or `model is not a string`.
The cases assert each refusal's class,
whole message and cause.

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone".

### B156: the listing catch read a fault of the process as a corpus refusal

Red in `df0bcb85a`,
fixed in `ba243b3c3`.

Found 2026-10-05 (UTC),
checking the trial's decision for the owner on `gitOutput` (`corpus-source.ts`,
`33fc7a459`).
The trial wrapped every throwable of the listing call as `CorpusReadError`,
on the reason that nano-spawn's one raw throw is an `options.input` write the call never makes,
and cited a scratch probe.
nano-spawn 2.1.0 also throws raw before any child exists:
`source/options.js` reads `process.cwd()`,
which throws `ENOENT` once the working directory is removed,
and `source/context.js` throws a `TypeError` for a command part that is no string.
Wrapped,
both read as a corpus failure whose message advises a check of the clone.

The fix:
the catch wraps a `SubprocessError` alone and lets anything else propagate as itself,
as it did at `28303c42a`,
so the error's own class and message name the fault;
the comment states the fact and names the nano-spawn files and the case that hold it.
A case removes the working directory under a child process and reads the listing's failure back.
The text and byte readers go through `execFile`,
and with the working directory removed both still read.

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone".

### B157: a heading beside definitions the strict grammar refuses read as unparseable

Red in `49f3ebdbf`,
fixed in `699ad2f8c`.

Found on 2026-10-05 (UTC),
reading the MiMo trial's production diff once the trial was merged.
`inspectParagraph` (`inspect-paragraph.ts`) parses a paragraph twice:
alone,
to decide whether it is exactly one paragraph,
and with the document's definitions appended,
so that its references resolve.
The trial's T8 change (`f8cf67026`) cut the kind half out of the first check,
so that the second `not-one-paragraph` check would run,
and read the paragraph's kind off the definitions parse.
A single block that is no paragraph then reached the definitions parse:
on the build of `22afb6c89`,
a heading beside definitions the strict grammar refuses returned `unparseable`,
where the code at `28303c42a` returned `not-one-paragraph` before the definitions were parsed
(read off the source,
since no build of that commit is kept).
The function's own TSDoc says that question must not be influenced by anything appended to the paragraph.

The fix:
the alone check refuses again a text that is not one paragraph on its own,
as at `28303c42a`.
The second check is a throw whose message opens `unreachable:` and names the block the definitions parse led with:
the definitions are appended after a blank line,
which ends a paragraph,
so they cannot change its first block.
A probe ran forty texts that parse alone as one paragraph against twenty-six definitions shapes,
1040 pairs,
and moved no first block;
joined by one newline instead,
the same pairs moved 116,
setext headings and a table among them.

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone".

### B158: an unavailable deterministic reader recorded as zero characters read

Red in `49f3ebdbf`,
fixed in `699ad2f8c`.

Found on 2026-10-05 (UTC)
by the fourth review of the trial's added cases (its finding F4).
`readImagePair` (`image-reading-pair.ts`) confirms a picture textless where two readers report little or no text,
and wrote the deterministic reader's count into that verdict:
`0` for every deterministic reading that was not `read`.
Where the deterministic reader was unavailable,
the verdict read `{ kind: 'no-text', characters: 0, confirmedBy }`
and the log line said the picture was confirmed textless past the deterministic reader's 0 characters:
a count the deterministic reader never took,
which a reader of the record takes for one it measured.
The trial's case pinned the zero
under a name saying the reader had found none.

The fix:
a second `no-text` shape carries `deterministicUnavailable`,
the reader's reason,
beside the confirming readers,
and no count;
the log line names the reader unavailable with its reason.
The counted shape and its line are unchanged.

The picture store learned the shape in the same commit:
`isPairedReading` (`corpus-run/reading-cache-store.ts`) had accepted a `no-text` record only with a numeric `characters`,
so the new verdict would have been refused on every resume,
with a warning per picture per run,
and its readers asked again on every run;
it now accepts one whose reason is one the deterministic reader gives
and whose confirming readers are names,
and three cases in `reading-cache-store.unit.test.ts` hold it.
Records the unfixed build wrote are not resumed by the fixed one,
since the store's generation is the digest of the built files.

Recurrence:
`mistake-prevention.md`,
"Defaults that stand in for an input":
a reading that failed reaches the verdict as a failure,
never as an empty value.

### B159: a page holding an untokenized link literal made the document parse throw

Red in `4cf768073`,
fixed in `b4030dd01`;
the lead B144 left open.

Found reviewing the B123 fix.
`collectBlockHits` (`footnote-graph.ts`) read the start and end of every `text` node through `nonNullishOrThrow`,
and the autolink-literal transform builds text and link nodes with no position,
so `parseDocument` threw `Expected non-nullish value, got undefined` on `A cat ，www.cat.example naps.`,
with or without a footnote on the page.
`parseDocument` runs on every page the pipeline prepares,
so `prepareDocumentPair`,
`reorderFootnoteDefinitions`,
`footnoteRelabelOf` and `relabelArchiveFootnotes` all threw on such a page:
thirty calls over six pages,
the fixing agent's probe;
the lead measured `parseDocument` throwing on three such pages before the red commit.

The fix:
the graph reads text raw in three shapes,
a positioned text node's span,
an unpositioned run's region through `footnote-unpositioned-runs.ts`,
whose GFM lexemes count only where both brackets fall in text no link separates,
and a tokenized literal's span for full-width markers alone.
A full-width marker counts wherever text shows it,
link text included,
since micromark and the transform both take a glued `〔N〕` into the link
and the graph already counted it there.
The graph no longer reads a GFM shape inside a tokenized literal's URL,
as the marker reader does not.
`computeFindings` moved unchanged to `footnote-graph-findings.ts` as `footnoteGraphFindings`,
since the fix took `footnote-graph.ts` past the line limit.
The fixing agent read every other reader of node positions over 57 modules:
none reads a position off a text or link node,
the two the transform rebuilds.

Measured by the fixing agent:
a differential fuzz over 12,000 generated pages,
under the strict and the plain grammar,
agrees with the B123 oracle and with a decoded-value scan,
while its control perturbed 2,688;
and the 279 Markdown files of the pinned corpus read the same before and after,
none holding an unpositioned node,
so no cached decision moves.

Open when this entry was written,
closed in B181 and B182,
with what B182 leaves open:
an angle autolink under the plain grammar still reads a marker shape in its URL,
since its text starts after the `<` and `isAutolinkLiteral` does not take it for a literal;
and `footnoteMentions` scans raw text,
counting a `[^9` inside a URL as a mention.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse":
a walk that reads positions off phrasing nodes names which node types it reads
and refuses the rest loudly.

### B160: a damage probe that heard too few probers shipped the rewrite

Red in `779c90b3f`,
fixed in `86f7a2efa`.

Left open by the recheck fix of `e0151b92c`,
shown by its agent's probe.
`settleRefinedSlice` (`refine-slice-settle.ts`) rolled a rewrite back on the damage probe's report
only where the screen admitted a claim,
and a probe that heard no prober admits none,
so the rewrite shipped as probed.
Measured on the built package with a scripted bench of three probers:
none heard,
and one heard raising nothing,
each returned `refined: true` and shipped the rewrite,
with `stage-quorum-unmet (introduced-defect-probe 0/3)` or `(introduced-defect-probe 1/3)` among the findings
and no rollback finding.
The settlement failed `everyStageHeard`,
so it was never cached.

The fix:
`refineProbeVerdict` (`refine-probe-verdict.ts`) decides what the probe's report does to the rewrite.
An admitted claim rolls it back under `refine-rolled-back-by-probe`,
worded as before.
A round short of quorum,
read through `silentStagesOf`,
the reader the recheck and the caches use,
rolls it back under `refine-probe-unheard (<heard> of <configured> probers heard)`.
Claims are read first,
since the settler attaches no report to a rollback
and a short round named unheard would drop a claim the screen admitted from every finding;
the short round still shows by the probe stage's own `stage-quorum-unmet` beside it.
A probe outage now rolls back sound rewrites,
uncached,
so a later run buys the slice again;
the package's gates between a new text and a standing one fail closed.
Decided for quality under the owner's standing directive and open to veto;
the alternative reads the quorum first,
as the recheck does.
Cases in `refine-slice-settle.unit.test.ts`:
none heard,
one heard raising nothing,
one heard with an admitted claim,
and two heard,
which ships.

Cache:
no version moved;
a short probe round never reached the cache;
`cache-account-audit` found no slice-cache record under refine version 5.

Recurrence:
`mistake-prevention.md`,
"Which seats a quorum counts":
a gate that ships on "no objection" first reads that enough voices were heard,
through `stage-silence.ts`,
and reads positive evidence before silence wherever a rollback carries no report.

### B161: a recheck that met its quorum passed an issue it cast too few ballots on

Red in `779c90b3f`,
fixed in `86f7a2efa`.

Left open by the same fix.
`retainsResolvedIssues` (`refine-recheck.ts`) read the round's quorum off the checker stage's findings,
but read each issue's verdict from its tally whatever the number of ballots behind it.
A checker heard on the round may skip an issue,
leaving `missing-check (<n>)`.
B215 has since made that finding name the issue by its id,
the checker and the cause.
On a bench of three that met its quorum of two,
two checkers skipping the second of two open issues left one ballot on it,
and the round returned `refine-recheck-passed (2 issues)` and kept the rewrite.
A confirmed issue with one `fixed` ballot read as unresolved under `MIN_RESOLUTION_BALLOTS`
and was named under `refine-rolled-back` as one the rewrite broke.
On a five-seat bench the router left with two reachable seats,
closing on two,
one ballot on an issue passed too.

The fix:
an issue's count is its reading's ballots,
one per heard checker that ruled on it,
compared with the quorum the checker stage closed on:
the bench quorum,
or the quorum in the gather's `stage-short-bench` finding,
matched by rebuilding that finding with `shortBenchStageFinding` and `reachableQuorum` (`checkerQuorumClosedOn`).
B214 replaced that rebuild:
the gather returns the quorum it closed on,
and the recheck reads it.
An issue short of it is named `refine-recheck-unheard (<issue>: <n> ballots, quorum <q>)`,
whatever its ballots say,
and is never read as regressed or worsened;
a heard issue that broke is named beside it under `refine-rolled-back`.
Decided for quality under the owner's standing directive and open to veto.
Such a rollback carries no `stage-quorum-unmet`,
so it is cached as a rollback.
Cases in `refine-recheck.unit.test.ts` hold the count at one and at exactly the quorum,
on the bench of three and on the short bench of five.

Cache:
no version moved;
`cache-account-audit` found no slice-cache record under refine version 5,
the newest written at 04:26 UTC on 2026-09-27.

Recurrence:
`mistake-prevention.md`,
"Which seats a quorum counts":
a per-issue threshold on a gather's ballots takes the quorum the gather closed on.

### B162: a rewrite the atom gate refused left no finding

Red in `779c90b3f`,
fixed in `86f7a2efa`.

Left open by the same fix.
`runRefineStage` (`refine-stage.ts`) logged an atom-gate refusal at info and recorded nothing,
so a rewriter whose every rewrite the gate refused read in the findings as heard and not proposing,
`refine-candidates (1/1 heard, 0 proposing)`,
which is what the stage reports for a rewriter that proposed nothing.
The gate's detail quotes the atoms it compared,
such as `protected atom 1 changed (number:17 became number:18)`,
so it could not enter the findings as it stood.

The fix:
each refused operation leaves `<model>: refine-atom-gate-refused (paragraph <n>, <kind>)`,
the paragraph numbered as the rewriter's sheet numbers it,
as the resolver's findings are,
and the kind cut from the detail at its parenthetical,
as the editor lane groups its rejections by kind (`repair-editor-stage.ts`).
These go into the stage's findings in roster order,
between the resolver's findings and `refine-candidates`.
The detail stays in the log line alone.
The consolidation polish round calls the same stage and gains the same findings.
Two cases in `refine-stage.unit.test.ts` pin the whole result
for a dropped number and for a changed number in a second paragraph,
the second asserting that neither value reaches the findings.

Cache:
no version moved;
only findings are added.

Recurrence:
`mistake-prevention.md`,
"Refusals inside a composed operation":
a refusal is a finding on the stage that refused,
worded without the values it compared.

### B163: three coverage census readers raised the parser's `SyntaxError` where their docs promise their own class

Red in `290110436`,
fixed in `2d5141018`.

Found on 2026-10-05 by the audit of B134,
and confirmed on the build of `e300e6c33`.
`readBaselineCensus` (`corpus-run/coverage-census-input.ts`),
`bundleScriptsOf` (`corpus-run/coverage-file.ts`)
and `readSourceMap` (`corpus-run/coverage-lines.ts`)
each ran `JSON.parse` bare,
while each `@throws` promises its own class for a file that does not read.
Over text cut short each threw `SyntaxError: Unterminated string in JSON at position 22 (line 1 column 23)`,
and over text that is no JSON at all V8's message quoted ten characters of it (the fixing agent's measurement).
The command line reports a class it does not know as a fault in the command,
read off `cli-refusal.ts`,
not run.
`census.json`,
which a later census reads back as its baseline,
was written by a plain `writeFile` in `corpus-run/coverage-census.ts`,
which truncates before it writes.

The fix:
each reader takes the parse failure as data (`parseModelJson`)
and throws its own class with `says: 'it is not JSON'`,
so the refusal names the file and quotes nothing;
`reportCensus` writes `census.json` through `writeFileAtomic`.
`path` and `says` were already named parts of the marker inventory.
Each reader's test file carries a file cut short,
asserting the class and the whole refusal.
The writer has no case:
only the census command reaches it,
and that command runs the whole suite under coverage.

Recurrence:
`mistake-prevention.md`,
"Files a later run reads back".

### B164: a failed atomic write left its temporary file, and two writes of one path in one process shared one

Red in `290110436`,
fixed in `2d5141018`.

Found on 2026-10-05,
the leftover by the audit of B134
and the shared name while fixing it.
`writeFileAtomic` (`corpus-run/atomic-write.ts`) wrote `<path>.<pid>.partial` and renamed it,
and nothing removed that file when either step failed.
A rename refused by a directory standing at the path left the whole temporary file (the fixing agent's measurement),
and a write refused part way under a per-process file-size limit,
standing in for a full disk,
left 8192 bytes of a 65536 byte text (the fixing agent's measurement).
Every reader steps over such a name,
through `directory-listing.ts` and its own suffix filter,
and none relies on finding one,
so nothing was misread;
the files only stayed.
The temporary name was unique to the process and not to the call,
so two writes of one path at once in one process opened the same file:
of 100 such pairs,
100 rejected one write with `ENOENT` at its rename,
and 8 left text at the path that was neither write whole (the fixing agent's measurement).
No production caller was shown to write one path twice at once;
the run queue runs entries one at a time.

The fix:
the temporary name carries the process id and a `randomUUID`,
and a write that fails removes its temporary file before its refusal goes on unchanged;
a removal that fails too is a warning naming the file and the filesystem code.
After it a refused rename and a refused write leave nothing beside the path,
and 100 pairs of writes at once rejected none and tore none (the fixing agent's measurement).
`atomic-write.unit.test.ts` carries the refused rename and the two writes at once.

Recurrence:
`mistake-prevention.md`,
"Files a later run reads back",
with one more clause:
a temporary name is unique to its call,
not to its process.

### B165: a second pass starting while the first claimed its lock took the lock over

Red in `290110436`,
fixed in `2d5141018`.

Found on 2026-10-05 by the audit of B134 as an inference from the code order,
and measured here.
`claim` (`corpus-run/runs-lock.ts`) created `pass.lock` empty with an exclusive open
and wrote the holder into it after,
and `lockRunsDir` takes over a lock it cannot read,
since a pass killed between the two leaves exactly that.
A second starter arriving between the create and the write
read the live holder's empty lock as unreadable,
moved it aside,
claimed its own,
and both passes held the directory:
two starters at once on a fresh directory in one process both acquired it in 28 of 200 rounds (the fixing agent's measurement),
and four starters in 3 of 30 rounds (the fixing agent's measurement).
The module takes no seam to pause a claim,
so the case runs both starters in a child process that replaces `open` and `link` of `node:fs/promises`,
running the second starter to its end inside the first one's claim;
on the build of `e300e6c33` both acquired.

The fix:
the claim writes the holder's text to a name only it knows with an exclusive create
and hard-links that name to `pass.lock`,
which fails with `EEXIST` when anything stands there,
so the claim and the text are one filesystem operation;
the staged name is removed whatever the link answers.
After it no round of two,
four or eight starters ended with more than one holder (the fixing agent's measurement).
A runs directory on a filesystem without hard links now refuses the lock with that filesystem's own error.

Recurrence:
`mistake-prevention.md`,
"Files a later run reads back":
a lock another process may read as abandoned
appears with its content already in it.

### B166: two lookups logged a caught value's own words, which can quote a provider body

Red in `290110436`,
fixed in `2d5141018`.

Found on 2026-10-05 by the audit of B134.
`workTitleLookupLines` (`work-title-lookup.ts`) and `citedReferenceBlock` (`cited-reference-lookup.ts`)
logged `String(error,)` of whatever their per-title and per-page catches caught.
An endpoint body that is not JSON fails `response.json()` with V8's `SyntaxError`,
whose message quotes ten characters of it:
on the build of `e300e6c33` a stub body of cat prose reached both warnings quoted (the fixing agent's measurement).
The package's rule for a logged failure is `refusalText`,
which repeats a message only where its class declares it free of quoted text.

The fix:
both catches log `refusalText` of the caught value,
so a parse failure logs `refused by SyntaxError`
and `CacheFileUnreadableError` still logs its filesystem code and path.
`WorkTitleLookupError` and `CitedReferenceFetchError` forward a message and cannot be marked,
so their status code now logs as the class name alone;
a field or a marked sentence of their own would bring it back.
B180 marks both classes,
and the status is logged again.

Recurrence:
`mistake-prevention.md`,
"Messages a marked class carries".

### B167: a Bedrock ledger line that would not read named the line and not the file

Red in `290110436`,
fixed in `2d5141018`.

Found on 2026-10-05 by the audit of B134.
`BedrockLedgerShapeError` (`bedrock-ledger.ts`) is marked `messageNamesOnly`
and said `Bedrock spend ledger line 2 violated expectations: not valid JSON (SyntaxError)`.
The ledger is repaired by hand,
since a line is never skipped,
and `TRANSLATION_REPAIR_BEDROCK_LEDGER` can move it off its default,
so the refusal did not say which file to open.

The fix:
the class takes the ledger's path and names it before the line,
and every throw site in `entryOf` passes it;
`path` was already a named part of the marker inventory.
The torn-line case in `bedrock-ledger.unit.test.ts` now asserts the whole refusal,
and the case pinning each field's refusal carries each file's path.

Recurrence:
`mistake-prevention.md`,
"Messages a marked class carries":
a marked class names what refused,
and for a file repaired by hand that is the file.

### B168: the persistence guard passed an artifact nothing reviewed, and four cases kept the branch that did it

Red in `8f0d7dd6f`,
fixed in `2e02fbd4e`.

Found on 2026-10-05 (UTC)
by the second review of the trial's added cases (its finding 3).
`assertFinalNaturalnessComplete` (`corpus-run/final-naturalness-completeness.ts`)
opened with a branch for a consolidation that never ran:
it returned without a word where the contest had not run either,
refused a contested body slice as short of the naturalness floor,
and passed contested front matter.
Its syntax map carried an empty arm for a contest that never ran.
No pass builds any of those pairings:
`persistSettledEntry` is the guard's one caller,
`pass-entry.ts` hands it only the result of `settledPageArtifact`,
and `settledEntryArtifact` writes `laneSelection` as `contested` and `consolidation` as `settled`,
literals that `buildSettledTwoLaneArtifact` copies unchanged.
The trial's four cases reached the branch through the cast in `artifactCarrying`,
and one pinned the silent pass:
an artifact whose contest and consolidation never ran,
so with no body slice reviewed,
was accepted,
against a TSDoc saying every absent review other than the two named exemptions fails closed.

The fix:
any pairing other than a contested selection over a settled consolidation throws,
its message opening `unreachable:` and naming both records found and the writer that records them otherwise;
the syntax map reads the contested slices with no second arm.
Narrowing `SettledArtifact` to the one pairing was measured first and set aside
(the fixing agent's measurement):
`buildSettledTwoLaneArtifact` takes the whole unions,
and with its parameters narrowed twenty-eight type errors follow
in five test files and one fixture that build pending artifacts for the readers.
One case replaces the four:
it builds each of the three other pairings through `buildSettledTwoLaneArtifact`,
with no cast,
and asserts the three whole messages.
The front-matter case refuses under `unsafe-baseline`,
the skip a body slice ships with,
so only the front-matter rule can be what refused;
it and the absent-review case assert the class and the whole message.

The same pairing stood in a neighbouring file's fixture.
`declinedArtifact` in `corpus-run/pass-readiness-boundaries.unit.test.ts` built it by cast,
and its case went red under the fix (the fixing agent's measurement);
the fixture now records a settled consolidation whose slice carries no polish,
which the guard refuses with the error the case asserts.

Open to the owner's veto:
the throw in place of a narrowed type.

The same review's other findings changed test files only,
merged in `8f0d7dd6f` and green before the fix and after it:

- `preservation-check.unit.test.ts` asserts the whole verdict for an empty licensed quote,
  where the old assertion held with the guard deleted;
- `corpus-run/probe-relabel-control.unit.test.ts` had two cases that passed under three of four mutants of the gatherer;
  it now holds one case for each of the four rules,
  its header states them as the code has them,
  and its dog fixtures are cat fixtures;
- `corpus-run/canadian-forms.unit.test.ts` refuses a year with its ordinal suffix,
  an input the refusal alone leaves unchanged;
- `coverage-wire.unit.test.ts` refuses two replies under a coverage degree that exists,
  and accepts the reply carrying all three fields;
- `corpus-run/model-catalog-compare.unit.test.ts` asserts the report line for line,
  the whole comparison,
  and both parse refusals whole;
- `grade-sheet-read.unit.test.ts`,
  `model-card-derive.unit.test.ts`,
  `synthetic-quota.unit.test.ts`,
  `synthetic-transport.unit.test.ts` and `resolution-wire.unit.test.ts`
  assert whole values and whole messages where they asserted a fragment or a class,
  and the last feeds a numeric string that the whole-number test alone would pass.

Each rewritten assertion fails under the deletion it names
(the fixing agent's mutant runs,
the gatherer's on rebuilt bundles and the others on type-stripped copies of the source).

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone".

### B169: a pre-grade marking a duplicate had its whole file refused

Red in `8f0d7dd6f`,
fixed in `2e02fbd4e`.

Found on 2026-10-05 (UTC)
by the second review of the trial's added cases (a production observation beside its finding 17).
`KNOWN_VERDICTS` (`grade-agreement.ts`) listed the verdicts a recorded pre-grade may carry,
documented as exactly the verdicts a sheet reader produces.
The list was written in `9ebe41cee` (2026-08-06);
`duplicate` joined `GradeVerdict` in `52fea9e82` (2026-08-12) and the list never gained it,
its `satisfies` clause checking that each listed verdict exists and not that every verdict is listed.
So `parsePreGrades` refused a file holding `"verdict": "duplicate"`
with `pre-grade 1 carries a verdict outside the vocabulary`.
A blind pre-grader does meet such items:
round three's annotated in its notes the same seven repeats the grader marked.
No code writes the file;
an agent writes it by hand,
and `parsePreGrades`,
called by `score-agreement`,
is its one reader.

The fix:
the vocabulary is a record keyed by `GradeVerdict`,
so the compiler refuses a verdict the sheet reader gains and the vocabulary lacks,
and `duplicate` is in it.
`scoreGradeAgreement` is unchanged,
and its TSDoc says what it already did:
an item the human marked duplicate or declined is out of the denominator whatever the pre-grade said,
and a pre-grade's `duplicate` or `unscored` on an item the human scored is a disagreement named in `disagreed`,
so a pre-grader cannot shrink the denominator of the rate that decides whether it may filter a later round.
The red case reads a pre-grade marking a duplicate back whole;
a second case pins the counting over a three-item sheet.

Open to the owner's veto:
counting such a pre-grade as a disagreement,
where leaving the item out of `compared` and reporting it in a field of its own was the other way.

Open when this entry was written,
closed in B227,
whose census found none of them behind its union:
the other values of this package that must name every member of a type declared apart from them.
A search for membership lists read through a string-array cast found eight;
seven define their union,
which therefore cannot gain a member the list lacks,
and `METER_STATES` (`corpus-run/meter-sample-read.ts`) does not,
though it names every member `MeterState` has today.
Lists typed `readonly` over a union declared elsewhere,
and sets built from such lists,
have not been read against their unions.

Prevention:
`mistake-prevention.md`,
"Lists that must name every member of a type".

### B170: a recorded pairing that did not fit its text stopped the rebuild instruments

Red in `5df296c5f`,
fixed in `25c33df4f`.

Found on 2026-10-05 (UTC),
as the item ledger B138 left open.
Since `e71249a76` `blockPairingToSteps` refuses a pair naming a block its section lacks,
and `rebuildPreparation` (`corpus-run/artifact-two-lane-rebuild.ts`) let that `BlockPairingError` out.
`rebuildPage` (`page-republish.ts`) caught it and left the page with the class name alone,
`because=BlockPairingError`;
`carveSettled` and the rendering audit's settled input caught nothing,
so one such artifact would stop the displacement probe and the audit.
On a build of `d233f882f`,
an artifact recording pairs up to translation block 3,
written before the archive was stored,
rebuilt over a corpus copy whose section holds 3 blocks,
threw `BlockPairingError: pairing names translation block 3, and there are 3`
(the fixing agent's probe;
the red case printed the same error on the branch).
The same refusal was worded in two files,
`pair-blocks-wire.ts` and `pair-blocks-steps.ts`.

The fix:
`rebuildPreparation` catches the refusal through `requireBlockPairingRefusal`,
carves the artifact again as one that records no block pairing,
and answers `moved`.
Its detail says that the recorded block pairing does not fit the text carved,
gives the refusal in parentheses (`pairing names translation block 3, and there are 3`),
and says every section's blocks were carved by the deterministic aligner.
A republish then leaves the page and says that sentence;
`carveSettled` returns a carve marked moved,
which the displacement probe warns about and still measures;
the rendering audit answers `refused`,
or `unverifiable` where the section half is unrecorded.
The wording lives once,
in `assertPairsNameBlocks` (`pair-blocks-wire.ts`),
which `readBlockPairing`,
`blockPairingToSteps` and the cache's warm path call.
`parseBlockPairing` gained a comment saying why it bounds no block index:
the record carries no block counts.
The red run printed the `BlockPairingError` for the case
"ANSWERS MOVED IN THE REFUSAL'S WORDS where the recorded block pairing names a translation block the carved text lacks,
and carves every section's blocks by the deterministic aligner instead".

No settled artifact answers differently
(the fixing agent's measurement,
over 466 artifact files under 477 artifacts directories on the audit machine):
268 read as version 2,
249 rebuild as reproduced and 17 as moved on both builds,
and none differs in reproduction,
defaulted halves or carve identity.

Open to the owner's veto:
every section's blocks are carved by the deterministic aligner once one pairing is refused,
since the refusal names no section
and a pairing that misses one section says the text parsed otherwise than the run's.

Open when this entry was written,
closed in B196:
`slice-census-entry.ts` converts a recipe's pairings itself and catches nothing,
so the slice census still stops on such an artifact.

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone".

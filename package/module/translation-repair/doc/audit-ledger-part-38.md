# Audit ledger, part 38

Part 38 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B254: five refusals an operator can mend printed as faults of the command

Fixed in `51ccd8680`,
with their cases.

Found on 2026-10-06 (UTC) by a housekeeping pass over items earlier entries left open.
`HardCapOverrideError` and `RunsDirectoryBusyError` extended `Error`,
so `reportingRefusals` printed "This is a fault in the command" with frames and exited 5,
for a ceiling the operator set and a second pass started beside a live one.
`SourceMapFileError` and `CorpusReadError` did the same,
for a build without a source map and a clone or pin without the commit,
each with a message that already told the operator what to do.
`SheetBindingError` took a finished message that quoted the seed,
the corpus pin and the draw digests read off the sheet and the manifest,
was unmarked,
and printed as a fault.

The fix:
the first four extend `StatedRefusalError`,
messages unchanged,
and print one line at exit 6;
`CorpusReadError` keeps its kind and its cause.
`CoverageFileError` stays a fault,
since the census writes that file itself.
`SheetBindingError` is rebuilt from a closed kind,
a closed sheet label and the two paths the operator named,
is marked,
and is a stated refusal that says to name a pair one draw wrote.
The two scorers pass the paths (`score-probe.ts`,
`score-agreement.ts`).
The case list `OPERATOR_MISTAKES` in `corpus-run/cli-refusal.unit.test.ts` holds each class's printed line and code,
and every case in `sheet-binding.unit.test.ts` asserts the whole message.

The agent's measurement,
not rerun by the lead:
the four classes printed at exit 5 with frames before and at exit 6 with one line after.
Measured by the lead:
38 named test files pass,
with the 37 source scans and a clean type check after a fresh build.
The whole suite ran on `51ccd8680` in a side checkout:
1,629 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 37 source scans passing.

Open to the owner's veto:
the four classes and `SheetBindingError` made stated refusals;
`CoverageFileError` kept a fault;
the binding refusal no longer printing the differing seed,
pin or digests,
which the operator reads in the two files it names.

Recurrence:
`mistake-prevention.md`,
"Two layers reading one refusal".
This closes the six classes B221 left as they were:
five became stated refusals here,
and `CoverageFileError` stays a fault with its reason said.

### B255: a repeated-line finding for an original with no content line read "more than 0 times"

Red in `042a9245d`,
fixed in `51ccd8680`.

Found on 2026-10-06 (UTC),
closing the item B229 left open.
An original holding no content line got the finding "repeats no line more than 0 times",
where the count helper's own contract starts at one.

The fix:
the finding says the original has no line to repeat;
the wording for a line allowed once is unchanged.
One case in `line-structure-guard.unit.test.ts` holds both wordings whole.
On the lead's red tree that file failed with three failure lines,
its new case by an assertion on the finding's words.

Open to the owner's veto:
the "has no line to repeat" wording,
where the count helper throwing on zero is the alternative.

Recurrence:
`mistake-prevention.md`,
"Counts in printed text".

### B256: cases in six test files could not fail on what they named, and two housekeeping leftovers

Tests in `042a9245d`,
housekeeping in `51ccd8680`.

Found on 2026-10-06 (UTC) by the pass B254 records,
over cases earlier entries called weak and a branch that had no steady case.
Each of these passes before and after:

- `refine-wire.unit.test.ts`:
  two cases use cat fixtures and assert the whole operations
  (envelope id,
  base hash,
  new text),
  where they read a length and one id.
- `corpus-name-index.unit.test.ts`:
  three cases assert the whole lines,
  the names and the sorted list of paths asked.
- `provider-router.unit.test.ts`:
  four refusal cases assert the whole message,
  where they read the class alone or a part of it.
- `seeded-error.unit.test.ts`:
  the rebase case asserts the seeded text and the whole applications.
  The case "throws SeedApplicationError on absent and ambiguous needles" is deleted:
  it asserted the class alone,
  and "REFUSES A NEEDLE THE TEXT LACKS" in the same file holds both messages whole (read by the lead).
- `introduced-defect-wire.unit.test.ts`:
  the refusal case sends a region that is the string "1".
  The old input,
  the string "one",
  could not tell the type guard from the integer guard.
- `corpus-run/runs-lock.unit.test.ts`:
  two new cases reach both arms of the lost takeover,
  a rival's lock that reads back and one that does not,
  through a child process that wraps `rename`,
  so the rival's lock appears the instant the stale one is evicted.

The agent's measurements,
not rerun by the lead:
with a guard or a wording of the production code mutated,
each new case fails on its mutant,
and the old files pass the mutants for the router's hold wording and two refusal reasons,
the wire's type guard,
the dropped base hash in two refine cases and the lock's holder arm.

Two leftovers closed in `51ccd8680`.
Nine production files cited a scratch path in a comment;
each now cites the ledger entry or the document holding the figure,
or states the fact without a path,
and a search for the scratch root over production sources returns nothing (the agent's search).
Fifteen names were re-exported twice across the barrels;
the second statement of each is removed (`index.ts`,
`pipeline-barrel.ts`,
`bedrock-barrel.ts`,
`sheet-barrel.ts`),
with 2,885 distinct explicit names and the built index's 1,938 runtime export keys unchanged (the agent's count).

One item of the pass was a false premise.
The lead's brief,
repeating commit `27726ecc0`'s message,
asked about a field `RankedCandidate.issueKey` as written and never read.
That type has no such field at that commit;
the field stands on `KeyedCandidate`,
where the sort of one entry's issues reads it
(B226 records the correction,
posted on `27726ecc0` as commitcomment-203602282).

Open to the owner's veto:
the deleted case;
making the lock's race by wrapping `rename` in a child process;
the barrel deletions.

Recurrence:
`mistake-prevention.md`,
"Guards that cannot fail".

### B257: the parse counted a leading byte order mark as nothing, so every later offset was short

Red in `5abbb9c66`,
fixed in `68df23b05`.

Found on 2026-10-05 (UTC) by an agent's probe of the parse entries.
`micromark` skips a `U+FEFF` that opens its input without counting it,
so every position of the tree sat one character short of the body as written,
and a column on the first line one short as well.
A paragraph after the mark read as text starting with the mark and ending one character before its end:
the envelope's `baseText` lost its last character,
a container's tags and a footnote reference were placed one too early,
and `strictRefusalOffset` named an offset one short.
The mark also opens a body after front matter.

The fix:
`parseMdxBody` and `parseMarkdownBody`,
where the offsets are made,
count the dropped mark into every position:
every node and JSX attribute moves one offset,
and one column on the first line;
the root keeps its start.
`MdxParseError` carries the dropped columns,
so a first-line refusal names its column in the body as written.
The red cases are in the `parse-mdx`,
`parse-document` and `strict-refusal-offset` test files.

The agent's measurement,
not rerun by the lead:
109 positions of two bodies under both grammars,
compared with the mark-free parse shifted by one,
0 wrong.
Measured by the lead on the pinned corpus,
by bytes and with a control on the same test (M128):
none of the 276 Markdown files under `people` opens with a byte order mark;
one archive,
`people/Toka_ls/page.en.md`,
holds three lines that are a lone mark,
which `maskInvisibleLines` blanks before the page is parsed.
Whether any slice of that page is parsed starting at such a line was not measured,
so no real page is known to exercise the leading-mark path.

For B257 to B262 together,
measured by the lead:
136 named test files pass,
with the 37 source scans and a clean type check,
and the slice census over the pinned corpus prints the same sixteen summary lines as before the change
(92 complete pairs,
1 incomplete,
1,259 slices).
The whole suite ran on `68df23b05` in a side checkout:
1,633 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 37 source scans passing.

Open:
a byte order mark before the opening front matter fence leaves the document without front matter
(`front-matter.ts`,
not changed here).

Open to the owner's veto:
a block starts after a leading mark and never holds it.

Recurrence:
`mistake-prevention.md`,
"Offsets and positions":
a parser that drops input without counting it moves every offset it reports,
so the shift is undone where the offsets are made and not in each reader.

### B258: the mention scan read a definition after any indentation, which the graph reads under one grammar only

Red in `5abbb9c66`,
fixed in `68df23b05`.

Found on 2026-10-05 (UTC) by a review of `opensDefinition`,
the rule B212 added.
The scan called `[^1]:` a definition after any leading whitespace.
Strict MDX has no indented code and reads a definition at four spaces or a tab;
plain markdown reads an indented code block,
or a continuation line of a paragraph when no blank line parts the two.
The footnote graph reads the grammar the page is parsed under,
so on a page downgraded to plain markdown the scan and the graph disagreed,
and on any page for a label nested in a list item or in another definition,
which the graph does not read.

The fix:
`fragmentReadingOf` replaces `parsedSpansOf`:
one parse gives the spans and the offsets where the page's own grammar opens a top-level footnote definition,
strict MDX where it accepts the text and plain markdown where it does not,
containers dissolved as the footnote graph dissolves them.
`footnoteMentions` calls a marker a definition only at such an offset.
The definition starts live in the new `footnote-definition-starts.ts`.
Where plain markdown cannot read the text for its nesting,
the line alone decides,
as before.

The agent's measurement,
not rerun by the lead:
over 96 generated pages
(48 fragments,
each read as strict MDX and as plain markdown)
the scan disagreed with the graph on 36 before and on 0 after.

Open to the owner's veto:
a slice is read as strict MDX where the strict grammar accepts it,
an inference from the corpus compiling as MDX and not a measurement of a slice inside a page that downgraded;
passing the page's grammar down from `validateTranslatedSlice` is the fuller fix.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse":
a role a scan gives a marker is asked of the parse the page is read under.

### B259: the destination scan kept the emphasis marks the parse's trail rule sheds

Red in `5abbb9c66`,
fixed in `68df23b05`.

Found on 2026-10-05 (UTC) by comparing the scan with the tree reader on generated texts.
The trail rule of `micromark-extension-gfm-autolink-literal` (`tokenizeTrail`) reads `_`,
`*` and `~` beside the sentence punctuation as no part of an address,
and the scan's `RUN_TRAILERS` held only the punctuation.
`see https://c.example/a_)` therefore named `https://c.example/a_` to the scan
and `https://c.example/a` to the tree reader.
A scanned run was also cut a second time,
without the characters that follow the run.

The fix:
the three marks are trailers,
and `trimDestination` takes where the address ends,
so a scanned run is shed of its trailers and not cut again.

The agent's measurements,
not rerun by the lead:
over 40,000 generated texts of each of two mixes the two readers differed on 1,709 and 2,238 before,
on 2 and 33 with the marks added and the second cut still there,
and on none after;
the tree reader's agreement with the parser's own address did not move.

Open:
the scan does not read the character-reference and bracket forms of the trail rule.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse":
a reader of a destination takes the parse's own trail rule,
and a second reader is measured against the first on generated texts.

### B260: the signer floor, the source quote floor and the archive authority took invisible text for a name or a quote

Red in `5abbb9c66`,
fixed in `68df23b05`.

Found on 2026-10-05 (UTC),
closing the sites B194 left open.
`signerFinding` (`translate-signer-handle.ts`) passed a candidate that signed with `U+200B` or `U+3164`,
since a name with no Latin letters matches no reading and the function answered no finding,
and `signerHandleFindings` let a page signer of the same kind excuse the candidate.
`isArchiveSourceQuoteAnchored` (`archive-block-evidence.ts`) counted invisible characters toward its four code points,
so two ideographs among zero-width spaces anchored a claim.
`nameAuthorities` (`corpus-run/contributor-name-authorities.ts`) took the archive's aligned signature name
with no blank test,
and the restore wrote a zero-width space over the heading naming the signer.

The fix:
each asks `rendersAsNothing`.
The floor refuses a signer that shows nothing,
with the instruction it gives a signer left in Han;
a page signer that shows nothing governs nothing;
the quote counts only what shows;
and an archive signature that shows nothing falls to the page's rendering and then to the pinyin reading.
`archive-block-evidence.ts` had no test file of its own;
with one added,
its line left the allow-list of `own-unit-tests.unit.test.ts` (the lead's edit,
in the red commit so that scan stayed green).

Open to the owner's veto:
the quote floor counts no space either,
so a quote of three ideographs with spaces between them,
which anchored,
no longer does;
the signer floor refuses an invisible signer where assembly would have repaired it to the bare reading.

Recurrence:
`mistake-prevention.md`,
"Text that shows nothing".

### B261: a prior quote of one invisible character dismissed every claim that carried it

Red in `5abbb9c66`,
fixed in `68df23b05`.

Found on 2026-10-05 (UTC),
closing the gap B195 named when it held this key.
`isUsable` of `collectPriorQuotes` (`introduced-defect-screen.ts`)
kept a prior quote that the screen's fold left non-empty,
so a stored issue quoting one `U+200B` or `U+3164` stayed among the prior quotes,
and an added-wording claim whose evidence held that character was counted as restating the issue:
it read `pre-existing` where it was `corroborated`.

The fix:
`isUsable` asks `rendersAsNothing`.
The lead removed the held key `introduced-defect-screen.ts#isUsable` from `blank-text-tests.unit.test.ts`,
its gap closed,
and corrected the returns line of `collectPriorQuotes`,
which still said "blank ones dropped".

Recurrence:
`mistake-prevention.md`,
"Text that shows nothing":
a filter that drops blank text asks the question that names it.

### B262: the container tag readers stepped over fewer whitespace characters than the grammar

Red in `5abbb9c66`,
fixed in `68df23b05`.

Found on 2026-10-05 (UTC) by a review of the masker's space and tab fix (B222),
by the report of the agent that fixed it,
and fixed by the follow-up B222 records as launched on 2026-10-06 (UTC),
closing the note B222 left open.
The masker ended a tag's name at a space or a tab,
and the inline reader at a space,
a tab,
a line feed or a return.
The strict grammar (`micromark-extension-mdx-jsx`,
`unicodeWhitespace`,
the ECMAScript `\s`) steps over twenty-five characters between a name and an attribute or the bracket
(`U+0009` to `U+000D`,
`U+0020`,
`U+00A0`,
`U+1680`,
`U+2000` to `U+200A`,
`U+2028`,
`U+2029`,
`U+202F`,
`U+205F`,
`U+3000` and `U+FEFF`)
and refuses every other,
a zero-width space among them.
So a tag with an ideographic space before its bracket was another element's name,
and a whole element read lone at both its tags.
A tag that crosses a line break was not read as a tag line at all,
and a lone one stayed in the slice for the grammar to refuse.

The fix:
one predicate,
`isTagWhitespace`,
the grammar's twenty-five,
is the whitespace of both readers,
and the masker reads a tag across lines when no blank line parts it and nothing follows its bracket.

The agent's measurement,
not rerun by the lead:
asked of the grammar at run time over thirty-four spellings in five forms,
the masker disagreed on 110 before and on none after.

Open:
a tag name holding a character the grammar refuses is still part of the name.

Open to the owner's veto:
the masker's reading of a tag across lines,
which goes beyond the spellings the review named.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse":
two readers of one construct share one predicate,
and a test asks the grammar for its verdict.

### B263: the page-name glossary gave the first of two renderings as the page's

Red in `76c75dce9`,
fixed in `a6d1fe4f7`.

Found on 2026-10-06 (UTC) by a second census of lookups keyed by text,
over the surfaces the census of B203 did not read:
map writes,
loops that return at a first match,
sets used to drop repeats,
and keys of parsed objects.
`pageNamePairs` (`page-name-glossary.ts`) pairs links,
signatures and headings by the original's text,
and kept the first pair for an original text with a filter that remembered the texts it had met.
The archive renders one original text two ways where a title repeats as two headings
or one name is linked to two addresses,
and the sheet then gave the first rendering as the page's and said nothing of the other.

The fix:
an original text with more than one distinct rendering is left out of the sheet's lines and of `pairedPageNames`,
so the stage that settles repeated titles reads it;
a text every pairing renders alike keeps its first pair.
The lead's edit:
the fix walks the groups once,
where the agent's filter rebuilt a group's renderings for every pair,
with the same result and order.
On the lead's red tree `page-name-glossary.unit.test.ts` failed by an assertion on the sheet's lines.

The agent's count,
not rerun by the lead:
at the pinned corpus,
312 glossary pairs over 92 page pairs hold 310 distinct original texts and none under more than one rendering,
so no sheet changes there.
Measured by the lead for B263 to B265:
26 named test files pass,
with the 38 source scans and a clean type check.
The whole suite ran on `a6d1fe4f7` in a side checkout:
1,634 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 38 source scans passing.

Open:
the contributor-name authorities keep the first signature of a name signed twice
(none at the pin,
by the agent's count).

Open to the owner's veto:
a conflicted text is left out,
where keeping every pairing as its own line or a finding are the alternatives
(the module has no findings channel).

Recurrence:
`mistake-prevention.md`,
"Tables keyed by text".

### B264: one voice naming a footnote-definition pair twice counted as two voices

Red in `76c75dce9`,
fixed in `a6d1fe4f7`.

Found by the census of B263.
`readBlockPairing` (`pair-blocks-wire.ts`) refused a pair repeated next to itself,
and a body pair named again after others steps backwards,
but a footnote-definition pair is outside the order rule,
so a reply could name one again after another pair.
`agreePairs` counts each naming across the voices' pairings as a vote,
so one voice naming a definition pair twice agreed with itself at two votes needed
(the agent's run of the unfixed build).

The fix:
the reader refuses a correspondence named twice anywhere in a reply,
in the words it already used for an adjacent repeat.
Its TSDoc,
which said a translation block may not appear twice against the merge it accepts,
says what it does.
On the lead's red tree `pair-blocks-wire.unit.test.ts` failed because the expected refusal did not come.

Not measured:
whether a live model does this.

Open:
a doubled key in parsed JSON keeps the later value unseen,
which needs a reader aware of repeated keys and is a decision of its own.

Open to the owner's veto:
the repeat is refused in the reader,
which costs a voice that repeats a definition pair,
where counting a pair once per voice is the alternative.

Recurrence:
`mistake-prevention.md`,
"Tables keyed by text".

### B265: no scan held a map write over a key its function never reads

Added in `a6d1fe4f7`.

Found by the census of B263,
which read every two-argument `set` in production code by hand.
Nothing stopped a new one from replacing an earlier value without a word,
the shape of B242 and B263.

The fix:
`blind-map-writes.unit.test.ts` fails a two-argument `set` whose enclosing functions never `get` or `has`
the same key of the same map,
unless an allowance says what makes the key unique,
and an allowance for a write that is gone fails too.
The lead wired it into the `source-scans` task,
which ran 38 files from then,
and edited three allow-list lines for sites that changed after the agent's base:
two writes added
(`rowsBySubject`,
refused through a second map under the same key;
`resolveProberChecks`,
keyed by the own keys of one record)
and one allowance gone stale
(`groupBySlice`,
whose reader now refuses a repeat).

Not reached,
by the agent's account:
a read of the key under another name or in another function passes;
first-match loops,
sets that drop a differing repeat and doubled keys in parsed JSON are not held by a scan.

Open to the owner's veto:
the scan counts a read in any enclosing function as a read.

Recurrence:
`mistake-prevention.md`,
"Tables keyed by text".

### B266: a credential the request sent could leave the transport inside a reply body

Red in `54b3d2535`,
fixed in `a29a9dc42`.

Found on 2026-10-06 (UTC) by the follow-up to the census of B232,
which showed that a provider's reply body reaches `SyntheticHttpError`'s message and `bodyExcerpt`,
the raw reply preview `model-health.ts` prints,
a malformed-completion message and a cached reply.
A provider that echoes the sent `Authorization` value in an authentication failure,
or inside an error event of a 200 stream,
handed the key to every reader of the body.
Nothing measured did this;
nothing proved none did.
The red cases script a reply echoing a stand-in key,
the whole header value and the bare token,
in a failure reply,
in a stream split across two chunks,
and in the partial text of a cut stream.

The fix:
`fetchTransport` masks every credential the request's headers carried out of the assembled reply body
(`maskCredentials`,
new `credential-mask.ts`):
the whole header value and the token after its scheme word,
as written,
as a JSON string holds it and with the slash escaped,
each found in one linear pass with no regular expression built from a key.
A successful reply is masked too,
since an error event can arrive inside a 200 stream,
and so is the partial text a cut stream carries on its error.
The marker is `[masked: credential sent with this request]`;
a secret under 12 UTF-16 units is left alone.

The agent's measurement,
not rerun by the lead:
masking costs about 28 ms per megabyte of body and grows linearly,
a body of repeated prefixes included.
Measured by the lead for B266 to B270:
86 named test files pass,
among them every test file that holds the wording of a lost voice,
a refusal or a provider's excerpt,
and the transport and client suites,
with the 39 source scans and a clean type check.
The whole suite ran on `a29a9dc42` in a side checkout:
1,638 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 39 source scans passing.

Left open at this commit and closed since:
the opening excerpt the stream drain logs (B293),
the listings of the model catalogue and the roster card (B295),
and the two Exa lookups (B300),
each of which read a reply the transport's mask never covered;
and a key in URL-encoded or base64 form,
which the mask did not search for (B329).

Open to the owner's veto:
the minimum of 12 units;
the marker's wording;
masking the cut stream's partial text in the transport.

Recurrence:
`mistake-prevention.md`,
"Messages a marked class carries".

### B267: a request the runtime refused to send reached the lost-voice line as its class alone

Red in `54b3d2535`,
fixed in `a29a9dc42`.

Found by the follow-up B266 records.
After B233 a log line named a `fetch` rejection by class,
so the lost-voice line said `refused by TypeError` for an unreachable network and for an unsendable header alike.

The fix:
the transport catches the rejection where it is raised,
with no abort standing,
and throws the marked `TransportRequestFailedError`,
whose account names the possibilities and picks none,
with the runtime's rejection kept as its `cause`.
An abort passes on unchanged.
The retry ladder retries the new class as it retried the runtime's own rejection,
read by the lead in `transient-retry.ts`:
anything thrown that is not a self-ended stream,
a bound cut or an unretried status is retried.

Recurrence:
`mistake-prevention.md`,
"Messages a marked class carries".

### B268: the provider's own account of a refusal reached no log line

Red in `54b3d2535`,
fixed in `a29a9dc42`.

Found by the follow-up B266 records,
and caused by B233's fix.
`exchangeFailureText` dropped the body excerpt,
and the two comments saying a withheld excerpt stays on `bodyExcerpt` "for the log" were untrue:
nothing logged it.
The only evidence of why a provider refused one request and not another,
a moderation refusal,
a context limit or a data-policy mismatch,
was in no log line.
The red cases throw a `SyntheticHttpError` with a body through each reachable log site and expect the words:
the lost-voice lines of the two stage calls,
the retry line,
the re-ask warning,
the abandoned buy,
the unreadable budget view and a thrown repair,
where the stored record keeps class and status alone.

The fix:
`exchangeFailureLogText` is `exchangeFailureText` followed,
for any provider status failure whose reply excerpt shows a reader something,
by `(the provider said: "<words>")`,
quoted onto one line.
Every site that logs a failed exchange uses it;
every stored record,
finding and thrown message keeps `exchangeFailureText`.
The two comments say where the log reads the field.
A new scan,
`body-excerpt-readers.unit.test.ts`,
holds the field to five named files;
the lead wired it into the `source-scans` task,
which ran 39 files from then.
The lead's edit:
the window trial's refusal line uses the log form,
in a file the agent was told to leave.

Not cased:
no case reaches the log line of `image-reading-pair`,
`required-providers`,
`model-health`,
`coverage-probe`,
the window trial or the three abort-path warnings with a provider status failure.

Open to the owner's veto:
the provider's words printed whole by `model-health`,
where a cut at 300 units stood;
`jsonLine` exported from `resolution-sheet-evidence.ts` for the quoting.

Recurrence:
`mistake-prevention.md`,
"Messages a marked class carries".

### B269: the local picture reader's failure line repeated the tool's output and paths

Red in `54b3d2535`,
fixed in `a29a9dc42`.

Found by the census of B232,
which held the two lines with a note,
and fixed by the follow-up B266 records.
`readImageWithOcr` and `askDeterministicReader` printed the local reader's whole failure text,
which holds the command line,
the scratch paths and standard error,
against their own comment and `decoderFailureLine`.

The fix:
`LocalProgramFailedError` (new `local-program-failure.ts`) states an exit code,
a filesystem code or that the program is missing,
and `readerFailureText` names the class and the code;
the two held entries leave the scan of B237.
The red cases are in the `image-ocr` and `image-reading-pair` test files.

Open to the owner's veto:
`LocalProgramFailedError` for the local reader.

Recurrence:
`mistake-prevention.md`,
"Messages a marked class carries".

### B270: the refusal printer's frames could include a line of the message, and one scan read a property as a use

Red in `54b3d2535`,
fixed in `a29a9dc42`.

Found by the follow-up B266 records.
`framesOf` (`corpus-run/cli-refusal.ts`) kept every stack line starting with `at `,
so a message holding a line break followed by `at ` printed that line of itself among the frames.
`readClause` of `caught-errors-kept.unit.test.ts` counted a property or a key spelled like the binding as a use of it.
The `refusal` parameter of `defectOf` was typed as any `Error` class,
while every caller passes a marked one.

The fix:
the printer cuts the frames off where the stack's header ends;
the scan skips name positions;
and `defectOf` takes only a class that declares its message safe,
so the compiler holds it.

Recurrence:
`mistake-prevention.md`,
"Messages a marked class carries".

### B271: an entry note under a heading with no words named an empty heading

Red in `f18d0b9b1`,
fixed in `b8e30dce2`.

Found on 2026-10-06 (UTC) by the coverage cluster over the library files from a to l (T8).
`commentAnchor` (`entry-notes.ts`) names the heading an editor's comment sits under,
so a sheet working one slice knows which heading "this title" points at.
For a heading that is nothing but its opening marks the name was empty,
and the sheet line read `- ARCHIVE editor comment under heading : <note>`,
as if a word had been dropped.
The agent pinned that line as current behaviour and said it did not endorse it;
the lead rewrote the case to expect that the line says the heading has no words.

The fix:
the line reads `under a heading that has no words`,
asked through `rendersAsNothing`,
so a heading of invisible characters reads the same way.

Measured by the lead:
of 42 named test files on the red tree 41 pass,
and `entry-notes.unit.test.ts` fails by the one assertion meant to fail;
on the fix tree 8 named test files pass,
the note's own among them,
with the 39 source scans and a clean type check.
Not measured:
no page of the pinned corpus was searched for such a heading.

Recurrence:
`mistake-prevention.md`,
"Text that shows nothing".

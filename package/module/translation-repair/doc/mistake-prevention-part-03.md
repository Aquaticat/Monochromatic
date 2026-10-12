# Preventing this package's mistakes, part 03

Part 03 of [Preventing this package's mistakes](mistake-prevention.md),
whose index lists every part in order.

## Copies of shared code

What happened:
helpers were copied rather than imported (three private Han tests and code-point counters,
one with a guard that can never fail),
and two heading readers disagreed about HTML headings (M44,
X20).

Audit area six then found the family package-wide (ledger B1 to B15):
31 groups of function bodies kept in two to
six files,
among them two readings of one event stream,
five span-rewrite appliers under three contracts,
and a benchmark grader whose re-carved slices ran one behind the run's (B10).
Declaring the shared type for one merge duplicated a type another module already exported (M47).
A tuning constant was declared in two files from their first commit,
one copy "mirrored from" the other,
and only the undocumented copy was read,
so retuning the documented one changed nothing (ledger B31).
The rule for what an artifacts directory holds (regular files named `*.json`) was written into two of the directory's readers,
and four others took any name ending `.json`,
so a directory or a symlink named like an artifact became a settled entry;
five more filtered the one lister's names by the suffix again,
four sliced the suffix off by hand,
and ten files spelled the directory's name (ledger B64).
The same lapse sat in the run's other directories:
the ledger report read the atomic writer's temporary files as contests,
a stray file in the published tree raised ENOTDIR out of the verifier,
and the slice cache stopped an entry on a directory named like a slice;
meanwhile B64's own listing result was a copy of one `directory-listing.ts` already had (ledger B65).
Two readers moved into modules of their own for the italic-title pass shipped tested only through their callers,
since the rule asking for their own tests stood under "Text by code point",
where a reader of structure is not looked for (M88).
Two readers of a front matter `alias` disagreed on a list:
one joined its items,
the other read it as another schema and skipped the identity rule (ledger B97).
The package's check that parsed JSON is a record admitted arrays,
and eighteen checks in thirteen files had retyped its test inline rather than calling it,
so the fix to the shared guard reached none of them;
the census of the guard's callers listed none of the copies either,
since it searched by the guard's name (ledger B92).
Test files kept their own copies of three helpers that shared fixtures already held,
under thirteen names,
while each fixture's header said new cases import it;
the duplicate-body scan reads production source alone,
so no copy could fail it (ledger B103).
Hoisting those copies again left lint findings only the moved code met,
orphaned four type imports in their callers,
kept two type assertions the literals never needed,
and left two test helpers nothing called (ledger B115).
The runner tests then held near copies the duplicate-body scan cannot see,
since it groups only bodies that match once comments and spacing are aside:
a census by syntax shape found 111 groups,
41 of them across runner files;
four helpers copied across runner tests moved into fixtures,
and the rest were left with a reason each (ledger B385).
A group left apart says whether its reason comes from a diff or from names alone.
Two briefs of one round touched the same entry files,
one naming `RUN_OUTSIDE_READS` as its item and the other `corpus-pass.ts` as its file,
and neither said which agent owned which statements;
both agents removed the constant and built an `outsideReadsFrom` block in its place,
and the lead found the duplicate at the merge (ledger M144).

The rule:
before writing a helper,
declaring a type or copying a constant,
`rg` the package for its name and for its shape
(for example `rg 'function \w*(codePoint|Han|heading)' src`,
or the field names together) and import what is there.
A copy that must stay separate (an artifact version's frozen rule) says so where it stands,
naming the live copy and the check that compares them.
Code that claims to rebuild what the pipeline built (slices,
sheets,
verdicts) calls the pipeline's own function,
or measures its agreement over the corpus and records the result.
A rule about what a directory holds lives in one module every reader lists through
(`corpus-run/artifact-file-name.ts` for artifacts),
and a new reader of that directory starts from that module;
a name spelled in two files becomes a constant one of them owns
(`runs-layout.ts` for the slice-cache and prompt-payload directories).
Every reader lists through `corpus-run/directory-listing.ts`,
naming the kind of entry its writer makes
(files or directories,
never links),
then filters by the name its writer gives a record,
so a write still under its temporary name is never read.
A helper moved into a module of its own,
or given a second caller,
gets a unit test file of its own in the same change,
with the edges no caller reaches among its cases.
A new reader of a field another reader already reads starts from that reader's shapes,
and where the two must differ,
each says how and why.
A check a shared module owns is called,
never retyped,
and a census of a shared check searches for its shape as well as its name,
in every form the shape is written in (both `===` and `!==`).
A test helper is looked for among the `.test-fixture.ts` files,
by its body's shape as well as its name,
before it is written into a test file.
A fixture's header that says copies remain names where they stand,
and the change that writes that header moves them or queues them in the ledger.
Code moved into a `.test-fixture.ts` file meets the production lint rules there,
not the test-file override,
so the move is linted,
and a patch an agent wrote passes lint,
the source scans and the TSDoc attachment probe before any review of it is trusted
(ledger B111).
A helper that writes a process global moves into a fixture by stubbing through the case's own sandbox,
or,
where it assigns the global directly,
only where the global-writes scan can follow it to its cases:
imported by name,
never through a namespace import or a re-export (ledger B111,
B120).
A caller that passed a local helper to `map` passes a named wrapper once the helper is imported,
since the callback-arity rule reads the parameters of a function declared in the same file only.
A move that leaves a caller without a use for an import removes that import in the same change,
and an assertion a patch keeps because its author could not compile is tried without the assertion
(ledger B115).
A patch an agent cut is merged three-way against the commit the agent read,
recorded when it starts;
a diff it takes against the files as they stand when it finishes cannot show a change it undid,
and every file a commit touched since that start is checked line by line for undone work (ledger B117).
An agent's new case is a claim that the behaviour it pins is right:
before it merges,
each expectation is read against what the code should do,
and a case pinning a defect is held back while the defect is fixed or queued
(ledger B121,
and T8's `stream` cluster,
whose case pinned a frame reader passing a non-object frame on).
Agents working at once each write only the test files of their own modules,
so no two patches touch one file,
and their rules file carries every lint and scan rule a merge has had to fix
(`rules-t8.md` in the session's scratch).
When two briefs touch one production entry file,
the briefs name which agent owns each statement of it,
and the lead merges each patch's red commit before its fix (ledger M144).
A writer moved into a fixture is followed by the global-writes scan to the files importing it by name (ledger B120),
so the env writers it once kept copied have moved into fixtures,
and the list of global-writer copies is gone (ledger B385).
A test's expectation is never the module's own body restated:
it states the result,
or a relation between values the module exports,
so a change to the formula can fail it (ledger B116).
A string a case offers and then looks for is one named constant,
so the two cannot drift apart (ledger B116).

What enforces it:
`src/duplicate-bodies.unit.test.ts` (ledger B19) fails on any function body of 80 or more characters,
comments and the spacing of code aside,
literals compared as written,
kept in two places in the package's source,
its tests or its test fixtures (ledger B116),
in one file or two,
except the frozen copies it lists with their reasons,
and fails when a listed copy no longer stands.
A copy that must stay separate is added to that list in the same change that makes it,
with the reason and the check that compares it.
The shared helpers (`code-points.ts`,
`han-only-text.ts`,
`page-headings.ts`,
`index-pair-list.ts`,
`sse-data-line.ts`,
`corpus-run/span-rewrites.ts`) say so in their headers.
`src/directory-listing-scan.unit.test.ts` (ledger B65),
among the source scans,
fails on any directory-listing import outside `directory-listing.ts` and the walkers it names with why.
`src/record-checks.unit.test.ts` (ledger B92),
among the source scans,
fails on any `typeof` compared with `object` in the package's source outside `isJsonRecord`
and the checks it names with why.
`src/own-unit-tests.unit.test.ts` (ledger B102),
among the source scans,
fails on a production module with neither a unit test of its own nor a line in its allowlist.
`src/unused-imports.unit.test.ts` (ledger B32),
among the source scans,
fails on an import a move left unread.
Habit holds the owner of each statement two briefs share,
and the lead's review at the merge (ledger M144).

## Text by code point

What happened:
scans handed a character test one UTF-16 unit at a time,
and neither half of a character beyond the first plane passes a test for Han,
a letter or case:
a quote's neighbour after a script handle (class ninety-six),
a declared handle in script letters,
an Extension B ideograph in the tokenizer and the Han residue floor,
a Deseret letter beside a Canadian date,
and a pinyin pair over such an ideograph (ledger B22).
Two readings of a cased letter disagreed about script letters,
and eleven fixed-length text cuts could keep half an emoji.
The shared readers shipped tested only through their callers,
and their own tests later found a lone second half counted as nothing
and an opening that dropped a lone first half although no pair was cut.
A benchmark draw broke its ties with `localeCompare`,
so which slices it drew followed the machine's locale,
and a sort of document words compared UTF-16 units (ledger B95).
That fix left 40 argument-less sorts in production source,
and four comparators written `left < right ? -1 : 1`,
which order by UTF-16 unit and never answer zero for equal keys (ledger B122).

One floor was compared with two counts,
a model's reading in UTF-16 units with its spaces
and the deterministic reader's in non-whitespace code points,
so one text was usable as a model's reading and no text as the deterministic reader's (ledger B186).
A constant is compared with one count,
defined beside it.

A picture reading's length was logged in UTF-16 units beside a verdict that counted solid characters,
so fifteen astral letters logged as thirty (ledger B252).
A length printed beside a verdict is counted the way the verdict counted it.

The settled audit printed what a page cites as `characters=` from the text's UTF-16 length,
so a character beyond the first plane counted twice (ledger B389).
A count of characters uses code points,
through `codePointLength` (`code-points.ts`).

The rule:
text is ordered with `compareCodePoints` from `code-points.ts`,
and a list of plain text with `textsInCodePointOrder` from the same file,
never `localeCompare`,
`Intl.Collator`,
the default sort
or a relational operator in a comparator,
and cased with `toLowerCase` and `toUpperCase`,
never their `toLocale` forms.
Numbers order by subtraction.
A code-unit order kept on purpose,
such as canonical JSON's key order,
is named in the scan's exemptions with why.
A test whose domain reaches past the first plane
(Han beyond the unified block,
`\p{L}` or any general category,
case)
takes a whole character:
`for...of` over the text,
or `codePointAt` and `codePointBefore` from `code-points.ts` where the scan keeps UTF-16 offsets,
stepping by the character's length.
A unit read is kept only where every test on it is ASCII or first-plane only,
and a comment says so.
A cased,
capital or small letter is read by general category (`cased-letters.ts`),
never by comparing a character with its case mapping.
A text's opening cut at a fixed length goes through `wholeOpening`.
A guard for such a scan runs its text in a script beyond the first plane
and compares the result with the same text in Latin letters.
A shared reader gets a unit test of its own when it is extracted,
with lone surrogate halves among its cases.
The rule recurred twice in new work on 2026-10-12 (UTC):
the tense detector took a letter to be a character whose cases differ,
read one UTF-16 unit at a time,
so 14 of the corpus's declared aliases could never match (ledger B432);
and the first draft of the repeat-overlap pass weighed text in UTF-16 units (ledger B435).
Any scan that tests a letter or weighs text applies this rule,
not only one that names a script.

What enforces it:
`src/code-points.unit.test.ts` and `src/cased-letters.unit.test.ts` pin the readers themselves,
lone halves included;
`src/fixed-length-cuts.unit.test.ts` fails on any `.slice(0, LIMIT)` or `.slice(-LIMIT)` it does not list with a reason;
`src/locale-orderings.unit.test.ts` fails on any locale-dependent ordering or casing in source or tests,
on an argument-less sort in source outside its named exemptions,
and on a relational operator inside a comparator handed straight to a sort;
the Latin-twin cases in `corpus-run/canadian-forms.unit.test.ts`,
and the script and Extension B cases in the declared-name,
tokenizer,
Han residue and pinyin guards,
fail when a unit read returns.
The settled audit's case on a cited character beyond the first plane fails on a UTF-16 count (ledger B389);
no source scan finds a UTF-16 length printed as a count of characters,
by the names of the scans the `source-scans` task runs,
so elsewhere that is habit.

## Words inside words

What happened:
fixed words and phrases were looked for with a raw substring,
so a glossary term matched inside a longer word
(class one hundred sixty-three,
ledger C1),
"as an ai" read as a refusal inside "as an aide",
"load" read as an inability inside "download",
and a refusal written with a typographic apostrophe matched no marker stored with a straight one (ledger B23).
An address that only began with a source link's was read as that destination kept,
and the neutral pronoun was counted only between listed marks,
so a dash or a slash after han hid it (ledger B23).
The archive review's apparatus labels were matched as raw prefixes,
so "Translation byproducts" read as the "translation by" label,
and the first fix bounded the label with a test of its own rather than `wordStarts` (ledger B81).
Two fixes in that pass nearly regressed:
reading a rendering's destinations through the strict grammar alone went silent
where the grammar refuses the rendering,
which is the validator's no-grammar branch that answers unknown;
and a plain word-boundary reading for the pronoun,
chosen before its tests were read,
would have counted the handles,
paths and addresses those tests exclude.

The rule:
a word or phrase looked for in prose goes through `carriesWord` or `wordStarts` (`word-bounds.ts`),
or through `glossary-match.ts` where the forms are folded,
and the text's quotes are folded with `normalizePunctuation` first
when the needles are stored with straight ones.
A name compared on its letters and digits goes through `carriesName` (`name-projection.ts`),
never containment in a projection,
which has lost the spaces between words;
a handle or a source form inside a link text is matched at handle edges,
where a hyphen and an underscore join.
A word that is never a piece of an address,
a path,
a handle or a compound goes through `tokenStarts` (`word-bounds.ts`).
A label looked for at the start of a line is a start `wordStarts` returns at offset 0,
never a `startsWith`,
and a fix that bounds a match reaches for these readers before writing its own boundary test.
A link destination is read as the grammar reads it,
the skeleton's `link-url` atoms,
never as a substring of the rendering,
and a rendering the strict grammar refuses is read under plain markdown,
never as carrying nothing.
Before narrowing any reading,
read the floor's own tests for the exclusions they pin,
and read the caller's branch for a text the reading cannot parse.
A raw `includes` on prose is kept only for containment,
a quote or a span found whole inside a text,
and a comment says so.
Turning a substring list into a word-bounded one reads,
for each needle,
the words that carry it past their start
(`/usr/share/dict/words` holds them),
and lists on its own each such word that keeps the needle's meaning.

What enforces it:
`word-bounds.unit.test.ts` pins both edges,
the open end,
digits and combining marks,
Han and punctuation edges;
the refusal,
picture-sense and reading-refusal guards hold a word carrying each marker,
a typographic apostrophe,
and each prefixed form listed on its own;
`name-projection.unit.test.ts`,
the survival guard and the link-name guard hold a key inside a longer word,
a case change and a digit inside a handle,
and a handle running on at either end;
`word-bounds.unit.test.ts` pins the token reading's joiners,
its trimmed ends and the mention mark,
and the neutral pronoun guard holds the dashes,
the slash after han and every exclusion;
the unwrapped-link guard holds a longer address
and an unwrap in a rendering whose original is refused too.

## Which fold for which question

What happened:
text written with curly quotation marks on one side
and straight ones,
or English quotes for corner brackets,
on the other was compared byte for byte (ledger B24).
A model's quote of the archive failed to anchor or to verify,
and lost its vote;
a copy of the incumbent with straightened quotes stood on the slate as a second candidate
and split the stake of one wording;
two voices giving one title with different apostrophes split their lexicon votes;
and a title reference apart from its heading only in apostrophe style was reported ambiguous
or rewritten into the other style.
Guillemets,
which English prose never uses,
shipped on one page although a judge named them,
and nothing read them.
A proposal that was the archive with its soft line breaks elsewhere,
which the site renders as spaces,
shipped as a change,
split a slate's stake with the incumbent,
or came back onto a consolidation slate as a lane text,
because each site asked whether it changed anything by bytes,
or by bytes and one rewrap of the base (ledger B26).

The rule:
first say which question the comparison asks.
A model's quote against the document it quotes takes the evidence fold (`normalizePunctuation`),
which also maps the corner brackets,
because a model quoting a Chinese passage paraphrases them.
Two renderings compared as one wording take the typography fold (`straightenQuotes`),
which maps curly and straight only,
because a rendering that kept 「」 is another rendering;
a whole slice,
which may carry code,
takes `straightenProseQuotes`,
which leaves a quote in a code span or a tag as written,
the restoration's own reach.
Whether a proposal changes the wording that stands takes `sameWording`,
which reads both through the wrap,
folds a paragraph's soft line breaks where the line-structure rule does not govern,
and keeps a hard break,
a blank line,
an opening indent and front matter apart;
every site that ships,
demotes,
collapses or offers a text asks it,
and bytes stay only where they are the contract
(assembly,
offsets,
seals,
an artifact's persisted relation).
A key is total:
before one reads text through a parser,
the parser's thrown errors are read and each gets a defined answer,
since a comparison that throws turns a question into a crash (M61).
A title,
a phrase or a document span compared with another document span needs no fold.
Offsets taken in folded text are used only in folded text:
every fold here maps one unit to one unit,
and the comparison states which text its offsets index.
A case fold read back as offsets in the original maps one unit to one unit too:
`lengthKeepingLowerCase` (`corpus-run/archive-name-runs.ts`) lowers a code point only where its lower case keeps the length,
since a whole-text `toLowerCase` grows at an İ,
and a scan that then reads the text past finds nothing on the whole page (ledger B121).
A check written as `.every` over what a scan found holds over nothing,
so it first asks what makes that list empty,
and a scan that gives up returns a refusal its caller must read,
never an empty list.
A mark the pages never use is refused by a floor,
not left to the judges:
a judge who names it does not keep it off the page.
Before folding a site,
measure what the fold would move over the stored records,
with a positive control that must move,
and where the pinned corpus cannot reach the site,
record it as unexposed rather than widen a reading that brings a hazard of its own
(a single-quote pair cuts at an apostrophe;
a wider URL stop cuts an address).

What enforces it:
`quote-normalize.unit.test.ts` pins both folds and the prose reading's code span,
tag and astral characters;
the attestation,
archive-review,
introduced-defect,
Latin title,
lexicon,
slate-collapse and title-reference guards each hold a straight quote against a curly one,
and the guillemet and sheet-leak guards hold the marks,
the exemptions and the editor sheet's marker;
`wording-key.unit.test.ts` pins what the wording key folds and what it keeps apart,
and the slate,
both lane wraps,
the consolidation wrap,
the polish round,
the lane offer,
the repair turn's copy check and the archive block review each hold a layout-only twin;
`archive-name-casing.unit.test.ts` holds a page with an İ that must still veto a name and restore a row.

## Checks on the bytes that ship

What happened:
the translate and consolidation lanes folded invisible variants only when building the slate,
after the publication rule,
the repair turn and the floor had read each answer as the model wrote it (ledger B112).
A line holding only a no-break space is no blank line to the page parser,
so an answer in two paragraphs passed against a one-paragraph page and shipped as two;
a disputed wording written with a non-breaking hyphen passed the disputed-wording check
and stood on the slate as that wording once folded.
The repair lane had folded at its wire readers all along,
and the fold module's header said every lane folded where an answer becomes a candidate,
which was true and was the wrong place.

The rule:
a change made to a model's answer before it ships is made where the lane first holds the answer,
before any check reads it,
so every check reads the bytes that ship.
A step that must change the text after the checks (a wrap)
is held by a test to layout alone,
or the checks run again after it.
A module that says where it is applied names each call site,
and a lane that starts reading a wire adds itself there.

What enforces it:
`translator-answer-fold.unit.test.ts` drives the translate slate,
the consolidation and the repair turn with an answer whose hidden paragraph break only the fold reveals,
and the translate slate with a disputed wording carrying a non-breaking hyphen;
`buildTranslateCandidates` throws `UnfoldedTranslationError` on a voice the fold would still change,
which `translate-candidates-collapse.unit.test.ts` holds.

## Which seats a quorum counts

What happened:
the short-bench rule moved every gather's quorum onto the seats a wet provider serves,
and the archive block review's outage test moved with it,
but the same function's second threshold,
the anchored voices a review needs,
stayed at the whole bench's quorum (ledger B27).
A short bench whose every reachable seat anchored its quote was left unresolved
and skipped its naturalness read.
Two sentences kept saying a short bench cannot settle,
which the rule had made false.
And two short-bench cases refused two seats of four,
which leaves a quorum,
since the quorum is half the bench rounded up;
each failed at its own premise before reaching the stage (M86).
And B80's first case expected one refusal from every roster seat,
where the gather asks a window of quorum plus one,
so it would have failed with the fix in place.

A refinement recheck that heard no checker,
or one of three,
passed the rewrite,
since it rolled back only on a tally saying `worse`
and dropped the checker stage's own `stage-quorum-unmet` finding with the rest (ledger B141).
A gate that passes on nobody objecting first reads,
through the stage's own account,
that enough voices answered,
and carries that stage's findings with its verdict.

The same day the damage probe shipped a rewrite after hearing none or one of three probers (ledger B160),
and the recheck passed an issue that two of three heard checkers skipped,
counting its one ballot against no quorum (ledger B161).
A per-issue threshold on a gather's ballots takes the quorum the gather closed on,
and positive evidence is read before silence wherever a rollback carries no report.

The recheck then took that quorum by rebuilding the gather's short-bench finding
for every count of refused seats and matching its wording,
since nothing else carried the number (ledger B214).
A gather returns the quorum it closed on,
and a reader takes that field,
never a number read back out of a finding or sized a second time.

The damage sample recorded a region no prober answered for as silent,
which is the human grade's negative reference (ledger B298).
No answer is never written down as an answer:
an unheard region is printed as unheard and left off the sheet.

The rule:
when a rule changes what a quorum counts,
census every threshold derived from a gather,
not only the gather:
every `rosterQuorumSize` call,
every "half the bench",
every count compared with a bench size,
and every sentence saying what a short bench can do.
A threshold on voices a gather produced takes the `reachableQuorum` the gather closed on,
computed once and shared by every test in the function;
only a size taken before any seat is lost
(the first round's window)
or the definition of short itself counts the whole bench.
A threshold is a floor a count reaches,
so a case holds the count exactly at it,
or a boundary mutant survives.
A short-bench fixture is sized from `rosterQuorumSize` read in the code:
a bench is short only when fewer seats are reachable than half the bench rounded up.
A case counting what a gather's voices did counts the seats its scripted client was asked,
recorded as each is asked,
never the roster.

What enforces it:
`archive-block-review-stage.unit.test.ts` holds a bench with most seats refused,
asserting from the exported helpers that the case discriminates,
and a count exactly at the quorum;
the gather,
the windowed rounds,
coverage,
the select minimum and the naturalness review each hold a refused seat
(`stage-quorum.unit.test.ts`,
`stage-windowed-rounds.unit.test.ts`,
`coverage-stage-reachable.unit.test.ts`,
`candidate-select.unit.test.ts`,
`absolute-naturalness-review-stage.unit.test.ts`).
`stage-quorum.unit.test.ts` also holds the quorum the gather returns,
on a bench every seat of which answers and on the same bench with most seats refused,
and `repair-edit-stages.unit.test.ts` the same number as the checker stage hands it on.

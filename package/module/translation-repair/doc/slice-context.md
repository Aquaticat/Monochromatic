# Evidence beside a slice

Part of [the package README](../README.md).

## What a slice is judged beside

The repair lane works one slice at a time,
and a slice alone is not always enough to judge itself.

Where the archive carried a passage across a section boundary,
the translation at one slice holds English no original there accounts for,
while the original next door holds Chinese with no English.
A critic shown that slice on its own has only two readings available,
invention and omission,
and both are wrong.
Acting on either damages text that is correct where it actually sits.

So the critic,
the adjudication panel and the editor are each shown the passages on either side of the slice under review,
in their original and in the translation as it stands,
fenced and labelled as context they may not raise claims about or edit.

### One section each way, and no more

The width is measured rather than chosen.
Over the reference corpus,
80 of 1260 slices carry a displacement flag,
those flags form 51 contiguous runs,
the longest run anywhere is three,
and every relocation pair is adjacent.
One section each way therefore covers every case the corpus contains,
and a wider window would cost context on every call to reach material that is not there.

A slice with no neighbour,
meaning a document of one slice,
is shown nothing extra and is asked exactly what it was asked before this existed.

### Removal is allowed only against what the neighbour already carries

The window creates a second way to do harm,
and the editor sheet names it.
Removing a repetition that the neighbouring translation already holds is correct.
Removing anything on the grounds that a neighbour OUGHT to hold it is not,
because the neighbour may never produce it and the document then loses the passage entirely.
Zero occurrences is a worse outcome than two.

### The pages the original cites

The archive's human translators knew things the Chinese page never wrote down,
and wrote some of them in.
Mio's archive says her older sister is also trans;
the Chinese page says only 有一个姐姐,
and the blog the page cites says 「Mio 的姐姐也是 MtF」.
Four critics reported the clause as an addition because the original does not carry it,
the panel supported them,
and the editor deleted a true fact
(class thirty-five,
2026-09-16;
the owner's decision is
[the cited-references decision](../../../../doc/decision/translation-repair-cited-references-2026-09-16.md)).

So every `http` link the original writes is fetched once through the Exa contents endpoint,
4,000 characters of page text each and at most eight per entry,
and every sheet that judges a rendering against the original carries a `CITED REFERENCES, EVIDENCE ONLY` block:
one line per page,
after the pair on the critic sheet,
after the claims on the panel sheet,
and after the candidates on the lane contest,
consolidation writer,
consolidation gate and translate judge sheets
(class thirty-six,
2026-09-16:
Mio20's panel kept the sister clause and the contest voted it out),
with the rule that a detail the translation carries that the original does not state but a cited page does
is accurate detail the translator took from the original's own references,
never an addition,
and that the references never license adding,
never outrank the original,
and never license a defect elsewhere.
The corpus's own site and people's profiles
(a GitHub user,
a twitter handle,
a bilibili space,
a zhihu person)
are never fetched:
they came back as repository names and page chrome.
A page that could not be read is named on the sheet as such.
The log prints `REFERENCE N <url>: success|error, <chars> chars, cached|bought`
and `REFERENCES cited=N cached=K bought=M` once per entry.

The prose rule alone does not hold (class thirty-seven,
2026-09-16:
Mio21's panel supported the sister addition claim 3 to 2 with the references on the sheet,
and four select judges wrote that the detail is true per the cited reference but not stated in the original,
so an addition).
So when the original cites a page,
preparation asks the bench one focused question:
which details the archive rendering states that the original does not but a cited reference does,
each as a verbatim archive quote plus a verbatim reference quote.
Both quotes are checked as substrings with whitespace removed,
items from distinct voices whose archive quotes overlap merge into one detail,
and every verified detail then goes back to the same bench as a numbered yes-or-no candidate
carrying both quotes
(class forty-three,
2026-09-17:
on Mio26 four of five voices answered the open question with an empty list without reading,
and the one verified attestation fell to the quorum);
a candidate at least half the confirming voices name is attested,
and the open question's own quorum decides only when nobody confirms.
Each kept detail becomes a `- attested:` line under the reference lines on every sheet,
both rules name those lines,
and in the repair lane an `accuracy/addition` claim whose archive-side quote overlaps an attested quote
is recorded rejected with an empty tally before the panel and never reaches the editor.
The log prints `ATTESTED heard=H answered=A verified=V needed=N details=D`,
one `ATTESTED item <seat>` line per verified item,
and one `- attested:` line per detail.
The translate writers see the same lines as an `ATTESTED DETAILS` block after the existing translation,
with a rule to carry every one
(`TRANSLATE_ATTESTED_RULE`;
class thirty-nine):
a translate candidate is written from the original,
so without the block it drops the detail by construction
and the lane contest ships without it whenever translate wins.
The refiners,
their judges,
the consolidation polish and its gate see the reference lines and the attested lines too
(class forty-one,
2026-09-17):
the refine stage is the last stage that rewrites a passage,
and on Mio25 it removed a clause the slate gate had just kept,
with its gate calling the clause unsupported,
because neither sheet had the references.
The refine cache key folds them in only where the original cites somewhere.

## Lane texts on the consolidation slate

The consolidation is the retry of a declined contest,
and until class forty (2026-09-17) the retry never saw the two texts the contest was about.
Whenever the standing text is neither contest-endorsed nor admitted by the deterministic publication rule,
each lane's text that passes the rule and is not the standing joins the slate beside the writers' proposals
(`laneTextsForSlate` in `consolidate-lane-offer.ts`).
A lane text carries a `lane` producer,
nobody on the roster owns it as a whole,
and a proposal reproducing it collapses into it with the reproducing model discounted,
as with the incumbent.
The settle key carries the offered lane texts only when any were,
so every other slice keys as before.
The log prints `slice N: lane texts offered on the slate beside the proposals: repair, translate`.

### What this changes about caching

The window is part of the question a slice is asked,
so it is folded into the slice cache key,
with each side labelled so that a source-only window
and a translation-only window carrying the same text cannot collide.
A slice whose neighbours change is asked a new question and is recomputed;
a slice with no neighbours keys exactly as before and resumes.
The cited references join the repair run shape the same way,
only where the original links somewhere,
so the 33 entries of the pinned corpus that cite nothing key exactly as before.

## Lines a line-structured slice owes

A line-structured slice owes one content line per content line of the original,
a shortfall check only,
since English verse legitimately expands.
Since class forty-seven (2026-09-17) a line carrying nothing but quote markers is not content,
and a Han line adjacent to an English line of the original
(Latin letters,
no ideograph)
is owed no line of its own,
because that English line is its rendering:
shi_Yumiaoya's farewell quotes a film line in Chinese with its English beside it,
the archive carries the English once,
and the old count refused every rendering that did not quote it twice.

## Source-only passages and the single admission round

A source-only passage is admitted for insertion after one coverage round,
absent votes corroborated by the whole-page shortfall,
and a passage left unresolved ships as a recorded gap.
Since class forty-eight (2026-09-17) a split verdict carrying no anchored claim of coverage
and at least one absent vote joins the absent rows before the shortfall corroboration:
on shi_Yumiaoya's skeleton archive two seats were asked,
one voted absent,
one quoted the Chinese passage itself,
and the will's paragraph shipped as a silent gap twice.
A split with an anchored claim stays unresolved;
an unanchorable claim is still no vote for absence.

## What the consolidate gate is told about an ineligible standing

Since class fifty-six (2026-09-18) a gate over a standing the deterministic publication rule refused is told so on its sheet,
with the rule's finding and the consequence
(choosing the standing stops the entry with no page),
so that keeping it is not taken for the safe choice.
Every gate ballot is logged with its model,
choice and reason.
A gate that refuses the consolidation at quorum still stops the slice.

## When the consolidation slate ties over an ineligible standing

A consolidation slate whose standing was withheld as ineligible has nothing to keep on a decline,
so since class fifty-five (2026-09-18) it is judged through the translate lane's challenge:
a tie or rejection is re-asked once under `decline-challenge`,
narrowed to the candidates that drew a ballot,
with `translate-declined-retried` and the run-off finding recorded.
A slate over an eligible standing keeps its single round and its standing on a decline.

## When the consolidate gate cannot decide over an ineligible standing

The consolidate gate asks whether the consolidation the slate chose replaces the standing text,
and a round at quorum for neither keeps the standing.
Since class fifty-four (2026-09-18) that fallback applies only to a standing the deterministic publication rule accepts:
over an ineligible standing
(XingZ604's funeral paragraph,
where the archive and the contest winner both left the original's neutral pronoun untranslated)
the consolidation ships with `undecided-gate-ships-proposal` recorded,
because the owner's rule prefers the best valid proposal and the gate refused nothing.
A gate that refuses the consolidation at quorum still stops the slice.

## When a tied slate is challenged as a run-off

A translate slate the judges decline is put to the same panel once more under a distinct responsibility.
Since class fifty-three (2026-09-18) that second round is a run-off when the first was a tie at a slice with nothing to fall back on
(an anchor,
or a content slice whose archive text the deterministic floor refuses):
only the candidates that drew a ballot are offered,
when that is fewer than the slate,
and the findings say so
(`translate-runoff (finalists N of M)`).
A rejection,
fewer than two backed candidates or a fully backed slate leave the whole slate on the second sheet,
and a second tie settles as `no-candidate-backed` as before.

## When a picture's reading may be used

A picture's text reaches the sheets only once two readers agree about it
(trigram overlap at or above the corroboration threshold).
Since class fifty-two (2026-09-17) that agreement is looked for over every pair of readings,
not the first two:
the vision bench has five seats,
and on XingZ601 the two readings the old rule compared stood just under the line
while a third agreed with both.
A reading no other reading vouches for stays out of the corroborated set.

## What a coverage round may count

A source-only passage is admitted or refused by a coverage round,
and since classes fifty and fifty-one (2026-09-17) two things no longer count in it.
A seat the router refused for want of a wet provider is not in the majority's denominator,
since it was never asked and withholds no vote:
shi_Yumiaoya4's round on the death paragraphs read four absent of eight asked with two dark seats
and shipped the passage as a recorded gap on a settled page.
A partial claim whose quote overlaps a target region the pairing assigned to another source slice
is dropped as misattributed,
neither coverage nor a vote for absence,
because that English renders a different original:
the same round's one anchored partial claim quoted the archive's farewell line.
A full claim inside such a region is kept,
since an archive that merged two originals into one paragraph carries the second inside the first's region.

## Explicit breaks under a substitute page block

The deterministic rule owes a candidate the original's explicit line breaks
(Markdown hard breaks or `<br/>`)
where no archive rendering exists to choose otherwise,
since soft newlines render as spaces and a verse without its breaks reads as one paragraph.
Until class forty-two (2026-09-17) that floor keyed on the whole slice's page text,
and a page whose farewell paragraph stands where the original's poem quote stands has text,
so the poem's five breaks were never owed and Mio25 shipped the poem flat.
Now a block kind the page never rendered owes the original's break count for that kind
(`substituteBreakFindings` in `source-only-breaks.ts`),
counted per kind because the candidate carries the page's block beside the original's.
A kind the page did render stays under the page floor.
The same rule refuses a candidate that repeats a Han-carrying original character for character
(`untranslatedFindings`):
on Mio25's first attempt two of four poem candidates were the Chinese returned as it stood,
and the select missed its floor on them twice.
A slice with nothing to translate,
such as a bare link,
returned as it stands still passes.
The same rule refuses a candidate carrying any of the sheets' fence labels
(`WHAT THE PICTURES HERE SAY`,
`EXISTING TRANSLATION`,
`ATTESTED DETAILS`,
`DECLARED NAMES`,
`CITED REFERENCES`,
`LATEST REJECTION`,
`ARCHIVE RENDERING`) that neither the original nor the page carries
(`sheetLeakFindings`,
class forty-four,
2026-09-17):
on Mio27 four of 68 translate candidates had copied the picture transcript under the component,
and the judges chose them as the original's own text.

## Headings at page assembly

A slice holds one heading and nothing in its evidence names another section's,
so a lane can render one section under a heading the archive uses for another
(hulicaijia6,
2026-09-17:
相遇 rendered `## Meeting`,
the archive's heading for 初识),
and every slice floor passes it.
The publish guard refuses such a page for rendering fewer distinct headings than the original,
which on hulicaijia6 came 205 minutes in.
Since class forty-five the page assembly guard reads every heading the page would carry,
and where the original and the archive have the same number of headings,
a page heading repeats another section's,
the original's two headings differ,
and the rendering is not the archive's at that position,
it puts the archive's heading back into that slice's text
(`restoreCollidingHeadings`),
recorded as a page assembly override with a finding.
No archive at the pinned corpus renders two distinct source headings identically,
so the archive's heading is always a distinct fallback.
The publish guard keeps the last word for a page the restoration cannot mend.

## Footnote definitions a slice may carry

A footnote is a relation between slices:
the original defines a note in one slice and refers to it from others.
Since class forty-nine (2026-09-17) the deterministic rule refuses a candidate that defines a note
neither its original passage nor the page slice it replaces defines
(`definitionLeakFindings`),
because a second definition makes the assembly's footnote guard withdraw carriers;
and that guard attributes a doubled definition to the carrier whose original does not define it,
keeping the slice that owns the note.
On shi_Yumiaoya3 the opening section's rendering ended with the note written out,
both carriers were withdrawn,
and the section left the page with its link.

## Links the page owes

The publish check reads every destination the original links to and refuses a page lacking one,
the archive's rendering of it accepted in its place.
Two readers feed it:
the tree reader parses the body as the pipeline does
(front matter split,
invisible lines and HTML comments masked),
and a bare-run scanner walks the text for the two web schemes so front matter and HTML attributes count.
Since class forty-six (2026-09-17) the scanner walks the comment-masked text too:
a link inside an HTML comment is rendered nowhere,
every stage masks comments,
and shi_Yumiaoya1 was refused for a profile link the author had commented out.

## One container's halves

A container whose blocks fall in different slices puts its opening tag at the head of one slice and its closing tag at the foot of another
(`container-extents.ts`;
class nine masks the lone tag so each slice reads on its own).
Since class fifty-seven (2026-09-18) the two slices are known to each other:
`container-half-pairs.ts` reads every slice's source for lone tags and pairs each opening with its closing.
At the insertion admission both halves are admitted once any slice of the container is admitted on its own evidence.
At the translate lane's assembly and at the composed page's,
a half whose partner ships nothing is withheld and named,
so the assembly guard never reads a closing tag with no opening.
On XingZ607 two lone closing tags made the strict parse fail and the guard withdrew all 88 of the lane's slices.

## A definition and its marker

A source-only slice holding footnote definitions is admitted by the whole-page shortfall budget like any other,
and the definitions stand last on a page,
so they are the first passages a spent budget refuses.
Since class fifty-nine (2026-09-19) a definition whose label the standing page or an admitted slice references,
and which nothing on the shipping page defines,
is admitted beside that marker
(`insertion-referenced-definitions.ts`,
finding `insertion-definition-admitted`).
On XingZ608 the budget ran out 80 code points before the definitions
and the translate lane's assembly reverted every carrier of the four markers left without one,
the poem attribution with its link among them.
A definition the admitted slice brings in that no marker on the page references
is trimmed at assembly by class twenty-one's orphan guard.

## A container the archive carries short of blocks

Inside a container both of whose halves the archive carries,
the original's blank-line separated blocks are counted against the archive's
(class sixty-one,
2026-09-19).
When the original writes more,
at least that many of its blocks have no rendering of their own,
and a source-only slice inside the roster found absent is admitted on that deficit,
`insertion-container-deficit-admitted (slice N inside details of slices A to B: the original writes S blocks there, the archive T)`,
in document order while the deficit lasts.
This is what admits an interior omission on a page whose translated part runs long,
where the whole-page budget has nothing to spend.
Equal block counts admit nothing;
a split with an anchored claim is not an absent verdict.

## The untranslated tail

Every source-only slice after the pairing's last agreed pair is the untranslated tail.
Since the owner's decision of 2026-09-19 it is budgeted from the pairing
(`coverage-tail.ts`):
its expectation is its source at the page's own expansion over the paired slices,
and when that expectation exceeds the last agreed pair's whole rendering
the tail cannot have been merged there and every slice in it no majority found carried is admitted on that bound,
`insertion-corroboration (slice N, tail admitted, ...)`.
A split inside the tail is admitted too,
with `insertion-split-in-tail` naming its tallies
(class sixty,
2026-09-19:
three tail slices stayed unresolved on one minority anchored claim);
a verdict a majority carried stays out.
A smaller tail stays with the whole-page budget,
which leaves an admitted tail's source out.
On XingZ60 the tail is slices 89 to 119,
about 5,100 source code points where the whole-page budget had 10,794 for the whole page.

## What is folded out of candidate and archive text at intake

Characters a reader cannot tell from their plain counterpart are folded
where each lane turns an answer into a candidate (`#264`).
Corpus pass applies same fold to archive before preparation,
so incumbent,
candidates,
spans,
artifact and page share visible bytes:
U+2011 to the hyphen,
U+00A0 and U+202F to the space,
and U+00AD,
U+200B,
U+2060 and U+FEFF dropped.
The fold runs before any decider judges,
so the bytes judged are the bytes that ship,
and each fold is a finding,
`invisible-variant-folded (U+2011 x1)`,
in the stage's findings.
Typographic quotes,
dashes and the ellipsis pass through:
measured over every archive page at the pin,
85 of 92 carry typographic quotes and the corpus holds 1173 U+2019,
so those are the archive's own convention.
The 2026-08-26 output reading found the case that motivated this,
a hyphenated word published with a non-breaking hyphen the archive never had.

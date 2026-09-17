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

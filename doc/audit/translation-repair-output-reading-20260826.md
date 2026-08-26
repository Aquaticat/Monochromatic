# Reading the pipeline's actual output (2026-08-26)

Opened on the owner's rejection of the readiness signal: "Not yet. You didn't even look at its actual output."
Every gate that signal rested on was a process gate.
This document is the reading of what the pipeline produces, page by page, against the Chinese source and the
archive English at the pinned corpus commit `a41fc607ea5a70d8a7625cc67d5ed8c444f53379`.
It joins `doc/audit/eight-entries-read-against-the-original.md` (2026-08-20, an older build).
It quotes a rendering only where the wording itself is the defect, under the owner's standing decision that
corpus text in this repository is sanitized once at the end rather than avoided.

## Method

A page is read three ways: the source `page.md`, the archive `page.en.md`, and the published
`<runs dir>/fixed/people/<entry>/page.en.md`, sentence by sentence.
For each change the pipeline made, the question is whether the change is right against the source;
for each sentence it kept, whether keeping it inherited an archive error.
Rendering is read as a reader sees it: grammar, tense, terminology within the page, punctuation characters,
links, front matter untouched.

Two rules for the fresh pass, added at the checkpoint before it:

-   EVERY DEFECT IS TRACED INTO THE ARTIFACT before it is filed. The page cannot say whether a defect was
    inherited or introduced, nor which lane shipped the slice; the settled artifact records the recipe, the
    lane, and the ballots. A defect is filed as "slice N, lane L, ballots said X", which names a mechanism,
    not as "the page says Y", which names a symptom.
-   A SECOND READER. Each fresh page also goes to sol with the three whole files (source, archive, published)
    and one focused question, because this project's own record says agent grading drifts. Disagreements
    between the two readings are findings in their own right.

## Pages read so far, all from builds older than the current one

The newest published pages on disk come from single-entry verification runs of 2026-08-22 and 2026-08-24.
No multi-entry pass has run on the current build; that pass is the next section.

### `gaoyanger` (2026-08-24, generation 4 build)

One paragraph changed. The rendering of "lovely, tender and kind" is closer to the source than the archive's
"pretty", and the second sentence now says what the source says (a single-parent family, poor living conditions,
always strong) where the archive had paraphrased it into being "raised in poverty". Publishable; an improvement.

### `Weideriche_` (2026-08-24 build)

The pronoun fabrication the 2026-08-20 reading found is gone: the page now says she was happy to be called sister,
which is what the source says. Three defects remain:

-   NAME. The first sentence names her by the handle `Weideriche_` where the source prose uses the alias (the
    front matter declares both, `name: Weideriche_` and `alias: Zihe`). The archive used the alias. A memorial
    sentence opening with a handle and a trailing underscore is a reader-facing regression, whatever rule about
    declared names produced it.
-   AMBIGUITY. 伙伴 in the opening sentence became "partner", which in English reads as a romantic partner; the
    archive's "friend" was right. The same word later in the page ("with her partner") is the archive's own
    rendering and is left as it was.
-   TYPOGRAPHY. "non-binary" was written with U+2011 NON-BREAKING HYPHEN rather than the ASCII hyphen the archive
    used. Measured across every published page on disk (14 pages): the characters pages introduce relative to the
    archive are U+2019 (4, in two pages) and U+2011 (1, this page). Nothing normalizes punctuation at assembly.
    MEASURED CORPUS-WIDE at the pin, over all 92 archive `page.en.md` files, before deciding what that means: 85
    pages carry typographic quotes (33 only typographic, 52 mixed with straight, 4 straight only, 3 neither), with
    1173 U+2019, 525 U+201C, 528 U+201D, 228 U+2014 and 86 U+2026 in total; U+2011 occurs 11 times and U+2013 7.
    So a U+2019 the pipeline writes is the archive's own majority convention, not a foreign character, and the
    earlier wording "the archive never used" was true of the pages read and false of the corpus. What remains a
    defect is the narrower class: a character whose difference from its plain counterpart a reader cannot see
    (U+2011 against the hyphen, and by the same reasoning U+00A0 and U+00AD) written where neither source nor
    archive page has it. That class is a normalization, not a house-style question for the owner.
    LANDED IN SOURCE (`8e8b7bd6e`, unbuilt while the arms hold `dist`): `foldInvisibleVariants` in
    `invisible-variants.ts` folds U+2011, U+00A0, U+202F, U+00AD, U+200B, U+2060 and U+FEFF at the point where
    each lane turns an answer into a candidate (edit and refine operations, translate and consolidate
    candidates), before any decider judges, and records `invisible-variant-folded (<code point> xN)` as a
    finding. Typographic quotes, dashes, the ellipsis and the emoji joiner pass through.

Everything else on the page is faithful and in places more faithful than the archive (the added "it could be very
painful" in the quote is gone).

### `wangzihao980` (2026-08-22 build)

-   The opening quotes are rendered more faithfully than the archive (the second one keeps its question).
-   The sentence about the friend's statement kept the archive's wording and with it the archive's loss: the source
    links to the statement and says the friend logged into her account; the page has neither. A source hyperlink
    absent from the output is mechanically checkable and nothing checks it.
-   The page-only translated note (a transcription of an image the source shows) is kept, as the rule requires.
-   The closing sentence is now faithful ("whether you know her or not").

### `dogesir_` (2026-08-22 build)

-   GRAMMAR. The opening sentence is a comma splice ("a very cute sister, her cuteness is evident just from how she
    speaks"); the archive's sentence was grammatical. The pipeline shipped worse English than it inherited.
-   TENSE. "She is also a sister with an exceptional talent" beside "She was also a lover of Minecraft" on the same
    page, about someone who has died. The 2026-08-20 reading recorded tense drift; `#152` made the English the
    authority for tense afterwards; whether the current build still drifts is for the fresh pass.
-   TERMINOLOGY. "the galactic train" and "the Galaxy Train" on one page, beside the quoted title *Night on the
    Galactic Railroad*.
-   The link to the companion's profile, which the archive dropped, is restored from the source.

## Defect classes so far

1.  English quality regressions: comma splices, present tense for the dead.
2.  In-page terminology inconsistency.
3.  Name rendering: handle where the source uses the alias.
4.  Lexical ambiguity introduced by a change (伙伴 as "partner").
5.  Invisible-variant punctuation introduced by models (U+2011 for the hyphen) with no normalization; U+2019 is
    the archive's own majority convention and stays.
6.  Source hyperlinks lost by inheriting an archive sentence.

## The fresh pass on the current build

Planned: `corpus-pass --only` at production defaults (overlap 1, the 180000 ms window) over the six entries of
the 2026-08-20 reading, the two read here, and the hard cases this project's own history names (`Toka_ls`,
whose editor once fabricated three lines; `XIEPT2`, whose pairing once collapsed to zero slices; `XingZ60`,
whose sections once slid by two, if its measured cost allows), into a throwaway runs directory, launched only
after the calibration arms finish (a concurrent run would share provider slots and spoil the band
measurement). Eight short entries alone would answer whether the output is publishable on easy inputs, which
is not the owner's question. Each published page is then read the same way, and the instruments
(`verify-published`, the rendering audit, the damage probe) are run on the same pages so their verdicts can be
compared with the reading.

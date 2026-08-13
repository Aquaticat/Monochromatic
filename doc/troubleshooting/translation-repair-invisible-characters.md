# Invisible characters that change how a document parses

Measured 2026-08-12 against `one-among-us/data` at pin
 `a41fc607ea5a70d8a7625cc67d5ed8c444f53379`,
 92 entries, 184 files.

Two production defects in `@monochromatic-dev/module-translation-repair` came
 from characters nobody can see.
Both were found by accident, one after the other, and each cost a corpus pass.
This census exists so the third one is found by measurement instead.

## The failure shape

A Markdown parser decides where a paragraph ends by finding a BLANK line.
CommonMark counts a line as blank only when it holds nothing but U+0020 and
 U+0009.
Every other whitespace-looking character makes a line NON-blank, so the parser
 reads it as a paragraph continuation and welds the paragraphs either side of it
 into one block.

Nothing downstream can recover from that.
Block counts stop matching between the original and its translation, the two
 sides pair one-to-one until the first weld, and from there every block pairs
 with the wrong one.
The stages that follow are all comparisons, so each one compares the wrong pair
 and reports confidently about it.

## What the corpus actually contains

Every occurrence of fifteen suspicious characters across both sides of all 92
 entries.
Ten files carry any of them:

```text
people/CuspariaKLSY/page.md         IDEOGRAPHIC-SPACE=1
people/Katerina/page.md             NBSP=1
people/MTF_0615/page.en.md          NARROW-NBSP=11
people/Toka_ls/page.en.md           BOM=3
people/XIEPT2/page.md               IDEOGRAPHIC-SPACE=5
people/XingZ60/page.en.md           ZWSP=4
people/Y1Ran/page.en.md             ZWSP=2
people/Y1Ran/page.md                ZWSP=2
people/gqt/page.md                  CR=141
people/republic_o85611/page.en.md   NARROW-NBSP=2
```

Absent entirely:
 U+200C, U+200D, U+2060, U+2028, U+2029, U+00AD, U+180E, U+2007, and TAB.

## Only one file could ever have welded

Presence is not the question.
A character only welds paragraphs when it sits on a line by itself, so each
 occurrence was checked against the line holding it:

-   `Toka_ls/page.en.md` lines 30, 42 and 50 hold a byte-order mark and nothing
    else, each between two ordinary sentences.
    These welded, and this was the defect fixed by `mask-invisible-lines.ts`.
-   Every one of the other 27 occurrences sits INSIDE a line of visible text.
    A zero-width space between two words is a rendering curiosity and nothing
    more, because the line was never going to be blank.

So the weld defect's blast radius across this corpus is three lines in one file,
 and it is closed.
The remaining odd characters are harmless where they sit.

`gqt/page.md` is the separate CRLF defect: its frontmatter closing fence read as
 `---\r`, which matched no closing fence, so the whole document parsed as body
 with a phantom heading. Fixed in `front-matter.ts`.

## Two holes the census proves are unexercised

Neither of these can happen in this corpus.
Both are real, and both are cheap to close now rather than after a corpus grows
 a case.

### A line of non-ASCII space still welds and is not masked

`isInvisibleOnly` tests `character.trim() !== ''` for anything outside its
 invisible set.
U+00A0, U+202F and U+3000 are ECMAScript whitespace, so `trim()` reports them
 empty and the scan skips them without ever setting `sawInvisible`.
A line holding only a non-breaking space is therefore left exactly as it is,
 and it welds paragraphs precisely as a byte-order mark does.

This is the same trap that broke the first draft of the function, one level out:
 there, `trim()` hid U+FEFF from a whitespace-first check; here, it hides the
 non-ASCII spaces from the invisibility check.

### Masking does not know about fenced code

Inside a ``` fence, a line holding a zero-width space is CONTENT.
Blanking it rewrites the document being repaired, which is the one thing a
 length-preserving mask exists to avoid.
No corpus fence contains an invisible-only line, so the fix is provably inert
 here.

## How to re-run the census

Read-only, and it prints no corpus prose beyond the line each hit sits on.
The corpus is UNLICENSED: its content must never be committed, so keep the
 output in `node_modules/.monochromatic/` or a scratch directory.

```bash
# from the corpus clone, at the pin the runtime uses
/usr/bin/git ls-tree -r --name-only "$PIN" -- people | rg '/page(\.en)?\.md$'
```

For each file, count the characters listed in `INVISIBLE_CHARACTERS` plus the
 non-ASCII spaces, and for every hit report whether its line is otherwise blank.
A hit on an otherwise-blank line is a weld; a hit inside visible text is not.

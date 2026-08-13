# Signals the pipeline emits and nobody reads

Measured 2026-08-13 across all 92 entries at pin
 `a41fc607ea5a70d8a7625cc67d5ed8c444f53379`, both sides of each.

`#71` was found because the artifact had been recording
 `alignment structure-mismatch` for weeks and nothing read it.
That is a pattern rather than an incident, so every signal the deterministic
 core emits was censused at once, and the census found a second defect.

## The whole census

```text
PARSE findings, both sides of 92 entries
    95  html-comment-skipped
     3  invisible-line-masked

FOOTNOTE graph findings
    15  unresolved-reference        across 2 files

ALIGNMENT findings
     7  structure-mismatch          across 7 entries
     3  sections-merged
```

## The footnote graph was wrong, and nothing was reading it to notice

10 of those 15 unresolved references were FALSE.
`shihai4h/page.en.md` carries ten references and ten definitions, and a raw
 scan of the text finds every one of them, yet the graph reported
 `definitions: []` and called all ten references unresolved.

Cause: `parseDocument` built the node list from FLATTENED children and the
 footnote graph from the RAW ones.
Every definition in that file sits inside a disclosure container, so
 `flattenContainers` promoted them for the node list while the graph, walking
 the unflattened tree, saw a container where a definition should be.

The same disagreement corrupted identifiers.
`buildFootnoteGraph` names blocks `block/N` by position in the list it walks,
 so every id it emitted after a container named a different block than the one
 the document exposes under that name.

Fixed by flattening once and sharing the result.
After the fix: 5 findings across 1 file, all real.
`XingZ60/page.en.md` carries 5 references and 0 definitions while its Chinese
 side resolves 9 of 9, which is consistent with that translation being
 incomplete.
Corpus totals are 107 references against 102 definitions, and no graph
 identifier names a block that does not exist.

Nothing reads `footnoteGraph` outside `parse-document.ts`, which is why a
 deterministic detector could be wrong about 10 of its 15 outputs without
 anyone noticing.

## The alignment mismatch finding is a false alarm 6 times out of 7

Seven entries emit `structure-mismatch` and take the proportional fallback.
Only ONE of them actually mispairs:

```text
  Aniloviraw    chunks  1/1   equal counts, leading kinds differ   pairs by index
  Hangmster     chunks  1/1   equal counts, leading kinds differ   pairs by index
  interrgned    chunks  5/5   equal counts, leading kinds differ   pairs by index
  noname        chunks  4/4   equal counts, leading kinds differ   pairs by index
  yingying      chunks  1/1   equal counts, leading kinds differ   pairs by index
  XIEPT2        chunks  8/9   counts differ                        pairs by index
  XingZ60       chunks 15/13  counts differ                        SLIDES
```

Five of the seven have EQUAL chunk counts and differ only in the leading node
 kind of the first chunk, which is what the mirrored test also checks; the
 proportional fallback then pairs them by index anyway and no harm is done.
`XIEPT2` has unequal counts and still pairs by index.
Only `XingZ60` slides.

So the blast radius for genuine mispairing is one entry, and this is the right
 way to have established it.
An earlier check used HEADING counts as the proxy and got the right answer for
 the wrong reason: chunk counts are what the aligner compares, and they differ
 from heading counts because content before the first heading forms a chunk.

Anyone gating on `structure-mismatch` would discard six good entries to catch
 one bad one.

## Alignment never drops content

Checked separately, since a merge could in principle leave blocks in no pair:
 across all 92 entries, every block on both sides belongs to some pair.
`XIEPT2`'s extra target chunk is merged rather than lost.

## What still reads nothing

`alignment.findings` is turned into scorecard text and recorded.
`footnoteGraph` is read by nothing at all outside its construction.
Both are deterministic detectors of real defects in the input, computed on
 every entry, and neither reaches any stage that could act on them.
Whether they should is a design question this document does not settle.

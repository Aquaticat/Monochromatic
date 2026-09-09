# The community's words: a corpus glossary, and the archive's rendering weighed on every slate

Decided by the owner on 2026-09-09 ("Corpus glossary file" and "Archive rendering as candidate",
both),
asked with three options after two pages shipped the community's words wrong where the archive had them right:
自切 as `self-harmed by cutting` and `After she began cutting herself`,
where the archive has `attempted self-surgery`;
超天酱 as `Choco-chan` and `Chōten-chan`,
where the archive has `KAngel` of *Needy Streamer Overload*.

## The rule

- `community-glossary.ts`,
    beside the corpus pin (`corpus-source.ts`),
    lists each term,
    the renderings the community accepts (the archive's first) and one line of why.
    Seeded with the two;
    the owner curates it;
    a term the archive got wrong is not entered.
- Terms present in an entry's source are rendered into the entry's identity context under `COMMUNITY TERMS`,
    so every sheet that carries the declared names carries them:
    critics,
    editors,
    refiners,
    translators,
    consolidation producers and every judge.
    The preparation identity hashes the context,
    so a glossary change re-keys the slices that see the term.
- On the sheets where judges compare candidates
    (the select slate,
    the translate slate,
    the lane contest and the consolidation gate),
    a deterministic `COMMUNITY RENDERINGS` block names each candidate whose text lacks every accepted rendering
    where the source carries the term:
    evidence to weigh,
    not a verdict.
    The archive's rendering is the one the glossary records,
    which is how it joins the slate.
    No candidate is barred by the block:
    renderings inflect,
    and the judges decide.

## Options rejected

- Leave it:
    nothing to build,
    and the community's own words ship wrong on a memorial.
- The archive as a whole-text candidate:
    it already sits on every slate that has it
    (the translate incumbent,
    the lane contest,
    the consolidation standing)
    and was chosen against twice for reasons that were not the term;
    the term-level evidence is what was missing.

## What landed

- `community-glossary.ts`:
    `COMMUNITY_GLOSSARY` seeded with the two terms,
    `communityTermsIn`,
    `communityTermLines` for the identity context,
    `communityRenderingDepartures` and `communityRenderingsBlock` for the sheets;
    exported through `sheet-barrel.ts`.
- `document-preparation.ts` appends the `COMMUNITY TERMS` lines to the identity context after the entry notes,
    so the preparation identity re-keys the entries that carry a term and no other.
- `candidate-select-wire.ts` takes `sourceText` and names departures by candidate number after the candidates;
    `candidate-select.ts` threads it,
    and the translate judge,
    both editor selections,
    the refiner selection and the archive-block review pass their original.
    The editor selections' task and criteria moved to `editor-selection-sheet.ts` at the line cap.
- `lane-contest-wire.ts` and `consolidate-gate-wire.ts` add the block after the passages,
    over the archive rendering and the candidates.
- Guards shown to fail on the build before the change:
    `lane-contest-wire.unit.test.ts`,
    `consolidate-gate-wire.unit.test.ts`,
    `document-preparation.unit.test.ts`;
    with them `candidate-select-wire.unit.test.ts` and `community-glossary.unit.test.ts`.

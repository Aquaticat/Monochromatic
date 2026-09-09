# The community's words: a corpus glossary, and the archive's rendering weighed on every slate

Decided by the owner on 2026-09-09 ("Corpus glossary file" and "Archive rendering as candidate",
both),
asked with three options after two pages shipped the community's words wrong where the archive had them right:
自切 as `self-harmed by cutting` and `After she began cutting herself`,
where the archive has `attempted self-surgery`;
超天酱 as `Choco-chan` and `Chōten-chan`,
where the archive has `KAngel` of *Needy Streamer Overload*.

## The rule

- `corpus-run/community-glossary.ts`,
    beside the corpus pin,
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

Recorded here before the build;
the build commit fills this section.

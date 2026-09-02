# Reading the Toka_ls relaunch's output against its source

The fourth item of the owner's R3 order ("code lands verified, calibration seats the roster, four-entry
pass, reading"), done on the one entry that ran to consolidation on 2026-09-02 before the pass was killed:
`Toka_ls` at overlap 2 under the 180 s writer dial and 60 s round window, launcher log
`~/temp/agent/pin-relaunch-Toka_ls-20260902.log`, slice cache
`~/temp/agent/pin-relaunch-20260902/slice-cache/Toka_ls`. No artifact and no page exist (the process was
killed in `settleConsolidation`), so this reads the cache: every translate record, the two consolidation
records, the contest records in aggregate.

## How the reading was assembled

`~/temp/agent/read-cache-20260902.mjs` rebuilds the run's preparation offline with `prepareDocumentPair`
on the three cached block pairings (sections 0, 1 and 2; identity pairs except source block 2 of the last
section, which the roster left unpaired), giving the same sixteen slices the run had. Check: every slice's
archive text equals the incumbent the translate slate carried, except three slices where the archive
carries a U+FEFF on a line of its own (slices 3, 5 and 6; the archive page holds three, the source none)
and the slate's fold of invisible variants dropped it. The output is at
`~/temp/agent/toka-ls-cache-reading-20260902.md`.

Contest choices over the 15 differing slices: translate 9, repair 5, neither 1 (the contest records carry
no slice index, so they are read in aggregate). Consolidation reached slices 0 and 1 before the kill.

## What the pipeline did, slice by slice

- **Slice 0, metadata.** Source `name: 左橋瞳華 / alias: 瞳華 / location: 上海`; archive
  `Toka Sakyo / Nonamev / Shanghai`. Seven translators composed `alias: Toka` (the reading of 瞳華), the
  judges chose it at weight 3.5, the contest chose the repair lane (archive bytes), consolidation proposed
  `Toka` again at 4.5 and the gate kept the standing text six ballots to two on the declared-names rule:
  the source body itself names her 「瞳华」、「Nonamev」, and the archive declares `Nonamev`. Final:
  archive metadata unchanged. Defensible either way; the gate's reasoning is the house rule and the
  reshaped guard now publishes it as `gate-keep`.
- **Slice 1, epigraph and first line.** The translate winner (gemma, five of seven ballots, weight 4.5)
  differs from the archive in exactly two bytes: a trailing space after `>` on the two blank quote lines,
  copied from the source's formatting. A whitespace-only change judged a replacement. Consolidation then
  produced a real edit, "a magical world blossomed for her" for 便为她绽放 (archive "before her"), with the
  blank quote lines normalised back to `>`; the gate shipped it six to three.
- **Slice 2.** Present tense throughout ("brings", "paint", "leave") where the archive mixed "brought"
  with present; adds "in flickering light" for 明灭, which the archive dropped. Better. Weight 2.5, the
  round where GLM-5.3-Flash and minimax-m3 were cut at 60 s.
- **Slice 3.** Restores the source's semicolons, "lively" for 灵动, "makes her way among all things",
  and "Yet deep within the shadows where day and night alternate on the earth's surface" for the archive's
  "where the day and night cycle on the surface of the earth alternates". Drops the stray U+FEFF. Better.
  Weight 5.5.
- **Slice 4.** "sets in the west" for 西沉, "faces the silent cold alone" for 独自面对, present tense
  where the archive had "caressed". Better. Weight 3.
- **Slice 5.** "life has temporarily gone far" for 生命暂时远去 is literal and stiff where the archive's
  "life may be temporarily absent" reads well but adds "may"; "break through the soil and sprout" for
  破土萌发 corrects the archive's "sprout and bloom". Mixed. Weight 7.5.
- **Slice 6.** "burn like lamps" for 如同灯火般燃烧 where the archive had "like flickering flames": more
  literal, less idiomatic. Weight 3.5.
- **Slice 7.** "lets her brushstrokes blossom with light" for 让她的笔触绽放光明: better. Weight 7.5.
- **Slice 8, the description.** Restores the dropped alias 「瞳华」 ("also called “Toka” and “Nonamev”"),
  renders 文气轻靡，文风华丽 as two properties, and fixes the archive's wrong referent ("wishing her a
  bright future" became "wishing a bright future", which is what she wishes the graduates). Better.
  Weight 2.5 with six judges heard.
- **Slice 9.** DEFECT. 偶尔灵感迸发，左右推敲，留下工整的格律 is about her; the archive wrote "I leave a neat
  rhythm" (wrong person) and the winner (Kimi-K3, weight 7.5, near-unanimous) wrote "they leave behind
  verse in neat, well-ordered meter": a plural or indefinite pronoun for a person the page calls "she"
  throughout. The rendering of 格律 as "verse in neat, well-ordered meter" is good. Seven judges passed the
  pronoun.
- **Slice 10.** POLICY GAP. The archive's 《奇妙漂流》（或称「Aiden 的奇幻漂流」） stood as “Life of
  Aiden” (or “Aiden’s Life of Fantasy”), which reads like an established English title; the winner (Qwen,
  3.5) re-rendered it as “Wondrous Voyage” (or “Aiden’s Fantasy Voyage”). The declared-names rule protects
  people, not works; whether a work title in the archive is a declared name is the owner's call. "took up
  writing" for 走上写作之路 is better than "started writing".
- **Slice 11.** "AI image generation" for AI 生图: better than "AI graphics". Weight 4.5.
- **Slice 12, heading.** 绝笔 became "The final writing" (weight 6.5) where the archive had "The final
  chapter"; neither is the idiom ("Last words"). Unidiomatic.
- **Slice 13, the farewell letter.** Restores the closing line the archive dropped (绝笔 as "Last
  words"), "By the time you read this letter, I should have already remained in everyone's memories" for
  在看到这封信的时候, "for so long" for 那么多时候. Better. Copies the source's trailing-space `> ` blank
  quote lines again. Weight 4.
- **Slice 14, source-only.** The archive has no text here; the pipeline adds the death notice: "On the
  afternoon of October 9, 2024, Nonamev wrote this [farewell note](...). At 4:00 p.m., Nonamev passed
  away in Shanghai after emergency treatment for hemorrhagic shock failed, at the age of 26." 瞳华 rendered
  as Nonamev by the declared alias, consistent with the metadata keep. Faithful. This is the most valuable
  slice of the run: content the archive lacked.
- **Slice 15.** `<Sakura count="50" />` kept; every translator reproduced it (`sole-candidate`, incumbent
  matched by seven). The first live matched keep.

## What this says about readiness

- The translate lane improves fidelity on most body slices and adds a missing passage; the consolidation
  gate and the contest do catch over-eager replacements (the metadata). That is the pipeline working.
- Three things reached a winning ballot that a reader would not pass: a wrong pronoun (slice 9, seven of
  seven judges), a re-rendered work title (slice 10), and an unidiomatic heading (slice 12). None is a
  crash or a structural fault; each is a judgment the judges made and a reader disagrees with. A pass that
  publishes these publishes them as the page.
- Byte churn: two slices copy the source's `> ` trailing spaces onto blank quote lines, and slice 1's
  translate "replacement" is nothing but those two spaces, judged five to two over the incumbent. A
  whitespace fold before judging, or on the assembled document, would remove a whole class of no-op
  replacements and the judge rounds spent on them.
- The archive's three U+FEFF characters are removed wherever the translate lane replaced the slice; the
  page would still carry one at any slice the contest gave back to the repair lane.

## Next

The reading is of a run that never published. The same reading on a published page and its artifact,
with the reader script `~/temp/agent/read-artifact-20260902.mjs`, is what a readiness claim needs; the
findings here (pronoun, title, heading, whitespace) are what to look for in it.

# Work titles and established vocabulary

Decided by the owner on 2026-09-02, in answer to the question whether an archive's rendering of a work
title counts as a declared name that translators keep (raised by the Toka_ls reading, slice 10, where
the archive's "Life of Aiden" for 《奇妙漂流》（或称「Aiden 的奇幻漂流」） was re-rendered as "Wondrous
Voyage"). The owner's words:

> If something has an official English translation, use that.
> Some entries contain established vocabulary in footnotes. If that exists, use that.

## The rule

- A work named or alluded to in the ORIGINAL is rendered by its official English title when one exists:
  a published English edition, an official localisation, or a title the work carries in English. This
  includes titles that play on a work's Chinese title: 「Aiden 的奇幻漂流」 reads as a play on 少年 Pi
  的奇幻漂流, whose English title is "Life of Pi", so the archive's "Life of Aiden" follows the official
  title of the work alluded to and the re-rendering was the defect. (The source names 《奇妙漂流》 as a
  work the person created with friends, and the contributor credit names 奇妙漂流 as a contributor, so
  the group may carry its own English name; the rule's first clause covers that too.)
- Where the entry itself establishes vocabulary, in a footnote definition or an editor's HTML comment,
  that vocabulary is used. The archive's own footnote definitions count as established English for the
  same notes.
- Where neither exists, nothing changes: the title is translated like the rest of the passage and kept
  consistent across the page. The archive's rendering is not protected by this rule alone.

## Evidence the rule stands on

Measured over the pinned corpus (`a41fc607ea5a70d8a7625cc67d5ed8c444f53379`, 92 entries) and the
Carena0442 fixture:

- 23 sources carry footnote definitions, 52 definitions in all; 21 archives carry them. Fifteen of the
  definitions carry Latin-script vocabulary: 即 Transcend Lights (XingZ60), 即 Google App Engine
  (hakureico), 《CLANNAD》 (NIGHT81473140), 「Blunt Rotation」 (gqt), CPTSD and DID (LCG_Akiball).
- 17 sources carry HTML comments; yulianNyanner's are a glossary in all but name (波奇酱（后藤一里）：
  Bocchi-chan, 结束乐队：Kessoku Band, 亚托莉：Atri, "这里标题对应的英文词是 dysphoria").
- Archives already render some notes by official titles: "That Time I Got Reincarnated as a Slime",
  "The Unbearable Lightness of Being ... translated by Michael Henry Heim", "Gitanjali No. 60".
- Of tonight's entries, XIEPT2 and Carena0442 carry one source footnote each; Toka_ls and keyword233
  carry none, so the Toka_ls case is decided by the official-title clause alone.

## Mechanism

- The house policy (`src/house-policy.ts`, shared by every sheet) gains a bullet stating the rule with
  the Life of Pi example, so translators, judges, editors and the consolidation gate all read it.
- Preparation collects the source's footnote definitions and HTML comments and the archive's footnote
  definitions into an established-vocabulary block beside the identity context, so a translator working
  one slice sees notes that sit at the end of the page. Footnote definitions are read with the existing
  footnote graph parser (`src/footnote-model.ts` conventions, GFM and full-width bracket); HTML comments
  with one linear scan.
- Nothing is protected by bytes: a judge still decides, with the rule and the notes in front of it.

## What it does not decide

- Titles with no official English rendering and no note: translated, consistent, not protected.
- Names of people: unchanged, the declared-names rule.

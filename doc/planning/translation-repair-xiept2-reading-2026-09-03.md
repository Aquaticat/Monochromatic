# XIEPT2 reading, 2026-09-03

The fourth entry of the owner's R3 order landed on the fifth attempt:
rerun5, launched 02:04 UTC on `4b5c8b438` at overlap 4 into `~/temp/agent/xiept2-rerun5-20260903`,
Hyper the only provider, `TALLY XIEPT2 status=SETTLED` at 04:14 after 129 minutes
(35 slices, 27 translated paragraphs changed, 3 repaired, 13 alignment findings, selection contested).
`verify-published`: 1 of 1 pages carries every wording its artifact promised, at the length it implies.
The page: `~/temp/agent/xiept2-rerun5-20260903/fixed/people/XIEPT2/page.en.md`;
the source: `people/XIEPT2/page.md` at the pinned corpus commit.

## What the run proved about the pacer

- 1,852 successful Hyper calls, 196 cut streams and 40 credit reads went through the rolling-hour pacer;
  it queued 135 times and no call was refused while it held the count at 1,000.
- The only refusals (12 retried, 3 lost) came before 02:39, while rerun4's calls were still inside
  Hyper's window and the pacer's own count stood under 1,000: the launch-timing cost named at launch.
- The rhythm is burst then hold: the first thousand went in 48 minutes, then every call waited until
  the launch burst left the window (02:52 to 03:04), and the same again at 03:52 to 04:04.
  The window is met exactly and the wall clock is what it costs.

## What the page does with the owner's rules

- Cause of death. The obituary block says she "died by suicide on the night of March 30, 2024, in a room
  where she was not being monitored" and drops the ORIGINAL's substance and gas, as the reader-protection
  bullet asks; the second obituary keeps `ending her life by "euthanasia"`, as the owner decided.
  The self-harm line in Shadow reads "she would even hurt herself", the utility knife gone.
- Work titles. 《活着》 is `[*To Live*](https://en.wikipedia.org/wiki/To_Live_(novel))`, the official
  English title with the link the archive's editor comment asked for. 《不安》 is `*Unease*`, italic, per
  the editor comment that it is not a known work; the web lookup offered "Disquiet" and a judge cited
  the comment over the lookup, which is the precedence the title rule states.
  The lookup ran for both titles (2 titles, 10 context lines) and its cache holds the results.
- Notes as vocabulary. Bed Wars, WER, Kizuna AI, Violet Evergarden, Saizeriya, Tsim Sha Tsui Ferry
  Pier, Star Ferry, Central, MTR, Bank of China and Café de Coral all follow the archive's comments.
- Perspective. The translation hint (author's voice and Grape's voice alternate; "Grape" sometimes names
  the earlier personality) is respected: the Future section's "And I will remember all these little
  moments" keeps the first person the ORIGINAL uses, and Xiafeng's obituary block stays in her voice.

## Findings for the owner

- The postscript line reads "She changed into her last light-colored dress, and in the dark of night took
  medication and breathed in gas." The obituary block dropped both, this line kept both in generic words.
  Whether "breathed in gas" passes the replicability test (no substance, no dose, but a method) is a
  policy reading; the page is inconsistent with itself either way.
- The archive's placeholder `(To-Do)` stands as the first paragraph of the page, ahead of the
  translation hint. It is the archive stub's own body (the only pinned English page that has one) and
  the pass keeps archive paragraphs by design. Proposed fix: a placeholder-only archive paragraph is not
  a block to keep. Not built; the owner may prefer to edit the stub.
- The archive's gloss of 大证 became an inline appositive: "the big certificate Grape had longed for day
  and night — the formal diagnosis of gender dysphoria, the kind written without a question mark — had
  finally been issued." The comment is vocabulary, but the page inserts the explanation into the author's
  sentence rather than a footnote. WER's expansion is inline the same way. Placement of glosses is an
  open choice.
- Shape. Semantic wrap is applied per slice and skipped on line-structured slices, so the page
  alternates between one-clause-per-line paragraphs and single-line paragraphs section by section.
- Seats. 196 cut streams, 16 of 17 translate-select rounds losing Qwen3.8-27B: the seat drop of
  `4ad08d5dc` reaches the next launch, not this page.

## Regression checks

- Names: Xiaoqing (小青), Shenyang (屾洋, the archive notes the reading), Xiaoshe (小舍), Gu Yi (古一),
  Danpian for the friend's handle with the profile link kept, Shayu Xiliye for the contributor.
- Front matter unchanged from the stub: `Xiafeng Grape`, alias `Grape`, `Guangdong, China`.
- The poems and the scheduled-message block keep their line structure; the footnote on 走书 survives
  as `[^1]` with the archive's gloss.
- No unfilled passage and no silent wording.

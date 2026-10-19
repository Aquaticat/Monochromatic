# OpenRouter and the corpus passes: 2026-10-19

What was launched,
read and decided on 2026-10-19.
Entries:
zheermao14,
CuspariaKLSY16,
CuspariaKLSY17.

Part of [Translation repair: OpenRouter as the paid fallback provider](translation-repair-openrouter-2026-09-03.md),
which lists every file of this record.

## zheermao14 read, 2026-10-19, 17:00 UTC: SETTLED in 77.9 min of pass; no class

zheermao14 was the first entry of the readiness rotation the owner chose that day,
one entry at a time over the read set.
It launched at 15:42 UTC at `9c130e74a6` through the runbook's unit form into a fresh runs directory,
with `--only zheermao101`,
on pipeline `sha256-tree-v1:a92725968adf…` (`START ... files=3`),
built by the worktree's `rolldown v1.2.13`.
It settled in 4,673,785 ms of pass
(`TALLY zheermao101 status=SETTLED slices=15 repairStatus=repaired ... selection=contested`),
and the unit ended at about 17:00 UTC with `Result=success` and exit status 0.
`verify-published` read the page back:
1 of 1 page carries every wording its artifact promised,
at the length it implies
(`wordings=15 silent=0 chars=5878=expected missing=0 consistency-groups=0 read-at-generation=19`).
`DESTINATIONS zheermao101 source=2 page=3 dropped=0`,
no `DEFECTS` line,
no `[error]` line,
and 225 `warn` lines.
The refusal vocabulary of the seven steps finds nothing:
no floor refusal,
no `REATTEMPT`,
no `STALLED`,
no `mdx-downgraded`,
no `StreamOverrunError`,
no error finish.

### Seats and meters

Three Gemma seats were dark:
`gemma-4-26b-a4b-it` and `google.gemma-4-e2b` threw on all four asks each,
and `google.gemma-4-31b` on all three,
each opening with `SEAT CREDENTIAL REFUSED ... HTTP 401`
(`SEATS DARK: 3 of 12 seats asked produced nothing usable this run`).
The owner will not top up Bedrock,
so the rotation runs without them.
The other nine seats answered every ask;
Qwen3.8-27B had 11 replies abandoned at the straggler deadline and Kimi-K3 2.
The meters read every provider wet in all 52 readings.
Synthetic's weekly budget fell from 86.76% to 75.88%,
Hyper from 250 to 212,
OpenRouter from 22.12 to 22.00 USD,
and Bedrock stayed at 5.02 USD.
The spend report prices the metered seats at 54.69 credits
and OpenRouter at 0.1136 USD;
the `cost=` fields sum to the same 0.1136.
Synthetic's weekly meter is the account's,
so the 10.9 points are an upper bound on this run's share.

### Where the wall clock went

zheermao12 and zheermao13 settled this entry in 21.6 and 21.0 minutes on 2026-09-24 and 2026-09-25,
and the two-lane cost run of 2026-08-17 in 65.3;
what moved the time between those builds and this one was not measured.
By lane the slices summed 63.6 min of repair,
21.0 of translate and 59.7 of consolidation,
which overlap in the pass.
Rounds waited 1.92 h after quorum,
60.8% of round time;
calls in flight averaged 4.14 and peaked at 20.

### The page

Read beside the source and the archive,
all three open:

- Front matter equal to the archive's,
  2 headings as the archive,
  no Han,
  no TA,
  no double blank line,
  no dash.
- The three straight apostrophes after a letter are the `PhotoScroll` path literals,
  as in the archive;
  every apostrophe in prose is curly,
  and every ellipsis is three dots
  (6 on the page,
  7 in the archive,
  no U+2026).
- Canadian spelling:
  "favourite" twice,
  where the archive writes "favorite".
- The opening quote renders 奶茶 as "milk tea",
  where the archive has "beverages";
  `desc` keeps the archive's wording by the front-matter rule.
- The reply sentence reads "One Among Us members saw it and sent her a reply that same night:",
  plural and 连夜 carried,
  and the later paragraph "One Among Us members contacted her on Telegram".
  The pass warned `introduced repetition in slices 9, 11 (archive 0, shipped 2): "One Among Us members"`;
  the source repeats 那些秋叶的成员 in both,
  so the repetition is the original's.
- Labels one line each:
  "English translation of the letter from Arts:"
  and "English translation of this email conversation:".
- The email's sentence the archive left as a translator's note
  (`{/* 可以避开黑暗的锋芒，到那些有光的地方躲一躲。 这句不知道如何翻译 */}`)
  is translated:
  "you can slip past the darkness’s edge and take shelter where there is light."
  The note is gone with the gap it named.
- Two `>   > ` blank lines in the email end in a space.
  One is the archive's own;
  the other separates the closing line "Wishing you the blessings of spring.",
  which the archive lacks,
  and copies the archive's form byte for byte.
- The galgame title reads *Mystery Lover 2:
  Forgotten Truth*,
  where the archive writes *Mystery Lover 2*.
  The run's title lookup,
  cached since 2026-09-19,
  carries VNDB `v36674` with one English release under that title,
  two indienova pages giving it,
  and the Nintendo Hong Kong eShop listing English;
  the Steam release has no English.
  The lead first called the subtitle invented from the Steam page alone,
  and retracted it on reading the lookup
  (M279 in the package's audit ledger).
- Narration of her life is in the past tense throughout;
  the letter and the email,
  written to her while she lived,
  keep theirs.

Slices 0,
5 and 11 were archive-disputed:
the repair lane's adjudicators accepted 3,
2 and 3 accuracy claims against the archive's rendering,
so the repair text stood in (classes one hundred seven and one hundred seventy-six).
Slice 11's refine was rolled back by its probe
(`refine-rolled-back-by-probe (1 added-damage and 0 removal claims admitted against the rewrite)`).
No class.

## CuspariaKLSY16 stopped at its START line, 2026-10-19, 17:07 UTC: a different build

CuspariaKLSY16 launched at 17:06 UTC at `2eeef91fac`.
Between `9c130e74a6` and that commit no family source changed:
the merges brought the KaTeX removal and `main`'s auto-mode,
Depot and `mise.toml` changes.
Its `START` line read `pipeline=sha256-tree-v1:475fbdbb…`,
not the rotation's `a92725968adf…`,
and the unit was stopped after five `SPEND` lines.
The build had run `rolldown v1.2.14`,
the main checkout's,
because the launch passed the session shell's whole `PATH`
(M278 in the package's audit ledger);
the worktree's lockfile installs `1.2.13`.
The two bundles differ only where the bundler wraps CommonJS modules.
Nothing from this run is read.

## CuspariaKLSY17 launched, 2026-10-19, 17:09 UTC

CuspariaKLSY17 launched at 17:09 UTC at `2eeef91fac`,
with `--only CuspariaKLSY`,
into a fresh runs directory,
with the main-checkout entries removed from `PATH`
and the worktree's `node_modules/.bin` first.
Its build ran `rolldown v1.2.13`,
and `START` read `pipeline=sha256-tree-v1:a92725968adf…`,
the rotation's build.

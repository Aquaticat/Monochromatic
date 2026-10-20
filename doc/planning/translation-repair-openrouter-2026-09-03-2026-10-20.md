# OpenRouter and the corpus passes: 2026-10-20

What was read and decided on 2026-10-20.
Entries:
XingZ6015,
zheermao15.

Part of [Translation repair: OpenRouter as the paid fallback provider](translation-repair-openrouter-2026-09-03.md),
which lists every file of this record.

## XingZ6015 read, 2026-10-20, 00:40 UTC: SETTLED in 351.0 min of pass; five classes, and the rotation on this build ends

XingZ6015 was the third entry of the readiness rotation the owner chose on 2026-10-19,
launched at 18:14 UTC on pipeline `sha256-tree-v1:a92725968adf…`
([the launch](translation-repair-openrouter-2026-09-03-2026-10-19.md#xingz6015-launched-2026-10-19-1814-utc)).
It settled in 21,057,457 ms of pass
(`TALLY XingZ60 status=SETTLED slices=119 repairStatus=repaired ... repairAccepted=331 ... alignmentFindings=29 selection=contested`),
and the unit ended at about 00:05 UTC with `Result=success` and exit status 0.
`verify-published` read the page back:
1 of 1 page carries every wording its artifact promised
(`wordings=119 silent=0 chars=49489/expected 49426+separators missing=0 consistency-groups=1 read-at-generation=19`).
`DESTINATIONS XingZ60 source=2 page=2 dropped=0`,
no `DEFECTS` line,
no `[error]` line,
and 4525 `warn` lines.
No `REATTEMPT`,
`STALLED`,
`mdx-downgraded`,
`StreamOverrunError`
or error finish.

### Seats and meters

Three Gemma seats were dark on `SEAT CREDENTIAL REFUSED ... HTTP 401`,
as in the two earlier reads of the rotation.
Hyper ran dry at 22:18 UTC and Synthetic's weekly allowance at 22:22 UTC,
so from then on `glm-5.3`,
`hf:Qwen/Qwen3.8-27B` and `hf:moonshotai/Kimi-K3` were out of reach:
`glm-5.3` threw on 602 of its 725 asks and Qwen on 832,
with 112 more abandoned.
Across 281 readings Synthetic's weekly meter fell from 71.52% to 0%,
Hyper from 193 to 0,
OpenRouter from 21.92 to 16.13 USD,
and Bedrock stayed at 5.02 USD.
The spend report prices the metered seats at 278.87 credits and OpenRouter at 5.7961 USD.
The contest and consolidation lanes ran on 3 of 7 seats
(`lane-contest: closed on a short bench, 3 of 7 seats within reach, quorum 2 of 4`),
which is what an OpenRouter-only roster gives.

### Where the wall clock went

1919 rounds over 21.96 h of round time,
11.92 h of it (54.3%) waiting after quorum;
calls in flight averaged 5.77 and peaked at 20.
Lanes ran repair 18:39 to 22:32 UTC,
translate 22:32 to 23:05 UTC,
contest 23:05 to 23:09 UTC,
and consolidation 23:09 UTC to 00:05 UTC on 2026-10-20.

### The page

A Sonnet reader read all 1175 lines beside the original and the archive
(notes in `~/temp/agent/x15-read/notes.md`),
and the lead checked every finding this section records against the artifact and the run log
(`~/temp/agent/x15-read/classes.md`).
The page is complete where the archive stops at its own "Under Construction" mark,
defines all nine footnotes the original has (the archive defines none),
renders the original's TA as "they" and wing's 他 as "he",
and corrects several archive errors ("maimai DX",
坐牢 as "like doing time",
亚撒西).
No TA,
no Han outside one HTML comment,
no US spelling,
front matter equal to the archive's.

Five classes,
each fixed before the next launch:

- A consolidation kept an archive wording every judge rejected.
  At slice 45 every contest ballot called the archive flawed and split three ways;
  in the consolidation two judges chose the lane wording with "they" and called the archive's "he" and "sir" ineligible,
  the third declined every candidate,
  and the leader's weight of 1.5 fell short of the minimum of 2.00,
  so `keeping the fallback` shipped the archive.
  Slice 34 reached a deciding run-off on the same opening and is not this class:
  its gate then kept the standing on a 2 to 1 vote.
- The declared-name floor read a swap between two declared names as a lost name.
  At slice 80 both lanes' fixes,
  12 accepted issues among them a major tense one,
  were refused because the archive's "XingZ60" became "Lili",
  her declared alias and the rendering of the original's 璃璃
  (`translate-refused-declared-name (slice 80: archive text carries "XingZ60" and the replacement does not; keeping the archive text)`);
  once more at slice 15.
- The page pass dropped the original's section numbers.
  Both lanes rendered 其一 to 其十 as "Part One" to "Part Ten",
  the contest chose the numbered headings and the repair panel accepted the missing number as an omission,
  and `heading-series-unified` rewrote nine of them to the archive's bare style,
  under the rule class eighty-nine set on 2026-09-23.
- Contest judges chose a lane for keeping a hidden translators' note.
  At slice 6 all three judges chose the repair wording because it kept the archive's
  `<!-- 前面这句中文懂什么意思，先这么翻译，大家看一下 -->`,
  calling it page apparatus,
  over a cleaner translate wording.
  Ten English archives carry Han inside comments,
  `mikaela_khara` and `shi_Yumiaoya` among them.
- The archive's "unfinished" banners shipped on a complete page.
  `**Come back later!**`,
  `[!Warning] This version is NOT the formal version ...` and
  `[!Caution] This is an unfinished version ...` are the archive's,
  not the original's,
  and the archive-block review kept them as a notice about the page's own status.
  XingZ60 is the only archive in the corpus with such a notice.

One question went to the owner,
and the answer changes a house rule.
The page opens with her own words,
所以说我甚至可以去含着氰化钾胶囊做一些事情,
about doing dangerous things with a cyanide capsule on hand;
it is not how she died,
and the archive keeps the capsule.
Two of three contest judges chose the repair wording,
"do something knowing that it could cost me my life",
citing reader protection.
Asked at about 00:36 UTC whether reader protection covers a suicide means mentioned outside the account of the death or an attempt,
the owner chose "Only the death":
"Scope the rule to how she died or attempted,
so her quote keeps the cyanide capsule as the original and the archive have it."

Meaning errors of single renderings,
not classes:
footnote 9 renders the fan work 《罗德岛理工大学开学第一课》 as the "Rhode Island School of Design",
where the title lookup returned only pages about that school and one gate judge took them as support;
the Lu Xun quote at the Blank section takes the wrong subject;
胡蝶 became a person "Hu Die";
翻车 is rendered three ways;
several sentences about her stay in the present tense,
slice 11 among them,
where the contest's tense candidates fired on all three texts and none was in the past.
The pass log carries them so the next read can tell a recurrence.

Two reader findings did not hold.
"One Among Us" for 那些秋叶 is right,
since 那些秋叶 is the site's own Chinese name (seven corpus pages use it so),
and the archive's "autumn leaves" is the error.
And slice 34,
which the reader counted among the archive pastes,
shipped the archive by its gate's vote.

### What follows

The rotation on `a92725968adf…` ends here:
two reads with no class,
zheermao14 and CuspariaKLSY17,
then XingZ6015 with five,
so the record of three no-class reads on one build stands.
`yingying` was not launched.
The five classes and the owner's ruling are being fixed in five worktrees (`w210` to `w214`);
once they land with their cache versions bumped,
the branch worktree moves to the fixed build
and the rotation restarts from its first entry.

## zheermao15 read, 2026-10-20, 13:20 UTC: SETTLED in 46.0 min of pass; one class, and its fix is in progress

The restarted rotation began with the entry `zheermao101`,
launched as `zheermao15` at 02:12 UTC on 2026-10-20,
on tip `0c64519b57…` and pipeline `sha256-tree-v1:c003a383075f…`
(the unit `corpus-pass-corpus-pass-zheermao15`;
the handover section "Where the work stands" names the launch).
It settled in 2,759,820 ms of pass,
and the `DONE` line reads `elapsed=2759940ms`,
which is 46.0 min:
`TALLY zheermao101 status=SETTLED slices=15 repairStatus=unchanged ... translateChanged=11 documentsDiffer=11
pageChanged=9 pageSilent=0 alignmentFindings=13 selection=contested`.
The repair lane changed nothing (`repairChanged=0`,
29 issues,
21 accepted,
none resolved),
the translate lane changed 11 of the 15 slices,
and the page pass changed 9.
`DESTINATIONS zheermao101 source=2 page=3 dropped=0`,
and the publish wrote 15 slices into a page of 6026 characters.
The log holds 569 `warn` lines,
no `[error]` line,
no `DEFECTS` line,
and none of `REATTEMPT`,
`STALLED`,
`mdx-downgraded` or `StreamOverrunError`.
It holds no `verify-published` line either,
so this read did not rest on that read-back.

### Seats and meters

Three Gemma seats were dark on `SEAT CREDENTIAL REFUSED ... HTTP 401` (Bedrock's token had expired),
as in the earlier reads of the rotation:
`gemma-4-26b-a4b-it` and `google.gemma-4-e2b` threw on all 4 asks and `google.gemma-4-31b` on all 3.
`glm-5.3` threw on all 4 of its asks,
since every provider serving it was out of budget (Hyper was dry at launch).
Synthetic's weekly meter read 2% at 02:12 UTC and 0% at 02:40 UTC,
in repair slice 4.
From then on `hf:moonshotai/Kimi-K3` and `hf:Qwen/Qwen3.8-27B` threw
with "no provider can take ...:
every provider serving this model is out of budget,
seat unreachable":
Kimi threw on 56 of its 82 asks (26 usable),
and Qwen on 138 of 162 (24 usable).
The seats that threw nothing were `minimax-m3`,
`inception/mercury-2.5`,
`deepseek-v4.1-flash`,
`hf:zai-org/GLM-5.3-Flash`,
`typesafe/jev-1.13` and `xiaomi/mimo-v2.6-flash`.
From the translate lane at 02:47 UTC the roster was 8 with Kimi withheld,
and the absolute-naturalness review of consolidation slice 12 closed on a short bench
(3 of 7 seats within reach,
quorum 2 of 4).
The run ended with `SEATS DARK: 4 of 12 seats asked produced nothing usable`
(the three Gemma seats and `glm-5.3`).
OpenRouter read 16.11 USD at launch and 15.53 USD at the last meter reading,
02:58 UTC.

### The page

The lead read the shipped page (`fixed/people/zheermao101/page.en.md` of the run) beside the original and the archive,
and checked the letter and the email against the three photos of the page
(photos 1 and 2 are the letter,
photo 3 is the email and its reply).
Both renderings were faithful;
the email's "If I manage to die" is 如果成功死去了 in the photo.
The check is the lead's reading of the photos;
this entry records it and did not re-run it.

Two things in the page read as defects and are not,
and each has a source:

- The front matter `desc`,
  "Treat you to some beverages.",
  is the archive's,
  and `desc` stays frozen.
  `doc/decision/translation-repair-front-matter-guard.md` lets the archive's front matter stand,
  since a rewritten `desc` is an editorial change nobody asked for.
- "Zheermao tried to end her life several times" is the wording the house rule sets for a survived attempt.
  `package/translation-repair/house-rule/src/house-policy.ts` (line 87) says the page
  "says that she attempted suicide or tried to end her life,
  never by what means".

One class,
in the email block.
The archive's rendering of the reply from One Among Us carries a note between translators on the line the page renders as
"You can avoid the darkness’s sharpest edges and take shelter for a while in places where there is light":
`{/* 可以避开黑暗的锋芒，到那些有光的地方躲一躲。 这句不知道如何翻译 */}`.
The pinned archive holds that note once;
the shipped page and the run's artifact do not hold it.
The owner confirmed on 2026-10-20 that the page keeps such notes (B698,
"Keep the notes (Recommended)"),
so the loss is a defect.
The cause is the order of two steps.
The archive block review replaced the archive's email block before the lanes ran,
with a revised rendering (the artifact's `preparation.archiveText` reads "Arts is also a kitty"
where the pinned archive reads "Arts is also a cat-like person"),
and the revised block has no note.
The page assembly carries a note back by comparing the page with `preparation.archiveText`
(`archive-note-carry.ts`,
since `a3a7baeb3b`),
so the carry compared against a text that no longer held the note and had nothing to carry.

### What follows

The fix is in progress,
not landed:
an agent works on it in the worktree `w223` off `dc4982c9cb`,
red test first,
so that the prepared archive text keeps every note between translators the replaced block held.
The next launch is `CuspariaKLSY18` on the build that has the note fix and the seat-window census,
under a new frozen digest;
it is not a repeat of `zheermao101`,
whose read found nothing else on that page.

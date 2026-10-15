# OpenRouter and the corpus passes: 2026-10-15

What was launched,
read and decided on 2026-10-15.
Entries:
TianqiChen66624.

Part of [Translation repair: OpenRouter as the paid fallback provider](translation-repair-openrouter-2026-09-03.md),
which lists every file of this record.

## TianqiChen66624 read, 2026-10-15: SETTLED, one repeat carried, her last message told in the past

TianqiChen66624 launched on 2026-10-15 at 08:30 UTC at `db6c26a486`
through the runbook's unit form
(`mise run //package/module/translation-repair:corpus-pass -- --only TianqiChen666`)
into a throwaway runs directory,
and settled in 10,629,332 ms
(`TALLY TianqiChen666 status=SETTLED slices=24`):
130 repair issues,
80 accepted,
80 resolved,
every slice changed.
`verify-published` read the page back:
1 of 1 page carries every wording its artifact promised,
at the length it implies
(`chars=8490=expected missing=0 consistency-groups=2 read-at-generation=17`).
`DESTINATIONS` dropped none,
no `DEFECTS` line printed,
the log holds no `[error]` line,
and it holds 626 `warn` lines,
where TianqiChen66623 held 529.

### Seats

Both Bedrock Gemma seats threw on every ask and were withheld after them
(`SEAT gemma-4-26b-a4b-it asked=5 ... threw=5`,
`SEAT google.gemma-4-e2b asked=6 ... threw=6`),
as in TianqiChen66623.
Kimi-K3 threw 10 of 344,
the provider answering HTTP 503 "No targets available" on each consistency ask that failed.
Replies that failed their shape:
Mercury 2.5 11 of 264,
GLM-5.3 4 of 152,
MiniMax M3 3 of 302,
MiMo V2.6 Flash 1 of 75.

### Time and spend

10,629,332 ms against TianqiChen66623's 7,339,457 ms,
with 17.10 h of calls against 13.72 h.
Calls in flight averaged 5.79 against 6.73,
rounds spent 57.3% of their time waiting after quorum against 47.7%,
10 of 513 rounds ended without quorum,
and 220 voices were never heard against 146 (`run-timing-report`).
By lane,
repair took 214.3 min over 24 slices,
translate 75.3 min over 24,
and consolidation 207.1 min over 22 (`slice-cost-report`).
Which change in the build made the run longer is not measured here.

`spend-report` priced 148.11 credits at the rates read on 2026-10-11
and 0.2681 USD on OpenRouter.
The providers' own balances,
first reading to last:
Hyper 250 to 140,
OpenRouter 23.01 to 22.75 USD,
Bedrock unchanged at 5.02 USD,
Synthetic's weekly allowance 100% to 93.6% (`meter-report`).
The report's credits and Hyper's balance are different measures and are not reconciled here.
`ledger-report` read 135 contests;
28 ballots named nothing and 1 named a candidate its slate did not have.

### Tense: her last message moved into the past

The narration holds the past
(page lines 48 to 56,
"In the final moments of her life,
she cast a farewell glow ...").
Her own last message does not keep her tense.
Source lines 71 to 75 are the message she wrote before she died,
in her present:
撑不到那一天了,
还有很多孩子需要帮助呢,
我还是坚持不下去了.
Page lines 217 to 229 tell it in the past:
"I felt like I might not make it to that day",
"There were still so many kids who needed help",
"I just couldn't hold on anymore".
The human archive reads "I feel like I won't make it to that day"
and "There are so many kids who need help."
Her other quoted words on the page keep the present
(page lines 141 to 156,
185 to 190 and 208 to 211),
so the page now gives her own words in two tenses.

TianqiChen66623 shipped the same past tense on these lines (its page lines 213 to 219),
and its read recorded that the tense held without reading her quoted words against the archive.
The house rule (`src/house-policy.ts`) lists what the person "said" among the life told in the past
and makes no exception for words quoted as she wrote them;
the deterministic tense candidates already blank quoted speech,
so the change came from the producers and judges reading the rule.
The lead's decision,
under the owner's instruction to decide without asking,
is that quoted words keep the tense their speaker used,
and the rule says so with the next round's work;
the package's audit ledger carries it.

### The consistency pass carried one repeat

The pass found the two groups TianqiChen66623 named
(`settled groups=2 changed slices=1`):

- The repeated sentence 她想以可爱的样子陪伴在更多人的身边 (source lines 35 and 55)
  was carried
  (`group 2 of 2: maximal verdict=asked placed=2 replaced=1`).
  Page lines 113 and 182 now give the same words,
  "stay by more people's sides in her cute form,
  bringing sunshine to more people",
  and line 113's "And" renders the `也` that stands only before the first place.
  TianqiChen66623 left this group unlocated.
- The refrain 所以她是个……女孩吧 (source lines 17,
  25,
  33 and 37)
  was asked and changed nothing
  (`group 1 of 2: refrain verdict=asked placed=4 replaced=0`).
  The page still gives it four frames
  (lines 26,
  61 to 63,
  94 to 95 and 116 to 119).
  The group's line does not say why nothing was carried:
  no quorum,
  no majority,
  or a choice no splice could carry.
  The bench rounds of the pass ran short of voices
  (GLM-5.3 and Mercury 2.5 replies off the reply shape,
  Kimi-K3 refused),
  and which of those decided this group is not in the log.
  The missing reason is a logging gap,
  closed with the next round's work.

### Other readings against the source

- Page line 159 adds "(Atri,
  the robot heroine of ATRI -My Dear Moments-)",
  which source line 47 does not write.
  It glosses the in-group reference 「高性能机器人」 inline where it first appears,
  as the house rule on community vocabulary asks,
  and stands.
- Page line 89 puts 吾心安处，并非吾乡 in quotation marks the source does not write.
  The line turns a well-known line of verse around,
  and the marks show it as borrowed;
  it stands.
- The page carries four em-dashes (lines 39,
  240 and 242);
  the owner's ruling of 2026-09-21 leaves em-dashes as they are.
- The front matter is the archive's,
  byte for byte.
  Its `desc`,
  "This time,
  we won't find you anymore.",
  drops the game of hide-and-seek that the source's `desc` and page line 247 carry.
  Whether the pipeline should repair front matter is an open item in the handover.
- Page line 259 sets Uno in italics.
  Uno is a card game,
  not the title of a work,
  and the title rule's reach to game names is an open item in the handover.

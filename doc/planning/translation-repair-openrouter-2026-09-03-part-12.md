# Translation repair: OpenRouter as the paid fallback provider, part 12

Part 12 of [Translation repair: OpenRouter as the paid fallback provider](translation-repair-openrouter-2026-09-03.md),
whose index lists every part in order.

## TianqiChen66623 read, 2026-10-12: SETTLED, the tense holds and the consistency pass changes nothing

TianqiChen66623 launched on 2026-10-12 at 08:58 UTC at `9c0406f113`
through the runbook's unit form
(`mise run //package/module/translation-repair:corpus-pass -- --only TianqiChen666`,
`StandardError=inherit` read back from systemd right after the launch)
into a throwaway runs directory,
and settled in 7,339,457 ms
(`TALLY TianqiChen666 status=SETTLED slices=24`):
144 repair issues,
101 accepted,
100 resolved,
every slice changed.
`verify-published` read the page back:
1 of 1 page carries every wording its artifact promised,
at the length it implies.
`DESTINATIONS` dropped none,
no `DEFECTS` line printed,
the log holds no `[error]` line,
and it holds 529 `warn` lines,
where TianqiChen66622 kept 2.

### The two Gemma seats: an expired credential

With stderr kept,
the cause the last read could not name is in the log:
every call to `google.gemma-4-e2b` and `gemma-4-26b-a4b-it` was refused with HTTP 401,
the provider saying "The security token included in the request has expired."
The run withheld each seat after it threw on every ask
(`SEAT google.gemma-4-e2b asked=6 ... threw=6`,
`SEAT gemma-4-26b-a4b-it asked=5 ... threw=5`),
where TianqiChen66622 asked them 270 and 266 times;
rounds without quorum fell to 4 of 503 from 212 of 696,
and voices never heard to 146 from 753 (`run-timing-report`).
That TianqiChen66622's Gemma failures had the same cause is likely,
not shown:
its stderr is lost.
The message names an expired token,
not spent credit;
the owner does not top up Bedrock (2026-09-07),
and with both seats withheld after their first calls no launch waits on them.

### Time and spend

7,339,457 ms against TianqiChen66622's 7,377,286 ms,
with 13.72 h of calls against 11.07 h:
the run asked more,
not waited more,
and the share of each new stage in it is not measured.
Calls in flight averaged 6.73;
rounds spent 47.7% of their time waiting after quorum.
`spend-report` priced 135.66 credits at the rates read on 2026-10-11;
the providers' own balances were not read for this section.

### Tense

The passage TianqiChen66622 shipped in the archive's present tense now reads in the past
(page lines 49 to 56,
"That glow was like thin mist ... Then it left her ashes behind");
three repair judges flagged the archive's present tense against the house rule for a life that has ended.

### The consistency pass changed nothing

The pass found both groups the last read named and asked the bench about each
(`settled groups=2 changed slices=0`):

- The refrain 所以她是个……女孩吧 (source lines 17,
  25,
  33 and 37):
  two ballots chose the third place ("So she was a girl who could be trusted,
  wasn't she?"),
  two the fourth ("So she was a gentle,
  tender-hearted girl,
  wasn't she?"),
  so no strict majority.
  The two frames put the slot on either side of "girl",
  so a splice of either by code could not carry every place's own slot as English.
  The page still reads the refrain three ways.
- The repeated sentence 她想以可爱的样子陪伴在更多人的身边 (source lines 35 and 55):
  three of four ballots chose the first place,
  yet the pass found no agreed quote,
  since it compared quotes as exact strings and two judges quoted the place without its final period,
  two with it.
  Had it located,
  the first place's "She also wanted" renders the `也` that stands before the repeat on source line 35 and not on
  line 55,
  so a splice would have put a word the source lacks into page line 178.

The lead's decision on these,
under the owner's instruction of 2026-10-11 to decide without asking,
is in the package's audit ledger with the work that carries it.

### Em-dashes

The page carries five.
The source carries none,
and the human archive carries them on five lines;
the owner's ruling of 2026-09-21 leaves em-dashes as they are.

## TianqiChen66622 read, 2026-10-11: SETTLED, two Bedrock seats dark all run

TianqiChen66622 launched on 2026-10-11 at 18:31 UTC at `f58e30822`
through the runbook's task (`mise run //package/module/translation-repair:corpus-pass -- --only TianqiChen666`,
a systemd user unit,
the owner's go-ahead of that day)
into a throwaway runs directory,
and settled in 7,377,286 ms
(`TALLY TianqiChen666 status=SETTLED slices=24`):
159 repair issues,
104 accepted,
101 resolved,
every slice changed.
`verify-published` read the page back:
24 of 24 wordings present at the length the artifact implies.
`DESTINATIONS` dropped none,
no `DEFECTS` line printed,
and the log holds no `[error]` line.
An empty `DEFECTS` grep did not mean a clean page here:
slice 4 shipped the archive's present-tense sentence,
which the page read found and no check reports.

### Two seats dark all run

The pass's own closing lines:
`SEAT gemma-4-26b-a4b-it asked=270 usable=0 unusable=0 threw=270`,
`SEAT google.gemma-4-e2b asked=266 usable=0 unusable=0 threw=266`
and `SEATS DARK: 2 of 11 seats`.
Kimi-K3 threw 213 of 366.
Every Bedrock Gemma stream ended in under a second with 150 raw characters and no content,
the Bedrock meter read `wet` with no spend all run,
and no seat was withheld (`withheld=none` on every `JUDGE SEATS` line).
The run log names no thrown message,
and no failure at all:
it holds 2 `warn` lines against TianqiChen66621's 101.
That is the launch's fault,
not the pipeline's.
The unit was started with `StandardOutput=truncate:` and `StandardError=append:` on the same file,
two descriptors on one file,
so stdout,
writing at its own offset,
overwrote every line stderr appended:
every `warn` (`console.warn` writes to stderr) and every line mise prints for its tasks.
A control unit writing three lines to stdout and two to stderr kept only the three stdout lines that way,
and all five in order with stderr left to inherit stdout's file.
The lost lines cannot be recovered,
so why Bedrock answered every Gemma call with 150 characters and no content is not known;
the source the two seats send has not changed since TianqiChen66621 (read-only diff of the request body,
route,
headers and served ids).
The next launch writes one file through stdout alone.

Rounds without quorum were 212 of 696
(TianqiChen66621 had 0 of 523),
voices never heard 753
(TianqiChen66621 had 14);
the artifact's `stage-voice-lost` findings name the two Gemma seats and Kimi-K3 for all but two.
A round over six seats that needs five cannot reach quorum with two seats that never answer,
so it waits for every ask to settle and buys a top-up round.

### Where the time went

7,377,286 ms for the entry against TianqiChen66621's 3,169,499 ms.
This run kept four slices in flight (the production default since 2026-09-06),
TianqiChen66621 eight (a dialled arm);
calls in flight averaged 5.40 against 11.93,
over about the same total call time (11.07 h against 10.50 h).
The dark seats' full-settle waits and top-up rounds come on top.
The share each cause holds is inferred,
not measured:
concurrent elapsed times are not a matched comparison.

### Spend

Hyper's balance fell from 250 to 140 credits.
`spend-report` priced 136.07 from a table read on 2026-09-11,
which disagrees with the balance by 26,
so 136 is not quoted as the run's cost.
The table was read again keyless from Hyper's public list the same day (`d02c0cfc3`):
three rows had moved,
`deepseek-v4.1-flash` up among them,
so at today's rates the estimate rises by about 4 credits and the gap to the balance stays;
prompt-cache pricing fits it,
which the estimator cannot see (inferred).
OpenRouter billed 0.2427 USD;
Bedrock billed nothing;
Synthetic's weekly meter went from 99.57% to 92.21%.

### Slice 4: the archive's present tense ships

Page line 59 is the archive's sentence word for word,
in the present tense the owner's rule forbids for a life that has ended.
The lane contest went 5 of 7 usable:
repair 2,
translate 2,
neither 1,
with 4 of 5 ballots calling the archive flawed;
the fifth called it publishable for a reason that spoke only of the candidates.
The owner's rule of 2026-09-24 runs the consolidation slate off only when every contest ballot calls the archive
flawed,
so the slate had its single round:
three candidates tied at weight 1,
the archive drew no ballot
(one judge named its tense a critical failure),
and the tie kept it.
The owner answered on 2026-10-11:
a majority of flawed ballots now runs the slate off
("Majority flawed yes"),
a tie the standing drew no ballot in is run off among the tied
("Run off the tied finalists"),
and a deterministic check may help on tense
("as for tense I suppose some deterministic code can mitigate the problem to some extent");
measured,
it is shown to judges as candidates only
(the package's `design-commitments.md`).

### Seen again

- Line 52,
  "sweeping toward her":
  扑面而来 aimed at her again,
  where the original has the glow coming at everyone she knew;
  TianqiChen66621 read the same.
  The owner asked for a dictionary entry (2026-10-11),
  added in `6bc235960`;
  the corpus carries the idiom on four pages,
  three of them a feeling washing over the person herself,
  so the entry refuses no form and says the target is whoever faces it.
- The refrain 所以她是个……女孩吧 renders four ways,
  one of them slice 4's archive sentence,
  and the repeated sentence 她想以可爱的样子陪伴在更多人的身边 two ways (page lines 101 and 161).
  The owner chose a page-level consistency pass (2026-10-11).

## TianqiChen66621 read, 2026-09-28: SETTLED, class one hundred eighty-seven

TianqiChen66621 ran on `.frozen-dist-9a3f28b30` and settled in 3,169,499 ms
(`TALLY TianqiChen666 status=SETTLED slices=24`):
148 repair issues,
91 accepted,
85 resolved,
every slice changed,
no DEFECTS line.
`verify-published` read the page back:
24 of 24 wordings present,
at the length the artifact implies.
The page (`fixed/people/TianqiChen666/page.en.md`) was read against the original,
line by line.

### What held

- 治愈 leads with "healed" (page line 134),
  per the owner's rule.
- 头壳 is "headpiece" at every occurrence (lines 120,
  130,
  147,
  163);
  the bare "her head" gap did not recur.
- The "high-performance robot" carries the Atri gloss (line 152),
  accurate apparatus.
- 柜门炸开 is "she was outed" (line 88);
  小药娘 does not occur;
  跨性别女孩 is "transgender girl".
- Speech the original sets in 「」 is rendered as blockquotes,
  the archive's own convention.

### Class one hundred eighty-seven: a patch nested a quote

Page line 182 is a quote inside a quote (`> >`) that neither the original (two separate 「」 lines) nor the archive
(one quote of two paragraphs) has.
Slice 16's accuracy patch resolved six accepted issues and left its last quoted line at depth two;
the consolidation declined its slate for the standing,
so the nesting shipped.
Over every artifact,
ten repair-lane slices nested a quote two levels deep where neither side nests,
every one shipped,
and the translate lane did it none (`nested-quote-census.mjs`).
Fixed in `58287ebe3` and `05a18ed02` (guard `d661bb51f`,
widened in `9e4d7dafb`):
patch application clamps each replacement line to the deepest quote its context allows,
one level always and deeper only where a whole line the region touches,
or the original,
nests,
before any gate reads it,
on the editor and naturalness paths alike.
The mutation check found the first cut reading the replaced text as if its first line started a line,
so a region starting mid-line at an emoticon like `>>_<<` allowed two levels itself;
`05a18ed02` reads whole lines.
A replay over the ten sites clamps every one to one level with its words unchanged (`nested-quote-replay.mjs`).

### Seen and not a code class

- Line 54,
  "sweeping over her face":
  the archive dropped 扑面而来 altogether;
    the pipeline restored it but aimed it at her,
    where the original has the glow coming at everyone she knew.
    A model's reading,
  left to the judges.
- The four refrains 所以她是个……女孩吧 render 吧 three ways across slices
    ("I suppose" twice,
  "wasn't she?",
  "must have been"),
    where the archive rendered all four without it.
    Each slice is decided alone,
  and no stage sees a refrain repeated across slices;
    recorded as an open quality question rather than fixed on one page.

## Whole-package audit, 2026-09-27: class one hundred eighty-six onward

The owner asked:
"audit the whole translation-repair pkg for all the mistakes we've made and fix all of them",
"try to prevent recurrence by recording them and what to do in pkg-local docs",
and "Mistakes made,
ever,
for this pkg,
not just today."
Then:
"You don't need to immediately start/restart a costly run if you believe further fixes should be done before
launching it."
No run launches until the fixes land;
TianqiChen66620 was stopped at 17 min before slice 9.

Every finding,
its evidence path,
fix,
guard and status lives in `package/module/translation-repair/doc/audit-ledger.md`.

### The owner's answers

- The 治愈 correction:
    one of the three reasons given was a misquotation (the page writes 安抚,
  not 安慰);
    the owner was told,
  and "healed first" stands on the other two.
- "Objections to polish":
    over an ineligible standing the gate's objections become required corrections for the polish
    (fourteenth addendum of `doc/decision/translation-repair-ineligible-standing.md`).
- "Allow it,
  because it's the proper name of an org.":
    小药娘 inside mikaela_khara's registered company name is not the term
    (`doc/decision/translation-repair-community-glossary.md`).
- "Italics for works" (`doc/decision/translation-repair-title-style.md`).
- ""took medication" is fine,
  because it's not replicable.":
    `doc/decision/translation-repair-reader-protection-cause-of-death.md`.
- "Preference + polish":
    a slate rejected twice over an ineligible standing ships by the class one hundred seventy-four order,
    its reasons sent to the polish (fifteenth addendum).

### Landed so far

- `0b8788dae`:
  the gate sheet no longer says an ineligible standing stops the entry.
- `cc96eca77` (class one hundred eighty-six):
  glossary terms,
    renderings and refused forms match at word boundaries with tone marks,
    case,
    hyphens and CJK spacing folded;
    a lowercase or line-start OD is held (14 XingZ60 runs had shipped it).
- `9eba04abb`:
  medication with nothing to copy may stay;
    titles of works stand in italics.
- `f3cd0ef83`:
  an organization's proper name is not the 药娘 term.
- `00eed316e`:
  the translate writer gets the ordered tense rule,
    and its no-addition rule no longer excuses the existing translation's narrative.
- `9858a7acb`:
  production translators receive the archive dispute note.
- `b45000747`:
  every rendered sheet is in Canadian spelling,
    guarded through a shared rendered-sheets fixture.
- `e8f0b0369`:
  nine house-policy wordings,
    among them the house rules outranking any other rule on the same sheet.
    One reading was adopted without an owner answer:
    a term with no English equivalent is "kept in English letters (translated literally,
  or romanized where it is a
    name),
  never left in Han",
  which the owner confirmed on 2026-09-27 ("English letters").
- `ce824d933`:
  the typed decision seat reads the house rules and the community block.

The full suite passed 1174 at `b45000747`.

## TianqiChen66619 read, 2026-09-27: INCOMPLETE at slice 9, class one hundred eighty-five

TianqiChen66619 ran on `.frozen-dist-23f4e15d6` and stopped INCOMPLETE after 755,525 ms
(`TALLY TianqiChen666 status=INCOMPLETE`),
so the 治愈 and 变娃 checks have no page to read.
Slice 9 carries the refrain 你看头壳里，她在最狭小的空间中撑起了最完美的世界.

### What the log shows

- The repair lane's adjudicators accepted four disputing claims against the archive's
    "intolerant world" rendering,
    so the repair text stood in for it (classes one hundred seven and one hundred seventy-six).
- The lane contest chose the repair text 5 of 7 usable,
    every ballot calling the archive flawed,
    and the address floor refused it:
    "the ORIGINAL passage writes 你 or 您 once,
    and your translation carries no "you" but "she" in its place".
- The consolidation withheld the refused standing,
    offered the translate lane text beside the proposals,
    and the gate went 2 standing,
    1 neither,
    1 consolidated of 4 usable,
    the two standing ballots holding "wasn't she" and "for you" in the consolidated text against it.
    `requireShippableTerminal` raised `gate-kept-standing` and the entry stopped.
- The consolidation's slate and gate lines named no slice,
    so slice 9's ballots were read out of the interleaved log by time alone.

### Class one hundred eighty-five

Three defects,
each fixed with its guard shown failing first:

- The address floor (`translate-address-drop.ts`) counted 你看,
    the imperative "look",
    as an address.
    The standing's "she" rendered the original's own 她,
    and the floor pushed the bench into writing "for you" to pass.
    The corpus census found 你看 or 你瞧 opening a clause on TianqiChen666 (three times),
    hulicaijia and XingZ60,
    and 你看 as a verb with an object on zhangyubaka (被你看到) and Rentable_A (替你看管).
    A clause-opening 你看 or 你瞧 with no complement is no longer counted
    (guard `5cdeebb58`,
  fix `e5b69c658`).
- A gate that preferred an ineligible standing stopped the entry although the slate had chosen a valid
    proposal.
    The class fifty-four note had kept that stop,
    reading the owner's 2026-09-04 "else fail the slice at once" as covering a gate's preference;
    the rule fails the slice only where no valid proposal exists.
    `shipPastForfeitStanding` (renamed from `shipPastUndecidedGate`) now ships the slate's choice with
    `gate-preferred-ineligible-standing` recorded
    (guards `e7e6f706a` and `44e27ca0e`,
  fix `419605ff4`).
- Every consolidation purchase is now tagged `[slice N]`,
    as the lane contest already was
    (guard `44e27ca0e`,
  fix `2f26f440d`).

Lint 0/0 and types clean at `2f26f440d`;
the full suite passes 1169 with none failing (`suite-class185.log`).
TianqiChen66620 launched on `.frozen-dist-2f26f440d` (scope `pass-TianqiChen66620`,
pid 1459739).

## Glossary audit and TianqiChen66616 read, 2026-09-27: class one hundred eighty-four

### The owner's correction

The owner answered the class one hundred eighty-three entry:
"'kigurumi的记忆结束' - this isn't really a dictionary keyword though?"
and "Also check if other items in the glossary have the same problems and fix them too."
A glossary holds dictionary terms only:
words,
set phrases,
names and community vocabulary.
A lesson learned from one sentence becomes a general rule on every sheet,
since a rule reaches the next page's sentence
and an entry keyed on one sentence's words never fires again.

### What the audit changed

Guard `1bd589eb2` (`glossary-dictionary-terms.unit.test.ts`),
red first;
fix `5860bc0b1`.

Twenty-three rendering-glossary entries were keyed on one sentence and are removed:
用这种方式,
原因是多方面的,
特例,
陷入癫狂,
环境的问题,
相关医院,
巨大的影响,
主动提出,
ICU 抢救,
代替,
性格非常好,
人生中的第一颗,
留下了巨大的创伤,
，作者,
被她治愈,
应该会有更好的生活,
遇到的却是,
在隙中,
一切都会有机会,
离开我们的时候,
所以她是个,
the UNO line and kigurumi的记忆结束.
`rendering-glossary-slang.ts` and the credit,
life-event and slang tests went with them.

Their lessons are five rules in `english-usage-policy.ts`,
which `house-policy.ts` splices into `HOUSE_POLICY_BLOCK` on every sheet:

- `KEPT_SUBJECT_RULE`:
  a clause keeps the subject the original writes.
- `IDIOMATIC_ENGLISH_RULE`:
  the English an English writer would use,
  never the Chinese construction.
- `GRAMMATICAL_ENGLISH_RULE`:
  covers the bare verb after make or let,
  matching tag questions and point of view.
- `CREDIT_BY_RULE`:
  "by",
  "lyrics by" or "music by" before a maker's name.
- `GAME_JARGON_RULE`:
  a game's word takes that game's English term.

Some words refused a form that is right in other contexts.
Each now refuses nothing and names the condition in its why:
交往 ("dated" where the passage speaks of romance),
喘不过气 ("out of breath" after a run),
密密麻麻 ("densely packed"),
营救 ("rescue")
and 三剑客 ("the Three Musketeers").
抢救 is seeded with "emergency treatment" first.
The guard asserts the rules on the translate and select sheets,
the removed keys absent,
and the context-right forms valid.
Lint 0/0,
types clean.
The full suite read 1,167 PASS with one FAIL,
the load-sensitive `lane-contest-stage` grace-window case,
which passed when run alone (as on `suite-class110.log`).

### TianqiChen66616 read

TianqiChen66616 ran on `.frozen-dist-730d11579`,
the class one hundred eighty-three build before the audit.
It SETTLED in 1,028 s (17.1 min):
24 slices,
22 differing from the archive,
93 repair issues with 40 accepted.

Classes one hundred eighty-two and eighty-three are live on the page:

- "the dreams she kept hidden in her heart were repeatedly blocked because she was outed."
- "and I will end with my memories of kigurumi when I leave."

The robot line,
"hormones",
closing punctuation inside the quotes
and the second quote once all hold.

### Class one hundred eighty-four

Two fandom words shipped in their everyday sense:

- 这次的变娃娃，真的要融为一体了 shipped as
  "in this game of becoming a doll,
  you really will become one with it".
  Kigurumi players call putting on the costume 变娃;
  a Chinese report on the hobby says 偶装玩家会将穿上偶装称作"变娃".
  English "doll up" means dressing smartly.
- 被她治愈的人 shipped as "those she had healed",
  which this read first called a medical reading.
  The owner disagreed (see "The 治愈 correction").

Both are dictionary words,
seeded in `community-glossary-fandom.ts`:

- 变娃 renders as "put on the kigurumi",
  "in kigurumi" or "became the doll".
  It refuses "dolled up" and "dolling up".
- 治愈 renders as "healed",
  "soothed" or "cured".
  It refuses nothing.

### The 治愈 correction

The first build (`06a2c5c05`) led 治愈 with "comforted",
and its why said "healed" reads as curing a wound.
The owner answered "'被她治愈 should read "comforted",
not "healed".' - I kinda disagree here."
The reading was wrong on three counts:

- ~~The page writes 安慰 where it means comfort,
  so "comforted" for 治愈 collapses the writer's two words into the weaker one.~~
  Corrected 2026-09-28 (ledger C6 and H3):
  a misquotation.
  The page writes 安抚 (`page.md` line 89) and never 安慰,
  so there were no two words to collapse;
  and these three counts were the change's reasons,
  not the owner's,
  who wrote only "I kinda disagree here".
- 治愈系 is "healing" in the fandom's own English (iyashikei,
  "healing anime"),
  and a kigurumi doll beside it makes the emotional sense plain.
- The archive's translator wrote "those she has healed";
  only the tense was wrong,
  and the past-tense rule covers that.

The owner chose "Healed first (Recommended)" over removing the entry.
Guard `2234f1a92` red first,
fix `23f4e15d6`:
the entry leads with "healed" and its why says never to flatten 治愈 into "comforted" where the page keeps 安慰 apart
(corrected 2026-09-28 in `357f534b7`:
the why no longer names 安慰,
ledger C6).
Lint 0/0;
the full suite at `23f4e15d6` read 1,169 PASS,
0 FAIL.
TianqiChen66618 was stopped a few minutes in,
and TianqiChen66619 launched on `.frozen-dist-23f4e15d6`.

Guard `644f23cf5` (`community-glossary-kigurumi.unit.test.ts`),
red first (three of four),
fix `06a2c5c05`,
lint 0/0,
types clean.
The full suite at `06a2c5c05` was red on the community seeds pin,
which lists every seeded term;
the two terms joined it in `6a6cd1a84`,
and the suite there read 1,169 PASS,
0 FAIL.
TianqiChen66617 (`.frozen-dist-5860bc0b1`) was stopped a few minutes in when the fix landed.
TianqiChen66618 launched on `.frozen-dist-06a2c5c05`.

## TianqiChen66614 read, 2026-09-27: SETTLED, class one hundred eighty-two

TianqiChen66614 ran on `.frozen-dist-768408d1d` and SETTLED at 02:58 UTC in 716 s (11.9 min),
the fastest run on this entry,
24 slices published,
23 changed.
The full suite at `b75ec5c51` read 1,168 PASS,
0 FAIL.

Classes one hundred eighty and eighty-one are live.
The robot line reads "her friends and family never forgot her image as the “high-performance robot.”";
both hormone sentences say "hormones";
no `”.` or `”,` is left on the page,
and "a trusted “teacher,”"
carries its comma inside.
The second quote appears once.
The seats glm-5.3 and Qwen3.8-27B threw on every call (no provider on Synthetic or Hyper),
as on the runs before it.

Class one hundred eighty-two:
the source's 暗藏心底的梦想因为柜门炸开屡屡受阻 shipped as
"The dreams she kept locked in her heart were blocked again and again,
each time the closet door blew open."
The figure stayed literal,
and "each time" turned the source's cause (因为) into a repeated event.
柜门炸开 is 炸柜 written out,
and the community glossary's 炸柜 entry (class seventy-two) never matched it.
The census found it on this page alone in the pin.
Built as a community-glossary entry beside 炸柜 with the same renderings ("outed",
"blown out of the closet")
and a why naming the cause;
guard `cb8450ebb` (`community-glossary-closet.unit.test.ts`),
red first,
fix `2a0f947b5`,
lint 0/0,
types clean,
full suite 1,169 PASS,
0 FAIL.

Class one hundred eighty-three:
the kigurumi quote 我会在离开我们的时候以kigurumi的记忆结束 shipped as
"when I leave you all,
they will end with the memories of kigurumi",
a memory ending with memories,
where the source's subject is 我.
The archive reads "they" too ("and they will end with it when I leave"),
so the bench kept the archive's reading.
The first report called this an observation not built;
the owner answered "Always fix and re-launch."
Built as a phrasing-glossary entry keyed on kigurumi的记忆结束
(one page in the pin),
"I will end with memories of kigurumi" first and "they will end with" refused,
which makes the archive's rendering ineligible for the slice;
guard `42b937ce6` (`rendering-glossary-subject.unit.test.ts`),
red first,
fix `730d11579`,
lint 0/0,
types clean.
TianqiChen66615 was killed about 9 min in and TianqiChen66616 launched on `.frozen-dist-730d11579`.
The rule now stands in the handover:
a read never reports a translation as "not built".
The entry itself was wrong in kind and is removed by the glossary audit.
The owner said a sentence fragment is not a dictionary keyword,
so the lesson became `KEPT_SUBJECT_RULE` on every sheet
(see "Glossary audit and TianqiChen66616 read").

## TianqiChen66613 read, 2026-09-27: SETTLED, classes one hundred eighty and eighty-one

TianqiChen66613 ran on `.frozen-dist-ca5e56240` and SETTLED at 02:40 UTC in 947 s (15.8 min),
24 slices,
every page slice changed,
115 repair issues with 67 accepted.
The pairing placed 24 of 24 original and 21 of 21 archive blocks,
so no passage was carried and class one hundred seventy-nine had nothing to act on.
The second quote stands once on the page,
in its own blockquote as the source's second 「」 paragraph.
The robot line reads "her close friends never forgot her image as the “high-performance robot”."

Three slips,
built as two classes under the standing instruction of 2026-09-25:

- 亲友 ("relatives and friends") shipped as the archive's "close friends",
  dropping the family.
  The pin carries 亲友 in two paragraphs on two entries (TianqiChen666 and MTF_0615),
  neither with another word for friends beside it,
  so the phrasing glossary refuses "close friends" and seeds "friends and family" (class one hundred eighty).
- 激素一点一点进入她的身体 shipped as "the medication entered her system bit by bit",
  where TianqiChen66611 had "hormones".
  The pin carries 激素 in seven paragraphs on five entries,
  one of them (shi_Yumiaoya) also writing 药物 where "medication" renders that word
  (corrected 2026-09-28,
  ledger R16:
  this line once counted two,
  the second a 药 inside 药娘),
  so the medical glossary seeds "hormones" without a refused form (class one hundred eighty).
- The period sat outside the closing quote (`“high-performance robot”.`) on a page that also wrote `“Old Man Chen,”`.
  Canadian Press style sets a period or comma inside,
  and the archive does so 224 times to 32 across the pin.
  `placeClosingPunctuation` in `closing-punctuation.ts` moves the mark inside
  a curly closing double quote in prose during the typography restoration,
  leaving an ellipsis,
  a question or exclamation mark,
  a quotation already ending in its own mark,
  and code or markup alone;
  the en_CA policy bullet says the same (class one hundred eighty-one).
  Archive text that no candidate replaces keeps its own placement.

Guards red first at `53c7f1f2f`,
fix `768408d1d`,
lint 0/0,
types clean.
The first suite at `768408d1d` failed one case,
the class one hundred forty-two attribute guard,
which had asserted `said “hi”.` incidentally;
its point (attribute and code span straight) holds,
and `b75ec5c51` expects `said “hi.”`.
TianqiChen66614 launched at 02:46 UTC on `.frozen-dist-768408d1d` (scope `pass-TianqiChen66614`,
pid 1092114).

## TianqiChen66612 killed and TianqiChen66613 launched on class one hundred seventy-nine, 2026-09-27

TianqiChen66612 ran on `.frozen-dist-325c448ba` (classes one hundred seventy-six to seventy-eight)
and was killed by pid at 02:23 UTC,
10.5 minutes into the repair lane,
under ALWAYS KILL AND RELAUNCH once `ca5e56240` landed.
Its admission printed no fold line:
the pairing did not leave the robot paragraph carried this time,
so class one hundred seventy-nine had nothing to act on there.
Its waiter first watched the pid of TianqiChen66611
(the script had been derived by `sed` from the 66611 waiter and kept the old pid);
fixed and rerun.

TianqiChen66613 launched at 02:26 UTC on `.frozen-dist-ca5e56240`
(scope `pass-TianqiChen66613`,
pid 1066103,
overlap 8).
Read first the admission's `carried on` lines and any `insertion-carried-shifted` finding,
then slice 13:
the Atri line,
any `translate-archive-disputed` finding,
and the gate
(`undecided-gate-ships-proposal (standing flawed by every contest ballot)` if it tied),
then quote 2 once on the page,
then the stray closing quote (class one hundred seventy-five).

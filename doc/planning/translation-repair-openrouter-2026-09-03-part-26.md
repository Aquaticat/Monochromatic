# Translation repair: OpenRouter as the paid fallback provider, part 26

Part 26 of [Translation repair: OpenRouter as the paid fallback provider](translation-repair-openrouter-2026-09-03.md),
whose index lists every part in order.

## shi_Yumiaoya11 read, 2026-09-22, 04:30 UTC: SETTLED, the class eighty clause on every sheet and the judges still chose the second English wording; the page's own line count now bounds the pair, fixed in 873104d8f; shi_Yumiaoya12 launched

`shi_Yumiaoya11` (frozen `8f5e28ad4`,
pid 1878666,
overlap 8,
launched 03:47 UTC on Bedrock and OpenRouter,
Synthetic and Hyper dry)
SETTLED at 04:17 UTC on one attempt,
30 minutes by the artifact.
Seats asked 926,
43 retry rounds,
830 calls,
5 abandoned streams (0.0030 USD),
Qwen3.8-27B and glm-5.3 dark (114 and 82 asked,
all threw),
every other seat whole or within five.
Meters 117.28 to 116.97 USD on Bedrock and 173.44 to 172.93 on OpenRouter,
0.82 USD together.

### Checks

- Front matter equal to the archive and to `shi_Yumiaoya10`.
- 4 of 4 headings,
  1 photoscroll,
  1 footnote definition,
  12 blockquote lines against the previous page's 16,
  328 lines against 323;
  no `TA`,
  no `finish_reason=error`,
  no double blank line,
  `attempts.json` reads 1.
- No `PublishedPageDisagrees` or `weight-off`,
  one unendorsed standing (slice 1,
  the caution blockquote,
  the archive's own wording standing without contest endorsement),
  no gate-kept or slate-declined standing,
  no `repeats the line`,
  no run-off,
  no `archive-revision-refused`;
  14 `declined every candidate` lines with reasons.
- 6 em-dashes,
  left per the owner's answer of 2026-09-21.
- Class seventy-nine holds ("she attempted to end her life in the early hours of January 16",
  the ICU waking two lines on);
  class seventy-eight holds ("Chewing Gum and Danpian",
  "her cuddling plans").

### Class eighty, second arm: the clause reached the judges and they overruled it

The closing blockquote shipped three lines again:
"If I should never see you again,
I wish you good morning,
good afternoon,
and good night."
above the film's own line,
then "From *The Truman Show*".
The frozen build carries the clause
(`bilingual-line-clause-DLHhNPE9.mjs` in the frozen dist),
so every translator,
judge and editor on that slice read that the pair is one line whose English is already its rendering.
The translate slate's ballots on the slice:
deepseek-v4.1-flash chose the three-line candidate at weight 1,
"Candidate 2 drops the original Chinese line of the bilingual Truman Show quotation ... leaving only the English line;
under criterion 4 this is a dropped line and makes it ineligible";
gemma-4-26b at weight 0.5,
"The Chinese line ... is a literal translation of the sentiment,
which is distinct from the actual English quote provided in the next line";
minimax-m3 abstained on both grounds at once,
"Candidate 1 adds an English line ... that does not correspond to any line in the ORIGINAL ... This invents a line.
Candidate 2 drops the Chinese quotation line entirely".
In the repair lane the editors' candidate that added the line lost 4 to 1
("Candidate 2 adds an English translation of the preceding Truman Show quote",
"incorrectly duplicates the Truman Show quote that already appears in the surrounding text"),
so the archive's two lines stood there;
the contest then preferred the translate lane's three.
A judge without the film cannot see that the two lines are one,
and one that can still reads "drops a line" as the nearer rule.

The evidence the judges lack is on the sheet:
the EXISTING TRANSLATION,
a human's,
carried the pair as one line.
Fixed in `873104d8f`
(guard red first at `c630bfb7d`,
`bilingual-pair-bound.unit.test.ts`,
five tests:
refused where the page carries the pair once,
accepted where the rendering does too,
silent without page text,
silent where the page keeps the adjacent lines apart,
silent on a slice with no pair however long the rendering runs).
`bilingual-pair-bound.ts` names a rendering carrying more lines than owed on a slice whose original carries a Han line with its own English beside it,
where the page carries exactly the lines owed;
`compareLineCounts` calls it with the page text `translate-validate.ts` now threads through,
so the candidate is refused at the floor and withheld from the slate as class sixty-six withholds a rule-refused candidate.
Without page text,
or where the page itself keeps the two adjacent lines apart
(the ten entries of the census under the 03:50 UTC heading),
nothing is refused and the judges decide on the clause.
The shortfall check's own blind spot,
a longer rendering on a slice with no pair,
is untouched and pinned by the fifth test.
Lint 0 and 0,
types clean,
full suite green (`suite-873104d8f.log`).

### Observations, not classes

- The caution blockquote ships the archive's own wording this run
  ("Tips",
  "doesn't correspond to fact,
  while other parts still may require fact check"),
  the unendorsed standing of slice 1,
  where `shi_Yumiaoya9` and `shi_Yumiaoya10` re-rendered it;
  the `<Banner>` text is re-rendered again.
- The film link ships `[Josee, the Tiger and the Fish](...)`,
  the title the cited Wikipedia reference establishes,
  where `shi_Yumiaoya10` had "[movie]" and `shi_Yumiaoya8` "[name of a film]";
  two ballots cite the web lookup,
  one of them confusing itself mid-reason and recovering.
- "xiaoyao-niang" with the footnote where `shi_Yumiaoya10` had "little yao-niang";
  "the trio's car shows" for the source's 三剑客;
  "*Girls' Last Tour* has ended" italicised,
  where `shi_Yumiaoya10` had the archive's "girl's last tour ended".

### shi_Yumiaoya12 launched

`shi_Yumiaoya12` (frozen `873104d8f`,
pid 1903793,
overlap 8)
launched 04:24 UTC on Bedrock and OpenRouter
(meters 116.96 USD Bedrock,
172.92 OpenRouter at launch;
Synthetic and Hyper dry),
the `CORPUS NAMES` line naming the same five.
Read the closing blockquote first
(two lines,
the film's English and its attribution,
and a `LINE-STRUCTURED` finding naming the pair on the translate floor),
then class seventy-nine,
then class seventy-eight,
then the seven steps and three checks against `shi_Yumiaoya11` and the archive.

## shi_Yumiaoya10 read, 2026-09-22, 03:50 UTC: SETTLED, class seventy-nine live, class eighty found (the bilingual film quote rendered twice in English because every line-structure wording said never drop a line), fixed in 8f5e28ad4; shi_Yumiaoya11 launched

`shi_Yumiaoya10` (frozen `d29feecd5`,
pid 1846495,
overlap 8,
launched 02:51 UTC on Bedrock and OpenRouter with Synthetic wet again at launch,
Hyper dry)
SETTLED at 03:33 UTC on one attempt,
45 minutes by the artifact against `shi_Yumiaoya9`'s 28:
repair lane 02:54 to 03:00 UTC,
translate lane 03:00 to 03:20 UTC (against 8 minutes on `shi_Yumiaoya9`),
consolidation 03:20 to 03:33 UTC.
Seats asked 964,
39 retry rounds,
888 calls,
no abandoned stream,
glm-5.3 dark (75 asked,
75 threw),
Qwen3.8-27B 56 of 124 and Kimi-K3 42 of 61 through Synthetic until its five-hour window read 2750 of 2750 at 03:30 UTC,
after which the 19 Kimi and 68 Qwen refusals are `NoProviderForModelError` seat holds inside the consolidation,
not provider errors.
Meters 117.48 to 117.28 USD on Bedrock and 173.89 to 173.46 on OpenRouter,
0.63 USD together.

### Checks

- Front matter equal to the archive and to `shi_Yumiaoya9`.
- 4 of 4 headings,
  1 photoscroll,
  1 footnote definition,
  16 blockquote lines against the previous page's 18,
  323 lines against 320;
  no `TA`,
  no `finish_reason=error`,
  no double blank line,
  `attempts.json` reads 1.
- No `PublishedPageDisagrees` or `weight-off`,
  no unendorsed standing,
  no gate-kept or slate-declined standing,
  no `repeats the line`,
  no run-off,
  no `archive-revision-refused`;
  23 `declined every candidate` lines with reasons.
- 7 em-dashes,
  left per the owner's answer of 2026-09-21.

### Class seventy-nine live

The January 16 sentence ships
"After celebrating her current partner's birthday with them,
in the early hours of January 16,
she tried to end her life."
followed by
"after six days of rescue efforts in the ICU,
Yumiao — her body gravely damaged — finally woke up".
The log carries "tried to end her life" on three ballots
("as in the original and house rules";
one abstention faulting a candidate for "tried to end her life" without the temporal detail,
which the winner carries)
and "ended her life" only on the rooftop sentence,
where she did die,
and in the rule's own text.
Class seventy-eight holds:
the ICU paragraph ships "Magic Chewing Gum and Danpian",
the entry's declared name,
where `shi_Yumiaoya9` had the alias "Chewing Gum";
贴贴计划 ships "her cuddling plan".

### Class eighty: the bilingual film quote rendered twice in English

The closing blockquote's original is four lines:
如果再也不能见到你，祝你早安，午安，晚安。 then
"And in case I don't see you……good afternoon,
good evening,
and good night."
then
出自《楚门的世界》 then
"From *The Truman Show*".
The archive carries two lines,
the film's English line and "From *The Truman Show*".
`shi_Yumiaoya10` shipped three:
"If I can never see you again,
I wish you good morning,
good afternoon,
and good night."
above the film's own line,
then the attribution once.
`shi_Yumiaoya4` to `shi_Yumiaoya9` shipped four,
the two Chinese lines kept in Chinese on the English page
(the `shi_Yumiaoya9` read under the heading of 02:55 UTC called that "as the archive has it";
it is not,
the archive carries the English alone,
and that note is corrected here).

The bench had no rule for the pair.
The line floor counts a Han line beside its own English as one line owed
(class forty-seven,
`bilingualPairCount`),
and the class seventy-four guard catches a wording carried twice,
but every wording of the line rule on the sheets said the opposite:
`TRANSLATE_LINE_STRUCTURE_RULE` to the translators and consolidation producers
("never invent or drop a line"),
`TRANSLATE_LINE_STRUCTURE_CRITERION` to the slate judges
("a candidate that ... drops or invents a line is FAULTY"),
`LINE_STRUCTURE_RULE` to the editors
("never invent a line,
drop a line").
So every translate candidate rendered the Chinese line
(deepseek-v4.1-flash:
"original has a 4-line blockquote (Chinese quote,
English quote,
Chinese attribution,
English attribution) but the Chinese quote line is absent from every candidate"),
and the judges split on the ground the rule left open:
gpt-oss-120b abstained on "All candidates omit the original line 出自《楚门的世界》",
Qwen3.8-27B on "Candidates 1 and 2 omit the first quoted line",
gpt-oss-120b in the repair lane on "Both candidates keep the original English line after adding a new translation".

Fixed in `8f5e28ad4`
(guard red first at `49327e735`,
`bilingual-line-policy.unit.test.ts`,
four tests:
the translators' rule,
the judges' criterion and the editors' addendum carry the clause,
an ungoverned addendum carries none).
`bilingual-line-clause.ts` holds one wording,
interpolated into all three:
"A line the ORIGINAL gives twice,
once in Chinese and once in English directly beside it (a quotation in both languages,
and its attribution the same way),
is ONE line whose English is already its rendering:
carry that English line once,
as the ORIGINAL has it;
a rendering carrying the English line alone for such a pair has dropped nothing,
and one carrying the Chinese line,
or a second English wording of it,
beside the English has invented a line."
Stated for the models rather than enforced as a surplus bound:
measured over the pinned corpus
(`scratchpad/bilingual-census.mjs`,
every Han line followed by a Latin-only line in the 92 originals),
`shi_Yumiaoya`'s two pairs are the only Chinese lines with their English beside them,
while Arita,
NIGHT81473140,
gqt,
zhangyubaka,
Y1Ran,
luxuanwen3,
cheonwoomaeng,
hakureico,
Susiethegamer and XIEPT2 carry a Chinese line followed by an English line of different content
(an introduction then a quoted poem,
a letter then its signature),
which `bilingualPairCount` cannot tell apart,
so a mechanical bound would refuse faithful renderings there.
Lint 0 and 0,
types clean,
full suite green (`suite-8f5e28ad4.log`).

### Observations, not classes

- The closing line ships "girl's last tour ended",
  the archive's own wording,
  where `shi_Yumiaoya9` had "Girls' Last Tour has ended";
  the consolidation slate split 2/1/1 over candidates praising the anime title,
  and the standing stood.
- "correctional institution" for the source's quoted “矫正”机构 where `shi_Yumiaoya9` kept the quotation marks;
  "college entrance exam" for gaokao;
  "gave up on her schoolwork" for the 摆烂 idiom where `shi_Yumiaoya9` had "let it rot".
- "Yumiao — her body gravely damaged — finally woke up":
  one more em-dash pair,
  left per the owner.
- The `<Banner>` block's title and text and the caution blockquote are re-rendered again
  ("You may be following a hot event that is currently happening"),
  differently on every run;
  the front matter itself is equal.
  Measured over the pinned corpus,
  two originals carry a Banner,
  each with its own text,
  so it is no shared boilerplate to restore;
  the judges own the wording.

### shi_Yumiaoya11 launched

`shi_Yumiaoya11` (frozen `8f5e28ad4`,
pid 1878666,
overlap 8)
launched 03:47 UTC on Bedrock and OpenRouter
(meters 117.28 USD Bedrock,
173.44 OpenRouter at launch;
Synthetic and Hyper dry),
the `CORPUS NAMES` line naming the same five.
Read the closing blockquote first
(the film's English line once,
"From *The Truman Show*" once,
no Chinese line and no second English wording),
then the January 16 sentence,
then class seventy-eight,
then the seven steps and three checks against `shi_Yumiaoya10` and the archive.

## shi_Yumiaoya9 read, 2026-09-22, 02:55 UTC: SETTLED, class seventy-eight live, class seventy-nine found (a survived suicide attempt rendered as a death by the reader-protection rule's own sample sentence), fixed in d29feecd5; shi_Yumiaoya10 launched

`shi_Yumiaoya9` (frozen `545bff7b9`,
pid 1820803,
overlap 8,
launched 02:14 UTC on Bedrock and OpenRouter,
Synthetic and Hyper dry)
SETTLED at 02:42 UTC on one attempt,
28 minutes by the artifact,
the same as `shi_Yumiaoya8`.
Seats asked 923,
54 retry rounds,
819 calls,
6 abandoned streams (0.0029 USD),
Qwen3.8-27B and glm-5.3 dark all run (110 and 94 asked,
all threw,
the `SEATS DARK` line at the tally),
GLM-5.3-Flash 48 of 54,
gemma-4-e2b 134 of 137,
Jev 22 of 22,
every other seat whole.
Meters 117.81 to 117.50 USD on Bedrock and 174.39 to 173.93 on OpenRouter,
0.77 USD together.

### Checks

- Front matter equal to the archive and to `shi_Yumiaoya8`.
- 4 of 4 headings,
  1 photoscroll,
  1 footnote definition,
  18 blockquote lines,
  320 lines against the previous page's 324;
  no `TA`,
  no `finish_reason=error`,
  no double blank line,
  `attempts.json` reads 1.
- No `PublishedPageDisagrees` or `weight-off`,
  no unendorsed standing,
  no gate-kept or slate-declined standing,
  no `repeats the line`,
  no run-off,
  no `archive-revision-refused`;
  14 `declined every candidate` lines with reasons.
- 6 em-dashes,
  left per the owner's answer of 2026-09-21.

### Class seventy-eight live

The `CORPUS NAMES` line named five people
(贴贴 for `CutOceanHeyFis1` as "Cuddly",
"Affectionate";
盐田 for `SS3B_0016` as "Yantian",
"Metro Line 8";
紫壑 for `Weideriche_` as "Weideriche_",
"Zihe";
口香糖 for `a2581911655` as "Magic Chewing Gum",
"Chewing Gum",
"jjlin1219";
单片 for `interrgned` as "interrgned",
"Danpian").
The ICU paragraph ships
"Yumiao heard the devastating news that Chewing Gum and Danpian had also passed away,
one after the other"
where `shi_Yumiaoya8` had "Xiaoguantang and Danpian".
Three of the five translate-slate ballots on that slice name the declared names in their reasons
(gpt-oss-120b:
"uses the declared names (Yumiao,
Yantian,
Chewing Gum,
Danpian)";
deepseek-v4.1-flash:
"All three candidates ... use the declared names (Yumiao,
Yantian,
Chewing Gum,
Danpian)";
minimax-m3:
"all three use the declared spellings Yumiao,
Yantian,
Chewing Gum,
Danpian correctly").
The hedge held:
贴贴计划 ships "her cuddling plans",
the ordinary word,
not "Cuddly's plans".
紫壑 ships as "Weideriche_",
the entry's declared name,
where `shi_Yumiaoya8` had guessed "Zihe";
the line offers both forms and the bench chose the handle,
which is what that entry's own page carries.

### Class seventy-nine: a survived attempt rendered as a death

The January 16 sentence shipped
"in the early hours of January 16 she ended her life by taking a large amount of medication",
followed two sentences later by
"after six days of emergency treatment in the ICU,
Yumiao,
whose body had been severely damaged,
finally woke up".
The original reads 吞下大量药物自杀。幸运的是，在 ICU 抢救了六天后……终于醒来了:
an attempt she survived.
"Ended her life" asserts a death;
the page contradicts itself,
and `shi_Yumiaoya8` shipped the same sentence
("she ended her life by taking medication in the early hours of January 16"),
where `shi_Yumiaoya7` had "tried to end her life".
The log carries "ended her life" 12 times and no candidate wrote "attempted" or "tried".

Every ballot approved it as reader protection.
minimax-m3:
"It handles reader protection correctly for the suicide method:
'ended her life by taking a large amount of medication' keeps the general method vague while preserving the act of suicide".
deepseek-v4.1-flash:
"All three candidates ... use the vague method wording required by reader protection.
Candidate 1 renders 自杀 with the explicit phrase 'ended her life' ... which is compliant".
gemma-4-e2b:
"'took medication and ended her life' which is too specific per the house rules".
The rule prescribed the words:
the reader-protection line in `house-policy.ts` opened "When a death was by suicide"
and closed its method paragraph with "the page says that she ended her life,
and keeps the night,
the room and the dress,
not the means",
so 自杀 was written as a death whatever the original went on to say.

Fixed in `d29feecd5`
(guard red first at `a478ad64f`,
`survived-attempt-policy.unit.test.ts`,
three tests:
the house policy carries the clause,
the translate sheet carries it,
the select sheet carries it;
`HOUSE_POLICY_BLOCK` exported through the translate barrel for the built-artifact test).
The rule now continues:
"自杀 names the act,
not its outcome:
where the ORIGINAL goes on to a rescue,
a waking or a life that continues (抢救,
醒来,
幸存),
the person survived the attempt and the page says that she tried to end her life or attempted suicide;
'ended her life' and 'took her own life' assert a death,
and on an attempt survived they are a factual error,
not vagueness."
Lint 0 and 0,
types clean;
the full suite's result is recorded under the next heading.

### Observations, not classes

- The second `[^1]` marker of `shi_Yumiaoya8` is gone:
  the page carries one marker and one definition,
  as the source does.
- The Han residue of `shi_Yumiaoya8` is gone:
  补佳乐 ships "Progynova",
  贴贴 "cuddling",
  「逆子」 "unfilial child".
  The Han that remains is the source's own
  (the Truman Show quote's Chinese line in the bilingual blockquote,
  which the archive does NOT carry (the archive has the English line and its attribution alone;
  corrected under the shi_Yumiaoya10 heading of 03:50 UTC,
  class eighty),
  and the camera list inside the source's HTML comment).
- "three bottles of a certain sedative-hypnotic medication" for 三瓶某种镇静催眠药 in the final-tweet paragraph,
  where `shi_Yumiaoya8` had "a large amount of a sedative-hypnotic";
  the substance stays unnamed,
  the count is the original's,
  and the archive never carried this paragraph,
  so the judges own it under the replicability test.
- `a [movie](...) that they both loved` for the film link where `shi_Yumiaoya8` had "[name of a film]";
  "let it rot" for 摆烂;
  the heading "Departure" again.
- "little yao-niang" with the footnote where `shi_Yumiaoya7` glossed inline;
  the bench chose the footnote this run and last.

### shi_Yumiaoya10 launched

`shi_Yumiaoya10` (frozen `d29feecd5`,
pid 1846495,
overlap 8)
launched 02:51 UTC on Bedrock and OpenRouter
(meters 117.48 USD Bedrock,
173.89 OpenRouter at launch),
the `CORPUS NAMES` line naming the same five.
Read the January 16 sentence first
(an attempt,
never a death),
then class seventy-eight again,
then the seven steps and three checks against `shi_Yumiaoya9` and the archive.

## shi_Yumiaoya8 read, 2026-09-22, 02:20 UTC: SETTLED, class seventy-eight found (a handle the corpus declares in another entry rendered as a pinyin of nothing), fixed in 545bff7b9; shi_Yumiaoya9 launched

`shi_Yumiaoya8` (frozen `0f9cd44da`,
pid 1772617,
overlap 8,
launched 01:33 UTC on Bedrock and OpenRouter,
Synthetic and Hyper dry)
SETTLED at 02:01 UTC on one attempt,
28 minutes by the artifact,
against `shi_Yumiaoya7`'s 62.
Seats asked 921,
52 retry rounds,
812 calls,
3 abandoned streams (0.0012 USD),
Qwen3.8-27B and glm-5.3 dark all run (118 and 78 asked,
all threw,
Synthetic dry),
Jev 24 of 24.
Meters:
Bedrock 118.13 to 117.81,
OpenRouter 174.96 to 174.39,
0.89 USD;
the spend lines say 0.86 USD on OpenRouter.

The checks.
Front matter equal,
4 of 4 headings,
the photo component as the source,
the death paragraphs (slice 13) on the page,
the closing quote's attribution once (`From *The Truman Show*`,
class seventy-four holding),
no `TA`,
no `finish_reason=error`,
no double blank line,
no `PublishedPageDisagrees` or weight-off line,
attempts 1,
no unendorsed,
gate-kept or slate-declined standing,
13 abstention lines with reasons,
no repeat or run-off finding,
7 em-dashes on a page whose archive has none
(`shi_Yumiaoya7` 6),
left as the owner said on 2026-09-21.
Eighteen slices,
14 changed by the translate lane,
2 by the repair lane.

Class seventy-eight.
The paragraph after the ICU names two people who died in the same month,
口香糖 and 单片,
and the page ships "the successive deaths of Xiaoguantang and Danpian".
"Xiaoguantang" is the pinyin of nothing
(口香糖 reads kouxiangtang;
`shi_Yumiaoya7` wrote "Kouxiangtang").
The corpus itself declares both people:
entry `a2581911655` carries `name: 奇妙的口香糖`,
`alias: 口香糖` and its English page `name: Magic Chewing Gum`,
`alias: Chewing Gum, jjlin1219`;
entry `interrgned` carries `name: 单片` and `alias: Danpian`.
The class seventy-one glossary reads names off the page's own archive,
which never carried this paragraph,
so nothing told the bench.
Three of five consolidation candidates transliterated,
one wrote "Chewing Gum",
one left the Han,
and the judges weighed "a phonetic transliteration" against "a translation of a form"
(minimax:
"The declared names section does not specify how 口香糖 and 单片";
gemma-4-26b:
"there is no declared name for 口香糖,
all candidates are somewhat guessing")
and chose candidate 5,
the transliteration.
Fixed in `1cdbeea75` and `545bff7b9`,
guard red first at `e284a6ebc`:
`corpus-name-index.ts` reads every entry's `page.md` and `page.en.md` front matter at the pin
(1.6 s over 92 entries,
148 names),
pairs each Han name or alias with every form the entry's translation declares,
and `pass-prepare.ts` joins the names this original carries to the identity context beside the page's own renderings,
with a `CORPUS NAMES entry=<id> named=<n>` line.
Measured over the pinned corpus before shipping:
猫猫 is declared by two entries and carried by 26 of 92 pages as the ordinary word,
so a form two entries declare names nobody and is dropped;
岁月,
不存在 and 贴贴 are declared handles other pages carry inside ordinary words
(灰暗岁月里,
不存在的真相,
贴贴图),
and Chinese prose marks no word boundary,
so the heading says a handle that is an ordinary word here stays a word and the judges decide.
After the drop 22 of 92 pages carry lines.
On `shi_Yumiaoya` the line names 贴贴 (the cuddle plan,
an ordinary word here),
盐田,
紫壑,
口香糖 and 单片;
`shi_Yumiaoya9` reads whether the bench renders the two handles as their entries do and leaves 贴贴计划 a plan.
Lint 0 and 0,
types clean,
full suite green on both commits.

Observations,
not classes.
The January 16 sentence ships "she ended her life by taking medication in the early hours of January 16"
for 吞下大量药物自杀,
two sentences before she wakes in the ICU;
`shi_Yumiaoya7` wrote "she tried to end her life".
The source says 自杀 and the ballots chose the "safe 'taking medication' phrasing" on the reader-protection rule;
English asserts the death the source's next sentence denies.
The judges keep deciding wording,
as the owner said of headings on 2026-09-21,
and the read of `shi_Yumiaoya9` watches the sentence.
The source's one `[^1]` on 小药娘 ships as a footnote this run
(`shi_Yumiaoya6` kept it,
`shi_Yumiaoya7` glossed it inline),
and the bench added a second `[^1]` on the 药娘 line the source leaves bare
(2 markers against the source's 1,
one definition,
which itself says the term applies throughout),
with the term in italics;
a judge praised "'minor yaoniang [1]' exactly as the house rules prescribe".
Han residue in the English:
"estradiol valerate tablet (补佳乐)",
"贴贴 (cuddling) plans",
"insulted as a 「逆子」";
`shi_Yumiaoya7` rendered all three.
The film link ships `[name of a film](...)` for the source's 一部电影 where `shi_Yumiaoya7` named the film;
the third heading ships "Departure" for 关于鱼喵的离世 where `shi_Yumiaoya7` wrote "About Yumiao's Departure".

`shi_Yumiaoya9` (frozen `545bff7b9`,
pid 1820803)
launched 02:14 UTC;
its log carries the `CORPUS NAMES` line with the five names.

## mikaela6 read, 2026-09-22, 01:35 UTC: SETTLED, classes seventy to seventy-seven holding on the mikaela page, three translator additions dropped by the bench as observations; shi_Yumiaoya8 launched

`mikaela6` (frozen `0f9cd44da`,
pid 1765655,
overlap 8,
launched 00:58 UTC on Bedrock and OpenRouter,
Synthetic and Hyper dry all run)
SETTLED at 01:29 UTC on one attempt,
40.0 minutes by the artifact,
against `mikaela5`'s 27 with Synthetic wet
(Qwen3.8-27B and glm-5.3 threw all 411 of their calls this run,
68 retry rounds against 54).

The classes on the page.
Class seventy holds:
the closing excerpt line curls its possessive after the link.
Class seventy-one holds:
the dialogue line reads 𝓠𝓾𝓪𝓷 and the comment block ships as the archive has it.
Class seventy-two holds:
炸柜 ships "Mika was outed" from the translate lane
(`mikaela5` wrote "outed against her will");
two abstentions on that round read the glossary meaning as forcible and declined "outed" as short of it,
gpt-oss read the term as running away,
and the lane settled on the plain passive.
Class seventy-three holds:
slice 28 (the Epilogue) consolidated on its first slate round,
and the Epilogue ships the source's fourteen lines one to one
(four prose lines,
"One night",
"During a phone call with Mika in a group chat",
seven quoted lines,
the XYN origin line,
the excerpt).
Class seventy-four:
no `repeats the line` finding and no doubled attribution.
Class seventy-five:
one triple newline on the page,
the archive's own after "Those were Mika’s last words",
and the publish weight check silent.
Class seventy-six:
the life in the past on every line
("was a 16-year-old from Beijing",
"She was a top student",
"She enjoyed playing").
Class seventy-seven:
not exercised,
the page has no archive-only block
(no archive block review line in the log).

Three translator additions the bench dropped,
observations and not classes
(the same reading as hulicaijia7's two notes and CuspariaKLSY5's gloss line):
"trans girl" in the opening line,
where the source line names only her age and Beijing and the repair lane won the slice;
the dollar conversion gloss after ¥20,000,
where the source names 两万块钱 alone;
and the parenthetical after Huai An naming her as 𝓠𝓾𝓪𝓷's high-school classmate,
which the archive took from its own translator comment
(the comment ships unchanged among the page's four).
The 老师 honorific on 怀安老师 is dropped with it.
The excerpt's magazine title ships in pinyin
("Mingju,
Xingliuge,
Xinghenzhi")
where the archive wrote "Chronicle" and `mikaela5` a word-for-word rendering;
bench variance on a title with no glossary form.
One spaced em-dash enters on the "Love never really goes away" line
against the archive's ellipsis
(page 4 em-dashes to the archive's 5),
left as the owner said on 2026-09-21.
One abstention cited the reader-protection rule against "Progynon Depot"
(the HRT purchase on slice 14,
not the death),
deepseek-v4.1-flash alone on one repair round;
the name ships as the archive has it.

The page.
Thirty-three slices,
25 changed by the translate lane,
16 by the repair lane,
21 changed on the page,
seven standing as the archive.
Front matter equal,
4 of 4 headings,
2 PhotoScroll,
2 footnote definitions,
37 blockquote lines as the archive,
4 translator comments as the archive,
no `TA`,
no `finish_reason=error`,
no `PublishedPageDisagrees` or weight-off line,
attempts 1,
two unendorsed standings as findings
(slices 0 and 29,
both settled-neither with the archive declined),
gate-kept and slate-declined standings as findings,
52 abstention lines with reasons,
no repeat or run-off finding.

Seats asked 2062,
68 retry rounds,
1822 calls,
7 abandoned streams (0.0043 USD),
Qwen3.8-27B dark
(284 asked,
284 threw)
and glm-5.3 dark
(127 asked,
127 threw)
on Synthetic dry,
GLM-5.3-Flash 7 of 110 threw,
Jev 59 asked,
59 usable.
Meters:
Bedrock 118.70 to 118.13,
OpenRouter 175.83 to 174.96,
1.44 USD;
the spend lines say 1.41 USD.

Nothing to fix from this read.
`shi_Yumiaoya8` (frozen `0f9cd44da`,
pid 1772617,
overlap 8)
launched 01:33 UTC as the stalest entry in the queue
(last read on `364b83557`),
meters at launch Bedrock 118.13 and OpenRouter 174.96.

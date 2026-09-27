# Audit ledger

Every finding of the whole-package audit the owner asked for on 2026-09-27
("audit the whole translation-repair pkg for all the mistakes we've made and fix all of them",
"Mistakes made, ever, for this pkg, not just today").
Each finding carries where it is,
the evidence,
the fix,
the guard,
and its status.
A finding leaves this ledger only when its fix and guard have landed,
and its lesson then lives in the prevention doc.

Probe scripts and their outputs stay outside the repository,
under `~/temp/agent/audit-<area>/`,
because they read the pinned corpus,
which is never committed.

## Community and fandom glossaries

Probes: `~/temp/agent/audit-community-glossary/`
(`corpus-floor`, `overreach`, `probe-floor`, `probe-163`, `probe-more`).
Files: `src/community-glossary.ts`,
`src/community-glossary-fandom.ts`,
`src/translate-community-term.ts`.

### C1: refused forms match as raw substrings

Status: open (task #371).
`renderingCarries` and `refusedFormIn` in `src/translate-community-term.ts` check no word boundary,
and a rendering excuses a refused form only when it opens inside the occurrence and runs past its end.
The built floor refuses "inside her head mask",
"head-mask",
"headgear",
"headdress",
"Atri waited by the laboratories",
"Atri was dictatorial"
and "Arona came from Badalona".
头壳's own why calls the object a "full head mask".
Fix: match Latin forms at ASCII letter and digit boundaries,
excuse an occurrence any accepted rendering overlaps at any position,
add "head mask" to 头壳.
Guard: 小猫戴着头壳 passes "inside her head mask" and "inside her headgear" and refuses "inside her head";
亚托莉在猫舍 passes "Atri napped near the laboratories".

### C2: the 药娘 floor refuses a registered company name

Status: open, owner ruling needed.
mikaela_khara names a registered company 小药娘网络科技 (`page.md` lines 194 and 202);
the archive writes "XiaoYaoNiang(XYN)" and its translator's note gives the English name "XYN (Tianjin) Technology".
The floor refuses the archive and every mikaela run that rendered the name.
The class one hundred nineteen ruling refuses the term "even where the existing translation keeps it";
whether a registered name falls under it is the owner's call.

### C3: departures ignore inflection

Status: open (task #372).
`communityRenderingDepartures` names a departure for "Healing views",
"How hard this mental illness is to cure",
"becoming the doll",
"transgender girl"
and the MeowBot233 archive's own "soothing views".
The block text says "A rendering may inflect".
Fix: add inflected renderings after each lead rendering (the kigurumi guard pins 治愈's lead "healed"),
never a bare "heal" (it sits inside "health"),
and match at boundaries.
Guard: 猫可以治愈人 with "a healing cat" and 猫是药娘 with "a transgender girl" name no departure.

### C4: renderings count as present inside unrelated words

Status: open (task #371).
"cured" inside "secured",
"outed" inside "shouted",
"atri" inside "psychiatric" hide real departures.
Guard: 猫被治愈 with "The cat was comforted and secured" names a departure.

### C5: whys promise refusals the refused forms do not carry

Status: open (task #372).
变娃 passes "doll up",
"dolls up",
"dolled-up";
头壳 passes "Her head was large and heavy" and "their head";
跨圈 passes "crossdresser community" and "across different communities";
药娘 passes "little HRT girl",
"medicine girl"
and tone-marked "Yào Niáng";
逆子 passes "rebellious child",
the form class one hundred fifty-one shipped twice.
Guard: one cat fixture per gap.

### C6: false or page-specific whys and comments shown to the models

Status: open (task #372).

- 炸柜's why pairs it with throwing away the medication,
    true of XIEPT2 only and false on mikaela_khara.
- 治愈's comment,
    why and the kigurumi test contrast it with 安慰,
    and the planning doc and handover repeated that contrast to the owner:
    TianqiChen666 writes 安抚 (`page.md` line 89),
    never 安慰.
    The owner's "Healed first" still stands on the fandom "healing" and the archive's "healed";
    the owner is told of the misquotation.
    "soothed" stays accepted,
    since MeowBot233's archive renders 治愈人的风景 as "soothing views".
- 治愈's why names one page's use and prints on shihai4h and MeowBot233.
- The header comment says "No candidate is barred by it",
    false since class one hundred nineteen,
    and "A term the archive got wrong is not entered",
    false for 炸柜,
    阿洛娜,
    亚托莉,
    变娃 and 治愈.
- The block heading "rendered as the archive and the community render them" is false where the archive departs.
- 变娃's "who then stays silent" conflicts with the doll's quoted speech.
- 柜门炸开's "never a literal door" beside the accepted "blown out of the closet".

### C7: sibling spellings missing

Status: open (task #372).
爆柜 (Anilovr) and 跨性别圈 (GLaDOSister) have no entries.

### C8: comments cut on the floor side only

Status: open (task #371).
The floor cuts HTML comments;
`communityRenderingDepartures` and the sheet term lines do not.

### C9: the two floor messages name the term differently

Status: open (task #371).
One uses the trimmed term,
the other the raw one.

### C10: terms match inside other words

Status: open (task #372).
自切 inside 各自切,
亲自切,
独自切.
"trans circle" is redundant beside "trans circles".

## Rendering glossaries

Probes: `~/temp/agent/audit-rendering-glossary/`.
Files: `src/rendering-glossary*.ts`.

### R1: " OD" misses lowercase and line-start OD, and SHIPPED

Status: open (task #371).
hulicaijia opens a paragraph with `OD`;
XingZ60 writes lowercase `od` four times.
XingZ6014 shipped "I hate od, / so once z60 started od,"
and XingZ6010 "I hate od, / … started od'ing".
The comment claiming every OD stands after a space is false in `src/rendering-glossary.ts`,
`src/rendering-glossary-owner-forms.unit.test.ts`
and the planning doc.
" OD" also matches inside " ODE".
Fix: case-insensitive Latin-token matching for terms that carry Latin letters,
on the source and on the Han-kept check.
Guard: 小猫讨厌 od and a line-start OD are refused when kept;
"an odd cat",
"recited an ode"
and 写 MOD pass.

### R2: 燃油车 refuses "fossil-fuel car"

Status: open (task #372).

### R3: 未成年 "minor trans" fires inside transgression, translation, transfer

Status: open (task #371 boundaries, task #372 forms).

### R4: 滑档 refuses ordinary motion verbs

Status: open (task #372).
"slipped into a low mood",
"tears slid down her face"
and "slid to the floor" are refused.
Fix: key the refusals on the tier.

### R5: 化作 "turned into in " refuses grammatical English and is a sentence lesson

Status: open (task #372).
"That butterfly is what the kitten turned into in spring" is refused.
Fix: move the lesson to `GRAMMATICAL_ENGLISH_RULE` and correct the comment.

### R6: 摆烂's why prescribes one page's sentence

Status: open (task #372).
On lxy "stopped trying" is a mistranslation of 偶尔摆烂.
"slack off" register is an owner question.

### R7: 矫正中心 and 矫正学校 missing

Status: open (task #372).

### R8: 师范学院's why promises an official-name exception the floor refuses

Status: open (task #372).
"normal school" is dated English,
not a calque.

### R9: three whys write "gaokao" while 高考's line refuses it

Status: open (task #372).
Guard: no why carries a form another entry refuses.

### R10: 亲友 "close friends" fires inside "close friendships"

Status: open (task #371, task #372).

### R11: 交往 lists "dated" on the one page where it never means dating

Status: open (task #372).

### R12: 抢救's renderings carry "intensive care"

Status: open (task #372).

### R13: sentence lessons and page-specific whys in word entries

Status: open (task #372).
学霸 (属性),
未成年,
志愿填写,
三剑客.

### R14: refusal overreach without boundaries

Status: open (task #371).
"wish form" in "a wish formed",
"threatened her life" in "lifelong",
"head of year" in "ahead of year-end",
"erben" in "verbena".

### R15: refusal gaps

Status: open (task #372).
"type II diabetic",
"diabetes type II",
"threatens her life",
`JK裙`.

### R16: false or stale comments

Status: open (task #372).
初中 counts,
激素 "two of them also write 药物",
the planning doc's 交往 count,
the double space before " OD" on the sheet.

## Canadian forms passes

Probes: `~/temp/agent/audit-canadian/`.
Files: `src/corpus-run/canadian-date.ts`,
`src/corpus-run/canadian-spelling.ts`,
`src/corpus-run/canadian-forms.ts`,
`src/corpus-run/prose-ranges.ts`,
`src/house-policy.ts`.

### K1: the date rewrite drops the comma after the year, and a test asserts it

Status: open.
aiyysk1 and aiyysk2 shipped "February 9, 2024 was Lunar New Year’s Eve."
The Language Portal of Canada requires a comma after the year when the sentence continues.
`canadian-forms.unit.test.ts` expects "March 13, 2024 in a box".

### K2: `closesRange` gets ranges wrong

Status: open.
Splits a range across a line break,
skips "until 4 May" and a list item "- 4 May:",
and mixes orders when both ends carry a month.

### K3: the closed word list leaves non-Canadian forms, including ones the house policy names

Status: open.
Missing inflections of listed stems,
"judgement" and "summarise" shipped on XingZ6012 to XingZ6014,
"counselor",
"programmes",
"my mum".

### K4: ordinal and year-first dates left alone

Status: open.

### K5: withdrawn slices ship raw archive text

Status: open, by reading.
`restoredOnly` drops the Canadian row of a withdrawn slice and the archive text ships unconverted.

### K6: the house policy writes "capitalised" and "judgement"

Status: open.
Its spelling test checks four forms.

### K7: `prose-ranges.ts` protects too much

Status: open.
A quote mark inside a JSX comment and a stray backtick protect the rest of the text.

### K8: small wrong rewrites

Status: open.
"5 May beetles",
"the 4th May",
"4 May2024",
accented neighbours.

### K9: quoted lowercase English is respelled though the README says it is kept

Status: open.

### K10: underscore and slash edges

Status: open.

### K11: capitalized listed words at a sentence start are never respelled

Status: open.

### K12: test names claim more than they check

Status: open.

### K13: the house policy's "-re" line omits "meter" the device

Status: open.

## Consolidation gate

### G1: the gate sheet says choosing an ineligible standing stops the entry

Status: open (task #373).
Since class one hundred eighty-five (`419605ff4`) a gate preferring an ineligible standing ships the slate's choice,
but `buildConsolidateGateMessages` still says 'Choosing "standing" stops this entry with no page',
and the `standingEligible` TSDoc in `src/consolidate-settle-gate.ts` says a gate keeping it ends the slice.
Over an ineligible standing every gate verdict now ships the consolidation;
whether the gate should still run there is an owner question.

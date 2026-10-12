# Translation repair history: 2026-08-15 to 2026-08-19, segment 2, part 02

Part 02 of [Translation repair history: 2026-08-15 to 2026-08-19, segment 2](translation-repair-history-05-2026-08-15-to-19-segment-02-part-01.md),
whose index lists every part in order.

## Continued record, continued

### The insertion result: the length habit is ruled out

SIXTEEN TRIALS,
FOUR PAIRS,
the same four entries the deletion spread used,
so
the comparison is within-document.
EVERY TRIAL CHOSE THE COMPLETE TEXT,
which
here is the SHORTER candidate.
A roster preferring length would have scored
sixteen of sixteen on the deletion and ZERO of sixteen here.

THE BALLOTS ARE STRONGER THAN THE TALLY.
Ninety-five ballots:
64 for the complete
text,
31 declining,
and NOT ONE for the text carrying the borrowed sentence.
Every judge that chose at all chose correctly.
Per judge:

- `hf:Qwen/Qwen3.6-27B`:
  16 clean,
  0 damaged,
  0 declined
- `hf:moonshotai/Kimi-K3`:
  15 clean,
  0 damaged,
  1 declined
- `hf:zai-org/GLM-4.7-Flash`:
  14 clean,
  0 damaged,
  1 declined
- `hf:zai-org/GLM-5.2`:
  13 clean,
  0 damaged,
  3 declined
- `hf:openai/gpt-oss-120b`:
  5 clean,
  0 damaged,
  11 declined
- `hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4`:
  1 clean,
  0 damaged,
  15 declined

THE REASONS NAME THE ADDITION AS UNSUPPORTED,
which is the reading that matters:
"adds an entirely fabricated sentence at the end that has no basis in the
original Chinese text",
"appends a completely unrelated,
hallucinated sentence",
"appends a sentence that does not exist anywhere in the original".
28 of the 95
reasons QUOTE THE CHINESE directly while comparing (`占有欲很强`,
`温柔可爱`),
which is evidence the judges consulted the original rather than only weighing the
English against itself.

WHAT THE PAIR OF FIXTURES NOW LICENSES:
the roster is not running a status-quo
reflex,
a position preference,
or a length preference.
Each of those scores half
or zero across the two fixtures,
and the roster scored both in full.

WHAT IT STILL DOES NOT LICENSE,
and this is the honest ceiling:
"verified against
the source" is a stronger claim than the fixtures support.
A judge that never
reads the Chinese but prefers whichever English READS BETTER passes both,
since
the deletion leaves a gap in the argument and the borrowed sentence is a topical
non-sequitur.
The quoted-Chinese reasons are evidence against that reading rather
than proof,
because a reason is written after the choice.
What would settle it is
a fixture whose damaged candidate reads BETTER than the archive's English while
saying something the original does not,
which is the hard case `#84` still
carries.

### The deletion arm was leaving an edit-mark, and the rerun says it did not matter

FOUND BY LOOKING RATHER THAN BY A FAILURE.
A sentence is stored trimmed and prose
separates sentences on both sides,
so cutting the sentence alone leaves BOTH
separators.
Measured on the fixture text:
a mid-paragraph deletion left a DOUBLE
SPACE at the join,
and deleting a trailing paragraph left THREE CONSECUTIVE
NEWLINES.
Either is a typographic edit-mark visible without reading a word of the
original,
which would have let the damaged candidate lose on tidiness while the
run was recorded as a coverage reading.

`src/fidelity-splice.ts` removes the sentence and ONE of the two whitespace runs,
keeping whichever the structure needs:
the trailing run at the end of the text,
the leading one at the start,
the STRONGER one in the middle.
Written beside the
fixture rather than inside `applySeededErrors`,
because the recall benchmark and
the introduced-defect probe are measured against what that shared primitive does
today.

THE ARM WAS RERUN CLEAN,
and the number holds:
16 of 16 again,
over the same four
entries.
92 ballots this time:
60 for the complete text,
2 for the deletion (both
`GLM-4.7-Flash` again),
30 declining,
with three voices lost to the grace period.
So the judges were not reading the join,
which is the one thing the first run
could not say about itself.

TWO OF THE GUARDS I WROTE FOR THE FIX WERE PASSING FOR THE WRONG REASON,
which is
worth recording because it is the same failure GFP exists to catch,
one level in.
`deriveOmissionSeeds` picks the LONGEST sentence,
and in both paragraph fixtures
that sentence sat in the first paragraph,
so the cut landed at the START of the
text and neither test ever produced the middle or trailing join it was named for.
Both passed under a bare cut.
The fixtures now put the longest sentence where the
test needs the cut,
and all three guards fail without the splice.

### The third fixture: a number only the original can adjudicate

WHAT DELETION AND INSERTION CANNOT DO between them is show that the source was
READ.
Both are decidable by an English-only reader with taste,
which is exactly
the reading the two results cannot exclude.

AN ALTERATION CHANGES A NUMBER THE ORIGINAL ALSO STATES.
Digits survive
translation:
a birth year written `2004年` in the Chinese is `2004` in the
English,
so the same run of characters sits on both sides.
Changing it in the
English alone leaves a candidate of the SAME LENGTH,
equally fluent,
equally in
register,
and wrong about a fact that no amount of reading the English reveals.

GROUND TRUTH IS VERIFIED RATHER THAN ASSUMED,
which is what makes this stronger
than a dropped qualifier:
the number is used only when the English states it
exactly once and the Chinese carries it,
and the replacement only when NEITHER
side carries it.
So the clean text is supported by the original and the damaged
text is supported by nothing.

WHAT IT WILL NOT PROVE even if the roster passes:
that judges consult the source
on ordinary slices.
It shows whether they CAN,
on a slice where nothing else can
decide.
That is still the strongest reading available without human grading.

### The alteration result, and the thing it turned up underneath

TWELVE OF SIXTEEN chose the complete text,
over `AmbeR_the_anpa`,
`Arita`,
`Chinatsu_Suzuki` and `Dethelly` (the fourth entry differs from the other two
arms because `CuspariaKLSY` states no number both sides share).
96 ballots:
55
for the complete text,
41 declining,
and AGAIN NOT ONE for the damaged text.

SO NO JUDGE EVER PICKED THE WRONG NUMBER.
Every miss is a roster that declined
rather than a roster that chose wrongly.

THE REASONS ARE THE POINT HERE,
because this is the fixture built to ask whether
the source is read at all:
"Candidate 1 correctly preserves the birth year 2004
from the original",
"Candidate 2 incorrectly alters the birth year from 2004 to
2005,
violating the faithfulness criterion regarding time",
"a direct
faithfulness error on a number/time fact".
They name the number the ORIGINAL
states.
86 of 96 reasons appeal to the original explicitly.

ALL FOUR MISSES ARE ONE SLICE,
`Dethelly/0`,
in all four arrangements,
and the
roster was RIGHT to refuse it.
That slice is where the interesting thing is.

### A relocation reads as a fabrication, and the judges condemn the archive twice

WHAT IS ON THAT SLICE,
read directly rather than taken from the judges.
The
Chinese `## 简介` is one sentence:
Sugar is a girl from Chongqing who came to
Hangzhou in autumn 2023 for university.
The English `## Description` carries that
sentence WITHOUT Chongqing,
plus four sentences about being introverted,
caring
too much about others' feelings,
being too shy to express confusion,
having
nobody to confide in,
and looking intimidated.

THE JUDGES CALLED THAT HALLUCINATED.
They are right about the slice and wrong
about the document:
内向,
焦虑,
倾诉,
困惑 and 在意 all appear in the Chinese,
and
the NEXT Chinese slice is exactly that material.
The English moved it up a
section.
Alignment is not at fault:
24 slices,
zero findings,
every heading
pairs.

THE RATIOS CORROBORATE IT,
which is what makes this evidence rather than a
reading:

- whole document:
  3.06,
  which is ordinary Chinese-to-English expansion
- median slice:
  3.31
- slice 0:
  11.51,
  content moved IN
- slice 1:
  2.08,
  content moved OUT

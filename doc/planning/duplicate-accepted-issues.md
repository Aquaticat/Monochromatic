# Duplicate accepted issues

Measured 2026-08-13 over the 56 settled artifacts in
 `translation-repair-runs`, covering 2650 accepted issues across 54 entries.
This is a PROPOSAL for `#65`, which asked whether duplicates count against
 precision and whether the pipeline should stop emitting them.
Nothing here is decided.

## The pipeline deduplicates on identity, and identity never repeats

```text
duplicates within one entry, extra copies beyond the first

  same issueId                  0    0.0% of accepted
  same summary text             4    0.2%
  same spans AND same category  412  15.5%
  same spans, any category      570  21.5%
```

The zero is the finding.
`issueId` is a hash of the adjudicated issue, and the adjudicated issue carries
 the claim's summary wording, so two critics describing one defect in two
 sentences produce two identities and both survive every gate.
Deduplication that keys on identity cannot see this and never could.

## They are the same defect, not two defects in one region

The obvious objection is that a span might genuinely carry two distinct
 problems.
Span width refutes it:

```text
span width in characters covered by the claim

  duplicate-span issues   n=570   median 60   p90 135   max 562
  first-of-span issues    n=2080  median 56   p90 123   max 564
```

The duplicated spans are the same size as everything else, median 60
 characters.
That is roughly a sentence.
A 60-character span holding two separate omissions is possible; 170 of them are
 not.

The category pairings say the same thing.
The three commonest are a category paired with ITSELF:

```text
  170  accuracy/omission        +  accuracy/omission
   74  accuracy/addition        +  accuracy/addition
   71  accuracy/mistranslation  +  accuracy/mistranslation
   33  accuracy/mistranslation  +  accuracy/omission
   25  accuracy/addition        +  accuracy/mistranslation
   20  fluency/grammar          +  fluency/grammar
```

Cross-category pairs are the minority and some are legitimately distinct:
 a passage can be both mistranslated and emotionally flattened.
Same-category-same-span is not that.

## The cost is real work done twice

```text
duplicate-span issues that shipped a repair          564 of 570
duplicate pairs where BOTH copies carried regions    567
```

So this is not bookkeeping.
The editor was asked to repair the same sentence twice, the checkers verified
 both, and the introduced-defect probe judged both.
Every stage after adjudication paid for each copy.

Spread rather than concentrated: 44 of 54 entries carry at least one, so no
 single bad entry explains it.

## What it does to precision

The graded sheets drew issues uniformly, so a defect claimed twice had two
 chances to be drawn.
That does not bias precision in a knowable direction, because a duplicated
 defect is as likely to be a true positive as a false one; what it does is
 weight the sample toward defects that attracted more than one critic.

Whether that is a distortion worth correcting depends on what the number is
 FOR.
As "what fraction of what we ship is right", counting duplicates is correct,
 since the pipeline really does ship both.
As "what fraction of the defects we find are real", it is wrong, since one
 defect is being counted twice.
Both readings have been used in this project, which is itself worth settling.

## Options

### Option A: collapse on span overlap at the accept gate

Merge accepted issues whose spans overlap and whose categories match, keeping
 the strongest severity and both claim texts as evidence.

Pros:
 removes the duplicated work at the point where it is cheapest, before the
 editor;
 the accept gate already merges clusters, so the mechanism exists;
 makes every downstream count mean one defect.

Cons:
 overlap is not identity, so a genuine second defect in one sentence would be
 merged away;
 changes what every existing measurement counted, so prior numbers stop
 comparing.

### Option B: collapse only on exact span equality and category equality

The narrow version. Merge only where spans match exactly.

Pros:
 provably safe against merging distinct defects at different offsets;
 still catches 412 of the 570, which is the bulk;
 the smallest change that could work.

Cons:
 misses the 158 that overlap without matching exactly;
 an off-by-one in a critic's offsets defeats it entirely.

### Option C: leave the pipeline alone and report duplicates as telemetry

Count them, surface them per entry, decide later.

Pros:
 costs nothing and risks nothing;
 keeps every existing measurement comparable;
 a duplicate is evidence that two critics independently saw the same thing,
 which is corroboration and might be worth keeping as a signal.

Cons:
 the duplicated editor, checker and probe work keeps being paid for;
 every issue-denominated rate keeps double-counting.

## Ranking

B > C > A.

**B over C** because 15.5% of accepted issues driving duplicate repairs is a
 real cost being paid every pass, and exact-span-and-category equality is a
 conservative enough key that it cannot merge two defects sitting at different
 offsets. C is the safer choice only if the corroboration signal turns out to be
 worth more than the wasted work, and nothing has measured that.

**C over A** because A's overlap key is the one that can destroy information.
 Two genuinely distinct defects in one sentence would be merged and one of them
 silently lost, and a lost defect is invisible in exactly the way this project
 keeps being bitten by. C wastes work; A can be wrong.

## What must be settled first

-   Which reading of precision the project uses, since the two readings
    disagree about whether duplicates should be counted at all.
-   Whether a duplicate should be kept as a CORROBORATION signal. Two critics
    independently claiming one span is evidence the defect is real, and the
    adjudication panel currently cannot see that they agreed, because the two
    claims arrive as unrelated issues.

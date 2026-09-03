# Judge seats follow the provider that would serve them

Decided by the owner on 2026-09-03 ("Seat per provider reach"), in answer to the question the
morning's drop of Qwen3.8-27B raised. Landed in `package/module/translation-repair/src/corpus-run/run-seats.ts`.

## The evidence

- Served by Hyper, `hf:Qwen/Qwen3.8-27B` reasons past the 60 s round window in every judge role:
  cut in 30 of 34 translate-lane and 21 of 24 consolidation-slate select rounds on XIEPT2 with Hyper the
  only provider (2026-09-03), and on Carena0442 (1,648 of 1,938 calls on Hyper) in 14 of 19 and 11 of 19
  select, 13 of 25 critic, 15 of 19 panel, 17 of 19 lane-contest and 7 of 14 consolidation-gate rounds.
- Served by Synthetic (Toka_ls, 2026-09-02) it answered 25 of 28 select rounds.
- So the seat is lost to one provider's serving speed, not to the model. Dropping it outright
  (`4ad08d5dc`, the morning's answer under the standing authorisation to drop a model on evidence) threw
  away a judge Synthetic serves well.

## The rule

- `HYPER_SLOW_JUDGES` names the judges Hyper serves too slowly for the window: Qwen3.8-27B today.
- Before each phase of an entry (lanes, lane contest, consolidation; once per entry until 2026-09-03),
  `readJudgeSeats` reads Synthetic's meter through the routed client's quota surface
  and derives the benches: with Synthetic dry the Hyper-slow judges are withheld from the wide seats
  (critics, panel, both lanes' select judges) and the late seats (lane contest, consolidation slate,
  consolidation gate); with Synthetic wet they sit. The static benches in `run-config.ts` are the
  Synthetic-wet ones: seven wide seats (quorum 4) and eight late judges; six (quorum 3) and seven when dry.
- An unreadable meter seats the full bench: it is not evidence of dryness, and a seat asked in vain
  costs one cut where a seat withheld on a guess costs a voice.
- Writer seats are untouched: translator, checker, introduced-defect probe, pairing and insertion
  admission keep the roster.

## What this cannot do

- The router chooses per call: Synthetic first until the model's per-model concurrency is taken, then
  Hyper. With Synthetic wet a burst could overflow some of this seat's calls to Hyper, and those may
  be cut; the seat follows the state that decides most calls, not each call. Measured on keyword233
  at overlap 4 (2026-09-03, `~/temp/agent/keyword233-seats-20260903`): none did, every Qwen call went
  to Synthetic.
- Synthetic serves the seat slowly too, only less often: on that run it was cut from 5 of 21 judge
  rounds on Synthetic (67 to 85 seconds of reasoning), against 30 of 34 and 21 of 24 on Hyper. The
  seat buys 16 answers in 21 there; the rule does not make it a fast judge.
- One reading per entry is too coarse for a long entry. XIEPT2 the same day read wet at 08:16, Synthetic
  ran dry at 08:19, and the seat sat on Hyper for three and a half hours: abandoned in 102 judge calls,
  75 rounds at the full 60 s grace, consolidation 134 minutes for 28 slices
  (`~/temp/agent/xiept2-postscript-20260903`). The meter is now read again before the lane contest and
  before consolidation, so a seat given at the lanes is withdrawn once Synthetic is dry.
- The Synthetic-wet path ran live the same day, at 1.5% of the weekly meter: `JUDGE SEATS
  synthetic=wet wide=7 late=8 hyper-slow seated=yes`, the rounds heard 7 of 7 thirteen times and 8 of
  8 six times.

## Rejected alternatives

- Leave the seat dropped: simplest, loses the judge in Synthetic weeks.
- Also drop Kimi-K3 under the same rule: it is cut in a majority of select and contest rounds on
  Hyper (17 of 34 and 18 of 24 on XIEPT2) but under half of critic and panel rounds, and the seat
  sets are coarser than that profile. Recorded as the next candidate; not seated per provider yet.
- A longer window for Hyper-served seats: reverses the owner's 2026-09-02 choice of the seat over the
  window, and under a 1,000-an-hour window the request, not the second, is scarce.

## Where the evidence lives

- `doc/planning/translation-repair-roster-calibration-2026-09-01.md`: the cut counts per seat and
  round kind, split by lane.
- `doc/decision/translation-repair-roster-seating-2026-09-01.md`: the 2026-09-02 and 2026-09-03
  addenda this supersedes in part.

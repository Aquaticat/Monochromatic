# Roster seating of 2026-09-01, on the two calibrations under the owner blocklist

The seating step of the owner's R3 order of 2026-09-01
(`doc/decision/translation-repair-roster-blocklist.md`: "code lands verified, calibration seats the roster,
four-entry pass, reading"), taken on the owner's delegation that calibration seats the roster and on the owner's
authorization of the same day to drop any model from any role given evidence.
The measurements, the meters, the spend and the rules as written before the numbers arrived are in
`doc/planning/translation-repair-roster-calibration-2026-09-01.md`;
this document records what was seated and why.

## What was seated

All in `package/module/translation-repair/src/corpus-run/run-config.ts`.

-   Editors: `hf:zai-org/GLM-5.3-Flash`, `glm-5.3`, `deepseek-v4-pro-0813`
    (were Kimi-K3, Qwen3.8-27B, gemma-4-26b-a4b-it).
-   Refiners: `hf:zai-org/GLM-5.3-Flash`, `deepseek-v4-pro-0813`, `minimax-m3`
    (were the editors).
-   Checkers: unchanged, Qwen3.8-27B, Kimi-K3, gpt-oss-120b, self-certification permitted at half weight;
    now disjoint from every editor and refiner by measurement rather than by rule.
-   Critics, adjudication panel and judges in both lanes: the roster less `glm-5.3` (`RUN_WIDE_SEATS`, eight).
-   Translators: the roster less `gpt-oss-120b` and `deepseek-v4-flash-0731` (`RUN_TRANSLATORS`, seven).
-   Roster membership: nine, unchanged by this decision; only the owner blocklist moves it.

## The editor seats

Instrument: `editor-calibrate` over 40 bench slices at build `48799e6d1`, every roster model editing and
judging every slice through the whole repair lane, four slices in flight, 300000 ms straggler window,
198 minutes wall clock.
Thirty slices carried an accepted issue and bought 111 judged editor rounds, 6131 disinterested ballots,
pooled null 15.8 percent.

Availability-adjusted share (raw share times candidates over the fullest model's 126), best first:

-   `GLM-5.3-Flash` 32.2 percent (221 of 669 disinterested ballots, z +12.25)
-   `glm-5.3` 21.4 (143 of 657, z +4.21)
-   `deepseek-v4-pro-0813` 18.8 (130 of 657, z +2.82)
-   `Qwen3.8-27B` 17.3 (121 of 688, z +1.31)
-   `Kimi-K3` 14.2 (101 of 682, z -0.69)
-   `gpt-oss-120b` 12.6 (93 of 739, z -2.38)
-   `minimax-m3` 8.4 (61 of 705, z -5.19)
-   `gemma-4-26b-a4b-it` 7.0 (56 of 767, z -6.44)
-   `deepseek-v4-flash-0731` 5.6 (41 of 567 over 97 candidates, z -5.58)

Slice-clustered reading (round wins off the log's winner lines, 99 winner-bearing rounds over 29 slices,
top-three inclusion over 4000 resamples of whole slices): `GLM-5.3-Flash` 100 percent, `deepseek-v4-pro-0813`
67.0, `glm-5.3` 61.4, `Qwen3.8-27B` 56.4, `Kimi-K3` 7.5, `gpt-oss-120b` 7.8, the rest zero.
The first seat is settled; seats two to four are a ranking the slices do not separate.
By the rule written before the numbers, the top three by adjusted share are seated, and where the third and
fourth seats are not separated the seat goes to the model that lost fewer voices under the 180000 ms production
window, read off the 180000 ms producer instrument: `deepseek-v4-pro-0813` lost none of 79 asks (completed
streams p90 4 s) and `Qwen3.8-27B` none of 77 (p90 77 s), so the adjusted-share order stands.
(In the 300000 ms editor run Qwen threw 11 of 367 asks to a Synthetic 503 storm that hit every Synthetic seat,
provider weather rather than the model, and not the instrument the rule names.)

The 6-slice replicate run the same day (14 rounds, 4 slices) put the same three models in its top three with
`Qwen3.8-27B` third and `deepseek-v4-pro-0813` fifth; it is reported as the band, not pooled in.

Two of the three seats are one model family.
The provider-coverage argument the old seat rested on still holds (Charm Hyper serves `glm-5.3` and
`deepseek-v4-pro-0813`, Synthetic serves GLM-5.3-Flash with a Hyper route as well), but a GLM blind spot is now
shared by two seats and only the third sits outside it.
Accepted on the measurement; it is the reason the standing is re-read rather than the seat assumed.

## The refiner seats

Same run: 25 judged refiner rounds from the 25 of 40 slices that carried a paragraph over the eligibility
floor, pooled as slice clusters with the 4 rounds of the 6-slice replicate (same build, instrument and window),
1393 disinterested ballots, pooled null 14.0 percent.

Availability-adjusted share, best first:

-   `GLM-5.3-Flash` 32.5 percent (66 of 172, z +9.21)
-   `deepseek-v4-pro-0813` 17.1 (35 of 205, z +1.27)
-   `glm-5.3` 12.1 (25 of 190, z -0.33)
-   `minimax-m3` 9.7 (20 of 103; it proposed a rewrite in 13 of 26 opportunities and declined the rest)
-   `Kimi-K3` 7.8, `Qwen3.8-27B` 7.7, `gpt-oss-120b` 4.3, `gemma-4-26b-a4b-it` 3.4, `deepseek-v4-flash-0731` 0.5

Slice-clustered reading (26 winner-bearing rounds over 26 slices): `GLM-5.3-Flash` 99.9 percent top-three
inclusion, `deepseek-v4-pro-0813` 97.5, `minimax-m3` 42.8, `glm-5.3` 24.3, `Qwen3.8-27B` 24.2.
Seats one and two are settled.
The third and fourth (`glm-5.3` by adjusted share, `minimax-m3` by round wins) are not separated, so the
pre-registered tie-break decides: `minimax-m3` lost no voices under the production window (p90 48 s) and
`glm-5.3` is the roster's slowest voice (15 of 78 asks lost), so `minimax-m3` takes the seat.

The transfer assumption the rules had allowed for ("refiners are the editors") was not needed:
the refiner seat is measured on its own job, and it differs from the editor seat in exactly one place.

## The wide seats and the translator seat

Recorded in the planning document and landed earlier the same day, both on the owner's role-drop
authorization:

-   `glm-5.3` left critic, panel and judge for wall clock: across both calibration logs 75 to 83 percent of round
    time is waiting after quorum, and it is the slowest voice in every role measured (completed streams p50 61
    to 66 s, p90 166 to 172 s; 11 of 38 select asks lost to the production window; one 3.4 M-character panel
    stream cut at the 360000 ms per-call deadline).
    It keeps the translator seat and now holds an editor seat, where its text is what is measured.
-   `gpt-oss-120b` and `deepseek-v4-flash-0731` left the translator seat as writers under the 40-round producer
    calibration's pooled null with full availability (5 of 207 and 5 of 208 disinterested ballots, 40 of 40
    candidates each).

## What this decision does not settle

-   Checker ranking. No instrument ranks checkers; `checker-sensitivity` asks whether they can say no on
    fixtures. The three stay as the width measurement of 2026-08-24 left them.
-   Judge accuracy. Neither instrument measures it; the wide seats are the roster less one voice dropped for
    latency, not for judgment.
-   `gemma-4-26b-a4b-it` in the wide seats. In the 40-slice run it lost 10 of 45 critic asks and 15 of 60
    introduced-defect-probe asks to malformed JSON (escaped quotes inside string values; the logged raw is
    truncated, so the exact failing field is not recoverable from the log). It is a candidate for a drop from
    those seats on the pass's own evidence, or for a guard reading if the shape turns out to be readable.
-   The pass's straggler window and overlap. The pass launches with launch-time overrides
    (`TRANSLATION_REPAIR_STRAGGLER_GRACE_MS=60000`, `TRANSLATION_REPAIR_SLICE_OVERLAP=4`) on the owner's
    fast-iteration principle (`FIT` in `AGENTS.md`); the built-in constants and
    `doc/decision/translation-repair-straggler-grace.md` are unchanged until a decision moves them.

## Where the evidence lives

-   `~/temp/agent/producer-calibrate-40-20260901.log`, `~/temp/agent/editor-calibrate-6-20260901.log`,
    `~/temp/agent/editor-calibrate-40-20260901.log`: the three runs.
-   `~/temp/agent/round-wins-bootstrap-20260901.mjs`: the slice-clustered reader.
-   `doc/planning/translation-repair-roster-calibration-2026-09-01.md`: standings verbatim, z tables, meters,
    spend, latency distributions, and the rules as pre-registered and revised.

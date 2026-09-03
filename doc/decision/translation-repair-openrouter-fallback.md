# Translation repair: OpenRouter is the paid fallback provider

Decided by the owner on 2026-09-03, answering four separable questions.
Evidence and method: `doc/planning/translation-repair-openrouter-2026-09-03.md`.
Extends `doc/decision/translation-repair-multi-provider.md`, which stays the record for Synthetic and Charm Hyper.

## Why

The owner, 2026-09-03: Charm Hyper ended its bundle subsidization,
so Hyper will not be recharged from the usual subscription;
OpenRouter is preferred for paying per token,
and Synthetic and Hyper are expected to run dry often.
`TRANSLATION_REPAIR_OPENROUTER_API_KEY` names the key.

## The owner's answers

- **Realtime, not batch.**
    A corpus pass is a chain of dependent rounds built on streaming quorum and grace,
    and OpenRouter batch's only completion window is 24 hours.
    The listed batch prices for this roster are never below the realtime prices,
    and two roster models have no batch entry.
- **Kimi-K3 is withheld where only OpenRouter would buy it.**
    At 3 and 15 USD per million tokens it was 52 to 61 percent of an entry's all-OpenRouter cost.
    It keeps every seat while Synthetic or Hyper serves it.
    This is the shape of the existing slow-judge withholding (`run-seats.ts`), keyed to reach rather than to dryness alone.

    CORRECTION, same day: the question told the owner Kimi-K3 "holds editor, refiner and checker seats".
    That was wrong. `run-config.ts` seats the editors as GLM-5.3-Flash, `glm-5.3` and `deepseek-v4-pro-0813`
    and the refiners as GLM-5.3-Flash, `deepseek-v4-pro-0813` and `minimax-m3`;
    Kimi-K3 holds the critic, panel, select-judge, late-judge and checker seats.
    The cost figure the answer rests on is unchanged.
    What thins on an all-OpenRouter day is each wide bench by one voice and the checker roster from three to two,
    which `assertCheckerQuorumReachable` refuses,
    so a disinterested substitute checker is seated there: `gemma-4-26b-a4b-it`,
    chosen because it holds no editor or refiner seat,
    answered 40 of 40 writer rounds with zero cuts and threw 5 of 289 asks on the stub-fix XIEPT2 run,
    and sat above the pooled null as a writer where `deepseek-v4-flash-0731`, the other disinterested candidate,
    sat below it in both writing measurements.
    That seat is provisional and open to the owner's veto; no checker-side measurement exists for any model.
- **The allowlist carries the whole roster.**
    The owner added `openai/gpt-oss-120b`, `google/gemma-4-26b-a4b-it` and `deepseek/deepseek-v4-pro-0813`
    to the account's model allowlist, so every roster model is buyable on OpenRouter.
    The question described gemma as a writer seat and the "add none" option as leaving "the editor stage on Qwen alone";
    gemma is a translator and Qwen3.8-27B a checker, and the editor stage was never at stake.
    The answer stands on its own terms: every roster model is now buyable there.
- **Zero data retention on every request.**
    `provider.zdr: true` goes on every call;
    every roster model kept at least seven ZDR endpoints on the day of measurement.

## Standing rules that follow

- Routing order: Synthetic while wet, then Charm Hyper while its balance lasts, then OpenRouter.
- Transport: the Anthropic Messages endpoint with forced tool use,
    the same protocol Hyper speaks, so the request builder and stream reader are shared.
    `provider.require_parameters: true` restricts routing to endpoints that support tools and tool choice;
    `provider.ignore` names any endpoint that measures badly.
    A model is seated on this provider only after a measured conformance probe, as on Hyper.
- Meter: `GET /api/v1/credits`, balance as purchased minus used;
    dry at or below zero, unreadable counts as spendable, `402` and `429` are refusal holds.
    The endpoint's page says a management key is required; the ordinary key answered `200` on 2026-09-03,
    and the meter is built on that live behaviour.
- Gemini 3.8 Flash is blocklisted on the owner's words: "a wildly misaligned model".
- `:free` variants are never used.
- Auto top-up recommended to the owner: threshold 20 USD, amount 20 USD a day's spend without Kimi on OpenRouter.

## Rollback

Seating Kimi-K3 on OpenRouter, or turning ZDR off, needs an explicit owner decision and fresh cost evidence.

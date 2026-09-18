import type { ModelCard, } from './model-card.ts';
import type { RosterModelId, } from './roster-id.ts';

//region Model cards
// THE ROSTER, ONE CARD EACH. Ordered by introduction: the Synthetic four,
// the Hyper-origin seats, then the Bedrock-only and OpenRouter-only
// arrivals; `ROSTER_MODEL_IDS` keeps this order. Evidence for each field
// and each hold lives beside the table that reads it (`hyper-catalog.ts`,
// `openrouter-catalog.ts`, `bedrock-catalog.ts`, `completion-cap.ts`,
// `openrouter-abandoned-spend.ts`, `run-config.ts`, `run-seats.ts`) and in
// `doc/decision/translation-repair-roster-seating-2026-09-01.md`.
//
// TO ADD A MODEL: run `mise run roster-card -- <provider> <served id>` for a
// card with the live listing's fields, paste it here with `completionCap:
// 'pooled-p99'` and the holds the seating rule requires (`judge-unmeasured`
// for a single-provider candidate, `writer-unmeasured` and
// `reader-unmeasured` for every candidate), then run the package checks.
// TO REMOVE ONE: delete its card and add its spellings to
// `roster-blocklist.ts` with the owner's words.

/**
 Every model this pipeline may seat, keyed by roster id, so a roster id
 without a card and a card without a roster id are both type errors.

 @example
 ```ts
 const card = MODEL_CARDS['minimax-m3'];
 ```
 */
export const MODEL_CARDS: Readonly<Record<RosterModelId, ModelCard>> = {
  'hf:zai-org/GLM-5.3-Flash': {
    synthetic: {
      id: 'hf:zai-org/GLM-5.3-Flash',
      family: 'zai',
      readsImages: true,
      contextLength: 524_288,
      maxOutputLength: 65_536,
      promptDollarsPerToken: 0.00000015,
      completionDollarsPerToken: 0.0000005,
    },
    hyper: {
      id: 'glm-5.3-flash',
      readsImages: true,
      maxOutputLength: 131_072,
    },
    openrouter: {
      id: 'z-ai/glm-5.3-flash',
      readsImages: true,
      maxOutputLength: 131_072,
      promptUsdPerMillion: 0.075,
      completionUsdPerMillion: 0.25,
      ignoredEndpoints: [],
      rawCharsPerToken: 297,
    },
    // Hyper p99 over 886 calls; Synthetic 16,342 over 4,775; OpenRouter
    // 13,070 over 1,853.
    completionCap: 18_316,
    // Owner, 2026-09-02: "Unseat GLM-5.3-Flash as a judge, keep it as editor".
    holds: [
      'wide-seat-dropped',
      'late-judge-dropped',
    ],
  },
  'hf:Qwen/Qwen3.8-27B': {
    synthetic: {
      id: 'hf:Qwen/Qwen3.8-27B',
      family: 'qwen',
      readsImages: true,
      contextLength: 262_144,
      maxOutputLength: 65_536,
      promptDollarsPerToken: 0.00000045,
      completionDollarsPerToken: 0.0000022,
    },
    hyper: {
      id: 'qwen3.8-27b',
      readsImages: true,
      maxOutputLength: 128_000,
    },
    // Synthetic p99 over 7,312 calls; OpenRouter 11,127 over 4,538; Hyper
    // 10,541 over 1,921.
    completionCap: 20_894,
    // Off the OpenRouter catalog since 2026-09-09: 24 percent of its calls
    // there were abandoned and billed to the end.
    holds: ['openrouter-dropped',],
  },
  'hf:moonshotai/Kimi-K3': {
    synthetic: {
      id: 'hf:moonshotai/Kimi-K3',
      family: 'moonshot',
      readsImages: true,
      contextLength: 524_288,
      maxOutputLength: 65_536,
      promptDollarsPerToken: 0.000003,
      completionDollarsPerToken: 0.000015,
    },
    hyper: {
      id: 'kimi-k3',
      readsImages: true,
      maxOutputLength: 16_000,
    },
    openrouter: {
      id: 'moonshotai/kimi-k3',
      readsImages: true,
      maxOutputLength: 943_718,
      promptUsdPerMillion: 3,
      completionUsdPerMillion: 15,
      ignoredEndpoints: [],
      rawCharsPerToken: 137,
    },
    // Hyper p99 over 2,777 calls; OpenRouter 8,254 over 488; Synthetic
    // 4,350 over 7,051.
    completionCap: 10_921,
    // Withheld from OpenRouter on cost (owner, 2026-09-03: 3 and 15 USD per
    // million); too slow in the select seats when Hyper serves it
    // (2026-09-03, `run-seats.ts`).
    holds: [
      'openrouter-withheld',
      'hyper-slow-select',
    ],
  },
  'hf:openai/gpt-oss-120b': {
    synthetic: {
      id: 'hf:openai/gpt-oss-120b',
      family: 'openai',
      readsImages: false,
      contextLength: 131_072,
      maxOutputLength: 65_536,
      promptDollarsPerToken: 0.0000001,
      completionDollarsPerToken: 0.0000001,
    },
    hyper: {
      id: 'gpt-oss-120b',
      readsImages: false,
      maxOutputLength: 13_107,
    },
    openrouter: {
      id: 'openai/gpt-oss-120b',
      readsImages: false,
      maxOutputLength: 117_964,
      promptUsdPerMillion: 0.037,
      completionUsdPerMillion: 0.17,
      ignoredEndpoints: [],
      rawCharsPerToken: 137,
    },
    bedrock: {
      id: 'openai.gpt-oss-120b',
      readsImages: false,
      contextLength: 131_072,
      maxOutputLength: 16_384,
      route: 'v1',
      streamEnd: 'usage-chunk',
      promptUsdPerMillion: 0.1545,
      completionUsdPerMillion: 0.618,
    },
    // Own p99 at most 3,649 (Hyper, 2,479 calls) over 21,111 calls on four
    // providers, under the pooled 90th.
    completionCap: 'pooled-p90',
    // Producer calibration of 2026-09-01: 5 of 207 disinterested ballots,
    // z -4.53 against the pooled null.
    holds: ['translator-dropped',],
  },
  'minimax-m3': {
    hyper: {
      id: 'minimax-m3',
      readsImages: true,
      maxOutputLength: 512_000,
    },
    openrouter: {
      id: 'minimax/minimax-m3',
      readsImages: true,
      maxOutputLength: 512_000,
      promptUsdPerMillion: 0.3,
      completionUsdPerMillion: 1.2,
      // Parasail and ModelRun cut a quarter or more of at least twenty
      // streams on 2026-09-03 and 2026-09-04.
      ignoredEndpoints: [
        'parasail',
        'modelrun',
      ],
      rawCharsPerToken: 137,
    },
    // Hyper p99 over 27,361 calls; OpenRouter 718 over 6,657.
    completionCap: 10_822,
    holds: [],
  },
  'gemma-4-26b-a4b-it': {
    hyper: {
      id: 'gemma-4-26b-a4b-it',
      readsImages: false,
      maxOutputLength: 25_600,
    },
    openrouter: {
      id: 'google/gemma-4-26b-a4b-it',
      readsImages: false,
      maxOutputLength: 16_384,
      promptUsdPerMillion: 0.07,
      completionUsdPerMillion: 0.34,
      ignoredEndpoints: [],
      rawCharsPerToken: 137,
    },
    bedrock: {
      id: 'google.gemma-4-26b-a4b',
      readsImages: true,
      contextLength: 262_144,
      maxOutputLength: 262_144,
      route: 'openai-v1',
      streamEnd: 'done-sentinel',
      promptUsdPerMillion: 0.13,
      completionUsdPerMillion: 0.4,
    },
    // Own p99 at most 483 over 16,251 calls on three providers, under the
    // pooled 90th.
    completionCap: 'pooled-p90',
    holds: [],
  },
  'glm-5.3': {
    hyper: {
      id: 'glm-5.3',
      readsImages: false,
      maxOutputLength: 262_144,
    },
    // OpenRouter p99 over 2,673 calls; Hyper 17,118 over 3,343.
    completionCap: 22_067,
    // The roster's slowest voice in every measured role (2026-09-01); off
    // the OpenRouter catalog since 2026-09-09.
    holds: [
      'wide-seat-dropped',
      'openrouter-dropped',
    ],
  },
  'deepseek-v4.1-flash': {
    hyper: {
      id: 'deepseek-v4.1-flash',
      readsImages: true,
      maxOutputLength: 26_214,
    },
    openrouter: {
      id: 'deepseek/deepseek-v4.1-flash',
      readsImages: true,
      maxOutputLength: 384_000,
      promptUsdPerMillion: 0.3,
      completionUsdPerMillion: 1.2,
      ignoredEndpoints: [],
      rawCharsPerToken: 'unmeasured',
    },
    // Approved 2026-09-11; no completed-call distribution of its own yet.
    completionCap: 'pooled-p99',
    // Judge seats on the fidelity probe of 2026-09-11; no producer
    // calibration and no transcription measurement yet.
    holds: [
      'writer-unmeasured',
      'reader-unmeasured',
    ],
  },
  'google.gemma-4-e2b': {
    bedrock: {
      id: 'google.gemma-4-e2b',
      readsImages: false,
      contextLength: 131_072,
      maxOutputLength: 131_072,
      route: 'openai-v1',
      streamEnd: 'done-sentinel',
      promptUsdPerMillion: 0.04,
      completionUsdPerMillion: 0.08,
    },
    // Own p99 483 over 5,506 Bedrock calls, under the pooled 90th.
    completionCap: 'pooled-p90',
    holds: [],
  },
  'google.gemma-4-31b': {
    bedrock: {
      id: 'google.gemma-4-31b',
      readsImages: true,
      contextLength: 262_144,
      maxOutputLength: 262_144,
      route: 'openai-v1',
      streamEnd: 'done-sentinel',
      promptUsdPerMillion: 0.14,
      completionUsdPerMillion: 0.4,
    },
    // Bedrock p99 over 125 calls, the thinnest measurement in the table.
    completionCap: 8_194,
    // Stayed out of the judge seats on the 2026-09-07 fidelity probe; reads
    // pictures since the 2026-09-08 transcription measurement.
    holds: ['judge-unmeasured',],
  },
  'inception/mercury-2.5': {
    openrouter: {
      id: 'inception/mercury-2.5',
      readsImages: false,
      maxOutputLength: 65_536,
      promptUsdPerMillion: 0.04,
      completionUsdPerMillion: 0.15,
      ignoredEndpoints: [],
      rawCharsPerToken: 137,
    },
    // Own p99 3,063 over 136 OpenRouter calls, under the pooled 90th.
    completionCap: 'pooled-p90',
    holds: [],
  },
  'typesafe/jev-1.13': {
    decisions: {
      id: 'typesafe/jev-1.13',
      contextLength: 32_000,
      promptUsdPerMillion: 0.042,
      completionUsdPerMillion: 0,
    },
    // Answers are typed decisions, never a completion; the cap table needs
    // a row for every roster id and this one is never sent.
    completionCap: 'pooled-p90',
    // Owner, 2026-09-18: approved on OpenRouter. 28 of 28 on the reviewed
    // fidelity matrix by a scratch measurement that night (the pass log's
    // "Jev 1.13 approved" heading); the production probe seats it or not.
    holds: [
      'judge-unmeasured',
      'writer-unmeasured',
      'reader-unmeasured',
    ],
  },
};

//endregion Model cards

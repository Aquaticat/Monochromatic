# Charm Hyper does not document model token-count endpoint

## Symptom

A pre-spend completion-envelope check needs model-specific token counts for output JSON.
Hyper documents token usage after generation,
but its complete documentation bundle lists no tokenizer artifact endpoint and no token-count endpoint.

The absence of documentation does not prove an unlisted endpoint is unsupported.
A bounded authenticated probe of Anthropic's standard count route returned HTTP 404.
That observation is route-specific,
not proof that Hyper can never add or expose token counting.

Using one approximate tokenizer for every Hyper model does not establish model-specific counts.
The pinned Candidate H verifier wire tokenizes differently across official model artifacts,
and provider completion usage may also include reasoning or tool-call framing absent from raw JSON encoding.

## Root cause

Hyper's fetched documentation describes compatibility inference endpoints but no tokenizer or count endpoint.
Its documentation bundle at `https://hyper.charm.land/docs/llms-full.txt` lists:

- `POST /v1/chat/completions`;
- `POST /v1/responses`;
- `POST /v1/messages`;
- `GET /v1/models`;
- `GET /v1/credits`.

The documented response `usage` objects report tokens only after generation.
The Anthropic-compatible page says all standard Anthropic parameters are accepted,
but it does not document Anthropic's separate `POST /v1/messages/count_tokens` route.

Model authors publish tokenizer artifacts independently.
The exact planned Candidate H labels have official artifacts:

- `Qwen/Qwen3.8-27B`:
  `tokenizer.json`;
- `moonshotai/Kimi-K3`:
  `tiktoken.model` plus official custom tokenizer code;
- `zai-org/GLM-5.3-Flash`:
  `tokenizer.json`;
- `openai/gpt-oss-120b`:
  `tokenizer.json`;
- `MiniMaxAI/MiniMax-M3`:
  `tokenizer.json`;
- `deepseek-ai/DeepSeek-V4-Flash-0731`:
  `tokenizer.json`;
- `deepseek-ai/DeepSeek-V4-Pro-0813`:
  `tokenizer.json`.

This resolves raw-wire tokenization without calling generation API.
It does not establish how Hyper accounts for hidden reasoning or protocol framing.

## Verification

Access date:
2026-08-31.

### Hyper documentation inventory and probe

`/docs/llms-full.txt` contains no documented token-count route.
The Anthropic Messages page requires `max_tokens` and reports `usage.output_tokens` after response.
The OpenAI-compatible pages similarly report completion usage after response.

One authenticated request sent only `"hi"` to
`POST /v1/messages/count_tokens` with model `deepseek-v4-flash-0731`.
It returned HTTP 404 with a 19-byte non-JSON body.
The private body SHA-256 is
`b16e15764b8bc06c5c3f9f19bc8b99fa48e7894aa5a6ccdad65da49bbf564793`.
No corpus text,
image,
reviewer wording,
or raw provider response is included here.

### Pinned tokenizer artifacts

Pinned official artifacts:

- Qwen3.8 commit `1d4bf0f2ff6012fd82039f2fa52739d0dd7c60c0`,
  `tokenizer.json` SHA-256 `0997f410c57a1f4e53b09e4be8f4a172d90edd9564368fb0847030937229b9f3`;
- Kimi K3 commit `a590ce090cb049c93a33dfe8c208ec652aa20503`,
  `tiktoken.model` SHA-256 `b6c497a7469b33ced9c38afb1ad6e47f03f5e5dc05f15930799210ec050c5103`,
  `encoding_k3.py` SHA-256 `49ff03305fdc4be26867972788d36150b67f8a9e852e62bb7959d87482223676`,
  `tokenization_kimi.py` SHA-256 `f28ea66e2d862a2a5814970b2ce40c2f7d8296ff09aed90a7e7def689b906944`,
  and `tokenizer_config.json` SHA-256 `5d0803c94db9cd78763499e0956c95fd5a225c14a727e5a6cf5db3f96f010a6e`;
- GLM 5.3 Flash commit `04c4e9e95c5da8862dced7e5056455116f83a7e0`,
  `tokenizer.json` SHA-256 `19e773648cb4e65de8660ea6365e10acca112d42a854923df93db4a6f333a82d`;
- gpt-oss-120b commit `b5c939de8f754692c1647ca79fbf85e8c1e70f8a`,
  `tokenizer.json` SHA-256 `0614fe83cadab421296e664e1f48f4261fa8fef6e03e63bb75c20f38e37d07d3`;
- MiniMax M3 commit `f0e1c1e04d40177e4673a22097036854f536e9c0`,
  `tokenizer.json` SHA-256 `bb1f1626cf01448f1e3b6036d0a061ffc66c91d9046aada14ea23a5441b5ad6e`;
- DeepSeek V4 Flash 0731 commit `7872f01b1d1fe23eabc4c98b48bffcef5a386062`,
  `tokenizer.json` SHA-256 `8f9f37ca37fdc4f5fd36d5cf4d3b0e8392edb4e894fd10cc0d70b4957c8633cf`;
- DeepSeek V4 Pro 0813 commit `72e1d3230f6c080a530b0a1d46f8eb4602340597`,
  `tokenizer.json` SHA-256 `8f9f37ca37fdc4f5fd36d5cf4d3b0e8392edb4e894fd10cc0d70b4957c8633cf`.

Standard tokenizer JSON used Python `tokenizers` 0.22.2.
Kimi used official custom code with `tiktoken` 0.12.0 and `transformers` 5.16.1.
DeepSeek's two exact variants publish byte-identical tokenizer artifacts at these commits.

### Candidate H raw-wire results

The synthetic structurally admitted four-candidate verifier witness is 17,780 compact bytes with SHA-256
`5600dbd91e34c2b3319eaf38a6c14e3f71f77792e96e6757da8f26f24f004e25`.

Exact raw JSON token counts:

- MiniMax M3:
  7,737;
- DeepSeek V4 Flash 0731:
  8,011;
- DeepSeek V4 Pro 0813:
  8,011.

The lowest verifier raw-wire arithmetic reserve below 32,000 is therefore 23,989 tokens.

The realistic complete author witness is 21,412 compact bytes with SHA-256
`bb61c6dcb2cde515e04748cccabb99e15579edf9091e634b156e633c3159ef08`.
It is retained rejected output used only as size evidence.

Exact raw JSON token counts:

- Qwen3.8-27B:
  4,585;
- Kimi K3:
  4,594;
- GLM 5.3 Flash:
  4,563;
- gpt-oss-120b:
  4,553.

The lowest author-witness raw-wire arithmetic reserve below 32,000 is therefore 27,406 tokens.

### Positive interpretation boundary

These measurements establish raw JSON wire size under exact official tokenizers.
They do not establish total provider completion usage.
A retained Qwen3.8 Flash expansion response reported 15,493 completion tokens,
while its compact raw JSON used 4,585 Qwen3.8-27B tokens.
This cross-model comparison shows that raw encoding alone does not account for reasoning and tool framing.
Actual `usage.output_tokens` and finish reason remain required calibration evidence.

## Verified workarounds

### Pin official model tokenizer artifacts

Download tokenizer files at exact model-author commits,
hash them,
and tokenize compact response witnesses locally.

Tradeoff:
provider deployment can diverge from model repository.
A live accepted response must still record provider usage and finish reason.

### Keep a measured raw-wire reserve

Require measured raw JSON to leave room for provider framing and model reasoning.
Candidate H's current verifier raw-wire reserve exceeds 23,000 tokens for every planned verifier tokenizer.

Tradeoff:
reserve is evidence,
not proof of a model's reasoning consumption.
Only calibration observes that behavior.

### Reject token-limit completion before parsing

Treat Anthropic `max_tokens` and OpenAI-compatible `length` as unusable even if returned JSON parses.
This prevents syntax-complete truncation from entering selection.

Tradeoff:
a response completed exactly at limit is conservatively rejected.

## What does not work

- Treating byte count divided by three as exact model tokenization.
- Treating Qwen tokenizer count as evidence for MiniMax or DeepSeek.
- Treating raw JSON token count as total completion usage.
- Assuming Anthropic's documented count route exists on Hyper because `/v1/messages` is compatible.
- Raising project completion ceiling instead of measuring current bounded response and finish reason.

## Upstream filing decision

`.out-of-scope/` has no matching Hyper exemption.

1. Upstream fault:
   **not established**.
   Hyper does not promise a token-count endpoint.
2. Upstream can fix:
   **possibly** by documenting a supported count route or tokenizer identity,
   but current model-author artifacts already support local raw-wire measurement.
3. Supported use case:
   **unknown** for token counting;
   documented APIs cover generation and post-generation usage.
4. Contribution welcome:
   **unknown** because Hyper service and documentation source are not public.
5. Likely fix:
   **unknown** without public tracker or maintainer signal.
6. Minimal compatible prototype:
   **not applicable** because no public Hyper source exists.

### Upstream filing artifact

Nothing to file or comment upstream.
The observed documentation surface is internally consistent,
and local pinned tokenizers resolve the current measurement need.

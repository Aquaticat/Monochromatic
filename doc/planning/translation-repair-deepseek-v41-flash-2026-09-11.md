# DeepSeek V4.1 Flash admission

The owner states:
“DeepSeek V4.1 Flash is now up and approved on both OpenRouter and Hyper.
Do with this information whatever is appropriate.”

Task 30 verifies and integrates serving,
identity and catalog data.
Task 31 applies existing role-calibration rules.
Task 27's archive-evidence implementation is paused,
not complete.
No full-entry pass is running.

## Measured availability

Authenticated catalog reads on 2026-09-11 returned HTTP 200 on both providers.
`~/temp/agent/deepseek-v41-flash-discovery-20260911.json`
retains the metadata without credentials.

- OpenRouter:
  `deepseek/deepseek-v4.1-flash`.
  Canonical slug `deepseek/deepseek-v4.1-flash-20260910`.
  Reported context 1048576 tokens,
  maximum completion 384000 tokens,
  text and image input.
  Base listed USD rates are 0.3 input and 1.2 completion per million,
  with time-dependent discounted overrides.
  Reported wire cost remains authoritative over a fixed catalog estimate.
- Hyper:
  `deepseek-v4.1-flash`.
  Reported context 1048576 tokens,
  maximum output 26214 tokens,
  vision capability.
  Its API pricing fields are not silently treated as the credits-per-million
  units in the existing dated Hyper cost table.

The raw-fetch protocol probe uses existing compiled builders and stream parsers,
not provider SDKs.
It asks for an invented object containing `animal: cat` and `count: 7`.
It supplies the existing unmeasured-model pooled p99 cap of 13082,
not V4 Flash 0731's cap,
and no thinking,
budget or reasoning-effort parameter.

- Hyper:
  streamed forced-tool request succeeded,
  `tool_use` finish,
  exact object,
  708 prompt and 59 completion tokens.
- OpenRouter:
  first request returned HTTP 429 with no reported usage retained.
  One such response is not treated as a stable availability limit.
  The same-input recheck succeeded through DeepInfra:
  `stop` finish,
  exact object,
  52 prompt and 120 completion tokens,
  0.0000824 USD reported cost.

Reports:
`deepseek-v41-flash-protocol-20260911.json`
and `deepseek-v41-flash-protocol-r2-20260911.json`
under `~/temp/agent/`.
Raw traffic is transient;
reports retain decoded answers,
usage,
status and serving identity only.

These calls establish text protocol compatibility,
not translation quality or image-reading performance.

## Integration boundaries

- Use one new roster identity shared by Hyper and OpenRouter.
  Neither provider creates a second voter for the same model.
- Preserve V4 Flash 0731 as a distinct existing version unless separate evidence or owner instruction retires it.
- Do not inherit that version's writer exclusion,
  calibration,
  completion distribution or endpoint exclusions.
- Use the existing pooled unmeasured cap until sufficient own-model usage is measured.
- Preserve provider order and all current self-vote,
  author-defense and quorum rules.
- Do not infer endpoint exclusion from the initial HTTP 429.
- Keep judge,
  writer and reader eligibility separate.
  Gemma 4 31B is an existing example of a measured reader without a judge seat;
  deriving readers from the judge roster would incorrectly remove it.
- Catalog approval is not measured role admission.
  New-model calibration holds must prevent accidental seating through catalog-derived arrays.

## Next verification

Implement catalog/routing/cap guards and verify actual compiled clients on both providers.
Exercise image input before enabling a reader seat.
Apply the existing judge-fidelity admission comparison and producer-calibration policy,
recording actual serving context and participation.
Keep the source corpus pinned and do not launch a whole-corpus development run.

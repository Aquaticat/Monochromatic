# Roster refresh: calibrate then seat, under an owner blocklist

## Status

Decided by the owner on 2026-09-01,
answering the roster decision point in
[`translation-repair-no-loop-design.md`](../planning/translation-repair-no-loop-design.md):
option R3,
"Calibrate then seat",
with a blocklist stated in the same answer.

The shape decision point was answered separately and is NOT a decision:
"There's no point of asking me to set something in stone.
You're free to prototype and measure and do anything.
I am neither explicitly approving it nor explicitly disapproving it
because I know we'd get stuck in a box either way."
Design authority over the pipeline shape is therefore delegated:
prototype,
measure,
and adjust without treating the written shape as ratified.

## The blocklist, verbatim with the owner's reasons

- `hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4`:
  "can't stick to its own viewpoint".
- `hf:zai-org/GLM-4.7-Flash`,
  `hf:zai-org/GLM-5.2`,
  GLM5,
  GLM5.1,
  Kimi K2.5,
  Kimi K2.6,
  Kimi K2.7 Code,
  Llama,
  MiniMax M2.7,
  Qwen3.6,
  Qwen3.7,
  Qwen3:
  "too outdated".
- `deepseek-v4-flash`,
  `deepseek-v4-pro`:
  "the undated versions",
  so dated aliases such as `deepseek-v4-pro-0813` stay eligible.
- Qwen 3.8 Max
  (`qwen3.8-max`):
  "absurd cost in money".

Reading notes,
mine:
bare "Qwen3" names the Qwen3 series,
not Qwen3.8,
because the owner blocklists Qwen 3.8 Max separately on cost,
which presupposes other Qwen3.8 variants remain eligible;
"Llama" blocks the whole family.
`qwen3.8-max` is currently a seated production model,
so this unseats it at the next seating.

## Advisory attached to the same answer

"DeepSeek models sometimes treats prompts extremely literally."
Carry this into sheet and prompt design wherever a DeepSeek route is a candidate:
avoid figurative instructions,
spell out edge handling,
and treat over-literal readings as a known failure shape rather than model noise.

## Consequences

- The calibration candidate set is the live Hyper and Synthetic catalogs
  minus this blocklist,
  mapped to exact catalog ids in a named constant with the reason per entry.
- Seating follows the calibration measurements,
  per the R3 order recorded in the no-loop design:
  code lands verified,
  calibration seats the roster,
  four-entry pass,
  reading.

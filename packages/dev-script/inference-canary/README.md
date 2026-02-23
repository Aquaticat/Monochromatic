# inference-canary

Detects LLM inference degradation by running code-generation probes against multiple models and scoring the output on correctness, lint quality, and type safety.

## Motivation

Inference degradation (increased latency, truncated outputs, reduced code quality) is hard to detect from inside an agent session.
This package provides objective, reproducible probes that establish a baseline for each model and flag statistical outliers.

## How it works

Each probe asks a model to write a single-file TypeScript CLI that solves a non-trivial problem.
The generated code is:

1.  Executed in a locked-down podman container (no network, read-only FS, 256MB memory, 15s timeout)
2.  Linted with the monorepo's oxlint config
3.  Type-checked with tsgo under the monorepo's strict tsconfig

Scoring combines three dimensions:

- **Correctness** (40%): does the code execute and produce the expected output?
- **Lint quality** (30%): oxlint violations, errors weighted 3x over warnings
- **Type safety** (30%): TypeScript type errors from tsgo

A second "fix" pass sends the model its code plus diagnostics and measures improvement.

## Probes

- **csv-rfc4180**: RFC 4180 CSV parser with escaped quotes and multiline fields
- **expr-eval**: expression evaluator with operator precedence and recursive descent parsing
- **css-mixin-transpiler**: CSS native `@mixin`/`@apply` transpiler with recursive expansion, nested rules, and top-level apply
- **task-scheduler** (slow, off by default): concurrent task scheduler with dependency resolution and timing constraints

Probes are intentionally hard -- a healthy model scores around 0.7-0.8, not 1.0.
This makes subtle degradation detectable: a drop from 0.7 to 0.4 is clear signal.

## Usage

```bash
mise run canary
```

### Options

- `--model <id>` -- test a single OpenRouter model instead of all registered models
- `--runs <n>` -- consistency runs per probe (default: 2)
- `--simple` -- run cheap text-only probes instead of code-gen
- `--slow` -- include slow probes (e.g. task-scheduler)
- `--retest-all` -- retest all models even if recent (<24h) results exist

### Environment

- `INFERENCE_VALIDATION_OPENROUTER_API_KEY` -- OpenRouter API key (read from `.env.local` via mise)

## Models

All models are tested in parallel via OpenRouter:

- Anthropic Claude Sonnet 4.6
- Anthropic Claude Haiku 4.5
- MiniMax M2.5
- Moonshot Kimi K2.5
- Z-AI GLM 5
- Qwen 3.5 OSS (397B MoE)
- OpenAI GPT 5.2

## Artifacts

### `canary-history.jsonl`

Append-only JSONL file with one entry per model per run.
Used for statistical threshold computation (mean - 2 * stddev).
Gitignored -- local to each machine.

### `src/canary-lint/`

Generated model outputs organized as `<model-slug>/<probe>-<pass>/`:

- `canary.ts` -- the TypeScript source the model generated
- `meta.json` -- model ID, probe name, pass (initial/fix), timestamp

Gitignored but preserved locally across runs for post-run inspection.
Directory structure is designed for a future viewer tool that displays score graphs with clickable data points.

## Architecture

```
src/
  index.ts             CLI entry point, multi-model orchestration
  runner.ts            OpenAI SDK streaming, per-probe timeout, scoring
  probes.ts            Probe type definition, simple probes
  probes-codegen.ts    Code-generation probes, scoring logic
  container.ts         Podman container executor
  linter.ts            Oxlint + tsgo runner, artifact writing
  models.ts            Model registry
  history.ts           JSONL history storage, threshold computation
  report.ts            Report formatting
```

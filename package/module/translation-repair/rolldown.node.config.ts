import { nodeConfig, } from '@monochromatic-dev/config-rolldown/.node.ts';

// Every RUNNER is a build entry, not just the library index.
//
// The tasks used to invoke `node src/corpus-run/<name>.ts` directly, so what
// executed was loose source while the tests imported the built bundle. That
// split is what made "which pipeline produced this artifact" hard to answer at
// all: there was no single artifact to point at, only a transitive closure of
// source files that had to be reconstructed to be identified.
//
// Building the runners makes the executed thing a FILE. Identity, staleness and
// reproducibility all become questions about `dist/final/node` rather than
// about an import graph.
/**
 * Node build: the library index plus every corpus-run runner.
 *
 * @example
 * ```ts
 * // consumed by rolldown as this file default export
 * ```
 */
const config: ReturnType<typeof nodeConfig> = nodeConfig({
  input: {
    index: './src/index.ts',
    "budget-sample": "./src/corpus-run/budget-sample.ts",
    "checker-sensitivity": "./src/corpus-run/checker-sensitivity.ts",
    "corpus-pass": "./src/corpus-run/corpus-pass.ts",
    "damage-sample": "./src/corpus-run/damage-sample.ts",
    "draw-sample": "./src/corpus-run/draw-sample.ts",
    "meter-report": "./src/corpus-run/meter-report.ts",
    "model-catalog": "./src/corpus-run/model-catalog.ts",
    "audit-sensitivity": "./src/corpus-run/audit-sensitivity.ts",
    "rendering-audit-settled": "./src/corpus-run/rendering-audit-settled.ts",
    "rendering-audit-settled-report": "./src/corpus-run/rendering-audit-settled-report.ts",
    "model-health": "./src/corpus-run/model-health.ts",
    "probe-relabel": "./src/corpus-run/probe-relabel.ts",
    "producer-calibrate": "./src/corpus-run/producer-calibrate.ts",
    "provider-concurrency-aggregate-probe": "./src/corpus-run/provider-concurrency-aggregate-probe.ts",
    "provider-concurrency-probe": "./src/corpus-run/provider-concurrency-probe.ts",
    "probe-sensitivity": "./src/corpus-run/probe-sensitivity.ts",
    "probe-verify": "./src/corpus-run/probe-verify.ts",
    "prototype-accountable-editor": "./src/corpus-run/prototype-accountable-editor.ts",
    "prototype-brief-editor": "./src/corpus-run/prototype-brief-editor.ts",
    "prototype-brief-editor-controls": "./src/corpus-run/prototype-brief-editor-controls.ts",
    "prototype-conditional-audit-calibration": "./src/corpus-run/prototype-conditional-audit-calibration.ts",
    "prototype-conditional-audit-controls": "./src/corpus-run/prototype-conditional-audit-controls.ts",
    "prototype-conditional-audit-replay": "./src/corpus-run/prototype-conditional-audit-replay.ts",
    "prototype-conditional-shell": "./src/corpus-run/prototype-conditional-shell.ts",
    "prototype-hyper-reserve-evaluation": "./src/corpus-run/prototype-hyper-reserve-evaluation.ts",
    "prototype-hyper-expansion-client": "./src/prototype-hyper-expansion-client.ts",
    "prototype-hyper-roster-expansion": "./src/corpus-run/prototype-hyper-roster-expansion.ts",
    "prototype-immutable-shell": "./src/corpus-run/prototype-immutable-shell.ts",
    "prototype-immutable-shell-controls": "./src/corpus-run/prototype-immutable-shell-controls.ts",
    "prototype-realization": "./src/prototype-realization.ts",
    "prototype-serial-controls": "./src/corpus-run/prototype-serial-controls.ts",
    "prototype-serial-producers": "./src/corpus-run/prototype-serial-producers.ts",
    "prototype-specification-compiler": "./src/corpus-run/prototype-specification-compiler.ts",
    "prototype-specification-compiler-controls": "./src/corpus-run/prototype-specification-compiler-controls.ts",
    "recall-benchmark": "./src/corpus-run/recall-benchmark.ts",
    "roster-bench": "./src/corpus-run/roster-bench.ts",
    "score-agreement": "./src/corpus-run/score-agreement.ts",
    "score-attribution": "./src/corpus-run/score-attribution.ts",
    "score-crosscheck": "./src/corpus-run/score-crosscheck.ts",
    "score-probe": "./src/corpus-run/score-probe.ts",
    "score-verify": "./src/corpus-run/score-verify.ts",
    "sentinel-probe": "./src/corpus-run/sentinel-probe.ts",
    "coverage-control-probe": "./src/corpus-run/coverage-control-probe.ts",
    "coverage-probe": "./src/corpus-run/coverage-probe.ts",
    "displacement-probe": "./src/corpus-run/displacement-probe.ts",
    "editor-calibrate": "./src/corpus-run/editor-calibrate.ts",
    "editor-standing-read": "./src/corpus-run/editor-standing-read.ts",
    "editor-width-probe": "./src/corpus-run/editor-width-probe.ts",
    "judge-fidelity-probe": "./src/corpus-run/judge-fidelity-probe.ts",
    "ledger-report": "./src/corpus-run/ledger-report.ts",
    "run-timing-report": "./src/corpus-run/run-timing-report.ts",
    "slice-census": "./src/corpus-run/slice-census.ts",
    "slice-cost-report": "./src/corpus-run/slice-cost-report.ts",
    "spend-report": "./src/corpus-run/spend-report.ts",
    "translate-probe": "./src/corpus-run/translate-probe.ts",
    "verify-published": "./src/corpus-run/verify-published.ts",
    "window-trial-probe": "./src/corpus-run/window-trial-probe.ts",
  },
},);

export default config;

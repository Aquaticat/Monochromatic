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
    "checker-sensitivity": "./src/corpus-run/checker-sensitivity.ts",
    "corpus-pass": "./src/corpus-run/corpus-pass.ts",
    "damage-sample": "./src/corpus-run/damage-sample.ts",
    "draw-sample": "./src/corpus-run/draw-sample.ts",
    "model-catalog": "./src/corpus-run/model-catalog.ts",
    "audit-sensitivity": "./src/corpus-run/audit-sensitivity.ts",
    "model-health": "./src/corpus-run/model-health.ts",
    "probe-relabel": "./src/corpus-run/probe-relabel.ts",
    "probe-sensitivity": "./src/corpus-run/probe-sensitivity.ts",
    "probe-verify": "./src/corpus-run/probe-verify.ts",
    "recall-benchmark": "./src/corpus-run/recall-benchmark.ts",
    "roster-bench": "./src/corpus-run/roster-bench.ts",
    "score-agreement": "./src/corpus-run/score-agreement.ts",
    "score-attribution": "./src/corpus-run/score-attribution.ts",
    "score-crosscheck": "./src/corpus-run/score-crosscheck.ts",
    "score-probe": "./src/corpus-run/score-probe.ts",
    "score-verify": "./src/corpus-run/score-verify.ts",
    "sentinel-probe": "./src/corpus-run/sentinel-probe.ts",
    "coverage-probe": "./src/corpus-run/coverage-probe.ts",
    "displacement-probe": "./src/corpus-run/displacement-probe.ts",
    "judge-fidelity-probe": "./src/corpus-run/judge-fidelity-probe.ts",
    "slice-census": "./src/corpus-run/slice-census.ts",
    "translate-probe": "./src/corpus-run/translate-probe.ts",
    "window-trial-probe": "./src/corpus-run/window-trial-probe.ts",
  },
},);

export default config;
